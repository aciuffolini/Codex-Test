# GUI_COCKPIT_PLAN

## Goal
Provide the thinnest graphical Human UI over the hardened Slice 1 kernel with no core redesign and no feature expansion.

## Scope (only)
- Capture
- Review
- Correct
- Sync status
- Ask
- Decide

## UX shell structure (thin)
1. **VisitForm panel**
   - Input observation/media/location fields.
   - Save to local Twin event path.
2. **ReviewCorrect panel**
   - Show captured values and correction input.
3. **SyncStatus strip**
   - Show `queued` or `succeeded` plus timestamp.
4. **AskTwin panel**
   - Question box.
   - Retrieval snapshot summary indicator.
   - Recommendation + confidence.
5. **Decision panel**
   - Accept/modify/reject action.

## Interaction contract
- UI invokes capability boundary methods only.
- No direct state mutation outside Twin service contract.
- Ask button disabled until retrieval context exists.
- Decision actions append events and finalize visit.

## Minimal data shown
- visit id
- current visit state
- latest sync status
- retrieval context id
- recommendation text/confidence
- decision result

## Explicitly not included
- multi-screen navigation complexity
- advanced analytics
- model/provider selection controls
- report generation UX
- batch operations

## Implementation posture
- Treat GUI as a presentational shell over existing Slice-1 kernel.
- Keep components stateless where possible; state source remains Twin core via adapter.
