# Sync Contract

## State Machine

```
queued → in_progress → succeeded
                     ↘ failed (with error_reason, retry_count)
                       failed → in_progress (retry) → succeeded
```

## Events

Every state transition emits a `sync_event` with:
- `status`: one of `queued`, `in_progress`, `succeeded`, `failed`
- `timestamp`: ISO 8601 UTC
- `retry_count`: number of retry attempts (0 for first attempt)
- `error_reason`: (only on `failed`) reason for failure

## Rules

1. **No silent drops**: every sync attempt is recorded as an event
2. **Idempotent**: same-state sync returns existing event
3. **Retry limit**: max 3 retries before `max_retries_exceeded`
4. **Offline queuing**: `online=False` → `queued` (will succeed when connectivity returns)
5. **Audit trail**: all transitions traceable via event log

## Status Definitions

| Status | Meaning |
|--------|---------|
| `queued` | Offline sync; waiting for connectivity |
| `in_progress` | Currently syncing (online attempt started) |
| `succeeded` | Sync completed successfully |
| `failed` | Sync attempt failed (see `error_reason`) |
