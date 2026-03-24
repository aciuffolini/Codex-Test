# HUMAN_UI_STRATEGY

## Product stance
The UI is a **calm operational cockpit**, not the intelligence engine.
Primary loop: capture → review → correct → sync → ask → decide.

## Key screens
1. **Dashboard / Today**
   - Queue health, pending visits, sync status, recent recommendations.
2. **Capture Visit**
   - Structured form + media capture + context hints.
3. **Review & Correct**
   - Side-by-side source artifacts and extracted fields.
4. **Sync Center**
   - Pending/failed/successful sync events with retry actions.
5. **Ask Twin**
   - Context-grounded Q&A and recommendation cards.
6. **Decision & Report**
   - Approve/modify/reject recommendations and generate shareable summary.
7. **History / Audit**
   - Chronological event trail with provenance.

## Navigation principles
- One primary action per screen.
- Progressive disclosure for advanced controls.
- Keep state/status always visible (never hidden behind settings).
- Use consistent verbs aligned to workflow stages.

## Visible vs hidden

### Must be visible
- Save status (local persisted/not persisted).
- Sync state (queued/syncing/failed/synced).
- Context provenance (what retrieval used).
- Recommendation confidence and source mode (local-only/hybrid/frontier-assisted).

### Should be hidden by default
- Raw model/provider tuning knobs.
- Internal transport/network diagnostics.
- Secondary automation options that create decision fatigue.

## Confidence / sync / status design
- Persistent status rail with colored but calm indicators.
- Every recommendation card must include:
  - confidence
  - grounded context summary
  - last-sync timestamp
  - override/edit action

## UX simplifications
1. Single canonical capture form path.
2. Single sync center (no duplicate retry UIs).
3. Single assistant entry point tied to retrieval context.
4. Standardized error language and recovery actions.

## What not to overload into UI
- Multi-agent orchestration complexity.
- Provider-specific model mechanics.
- Infrastructure concerns beyond concise health signals.
