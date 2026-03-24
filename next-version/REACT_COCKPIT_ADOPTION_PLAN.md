# REACT_COCKPIT_ADOPTION_PLAN

## Pre-doc summary: what Tkinter cockpit proved vs did not prove
### Proved
- Canonical Slice-1 workflow can run end-to-end through one UI path.
- UI can remain thin over shared contracts (`TwinCapabilities` + `TwinService`).
- Retrieval-before-reasoning can be enforced at service boundary and reflected in UI errors.
- Sync status and state progression can be surfaced clearly with minimal UI complexity.

### Did not prove
- Mobile/web production UX quality.
- React/Capacitor lifecycle behavior (routing, background/foreground resume).
- Real backend transport/model latency/failure behavior.
- Performance/scaling beyond Slice-1 local flow.

## Objective
Translate current Tkinter cockpit behavior into React/Capacitor architecture without changing Twin core contracts or expanding scope.

## Mapping: Tkinter cockpit -> React/Capacitor

| Current element | React/Capacitor equivalent | Notes |
|---|---|---|
| `CockpitController` | `useCockpitController` hook + small service adapter | Keep orchestration thin; no business logic in components |
| `CockpitState` | React state model (single screen state atom) | UI state mirrors service results; source of truth remains Twin core |
| Button handlers (`on_start`, `on_capture`, …) | Component actions calling capability adapter | Preserve action sequence exactly |
| Status labels | Persistent status strip/cards | Same state surfaces: visit id, slice state, save, sync, retrieval, recommendation |
| `safe_call` error handling | Unified error mapper in UI adapter | Show user-readable error text, no stack traces |

## Boundaries that must remain unchanged
1. `TwinService` owns workflow validity and state transitions.
2. `TwinCapabilities` remains the UI-facing capability boundary.
3. Retrieval-before-reasoning is enforced by service contract, not UI-only checks.
4. UI never writes persistence directly; it invokes capability/service methods only.

## UI state vs Twin core state
### UI-local state
- form input buffers (observation, correction, question)
- transient view state (loading, disabled controls, panel focus)
- presentational status formatting

### Twin/core state (authoritative)
- visit lifecycle state (`draft/reviewed/finalized`)
- persisted events
- sync outcome state (`queued/succeeded`)
- retrieval context ids and recommendation linkage

## Preserving canonical flow exactly
Required action order:
1. start visit
2. capture
3. review/correct
4. save local
5. sync
6. retrieve
7. ask/reason
8. decide/finalize

UI must not expose alternate workflow routes in Slice-1 port.

## Deferred in React adoption
- multipage navigation and advanced information architecture
- auth/session flows
- background sync conflict handling
- provider/model selection UI
- Slice 2 features and analytics surfaces
