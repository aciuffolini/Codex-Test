# BASELINE_SPIKE_BLOCKED_REPORT

## What must be preserved exactly (from safe-repo milestone)
- One canonical workflow only: start visit → capture → review/correct → save local → sync → retrieve → ask/reason → decide → result summary.
- Twin-core-first behavior and thin UI boundary (no business logic in React components).
- Retrieval-before-reasoning as non-negotiable contract.
- Explicit sync/status/error surfaces.
- Minimal, reversible diffs with clear rollback points.

## Real baseline repo access attempt
Command attempted:

```bash
cd /workspace && git clone https://github.com/aciuffolini/Multimodal-Agentic-Farm-Visit.git baseline-spike
```

Result:
- `fatal: unable to access 'https://github.com/aciuffolini/Multimodal-Agentic-Farm-Visit.git/': CONNECT tunnel failed, response 403`

## Why the requested spike cannot be completed in this environment
The tiny real integration spike requires a writable local checkout of the real baseline repo.
Current environment blocks outbound git/http access to GitHub (403 tunnel failure), so the baseline code cannot be cloned, branched, edited, or validated.

## Minimum touch points I would apply once baseline checkout is available
1. `apps/web/src/App.tsx` (or route registry): add one route/entry to cockpit slice.
2. `apps/web/src/views/CockpitSliceA.*`: thin container view.
3. `apps/web/src/lib/cockpitAdapter.*`: thin adapter wiring to existing boundaries.
4. Optional minimal shared type file in `packages/shared/*` if needed for stable state contract.

Untouched initially:
- backend runtime logic
- model/retrieval provider internals
- non-canonical routes
- Capacitor internals (except trivial bootstrapping if strictly required)

## Rollback triggers that would be watched during the real spike
- ask/reason works before retrieval context
- duplicate visible workflow path appears
- UI components begin carrying business/validation logic
- spike requires unexpected backend/model refactors

## Smallest corrective adjustment needed
Provide one of the following so the requested real spike can proceed:
1. A local checkout of `Multimodal-Agentic-Farm-Visit` mounted in workspace, or
2. Temporary outbound git/http access to clone the target repo.

With either available, I can execute the tiny real spike exactly as requested and keep it reversible.
