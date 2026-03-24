# PORTING_NOTES

## Temporary (Tkinter-specific) parts
- `vnext_ui/gui.py` widget layout and event wiring.
- Tkinter `StringVar`/`BooleanVar` state containers.
- Desktop window lifecycle assumptions.

These should be translated to React components/hooks, not copied directly.

## Permanent behavioral references
- `CockpitController` action semantics and state surface.
- `safe_call` pattern for contract-safe UI interactions.
- Canonical action ordering and state progression.
- Retrieval-before-reasoning contract behavior and user-facing error semantics.

## Reuse directly (or near-direct)
- `vnext_twin_core/*` core logic and contracts (as-is reference behavior).
- `vnext_api/capabilities.py` capability interface semantics.
- Existing tests for kernel behavior (`test_slice1.py`) as regression anchor.
- GUI-controller tests (`test_gui_controller.py`) as UI-contract behavior anchor.

## Translate, not copy
- Controller class -> React hook/service adapter
- Flat Tkinter form layout -> minimal React cockpit panels
- Tkinter status labels -> persistent status strip/cards
- Tkinter event callbacks -> handler functions invoking capability boundary

## Porting guardrails
1. Do not move business rules into React components.
2. Do not alter core contracts during UI port.
3. Do not add non-slice functionality.
4. Keep error and status surfaces explicit and visible.
5. Preserve one canonical flow only.
