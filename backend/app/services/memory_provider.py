from __future__ import annotations

from typing import Any, Dict, Iterable, List, Sequence

from ..models.orchestration import DialogueTurn, OrchestrationState, PersonaProfile


def _clip_list(values: Iterable[str], limit: int) -> List[str]:
    out: List[str] = []
    for value in values:
        text = str(value or "").strip()
        if not text or text in out:
            continue
        out.append(text)
        if len(out) >= limit:
            break
    return out


class MemoryProvider:
    provider_name = "disabled"

    def __init__(self, *, max_items_per_agent: int = 5) -> None:
        self.max_items_per_agent = max(1, min(12, int(max_items_per_agent or 5)))

    def _empty_context(self) -> Dict[str, Any]:
        return {
            "recurring_objections": [],
            "stable_behaviors": [],
            "confirmed_signals": [],
            "execution_learnings": [],
            "relationship_context": [],
            "proven_adjustments": [],
            "hit_labels": [],
            "hit_count": 0,
            "scope_key": None,
        }

    def _remember_state(self, state: OrchestrationState) -> None:
        state.schema["memory_status"] = "disabled"
        state.schema["memory_provider"] = self.provider_name
        state.schema["memory_scope_key"] = None
        state.schema["memory_hits_count"] = 0
        state.schema["memory_last_update_seq"] = int(state.schema.get("memory_last_update_seq") or 0)
        state.schema["memory_context_version"] = int(state.schema.get("memory_context_version") or 0)

    async def initialize_state(self, state: OrchestrationState) -> None:
        self._remember_state(state)

    async def ingest_research(self, state: OrchestrationState) -> None:
        self._remember_state(state)

    async def retrieve_for_persona_generation(self, state: OrchestrationState) -> Dict[str, Any]:
        self._remember_state(state)
        return self._empty_context()

    async def ingest_personas(self, state: OrchestrationState) -> None:
        self._remember_state(state)

    async def retrieve_for_turn(
        self,
        *,
        state: OrchestrationState,
        speaker: PersonaProfile,
        target: PersonaProfile,
        argument: Dict[str, Any],
    ) -> Dict[str, Any]:
        del speaker, target, argument
        self._remember_state(state)
        return self._empty_context()

    async def ingest_turn(
        self,
        *,
        state: OrchestrationState,
        turn: DialogueTurn,
        speaker: PersonaProfile,
        target: PersonaProfile,
        argument: Dict[str, Any],
        payload: Dict[str, Any],
        event_seq: int | None = None,
    ) -> None:
        del turn, speaker, target, argument, payload, event_seq
        self._remember_state(state)

    async def ingest_clarification_answers(self, *, state: OrchestrationState, answers: Sequence[Dict[str, Any]]) -> None:
        del answers
        self._remember_state(state)

    async def ingest_execution_followup(self, *, state: OrchestrationState, followup: Dict[str, Any]) -> None:
        del followup
        self._remember_state(state)

    async def ingest_orchestrator_intervention(self, *, state: OrchestrationState, insight: Dict[str, Any]) -> None:
        del insight
        self._remember_state(state)

    async def retrieve_for_summary(self, state: OrchestrationState) -> Dict[str, Any]:
        self._remember_state(state)
        return self._empty_context()


def build_memory_provider() -> MemoryProvider:
    return MemoryProvider()
