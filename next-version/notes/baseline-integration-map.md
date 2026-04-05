# Baseline → vNext Capability Integration Map

> Phase 0 deliverable. Read-only reference from `7_farm_visit/`. No baseline files were modified.

---

## 1. HTTP Routes (Server: `7_farm_visit/server/rag_service/main.py`)

| # | Baseline Route | Method | Request Shape | Response Shape | vNext Capability | Notes |
|---|---|---|---|---|---|---|
| 1 | `/health` | GET | — | `{status, timestamp, text_embedding{…}, clip_embedding{…}, openai_key_set, chroma_dir, db_path}` | Health check (new gateway) | Includes embedding provider diagnostics |
| 2 | `/sync/visits/upsert` | POST | `VisitUpsert{id, createdAt, updatedAt, task_type, lat?, lon?, acc?, note?, photo_present, audio_present, photo_caption?, audio_transcript?, audio_summary?, aiStatus?, field_id?, crop?, issue?, severity?}` | `{status:"ok", id}` | `ingest_visit` + `sync_event` | Auto-generates text embedding after upsert |
| 3 | `/sync/media/upload` | POST | multipart: `file` + `visit_id` + `type` | `{uri, path}` | `upload_media` | Files saved to `DATA_DIR/media/{visit_id}/` |
| 4 | `/media/{visit_id}/{filename}` | GET | — | File bytes | Media serving | Static file serving |
| 5 | `/rag/upsert` | POST | `VisitUpsert` (same as #2) | `{status, id}` or `{status:"skipped"|"pending", reason}` | `retrieve_context` (indexing path) | Explicit embedding generation, separate from sync |
| 6 | `/rag/search` | POST | `SearchRequest{query, k=10, filters?{field_id?, created_at_min?}}` | `[{id, score, snippet, metadata}]` | `retrieve_context` (query path) | Vector search with metadata filtering |
| 7 | `/rag/embed-image` | POST | multipart: `file` + `visit_id` + `generate_embedding` | `{photo_id, visit_id, filename, …, embedding_generated, embedding_id?, embedding_dims?}` | `upload_media` (multimodal) | CLIP embedding → `farm_visits_images` collection |
| 8 | `/rag/search-images` | POST | `ImageSearchRequest{query, k=10, visit_id?}` | `{query, results[{embedding_id, photo_id, visit_id, filename, photo_uri, score, width, height}], total}` | `retrieve_context` (image query) | Cross-modal: text query → CLIP image search |
| 9 | `/visits/{visit_id}` | GET | — | Visit JSON (full record + `photo_uri?`, `audio_uri?`) | `get_entity_history` | SQLite lookup by id |
| 10 | `/photos/{visit_id}` | GET | — | `{visit_id, photos[{id, filename, …, has_embedding, uri}], total, with_embeddings}` | `get_entity_history` (media) | Photo metadata with embedding status |

---

## 2. Client-Side API Usage (`7_farm_visit/apps/web/src/lib/`)

| Client Module | Routes Called | Pattern |
|---|---|---|
| `api.ts` | `GET /api/health`, `POST /api/chat` (SSE streaming), `POST /api/visits`, `GET /api/visits` | SSE chat with `X-API-Key` + `X-Provider` headers; visit CRUD |
| `api-simple.ts` | `GET /health` (auto-detect), `POST {base}/chat` (SSE) | Simpler chat, auto-detects local vs production API base |

### Chat Request Shape (from client)
```json
{
  "messages": [{"role": "user|assistant", "content": "…"}],
  "meta": {
    "visit": {"gps": {"lat", "lon", "acc"}, "lastNote", "hasPhoto"},
    "intent": "structure|chat"
  }
}
```

### Chat Response (SSE)
```
data: {"choices":[{"delta":{"content":"token"}}]}
data: [DONE]
```

---

## 3. Environment Variables

| Variable | Default | Used By | vNext Mapping |
|---|---|---|---|
| `OPENAI_API_KEY` | — | Text embeddings (OpenAI) | Gateway config (`.env.template`) |
| `EMBEDDING_PROVIDER` | `auto` | Provider selection (`auto`\|`openai`\|`local`) | Gateway config |
| `DATA_DIR` | `./data` | SQLite, media, Chroma paths | Twin store path |
| `VITE_API_URL` | `/api` | Client-side API base | Gateway URL |

---

## 4. Storage Architecture

| Store | Baseline Location | Content | vNext Mapping |
|---|---|---|---|
| SQLite (`visits.db`) | `DATA_DIR/visits.db` | Visits table (20 cols), Photos table (16 cols) | `SqliteTwinStore` (Phase 1) |
| ChromaDB text | `DATA_DIR/chroma/` collection `farm_visits` | Text embeddings (cosine, auto-dim) | Retrieval pipeline (Phase 3) |
| ChromaDB images | `DATA_DIR/chroma/` collection `farm_visits_images` | CLIP image embeddings (512-dim cosine) | Multimodal retrieval (Phase 3) |
| Media files | `DATA_DIR/media/{visit_id}/` | Photos, audio | Media asset events |

---

## 5. Multimodal Pipeline Summary

```
Text path:   visit data → generate_embedding_text() → OpenAI/local embedder → ChromaDB text collection
Image path:  photo file → CLIP (clip-vit-base-patch32) → ChromaDB image collection  
Query path:  text query → text embedding → ChromaDB text search → ranked results
Cross-modal: text query → CLIP text encoder → ChromaDB image search → ranked image results
```

**Key insight for Phase 3**: The unified retrieval pipeline must support both text→text and text→image search paths, combining results into a single `retrieval_context` event with per-item provenance (modality, score, source collection).

---

## 6. Dependencies (from `requirements.txt`)

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | 0.104.1 | HTTP framework |
| `uvicorn` | 0.24.0 | ASGI server |
| `chromadb` | 0.4.18 | Vector store |
| `openai` | 1.3.7 | Text embeddings |
| `sentence-transformers` | 2.2.2 | Local text embeddings |
| `torch` | ≥2.0.0 | CLIP inference |
| `transformers` | ≥4.35.0 | CLIP model |
| `python-dotenv` | 1.0.0 | Env config |

---

## 7. Capability Mapping Summary

| vNext Capability | Baseline Source(s) | Phase |
|---|---|---|
| `ingest_visit` | `/sync/visits/upsert` + SQLite insert | 2 |
| `upload_media` | `/sync/media/upload` + `/rag/embed-image` | 2 |
| `sync_event` | Auto after upsert (status tracking) | 6 |
| `retrieve_context` | `/rag/search` + `/rag/search-images` (unified) | 3 |
| `ask_twin` | `/api/chat` (SSE, requires retrieval first) | 4 |
| `get_entity_history` | `/visits/{id}` + `/photos/{id}` | 2 |
| `generate_report` | Not in baseline (new capability) | 5 |
| `propose_next_action` | Not in baseline (new capability) | 5 |
