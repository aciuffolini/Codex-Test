# RISKS_OF_EARLY_MERGE

## 1) Boundary leakage
**Risk:** React components start embedding service/business rules.

**Failure mode:** kernel contracts become optional and diverge from UI behavior.

**Mitigation:** keep action orchestration in adapter/controller boundary only.

## 2) Duplicated workflow paths
**Risk:** legacy and canonical flows are both visible during migration.

**Failure mode:** users enter inconsistent states; test coverage becomes ambiguous.

**Mitigation:** feature-flag one canonical cockpit route and hide alternatives in Slice A.

## 3) UI/business-logic duplication
**Risk:** validation/state transition logic copied into UI handlers.

**Failure mode:** contract drift and contradictory error behavior.

**Mitigation:** UI performs only minimal input checks; authoritative validation stays in core/contracts.

## 4) Premature backend coupling
**Risk:** direct backend payloads shape UI state too early.

**Failure mode:** UI tightly coupled to unstable backend internals; harder staged adoption.

**Mitigation:** maintain adapter surface with stable cockpit state fields independent of backend payload details.

## 5) Styling-driven scope creep
**Risk:** visual redesign expands before behavioral parity is locked.

**Failure mode:** slow delivery, hidden regressions in canonical flow.

**Mitigation:** clarity-only styling in Slice A; postpone design-system work until flow parity is stable.

## 6) Retrieval-before-reasoning regression
**Risk:** ask action triggered without grounded retrieval context.

**Failure mode:** ungrounded recommendations and contract violation.

**Mitigation:** enforce at service boundary and verify through adapter tests in each adoption stage.
