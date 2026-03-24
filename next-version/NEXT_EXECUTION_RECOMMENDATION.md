# NEXT_EXECUTION_RECOMMENDATION

## Recommendation
**B) Perform a tiny real baseline integration spike.**

## Why B is best now
- Dry-run planning is sufficiently detailed and constrained.
- Isolated Slice-A behavior is already stable and tested.
- The highest remaining uncertainty is baseline fit (route/shell/adapter placement), which only a tiny controlled spike can validate.
- A tightly scoped spike can remain reversible (route + adapter + one cockpit container).

## Spike scope guardrails
1. One cockpit route only.
2. One adapter boundary only.
3. No backend/model changes.
4. No non-canonical feature exposure.
5. Abort on first boundary-leakage signal.

## Why not A now
Continuing dry-run only adds diminishing returns without reducing baseline integration uncertainty.

## Why not C now
Isolated repo refactor is not the bottleneck; baseline fit and integration friction are.
