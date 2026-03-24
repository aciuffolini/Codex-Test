# ROLLBACK_AND_ABORT_RULES

## Stop-merge conditions (abort immediately)
1. Canonical flow cannot be completed without fallback to legacy path.
2. Ask/reason can execute without retrieval context in any integrated path.
3. UI components begin implementing or duplicating transition/validation logic.
4. A second competing workflow becomes visible to end users.
5. Merge requires unexpected backend/model changes beyond agreed tiny wrappers.

## Boundary leakage signals
- React components referencing persistence/sync internals directly.
- UI handling state transitions that should remain in controller/service.
- Adapter bypassed by direct calls into legacy APIs from cockpit actions.

## Workflow duplication signals
- Two visible action paths for capture→review→save→sync→ask→decide.
- Duplicate status widgets showing conflicting sync/retrieval states.

## UI/business logic duplication signals
- Validation rules repeated in component layer and adapter layer.
- Different error messages/conditions between cockpit and core contracts.

## Revert immediately when
- retrieval-before-reasoning invariant fails in integration tests.
- sync status surface diverges from adapter contract (`queued/succeeded` visibility breaks).
- cockpit route requires broad refactor of unrelated baseline screens.

## Independent rollback units
1. cockpit route registration
2. cockpit view container
3. cockpit adapter module
4. optional shared type additions

Rollback in reverse order to preserve baseline stability.
