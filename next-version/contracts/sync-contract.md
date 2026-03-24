# Sync Contract (Slice 1)

## Scope
Single-path sync semantics only.

## Inputs
- `visit_id`
- `online: bool`

## Outcomes
- `online=true` -> `sync_event.status=succeeded`
- `online=false` -> `sync_event.status=queued`

## Idempotency
Repeated sync call with same `(visit_id, status)` returns latest existing sync event instead of appending duplicates.

## Deferred
- retries/backoff
- dead-letter queues
- conflict resolution
- remote transport protocol
