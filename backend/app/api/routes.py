from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from ..core.dataset_loader import Dataset
from ..models.orchestration import normalize_context
from ..orchestrator import SimulationOrchestrator
from .websocket import manager


router = APIRouter(prefix="/simulation")

_orchestrator: Optional[SimulationOrchestrator] = None


def configure_orchestrator(dataset: Dataset) -> None:
    global _orchestrator
    _orchestrator = SimulationOrchestrator(dataset=dataset, broadcaster=manager.broadcast_json)


def _get_orchestrator() -> SimulationOrchestrator:
    if _orchestrator is None:
        raise HTTPException(status_code=503, detail="Orchestrator is not initialized")
    return _orchestrator


def _require_simulation_id(payload: Dict[str, Any]) -> str:
    simulation_id = str(payload.get("simulation_id") or "").strip()
    if not simulation_id:
        raise HTTPException(status_code=400, detail="simulation_id is required")
    return simulation_id


@router.post("/start")
async def start_simulation(payload: Dict[str, Any]) -> Dict[str, Any]:
    context = normalize_context(payload)
    if not context.get("idea"):
        raise HTTPException(status_code=400, detail="idea is required")
    state = await _get_orchestrator().start_simulation(user_context=context, user_id=None)
    return {
        "simulation_id": state.simulation_id,
        "status": state.status,
        "current_phase_key": state.current_phase.value,
    }


@router.get("/state")
async def get_state(simulation_id: str) -> Dict[str, Any]:
    state = await _get_orchestrator().get_state(simulation_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return state.to_public_state()


@router.get("/result")
async def get_result(simulation_id: str) -> Dict[str, Any]:
    result = await _get_orchestrator().get_result(simulation_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return result


@router.post("/pause")
async def pause_simulation(payload: Dict[str, Any]) -> Dict[str, Any]:
    simulation_id = _require_simulation_id(payload)
    state = await _get_orchestrator().pause_simulation(simulation_id, reason=payload.get("reason"))
    if state is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {
        "simulation_id": simulation_id,
        "status": state.status,
        "status_reason": state.status_reason,
    }


@router.post("/resume")
async def resume_simulation(payload: Dict[str, Any]) -> Dict[str, Any]:
    simulation_id = _require_simulation_id(payload)
    state = await _get_orchestrator().resume_simulation(simulation_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {
        "simulation_id": simulation_id,
        "status": state.status,
        "status_reason": state.status_reason,
        "current_phase_key": state.current_phase.value,
    }
