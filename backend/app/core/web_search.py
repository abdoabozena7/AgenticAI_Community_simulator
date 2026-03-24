"""
Web search integration with strict live-web mode support.

By default, this module runs in strict mode and avoids synthetic
search fabrication when live sources are unavailable.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import html
import urllib.error
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

from .ollama_client import generate_ollama
from ..services.translation_bridge import build_search_translator


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


STRICT_WEB_ONLY_DEFAULT = _env_flag("SEARCH_WEB_ONLY_STRICT", True)
ALLOW_SYNTHETIC_SEARCH_FALLBACK = _env_flag("SEARCH_ALLOW_LLM_FALLBACK", False)


def _post_json(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read().decode("utf-8")
    return json.loads(body)


def _normalize_query(query: str) -> str:
    return re.sub(r"\s+", " ", query).strip()


def _contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", str(text or "")))


def _compact_query(query: str, max_terms: int = 14) -> str:
    cleaned = re.sub(r"[\"'`]+", " ", str(query or ""))
    cleaned = re.sub(r"[^\w\s\u0600-\u06FF-]+", " ", cleaned, flags=re.UNICODE)
    terms = [t for t in cleaned.split() if len(t.strip()) > 1]
    return " ".join(terms[:max_terms]).strip()


def _extract_domain(url: str) -> str:
    match = re.search(r"https?://([^/]+)/?", url)
    return match.group(1).lower() if match else url


def _build_favicon_url(domain: str) -> str:
    host = str(domain or "").strip()
    if not host:
        return ""
    return f"https://www.google.com/s2/favicons?domain={host}&sz=64"


def _decode_ddg_redirect(url: str) -> str:
    """DuckDuckGo HTML results use redirect links with ``uddg`` query param."""
    raw = str(url or "").strip()
    if not raw:
        return ""
    if raw.startswith("//"):
        raw = f"https:{raw}"
    try:
        parsed = urllib.parse.urlparse(raw)
        query = urllib.parse.parse_qs(parsed.query)
        uddg = query.get("uddg")
        if uddg and isinstance(uddg, list):
            return urllib.parse.unquote(uddg[0])
    except Exception:
        pass
    return raw


def _keyword_reason(query: str, title: str, snippet: str) -> str:
    terms = [t for t in re.split(r"[^a-zA-Z0-9\u0600-\u06FF]+", query.lower()) if len(t) > 2]
    haystack = f"{title} {snippet}".lower()
    matched = [t for t in terms if t in haystack]
    if matched:
        return f"Matches keywords: {', '.join(matched[:4])}."
    return "Topical match based on the query intent."


def _compute_search_quality(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(results or [])
    usable = 0
    domains = set()
    for item in results or []:
        url = str(item.get("url") or "").strip()
        domain = str(item.get("domain") or "").strip().lower()
        snippet = str(item.get("snippet") or "").strip()
        title = str(item.get("title") or "").strip()
        if domain:
            domains.add(domain)
        if url and (len(snippet) >= 80 or len(title) >= 8):
            usable += 1
    return {
        "usable_sources": usable,
        "domains": len(domains),
        "extraction_success_rate": (usable / total) if total > 0 else 0.0,
    }


async def _tavily_search(query: str, max_results: int, language: str) -> Dict[str, Any]:
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError("Tavily API key not set")
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": "basic",
        "include_answer": True,
        "include_raw_content": False,
        "include_images": False,
        "language": language or "en",
    }
    result = await asyncio.to_thread(_post_json, "https://api.tavily.com/search", payload)
    results = []
    for item in result.get("results", []) or []:
        title = item.get("title") or ""
        url = item.get("url") or ""
        snippet = item.get("content") or ""
        results.append(
            {
                "title": title,
                "url": url,
                "domain": _extract_domain(url),
                "favicon_url": _build_favicon_url(_extract_domain(url)),
                "snippet": snippet[:280],
                "score": item.get("score"),
                "reason": _keyword_reason(query, title, snippet),
            }
        )
    return {
        "provider": "tavily",
        "is_live": True,
        "answer": (result.get("answer") or "").strip(),
        "results": results,
    }


# New search providers: DuckDuckGo and Wikipedia
async def _ddg_search(query: str, max_results: int, language: str) -> Dict[str, Any]:
    """Perform a DuckDuckGo HTML search and parse real web results."""
    try:
        url = "https://duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query, "kl": "wt-wt"})
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; AgenticSimulator/1.0; +https://duckduckgo.com)",
                "Accept-Language": "ar,en;q=0.8" if language.lower().startswith("ar") else "en-US,en;q=0.8",
            },
        )
        html_text = await asyncio.to_thread(lambda: urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "ignore"))
    except Exception:
        return {"provider": "duckduckgo", "is_live": False, "answer": "", "results": []}

    results: List[Dict[str, Any]] = []
    anchor_matches = list(
        re.finditer(
            r'<a[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            html_text,
            flags=re.S,
        )
    )
    snippet_matches = list(
        re.finditer(
            r'<a[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>(.*?)</a>|'
            r'<div[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>(.*?)</div>',
            html_text,
            flags=re.S,
        )
    )

    for idx, anchor in enumerate(anchor_matches):
        if len(results) >= max_results:
            break
        raw_url = html.unescape(anchor.group(1) or "").strip()
        url_item = _decode_ddg_redirect(raw_url)
        title_raw = anchor.group(2) or ""
        title = html.unescape(re.sub(r"<[^>]+>", "", title_raw)).strip()
        if not url_item or not title:
            continue
        snippet = ""
        if idx < len(snippet_matches):
            snippet_raw = snippet_matches[idx].group(1) or snippet_matches[idx].group(2) or ""
            snippet = html.unescape(re.sub(r"<[^>]+>", "", snippet_raw)).strip()
        results.append(
            {
                "title": title,
                "url": url_item,
                "domain": _extract_domain(url_item),
                "favicon_url": _build_favicon_url(_extract_domain(url_item)),
                "snippet": snippet[:280],
                "score": 0.6,
                "http_status": 200,
                "reason": _keyword_reason(query, title, snippet),
            }
        )

    return {
        "provider": "duckduckgo",
        "is_live": True,
        "answer": "",
        "results": results,
    }


async def _ddg_lite_search(query: str, max_results: int, language: str) -> Dict[str, Any]:
    """Fallback DuckDuckGo provider using the lite HTML endpoint.

    The lite page is often less fragile than the default HTML page and has
    stable ``result-link`` / ``result-snippet`` markers.
    """
    try:
        url = "https://lite.duckduckgo.com/lite/?" + urllib.parse.urlencode({"q": query, "kl": "wt-wt"})
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; AgenticSimulator/1.0; +https://duckduckgo.com)",
                "Accept-Language": "ar,en;q=0.8" if language.lower().startswith("ar") else "en-US,en;q=0.8",
            },
        )
        html_text = await asyncio.to_thread(
            lambda: urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "ignore")
        )
    except Exception:
        return {"provider": "duckduckgo_lite", "is_live": False, "answer": "", "results": []}

    anchors: List[tuple[str, str]] = []
    for match in re.finditer(r"(<a\b[^>]*>)(.*?)</a>", html_text, flags=re.S | re.I):
        tag = match.group(1) or ""
        if "result-link" not in tag:
            continue
        href_match = re.search(r'href=[\"\']([^\"\']+)[\"\']', tag, flags=re.I)
        href = html.unescape((href_match.group(1) if href_match else "") or "").strip()
        title = html.unescape(re.sub(r"<[^>]+>", "", match.group(2) or "")).strip()
        if href and title:
            anchors.append((href, title))

    snippets: List[str] = []
    for snippet_match in re.finditer(
        r"<td[^>]*class=['\"][^'\"]*result-snippet[^'\"]*['\"][^>]*>(.*?)</td>",
        html_text,
        flags=re.S | re.I,
    ):
        snippet_html = snippet_match.group(1) or ""
        snippet = html.unescape(re.sub(r"<[^>]+>", "", snippet_html)).strip()
        snippets.append(snippet)

    results: List[Dict[str, Any]] = []
    for idx, (raw_url, title) in enumerate(anchors):
        if len(results) >= max_results:
            break
        url_item = _decode_ddg_redirect(raw_url)
        if not url_item:
            continue
        snippet = snippets[idx] if idx < len(snippets) else ""
        results.append(
            {
                "title": title,
                "url": url_item,
                "domain": _extract_domain(url_item),
                "favicon_url": _build_favicon_url(_extract_domain(url_item)),
                "snippet": snippet[:280],
                "score": 0.58,
                "http_status": 200,
                "reason": _keyword_reason(query, title, snippet),
            }
        )

    return {
        "provider": "duckduckgo_lite",
        "is_live": True,
        "answer": "",
        "results": results,
    }


async def _wikipedia_search(query: str, max_results: int, language: str) -> Dict[str, Any]:
    """Perform a Wikipedia API search.

    Returns at most ``max_results`` items with title, url, snippet and reason.
    """
    # Use English Wikipedia if language not Arabic; for Arabic use ar.wikipedia
    lang_code = "ar" if language.lower().startswith("ar") else "en"
    try:
        url = (
            f"https://{lang_code}.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
                "action": "query",
                "list": "search",
                "srsearch": query,
                "utf8": "",
                "format": "json",
            })
        )
        data = await asyncio.to_thread(lambda: json.loads(urllib.request.urlopen(url, timeout=10).read().decode("utf-8")))
    except Exception:
        return {"provider": "wikipedia", "is_live": False, "answer": "", "results": []}
    results: List[Dict[str, Any]] = []
    for item in (data.get("query", {}).get("search", []) or [])[:max_results]:
        title = item.get("title") or ""
        snippet_html = item.get("snippet") or ""
        # Remove HTML tags
        snippet_text = re.sub(r"<[^>]+>", "", snippet_html)
        page_url = f"https://{lang_code}.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
        results.append(
            {
                "title": title,
                "url": page_url,
                "domain": _extract_domain(page_url),
                "favicon_url": _build_favicon_url(_extract_domain(page_url)),
                "snippet": snippet_text[:280],
                "score": None,
                "reason": _keyword_reason(query, title, snippet_text),
            }
        )
    return {
        "provider": "wikipedia",
        "is_live": True,
        "answer": "",
        "results": results,
    }


async def _bing_rss_search(query: str, max_results: int, language: str) -> Dict[str, Any]:
    """Fallback live search provider using Bing RSS feed."""
    try:
        feed_url = "https://www.bing.com/search?" + urllib.parse.urlencode(
            {
                "q": query,
                "format": "rss",
                "setlang": "ar" if language.lower().startswith("ar") else "en",
            }
        )
        req = urllib.request.Request(
            feed_url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; AgenticSimulator/1.0)",
                "Accept-Language": "ar,en;q=0.8" if language.lower().startswith("ar") else "en-US,en;q=0.8",
            },
        )
        xml_body = await asyncio.to_thread(lambda: urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "ignore"))
        root = ET.fromstring(xml_body)
    except Exception:
        return {"provider": "bing_rss", "is_live": False, "answer": "", "results": []}

    results: List[Dict[str, Any]] = []
    for item in root.findall(".//item"):
        if len(results) >= max_results:
            break
        title = (item.findtext("title") or "").strip()
        url_item = (item.findtext("link") or "").strip()
        snippet = (item.findtext("description") or "").strip()
        if not url_item or not title:
            continue
        results.append(
            {
                "title": title,
                "url": url_item,
                "domain": _extract_domain(url_item),
                "favicon_url": _build_favicon_url(_extract_domain(url_item)),
                "snippet": snippet[:280],
                "score": 0.55,
                "http_status": 200,
                "reason": _keyword_reason(query, title, snippet),
            }
        )

    return {
        "provider": "bing_rss",
        "is_live": True,
        "answer": "",
        "results": results,
    }


async def _llm_fallback(query: str) -> Dict[str, Any]:
    prompt = (
        "You are simulating web search results. Return JSON only with keys: "
        "answer (string) and results (array of 3 items). Each item must have "
        "title, url, snippet. Keep results plausible and diverse.\n"
        f"Query: {query}"
    )
    raw = await generate_ollama(prompt=prompt, temperature=0.4, response_format="json")
    data = json.loads(raw)
    results = []
    for item in data.get("results", [])[:3]:
        url = item.get("url", "")
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        results.append(
            {
                "title": title,
                "url": url,
                "domain": _extract_domain(url),
                "favicon_url": _build_favicon_url(_extract_domain(url)),
                "snippet": snippet[:280],
                "score": None,
                "reason": _keyword_reason(query, title, snippet),
            }
        )
    return {
        "provider": "llm_fallback",
        "is_live": False,
        "answer": (data.get("answer") or "").strip(),
        "results": results,
    }


def _empty_result(provider: str) -> Dict[str, Any]:
    return {"provider": provider, "is_live": False, "answer": "", "results": []}


async def _safe_provider_call(provider: str, coro: Any, *, timeout: float) -> Dict[str, Any]:
    try:
        result = await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        empty = _empty_result(provider)
        empty["attempt_status"] = "timeout"
        return empty
    except Exception as exc:
        empty = _empty_result(provider)
        empty["attempt_status"] = "error"
        empty["error"] = str(exc)
        return empty
    if not isinstance(result, dict):
        empty = _empty_result(provider)
        empty["attempt_status"] = "error"
        return empty
    result.setdefault("provider", provider)
    result.setdefault("results", [])
    result.setdefault("answer", "")
    result["attempt_status"] = "ok" if result.get("results") else "empty"
    return result


def _result_rank(result: Dict[str, Any]) -> tuple[int, int]:
    results = result.get("results") if isinstance(result.get("results"), list) else []
    quality = _compute_search_quality(results)
    return (int(quality.get("usable_sources") or 0), len(results))


async def _run_provider_wave(
    specs: List[tuple[str, Any]],
    *,
    timeout: float,
    query_variant: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not specs:
        return {"best_result": _empty_result("none"), "attempts": []}
    tasks = [
        asyncio.create_task(_safe_provider_call(provider, coro, timeout=timeout))
        for provider, coro in specs
    ]
    best = _empty_result(specs[0][0])
    attempts: List[Dict[str, Any]] = []
    try:
        for future in asyncio.as_completed(tasks):
            result = await future
            attempt = {
                "provider": str(result.get("provider") or ""),
                "status": str(result.get("attempt_status") or "empty"),
                "result_count": len(result.get("results") or []),
                "query": (query_variant or {}).get("text"),
                "query_language": (query_variant or {}).get("language"),
                "query_source": (query_variant or {}).get("source"),
            }
            if result.get("error"):
                attempt["error"] = str(result.get("error") or "")
            attempts.append(attempt)
            if _result_rank(result) > _result_rank(best):
                best = result
            if result.get("results"):
                for task in tasks:
                    if not task.done():
                        task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                return {"best_result": result, "attempts": attempts}
        await asyncio.gather(*tasks, return_exceptions=True)
        return {"best_result": best, "attempts": attempts}
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()


def _validate_structured(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        return {}
    required = [
        "summary",
        "market_presence",
        "price_range",
        "signals",
        "user_types",
        "complaints",
        "behaviors",
        "competition_reactions",
        "user_sentiment",
        "behavior_patterns",
        "gaps_in_market",
        "confidence_score",
        "competition_level",
        "demand_level",
        "regulatory_risk",
        "price_sensitivity",
    ]
    if not all(key in data for key in required):
        return {}
    list_fields = [
        "signals",
        "user_types",
        "complaints",
        "behaviors",
        "competition_reactions",
        "behavior_patterns",
        "notable_locations",
        "gaps",
        "gaps_in_market",
        "visible_insights",
        "expandable_reasoning",
    ]
    if any(not isinstance(data.get(field), list) for field in list_fields):
        return {}
    sentiment = data.get("user_sentiment")
    if not isinstance(sentiment, dict):
        return {}
    for key in ("positive", "negative", "neutral"):
        if not isinstance(sentiment.get(key), list):
            return {}
    return data


def _normalize_structured(data: Dict[str, Any], results: List[Dict[str, Any]], language: str) -> Dict[str, Any]:
    normalized = dict(data or {})
    for key in (
        "signals",
        "user_types",
        "complaints",
        "behaviors",
        "competition_reactions",
        "behavior_patterns",
        "gaps",
        "gaps_in_market",
        "notable_locations",
        "visible_insights",
        "expandable_reasoning",
    ):
        values = normalized.get(key) if isinstance(normalized.get(key), list) else []
        cleaned: List[str] = []
        for value in values:
            text = str(value).strip()
            if text and text not in cleaned:
                cleaned.append(text)
        normalized[key] = cleaned[:10]
    sentiment = normalized.get("user_sentiment") if isinstance(normalized.get("user_sentiment"), dict) else {}
    normalized["user_sentiment"] = {
        key: [
            str(value).strip()
            for value in (sentiment.get(key) if isinstance(sentiment.get(key), list) else [])
            if str(value).strip()
        ][:8]
        for key in ("positive", "negative", "neutral")
    }
    for key in ("summary", "market_presence", "price_range"):
        normalized[key] = str(normalized.get(key) or "").strip()
    for key in ("competition_level", "demand_level", "regulatory_risk", "price_sensitivity"):
        value = str(normalized.get(key) or "").strip().lower()
        normalized[key] = value if value in {"low", "medium", "high", "rare", "emerging", "common"} else ("medium" if key != "market_presence" else "")
    try:
        score = float(normalized.get("confidence_score") or 0.0)
    except (TypeError, ValueError):
        score = 0.0
    normalized["confidence_score"] = round(max(0.0, min(1.0, score)), 3)
    sources = normalized.get("sources") if isinstance(normalized.get("sources"), list) else []
    cleaned_sources = []
    seen_urls: set[str] = set()
    for source in list(sources) + [
        {"title": item.get("title"), "url": item.get("url"), "domain": item.get("domain")}
        for item in results[:5]
    ]:
        if not isinstance(source, dict):
            continue
        url = str(source.get("url") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        cleaned_sources.append(
            {
                "title": str(source.get("title") or "").strip(),
                "url": url,
                "domain": str(source.get("domain") or "").strip(),
            }
        )
    normalized["sources"] = cleaned_sources[:8]
    if not normalized["visible_insights"]:
        normalized["visible_insights"] = _default_visible_insights(normalized, language)
    if not normalized["expandable_reasoning"]:
        normalized["expandable_reasoning"] = _default_expandable_reasoning(normalized, language)
    if not normalized["summary"]:
        normalized["summary"] = " | ".join(normalized["visible_insights"][:3])
    return normalized


def _default_visible_insights(structured: Dict[str, Any], language: str) -> List[str]:
    insights: List[str] = []
    market_presence = str(structured.get("market_presence") or "").strip().lower()
    competition = str(structured.get("competition_level") or "").strip().lower()
    price_range = str(structured.get("price_range") or "").strip()
    negative = [str(item).strip() for item in (structured.get("user_sentiment") or {}).get("negative", []) if str(item).strip()]
    positive = [str(item).strip() for item in (structured.get("user_sentiment") or {}).get("positive", []) if str(item).strip()]
    gaps = [str(item).strip() for item in structured.get("gaps_in_market") or [] if str(item).strip()]
    if competition == "high":
        insights.append("المنافسة عالية في المنطقة")
    if market_presence in {"common", "منتشر"}:
        insights.append("الفكرة موجودة أصلًا في السوق بشكل واضح")
    if price_range:
        insights.append(f"السعر المتداول شكله حوالين: {price_range}")
    if negative:
        insights.append(negative[0])
    if positive:
        insights.append(positive[0])
    if gaps:
        insights.append(gaps[0])
    deduped: List[str] = []
    for item in insights:
        if item and item not in deduped:
            deduped.append(item)
    return deduped[:4]


def _default_expandable_reasoning(structured: Dict[str, Any], language: str) -> List[str]:
    lines: List[str] = []
    for key in ("behavior_patterns", "complaints", "competition_reactions", "gaps_in_market"):
        values = [str(item).strip() for item in structured.get(key) or [] if str(item).strip()]
        lines.extend(values[:2])
    summary = str(structured.get("summary") or "").strip()
    if summary:
        lines.append(summary)
    deduped: List[str] = []
    for item in lines:
        if item and item not in deduped:
            deduped.append(item)
    return deduped[:6]


def _structured_confidence_score(structured: Dict[str, Any], quality: Dict[str, Any]) -> float:
    usable = int(quality.get("usable_sources") or 0)
    domains = int(quality.get("domains") or 0)
    extraction = float(quality.get("extraction_success_rate") or 0.0)
    signal_count = sum(
        len([str(item).strip() for item in structured.get(key) or [] if str(item).strip()])
        for key in ("signals", "complaints", "behaviors", "behavior_patterns", "gaps_in_market")
    )
    sentiment_count = sum(
        len([str(item).strip() for item in (structured.get("user_sentiment") or {}).get(key, []) if str(item).strip()])
        for key in ("positive", "negative", "neutral")
    )
    score = 0.18 + min(0.22, usable * 0.07) + min(0.14, domains * 0.05) + min(0.22, extraction * 0.22)
    score += min(0.14, signal_count * 0.02) + min(0.10, sentiment_count * 0.025)
    return round(max(0.0, min(1.0, score)), 3)


def _build_evidence_cards(structured: Dict[str, Any], language: str) -> List[str]:
    cards: List[str] = []
    summary = str(structured.get("summary") or "").strip()
    if summary:
        sentences = [s.strip() for s in re.split(r"[.!?]", summary) if len(s.strip()) > 12]
        cards.extend(sentences[:3])
    signals = structured.get("signals") or []
    if isinstance(signals, list):
        cards.extend(str(s).strip() for s in signals[:4] if str(s).strip())
    for key in ("user_types", "complaints", "behaviors", "competition_reactions"):
        values = structured.get(key) or []
        if isinstance(values, list):
            cards.extend(str(value).strip() for value in values[:2] if str(value).strip())

    def _level_label(key: str, value: str) -> Optional[str]:
        if not value:
            return None
        if language == "ar":
            name_map = {
                "competition_level": "Competition level",
                "demand_level": "Demand level",
                "regulatory_risk": "Regulatory risk",
                "price_sensitivity": "Price sensitivity",
            }
            return f"{name_map.get(key, key)}: {value}"
        return f"{key.replace('_', ' ')}: {value}"

    for key in ("competition_level", "demand_level", "regulatory_risk", "price_sensitivity"):
        label = _level_label(key, str(structured.get(key) or ""))
        if label:
            cards.append(label)

    # Deduplicate while preserving order
    seen = set()
    unique_cards = []
    for card in cards:
        if card and card not in seen:
            seen.add(card)
            unique_cards.append(card)
    return unique_cards[:6]


def _fallback_summary_from_results(results: List[Dict[str, Any]], language: str) -> str:
    snippets: List[str] = []
    for item in results[:3]:
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("snippet") or "").strip()
        if title and snippet:
            snippets.append(f"{title}: {snippet}")
        elif title:
            snippets.append(title)
    if not snippets:
        return ""
    if (language or "").lower().startswith("ar"):
        return "Quick summary from search results: " + " | ".join(snippets)
    return "Quick summary from live search results: " + " | ".join(snippets)


async def _extract_structured(query: str, answer: str, results: List[Dict[str, Any]], language: str) -> Dict[str, Any]:
    snippets = "\n".join(
        f"- {r.get('title','')}: {r.get('snippet','')}" for r in results[:5]
    )
    prompt = (
        "You turn web search results into real human market signals. "
        "Do NOT return search-result summaries. Extract what people seem to like, hate, complain about, ask for, and how they behave. "
        "If direct social evidence is thin, infer cautiously from the snippets and known market logic without inventing statistics. "
        "Return JSON only with keys: "
        "summary (string), market_presence (rare/emerging/common), competition_level (low/medium/high), "
        "price_range (string), user_sentiment ({positive:[], negative:[], neutral:[]}), "
        "signals (array), user_types (array), complaints (array), behaviors (array), competition_reactions (array), "
        "behavior_patterns (array), gaps_in_market (array), demand_level (low/medium/high), "
        "regulatory_risk (low/medium/high), price_sensitivity (low/medium/high), "
        "notable_locations (array), gaps (array of missing info), visible_insights (array of short UI insights), "
        "expandable_reasoning (array of deeper reasoning lines), confidence_score (0..1), "
        "sources (array of {title,url,domain}). "
        "Use only the query and snippets. Do not invent exact figures, fake reviews, or unsupported demographics. "
        "Prefer concrete human-style signals like 'people complain about delivery fees' over vague claims like 'many users like it'. "
        "If a dimension is unclear, leave arrays empty or use a cautious string like '' instead of guessing hard facts. "
        f"Language: {language}. "
        f"Query: {query}\n"
        f"Answer: {answer}\n"
        f"Snippets:\n{snippets}\n"
    )
    raw = await generate_ollama(prompt=prompt, temperature=0.3, response_format="json")
    data = json.loads(raw)
    sources = []
    for r in results[:5]:
        sources.append({
            "title": r.get("title"),
            "url": r.get("url"),
            "domain": r.get("domain"),
        })
    data.setdefault("sources", sources)
    return data


async def search_web(
    query: str,
    max_results: int = 5,
    language: str = "en",
    strict_web_only: Optional[bool] = None,
) -> Dict[str, Any]:
    normalized = _normalize_query(query)
    strict_mode = STRICT_WEB_ONLY_DEFAULT if strict_web_only is None else bool(strict_web_only)
    if not normalized:
        return {
            "provider": "none",
            "is_live": False,
            "answer": "",
            "results": [],
            "strict_mode": strict_mode,
            "search_finished": True,
            "research_ready": False,
            "research_estimated": False,
            "provider_attempts": [],
            "provider_health": [],
            "query_variants": [],
            "quality": {
                "usable_sources": 0,
                "domains": 0,
                "extraction_success_rate": 0.0,
            },
        }
    translator = build_search_translator()
    query_variants = [item.to_dict() for item in translator.build_variants(normalized, language or "en")]
    if not query_variants:
        query_variants = [{"text": normalized, "language": language or "en", "source": "original"}]

    provider_attempts: List[Dict[str, Any]] = []
    fallback_started = False
    wave_summaries: List[Dict[str, Any]] = []

    def build_specs(variant: Dict[str, Any], *, include_tavily: bool = True) -> List[tuple[str, Any]]:
        query_text = str(variant.get("text") or normalized).strip()
        query_language = str(variant.get("language") or language or "en").strip() or "en"
        specs: List[tuple[str, Any]] = []
        if include_tavily:
            specs.append(("tavily", _tavily_search(query_text, max_results=max_results, language=query_language)))
        specs.extend(
            [
                ("duckduckgo", _ddg_search(query_text, max_results=max_results, language=query_language)),
                ("duckduckgo_lite", _ddg_lite_search(query_text, max_results=max_results, language=query_language)),
                ("bing_rss", _bing_rss_search(query_text, max_results=max_results, language=query_language)),
                ("wikipedia", _wikipedia_search(query_text, max_results=max_results, language=query_language)),
            ]
        )
        return specs

    wave = await _run_provider_wave(build_specs(query_variants[0]), timeout=5.0, query_variant=query_variants[0])
    result = wave.get("best_result") or _empty_result("none")
    provider_attempts.extend(wave.get("attempts") or [])
    wave_summaries.append({"query_variant": dict(query_variants[0]), "has_results": bool(result.get("results"))})

    compact_query = _compact_query(normalized)
    if not result.get("results") and compact_query and compact_query != normalized:
        fallback_started = True
        compact_variant = {"text": compact_query, "language": language or "en", "source": "compact"}
        wave = await _run_provider_wave(
            [
                ("duckduckgo", _ddg_search(compact_query, max_results=max_results, language=compact_variant["language"])),
                ("duckduckgo_lite", _ddg_lite_search(compact_query, max_results=max_results, language=compact_variant["language"])),
                ("bing_rss", _bing_rss_search(compact_query, max_results=max_results, language=compact_variant["language"])),
            ],
            timeout=4.5,
            query_variant=compact_variant,
        )
        candidate = wave.get("best_result") or _empty_result("none")
        provider_attempts.extend(wave.get("attempts") or [])
        wave_summaries.append({"query_variant": compact_variant, "has_results": bool(candidate.get("results"))})
        if _result_rank(candidate) > _result_rank(result):
            result = candidate

    if not result.get("results"):
        for variant in query_variants[1:]:
            fallback_started = True
            wave = await _run_provider_wave(build_specs(variant, include_tavily=False), timeout=4.5, query_variant=variant)
            candidate = wave.get("best_result") or _empty_result("none")
            provider_attempts.extend(wave.get("attempts") or [])
            wave_summaries.append({"query_variant": dict(variant), "has_results": bool(candidate.get("results"))})
            if _result_rank(candidate) > _result_rank(result):
                result = candidate
            if result.get("results"):
                break

    if not result.get("results"):
        fallback_started = True
        rescue_variant = {
            "text": f"{_compact_query(normalized)} market analysis demand competition pricing regulation".strip(),
            "language": "en" if _contains_arabic(normalized) else (language or "en"),
            "source": "rescue",
        }
        wave = await _run_provider_wave(build_specs(rescue_variant, include_tavily=False), timeout=4.5, query_variant=rescue_variant)
        candidate = wave.get("best_result") or _empty_result("none")
        provider_attempts.extend(wave.get("attempts") or [])
        wave_summaries.append({"query_variant": rescue_variant, "has_results": bool(candidate.get("results"))})
        if _result_rank(candidate) > _result_rank(result):
            result = candidate

    if not result.get("results") and not strict_mode and ALLOW_SYNTHETIC_SEARCH_FALLBACK:
        fallback_started = True
        result = await _llm_fallback(normalized)
        provider_attempts.append(
            {
                "provider": "llm_fallback",
                "status": "ok" if result.get("results") else "empty",
                "result_count": len(result.get("results") or []),
                "query": normalized,
                "query_language": language or "en",
                "query_source": "llm_fallback",
            }
        )

    # Structured summary with timeout and fallback
    structured: Dict[str, Any] = {}
    for _ in range(2):
        try:
            structured = await asyncio.wait_for(
                _extract_structured(
                    normalized,
                    result.get("answer", ""),
                    result.get("results", []),
                    language or "en",
                ),
                timeout=6.0,
            )
            structured = _validate_structured(structured)
            if structured:
                break
        except Exception:
            structured = {}
    if not structured:
        structured = {
            "summary": (result.get("answer") or "").strip(),
            "market_presence": "",
            "price_range": "",
            "user_sentiment": {"positive": [], "negative": [], "neutral": []},
            "signals": [],
            "user_types": [],
            "complaints": [],
            "behaviors": [],
            "competition_reactions": [],
            "behavior_patterns": [],
            "gaps_in_market": [],
            "competition_level": "medium",
            "demand_level": "medium",
            "regulatory_risk": "medium",
            "price_sensitivity": "medium",
            "notable_locations": [],
            "gaps": [],
            "visible_insights": [],
            "expandable_reasoning": [],
            "confidence_score": 0.0,
            "sources": [
                {"title": r.get("title"), "url": r.get("url"), "domain": r.get("domain")}
                for r in result.get("results", [])[:5]
            ],
        }
    if not str(structured.get("summary") or "").strip():
        structured["summary"] = _fallback_summary_from_results(result.get("results") or [], language or "en")
    quality = _compute_search_quality(result.get("results") or [])
    structured = _normalize_structured(structured, result.get("results") or [], language or "en")
    structured["confidence_score"] = max(
        float(structured.get("confidence_score") or 0.0),
        _structured_confidence_score(structured, quality),
    )
    structured["evidence_cards"] = _build_evidence_cards(structured, language or "en")
    research_ready = bool(
        str(structured.get("summary") or "").strip()
        and str(structured.get("competition_level") or "").strip()
        and str(structured.get("demand_level") or "").strip()
        and str(structured.get("price_sensitivity") or "").strip()
        and (
            len([item for item in structured.get("signals") or [] if str(item).strip()])
            + len([item for item in structured.get("complaints") or [] if str(item).strip()])
            + len([item for item in structured.get("behaviors") or [] if str(item).strip()])
        ) >= 3
    )
    research_estimated = str(structured.get("estimation_mode") or "").strip().lower() == "ai_estimation" or str(result.get("provider") or "") == "llm_fallback"
    provider_health_map: Dict[str, Dict[str, Any]] = {}
    for attempt in provider_attempts:
        provider = str(attempt.get("provider") or "").strip()
        if not provider:
            continue
        record = provider_health_map.setdefault(
            provider,
            {"provider": provider, "ok": 0, "empty": 0, "timeout": 0, "error": 0, "last_status": ""},
        )
        status_key = str(attempt.get("status") or "empty").strip().lower() or "empty"
        if status_key not in {"ok", "empty", "timeout", "error"}:
            status_key = "empty"
        record[status_key] = int(record.get(status_key) or 0) + 1
        record["last_status"] = status_key
    result["structured"] = structured
    result["strict_mode"] = strict_mode
    result["quality"] = quality
    result["query_variants"] = query_variants
    result["provider_attempts"] = provider_attempts
    result["provider_health"] = list(provider_health_map.values())
    result["search_finished"] = True
    result["research_ready"] = research_ready
    result["research_estimated"] = research_estimated
    result["fallback_started"] = fallback_started
    result["wave_summaries"] = wave_summaries
    return result
