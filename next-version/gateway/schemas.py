"""Pydantic schemas matching baseline request/response shapes.

These preserve wire-compatibility with the baseline web client
so that pointing the client at this gateway requires zero client changes.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ---- Request models (baseline shapes) -------------------------------------

class FarmCreateRequest(BaseModel):
    name: str
    kmz_data: Optional[str] = None

class FarmDefinition(FarmCreateRequest):
    farm_id: str
    created_at: str

class VisitUpsertRequest(BaseModel):
    """Matches baseline VisitUpsert from 7_farm_visit/server/rag_service/main.py."""
    id: str
    createdAt: int
    updatedAt: int
    task_type: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    acc: Optional[int] = None
    note: Optional[str] = None
    photo_present: bool = False
    audio_present: bool = False
    photo_caption: Optional[str] = None
    audio_transcript: Optional[str] = None
    audio_summary: Optional[str] = None
    aiStatus: Optional[Dict[str, Any]] = None
    field_id: Optional[str] = None
    crop: Optional[str] = None
    issue: Optional[str] = None
    severity: Optional[int] = None


class SearchRequest(BaseModel):
    """Matches baseline SearchRequest."""
    query: str
    k: int = 10
    filters: Optional[Dict[str, Any]] = None


class HybridQueryRequest(BaseModel):
    """Hybrid retrieval: structured SQL filters + optional semantic search."""
    query: Optional[str] = None
    field_id: Optional[str] = None
    crop: Optional[str] = None
    issue: Optional[str] = None
    severity_min: Optional[int] = None
    severity_max: Optional[int] = None
    created_at_min: Optional[int] = None
    created_at_max: Optional[int] = None
    k: int = 10


class ChatRequest(BaseModel):
    """Matches baseline chat request from web client api.ts."""
    messages: List[Dict[str, Any]]
    meta: Optional[Dict[str, Any]] = None


class ActionRequest(BaseModel):
    """Matches baseline /api/action request from react_api.py."""
    action: str
    observation: Optional[str] = None
    corrected_observation: Optional[str] = None
    question: Optional[str] = None
    decision: Optional[str] = None
    online: Optional[bool] = None


class VisitSaveRequest(BaseModel):
    """Matches frontend Visit type from @farm-visit/shared."""
    id: str
    ts: int
    field_id: Optional[str] = None
    crop: Optional[str] = None
    issue: Optional[str] = None
    severity: Optional[int] = None
    note: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    acc: Optional[int] = None
    photo_present: bool = False


# ---- Response models (baseline shapes) ------------------------------------

class SearchResult(BaseModel):
    id: str
    score: float
    snippet: str
    metadata: Dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    store_backend: str
    event_count: int
    twin_capabilities: List[str]
