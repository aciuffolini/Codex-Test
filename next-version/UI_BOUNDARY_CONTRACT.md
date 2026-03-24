# UI_BOUNDARY_CONTRACT

## Purpose
Define exact interface between future React UI and existing Twin/Capability layer for Slice-1 parity.

## Capability interface (UI -> adapter -> capabilities)

## 1) `startVisit()`
- **Input:** none
- **Output:** `{ visitId, sliceState }`
- **Errors:** contract/unexpected error string

## 2) `captureObservation(observation)`
- **Input:** non-empty observation string
- **Output:** updated state (`capturedObservation`, `sliceState=draft`)
- **Errors:** validation/state transition errors

## 3) `reviewCorrect(correctedObservation)`
- **Input:** non-empty correction string
- **Output:** `sliceState=reviewed`
- **Errors:** invalid transition/input

## 4) `saveLocal()`
- **Input:** none
- **Output:** `localSaveStatus=saved`
- **Errors:** invalid transition

## 5) `sync(online:boolean)`
- **Input:** online flag
- **Output:** `syncStatus` in `{queued,succeeded}`
- **Errors:** transition/contract errors

## 6) `retrieve(question)`
- **Input:** non-empty question
- **Output:** `{ retrievalEventId, retrievalSummary }`
- **Errors:** missing visit/invalid question

## 7) `ask(question)`
- **Input:** non-empty question + existing `retrievalEventId`
- **Output:** `{ recommendation, groundedBy }`
- **Errors:** retrieval missing (non-negotiable contract failure)

## 8) `decide(decision)`
- **Input:** `decision` in `{accepted,modified,rejected}`
- **Output:** `sliceState=finalized`, decision status
- **Errors:** invalid decision or transition

## State surface contract (read-only to components)
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

## Error surface contract
- UI shows user-readable `lastError` only.
- Detailed debugging remains in logs/dev tooling, not end-user surface.

## Sync status surface contract
- Always render latest status explicitly (`not_synced`, `queued`, `succeeded`).
- No hidden sync side effects in Slice-1 port.

## Retrieval-before-reasoning enforcement
- UI may disable Ask until retrieval context exists.
- Service boundary still validates and rejects ungrounded ask attempts.
- UI must present this failure clearly if attempted.
