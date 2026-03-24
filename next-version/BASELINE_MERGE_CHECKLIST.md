# BASELINE_MERGE_CHECKLIST

## Pre-merge checklist
- [ ] One canonical cockpit route defined (no parallel route exposed).
- [ ] Adapter contract mirrors Slice-A action/state surface exactly.
- [ ] Retrieval-before-reasoning enforced in adapter/service path.
- [ ] Sync status visibility surface explicitly mapped (`queued/succeeded`).
- [ ] Error surface (`lastError`) mapped to UI banner/section clearly.
- [ ] No direct business-rule logic added to React components.
- [ ] No backend/model coupling introduced beyond agreed wrappers.
- [ ] Rollback units identified and tested locally (route, view, adapter).

## Post-merge checklist
- [ ] Canonical workflow reachable end-to-end in integrated route.
- [ ] Ask before retrieval fails cleanly and visibly.
- [ ] Sync status changes are visible and consistent with adapter state.
- [ ] No duplicate orchestration flow visible in UI.
- [ ] Existing relevant tests still pass.
- [ ] New Slice-A integration tests pass.
- [ ] No unrelated baseline modules modified.

## Expected validation set
- route smoke test for cockpit entry
- canonical flow integration test
- retrieval-before-reasoning negative test
- sync status visibility test
- error-surface test
