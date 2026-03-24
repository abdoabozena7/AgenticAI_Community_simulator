from __future__ import annotations

import hashlib
import os
import re
from collections import Counter
from typing import Any, Dict, Iterable, List, Optional, Sequence

from ..core import db as db_core
from ..models.orchestration import DialogueTurn, OrchestrationState, PersonaProfile, context_location_label


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    return default if raw is None else str(raw).strip().lower() in {"1", "true", "yes", "on"}


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


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _slug(value: Any, *, max_length: int = 96) -> str:
    text = re.sub(r"[^\w\u0600-\u06FF-]+", "-", _normalize_text(value), flags=re.UNICODE)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text[:max_length] or "na"


def _hash_key(*parts: Any, size: int = 20) -> str:
    joined = "|".join(str(part or "").strip() for part in parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()[:size]


def _bucket_level(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        lowered = str(value or "").strip().lower()
        return lowered if lowered in {"low", "medium", "high"} else "medium"
    return "low" if number < 0.34 else "medium" if number < 0.67 else "high"


class MemoryProvider:
    provider_name = "noop"

    def __init__(self, *, enabled: bool, scope_mode: str, max_items_per_agent: int, debug: bool) -> None:
        self.enabled = bool(enabled)
        self.scope_mode = str(scope_mode or "cross_run").strip() or "cross_run"
        self.max_items_per_agent = max(1, min(12, int(max_items_per_agent or 5)))
        self.debug = bool(debug)

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

    def _remember_state(
        self,
        state: OrchestrationState,
        *,
        status: str,
        provider: Optional[str] = None,
        scope_key: Optional[str] = None,
        hits: Optional[int] = None,
        last_update_seq: Optional[int] = None,
    ) -> None:
        state.schema["memory_status"] = str(status or "ready")
        state.schema["memory_provider"] = str(provider or self.provider_name)
        state.schema["memory_scope_key"] = scope_key or state.schema.get("memory_scope_key")
        state.schema["memory_hits_count"] = int(hits if hits is not None else state.schema.get("memory_hits_count") or 0)
        state.schema["memory_last_update_seq"] = int(last_update_seq if last_update_seq is not None else state.schema.get("memory_last_update_seq") or 0)
        state.schema["memory_context_version"] = int(state.schema.get("memory_context_version") or 0)

    async def initialize_state(self, state: OrchestrationState) -> None:
        self._remember_state(state, status="disabled" if not self.enabled else "ready", provider=self.provider_name, hits=0)

    async def ingest_research(self, state: OrchestrationState) -> None:
        await self.initialize_state(state)

    async def retrieve_for_persona_generation(self, state: OrchestrationState) -> Dict[str, Any]:
        await self.initialize_state(state)
        return self._empty_context()

    async def ingest_personas(self, state: OrchestrationState) -> None:
        await self.initialize_state(state)

    async def retrieve_for_turn(self, *, state: OrchestrationState, speaker: PersonaProfile, target: PersonaProfile, argument: Dict[str, Any]) -> Dict[str, Any]:
        await self.initialize_state(state)
        return self._empty_context()

    async def ingest_turn(self, *, state: OrchestrationState, turn: DialogueTurn, speaker: PersonaProfile, target: PersonaProfile, argument: Dict[str, Any], payload: Dict[str, Any], event_seq: Optional[int] = None) -> None:
        await self.initialize_state(state)

    async def ingest_clarification_answers(self, *, state: OrchestrationState, answers: Sequence[Dict[str, Any]]) -> None:
        await self.initialize_state(state)

    async def ingest_execution_followup(self, *, state: OrchestrationState, followup: Dict[str, Any]) -> None:
        await self.initialize_state(state)

    async def ingest_orchestrator_intervention(self, *, state: OrchestrationState, insight: Dict[str, Any]) -> None:
        await self.initialize_state(state)

    async def retrieve_for_summary(self, state: OrchestrationState) -> Dict[str, Any]:
        await self.initialize_state(state)
        return self._empty_context()


class NoopMemoryProvider(MemoryProvider):
    provider_name = "noop"


class ZepMemoryProvider(NoopMemoryProvider):
    provider_name = "zep"

    async def initialize_state(self, state: OrchestrationState) -> None:
        self._remember_state(state, status="not_configured", provider=self.provider_name, hits=0)


class MySQLGraphMemoryProvider(MemoryProvider):
    provider_name = "mysql_graph"

    def __init__(self, *, enabled: bool, scope_mode: str, max_items_per_agent: int, debug: bool) -> None:
        super().__init__(enabled=enabled, scope_mode=scope_mode, max_items_per_agent=max_items_per_agent, debug=debug)
        self._scope_cache: Dict[str, Dict[str, Any]] = {}

    def _scope_parts(self, state: OrchestrationState) -> Dict[str, str]:
        place = _slug(context_location_label(state.user_context) or "global")
        audience = _slug(",".join(str(x).strip() for x in state.user_context.get("targetAudience") or [] if str(x).strip()) or "general")
        idea = _hash_key(
            state.user_context.get("category"),
            state.idea_context_type,
            state.user_context.get("valueProposition"),
            state.user_context.get("deliveryModel"),
            str(state.user_context.get("idea") or "").lower()[:160],
        )
        user_key = str(state.user_id or "anon")
        return {
            "scope_key": f"{self.scope_mode}:{user_key}:{place}:{audience}:{idea}",
            "place_key": place,
            "audience_key": audience,
            "idea_fingerprint": idea,
        }

    def _persona_signature(self, persona: PersonaProfile) -> str:
        return _hash_key(
            persona.profession_role,
            persona.target_audience_cluster,
            persona.location_context or persona.location,
            ",".join(_clip_list(persona.motivations, 2)),
            ",".join(_clip_list(persona.concerns, 2)),
            _bucket_level(persona.financial_sensitivity),
            _bucket_level(persona.skepticism_level),
            _bucket_level(persona.conformity_level),
        )

    async def _ensure_scope(self, state: OrchestrationState) -> Dict[str, Any]:
        parts = self._scope_parts(state)
        cached = self._scope_cache.get(parts["scope_key"])
        if cached is not None:
            return cached
        row = await db_core.upsert_memory_scope(
            scope_key=parts["scope_key"],
            user_id=state.user_id,
            scope_mode=self.scope_mode,
            place_key=parts["place_key"],
            audience_key=parts["audience_key"],
            idea_fingerprint=parts["idea_fingerprint"],
            scope_meta={"idea": str(state.user_context.get("idea") or "")[:400], "location": context_location_label(state.user_context)},
        )
        scope = {"id": int((row or {}).get("id") or 0), **parts}
        self._scope_cache[parts["scope_key"]] = scope
        return scope

    def _touch(self, state: OrchestrationState, scope: Dict[str, Any], *, last_update_seq: int, hits: Optional[int] = None) -> None:
        self._remember_state(
            state,
            status="ready",
            provider=self.provider_name,
            scope_key=scope["scope_key"],
            hits=hits,
            last_update_seq=last_update_seq,
        )
        state.schema["memory_context_version"] = int(state.schema.get("memory_context_version") or 0) + 1

    async def initialize_state(self, state: OrchestrationState) -> None:
        if not self.enabled:
            await super().initialize_state(state)
            return
        scope = self._scope_parts(state)
        self._remember_state(state, status="ready", provider=self.provider_name, scope_key=scope["scope_key"], hits=0, last_update_seq=int(state.event_seq or 0))

    async def ingest_research(self, state: OrchestrationState) -> None:
        if not self.enabled or not state.search_completed or state.research is None:
            return
        try:
            scope = await self._ensure_scope(state)
            simulation_key = f"simulation:{state.simulation_id}"
            await db_core.upsert_memory_node(scope_id=scope["id"], node_key=simulation_key, node_type="simulation", label=str(state.user_context.get("idea") or state.simulation_id), attrs={"location": context_location_label(state.user_context)}, weight=1.0, last_seen_seq=int(state.event_seq or 0))
            signal_groups = {
                "objection": list((state.research.structured_schema or {}).get("complaints") or []),
                "need_signal": list((state.research.structured_schema or {}).get("signals") or []),
                "competitor_signal": list((state.research.structured_schema or {}).get("competition_reactions") or []),
                "price_signal": [state.research.structured_schema.get("price_sensitivity"), state.research.structured_schema.get("price_range")],
            }
            for node_type, values in signal_groups.items():
                for text in _clip_list(values, 10):
                    node_key = f"{node_type}:{_slug(text)}"
                    await db_core.upsert_memory_node(scope_id=scope["id"], node_key=node_key, node_type=node_type, label=text, attrs={"source": "research"}, weight=0.8, last_seen_seq=int(state.event_seq or 0))
                    await db_core.upsert_memory_edge(scope_id=scope["id"], edge_key=f"{simulation_key}|research_supports_signal|{node_key}", source_node_key=simulation_key, target_node_key=node_key, relation_type="research_supports_signal", weight=0.8, attrs={"source": "research"}, support_delta=1, contradiction_delta=0, last_seen_seq=int(state.event_seq or 0))
                    await db_core.insert_memory_episode(scope_id=scope["id"], episode_key=f"research:{state.simulation_id}:{node_key}", simulation_id=state.simulation_id, event_seq=int(state.event_seq or 0), episode_type="research_signal", source_node_key=simulation_key, target_node_key=node_key, payload={"label": text, "node_type": node_type})
            self._touch(state, scope, last_update_seq=int(state.event_seq or 0))
        except Exception as exc:  # noqa: BLE001
            self._remember_state(state, status=f"degraded:{exc.__class__.__name__}", provider=self.provider_name)

    async def retrieve_for_persona_generation(self, state: OrchestrationState) -> Dict[str, Any]:
        if not self.enabled:
            return self._empty_context()
        try:
            scope = await self._ensure_scope(state)
            context = await self._retrieve_scope_context(scope["id"], max(6, self.max_items_per_agent + 2))
            context["scope_key"] = scope["scope_key"]
            await db_core.insert_memory_retrieval_log(scope_id=scope["id"], simulation_id=state.simulation_id, persona_signature=None, retrieval_type="persona_generation", query_meta={"location": context_location_label(state.user_context)}, hits=context)
            self._remember_state(state, status="ready", provider=self.provider_name, scope_key=scope["scope_key"], hits=int(context.get("hit_count") or 0), last_update_seq=int(state.schema.get("memory_last_update_seq") or 0))
            return context
        except Exception as exc:  # noqa: BLE001
            self._remember_state(state, status=f"degraded:{exc.__class__.__name__}", provider=self.provider_name)
            return self._empty_context()

    async def ingest_personas(self, state: OrchestrationState) -> None:
        if not self.enabled or not state.personas:
            return
        try:
            scope = await self._ensure_scope(state)
            simulation_key = f"simulation:{state.simulation_id}"
            for persona in state.personas:
                persona_key = f"persona_signature:{self._persona_signature(persona)}"
                await db_core.upsert_memory_node(scope_id=scope["id"], node_key=persona_key, node_type="persona_signature", label=persona.name, attrs={"profession_role": persona.profession_role, "audience_cluster": persona.target_audience_cluster}, weight=float(persona.influence_weight or 1.0), last_seen_seq=int(state.event_seq or 0))
                await db_core.upsert_memory_edge(scope_id=scope["id"], edge_key=f"{persona_key}|persona_in_scope|{simulation_key}", source_node_key=persona_key, target_node_key=simulation_key, relation_type="persona_in_scope", weight=float(persona.influence_weight or 1.0), attrs={}, support_delta=1, contradiction_delta=0, last_seen_seq=int(state.event_seq or 0))
                await db_core.insert_memory_episode(scope_id=scope["id"], episode_key=f"persona:{state.simulation_id}:{persona_key}", simulation_id=state.simulation_id, event_seq=int(state.event_seq or 0), episode_type="persona_persisted", source_node_key=persona_key, target_node_key=simulation_key, payload={"persona_name": persona.name, "concerns": list(persona.concerns[:4]), "motivations": list(persona.motivations[:4])})
            self._touch(state, scope, last_update_seq=int(state.event_seq or 0))
        except Exception as exc:  # noqa: BLE001
            self._remember_state(state, status=f"degraded:{exc.__class__.__name__}", provider=self.provider_name)

    async def retrieve_for_turn(self, *, state: OrchestrationState, speaker: PersonaProfile, target: PersonaProfile, argument: Dict[str, Any]) -> Dict[str, Any]:
        if not self.enabled:
            return self._empty_context()
        try:
            scope = await self._ensure_scope(state)
            context = await self._build_turn_context(scope["id"], self._persona_signature(speaker), self._persona_signature(target), argument)
            context["scope_key"] = scope["scope_key"]
            await db_core.insert_memory_retrieval_log(scope_id=scope["id"], simulation_id=state.simulation_id, persona_signature=self._persona_signature(speaker), retrieval_type="turn", query_meta={"speaker": speaker.name, "target": target.name}, hits=context)
            self._remember_state(state, status="ready", provider=self.provider_name, scope_key=scope["scope_key"], hits=int(context.get("hit_count") or 0), last_update_seq=int(state.schema.get("memory_last_update_seq") or 0))
            return context
        except Exception as exc:  # noqa: BLE001
            self._remember_state(state, status=f"degraded:{exc.__class__.__name__}", provider=self.provider_name)
            return self._empty_context()

    async def ingest_turn(self, *, state: OrchestrationState, turn: DialogueTurn, speaker: PersonaProfile, target: PersonaProfile, argument: Dict[str, Any], payload: Dict[str, Any], event_seq: Optional[int] = None) -> None:
        if not self.enabled:
            return
        try:
            scope = await self._ensure_scope(state)
            seq = int(event_seq or state.event_seq or 0)
            speaker_key = f"persona_signature:{self._persona_signature(speaker)}"
            target_key = f"persona_signature:{self._persona_signature(target)}"
            await db_core.insert_memory_episode(scope_id=scope["id"], episode_key=f"turn:{turn.step_uid}", simulation_id=state.simulation_id, event_seq=seq, episode_type="dialogue_turn", source_node_key=speaker_key, target_node_key=target_key, payload={"message": turn.message, "reason_tag": turn.reason_tag, "argument": str(argument.get('claim') or ''), "target_shift": float(payload.get('target_shift') or 0.0), "speaker_shift": float(payload.get('speaker_shift') or 0.0)})
            await db_core.upsert_memory_edge(scope_id=scope["id"], edge_key=f"{speaker_key}|persona_replies_to_persona|{target_key}", source_node_key=speaker_key, target_node_key=target_key, relation_type="persona_replies_to_persona", weight=1.0, attrs={"latest_reason_tag": turn.reason_tag}, support_delta=1, contradiction_delta=0, last_seen_seq=seq)
            await db_core.upsert_memory_edge(scope_id=scope["id"], edge_key=f"{speaker_key}|persona_influences_persona|{target_key}", source_node_key=speaker_key, target_node_key=target_key, relation_type="persona_influences_persona", weight=max(0.1, abs(float(turn.influence_delta or 0.0))), attrs={"last_turn_uid": turn.step_uid}, support_delta=1 if float(turn.influence_delta or 0.0) >= 0 else 0, contradiction_delta=1 if float(turn.influence_delta or 0.0) < 0 else 0, last_seen_seq=seq)
            self._touch(state, scope, last_update_seq=seq)
        except Exception as exc:  # noqa: BLE001
            self._remember_state(state, status=f"degraded:{exc.__class__.__name__}", provider=self.provider_name)

    async def ingest_clarification_answers(self, *, state: OrchestrationState, answers: Sequence[Dict[str, Any]]) -> None:
        await self._ingest_learning_rows(state=state, learning_type="clarification_answer", items=answers, label_getter=lambda item: str(item.get("answer") or item.get("text") or "").strip(), payload_builder=lambda item, label: {"question_id": item.get("question_id") or item.get("questionId"), "answer": label})

    async def ingest_execution_followup(self, *, state: OrchestrationState, followup: Dict[str, Any]) -> None:
        await self._ingest_learning_rows(state=state, learning_type="execution_followup", items=[followup], label_getter=lambda item: str(item.get("learning") or item.get("next_step") or item.get("feedback") or "").strip(), payload_builder=lambda item, _label: dict(item))

    async def ingest_orchestrator_intervention(self, *, state: OrchestrationState, insight: Dict[str, Any]) -> None:
        await self._ingest_learning_rows(state=state, learning_type="orchestrator_intervention", items=[insight], label_getter=lambda item: str(item.get("message") or item.get("user_message") or "").strip(), payload_builder=lambda item, _label: dict(item))

    async def retrieve_for_summary(self, state: OrchestrationState) -> Dict[str, Any]:
        if not self.enabled:
            return self._empty_context()
        try:
            scope = await self._ensure_scope(state)
            context = await self._retrieve_scope_context(scope["id"], 8)
            context["scope_key"] = scope["scope_key"]
            await db_core.insert_memory_retrieval_log(scope_id=scope["id"], simulation_id=state.simulation_id, persona_signature=None, retrieval_type="summary", query_meta={"simulation_id": state.simulation_id}, hits=context)
            self._remember_state(state, status="ready", provider=self.provider_name, scope_key=scope["scope_key"], hits=int(context.get("hit_count") or 0), last_update_seq=int(state.schema.get("memory_last_update_seq") or 0))
            return context
        except Exception as exc:  # noqa: BLE001
            self._remember_state(state, status=f"degraded:{exc.__class__.__name__}", provider=self.provider_name)
            return self._empty_context()

    async def _retrieve_scope_context(self, scope_id: int, limit: int) -> Dict[str, Any]:
        node_rows = await db_core.fetch_memory_nodes(scope_id=scope_id, node_types=["objection", "need_signal", "competitor_signal", "price_signal", "execution_learning"], limit=max(12, limit * 4))
        episode_rows = await db_core.fetch_memory_episodes(scope_id=scope_id, episode_types=["execution_followup", "clarification_answer", "orchestrator_intervention"], entity_keys=None, limit=max(12, limit * 2))
        objections = [str(row.get("label") or "").strip() for row in node_rows if str(row.get("node_type") or "") in {"objection", "price_signal"}]
        signals = [str(row.get("label") or "").strip() for row in node_rows if str(row.get("node_type") or "") in {"need_signal", "competitor_signal"}]
        learnings = []
        for row in node_rows:
            if str(row.get("node_type") or "") == "execution_learning":
                learnings.append(str(row.get("label") or "").strip())
        for row in episode_rows:
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            label = str(payload.get("answer") or payload.get("learning") or payload.get("message") or "").strip()
            if label:
                learnings.append(label)
        hit_labels = _clip_list(objections + signals + learnings, max(limit, self.max_items_per_agent))
        return {"recurring_objections": _clip_list(objections, limit), "stable_behaviors": [], "confirmed_signals": _clip_list(signals, limit), "execution_learnings": _clip_list(learnings, limit), "relationship_context": [], "proven_adjustments": _clip_list(learnings, 3), "hit_labels": hit_labels, "hit_count": len(hit_labels)}

    async def _build_turn_context(self, scope_id: int, speaker_signature: str, target_signature: str, argument: Dict[str, Any]) -> Dict[str, Any]:
        node_rows = await db_core.fetch_memory_nodes(scope_id=scope_id, node_types=["objection", "need_signal", "competitor_signal", "price_signal", "execution_learning"], limit=max(12, self.max_items_per_agent * 4))
        edge_rows = await db_core.fetch_memory_edges(scope_id=scope_id, relation_types=["persona_replies_to_persona", "persona_influences_persona", "feedback_confirms", "feedback_contradicts"], source_node_key=None, target_node_key=None, limit=80)
        objections: Counter[str] = Counter()
        signals: Counter[str] = Counter()
        learnings: Counter[str] = Counter()
        relationships: List[str] = []
        argument_text = _normalize_text(argument.get("claim") or "")
        for row in node_rows:
            label = str(row.get("label") or "").strip()
            if not label:
                continue
            node_type = str(row.get("node_type") or "").strip()
            if node_type in {"objection", "price_signal"}:
                objections[label] += 2 if argument_text and _normalize_text(label) in argument_text else 1
            elif node_type in {"need_signal", "competitor_signal"}:
                signals[label] += 1
            elif node_type == "execution_learning":
                learnings[label] += 1
        speaker_key = f"persona_signature:{speaker_signature}"
        target_key = f"persona_signature:{target_signature}"
        for row in edge_rows:
            if str(row.get("source_node_key") or "") == speaker_key and str(row.get("target_node_key") or "") == target_key:
                relation = str(row.get("relation_type") or "")
                if relation in {"persona_replies_to_persona", "persona_influences_persona"}:
                    relationships.append(f"Past {relation.replace('_', ' ')}: {int(row.get('support_count') or 0)}")
        recurring = [x for x, _ in objections.most_common(self.max_items_per_agent)]
        confirmed = [x for x, _ in signals.most_common(self.max_items_per_agent)]
        learned = [x for x, _ in learnings.most_common(self.max_items_per_agent)]
        hits = _clip_list(recurring + confirmed + learned + relationships, self.max_items_per_agent + 2)
        return {"recurring_objections": recurring, "stable_behaviors": [], "confirmed_signals": confirmed, "execution_learnings": learned, "relationship_context": relationships[:3], "proven_adjustments": learned[:3], "hit_labels": hits, "hit_count": len(hits)}

    async def _ingest_learning_rows(self, *, state: OrchestrationState, learning_type: str, items: Sequence[Dict[str, Any]], label_getter: Any, payload_builder: Any) -> None:
        if not self.enabled:
            return
        try:
            scope = await self._ensure_scope(state)
            simulation_key = f"simulation:{state.simulation_id}"
            relation = "feedback_confirms"
            for item in items:
                label = str(label_getter(item) or "").strip()
                if not label:
                    continue
                if learning_type == "execution_followup" and str(item.get("classification") or "") in {"rejection_signal", "confusion_signal"}:
                    relation = "feedback_contradicts"
                node_key = f"execution_learning:{_slug(label)}:{_hash_key(label, size=10)}"
                await db_core.upsert_memory_node(scope_id=scope["id"], node_key=node_key, node_type="execution_learning", label=label[:180], attrs={"source": learning_type}, weight=0.8, last_seen_seq=int(state.event_seq or 0))
                await db_core.upsert_memory_edge(scope_id=scope["id"], edge_key=f"{simulation_key}|{relation}|{node_key}", source_node_key=simulation_key, target_node_key=node_key, relation_type=relation, weight=0.75, attrs={"source": learning_type}, support_delta=1 if relation == "feedback_confirms" else 0, contradiction_delta=1 if relation == "feedback_contradicts" else 0, last_seen_seq=int(state.event_seq or 0))
                await db_core.insert_memory_episode(scope_id=scope["id"], episode_key=f"{learning_type}:{state.simulation_id}:{_hash_key(label, size=14)}", simulation_id=state.simulation_id, event_seq=int(state.event_seq or 0), episode_type=learning_type, source_node_key=simulation_key, target_node_key=node_key, payload=payload_builder(item, label))
            self._touch(state, scope, last_update_seq=int(state.event_seq or 0))
        except Exception as exc:  # noqa: BLE001
            self._remember_state(state, status=f"degraded:{exc.__class__.__name__}", provider=self.provider_name)


def build_memory_provider() -> MemoryProvider:
    enabled = _env_flag("MEMORY_ENABLED", True)
    provider_name = str(os.getenv("MEMORY_PROVIDER", "mysql_graph")).strip().lower() or "mysql_graph"
    scope_mode = str(os.getenv("MEMORY_SCOPE_MODE", "cross_run")).strip().lower() or "cross_run"
    try:
        max_items = int(os.getenv("MEMORY_MAX_ITEMS_PER_AGENT", "5") or 5)
    except ValueError:
        max_items = 5
    debug = _env_flag("MEMORY_DEBUG", False)
    if not enabled:
        return NoopMemoryProvider(enabled=False, scope_mode=scope_mode, max_items_per_agent=max_items, debug=debug)
    if provider_name == "zep":
        return ZepMemoryProvider(enabled=True, scope_mode=scope_mode, max_items_per_agent=max_items, debug=debug)
    if provider_name == "mysql_graph":
        return MySQLGraphMemoryProvider(enabled=True, scope_mode=scope_mode, max_items_per_agent=max_items, debug=debug)
    return NoopMemoryProvider(enabled=False, scope_mode=scope_mode, max_items_per_agent=max_items, debug=debug)
