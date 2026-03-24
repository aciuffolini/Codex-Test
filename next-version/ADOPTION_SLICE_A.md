# ADOPTION_SLICE_A

## Objective
Define the smallest first adoption slice into real app direction while preserving hardened Slice-1 behavior.

## Exact scope
- Introduce one canonical cockpit path in baseline-aligned UI container.
- Wire only the following actions through adapter boundary:
  1. start visit
  2. capture
  3. review/correct
  4. save local
  5. sync status
  6. retrieve
  7. ask/reason
  8. decide
- Render result summary in same view.

## Exact screens/components involved (minimal)
- existing app shell/status area
- one field-visit/cockpit view container
- one assistant/retrieve+ask panel area
- one decision/result summary panel

No extra routes beyond these surfaces for Slice A.

## Exact state surfaces involved
- `visitId`
- `sliceState`
- `capturedObservation`
- `correctedObservation`
- `localSaveStatus`
- `syncStatus`
- `retrievalSummary`
- `retrievalEventId`
- `recommendation`
- `decision`
- `lastError`

## Done criteria
1. User can complete canonical flow end-to-end from one visible cockpit path.
2. Sync status explicitly visible (`queued`/`succeeded` states) in shell/panel.
3. Ask before retrieval is blocked and/or returns clear contract error.
4. No duplicate workflow path exposed in UI.
5. Existing Slice-1 behavioral tests still pass in isolated kernel.
6. Adapter contract snapshot for Slice A is documented and stable.

## Explicitly excluded from Slice A
- real backend/model integration changes
- additional screens/routes
- styling redesign beyond clarity
- non-slice features (analytics, reports, wearable flows)
- Slice 2 capabilities
