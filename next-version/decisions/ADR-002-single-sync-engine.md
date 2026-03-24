# ADR-002 single sync engine
Accepted: one sync path in slice-1 (`SyncEngine`) with explicit outcomes (`queued`, `succeeded`) and simple idempotent same-status behavior.
Deferred: conflict resolution and advanced retry policy.
