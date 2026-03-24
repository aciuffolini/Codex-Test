# NEXT_VERSION_ARCHITECTURE

## Executive summary
The next version should be built as an **Agentic Digital Twin** with two interfaces over one shared core:
1. Human-facing operational cockpit
2. Agent-facing capability APIs

The Twin core (memory + retrieval context + audit history) is the product center. Reasoning models are optional synthesis layers after retrieval, never the system of record.

## Present-state interpretation of baseline repo
From baseline inspection, the system already contains the key primitives but with drift:
- Working web shell and capture flow.
- Local persistence and queue/outbox mechanisms.
- FastAPI RAG backend with sync/media/retrieval endpoints.
- Capacitor Android bridge and CI scripts.

Contradictions and drift to resolve:
- Documentation claims backend gaps while backend code exists.
- Multiple parallel sync/API paths coexist.
- README claims exceed visible implementation in some integrations.

## Future-state architecture

### 1) Human UI (operational cockpit)
Purpose: field operations, correction, decision support.

Responsibilities:
- Capture/review/correct/save/sync/ask/decide loop.
- Explicit state visibility (local saved, queued, synced, retrieval-ready, recommendation-issued).
- Minimal cognitive load and clear recovery actions.

### 2) Agent-facing APIs (first-class interface)
Purpose: machine-usable access to the same Twin core.

Responsibilities:
- Capability endpoints (`ingest_visit`, `retrieve_context`, `ask_twin`, etc.).
- Stable schemas and explicit side effects.
- Shared governance rules with UI flows.

### 3) Twin core (shared operational memory)
Purpose: single source of operational truth.

Responsibilities:
- Event history (visits, corrections, recommendations, reports).
- Media and structured records.
- Embeddings, retrieval traces, sync history, audit log.

### 4) Sync and ingestion layer
Purpose: deterministic local-first write path + robust eventual sync.

Responsibilities:
- Single canonical outbox/queue engine.
- Idempotent sync events and conflict resolution policy.
- Explicit failure states and retry semantics.

### 5) Retrieval / RAG layer
Purpose: assemble grounded context slices from Twin memory.

Responsibilities:
- Text/media retrieval over local+backend index.
- Retrieval snapshots that are persisted for auditability.
- Relevance thresholding and provenance.

### 6) Reasoning/model layer
Purpose: synthesize recommendations from retrieved context.

Responsibilities:
- Perform interpretation/planning/reporting after retrieval.
- Never mutate source memory without explicit event writes.
- Capture model inputs/outputs metadata in audit trail.

## Main architectural simplifications
1. Converge to one canonical workflow (remove parallel paths).
2. Converge to one sync engine and one API client boundary.
3. Treat docs as versioned contracts tied to code reality.
4. Separate Twin memory truth from model reasoning outputs.
5. Normalize UI and Agent APIs to the same capability contract.

## Must reuse from baseline
- Local persistence primitives and offline-first posture.
- Existing sync/media/RAG backend primitives.
- Existing capture components and mobile bridge foundation.
- Existing deployment/build scripts as starting assets.

## Must not be carried forward
- Competing sync pathways in active use.
- Multiple overlapping API clients for same operations.
- Ambiguous doc claims not backed by code.
- UI logic that hides system state transitions.
