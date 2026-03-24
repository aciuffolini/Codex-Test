# MINIMAL_BASELINE_DIFF_PLAN

## Objective
Define smallest possible baseline diff for first integration attempt of Adoption Slice A.

## Minimum viable merge slice (dry-run)
1. Add one cockpit route/view container.
2. Add one UI adapter module that mirrors vNext action/state contract.
3. Reuse existing baseline visual components for capture/review/chat/status where possible.
4. Wire only canonical action buttons/handlers to adapter.
5. Preserve existing backend/persistence modules unchanged unless a tiny wrapper is required.

## Exact components/modules likely involved
- `apps/web/src/App.tsx` or route registry file (single new route link)
- `apps/web/src/views/CockpitSliceA.*` (new thin container)
- `apps/web/src/lib/cockpitAdapter.*` (new minimal adapter/glue)
- `apps/web/src/components/*` existing panels reused by composition
- optional `packages/shared/*` for shared contract type definitions

## Exact adapter/glue points
- UI event handlers call adapter methods only:
  - start_visit, capture, review_correct, save_local, sync, retrieve, ask, decide
- Adapter returns stable state surface:
  - visitId, sliceState, localSaveStatus, syncStatus, retrievalSummary, recommendation, lastError
- Adapter mediates transport and preserves retrieval-before-reasoning error semantics.

## Exact surfaces that must NOT be changed
- core sync/outbox internals (except read-only status wrapping)
- backend model/retrieval runtime behavior
- non-canonical routes/features
- global styling system
- Capacitor runtime config (unless route boot requires trivial update)

## Why this is minimum
- Adds only one new user-visible path.
- Avoids touching deep kernel/backend internals.
- Keeps rollback to route+adapter removal.
- Prevents parallel workflow proliferation by confining scope to one canonical cockpit path.
