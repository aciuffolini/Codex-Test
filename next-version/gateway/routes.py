"""Gateway route handlers — real RAG + LLM implementations.

Replaces the earlier stubs with:
  • /rag/search        → ChromaDB semantic search
  • /rag/upsert        → real embedding + ChromaDB upsert
  • /rag/embed-image   → CLIP embedding
  • /rag/search-images → cross-modal CLIP search
  • /sync/visits/upsert → SQLite + auto-embed
  • /sync/media/upload  → file storage
  • /api/chat           → OpenAI / Anthropic streaming proxy
  • /photos/{visit_id}  → photo listing

Twin event emission is preserved alongside real RAG operations.
"""
from __future__ import annotations

import json
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from vnext_api.capabilities import TwinCapabilities
from vnext_twin_core.models import ContractError

from .llm_proxy import stream_chat
from .rag_engine import RAGEngine
from .schemas import (
    ActionRequest,
    ChatRequest,
    FarmCreateRequest,
    FarmDefinition,
    HybridQueryRequest,
    SearchRequest,
    VisitSaveRequest,
    VisitUpsertRequest,
)


# ---- Helpers ---------------------------------------------------------------

def _caps(r: Request) -> TwinCapabilities:
    c = getattr(r.app.state, "caps", None)
    if c is None:
        raise RuntimeError("Gateway not initialised — app.state.caps not set")
    return c


def _rag(r: Request) -> RAGEngine:
    engine = getattr(r.app.state, "rag", None)
    if engine is None:
        raise RuntimeError("RAG engine not initialised — app.state.rag not set")
    return engine


def _visit_id(r: Request) -> str | None:
    return getattr(r.app.state, "active_visit_id", None)


def _set_visit_id(r: Request, vid: str):
    r.app.state.active_visit_id = vid


def _retrieval_id(r: Request) -> str | None:
    return getattr(r.app.state, "last_retrieval_id", None)


def _set_retrieval_id(r: Request, rid: str):
    r.app.state.last_retrieval_id = rid


# ---- Routers ---------------------------------------------------------------

health_router = APIRouter(tags=["health"])
sync_router = APIRouter(prefix="/sync", tags=["sync"])
rag_router = APIRouter(prefix="/rag", tags=["rag"])
visits_router = APIRouter(tags=["visits"])
api_router = APIRouter(prefix="/api", tags=["api"])


# ---- Health ----------------------------------------------------------------

def _build_health(r: Request) -> dict:
    caps = _caps(r)
    rag = _rag(r)
    rag_health = rag.health()
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "store_backend": "sqlite",
        "event_count": len(caps.twin.store.list_events()),
        "twin_capabilities": [
            "ingest_visit", "upload_media", "sync_event",
            "retrieve_context", "ask_twin", "get_entity_history",
            "generate_report", "propose_next_action",
        ],
        "rag": rag_health,
    }


@health_router.get("/health")
async def health(request: Request):
    return _build_health(request)


@api_router.get("/health")
async def api_health(request: Request):
    return _build_health(request)


# ---- Farms -----------------------------------------------------------------

@api_router.post("/farms")
async def create_farm(request: Request, farm: FarmCreateRequest):
    caps = _caps(request)
    farm_id = str(uuid.uuid4())
    caps.create_farm(farm_id, farm.name, farm.kmz_data)
    return {"status": "ok", "farm_id": farm_id}


@api_router.get("/farms", response_model=list[FarmDefinition])
async def list_farms(request: Request):
    return _caps(request).list_farms()


# ---- Sync (real RAG + Twin events) ----------------------------------------

@sync_router.post("/visits/upsert")
async def upsert_visit(visit: VisitUpsertRequest, request: Request):
    """Upsert into SQLite + ChromaDB (real RAG) and emit Twin events."""
    caps = _caps(request)
    rag = _rag(request)

    # 1. Real RAG upsert
    rag.upsert_visit(visit.model_dump())

    # 2. Twin event emission
    try:
        visit_id = caps.ingest_visit()
        _set_visit_id(request, visit_id)

        parts = []
        if visit.note:
            parts.append(visit.note)
        if visit.crop:
            parts.append(f"Crop: {visit.crop}")
        if visit.issue:
            parts.append(f"Issue: {visit.issue}")
        observation = ". ".join(parts) or "field observation"

        caps.twin.capture(
            visit_id, observation,
            f"baseline://visit-{visit.id}",
            visit.lat or 0.0, visit.lon or 0.0,
        )
        caps.sync_event(visit_id, online=True)
    except ContractError as exc:
        print(f"[Gateway] Twin event emission warning: {exc}")

    return {"status": "ok", "id": visit.id}


@sync_router.post("/media/upload")
async def upload_media(
    request: Request,
    visit_id: str = Form(...),
    file: UploadFile = File(...),
    type: str = Form("photo"),
):
    """Store media file on disk, emit Twin media_asset event."""
    rag = _rag(request)

    visit_dir = rag.media_dir / visit_id
    visit_dir.mkdir(exist_ok=True, parents=True)

    file_path = visit_dir / f"{type}_{file.filename}"
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    uri = f"/media/{visit_id}/{type}_{file.filename}"

    # Twin event (best-effort)
    try:
        caps = _caps(request)
        active = _visit_id(request)
        if active:
            caps.twin.upload_media(active, type, uri)
    except Exception:
        pass

    return {"uri": uri, "path": str(file_path)}


# ---- RAG (real ChromaDB) --------------------------------------------------

@rag_router.post("/upsert")
async def upsert_rag(visit: VisitUpsertRequest, request: Request):
    """Generate embedding and upsert into ChromaDB."""
    rag = _rag(request)
    from .rag_engine import generate_embedding_text
    visit_dict = visit.model_dump()
    text = generate_embedding_text(visit_dict)
    if not text:
        return {"status": "skipped", "reason": "No embedding text generated"}

    emb = rag.get_embedding(text)
    if not emb:
        return {"status": "pending", "reason": "Embedding provider unavailable"}

    metadata = {
        "id": visit.id,
        "created_at": int(visit.createdAt),
        "task_type": visit.task_type,
        "field_id": visit.field_id or "",
        "crop": visit.crop or "",
        "issue": visit.issue or "",
        "note": visit.note or "",
    }
    rag.text_collection.upsert(
        ids=[visit.id], embeddings=[emb],
        documents=[text], metadatas=[metadata],
    )
    return {"status": "ok", "id": visit.id}


@rag_router.post("/search")
async def search_visits(search_req: SearchRequest, request: Request):
    """Semantic search via ChromaDB embeddings."""
    rag = _rag(request)
    results = rag.search(search_req.query, search_req.k, search_req.filters)
    if not results and rag.text_collection.count() == 0:
        return []
    return results


@rag_router.post("/query")
async def hybrid_query(req: HybridQueryRequest, request: Request):
    """Hybrid retrieval: SQL for structured filters, vector for semantic, or both.

    Returns ``{"results": [...], "strategy": "sql"|"semantic"|"hybrid", "total": N}``.
    """
    rag = _rag(request)
    result = rag.query_hybrid(
        semantic_query=req.query,
        field_id=req.field_id,
        crop=req.crop,
        issue=req.issue,
        severity_min=req.severity_min,
        severity_max=req.severity_max,
        created_at_min=req.created_at_min,
        created_at_max=req.created_at_max,
        k=req.k,
    )
    result["total"] = rag.query_count(
        field_id=req.field_id,
        crop=req.crop,
        issue=req.issue,
        created_at_min=req.created_at_min,
        created_at_max=req.created_at_max,
    )
    return result


@rag_router.post("/embed-image")
async def embed_image(
    request: Request,
    file: UploadFile = File(...),
    visit_id: str = Form(...),
    generate_embedding: bool = Form(True),
):
    """Upload image and generate CLIP embedding."""
    rag = _rag(request)

    photo_id = str(uuid.uuid4())
    visit_dir = rag.media_dir / visit_id
    visit_dir.mkdir(exist_ok=True, parents=True)

    filename = f"photo_{photo_id}_{file.filename}"
    file_path = visit_dir / filename
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    result: dict[str, Any] = {
        "photo_id": photo_id, "visit_id": visit_id,
        "filename": filename, "file_path": str(file_path),
        "file_size": len(content), "embedding_generated": False,
    }

    # Metadata extraction
    try:
        from .embeddings.clip_embedder import get_image_metadata
        result.update(get_image_metadata(str(file_path)))
    except Exception:
        pass

    embedding_id = None
    if generate_embedding:
        try:
            from .embeddings.clip_embedder import get_image_embedding, _get_device
            emb = get_image_embedding(str(file_path))
            if emb:
                embedding_id = f"img_{photo_id}"
                rag.image_collection.upsert(
                    ids=[embedding_id], embeddings=[emb],
                    documents=[f"Photo from visit {visit_id}: {file.filename}"],
                    metadatas=[{
                        "photo_id": photo_id, "visit_id": visit_id,
                        "filename": filename,
                        "width": result.get("width"),
                        "height": result.get("height"),
                        "created_at": int(datetime.now().timestamp() * 1000),
                    }],
                )
                result.update({
                    "embedding_generated": True,
                    "embedding_id": embedding_id,
                    "embedding_dims": len(emb),
                    "embedding_model": "clip-vit-base-patch32",
                    "embedding_device": _get_device(),
                })
        except Exception as exc:
            result["embedding_error"] = str(exc)

    rag.store_photo_record(
        photo_id, visit_id, filename, str(file_path),
        len(content), file.content_type, result, embedding_id,
    )
    return result


@rag_router.post("/search-images")
async def search_images(request: Request, query: str = Form(...), k: int = Form(10),
                        visit_id: Optional[str] = Form(None)):
    """Cross-modal text→image search via CLIP."""
    rag = _rag(request)
    try:
        from .embeddings.clip_embedder import get_text_embedding_clip
        emb = get_text_embedding_clip(query)
        if not emb:
            raise HTTPException(503, "CLIP unavailable")

        where = {"visit_id": visit_id} if visit_id else None
        results = rag.image_collection.query(
            query_embeddings=[emb], n_results=k,
            where=where, include=["documents", "metadatas", "distances"],
        )

        out = []
        if results["ids"] and results["ids"][0]:
            for i, img_id in enumerate(results["ids"][0]):
                meta = results["metadatas"][0][i]
                score = 1 - results["distances"][0][i]
                out.append({
                    "embedding_id": img_id,
                    "photo_id": meta.get("photo_id"),
                    "visit_id": meta.get("visit_id"),
                    "filename": meta.get("filename"),
                    "photo_uri": f"/media/{meta.get('visit_id')}/{meta.get('filename')}",
                    "score": float(score),
                })
        return {"query": query, "results": out, "total": len(out)}
    except ImportError:
        raise HTTPException(503, "CLIP module not available")


# ---- Visits ----------------------------------------------------------------

@visits_router.get("/visits/{visit_id}")
async def get_visit(visit_id: str, request: Request):
    """Full visit record from RAG SQLite (with Twin event fallback)."""
    rag = _rag(request)
    data = rag.get_visit(visit_id)
    if data:
        return data
    # Fallback to Twin events
    caps = _caps(request)
    events = caps.get_entity_history(visit_id)
    if not events:
        raise HTTPException(404, "Visit not found")
    return {"visit_id": visit_id, "events": events, "event_count": len(events)}


@visits_router.get("/photos/{visit_id}")
async def get_photos(visit_id: str, request: Request):
    """Photo listing with embedding status."""
    return _rag(request).get_photos(visit_id)


@visits_router.get("/media/{visit_id}/{filename}")
async def get_media(visit_id: str, filename: str, request: Request):
    rag = _rag(request)
    fp = rag.media_dir / visit_id / filename
    if not fp.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(fp)


# ---- API: Chat (real LLM streaming proxy) ----------------------------------

@api_router.post("/chat")
async def chat(chat_req: ChatRequest, request: Request):
    """Stream chat completions from OpenAI or Anthropic.

    The user's API key travels in the ``X-API-Key`` header; the provider
    in ``X-Provider``.  Llama local is handled entirely client-side (WebLLM)
    and never hits this endpoint.
    """
    api_key = request.headers.get("x-api-key", "")
    provider = request.headers.get("x-provider", "openai")
    model = request.headers.get("x-model")

    if not api_key:
        raise HTTPException(
            401,
            f"API key required. Set X-API-Key header with your "
            f"{'Anthropic' if provider == 'claude-code' else 'OpenAI'} API key.",
        )

    return StreamingResponse(
        stream_chat(chat_req.messages, api_key, provider, model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---- API: State / Visits / Action (preserved) -----------------------------

@api_router.get("/state")
async def get_state(request: Request):
    caps = _caps(request)
    return {
        "state": {
            "event_count": len(caps.twin.store.list_events()),
            "active_visit_id": _visit_id(request),
            "has_retrieval": _retrieval_id(request) is not None,
        }
    }


@api_router.post("/visits")
async def save_visit(visit: VisitSaveRequest, request: Request):
    caps = _caps(request)
    rag = _rag(request)

    # Real RAG upsert
    rag.upsert_visit({
        "id": visit.id,
        "createdAt": visit.ts,
        "updatedAt": visit.ts,
        "task_type": "general",
        "lat": visit.lat, "lon": visit.lon, "acc": visit.acc,
        "note": visit.note,
        "photo_present": visit.photo_present,
        "field_id": visit.field_id,
        "crop": visit.crop, "issue": visit.issue, "severity": visit.severity,
    })

    # Twin events
    try:
        visit_id = caps.ingest_visit()
        _set_visit_id(request, visit_id)
        parts = []
        if visit.note:
            parts.append(visit.note)
        if visit.crop:
            parts.append(f"Crop: {visit.crop}")
        if visit.issue:
            parts.append(f"Issue: {visit.issue}")
        observation = ". ".join(parts) or "field observation"
        caps.twin.capture(visit_id, observation, f"baseline://visit-{visit.id}",
                          visit.lat or 0.0, visit.lon or 0.0)
        caps.sync_event(visit_id, online=True)
    except ContractError as exc:
        print(f"[Gateway] Twin event warning: {exc}")

    return {"success": True, "id": visit.id}


@api_router.get("/visits")
async def list_visits(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    caps = _caps(request)
    all_events = caps.twin.store.list_events()

    visit_ids: list[str] = []
    seen: set[str] = set()
    for e in reversed(all_events):
        if e["event_type"] == "visit_event" and e["visit_id"] not in seen:
            seen.add(e["visit_id"])
            visit_ids.append(e["visit_id"])

    total = len(visit_ids)
    page = visit_ids[offset: offset + limit]

    visits = []
    for vid in page:
        v_events = [e for e in all_events if e["visit_id"] == vid]
        obs = next(
            (e["payload"].get("text", "") for e in v_events if e["event_type"] == "observation"),
            "",
        )
        loc = next(
            (e["payload"] for e in v_events if e["event_type"] == "location_context"),
            {},
        )
        visits.append({
            "id": vid, "ts": v_events[0]["ts"] if v_events else "",
            "note": obs,
            "lat": loc.get("lat"), "lon": loc.get("lon"),
            "photo_present": any(e["event_type"] == "media_asset" for e in v_events),
        })
    return {"visits": visits, "total": total, "hasMore": offset + limit < total}


@api_router.post("/action")
async def action(action_req: ActionRequest, request: Request):
    caps = _caps(request)
    try:
        if action_req.action == "start_visit":
            vid = caps.ingest_visit()
            _set_visit_id(request, vid)
            return {"ok": True, "visit_id": vid}

        active = _visit_id(request)
        if not active:
            return {"ok": False, "error": "No active visit"}

        if action_req.action == "capture":
            caps.twin.capture(active, action_req.observation or "observation",
                              "local://gateway-photo.jpg", 0.0, 0.0)
            return {"ok": True}

        if action_req.action == "review_correct":
            caps.twin.review_and_correct(active, action_req.corrected_observation or "")
            return {"ok": True}

        if action_req.action == "save_local":
            caps.twin.save_local(active)
            return {"ok": True}

        if action_req.action == "sync":
            event = caps.sync_event(active, online=action_req.online if action_req.online is not None else True)
            return {"ok": True, "sync_status": event.payload["status"]}

        if action_req.action == "retrieve":
            retrieval = caps.retrieve_context(active, action_req.question or "")
            _set_retrieval_id(request, retrieval.event_id)
            return {"ok": True, "retrieval_id": retrieval.event_id}

        if action_req.action == "ask":
            last = _retrieval_id(request)
            if not last:
                return {"ok": False, "error": "retrieval_context required before reasoning"}
            rec = caps.ask_twin(active, last, action_req.question or "")
            return {"ok": True, "recommendation": rec.payload["recommendation"]}

        if action_req.action == "decide":
            caps.twin.decide(active, action_req.decision or "accepted")
            return {"ok": True}

        return {"ok": False, "error": f"unknown action: {action_req.action}"}
    except ContractError as exc:
        return {"ok": False, "error": str(exc)}
