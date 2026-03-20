from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.agents.simulation_agent import SimulationAgent  # noqa: E402
from app.models.orchestration import DialogueTurn, EvidenceItem, OrchestrationState, PersonaProfile, ResearchReport  # noqa: E402


def _runtime(llm: object | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        dataset=SimpleNamespace(rules_by_pair={}),
        llm=llm or SimpleNamespace(generate_json=AsyncMock(return_value={})),
        event_bus=None,
        repository=None,
    )


def _agent(llm: object | None = None) -> SimulationAgent:
    return SimulationAgent(_runtime(llm))


def _research() -> ResearchReport:
    return ResearchReport(
        summary="الناس في الجيزة بتقارن الأسعار وبتشتكي من الرسوم والمنافسة العالية.",
        findings=["الناس بتقارن الأسعار", "المنافسة عالية"],
        evidence=[
            EvidenceItem(
                query="q",
                title="Market note",
                url="https://example.com/1",
                domain="example.com",
                snippet="العملاء بيقارنوا الأسعار وبيتجنبوا الرسوم العالية.",
                content="",
                relevance_score=0.8,
                http_status=200,
            )
        ],
        structured_schema={
            "competition_level": "high",
            "price_sensitivity": "high",
            "complaints": ["رسوم التوصيل", "السعر العالي"],
            "behaviors": ["مقارنة الأسعار", "الشراء وقت الخصومات"],
            "competition_reactions": ["الناس بتروح لبديل أرخص"],
        },
    )


def _state() -> OrchestrationState:
    return OrchestrationState(
        simulation_id="sim-reasoning",
        user_id=None,
        user_context={
            "idea": "توصيل بقالة سريع",
            "city": "الجيزة",
            "language": "ar",
        },
        research=_research(),
    )


def _persona(
    persona_id: str,
    name: str,
    *,
    profession: str = "business owner",
    financial: float = 0.8,
    skepticism: float = 0.65,
    conformity: float = 0.4,
    stubbornness: float = 0.35,
    innovation: float = 0.45,
    opinion: str = "reject",
) -> PersonaProfile:
    return PersonaProfile(
        persona_id=persona_id,
        name=name,
        source_mode="research_signal",
        target_audience_cluster="Local Buyers",
        location_context="الجيزة",
        age_band="25-34",
        life_stage="working adult",
        profession_role=profession,
        attitude_baseline="reacts through signals",
        skepticism_level=skepticism,
        conformity_level=conformity,
        stubbornness_level=stubbornness,
        innovation_openness=innovation,
        financial_sensitivity=financial,
        speaking_style="direct",
        tags=["price-aware"],
        source_attribution={"kind": "research_signal"},
        evidence_signals=["رسوم التوصيل", "مقارنة الأسعار"],
        category_id="consumer",
        template_id="tpl-1",
        archetype_name="Budget Buyer",
        summary="price-aware buyer",
        motivations=["توفير", "سهولة"],
        concerns=["رسوم التوصيل", "السعر العالي"],
        location="الجيزة",
        opinion=opinion,
        confidence=0.5,
        influence_weight=1.0,
        traits={"cluster_id": "cluster-a"},
        biases=[],
        opinion_score=-0.25 if opinion == "reject" else (0.22 if opinion == "accept" else 0.0),
    )


class SimulationReasoningTests(unittest.IsolatedAsyncioTestCase):
    def test_fallback_turn_is_persona_and_research_grounded(self) -> None:
        agent = _agent()
        state = _state()
        speaker = _persona("speaker", "Agent1", profession="business owner", financial=0.9, skepticism=0.7)
        target = _persona("target", "Agent2", opinion="accept")
        payload = agent._fallback_turn_payload(
            speaker=speaker,
            target=target,
            argument={"claim": "الفكرة محتاجة تميز أوضح"},
            evidence=[{"snippet": "العملاء بيقارنوا الأسعار", "url": "https://example.com/1"}],
            question_mode=False,
            state=state,
            iteration=1,
        )
        self.assertIn("@Agent2", payload["message"])
        self.assertTrue("السعر" in payload["message"] or "رسوم" in payload["message"])
        self.assertIn("الجيزة", payload["message"])
        self.assertEqual(payload["reason_tag"], "persona_concern")

    def test_validation_rejects_generic_turns(self) -> None:
        agent = _agent()
        state = _state()
        speaker = _persona("speaker", "Agent1")
        target = _persona("target", "Agent2", opinion="accept")
        errors = agent._validate_turn_payload(
            state=state,
            speaker=speaker,
            target=target,
            argument={"claim": "الفكرة محتاجة تميز"},
            evidence=[{"snippet": "العملاء بيقارنوا الأسعار"}],
            payload={
                "message": "@Agent2 بشكل عام الموضوع يعتمد على التنفيذ.",
                "target_shift": 0.0,
                "speaker_shift": 0.0,
                "convincing": False,
                "rejected": False,
                "insight": "",
                "insight_severity": 0.0,
                "question": "",
                "reason_tag": "generic",
            },
            question_mode=False,
            iteration=1,
        )
        self.assertTrue(any("generic" in item or "research" in item or "persona" in item for item in errors))

    async def test_generate_turn_payload_falls_back_after_invalid_llm_output(self) -> None:
        llm = SimpleNamespace(
            generate_json=AsyncMock(
                side_effect=[
                    {
                        "message": "@Agent2 بشكل عام الموضوع يعتمد على التنفيذ.",
                        "target_shift": 0.09,
                        "speaker_shift": 0.0,
                    },
                    {
                        "message": "@Agent2 برضه بشكل عام محتاج تنفيذ أحسن.",
                        "target_shift": 0.09,
                        "speaker_shift": 0.0,
                    },
                ]
            )
        )
        agent = _agent(llm)
        state = _state()
        speaker = _persona("speaker", "Agent1")
        target = _persona("target", "Agent2", opinion="accept")
        fallback = agent._fallback_turn_payload(
            speaker=speaker,
            target=target,
            argument={"claim": "الفكرة محتاجة تميز"},
            evidence=[{"snippet": "العملاء بيقارنوا الأسعار", "url": "https://example.com/1"}],
            question_mode=False,
            state=state,
            iteration=1,
        )
        payload = await agent._generate_turn_payload(
            state=state,
            speaker=speaker,
            target=target,
            argument={"claim": "الفكرة محتاجة تميز"},
            evidence=[{"snippet": "العملاء بيقارنوا الأسعار", "url": "https://example.com/1"}],
            question_mode=False,
            iteration=1,
            fallback=fallback,
        )
        self.assertEqual(payload["message"], fallback["message"])
        self.assertIn("validation_errors", payload)

    def test_conforming_persona_moves_more_than_stubborn_persona(self) -> None:
        agent = _agent()
        speaker = _persona("speaker", "Agent1", opinion="accept", skepticism=0.2, financial=0.4, innovation=0.7)

        conforming_state = _state()
        conforming_target = _persona("target-a", "Agent2", conformity=0.9, stubbornness=0.1, opinion="neutral")
        conforming_state.personas = [speaker, conforming_target]
        agent._ensure_runtime_metadata(conforming_state)
        turn = DialogueTurn(
            step_uid="t1",
            iteration=2,
            phase="agent_deliberation",
            agent_id=speaker.persona_id,
            agent_name=speaker.name,
            reply_to_agent_id=conforming_target.persona_id,
            reply_to_agent_name=conforming_target.name,
            message="@Agent2 حسب اللي لقيناه الناس بتقارن الأسعار، فدي فرصة لو السعر مضبوط.",
            stance_before=speaker.opinion,
            stance_after=speaker.opinion,
            confidence=speaker.confidence,
            influence_delta=0.0,
        )
        agent._apply_turn_effects(
            conforming_state,
            speaker,
            conforming_target,
            turn,
            {"strength": 0.7, "claim": "الناس بتقارن الأسعار"},
            {"target_shift": 0.04, "speaker_shift": 0.0, "convincing": True, "rejected": False},
        )
        conforming_shift = conforming_target.opinion_score

        stubborn_state = _state()
        stubborn_speaker = _persona("speaker-b", "Agent1", opinion="accept", skepticism=0.2, financial=0.4, innovation=0.7)
        stubborn_target = _persona("target-b", "Agent2", conformity=0.1, stubbornness=0.9, opinion="neutral")
        stubborn_state.personas = [stubborn_speaker, stubborn_target]
        agent._ensure_runtime_metadata(stubborn_state)
        turn_b = DialogueTurn(
            step_uid="t2",
            iteration=2,
            phase="agent_deliberation",
            agent_id=stubborn_speaker.persona_id,
            agent_name=stubborn_speaker.name,
            reply_to_agent_id=stubborn_target.persona_id,
            reply_to_agent_name=stubborn_target.name,
            message="@Agent2 حسب اللي لقيناه الناس بتقارن الأسعار، فدي فرصة لو السعر مضبوط.",
            stance_before=stubborn_speaker.opinion,
            stance_after=stubborn_speaker.opinion,
            confidence=stubborn_speaker.confidence,
            influence_delta=0.0,
        )
        agent._apply_turn_effects(
            stubborn_state,
            stubborn_speaker,
            stubborn_target,
            turn_b,
            {"strength": 0.7, "claim": "الناس بتقارن الأسعار"},
            {"target_shift": 0.04, "speaker_shift": 0.0, "convincing": True, "rejected": False},
        )
        stubborn_shift = stubborn_target.opinion_score
        self.assertGreater(conforming_shift, stubborn_shift)

    def test_orchestrator_detects_repeated_cost_problem(self) -> None:
        agent = _agent()
        state = _state()
        speaker = _persona("speaker", "Agent1", profession="business owner", financial=0.9, skepticism=0.7)
        target = _persona("target", "Agent2", opinion="accept")
        state.personas = [speaker, target]
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="d1",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B السعر عالي والرسوم هتضايق الناس.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
            DialogueTurn(
                step_uid="d2",
                iteration=1,
                phase="agent_deliberation",
                agent_id="c",
                agent_name="C",
                reply_to_agent_id="d",
                reply_to_agent_name="D",
                message="@D أنا شايف التكلفة والرسوم مشكلة كبيرة برضه.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
        ]
        turn = DialogueTurn(
            step_uid="d3",
            iteration=2,
            phase="agent_deliberation",
            agent_id=speaker.persona_id,
            agent_name=speaker.name,
            reply_to_agent_id=target.persona_id,
            reply_to_agent_name=target.name,
            message="@Agent2 طب والسعر هيبقى مناسب إزاي؟",
            stance_before=speaker.opinion,
            stance_after=speaker.opinion,
            confidence=speaker.confidence,
            influence_delta=0.0,
        )
        intervention = agent._detect_orchestrator_intervention(state, turn, {"claim": "السعر والرسوم"})
        self.assertIsNotNone(intervention)
        assert intervention is not None
        self.assertEqual(intervention["tag"], "cost_pressure")
        self.assertIn("السعر", intervention["user_message"])

    def test_orchestrator_groups_conversation_problems_into_issue_clusters(self) -> None:
        agent = _agent()
        state = _state()
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="g1",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B السعر عالي والرسوم الإضافية مخوفاني.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
            DialogueTurn(
                step_uid="g2",
                iteration=1,
                phase="agent_deliberation",
                agent_id="c",
                agent_name="C",
                reply_to_agent_id="d",
                reply_to_agent_name="D",
                message="@D لو القيمة مش واضحة الناس مش هتدفع المبلغ ده.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
        ]
        clusters = agent._group_intervention_problems(
            state,
            {
                "tag": "cost_pressure",
                "message": "واضح إن السعر عامل ضغط.",
                "evidence_summary": ["الناس حساسة للسعر", "رسوم التوصيل مزعجة"],
            },
        )
        codes = {item["code"] for item in clusters}
        self.assertIn("entry_price", codes)
        self.assertIn("extra_fees", codes)
        self.assertTrue(any(item.get("evidence") for item in clusters))

    async def test_orchestrator_suggestions_stay_grounded_when_llm_is_generic(self) -> None:
        llm = SimpleNamespace(
            generate_json=AsyncMock(
                return_value={
                    "suggestions": [
                        "حاول تميز نفسك.",
                        "غيّر الفكرة لفكرة تانية.",
                        "اعمل marketing أحسن.",
                    ]
                }
            )
        )
        agent = _agent(llm)
        state = _state()
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="s1",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B السعر عالي والرسوم كتير على الخدمة.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
            DialogueTurn(
                step_uid="s2",
                iteration=1,
                phase="agent_deliberation",
                agent_id="c",
                agent_name="C",
                reply_to_agent_id="d",
                reply_to_agent_name="D",
                message="@D لو الرسوم فضلت بالشكل ده الناس هتروح لبديل أرخص.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
        ]
        latest = {
            "tag": "cost_pressure",
            "message": "في ضغط واضح على السعر.",
            "user_message": "واضح إن السعر عامل مشكلة.",
            "evidence_summary": ["الناس حساسة للسعر", "رسوم التوصيل مزعجة"],
        }
        suggestions = await agent._generate_orchestrator_suggestions(state, latest)
        self.assertGreaterEqual(len(suggestions), 3)
        self.assertTrue(all("فكرة تانية" not in item for item in suggestions))
        self.assertTrue(all("حاول تميز نفسك" not in item for item in suggestions))
        self.assertTrue(any("سعر" in item or "رسوم" in item or "باقة" in item for item in suggestions))
        self.assertTrue(latest.get("issue_clusters"))

    async def test_orchestrator_intervention_yes_then_apply_updates_context(self) -> None:
        llm = SimpleNamespace(
            generate_json=AsyncMock(
                return_value={
                    "suggestions": [
                        "ابدأ بباقة دخول واضحة من غير رسوم مفاجئة.",
                        "خصص الخدمة لشريحة صغيرة مستعدة تدفع مقابل السرعة.",
                        "اختبر التسعير في منطقة واحدة قبل التوسع.",
                    ]
                }
            )
        )
        agent = _agent(llm)
        state = _state()
        state.pending_input = True
        state.pending_input_kind = "orchestrator_intervention"
        state.pending_resume_phase = "agent_deliberation"
        state.critical_insights = [
            {
                "kind": "orchestrator_intervention",
                "tag": "cost_pressure",
                "message": "فيه ضغط على السعر.",
                "user_message": "واضح إن السعر مشكلة.",
                "evidence_summary": ["الناس حساسة للسعر"],
                "resolved": False,
            }
        ]
        await agent.handle_orchestrator_intervention_response(state, [{"answer": "نعم"}])
        self.assertEqual(state.pending_input_kind, "orchestrator_apply_suggestions")
        self.assertIn("orchestratorSuggestions", state.schema)
        self.assertGreaterEqual(len(state.critical_insights[-1]["suggestions"]), 3)
        self.assertLessEqual(len(state.critical_insights[-1]["suggestions"]), 5)
        self.assertIn("أكتر من شخص", state.clarification_questions[0].prompt)

        await agent.handle_orchestrator_intervention_response(state, [{"answer": "أيوه"}])
        self.assertFalse(state.pending_input)
        self.assertIn("تطبيق تعديل مقترح", state.user_context["notes"])
        self.assertEqual(state.status_reason, "coach_intervention_applied")

    def test_apply_intervention_stores_improvement_baseline(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="reject"),
            _persona("p2", "B", opinion="neutral"),
            _persona("p3", "C", opinion="accept"),
        ]
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="b1",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B السعر عالي ومش واضح ليه أدفعه.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            )
        ]
        agent._apply_intervention_suggestions(
            state,
            {
                "tag": "cost_pressure",
                "issue_clusters": [{"code": "entry_price", "label": "حساسية سعر البداية"}],
                "suggestions": ["ابدأ بباقة دخول صغيرة وسعر واضح."],
            },
        )
        runs = state.schema.get("idea_improvement_runs") or []
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0]["original_idea"], state.user_context["idea"])
        self.assertIn("بعد التعديل", runs[0]["modified_idea"])
        self.assertEqual(runs[0]["metrics_before"]["accepted"], 1)

    def test_latest_improvement_evaluation_compares_before_and_after(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="reject"),
            _persona("p2", "B", opinion="reject"),
            _persona("p3", "C", opinion="neutral"),
        ]
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="e1",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B السعر عالي ومش واضح الفرق عن الموجود.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
            DialogueTurn(
                step_uid="e2",
                iteration=1,
                phase="agent_deliberation",
                agent_id="c",
                agent_name="C",
                reply_to_agent_id="d",
                reply_to_agent_name="D",
                message="@D الرسوم كتير ومش فاهم هتفرق إزاي.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
        ]
        agent._apply_intervention_suggestions(
            state,
            {
                "tag": "cost_pressure",
                "issue_clusters": [{"code": "entry_price", "label": "حساسية سعر البداية"}],
                "suggestions": ["ابدأ بباقة دخول صغيرة وسعر واضح.", "وضّح القيمة في أول تجربة."],
            },
        )
        state.personas[0].opinion = "accept"
        state.personas[0].opinion_score = 0.22
        state.personas[1].opinion = "neutral"
        state.personas[1].opinion_score = 0.0
        state.personas[2].opinion = "accept"
        state.personas[2].opinion_score = 0.24
        state.deliberation_state["iteration"] = 3
        state.dialogue_turns.extend(
            [
                DialogueTurn(
                    step_uid="e3",
                    iteration=2,
                    phase="agent_deliberation",
                    agent_id="a",
                    agent_name="A",
                    reply_to_agent_id="b",
                    reply_to_agent_name="B",
                    message="@B كده السعر أوضح والقيمة بقت مفهومة أكتر.",
                    stance_before="reject",
                    stance_after="neutral",
                    confidence=0.6,
                    influence_delta=0.1,
                ),
                DialogueTurn(
                    step_uid="e4",
                    iteration=3,
                    phase="agent_deliberation",
                    agent_id="c",
                    agent_name="C",
                    reply_to_agent_id="d",
                    reply_to_agent_name="D",
                    message="@D دلوقتي في ميزة أوضح وممكن الناس تجرب.",
                    stance_before="neutral",
                    stance_after="accept",
                    confidence=0.65,
                    influence_delta=0.12,
                ),
            ]
        )
        evaluation = agent._latest_improvement_evaluation(state)
        assert evaluation is not None
        self.assertGreater(evaluation["acceptance_after"], evaluation["acceptance_before"])
        self.assertTrue(evaluation["improved"])
        self.assertTrue(evaluation["key_improvements"])
        self.assertIn("قبل التعديل", evaluation["summary"])
        self.assertIn("بعد التعديل", evaluation["summary"])

    def test_optimization_decision_marks_execution_mode_when_ready(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="accept"),
            _persona("p5", "E", opinion="reject"),
        ]
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="o1",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B بعد التعديل القيمة بقت أوضح والسعر مفهوم.",
                stance_before="neutral",
                stance_after="accept",
                confidence=0.7,
                influence_delta=0.1,
            ),
            DialogueTurn(
                step_uid="o2",
                iteration=2,
                phase="agent_deliberation",
                agent_id="c",
                agent_name="C",
                reply_to_agent_id="d",
                reply_to_agent_name="D",
                message="@D فيه ميزة أوضح دلوقتي والناس هتفهم ليه تختاره.",
                stance_before="neutral",
                stance_after="accept",
                confidence=0.72,
                influence_delta=0.12,
            ),
        ]
        state.deliberation_state["iteration"] = 3
        state.schema["idea_improvement_runs"] = [
            {
                "evaluation": {
                    "acceptance_after": 0.8,
                    "rejection_after": 1,
                    "remaining_problems": [],
                    "key_improvements": ["القيمة المتصورة بقت أوضح.", "التميّز بقى أوضح."],
                    "differentiation_before": 0,
                    "differentiation_after": 2,
                    "perceived_value_before": 0,
                    "perceived_value_after": 2,
                }
            }
        ]
        decision = agent._build_optimization_decision(state)
        self.assertEqual(decision["decision"], "READY_TO_MOVE_FORWARD")
        self.assertEqual(state.schema["system_mode"], "execution_mode")
        self.assertEqual(state.user_context["systemMode"], "execution_mode")

    def test_ready_optimization_stops_new_intervention(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="accept"),
        ]
        state.deliberation_state["iteration"] = 3
        state.schema["idea_improvement_runs"] = [
            {
                "evaluation": {
                    "acceptance_after": 0.75,
                    "rejection_after": 0,
                    "remaining_problems": [],
                    "key_improvements": ["القيمة المتصورة بقت أوضح.", "التميّز بقى أوضح."],
                    "differentiation_before": 0,
                    "differentiation_after": 2,
                    "perceived_value_before": 0,
                    "perceived_value_after": 2,
                }
            }
        ]
        turn = DialogueTurn(
            step_uid="o3",
            iteration=3,
            phase="agent_deliberation",
            agent_id="p1",
            agent_name="A",
            reply_to_agent_id="p2",
            reply_to_agent_name="B",
            message="@B الفكرة بقت أوضح ومقبولة.",
            stance_before="accept",
            stance_after="accept",
            confidence=0.75,
            influence_delta=0.0,
        )
        intervention = agent._detect_orchestrator_intervention(state, turn, {"claim": "السعر واضح والقيمة أفضل"})
        self.assertIsNone(intervention)

    def test_execution_roadmap_is_structured_and_contextual(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="accept"),
        ]
        state.user_context["country"] = "Egypt"
        state.user_context["targetAudience"] = ["Office Workers"]
        roadmap = agent._build_execution_roadmap(state)
        self.assertIn("why_now", roadmap)
        self.assertIn("best_first_version", roadmap)
        self.assertEqual(len(roadmap["first_five_steps"]), 5)
        self.assertTrue(any("الجيزة" in item for item in roadmap["why_now"] + roadmap["first_five_steps"]))
        self.assertIn("واتساب", roadmap["low_cost_version"])
        self.assertEqual(state.schema["execution_roadmap"]["context"]["city"], "ط§ظ„ط¬ظٹط²ط©")

    async def test_summary_includes_execution_roadmap_when_ready(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="accept"),
            _persona("p5", "E", opinion="reject"),
        ]
        state.deliberation_state["iteration"] = 3
        state.schema["idea_improvement_runs"] = [
            {
                "evaluation": {
                    "acceptance_after": 0.8,
                    "rejection_after": 1,
                    "remaining_problems": [],
                    "key_improvements": ["القيمة المتصورة بقت أوضح.", "التميّز بقى أوضح."],
                    "differentiation_before": 0,
                    "differentiation_after": 2,
                    "perceived_value_before": 0,
                    "perceived_value_after": 2,
                }
            }
        ]
        summary = await agent.build_summary(state)
        self.assertIn("أفضل نسخة تبدأ بيها", summary)
        self.assertIn("أول 5 خطوات", summary)
        self.assertIn("خطة أسبوع 1", summary)
        self.assertIn("تحب أحول الخطة دي", summary)
        self.assertIn("execution_roadmap", state.schema)

    async def test_summary_includes_business_guidance_when_promising(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="reject"),
        ]
        state.argument_bank = [
            {"polarity": "support", "claim": "فيه فرصة لو السعر واضح", "strength": 0.8},
            {"polarity": "concern", "claim": "الرسوم العالية ممكن تكسر الطلب", "strength": 0.7},
        ]
        state.critical_insights = [{"user_message": "واضح إن السعر حساس", "message": "السعر حساس"}]
        summary = await agent.build_summary(state)
        self.assertIn("ليه ناس قبلت", summary)
        self.assertIn("أول خطوة عملية", summary)

    def test_execution_roadmap_is_structured_and_contextual(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="accept"),
        ]
        state.user_context["country"] = "Egypt"
        state.user_context["targetAudience"] = ["Office Workers"]
        roadmap = agent._build_execution_roadmap(state)
        self.assertIn("why_now", roadmap)
        self.assertIn("best_first_version", roadmap)
        self.assertEqual(len(roadmap["first_five_steps"]), 5)
        self.assertTrue(any("الجيزة" in item for item in roadmap["why_now"] + roadmap["first_five_steps"]))
        self.assertIn("واتساب", roadmap["low_cost_version"])
        self.assertEqual(state.schema["execution_roadmap"]["context"]["city"], "الجيزة")

    async def test_summary_includes_business_guidance_when_promising(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="reject"),
        ]
        state.argument_bank = [
            {"polarity": "support", "claim": "فيه فرصة لو السعر واضح", "strength": 0.8},
            {"polarity": "concern", "claim": "الرسوم العالية ممكن تكسر الطلب", "strength": 0.7},
        ]
        state.critical_insights = [{"user_message": "واضح إن السعر حساس", "message": "السعر حساس"}]
        summary = await agent.build_summary(state)
        self.assertIn("ليه ناس قبلت", summary)
        self.assertIn("أفضل نسخة تبدأ بيها", summary)

    def test_execution_steps_follow_agent_objections(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="reject"),
            _persona("p3", "C", opinion="neutral"),
        ]
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="x1",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B السعر عالي والرسوم كتير.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
            DialogueTurn(
                step_uid="x2",
                iteration=1,
                phase="agent_deliberation",
                agent_id="c",
                agent_name="C",
                reply_to_agent_id="d",
                reply_to_agent_name="D",
                message="@D مش واضح الفرق عن الموجود.",
                stance_before="neutral",
                stance_after="neutral",
                confidence=0.5,
                influence_delta=0.0,
            ),
            DialogueTurn(
                step_uid="x3",
                iteration=1,
                phase="agent_deliberation",
                agent_id="e",
                agent_name="E",
                reply_to_agent_id="f",
                reply_to_agent_name="F",
                message="@F فيه منافسين كتير في الجيزة.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            ),
        ]
        steps = agent._build_execution_steps(state)
        self.assertIn("steps", steps)
        self.assertGreaterEqual(len(steps["steps"]), 3)
        combined = " ".join(steps["steps"])
        self.assertIn("5 ناس", combined)
        self.assertTrue("السعر" in combined or "باقة دخول" in combined)
        self.assertTrue("مش واضحة" in combined or "3 سطور" in combined)
        self.assertIn("الجيزة", combined)

    async def test_summary_includes_execution_steps_intro(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="accept"),
            _persona("p5", "E", opinion="reject"),
        ]
        state.dialogue_turns = [
            DialogueTurn(
                step_uid="x4",
                iteration=1,
                phase="agent_deliberation",
                agent_id="a",
                agent_name="A",
                reply_to_agent_id="b",
                reply_to_agent_name="B",
                message="@B السعر عالي شوية.",
                stance_before="reject",
                stance_after="reject",
                confidence=0.5,
                influence_delta=0.0,
            )
        ]
        state.deliberation_state["iteration"] = 3
        state.schema["idea_improvement_runs"] = [
            {
                "evaluation": {
                    "acceptance_after": 0.8,
                    "rejection_after": 1,
                    "remaining_problems": [],
                    "key_improvements": ["القيمة المتصورة بقت أوضح.", "التميّز بقى أوضح."],
                    "differentiation_before": 0,
                    "differentiation_after": 2,
                    "perceived_value_before": 0,
                    "perceived_value_after": 2,
                }
            }
        ]
        summary = await agent.build_summary(state)
        self.assertIn("بص، من الكلام اللي حصل", summary)
        self.assertIn("تحب نجرب أول خطوة", summary)
        self.assertIn("execution_steps", state.schema)

    async def test_execution_followup_response_creates_learning_and_next_step(self) -> None:
        agent = _agent()
        state = _state()
        state.schema["system_mode"] = "execution_mode"
        state.user_context["systemMode"] = "execution_mode"
        state.pending_input = True
        state.pending_input_kind = "execution_followup"
        await agent.handle_execution_followup_response(
            state,
            [{"answer": "الناس عجبتها الفكرة بس قالوا السعر عالي شوية"}],
        )
        latest = state.schema.get("latest_execution_followup") or {}
        self.assertEqual(latest.get("classification"), "mixed_signal")
        self.assertIn("السعر", latest.get("learning", ""))
        self.assertTrue("سعر أقل" in latest.get("next_step", "") or "باقة دخول" in latest.get("next_step", ""))
        self.assertTrue(state.pending_input)
        self.assertEqual(state.pending_input_kind, "execution_followup")
        self.assertIn("لو عملتها", state.clarification_questions[0].prompt)

    async def test_execution_followup_avoids_repeating_same_next_step(self) -> None:
        agent = _agent()
        state = _state()
        state.schema["system_mode"] = "execution_mode"
        state.user_context["systemMode"] = "execution_mode"
        state.pending_input = True
        state.pending_input_kind = "execution_followup"
        await agent.handle_execution_followup_response(
            state,
            [{"answer": "الناس شايفة السعر عالي"}],
        )
        first_step = (state.schema.get("latest_execution_followup") or {}).get("next_step")
        await agent.handle_execution_followup_response(
            state,
            [{"answer": "برضه السعر كان عالي على الناس"}],
        )
        second_step = (state.schema.get("latest_execution_followup") or {}).get("next_step")
        self.assertTrue(first_step)
        self.assertTrue(second_step)
        self.assertNotEqual(first_step, second_step)

    async def test_ready_summary_primes_execution_followup_prompt(self) -> None:
        agent = _agent()
        state = _state()
        state.personas = [
            _persona("p1", "A", opinion="accept"),
            _persona("p2", "B", opinion="accept"),
            _persona("p3", "C", opinion="accept"),
            _persona("p4", "D", opinion="accept"),
            _persona("p5", "E", opinion="reject"),
        ]
        state.deliberation_state["iteration"] = 3
        state.schema["idea_improvement_runs"] = [
            {
                "evaluation": {
                    "acceptance_after": 0.8,
                    "rejection_after": 1,
                    "remaining_problems": [],
                    "key_improvements": ["القيمة المتصورة بقت أوضح.", "التميّز بقى أوضح."],
                    "differentiation_before": 0,
                    "differentiation_after": 2,
                    "perceived_value_before": 0,
                    "perceived_value_after": 2,
                }
            }
        ]
        await agent.build_summary(state)
        self.assertTrue(state.pending_input)
        self.assertEqual(state.pending_input_kind, "execution_followup")
        self.assertIn("لو جرّبتها", state.clarification_questions[0].prompt)


if __name__ == "__main__":
    unittest.main()
