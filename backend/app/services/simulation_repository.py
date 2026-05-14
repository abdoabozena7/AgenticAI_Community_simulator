from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from ..core import db as db_core
from ..models.orchestration import DialogueTurn, OrchestrationState, hydrate_state


class SimulationRepository:
    async def create_run(self, state: OrchestrationState) -> None:
        await db_core.insert_simulation(
            simulation_id=state.simulation_id,
            user_context=state.user_context,
            status=state.status,
            user_id=state.user_id,
        )
        await self.save_state(state)

    async def save_state(self, state: OrchestrationState) -> None:
        await db_core.update_simulation_context(state.simulation_id, state.user_context)
        await db_core.upsert_simulation_checkpoint(
            simulation_id=state.simulation_id,
            checkpoint=state.to_checkpoint(),
            status=state.status,
            last_error=state.error,
            status_reason=state.status_reason,
            current_phase_key=state.current_phase.value,
            phase_progress_pct=state.phase_progress_pct(),
            event_seq=state.event_seq,
        )

    async def finalize_run(self, state: OrchestrationState) -> None:
        await db_core.update_simulation(
            simulation_id=state.simulation_id,
            status=state.status,
            summary=state.summary,
            ended_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            final_metrics=state.metrics,
        )
        await self.save_state(state)

    async def load_state(self, simulation_id: str) -> Optional[OrchestrationState]:
        checkpoint = await db_core.fetch_simulation_checkpoint(simulation_id)
        if checkpoint and isinstance(checkpoint.get("checkpoint"), dict):
            payload = dict(checkpoint.get("checkpoint") or {})
            payload.setdefault("simulation_id", simulation_id)
            payload.setdefault("status", checkpoint.get("status"))
            payload.setdefault("status_reason", checkpoint.get("status_reason"))
            payload.setdefault("current_phase", checkpoint.get("current_phase_key"))
            payload.setdefault("event_seq", checkpoint.get("event_seq"))
            return hydrate_state(payload)

        snapshot = await db_core.fetch_simulation_snapshot(simulation_id)
        if not snapshot:
            return None
        return hydrate_state(
            {
                "simulation_id": simulation_id,
                "user_context": snapshot.get("user_context") or {},
                "status": snapshot.get("status") or "running",
                "status_reason": snapshot.get("status_reason") or "running",
                "current_phase": snapshot.get("current_phase_key") or "idea_intake",
                "metrics": snapshot.get("metrics") or {},
                "summary": snapshot.get("summary") or "",
                "summary_ready": bool(snapshot.get("summary_ready")),
                "event_seq": int(snapshot.get("event_seq") or 0),
            }
        )

    async def persist_personas(self, simulation_id: str, agents: List[Dict[str, Any]]) -> None:
        await db_core.insert_agents(simulation_id, agents)

    async def simulation_exists(self, simulation_id: str) -> bool:
        return await db_core.simulation_exists(simulation_id)

    async def update_persona_state(
        self,
        *,
        simulation_id: str,
        agent_id: str,
        opinion: str,
        confidence: float,
        phase: str,
        influence_weight: Optional[float] = None,
    ) -> None:
        await db_core.update_agent_state(
            simulation_id=simulation_id,
            agent_id=agent_id,
            opinion=opinion,
            confidence=confidence,
            phase=phase,
            influence_weight=influence_weight,
        )

    async def sync_persona_states(
        self,
        *,
        simulation_id: str,
        personas: List[Any],
        phase: str,
    ) -> None:
        await db_core.bulk_update_agent_states(
            simulation_id=simulation_id,
            items=[
                {
                    "agent_id": getattr(persona, "persona_id", None),
                    "opinion": getattr(persona, "opinion", "neutral"),
                    "confidence": float(getattr(persona, "confidence", 0.5)),
                    "phase": phase,
                    "influence_weight": float(getattr(persona, "influence_weight", 1.0)),
                }
                for persona in personas
            ],
        )

    async def persist_dialogue_turn(self, simulation_id: str, turn: DialogueTurn, event_seq: int) -> None:
        row = turn.to_reasoning_row()
        row["event_seq"] = event_seq
        await db_core.insert_reasoning_step(simulation_id, row)

    async def persist_research_event(self, simulation_id: str, event_seq: int, payload: Dict[str, Any]) -> None:
        del simulation_id, event_seq, payload

    async def persist_simulation_event(
        self,
        simulation_id: str,
        *,
        event_seq: int,
        phase: str,
        event_type: str,
        payload: Dict[str, Any],
        step_uid: Optional[str] = None,
        actor: Optional[str] = None,
    ) -> None:
        del simulation_id, event_seq, phase, event_type, payload, step_uid, actor

    async def persist_metrics(self, simulation_id: str, metrics: Dict[str, Any]) -> None:
        await db_core.insert_metrics(simulation_id, metrics)

    async def fetch_transcript(self, simulation_id: str) -> List[Dict[str, Any]]:
        return await db_core.fetch_transcript(simulation_id)

    async def fetch_agents(
        self,
        *,
        simulation_id: str,
        stance: Optional[str],
        phase: Optional[str],
        page: int,
        page_size: int,
    ) -> Dict[str, Any]:
        return await db_core.fetch_simulation_agents_filtered(
            simulation_id=simulation_id,
            stance=stance,
            phase=phase,
            page=page,
            page_size=page_size,
        )

    async def fetch_persona_library_record(
        self,
        *,
        user_id: Optional[int],
        place_key: str,
        audience_filters: Optional[List[str]] = None,
        source_mode: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        del user_id, place_key, audience_filters, source_mode
        return None

    async def upsert_persona_library_record(
        self,
        *,
        user_id: Optional[int],
        place_key: str,
        place_label: str,
        scope: str,
        source_policy: str,
        payload: Dict[str, Any],
        audience_filters: Optional[List[str]] = None,
        source_summary: Optional[str] = None,
        evidence_summary: Optional[Dict[str, Any]] = None,
        generation_config: Optional[Dict[str, Any]] = None,
        quality_score: Optional[float] = None,
        confidence_score: Optional[float] = None,
        quality_meta: Optional[Dict[str, Any]] = None,
        validation_meta: Optional[Dict[str, Any]] = None,
        reusable_dataset_ref: Optional[str] = None,
        context_type: Optional[str] = None,
        shared_asset: bool = True,
    ) -> None:
        del user_id, place_key, place_label, scope, source_policy, payload, audience_filters, source_summary, evidence_summary, generation_config, quality_score, confidence_score, quality_meta, validation_meta, reusable_dataset_ref, context_type, shared_asset

    async def list_persona_library_records(
        self,
        *,
        user_id: Optional[int],
        place_query: Optional[str] = None,
        audience: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        min_count: Optional[int] = None,
        max_count: Optional[int] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        del user_id, place_query, audience, date_from, date_to, min_count, max_count, limit
        return []

    async def fetch_persona_library_record_by_set_key(
        self,
        *,
        user_id: Optional[int],
        set_key: str,
    ) -> Optional[Dict[str, Any]]:
        del user_id, set_key
        return None
