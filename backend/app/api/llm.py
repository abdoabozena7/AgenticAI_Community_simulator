"""
LLM endpoints backed by a local Ollama server.

Includes free‑form generation and schema extraction. These endpoints
provide simple wrappers around the local LLM for use by the frontend.
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Dict, Any
import asyncio
import os

from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field

from ..core.ollama_client import generate_ollama
from ..core import auth as auth_core


router = APIRouter(prefix="/llm")
logger = logging.getLogger("llm_api")


def _auth_required() -> bool:
    return os.getenv("AUTH_REQUIRED", "false").lower() in {"1", "true", "yes"}


async def _require_user(authorization: Optional[str], perm: Optional[str] = None) -> None:
    if not _auth_required():
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1]
    user = await auth_core.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if perm and not auth_core.has_permission(user, perm):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    system: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


@router.post("/generate")
async def generate_text(payload: GenerateRequest, authorization: str = Header(None)) -> dict:
    """Generate arbitrary text from the local LLM.

    If the LLM service is unavailable or an error occurs, a 502
    response is returned to the caller.
    """
    await _require_user(authorization, perm="llm:use")
    try:
        text = await generate_ollama(
            prompt=payload.prompt,
            system=payload.system,
            temperature=payload.temperature,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"text": text}


# --- Schema extraction (chat‑first flow) ---

class ExtractRequest(BaseModel):
    message: str = Field(..., min_length=1)
    schema: Dict[str, Any] = Field(default_factory=dict)


class ExtractResponse(BaseModel):
    idea: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    place_name: Optional[str] = None
    location_scope: Optional[str] = None
    category: Optional[str] = None
    target_audience: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    risk_appetite: Optional[float] = None
    idea_maturity: Optional[str] = None
    missing: list[str] = Field(default_factory=list)
    question: Optional[str] = None


PROMPT_TEMPLATE = """You extract structured fields from chat messages.

Required fields: idea, country, city, place_name, location_scope, category, target_audience, goals.

Allowed options (choose the closest match):
- category: technology, healthcare, finance, education, e-commerce, entertainment, social, b2b saas, consumer apps, hardware
- target_audience: Gen Z (18-24), Millennials (25-40), Gen X (41-56), Boomers (57-75), Developers, Enterprises, SMBs, Consumers, Students, Professionals
- goals: Market Validation, Funding Readiness, User Acquisition, Product-Market Fit, Competitive Analysis, Growth Strategy
- idea_maturity: concept, prototype, mvp, launched
- location_scope: city_country, place_only, none

Hard requirements:
- If all required fields are present/confident, missing MUST be [] and question MUST be null.
- Do NOT ask for a field that you can reliably extract from the message.
- If category/target_audience/goals are not explicit, infer the best-fit options from the idea and choose from the list above.
- If a required field is missing or unclear, include its name in "missing" and provide a brief, human, context-rich follow-up in "question" (Arabic allowed).
- Use the current schema to keep known values unless the user clearly changes them.
- If a specific place, neighborhood, district, or venue is mentioned, store it in "place_name" and use location_scope="place_only" when city/country cannot be inferred confidently.
- If city/country are both known, use location_scope="city_country".
- If no location signal exists, use location_scope="none".
- If multiple fields are missing, ask ONLY the single most critical question (priority: location, then idea).
- If the message includes a known city, infer the country (e.g., Cairo/New Cairo -> Egypt).
- Prefer proper names (e.g., "Egypt", "Cairo", "Giza"). Handle "City, Country" patterns.
- Return JSON only, no prose.

Examples:
Input: "I want to launch an AI legal assistant in Cairo, Egypt"
Output:
{{"idea":"AI legal assistant","country":"Egypt","city":"Cairo","category":"technology","target_audience":["Consumers"],"goals":["Market Validation"],"risk_appetite":0.5,"idea_maturity":"concept","missing":[],"question":null}}

Input: "I want to launch an AI app in Egypt"
Output:
{{"idea":"AI app","country":"Egypt","city":null,"category":"technology","target_audience":["Consumers"],"goals":["Market Validation"],"risk_appetite":0.5,"idea_maturity":"concept","missing":["city"],"question":"Which city in Egypt should we focus on? Location changes market culture and behavior."}}

Input: "أريد إطلاق مبادرة في القاهرة الجديدة"
Output:
{{"idea":"مبادرة","country":"Egypt","city":"Cairo","category":"technology","target_audience":["Consumers"],"goals":["Market Validation"],"risk_appetite":0.5,"idea_maturity":"concept","missing":[],"question":null}}

Current schema (may be partial):
{schema_json}

User message:
{message}

Return JSON with keys: idea, country, city, place_name, location_scope, category, target_audience, goals, risk_appetite, idea_maturity, missing (array), question (string or null)."""


COUNTRY_ALIASES = {
    "egypt": "Egypt",
    "مصر": "Egypt",
    "ksa": "Saudi Arabia",
    "saudi": "Saudi Arabia",
    "السعودية": "Saudi Arabia",
    "uae": "United Arab Emirates",
    "emirates": "United Arab Emirates",
    "الإمارات": "United Arab Emirates",
}


CITY_ALIASES = {
    "cairo": "Cairo",
    "القاهرة": "Cairo",
    "القاهرة الجديدة": "Cairo",
    "giza": "Giza",
    "الجيزة": "Giza",
    "alexandria": "Alexandria",
    "الإسكندرية": "Alexandria",
    "الاسكندرية": "Alexandria",
}


PLACE_ALIASES = {
    "الهرم": "الهرم",
    "giza pyramid": "الهرم",
    "the pyramids": "الهرم",
    "المهندسين": "المهندسين",
    "مدينة نصر": "مدينة نصر",
    "nasr city": "مدينة نصر",
    "new cairo": "New Cairo",
    "التجمع الخامس": "التجمع الخامس",
    "المعادي": "المعادي",
    "maadi": "المعادي",
    "الدقي": "الدقي",
}


def _norm_text(value: Optional[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None
    v = value.strip()
    return v or None


def _normalize_country(value: Optional[str]) -> Optional[str]:
    v = _norm_text(value)
    if not v:
        return None
    key = v.lower()
    return COUNTRY_ALIASES.get(key, v.title())


def _normalize_city(value: Optional[str]) -> Optional[str]:
    v = _norm_text(value)
    if not v:
        return None
    key = v.lower()
    return CITY_ALIASES.get(key, v.title())


def _normalize_place_name(value: Optional[str]) -> Optional[str]:
    v = _norm_text(value)
    if not v:
        return None
    key = v.lower()
    return PLACE_ALIASES.get(key, v)


def _normalize_location_scope(
    value: Optional[str],
    *,
    city: Optional[str] = None,
    country: Optional[str] = None,
    place_name: Optional[str] = None,
) -> str:
    v = _norm_text(value)
    if v:
        key = v.lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "city": "city_country",
            "city_country": "city_country",
            "citycountry": "city_country",
            "place": "place_only",
            "place_only": "place_only",
            "specific_place": "place_only",
            "neighborhood": "place_only",
            "district": "place_only",
            "none": "none",
            "general": "none",
        }
        normalized = aliases.get(key, key)
        if normalized in {"city_country", "place_only", "none"}:
            return normalized
    if place_name and not (city or country):
        return "place_only"
    if city or country:
        return "city_country"
    return "none"


def _safe_json_loads(raw: str) -> Dict[str, Any]:
    from json import loads, JSONDecodeError
    try:
        return loads(raw)
    except JSONDecodeError:
        # Try to extract a JSON object from surrounding text
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return loads(raw[start : end + 1])
        raise


def _contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", text))


def _heuristic_extract(message: str, schema: Dict[str, Any]) -> Dict[str, Any]:
    """Best-effort extraction when the LLM is unavailable."""
    text = (message or "").strip()
    lower = text.lower()
    result: Dict[str, Any] = {}

    # City / country via aliases
    for key, city in CITY_ALIASES.items():
        if key in lower or key in text:
            result["city"] = city
            break
    for key, country in COUNTRY_ALIASES.items():
        if key in lower or key in text:
            result["country"] = country
            break

    for key, place_name in PLACE_ALIASES.items():
        if key in lower or key in text:
            result["place_name"] = place_name
            break

    # Idea: prefer existing schema; otherwise use the message itself (trimmed)
    idea = _norm_text(schema.get("idea")) if isinstance(schema, dict) else None
    if not idea and text:
        idea = text[:200].strip()
    if idea:
        result["idea"] = idea

    # Preserve existing structured values if present
    for key in ("category", "target_audience", "goals", "risk_appetite", "idea_maturity"):
        if isinstance(schema, dict) and schema.get(key) is not None:
            result[key] = schema.get(key)

    result["location_scope"] = _normalize_location_scope(
        result.get("location_scope"),
        city=result.get("city"),
        country=result.get("country"),
        place_name=result.get("place_name"),
    )

    return result


async def _extract_location_only(message: str, schema: Dict[str, Any]) -> Dict[str, Any]:
    from json import dumps
    lang_hint = "Arabic" if _contains_arabic(message) else "English"
    prompt = (
        "Extract ONLY location fields from the user message. "
        "Capture any specific place, neighborhood, district, or venue in place_name. "
        "If a known city is mentioned, infer the country. "
        f"Message language: {lang_hint}. Return JSON only with keys: city, country, place_name, location_scope.\n"
        f"Current schema: {dumps(schema, ensure_ascii=False)}\n"
        f"Message: {message}"
    )
    try:
        raw = await asyncio.wait_for(
            generate_ollama(prompt, temperature=0.1, response_format="json"),
            timeout=6.0,
        )
        return _safe_json_loads(raw)
    except Exception:
        return {}


@router.post("/extract", response_model=ExtractResponse)
async def extract_schema(payload: ExtractRequest, authorization: str = Header(None)) -> ExtractResponse:
    """Extract structured fields from a free‑form chat message using the LLM.

    This endpoint uses a prompt to instruct the LLM to return a JSON
    object containing the desired fields. The result is normalised and
    some heuristic fallbacks are applied for country/city extraction.
    """
    await _require_user(authorization, perm="llm:use")
    from json import dumps

    logger.info("extract_schema: message_len=%s", len(payload.message or ""))
    logger.info("extract_schema: schema_in=%s", payload.schema)

    prompt = PROMPT_TEMPLATE.format(
        schema_json=dumps(payload.schema, ensure_ascii=False),
        message=payload.message,
    )
    try:
        raw = await asyncio.wait_for(
            generate_ollama(prompt, temperature=0.2, response_format="json"),
            timeout=8.0,
        )
        logger.info("extract_schema: raw_llm=%s", raw)
        data = _safe_json_loads(raw)
    except Exception as exc:
        logger.warning("extract_schema: LLM failed (%s). Falling back to heuristics.", exc)
        data = _heuristic_extract(payload.message, payload.schema)

    # Normalise scalars
    idea = _norm_text(data.get("idea"))
    country = _normalize_country(data.get("country"))
    city = _normalize_city(data.get("city"))
    place_name = _normalize_place_name(data.get("place_name") or data.get("placeName") or data.get("place"))
    location_scope = _normalize_location_scope(
        data.get("location_scope") or data.get("locationScope"),
        city=city,
        country=country,
        place_name=place_name,
    )
    category = _norm_text(data.get("category"))
    idea_maturity = _norm_text(data.get("idea_maturity"))
    question = _norm_text(data.get("question"))
    schema = payload.schema or {}
    schema_idea = _norm_text(schema.get("idea"))
    schema_country = _normalize_country(schema.get("country"))
    schema_city = _normalize_city(schema.get("city"))
    schema_place_name = _normalize_place_name(schema.get("place_name") or schema.get("placeName") or schema.get("place"))
    schema_location_scope = _normalize_location_scope(
        schema.get("location_scope") or schema.get("locationScope"),
        city=schema_city,
        country=schema_country,
        place_name=schema_place_name,
    )
    schema_category = _norm_text(schema.get("category"))
    schema_maturity = _norm_text(schema.get("idea_maturity"))
    # Lists
    target_audience = data.get("target_audience") if isinstance(data.get("target_audience"), list) else []
    goals = data.get("goals") if isinstance(data.get("goals"), list) else []
    # Risk appetite
    risk_appetite = data.get("risk_appetite")
    if isinstance(risk_appetite, (int, float)):
        if risk_appetite > 1:
            risk_appetite = risk_appetite / 100.0
    else:
        risk_appetite = None

    if not idea:
        idea = schema_idea
    if not country:
        country = schema_country
    if not city:
        city = schema_city
    if not place_name:
        place_name = schema_place_name
    if location_scope == "none":
        location_scope = schema_location_scope
    if not category:
        category = schema_category
    if not target_audience and isinstance(schema.get("target_audience"), list):
        target_audience = schema.get("target_audience")
    if not goals and isinstance(schema.get("goals"), list):
        goals = schema.get("goals")
    if risk_appetite is None and isinstance(schema.get("risk_appetite"), (int, float)):
        risk_appetite = schema.get("risk_appetite")
    if not idea_maturity:
        idea_maturity = schema_maturity

    # If still missing, run a focused LLM pass for location only
    if (not country or not city or not place_name) and payload.message:
        location_data = await _extract_location_only(payload.message, payload.schema)
        country = country or _normalize_country(location_data.get("country"))
        city = city or _normalize_city(location_data.get("city"))
        place_name = place_name or _normalize_place_name(location_data.get("place_name") or location_data.get("place"))
        location_scope = _normalize_location_scope(
            location_data.get("location_scope") or location_scope,
            city=city,
            country=country,
            place_name=place_name,
        )

    # If city is Egyptian and country missing, infer Egypt
    if city and not country:
        if city in {"Cairo", "Giza", "Alexandria"}:
            country = "Egypt"
    if place_name and location_scope == "none":
        location_scope = "place_only"
    if not place_name and (city or country):
        location_scope = "city_country"
    if not location_scope:
        location_scope = "none"

    missing: list[str] = []
    if not idea:
        missing.append("idea")
    if location_scope != "place_only":
        if not country:
            missing.append("country")
        if not city:
            missing.append("city")
    if not category:
        missing.append("category")
    if not target_audience:
        missing.append("target_audience")
    if not goals:
        missing.append("goals")

    # Enforce a single critical follow-up question
    if location_scope == "none" and "country" in missing and "city" in missing:
        question = "\u0645\u0627 \u0647\u064a \u0627\u0644\u062f\u0648\u0644\u0629 \u0648\u0627\u0644\u0645\u062f\u064a\u0646\u0629 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641\u0629\u061f"
    elif location_scope == "none" and "city" in missing:
        question = "\u0645\u0627 \u0647\u064a \u0627\u0644\u0645\u062f\u064a\u0646\u0629 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641\u0629\u061f"
    elif location_scope == "none" and "country" in missing:
        question = "\u0645\u0627 \u0647\u064a \u0627\u0644\u062f\u0648\u0644\u0629 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641\u0629\u061f"
    elif "idea" in missing:
        question = "\u0645\u0627 \u0647\u064a \u0627\u0644\u0641\u0643\u0631\u0629 \u0627\u0644\u062a\u064a \u062a\u0631\u064a\u062f \u0625\u0637\u0644\u0627\u0642\u0647\u0627\u061f"
    else:
        question = None

    return ExtractResponse(
        idea=idea,
        country=country,
        city=city,
        place_name=place_name,
        location_scope=location_scope,
        category=category,
        target_audience=target_audience,
        goals=goals,
        risk_appetite=risk_appetite,
        idea_maturity=idea_maturity,
        missing=missing,
        question=question,
    )


class IntentRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: Optional[str] = None


class IntentResponse(BaseModel):
    start: bool
    reason: Optional[str] = None


@router.post("/intent", response_model=IntentResponse)
async def detect_intent(payload: IntentRequest, authorization: str = Header(None)) -> IntentResponse:
    await _require_user(authorization, perm="llm:use")
    prompt = (
        "Determine whether the user wants to start the simulation now. "
        "Return JSON only: {\"start\": true/false, \"reason\": \"...\"}. "
        "Use context if provided. Accept Arabic confirmations like: نعم, أيوه, تمام, جاهز, ابدأ.\n"
        f"Context: {payload.context or ''}\n"
        f"Message: {payload.message}"
    )
    try:
        raw = await generate_ollama(prompt=prompt, temperature=0.2, response_format="json")
        data = _safe_json_loads(raw)
        return IntentResponse(start=bool(data.get("start")), reason=data.get("reason"))
    except Exception:
        return IntentResponse(start=False, reason=None)


class MessageModeRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: Optional[str] = None
    language: Optional[str] = None


class MessageModeResponse(BaseModel):
    mode: str
    reason: Optional[str] = None


@router.post("/message_mode", response_model=MessageModeResponse)
async def detect_message_mode(payload: MessageModeRequest, authorization: str = Header(None)) -> MessageModeResponse:
    """Classify whether the message is a discussion or an update to the idea."""
    await _require_user(authorization, perm="llm:use")
    lang_hint = payload.language or ("ar" if _contains_arabic(payload.message) else "en")
    prompt = (
        "Classify the user's message as one of: update, discuss.\n"
        "update = introduces new info that should re-run the simulation or modify the idea.\n"
        "discuss = questions, critiques, negotiations, or conversation about results.\n"
        "Return JSON only: {\"mode\": \"update\"|\"discuss\", \"reason\": \"...\"}.\n"
        f"Language: {lang_hint}\n"
        f"Context: {payload.context or ''}\n"
        f"Message: {payload.message}\n"
    )
    try:
        raw = await generate_ollama(prompt=prompt, temperature=0.2, response_format="json")
        data = _safe_json_loads(raw)
        mode = str(data.get("mode") or "discuss").lower()
        if mode not in {"update", "discuss"}:
            mode = "discuss"
        return MessageModeResponse(mode=mode, reason=data.get("reason"))
    except Exception:
        return MessageModeResponse(mode="discuss", reason=None)

