# Twin vNext Core Product (Official)

This directory is the official Twin-centered vNext core product line.

It contains the hardened Slice-1 kernel and thin interfaces over shared contracts.

## What is implemented now

- Canonical Slice-1 journey through thin interfaces over one core:
  - CLI (`vnext_ui/cli.py`)
  - Tkinter cockpit (`vnext_ui/gui.py`)
  - React cockpit (`vnext_ui/react_api.py` + `vnext_ui/react_cockpit/*`)
- Baseline-shaped spike route (`/baseline`) serving app-shaped cockpit structure under:
  - `react_cockpit/baseline_shape/apps/web/src/*`
- Baseline-aligned adapter boundary (`vnext_ui/baseline_adapter.py`) keeps UI thin and logic centralized.
- Shared Twin core (`vnext_twin_core`) as source of truth.
- Shared capability façade (`vnext_api`) used by all UI paths.
- Explicit state transitions (`draft` → `reviewed` → `finalized`) with contract checks.
- Single-path sync outcomes: offline=`queued`, online=`succeeded`.
- Retrieval-before-reasoning enforced.
- User-readable error surfacing across UI paths.

## Canonical scope in this line

Implemented flow:

- Start visit
- Capture observation
- Review/correct
- Save local
- Sync + visible status
- Retrieve context
- Ask/reason (grounded)
- Decide + result summary

No expansion beyond this canonical flow in the current phase.

## Run and validate

From repository root:

```bash
python next-version/vnext_ui/cli.py
python next-version/vnext_ui/cli.py --offline
python next-version/vnext_ui/gui.py
PYTHONPATH=next-version python -m vnext_ui.react_api
python -m unittest discover -s next-version/tests -p 'test_*.py'
```

Then open:

- `http://127.0.0.1:8765` (thin cockpit)
- `http://127.0.0.1:8765/baseline` (baseline-shaped spike cockpit)

## Deferred intentionally

- Real HTTP backend transport/auth
- Real multimodal retrieval/embeddings
- Real frontier-model calls
- Advanced sync conflict resolution
- Report templating
- Slice B / Slice 2 features
