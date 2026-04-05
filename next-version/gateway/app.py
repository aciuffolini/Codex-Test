"""FastAPI application factory for the vNext gateway.

Initialises both the Twin event store (vNext core) and the RAG engine
(ChromaDB + SQLite + embeddings) so every endpoint has access to both.

Usage:
    python -m gateway.app          # starts on 0.0.0.0:8000
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load .env from the gateway directory (API keys, EMBEDDING_PROVIDER, etc.)
_env_file = Path(__file__).resolve().parent / ".env"
try:
    from dotenv import load_dotenv
    if _env_file.exists():
        load_dotenv(dotenv_path=_env_file, override=True)
        print(f"[Gateway] Loaded .env from {_env_file}")
    else:
        load_dotenv(override=True)
except ImportError:
    if _env_file.exists():
        with open(_env_file, "r", encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip().lstrip("\ufeff")] = v.strip().strip('"').strip("'")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from vnext_twin_core.sqlite_store import SqliteTwinStore
from vnext_api.capabilities import TwinCapabilities

from .rag_engine import RAGEngine
from .routes import (
    api_router,
    health_router,
    rag_router,
    sync_router,
    visits_router,
)
from .agent_routes import agent_router

DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
DEFAULT_DB = DATA_DIR / "gateway-events.db"


def create_app(db_path: Path | None = None) -> FastAPI:
    app = FastAPI(
        title="Farm Visit vNext Gateway",
        version="0.2.0",
        description=(
            "Unified gateway: Twin event store + RAG engine (ChromaDB, SQLite, "
            "embeddings) + LLM proxy (OpenAI / Anthropic)."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Twin event store
    store = SqliteTwinStore(db_path or DEFAULT_DB)
    app.state.caps = TwinCapabilities(store=store)
    app.state.active_visit_id = None
    app.state.last_retrieval_id = None

    # RAG engine (ChromaDB + SQLite + embeddings)
    app.state.rag = RAGEngine(DATA_DIR)

    # Static media serving
    media_dir = DATA_DIR / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")

    # Routers
    app.include_router(health_router)
    app.include_router(sync_router)
    app.include_router(rag_router)
    app.include_router(visits_router)
    app.include_router(api_router)
    app.include_router(agent_router)

    return app


if __name__ == "__main__":
    import uvicorn
    app = create_app()
    print(f"[Gateway] DB: {DEFAULT_DB}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
