# SCREEN_FLOW_MAP

## Goal
Define minimum React/Capacitor screen/view flow preserving current Slice-1 cockpit behavior.

## Minimal view structure

## View 1: Start Visit
- Primary action: `Start Visit`
- Output surfaces: visit id, initial state (`draft`)

## View 2: Capture
- Input: observation text (plus placeholder capture metadata)
- Primary action: `Capture`
- Output surfaces: captured observation summary

## View 3: Review/Correct
- Input: correction text
- Primary action: `Review + Correct`
- Output surfaces: corrected summary, state now `reviewed`

## View 4: Save + Sync Status
- Actions: `Save Local`, `Sync` (online toggle)
- Output surfaces:
  - local save status
  - sync status (`queued`/`succeeded`)

## View 5: Retrieve + Ask
- Inputs: retrieval question, ask question
- Actions: `Retrieve`, then `Ask`
- Output surfaces:
  - retrieval summary + retrieval id
  - recommendation text/confidence (if available)

## View 6: Decide
- Input: decision (`accepted|modified|rejected`)
- Action: `Decide`
- Output: state finalized

## View 7: Result / History Summary (minimal)
- Read-only summary panel of current run:
  - visit id
  - state
  - save/sync statuses
  - retrieval summary/id
  - recommendation
  - decision

## Navigation rules
- Sequential stepper or single-page sections allowed.
- No extra screens unless required for this exact flow.
- No branching routes that bypass required steps.

## Persistent shell elements
- top status strip (visit id, state, sync)
- error banner area (`lastError`)
