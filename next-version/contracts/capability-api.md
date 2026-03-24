# Capability API Contract (Slice 1)

## Implemented capabilities
- `ingest_visit`
- `upload_media` (thin adapter)
- `sync_event`
- `retrieve_context`
- `ask_twin`
- `get_entity_history`
- `generate_report` (stub)
- `propose_next_action`

## Shared-core rule
All capabilities operate over the same `TwinService` instance and local-first state model.

## Error semantics
Contract violations raise `ContractError` in-process (HTTP mapping deferred).

## Deferred
- HTTP API surface
- authn/authz
- multi-tenant isolation
