"""RAG Engine — ChromaDB + SQLite + Embedding infrastructure.

Absorbed from 7_farm_visit/server/rag_service/main.py into the vNext gateway
so the project is self-contained.  Dual-collection architecture: text
(sentence-transformers / OpenAI) and image (CLIP).
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings


# ---------------------------------------------------------------------------
# Embedding provider helpers
# ---------------------------------------------------------------------------

_local_embedder = None


def _get_local_embedder():
    """Return ChromaDB's built-in ONNX embedding function (all-MiniLM-L6-v2).

    This avoids the HuggingFace Hub dependency entirely — the ONNX model
    downloads from ChromaDB's own CDN and is cached at
    ``~/.cache/chroma/onnx_models/``.
    """
    global _local_embedder
    if _local_embedder is None:
        try:
            from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
            _local_embedder = DefaultEmbeddingFunction()
            # Warm up — first call triggers the download if not cached
            _local_embedder(["warm-up"])
            print("[RAG] Local embeddings ready (ChromaDB ONNX all-MiniLM-L6-v2)")
        except Exception as exc:
            print(f"[RAG] Failed to load local embedding model: {exc}")
            return None
    return _local_embedder


def _get_local_embedding(text: str) -> Optional[List[float]]:
    embedder = _get_local_embedder()
    if embedder is None:
        return None
    try:
        results = embedder([text])
        if results and len(results) > 0:
            emb = results[0]
            return emb.tolist() if hasattr(emb, "tolist") else list(emb)
        return None
    except Exception as exc:
        print(f"[RAG] Local embedding error: {exc}")
        return None


def generate_embedding_text(visit: Dict[str, Any]) -> str:
    """Build a single string from visit fields suitable for embedding.

    Includes all semantically relevant fields so that RAG search can find
    visits by location, crop, issue, notes, audio transcripts, etc.
    """
    parts: list[str] = []
    if visit.get("task_type"):
        parts.append(f"Task: {visit['task_type']}")
    if visit.get("field_id"):
        parts.append(f"Field: {visit['field_id']}")
    if visit.get("crop"):
        parts.append(f"Crop: {visit['crop']}")
    if visit.get("issue"):
        parts.append(f"Issue: {visit['issue']}")
    if visit.get("note"):
        parts.append(f"Notes: {visit['note']}")
    if visit.get("photo_caption"):
        parts.append(f"Photo: {visit['photo_caption']}")
    if visit.get("audio_transcript"):
        parts.append(f"Audio transcript: {visit['audio_transcript']}")
    if visit.get("audio_summary"):
        parts.append(f"Audio summary: {visit['audio_summary']}")
    if visit.get("severity") is not None:
        parts.append(f"Severity: {visit['severity']}/5")
    if visit.get("lat") is not None and visit.get("lon") is not None:
        parts.append(f"GPS: {visit['lat']:.6f}, {visit['lon']:.6f}")
    return ". ".join(parts)


# ---------------------------------------------------------------------------
# RAG Engine class
# ---------------------------------------------------------------------------

class RAGEngine:
    """Self-contained RAG backend: SQLite + ChromaDB + embeddings."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.media_dir = data_dir / "media"
        self.db_path = data_dir / "visits.db"
        self.chroma_dir = data_dir / "chroma"

        self.data_dir.mkdir(exist_ok=True)
        self.media_dir.mkdir(exist_ok=True, parents=True)
        self.chroma_dir.mkdir(exist_ok=True, parents=True)

        # Embedding provider
        self.openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
        provider_cfg = os.getenv("EMBEDDING_PROVIDER", "auto").lower()
        if provider_cfg == "auto":
            self.embedding_provider = "openai" if self.openai_api_key else "local"
        elif provider_cfg in ("openai", "local"):
            self.embedding_provider = provider_cfg
        else:
            self.embedding_provider = "local"

        # ChromaDB
        self.chroma_client = chromadb.PersistentClient(
            path=str(self.chroma_dir),
            settings=Settings(anonymized_telemetry=False),
        )
        self.text_collection = self.chroma_client.get_or_create_collection(
            name="farm_visits",
            metadata={"hnsw:space": "cosine", "embedding_type": "text"},
        )
        self.image_collection = self.chroma_client.get_or_create_collection(
            name="farm_visits_images",
            metadata={"hnsw:space": "cosine", "embedding_type": "clip", "dimensions": 512},
        )

        self._init_db()
        self._log_startup()

    # -- SQLite ---------------------------------------------------------------

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS visits (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                task_type TEXT NOT NULL,
                lat REAL, lon REAL, acc INTEGER,
                note TEXT,
                photo_present INTEGER DEFAULT 0,
                audio_present INTEGER DEFAULT 0,
                photo_caption TEXT,
                audio_transcript TEXT,
                audio_summary TEXT,
                ai_status TEXT,
                sync_status TEXT DEFAULT 'pending',
                synced_at INTEGER,
                field_id TEXT, crop TEXT, issue TEXT, severity INTEGER,
                data TEXT,
                created_at_db TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON visits(created_at)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_sync_status ON visits(sync_status)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_field_id ON visits(field_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_crop ON visits(crop)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_issue ON visits(issue)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_severity ON visits(severity)")
        c.execute("""
            CREATE TABLE IF NOT EXISTS photos (
                id TEXT PRIMARY KEY,
                visit_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                mime_type TEXT,
                width INTEGER, height INTEGER,
                embedding_id TEXT,
                embedding_model TEXT,
                embedding_dims INTEGER,
                embedding_generated_at INTEGER,
                exif_lat REAL, exif_lon REAL, exif_timestamp INTEGER,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (visit_id) REFERENCES visits(id)
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_photos_visit_id ON photos(visit_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_photos_embedding_id ON photos(embedding_id)")
        conn.commit()
        conn.close()

    # -- Embedding generation -------------------------------------------------

    def get_embedding(self, text: str) -> Optional[List[float]]:
        if not text or not text.strip():
            return None

        if self.embedding_provider == "openai":
            if not self.openai_api_key:
                print("[RAG] OpenAI provider selected but API key not set")
                return None
            try:
                import openai
                client = openai.OpenAI(api_key=self.openai_api_key)
                resp = client.embeddings.create(model="text-embedding-3-small", input=text)
                return resp.data[0].embedding
            except Exception as exc:
                print(f"[RAG] OpenAI embedding error: {exc}")
                if os.getenv("EMBEDDING_PROVIDER", "auto").lower() == "auto":
                    print("[RAG] Falling back to local embeddings")
                    return _get_local_embedding(text)
                return None

        return _get_local_embedding(text)

    # -- Visit CRUD -----------------------------------------------------------

    def upsert_visit(self, visit: Dict[str, Any]) -> str:
        """Insert/replace visit in SQLite and auto-embed into ChromaDB."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        data_json = json.dumps(visit)

        c.execute("""
            INSERT OR REPLACE INTO visits (
                id, created_at, updated_at, task_type, lat, lon, acc,
                note, photo_present, audio_present, photo_caption,
                audio_transcript, audio_summary, ai_status, sync_status,
                field_id, crop, issue, severity, data
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            visit["id"], visit["createdAt"], visit["updatedAt"],
            visit.get("task_type", "general"),
            visit.get("lat"), visit.get("lon"), visit.get("acc"),
            visit.get("note"),
            1 if visit.get("photo_present") else 0,
            1 if visit.get("audio_present") else 0,
            visit.get("photo_caption"), visit.get("audio_transcript"),
            visit.get("audio_summary"),
            json.dumps(visit.get("aiStatus")) if visit.get("aiStatus") else None,
            "synced",
            visit.get("field_id"), visit.get("crop"), visit.get("issue"),
            visit.get("severity"),
            data_json,
        ))
        conn.commit()
        conn.close()

        # Auto-embed
        self._auto_embed(visit)
        return visit["id"]

    def _auto_embed(self, visit: Dict[str, Any]):
        try:
            text = generate_embedding_text(visit)
            if not text:
                return
            emb = self.get_embedding(text)
            if emb is None:
                return
            metadata = {
                "id": visit["id"],
                "created_at": int(visit.get("createdAt", 0)),
                "task_type": visit.get("task_type", "") or "",
                "field_id": visit.get("field_id", "") or "",
                "crop": visit.get("crop", "") or "",
                "issue": visit.get("issue", "") or "",
                "note": visit.get("note", "") or "",
                "lat": float(visit["lat"]) if visit.get("lat") is not None else 0.0,
                "lon": float(visit["lon"]) if visit.get("lon") is not None else 0.0,
                "audio_transcript": visit.get("audio_transcript", "") or "",
                "photo_caption": visit.get("photo_caption", "") or "",
                "severity": int(visit["severity"]) if visit.get("severity") is not None else -1,
            }
            self.text_collection.upsert(
                ids=[visit["id"]], embeddings=[emb],
                documents=[text], metadatas=[metadata],
            )
            print(f"[RAG] Auto-embedded visit {visit['id']}")
        except Exception as exc:
            print(f"[RAG] Auto-embed failed: {exc}")

    def get_visit(self, visit_id: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT data FROM visits WHERE id = ?", (visit_id,))
        row = c.fetchone()
        conn.close()
        if not row:
            return None
        data = json.loads(row[0])
        if data.get("photo_present"):
            data["photo_uri"] = f"/media/{visit_id}/photo_*.jpg"
        if data.get("audio_present"):
            data["audio_uri"] = f"/media/{visit_id}/audio_*.webm"
        return data

    # -- Search ---------------------------------------------------------------

    def search(self, query: str, k: int = 10,
               filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        emb = self.get_embedding(query)
        if emb is None:
            return []

        where: Dict[str, Any] = {}
        if filters and "field_id" in filters:
            where["field_id"] = filters["field_id"]

        need_time_filter = bool(filters and "created_at_min" in filters)
        n = k * 2 if need_time_filter else k

        results = self.text_collection.query(
            query_embeddings=[emb], n_results=n,
            where=where if where else None,
            include=["documents", "metadatas", "distances"],
        )

        out: list[dict] = []
        if results["ids"] and results["ids"][0]:
            created_at_min = (filters or {}).get("created_at_min")
            for i, vid in enumerate(results["ids"][0]):
                meta = results["metadatas"][0][i]
                if created_at_min:
                    ts = meta.get("created_at", 0)
                    if isinstance(ts, str):
                        ts = int(ts)
                    if ts < created_at_min:
                        continue
                score = 1 - results["distances"][0][i]
                doc = results["documents"][0][i]
                out.append({
                    "id": vid,
                    "score": float(score),
                    "snippet": doc[:200] + "..." if len(doc) > 200 else doc,
                    "metadata": meta,
                })
        return out[:k]

    # -- Hybrid Query (structured + semantic) ---------------------------------

    def query_structured(
        self,
        field_id: Optional[str] = None,
        crop: Optional[str] = None,
        issue: Optional[str] = None,
        severity_min: Optional[int] = None,
        severity_max: Optional[int] = None,
        created_at_min: Optional[int] = None,
        created_at_max: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Direct SQL retrieval on indexed columns — deterministic, no embeddings."""
        clauses: list[str] = []
        params: list[Any] = []

        if field_id:
            clauses.append("field_id = ?")
            params.append(field_id)
        if crop:
            clauses.append("LOWER(crop) = LOWER(?)")
            params.append(crop)
        if issue:
            clauses.append("LOWER(issue) = LOWER(?)")
            params.append(issue)
        if severity_min is not None:
            clauses.append("severity >= ?")
            params.append(severity_min)
        if severity_max is not None:
            clauses.append("severity <= ?")
            params.append(severity_max)
        if created_at_min is not None:
            clauses.append("created_at >= ?")
            params.append(created_at_min)
        if created_at_max is not None:
            clauses.append("created_at <= ?")
            params.append(created_at_max)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"""
            SELECT id, created_at, task_type, field_id, crop, issue,
                   severity, lat, lon, note, photo_caption,
                   audio_transcript, audio_summary, data
            FROM visits
            {where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, params).fetchall()
        conn.close()

        results: list[dict] = []
        for r in rows:
            snippet_parts = []
            if r["crop"]:
                snippet_parts.append(f"Crop: {r['crop']}")
            if r["issue"]:
                snippet_parts.append(f"Issue: {r['issue']}")
            if r["note"]:
                snippet_parts.append(r["note"][:120])
            snippet = ". ".join(snippet_parts) or r["task_type"] or "visit"

            results.append({
                "id": r["id"],
                "score": 1.0,  # exact match
                "snippet": snippet,
                "source": "sql",
                "metadata": {
                    "id": r["id"],
                    "created_at": r["created_at"],
                    "task_type": r["task_type"] or "",
                    "field_id": r["field_id"] or "",
                    "crop": r["crop"] or "",
                    "issue": r["issue"] or "",
                    "severity": r["severity"] if r["severity"] is not None else -1,
                    "lat": r["lat"] or 0.0,
                    "lon": r["lon"] or 0.0,
                    "note": r["note"] or "",
                    "audio_transcript": r["audio_transcript"] or "",
                    "photo_caption": r["photo_caption"] or "",
                },
            })
        return results

    def query_hybrid(
        self,
        semantic_query: Optional[str] = None,
        field_id: Optional[str] = None,
        crop: Optional[str] = None,
        issue: Optional[str] = None,
        severity_min: Optional[int] = None,
        severity_max: Optional[int] = None,
        created_at_min: Optional[int] = None,
        created_at_max: Optional[int] = None,
        k: int = 10,
    ) -> Dict[str, Any]:
        """Route to SQL, vector, or both depending on which params are set.

        Returns ``{"results": [...], "strategy": "sql"|"semantic"|"hybrid"}``.
        """
        has_filters = any(v is not None for v in [
            field_id, crop, issue, severity_min, severity_max,
            created_at_min, created_at_max,
        ])
        has_semantic = bool(semantic_query and semantic_query.strip())

        if has_filters and not has_semantic:
            rows = self.query_structured(
                field_id=field_id, crop=crop, issue=issue,
                severity_min=severity_min, severity_max=severity_max,
                created_at_min=created_at_min, created_at_max=created_at_max,
                limit=k,
            )
            return {"results": rows, "strategy": "sql"}

        if has_semantic and not has_filters:
            rows = self.search(semantic_query, k)
            for r in rows:
                r["source"] = "semantic"
            return {"results": rows, "strategy": "semantic"}

        # Both: SQL first for deterministic results, then semantic to fill gaps
        sql_rows = self.query_structured(
            field_id=field_id, crop=crop, issue=issue,
            severity_min=severity_min, severity_max=severity_max,
            created_at_min=created_at_min, created_at_max=created_at_max,
            limit=k,
        )
        seen_ids = {r["id"] for r in sql_rows}

        sem_filters: Dict[str, Any] = {}
        if field_id:
            sem_filters["field_id"] = field_id
        if created_at_min is not None:
            sem_filters["created_at_min"] = created_at_min
        sem_rows = self.search(semantic_query, k, sem_filters if sem_filters else None)

        for r in sem_rows:
            if r["id"] not in seen_ids:
                r["source"] = "semantic"
                sql_rows.append(r)
                seen_ids.add(r["id"])
            if len(sql_rows) >= k:
                break

        return {"results": sql_rows[:k], "strategy": "hybrid"}

    def query_count(
        self,
        field_id: Optional[str] = None,
        crop: Optional[str] = None,
        issue: Optional[str] = None,
        created_at_min: Optional[int] = None,
        created_at_max: Optional[int] = None,
    ) -> int:
        """Count matching rows for pagination awareness."""
        clauses: list[str] = []
        params: list[Any] = []

        if field_id:
            clauses.append("field_id = ?")
            params.append(field_id)
        if crop:
            clauses.append("LOWER(crop) = LOWER(?)")
            params.append(crop)
        if issue:
            clauses.append("LOWER(issue) = LOWER(?)")
            params.append(issue)
        if created_at_min is not None:
            clauses.append("created_at >= ?")
            params.append(created_at_min)
        if created_at_max is not None:
            clauses.append("created_at <= ?")
            params.append(created_at_max)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"SELECT COUNT(*) FROM visits {where}"

        conn = sqlite3.connect(self.db_path)
        count = conn.execute(sql, params).fetchone()[0]
        conn.close()
        return count

    # -- Photos / CLIP --------------------------------------------------------

    def get_photos(self, visit_id: str) -> Dict[str, Any]:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
            SELECT id, filename, file_path, file_size, width, height,
                   embedding_id, embedding_model, embedding_dims,
                   exif_lat, exif_lon, created_at
            FROM photos WHERE visit_id = ?
            ORDER BY created_at DESC
        """, (visit_id,))
        rows = c.fetchall()
        conn.close()

        photos = []
        for r in rows:
            photos.append({
                "id": r[0], "filename": r[1], "file_path": r[2],
                "file_size": r[3], "width": r[4], "height": r[5],
                "has_embedding": r[6] is not None,
                "embedding_id": r[6], "embedding_model": r[7],
                "embedding_dims": r[8],
                "exif_lat": r[9], "exif_lon": r[10], "created_at": r[11],
                "uri": f"/media/{visit_id}/{r[1]}",
            })
        return {
            "visit_id": visit_id,
            "photos": photos,
            "total": len(photos),
            "with_embeddings": sum(1 for p in photos if p["has_embedding"]),
        }

    def store_photo_record(self, photo_id: str, visit_id: str,
                           filename: str, file_path: str, file_size: int,
                           content_type: str | None,
                           result: Dict[str, Any],
                           embedding_id: str | None):
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            now_ms = int(datetime.now().timestamp() * 1000)
            c.execute("""
                INSERT INTO photos (
                    id, visit_id, filename, file_path, file_size, mime_type,
                    width, height, embedding_id, embedding_model, embedding_dims,
                    embedding_generated_at, exif_lat, exif_lon, exif_timestamp, created_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                photo_id, visit_id, filename, file_path, file_size,
                content_type,
                result.get("width"), result.get("height"),
                embedding_id,
                "clip-vit-base-patch32" if embedding_id else None,
                result.get("embedding_dims"),
                now_ms if embedding_id else None,
                result.get("exif_lat"), result.get("exif_lon"),
                result.get("exif_timestamp"), now_ms,
            ))
            conn.commit()
            conn.close()
        except Exception as exc:
            print(f"[RAG] Failed to store photo metadata: {exc}")

    # -- Health ---------------------------------------------------------------

    def health(self) -> Dict[str, Any]:
        text_ok = False
        if self.embedding_provider == "openai":
            text_ok = bool(self.openai_api_key)
        else:
            text_ok = _get_local_embedder() is not None

        clip_status: dict = {"available": False, "device": None, "model": None}
        try:
            from .embeddings.clip_embedder import check_clip_availability
            clip_status = check_clip_availability()
        except Exception as exc:
            clip_status["error"] = str(exc)

        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "text_embedding": {
                "provider_active": self.embedding_provider,
                "available": text_ok,
                "collection_count": self.text_collection.count(),
            },
            "clip_embedding": {
                "available": clip_status.get("available", False),
                "device": clip_status.get("device"),
                "model": clip_status.get("model_name"),
                "collection_count": self.image_collection.count(),
                "error": clip_status.get("error"),
            },
            "openai_key_set": bool(self.openai_api_key),
            "db_path": str(self.db_path.resolve()),
            "chroma_dir": str(self.chroma_dir.resolve()),
        }

    # -- Startup log ----------------------------------------------------------

    def _log_startup(self):
        key = self.openai_api_key
        redacted = "not set" if not key else (
            f"{key[:4]}...{key[-4:]}" if len(key) > 8 else "***"
        )
        print("=" * 60)
        print("[RAG] Engine Startup")
        print(f"  Provider: {self.embedding_provider}")
        print(f"  OPENAI_API_KEY: {redacted}")
        print(f"  DATA_DIR: {self.data_dir.resolve()}")
        print(f"  Text vectors: {self.text_collection.count()}")
        print(f"  Image vectors: {self.image_collection.count()}")
        print("=" * 60)
