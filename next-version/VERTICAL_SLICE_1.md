# VERTICAL_SLICE_1

## Slice goal
Deliver the **first shippable coherent loop** for vNext:
Capture one field visit offline/online, sync it, retrieve grounded context, ask for recommendation, and write the decision back into Twin history.

## Exact user journey
1. Operator opens cockpit and starts "New Visit".
2. Operator captures observations + photo(s) + location context.
3. Operator reviews extracted fields and corrects errors.
4. Operator taps "Save Local" (immediate local commit).
5. If online: sync runs automatically; if offline: visit remains queued.
6. Operator opens "Ask Twin" for this visit.
7. System runs retrieval over Twin memory and shows context summary/provenance.
8. System returns recommendation with confidence.
9. Operator accepts/modifies/rejects recommendation.
10. Decision is written as Twin event; optional report snapshot generated.

## Exact Twin events involved
1. `visit_event` (draft→reviewed→finalized)
2. `observation` events (captured/validated)
3. `media_asset` events (local_saved→queued_upload→uploaded/indexed)
4. `location_context` event
5. `sync_event` sequence (queued/in_progress/succeeded|failed)
6. `retrieval_context` snapshot event
7. `recommendation_event` (proposed)
8. `user_correction_event` (if operator edits recommendation)
9. `audit_history_event` entries for all transitions
10. optional `report_snapshot_event`

## Exact API capabilities involved
- `ingest_visit`
- `upload_media`
- `sync_event`
- `retrieve_context`
- `ask_twin`
- `propose_next_action`
- optional `generate_report`
- `get_entity_history` for audit screen

## Exact local storage + sync behavior
- Save Local always succeeds first or blocks with explicit error.
- Sync engine is single-path, idempotent, and retries with backoff.
- Failed sync is visible and actionable; no silent drops.
- Local Twin remains source of truth until remote acknowledgment.

## Exact retrieval/reasoning behavior
- Retrieval is mandatory before reasoning.
- Reasoning request must reference retrieval snapshot ID.
- Recommendation payload must include:
  - confidence
  - rationale summary
  - provenance pointer (retrieval snapshot)
  - mode flag (local/hybrid/frontier-assisted)

## Done criteria (slice acceptance)
1. One operator can complete end-to-end journey without leaving canonical flow.
2. Offline capture + delayed sync works without data loss.
3. Sync failures are visible and recoverable.
4. Ask/Recommendation is retrieval-grounded and auditable.
5. Decision write-back creates linked Twin events.
6. History view can reconstruct the full journey for the visit.

## Explicit exclusions for slice 1
- Multi-agent orchestration.
- New wearable integrations.
- Advanced automation policies.
- Cross-farm analytics and multi-tenant scale features.
