# TWIN_API_CONTRACT

## Contract principles
- Capability-based API over shared Twin core.
- Explicit side effects and provenance.
- Retrieval-first rule for any reasoning capability.

## 1) ingest_visit
- **Purpose:** create/update visit_event and observations.
- **Input:** visit metadata, observations, optional local IDs and timestamps.
- **Output:** canonical visit_id, accepted fields, validation warnings.
- **Side effects:** writes visit_event + observation events.
- **Execution mode:** hybrid (local-first, backend-sync).
- **Retrieval grounding required first?** No.

## 2) upload_media
- **Purpose:** register and store media assets.
- **Input:** media metadata + payload reference.
- **Output:** media_id, storage refs, index status.
- **Side effects:** writes media_asset, may enqueue embedding.
- **Execution mode:** hybrid.
- **Retrieval grounding required first?** No.

## 3) sync_event
- **Purpose:** synchronize local events with backend.
- **Input:** object ref, direction, payload hash, last attempt context.
- **Output:** sync state + conflict details if any.
- **Side effects:** writes sync_event.
- **Execution mode:** hybrid.
- **Retrieval grounding required first?** No.

## 4) retrieve_context
- **Purpose:** fetch grounded context from Twin memory/index.
- **Input:** query, entity scope, time filters, modality filters.
- **Output:** retrieval_context snapshot with ranked items + provenance.
- **Side effects:** writes retrieval_context event.
- **Execution mode:** local-only or hybrid.
- **Retrieval grounding required first?** This is the grounding capability.

## 5) ask_twin
- **Purpose:** produce grounded answer/recommendation from retrieved context.
- **Input:** question + retrieval_context_id (or inline retrieval request).
- **Output:** answer, recommendation candidates, confidence, citations.
- **Side effects:** writes recommendation_event metadata.
- **Execution mode:** hybrid (local or frontier reasoning).
- **Retrieval grounding required first?** Yes (mandatory).

## 6) get_entity_history
- **Purpose:** return complete audit/history for a Twin entity.
- **Input:** entity_type, entity_id, optional range/filter.
- **Output:** ordered event stream + derived current state.
- **Side effects:** none.
- **Execution mode:** local-only or hybrid.
- **Retrieval grounding required first?** No.

## 7) generate_report
- **Purpose:** compile operational report from Twin history.
- **Input:** scope (farm/visit/date range), template, optional retrieval_context.
- **Output:** report artifact + trace metadata.
- **Side effects:** writes report_snapshot_event.
- **Execution mode:** hybrid.
- **Retrieval grounding required first?** Yes for narrative synthesis.

## 8) propose_next_action
- **Purpose:** suggest next operational step.
- **Input:** current state snapshot + retrieval_context.
- **Output:** ranked action options, rationale, confidence.
- **Side effects:** writes recommendation_event.
- **Execution mode:** hybrid.
- **Retrieval grounding required first?** Yes (mandatory).
