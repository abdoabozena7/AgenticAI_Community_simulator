"""WebSocket endpoint and connection manager for simulation updates."""

from __future__ import annotations

import asyncio
import json
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


class ConnectionInfo:
    def __init__(self, websocket: WebSocket) -> None:
        self.websocket = websocket
        self.subscriptions: Set[str] = set()
        self.send_lock = asyncio.Lock()


class ConnectionManager:
    """Manage active WebSocket connections."""

    def __init__(self) -> None:
        self.active_connections: Dict[WebSocket, ConnectionInfo] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[websocket] = ConnectionInfo(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.pop(websocket, None)

    def subscribe(self, websocket: WebSocket, simulation_id: str, replace: bool = False) -> None:
        info = self.active_connections.get(websocket)
        if not info:
            return
        if replace:
            info.subscriptions = {simulation_id}
            return
        info.subscriptions.add(simulation_id)

    async def broadcast_json(self, message: dict) -> None:
        simulation_id = message.get("simulation_id")
        targets: list[tuple[WebSocket, ConnectionInfo]] = []
        for connection, info in list(self.active_connections.items()):
            if simulation_id and simulation_id not in info.subscriptions:
                continue
            targets.append((connection, info))

        async def _send_one(connection: WebSocket, info: ConnectionInfo) -> bool:
            try:
                async with info.send_lock:
                    await asyncio.wait_for(connection.send_json(message), timeout=1.5)
                return True
            except Exception:
                return False

        if not targets:
            return

        results = await asyncio.gather(*[_send_one(connection, info) for connection, info in targets], return_exceptions=False)
        for idx, ok in enumerate(results):
            if not ok:
                self.disconnect(targets[idx][0])


router = APIRouter()
manager = ConnectionManager()


@router.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except Exception:
                continue
            if not isinstance(data, dict):
                continue
            if data.get("type") == "subscribe":
                simulation_id = str(data.get("simulation_id") or "").strip()
                if simulation_id:
                    manager.subscribe(websocket, simulation_id, replace=bool(data.get("replace")))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
