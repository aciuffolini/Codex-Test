# BASELINE_ADAPTER_PLAN

## Goal
Define how the current `react_api` + `controller` boundary evolves toward baseline integration while preserving contracts and canonical flow.

## Current boundary (in isolated vNext)
- React UI -> `/api/action` + `/api/state` (`react_api.py`) -> `CockpitController` -> `TwinCapabilities` -> `TwinService`.

## Evolution path toward baseline

## Phase A: local client adapter (no backend coupling)
- Replace HTTP loopback calls with an in-app adapter module in baseline UI layer.
- Adapter exposes same action names and returns same state surface shape.
- Controller semantics remain unchanged.

## Phase B: split adapter responsibilities
- **UI adapter**: presentation-facing state and error normalization.
- **Domain adapter**: canonical action orchestration and contract mapping.
- Keep Twin/service contracts as source of truth.

## Phase C: selective backend-facing wiring (later)
- For sync/retrieval calls, adapter may call baseline backend APIs.
- Must preserve contract outputs used by UI (same state fields, same error semantics).
- Retrieval-before-reasoning remains enforced before `ask` dispatch.

## What remains local vs evolves
### Remains local/contractual
- canonical action ordering
- validation expectations and state progression
- status/error surface vocabulary

### Becomes client-side adapter logic
- mapping baseline UI events to canonical action calls
- shaping backend responses into contract-consistent cockpit state

### Becomes backend-facing later
- sync transport implementation details
- retrieval and reasoning provider calls
- persistence/storage internals (while keeping contract outputs stable)

## Non-negotiables during evolution
1. Do not move business rules into React components.
2. Do not bypass retrieval-before-reasoning.
3. Do not introduce alternate action routes.
4. Do not leak backend-specific payloads directly into UI state surface.
