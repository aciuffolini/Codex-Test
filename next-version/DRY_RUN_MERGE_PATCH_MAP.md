# DRY_RUN_MERGE_PATCH_MAP

## Pre-write summary: Adoption Slice A proven vs unproven for real baseline merge
### Proven in isolated vNext
- Canonical cockpit flow executes end-to-end through one thin React path.
- Adapter/controller boundary keeps UI mostly presentational.
- Retrieval-before-reasoning is enforced through service contracts.
- Sync/error/status surfaces are explicit and testable.

### Unproven for baseline merge
- Exact fit with baseline route and shell constraints.
- Interaction with existing baseline capture/chat/outbox layers without duplication.
- Baseline-specific lifecycle behavior (web+Capacitor runtime).
- Incremental integration complexity under existing production code paths.

## Future baseline touch points (dry-run map)

| Baseline target path (expected) | Why touched | Change type | Responsibility in merge | Must remain outside |
|---|---|---|---|---|
| `apps/web/src/App.tsx` (or root route entry) | register Slice-A cockpit route/entry surface | modified (minimal) | mount one canonical cockpit entry point | no business logic, no contract validation logic |
| `apps/web/src/routes/*` or equivalent view container | host cockpit view | new or modified | provide screen/view placement for Slice A only | no sync/retrieval orchestration internals |
| `apps/web/src/components/*` (capture/review/chat panels) | reuse existing visual sections | wrapped/modified | render UI surfaces for canonical actions | no duplicated flow logic |
| `apps/web/src/lib/*adapter*` (new) | map baseline UI actions to canonical adapter boundary | new | stable UI-side action/state/error interface | no direct persistence/model rules |
| `apps/web/src/lib/api*` | wire adapter to existing API client surfaces when needed | wrapped/minimal modified | transport integration only | no canonical flow rules |
| `apps/web/src/lib/db*` / local store module | ensure status/state surfaces consume existing persistence safely | mostly untouched or minimal read adapter | expose needed status reads | no UI orchestration |
| `apps/web/src/lib/outbox*` / sync queue module | align visible sync statuses | untouched initially or wrapped | provide sync status signals for cockpit | no new parallel sync engine |
| `packages/shared/*` (if contract types exist) | shared state/action contract typing | new or minimal modified | contract types only | no runtime orchestration logic |
| `apps/web/capacitor.config.*` + `apps/web/android/*` | only if route bootstrap/env needs mapping | untouched for slice A | none unless strictly required | no behavioral changes |

## Explicitly left untouched in first real merge
- backend runtime modules (`server/*`) beyond existing contract consumption
- model provider wiring
- non-canonical feature routes
- advanced analytics/report/report-generation surfaces
