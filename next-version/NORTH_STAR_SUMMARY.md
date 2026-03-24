# NORTH_STAR_SUMMARY

## vNext north star
Build **one coherent Agentic Digital Twin system** where:
- The **Twin core** is the source of operational truth.
- The **Human UI** and **Agent API** are two interfaces to the same memory/state.
- **Retrieval (RAG) grounds context first**, then reasoning generates recommendations.
- Model outputs are advisory until accepted and written back as Twin events.

## Canonical product loop (single flow)
Reality → Capture → Review → Correct → Save Local Twin Event → Sync → Retrieve Context → Ask/Reason → Decide → Write-back Feedback Event

This is the only primary workflow for vNext.

## Human UI strategy in one page
The UI is a calm operational cockpit with six stable verbs:
1. Capture
2. Review
3. Correct
4. Sync
5. Ask
6. Decide

UI responsibilities:
- Make state visible: local save status, sync status, recommendation confidence, provenance.
- Reduce cognitive load: one primary action per screen, progressive disclosure for advanced controls.
- Keep operational continuity in offline mode.

## Twin state model summary
The Twin is event-centric and append-first.
Core event/entity classes:
- visit_event
- observation
- media_asset
- location_context
- sync_event
- retrieval_context
- recommendation_event
- user_correction_event
- report_snapshot_event
- audit_history_event

Principle:
- Current state is derived from latest validated events.
- Corrections append events (no destructive overwrite).

## Agent API strategy summary
Expose capability APIs over the same Twin core:
- ingest_visit
- upload_media
- sync_event
- retrieve_context
- ask_twin
- get_entity_history
- generate_report
- propose_next_action

Contract rule:
- Any recommendation/report/action proposal must be grounded by retrieval first.

## Local RAG vs frontier reasoning split
### Local layer owns
- operational memory truth (events/media/sync/audit)
- local-first writes
- baseline retrieval capability (including offline path where possible)

### Frontier layer owns
- higher-order synthesis
- planning and recommendation generation
- narrative report generation

Safety rule:
- frontier reasoning cannot bypass grounding or silently mutate Twin truth.

## Phased roadmap synthesis
1. **M0 — Workspace isolation**: keep all vNext work in next-version workspace.
2. **M1 — Contract freeze**: lock workflow/state/API contracts before code.
3. **M2 — Sync convergence**: move to one canonical sync engine.
4. **M3 — API client convergence**: one canonical client boundary.
5. **M4 — Capability façade**: expose stable Twin capability APIs.
6. **M5 — Cockpit convergence**: implement the calm UX loop.
7. **M6 — Runbook truthing**: align scripts/docs with actual behavior.

## Explicit non-goals for first implementation phase
- No new model providers.
- No wearable expansion.
- No broad multi-agent orchestration layer.
- No stack rewrite.

## Success signal
A field manager can complete one end-to-end visit loop (capture→decision) with clear status, no ambiguous sync state, grounded recommendations, and auditable write-back into Twin history.
