from __future__ import annotations

import os
from typing import Any, Dict, List

from ..models.orchestration import OrchestrationState, context_location_label
from .base import BaseAgent


class ReportAgent(BaseAgent):
    name = "report_agent"

    async def build_report(self, state: OrchestrationState) -> Dict[str, Any]:
        language = self._report_language(state)
        fallback = self._fallback_report(state, language=language)
        payload = await self.runtime.llm.generate_json(
            prompt=(
                f"Language: {language}\n"
                f"Idea: {state.user_context.get('idea')}\n"
                f"Location: {context_location_label(state.user_context)}\n"
                f"Summary: {state.summary}\n"
                f"Metrics: {state.metrics}\n"
                f"Research summary: {state.research.summary if state.research else ''}\n"
                f"Research structured: {state.research.structured_schema if state.research else {}}\n"
                f"Critical insights: {state.critical_insights[-6:]}\n"
                f"Execution roadmap: {state.schema.get('execution_roadmap') or {}}\n"
                "Return JSON only with keys strengths, weaknesses, success_probability, success_score, best_places, "
                "key_risks, top_objections, top_positive_signals, recommended_first_move, confidence_notes. "
                "Use concise bullet-ready text. Do not invent facts beyond the state."
            ),
            system=(
                "You are a structured simulation reporting engine. "
                "Read the finished multi-agent state and produce a crisp, realistic report."
            ),
            temperature=0.2,
            fallback_json=fallback,
        )
        report = self._normalize_report(payload or fallback, fallback=fallback)
        state.schema["final_report"] = report
        state.schema["report_status"] = "ready"
        state.schema["report_language"] = language
        state.schema["report_summary"] = report.get("recommended_first_move")
        return report

    def _report_language(self, state: OrchestrationState) -> str:
        requested = str(
            state.user_context.get("reportLanguage")
            or state.user_context.get("report_language")
            or os.getenv("REPORT_LANGUAGE_DEFAULT", "")
            or state.user_context.get("language")
            or "ar"
        ).strip()
        return "ar" if requested.lower().startswith("ar") else "en"

    def _fallback_report(self, state: OrchestrationState, *, language: str) -> Dict[str, Any]:
        metrics = state.metrics or {}
        structured = state.research.structured_schema if state.research else {}
        acceptance_rate = float(metrics.get("acceptance_rate") or 0.0)
        strengths = self._take(structured.get("signals"), 4) or self._take(structured.get("behavior_patterns"), 4)
        weaknesses = self._take(structured.get("gaps_in_market"), 4) or self._take(structured.get("complaints"), 4)
        risks = self._take(structured.get("complaints"), 4)
        objections = self._take((structured.get("user_sentiment") or {}).get("negative"), 4)
        positives = self._take((structured.get("user_sentiment") or {}).get("positive"), 4)
        best_places = self._take(structured.get("notable_locations"), 4)
        roadmap = state.schema.get("execution_roadmap") if isinstance(state.schema.get("execution_roadmap"), dict) else {}
        recommended = str(
            roadmap.get("best_first_version")
            or (roadmap.get("first_five_steps") or [""])[0]
            or (state.summary or "")
        ).strip()
        if language == "ar":
            confidence = [
                "الثقة أعلى لما البحث المباشر قوي والنقاش أظهر تمايز واضح بين المؤيدين والرافضين."
                if not state.schema.get("research_estimated")
                else "تم استخدام تقدير بحثي منخفض الثقة، لذلك التقرير مفيد تشغيليًا لكنه أقل يقينًا من وجود إشارات حية قوية."
            ]
        else:
            confidence = [
                "Confidence is stronger when live research is rich and the debate shows clear opinion separation."
                if not state.schema.get("research_estimated")
                else "This report used low-confidence estimated research, so it is operationally useful but less certain than a strong live-signal run."
            ]
        return {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "success_probability": round(max(0.0, min(1.0, acceptance_rate)), 3),
            "success_score": int(round(max(0.0, min(1.0, acceptance_rate)) * 100)),
            "best_places": best_places or [context_location_label(state.user_context)] if context_location_label(state.user_context) else [],
            "key_risks": risks or weaknesses,
            "top_objections": objections,
            "top_positive_signals": positives or strengths,
            "recommended_first_move": recommended,
            "confidence_notes": confidence,
        }

    def _normalize_report(self, payload: Dict[str, Any], *, fallback: Dict[str, Any]) -> Dict[str, Any]:
        report = dict(fallback)
        report.update({key: value for key, value in dict(payload or {}).items() if value not in (None, "", [])})
        for key in ("strengths", "weaknesses", "best_places", "key_risks", "top_objections", "top_positive_signals", "confidence_notes"):
            report[key] = self._take(report.get(key), 5) or list(fallback.get(key) or [])
        report["recommended_first_move"] = str(report.get("recommended_first_move") or fallback.get("recommended_first_move") or "").strip()
        try:
            probability = float(report.get("success_probability") or fallback.get("success_probability") or 0.0)
        except (TypeError, ValueError):
            probability = float(fallback.get("success_probability") or 0.0)
        probability = max(0.0, min(1.0, probability))
        report["success_probability"] = round(probability, 3)
        try:
            score = int(report.get("success_score") or fallback.get("success_score") or int(round(probability * 100)))
        except (TypeError, ValueError):
            score = int(round(probability * 100))
        report["success_score"] = max(0, min(100, score))
        return report

    def _take(self, value: Any, limit: int) -> List[str]:
        if not isinstance(value, list):
            return []
        seen = set()
        items: List[str] = []
        for item in value:
            text = str(item or "").strip()
            if not text or text in seen:
                continue
            seen.add(text)
            items.append(text)
            if len(items) >= limit:
                break
        return items
