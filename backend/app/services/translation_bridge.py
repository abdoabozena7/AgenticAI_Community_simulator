from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import List

try:  # pragma: no cover - optional dependency
    from deep_translator import GoogleTranslator  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    GoogleTranslator = None


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", str(text or "")))


def _normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


AR_TO_EN_TERMS = {
    "كافيه": "cafe",
    "قهوة": "coffee",
    "مطعم": "restaurant",
    "وجبات": "meals",
    "صحي": "healthy",
    "صحية": "healthy",
    "اشتراك": "subscription",
    "أسبوعي": "weekly",
    "اسبوعي": "weekly",
    "موظفين": "employees",
    "شركات": "companies",
    "القاهرة": "cairo",
    "القاهره": "cairo",
    "الجيزة": "giza",
    "الجيزه": "giza",
    "الهرم": "haram",
    "فيصل": "faisal",
    "القاهرة الجديدة": "new cairo",
    "المذاكرة": "study",
    "الدراسة": "study",
    "الشغل": "work",
    "العمل": "work",
    "واتساب": "whatsapp",
    "توصيل": "delivery",
    "سعر": "price",
    "السعر": "price",
    "منافسين": "competitors",
    "منافسة": "competition",
}


@dataclass
class SearchQueryVariant:
    text: str
    language: str
    source: str

    def to_dict(self) -> dict:
        return {"text": self.text, "language": self.language, "source": self.source}


class BaseSearchTranslator:
    def build_variants(self, query: str, language: str) -> List[SearchQueryVariant]:
        raise NotImplementedError


class NoopSearchTranslator(BaseSearchTranslator):
    def build_variants(self, query: str, language: str) -> List[SearchQueryVariant]:
        return [SearchQueryVariant(text=_normalize_spaces(query), language=language or "en", source="original")]


class HeuristicSearchTranslator(BaseSearchTranslator):
    def build_variants(self, query: str, language: str) -> List[SearchQueryVariant]:
        normalized = _normalize_spaces(query)
        variants: List[SearchQueryVariant] = []
        if normalized:
            variants.append(SearchQueryVariant(text=normalized, language=language or "en", source="original"))
        if not _contains_arabic(normalized):
            return variants

        translated = self._translate_to_english(normalized)
        if translated and translated.lower() != normalized.lower():
            variants.append(SearchQueryVariant(text=translated, language="en", source="translated"))
            expanded = f"{translated} market demand competition pricing regulation"
            variants.append(SearchQueryVariant(text=_normalize_spaces(expanded), language="en", source="translated_expanded"))
        return self._dedupe(variants)

    def _translate_to_english(self, query: str) -> str:
        if GoogleTranslator is not None:  # pragma: no cover - optional dependency
            try:
                translated = GoogleTranslator(source="ar", target="en").translate(query)
                translated = _normalize_spaces(translated)
                if translated:
                    return translated
            except Exception:
                pass
        pieces: List[str] = []
        for token in _normalize_spaces(query).split():
            mapped = AR_TO_EN_TERMS.get(token)
            pieces.append(mapped or token)
        return _normalize_spaces(" ".join(pieces))

    def _dedupe(self, items: List[SearchQueryVariant]) -> List[SearchQueryVariant]:
        deduped: List[SearchQueryVariant] = []
        seen = set()
        for item in items:
            key = (item.text.lower(), item.language.lower())
            if not item.text or key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped


def build_search_translator() -> BaseSearchTranslator:
    if not _env_flag("SEARCH_TRANSLATION_ENABLED", True):
        return NoopSearchTranslator()
    provider = str(os.getenv("SEARCH_TRANSLATION_PROVIDER", "heuristic")).strip().lower() or "heuristic"
    if provider in {"none", "off", "disabled"}:
        return NoopSearchTranslator()
    return HeuristicSearchTranslator()
