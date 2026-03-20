from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.api.llm import ExtractRequest, extract_schema  # noqa: E402


class LlmExtractTests(unittest.IsolatedAsyncioTestCase):
    async def test_extract_schema_returns_place_name_for_place_only_location(self) -> None:
        payload = ExtractRequest(
            message="عاوز افتح كافيه في الهرم",
            schema={},
        )
        llm_payload = {
            "idea": "كافيه صغير",
            "country": None,
            "city": None,
            "place_name": "الهرم",
            "location_scope": "place_only",
            "category": "consumer apps",
            "target_audience": ["Consumers"],
            "goals": ["Market Validation"],
            "risk_appetite": 0.5,
            "idea_maturity": "concept",
            "missing": [],
            "question": None,
        }
        with patch("app.api.llm.generate_ollama", AsyncMock(return_value=json.dumps(llm_payload, ensure_ascii=False))):
            response = await extract_schema(payload, authorization=None)

        self.assertEqual(response.place_name, "الهرم")
        self.assertEqual(response.location_scope, "place_only")
        self.assertIsNone(response.city)
        self.assertIsNone(response.country)
        self.assertEqual(response.missing, [])
        self.assertIsNone(response.question)

    async def test_extract_schema_heuristics_preserve_place_name_when_llm_fails(self) -> None:
        payload = ExtractRequest(
            message="افتتاح مطعم في مدينة نصر",
            schema={
                "category": "consumer apps",
                "target_audience": ["Consumers"],
                "goals": ["Market Validation"],
                "idea_maturity": "concept",
            },
        )
        with patch("app.api.llm.generate_ollama", AsyncMock(side_effect=RuntimeError("llm offline"))):
            response = await extract_schema(payload, authorization=None)

        self.assertEqual(response.place_name, "مدينة نصر")
        self.assertEqual(response.location_scope, "place_only")
        self.assertNotIn("city", response.missing)
        self.assertNotIn("country", response.missing)


if __name__ == "__main__":
    unittest.main()
