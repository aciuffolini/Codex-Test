# NEXT_DECISION

## Recommendation
**A) Integration planning first** (then thin GUI), not backend-first.

## Why this is the best next move
1. The kernel is now contract-hardened and testable, but still isolated.
2. Jumping to real backend or GUI integration without explicit staged merge boundaries risks reintroducing drift and parallel paths.
3. Integration planning first enables safe feature-flagged adoption and clear rollback points.
4. It preserves the core non-negotiables:
   - Twin core centrality
   - one canonical workflow
   - retrieval-before-reasoning

## Practical sequence after this decision
1. Approve `INTEGRATION_BLUEPRINT.md` + `MERGE_STRATEGY.md`.
2. Execute Stage 1 contract adoption in baseline-facing interfaces/docs.
3. Build the thin GUI shell only once stage-2 service boundary is in place.
4. Defer real backend/model wiring until stage-4 controls are ready.

## Why not B (thin GUI first)
GUI-first can mask unresolved service/contract boundaries and create coupling that is expensive to unwind.

## Why not C (real backend first)
Backend-first without staged boundary adoption risks bypassing kernel contracts and duplicating orchestration logic.
