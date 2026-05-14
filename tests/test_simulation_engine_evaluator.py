from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.dataset_loader import load_dataset  # noqa: E402
import app.simulation.engine as engine_mod  # noqa: E402


DATASET = load_dataset(str(ROOT / "backend" / "app" / "data"))

STRONG_LADDER = [
    {
        "id": "d1",
        "text": "Parents actively compare delivery fees before ordering lunch bundles.",
        "evidence_type": "direct_evidence",
        "source": {"kind": "direct_search", "field": "signals", "domain": "example.com"},
        "confidence": 0.88,
        "why_it_matters": "Shows concrete buying friction.",
    },
    {
        "id": "d2",
        "text": "Busy families want predictable weekly pricing and fewer surprise charges.",
        "evidence_type": "direct_evidence",
        "source": {"kind": "direct_search", "field": "signals", "domain": "example.org"},
        "confidence": 0.84,
        "why_it_matters": "Shows willingness-to-pay expectations.",
    },
    {
        "id": "s1",
        "text": "Delivery fees hurt conversion for price-sensitive families.",
        "evidence_type": "derived_signal",
        "source": {"kind": "research_structured", "field": "complaints"},
        "confidence": 0.75,
        "why_it_matters": "Explains adoption friction.",
    },
]

CONTRADICTORY_LADDER = [
    {
        "id": "c1",
        "text": "Demand is strong and parents trust the service.",
        "evidence_type": "direct_evidence",
        "source": {"kind": "direct_search", "field": "signals", "domain": "positive.com"},
        "confidence": 0.82,
        "why_it_matters": "Positive demand signal.",
    },
    {
        "id": "c2",
        "text": "Demand is weak and parents object because delivery fees are expensive.",
        "evidence_type": "derived_signal",
        "source": {"kind": "research_structured", "field": "signals", "domain": "negative.com"},
        "confidence": 0.78,
        "why_it_matters": "Negative demand signal.",
    },
    {
        "id": "c3",
        "text": "Price sensitivity remains high across similar households.",
        "evidence_type": "derived_signal",
        "source": {"kind": "proxy_structured", "field": "complaints", "domain": "proxy.com"},
        "confidence": 0.70,
        "why_it_matters": "Adds pricing pressure.",
    },
]


class SimulationEngineEvaluatorTests(unittest.IsolatedAsyncioTestCase):
    async def _run_scenario(self, *, raw_response: dict[str, object], ladder: list[dict[str, object]]) -> dict[str, object]:
        events: list[tuple[str, dict[str, object]]] = []

        async def emitter(event_type: str, payload: dict[str, object]) -> None:
            events.append((event_type, payload))

        async def fake_generate_ollama(*args, **kwargs) -> str:
            return json.dumps(raw_response)

        user_context = {
            "idea": "Weekly lunchbox bundle subscriptions for busy parents",
            "category": "food",
            "targetAudience": ["parents"],
            "country": "Egypt",
            "city": "Giza",
            "language": "en",
            "agentCount": 5,
            "speed": 20,
            "reasoning_scope": "full",
            "reasoning_detail": "short",
            "research_summary": "Parents compare prices, dislike delivery fees, and switch quickly when charges feel unclear.",
            "research_structured": {
                "signals": ["parents compare prices before ordering", "delivery fees hurt conversion"],
                "complaints": ["delivery fees", "unclear pricing"],
                "behaviors": ["compare prices before ordering"],
                "competition_reactions": ["switch to cheaper alternatives"],
                "competition_level": "high",
                "price_sensitivity": "high",
                "confidence_score": 0.25,
                "evidence_ladder": ladder,
            },
            "search_quality": {"usable_sources": 3, "domains": 2, "confidence_score": 0.25},
        }

        engine = engine_mod.SimulationEngine(DATASET)
        with (
            patch.dict(
                os.environ,
                {
                    "SIMULATION_STEP_DELAY": "0",
                    "REASONING_ENGINE_V2": "0",
                    "LLM_VALIDATOR_SAMPLE_RATE": "0",
                    "SIM_MAX_DIALOGUE_CONTEXT": "10",
                },
                clear=False,
            ),
            patch("app.simulation.engine.generate_ollama", new=fake_generate_ollama),
        ):
            metrics = await engine.run_simulation(user_context=user_context, emitter=emitter)

        reasoning_steps = [payload for event_type, payload in events if event_type == "reasoning_step"]
        self.assertTrue(reasoning_steps, "expected reasoning_step events")
        first_step = reasoning_steps[0]
        return {
            "metrics": metrics,
            "steps": reasoning_steps,
            "first_step": first_step,
        }

    async def test_engine_emits_expected_quality_signals_for_generic_contradictory_and_grounded_reasoning(self) -> None:
        generic = await self._run_scenario(
            raw_response={
                "stance": "accept",
                "confidence": 0.9,
                "message": "This idea depends on execution and market fit, so it could work if done carefully.",
            },
            ladder=STRONG_LADDER,
        )
        contradictory = await self._run_scenario(
            raw_response={
                "stance": "accept",
                "confidence": 0.9,
                "message": "This is clearly affordable and definitely low risk because every family will pay $99 a week.",
            },
            ladder=CONTRADICTORY_LADDER,
        )
        grounded = await self._run_scenario(
            raw_response={
                "stance": "reject",
                "confidence": 0.9,
                "message": (
                    "For weekly lunchbox bundles in Giza, parents actively compare delivery fees before ordering, "
                    "and busy families want predictable weekly pricing with fewer surprise charges."
                ),
            },
            ladder=STRONG_LADDER,
        )

        generic_step = generic["first_step"]
        contradictory_step = contradictory["first_step"]
        grounded_step = grounded["first_step"]

        for step in (generic_step, contradictory_step, grounded_step):
            self.assertIn("low_quality_reasoning", step)
            self.assertIn("reasoning_quality_score", step)
            self.assertIn("reasoning_quality_flags", step)
            self.assertIsInstance(step["reasoning_quality_flags"], list)
            self.assertIsInstance(step["reasoning_quality_score"], float)
            self.assertIn(step["stance_before"], {"accept", "reject", "neutral"})
            self.assertIn(step["stance_after"], {"accept", "reject", "neutral"})

        self.assertTrue(generic_step["low_quality_reasoning"])
        self.assertTrue(contradictory_step["low_quality_reasoning"])
        self.assertFalse(grounded_step["low_quality_reasoning"])

        self.assertIn("generic_reasoning", generic_step["reasoning_quality_flags"])
        self.assertIn("evidence_contradiction", contradictory_step["reasoning_quality_flags"])
        self.assertFalse(
            set(grounded_step["reasoning_quality_flags"]).intersection(
                {"generic_reasoning", "evidence_contradiction", "confidence_unjustified"}
            )
        )

        self.assertLess(generic_step["stance_confidence"], grounded_step["stance_confidence"])
        self.assertLess(contradictory_step["stance_confidence"], grounded_step["stance_confidence"])
        self.assertLess(generic_step["reasoning_quality_score"], grounded_step["reasoning_quality_score"])
        self.assertLess(contradictory_step["reasoning_quality_score"], grounded_step["reasoning_quality_score"])

        self.assertEqual(generic_step["stance_before"], "neutral")
        self.assertEqual(contradictory_step["stance_before"], "neutral")
        self.assertEqual(grounded_step["stance_before"], "neutral")
        self.assertNotEqual(generic_step["stance_after"], generic_step["stance_before"])
        self.assertNotEqual(contradictory_step["stance_after"], contradictory_step["stance_before"])
        self.assertNotEqual(grounded_step["stance_after"], grounded_step["stance_before"])

        for result in (generic, contradictory, grounded):
            self.assertIsInstance(result["metrics"], dict)
            self.assertIn("total_iterations", result["metrics"])
            self.assertGreater(len(result["steps"]), 0)


if __name__ == "__main__":
    unittest.main()
