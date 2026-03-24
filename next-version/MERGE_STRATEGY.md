# MERGE_STRATEGY

## Objective
Define smallest staged adoption of hardened Slice 1 kernel into real product direction with explicit rollback points.

## Stage 0 — Keep isolated (current)
- Keep `next-version/` as reference kernel and contract source.
- Baseline untouched.
- Exit criteria: stable contract docs + passing Slice-1 tests.
- **Rollback point:** no-op (already isolated).

## Stage 1 — Contract adoption
- Adopt contract vocabulary and invariants in baseline docs/interfaces:
  - event types
  - state transitions
  - sync outcomes
  - retrieval-before-reasoning precondition
- No behavior replacement yet.
- **Risks:** doc drift if not enforced.
- **Rollback point:** revert docs/interface adapters only.

## Stage 2 — Service boundary adoption
- Add thin adapter layer in baseline that mirrors kernel capabilities (`ingest_visit`, `sync_event`, `retrieve_context`, `ask_twin`, ...).
- Route one canonical path through adapter while keeping existing internals behind it.
- **Risks:** duplicated execution paths during transition.
- **Rollback point:** disable adapter path via feature flag and return to current baseline path.

## Stage 3 — UI adoption
- Introduce thin graphical cockpit for canonical flow only.
- Bind UI actions to stage-2 capability boundary.
- Keep advanced/legacy routes hidden or out of scope.
- **Risks:** UX confusion if old/new flows coexist visibly.
- **Rollback point:** switch UI routing back to legacy view while retaining adapter contracts.

## Stage 4 — Retrieval/model integration
- Connect real backend retrieval snapshots and reasoning providers behind same contracts.
- Preserve retrieval-before-reasoning enforcement in service boundary.
- **Risks:** grounding bypass, latency spikes, partial failures.
- **Rollback point:** pin reasoning to local stub/fallback while keeping retrieval + event persistence stable.

## Cross-stage controls
- Feature flags per stage boundary.
- Acceptance checklist must pass before advancing stage.
- No Slice 2 scope until stage 4 is stable.
