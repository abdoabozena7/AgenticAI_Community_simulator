from __future__ import annotations

from typing import Any, Dict, Optional

from ..models.orchestration import DialogueTurn, OrchestrationEvent, OrchestrationState
from .simulation_repository import SimulationRepository


class SimulationEventLogger:
    def __init__(self, repository: SimulationRepository) -> None:
        self._repository = repository

    async def log_orchestration_event(
        self,
        *,
        state: OrchestrationState,
        event: OrchestrationEvent,
        actor: Optional[str] = None,
    ) -> None:
        try:
            await self._repository.persist_simulation_event(
                state.simulation_id,
                event_seq=event.seq,
                phase=event.phase,
                event_type=event.event_type,
                payload=event.payload,
                step_uid=str(event.payload.get("step_uid") or "").strip() or None,
                actor=actor or str(event.payload.get("agent") or "").strip() or None,
            )
            state.schema["event_log_status"] = "active"
            state.schema["event_log_count"] = int(event.seq)
            state.schema["event_log_last_type"] = event.event_type
        except Exception as exc:  # noqa: BLE001
            state.schema["event_log_status"] = "degraded"
            state.schema["event_log_error"] = str(exc)

    async def log_dialogue_turn(
        self,
        *,
        state: OrchestrationState,
        event: OrchestrationEvent,
        turn: DialogueTurn,
    ) -> None:
        payload: Dict[str, Any] = {
            **event.payload,
            "message": turn.message,
            "stance_before": turn.stance_before,
            "stance_after": turn.stance_after,
            "confidence": turn.confidence,
            "influence_delta": turn.influence_delta,
            "evidence_urls": list(turn.evidence_urls),
        }
        try:
            await self._repository.persist_simulation_event(
                state.simulation_id,
                event_seq=event.seq,
                phase=event.phase,
                event_type="dialogue_turn",
                payload=payload,
                step_uid=turn.step_uid,
                actor=turn.agent_id,
            )
            state.schema["event_log_status"] = "active"
            state.schema["event_log_count"] = int(event.seq)
            state.schema["event_log_last_type"] = "dialogue_turn"
        except Exception as exc:  # noqa: BLE001
            state.schema["event_log_status"] = "degraded"
            state.schema["event_log_error"] = str(exc)
