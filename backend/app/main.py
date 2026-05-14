"""Entry point for the minimal research backend."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import routes as simulation_routes
from .api import websocket as websocket_module
from .core.dataset_loader import load_dataset
from .core.db import init_db


def _allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]


def create_app() -> FastAPI:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(env_path)

    app = FastAPI(title="Research Simulation Backend")
    allowed_origins = _allowed_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(simulation_routes.router)
    app.include_router(websocket_module.router)

    @app.on_event("startup")
    async def startup_event() -> None:
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        from .api import routes  # local import to avoid circular dependency

        await init_db()
        routes.configure_orchestrator(load_dataset(data_dir))

    return app


app = create_app()
