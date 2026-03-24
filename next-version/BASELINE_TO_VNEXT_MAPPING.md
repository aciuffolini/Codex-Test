# BASELINE_TO_VNEXT_MAPPING

## Mapping objective
Translate baseline components into a clear vNext disposition:
- Reuse as-is
- Simplify
- Deprecate
- Redefine interface first

## Baseline → vNext mapping matrix

| Baseline component area | Current role | vNext disposition | Rationale |
|---|---|---|---|
| `apps/web/src` app shell + capture components | Human-facing capture/review flows | **Reuse + simplify** | Keep proven UX primitives, remove parallel flows and reduce controls to canonical verbs |
| Local DB/persistence (`db`, local entities) | Local-first operational storage | **Reuse as-is (with schema hardening)** | This is core to Twin truth and offline continuity |
| Outbox + queue dual implementations | Competing sync mechanisms | **Simplify to one canonical engine** | Parallel sync paths create state ambiguity and failure complexity |
| Multiple API client paths (`api` variants) | Competing transport/stream abstractions | **Simplify to one client boundary** | Reduces drift and inconsistent error handling |
| `server/rag_service` FastAPI endpoints | Sync/media/retrieval backend primitives | **Reuse + redefine contract façade** | Keep internals, expose capability-oriented Twin API |
| Retrieval/embedding/media handling | Grounding context assembly | **Reuse + tighten provenance contract** | Retrieval is mandatory grounding stage before reasoning |
| Chat/reasoning integration | Human ask/recommendation UX | **Simplify + gate by retrieval** | Prevent ungrounded outputs from being operational truth |
| Capacitor/Android bridge | Mobile runtime bridge | **Reuse as-is initially** | Avoid platform churn in first coherent slice |
| Build/dev/deploy scripts | Operational startup and release paths | **Simplify and normalize** | Current script sprawl increases onboarding and operational risk |
| README/status docs | Product and architecture claims | **Redefine first** | Must remove doc-code drift before implementation scaling |

## Interfaces to redefine first (priority order)
1. **Twin event contract** (state + transitions)
2. **Sync contract** (single queue semantics, idempotency, failure states)
3. **Retrieval contract** (query, scope, provenance snapshot)
4. **Reasoning contract** (`ask_twin` retrieval-gated)
5. **UI status contract** (local/sync/retrieval/recommendation state vocabulary)

## Reuse as-is (first pass)
- Core local-first persistence posture.
- Existing backend primitives in `server/rag_service`.
- Existing capture and media collection foundations.
- Existing Android bridge foundation.

## Simplify immediately
- Competing sync pathways.
- Competing API client layers.
- Duplicate user paths for similar actions.
- Excess startup/run modes and ambiguous docs.

## Deprecate (not delete immediately)
- Legacy or duplicate sync path once canonical engine selected.
- Non-canonical API helper path once unified client adopted.
- Any UI flow that bypasses canonical capture→review→correct→sync loop.

## What not to touch yet
- New providers/models.
- New wearable integrations.
- Full backend or frontend rewrites.
- Additional orchestration layers beyond capability API.
