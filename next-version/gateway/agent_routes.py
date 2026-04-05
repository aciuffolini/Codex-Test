"""Agent capability HTTP routes — exposes 8 Twin capabilities as REST API.

Auth placeholder: X-API-Key header checked but not validated yet.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Any, Optional

from vnext_twin_core.models import ContractError


agent_router = APIRouter(prefix="/agent/v1", tags=["agent"])


# ---- Request/Response schemas ----------------------------------------------

class IngestRequest(BaseModel):
    pass  # No body needed


class CaptureRequest(BaseModel):
    observation: str
    media_uri: str = "local://photo.jpg"
    lat: float = 0.0
    lon: float = 0.0


class RetrieveRequest(BaseModel):
    question: str


class AskRequest(BaseModel):
    retrieval_id: str
    question: str


class SyncRequest(BaseModel):
    online: bool = True


class DecideRequest(BaseModel):
    decision: str = "accepted"


# ---- Routes ----------------------------------------------------------------

@agent_router.get("/capabilities")
async def list_capabilities():
    """List all available Twin capabilities."""
    return {
        "capabilities": [
            {"name": "ingest_visit", "method": "POST", "path": "/agent/v1/visit/start"},
            {"name": "capture", "method": "POST", "path": "/agent/v1/visit/{visit_id}/capture"},
            {"name": "review_correct", "method": "POST", "path": "/agent/v1/visit/{visit_id}/review"},
            {"name": "save_local", "method": "POST", "path": "/agent/v1/visit/{visit_id}/save"},
            {"name": "sync_event", "method": "POST", "path": "/agent/v1/visit/{visit_id}/sync"},
            {"name": "retrieve_context", "method": "POST", "path": "/agent/v1/visit/{visit_id}/retrieve"},
            {"name": "ask_twin", "method": "POST", "path": "/agent/v1/visit/{visit_id}/ask"},
            {"name": "decide", "method": "POST", "path": "/agent/v1/visit/{visit_id}/decide"},
        ],
        "version": "1.0.0",
        "auth": "X-API-Key header (placeholder)",
    }


def _get_caps(request: Request):
    caps = getattr(request.app.state, "caps", None)
    if caps is None:
        raise HTTPException(500, "Agent API not initialized")
    return caps


@agent_router.post("/visit/start")
async def start_visit(
    request: Request,
    x_api_key: Optional[str] = Header(None),
):
    """Start a new visit. Returns visit_id."""
    caps = _get_caps(request)
    visit_id = caps.ingest_visit()
    return {"visit_id": visit_id}


@agent_router.post("/visit/{visit_id}/capture")
async def capture(visit_id: str, body: CaptureRequest, request: Request):
    caps = _get_caps(request)
    try:
        caps.twin.capture(visit_id, body.observation, body.media_uri, body.lat, body.lon)
        return {"ok": True}
    except ContractError as e:
        raise HTTPException(422, str(e))


@agent_router.post("/visit/{visit_id}/review")
async def review(visit_id: str, request: Request, corrected: str = ""):
    caps = _get_caps(request)
    try:
        caps.twin.review_and_correct(visit_id, corrected)
        return {"ok": True}
    except ContractError as e:
        raise HTTPException(422, str(e))


@agent_router.post("/visit/{visit_id}/save")
async def save(visit_id: str, request: Request):
    caps = _get_caps(request)
    try:
        caps.twin.save_local(visit_id)
        return {"ok": True}
    except ContractError as e:
        raise HTTPException(422, str(e))


@agent_router.post("/visit/{visit_id}/sync")
async def sync(visit_id: str, body: SyncRequest, request: Request):
    caps = _get_caps(request)
    try:
        event = caps.sync_event(visit_id, online=body.online)
        return {"ok": True, "sync_status": event.payload["status"]}
    except ContractError as e:
        raise HTTPException(422, str(e))


@agent_router.post("/visit/{visit_id}/retrieve")
async def retrieve(visit_id: str, body: RetrieveRequest, request: Request):
    caps = _get_caps(request)
    try:
        retrieval = caps.retrieve_context(visit_id, body.question)
        return {
            "retrieval_id": retrieval.event_id,
            "item_count": retrieval.payload.get("item_count", 0),
            "max_score": retrieval.payload.get("max_score", 0.0),
            "low_confidence": retrieval.payload.get("low_confidence_warning", False),
        }
    except ContractError as e:
        raise HTTPException(422, str(e))


@agent_router.post("/visit/{visit_id}/ask")
async def ask(visit_id: str, body: AskRequest, request: Request):
    caps = _get_caps(request)
    try:
        rec = caps.ask_twin(visit_id, body.retrieval_id, body.question)
        return {
            "recommendation": rec.payload["recommendation"],
            "confidence": rec.payload.get("confidence", 0.0),
            "mode": rec.payload.get("mode", "unknown"),
            "grounded_by": rec.payload.get("grounded_by"),
        }
    except ContractError as e:
        raise HTTPException(422, str(e))


@agent_router.post("/visit/{visit_id}/decide")
async def decide(visit_id: str, body: DecideRequest, request: Request):
    caps = _get_caps(request)
    try:
        caps.twin.decide(visit_id, body.decision)
        return {"ok": True}
    except ContractError as e:
        raise HTTPException(422, str(e))
