# Twin Events Contract (Slice 1)

## Required base fields
Each event must include:
- `event_id` (uuid)
- `event_type`
- `visit_id`
- `payload` (object)
- `ts` (UTC timestamp)

## Allowed event types
- `visit_event`
- `observation`
- `media_asset`
- `location_context`
- `sync_event`
- `retrieval_context`
- `recommendation_event`
- `user_correction_event`
- `audit_history_event`

## Event-level validation
- `visit_event.payload.status` in `{draft, reviewed, finalized}` when present.
- `sync_event.payload.status` in `{queued, succeeded}`.
- `retrieval_context` must include `question` and `grounded=true`.
- `recommendation_event` must include `grounded_by`.

## Idempotency expectation
- Duplicate `event_id` is invalid and rejected by store.
