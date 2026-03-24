from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.models.orchestration import OrchestrationState, PersonaProfile  # noqa: E402
from app.services.memory_provider import MySQLGraphMemoryProvider  # noqa: E402


def _state() -> OrchestrationState:
    return OrchestrationState(
        simulation_id="sim-memory",
        user_id=7,
        user_context={
            "idea": "Healthy meal subscription on WhatsApp for office workers",
            "category": "consumer apps",
            "city": "Giza",
            "location": "Haram",
            "targetAudience": ["office workers"],
            "language": "en",
        },
    )


def _persona(persona_id: str, name: str) -> PersonaProfile:
    return PersonaProfile(
        persona_id=persona_id,
        name=name,
        source_mode="generate_new_from_search",
        target_audience_cluster="Office Workers",
        location_context="Giza",
        age_band="25-34",
        life_stage="working adult",
        profession_role="operations employee",
        attitude_baseline="practical",
        skepticism_level=0.4,
        conformity_level=0.5,
        stubbornness_level=0.3,
        innovation_openness=0.5,
        financial_sensitivity=0.7,
        speaking_style="direct",
        tags=[],
        source_attribution={"kind": "research_signal"},
        evidence_signals=["price clarity"],
        category_id="consumer",
        template_id="tpl",
        archetype_name="Office Worker",
        summary="price-aware office worker",
        motivations=["convenience"],
        concerns=["price"],
        location="Giza",
        opinion="neutral",
        confidence=0.5,
        influence_weight=1.0,
        traits={},
        biases=[],
        opinion_score=0.0,
    )


class MemoryProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_retrieve_for_persona_generation_reads_cross_run_hits(self) -> None:
        provider = MySQLGraphMemoryProvider(enabled=True, scope_mode="cross_run", max_items_per_agent=5, debug=False)
        state = _state()
        with patch("app.services.memory_provider.db_core.upsert_memory_scope", AsyncMock(return_value={"id": 11})), patch(
            "app.services.memory_provider.db_core.fetch_memory_nodes",
            AsyncMock(
                return_value=[
                    {"label": "high delivery fees", "node_type": "objection"},
                    {"label": "workers want predictable meals", "node_type": "need_signal"},
                    {"label": "test smaller package first", "node_type": "execution_learning"},
                ]
            ),
        ), patch("app.services.memory_provider.db_core.fetch_memory_episodes", AsyncMock(return_value=[])), patch(
            "app.services.memory_provider.db_core.insert_memory_retrieval_log",
            AsyncMock(),
        ):
            context = await provider.retrieve_for_persona_generation(state)
        self.assertIn("high delivery fees", context["recurring_objections"])
        self.assertIn("workers want predictable meals", context["confirmed_signals"])
        self.assertEqual(state.schema.get("memory_provider"), "mysql_graph")
        self.assertTrue(state.schema.get("memory_scope_key"))

    async def test_retrieve_for_turn_uses_relationship_and_signal_history(self) -> None:
        provider = MySQLGraphMemoryProvider(enabled=True, scope_mode="cross_run", max_items_per_agent=5, debug=False)
        state = _state()
        speaker = _persona("p1", "Agent1")
        target = _persona("p2", "Agent2")
        with patch("app.services.memory_provider.db_core.upsert_memory_scope", AsyncMock(return_value={"id": 12})), patch(
            "app.services.memory_provider.db_core.fetch_memory_nodes",
            AsyncMock(
                return_value=[
                    {"label": "price sensitivity is high", "node_type": "price_signal", "weight": 0.9},
                    {"label": "workers like subscriptions if flexible", "node_type": "need_signal", "weight": 0.8},
                ]
            ),
        ), patch(
            "app.services.memory_provider.db_core.fetch_memory_edges",
            AsyncMock(
                return_value=[
                    {
                        "source_node_key": "persona_signature:dummy",
                        "target_node_key": "persona_signature:dummy2",
                        "relation_type": "persona_influences_persona",
                        "support_count": 3,
                        "target_label": "",
                        "weight": 0.9,
                    }
                ]
            ),
        ), patch("app.services.memory_provider.db_core.insert_memory_retrieval_log", AsyncMock()):
            context = await provider.retrieve_for_turn(state=state, speaker=speaker, target=target, argument={"claim": "price sensitivity is high"})
        self.assertTrue(context["recurring_objections"])
        self.assertTrue(context["confirmed_signals"])

    async def test_provider_failure_degrades_state_but_does_not_raise(self) -> None:
        provider = MySQLGraphMemoryProvider(enabled=True, scope_mode="cross_run", max_items_per_agent=5, debug=False)
        state = _state()
        with patch("app.services.memory_provider.db_core.upsert_memory_scope", AsyncMock(side_effect=RuntimeError("db down"))):
            await provider.ingest_execution_followup(state=state, followup={"learning": "test smaller bundle", "classification": "mixed_signal"})
        self.assertTrue(str(state.schema.get("memory_status") or "").startswith("degraded:"))


if __name__ == "__main__":
    unittest.main()
