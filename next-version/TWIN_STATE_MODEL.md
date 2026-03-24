# TWIN_STATE_MODEL

## Modeling principles
- Event-sourced operational memory with append-first history.
- Current state is derived from latest validated events.
- Retrieval and recommendation traces are first-class events.

## Entity definitions

## 1) visit_event
- **Purpose:** capture a field visit session and core metadata.
- **Key fields:** visit_id, farm_id, actor_id, start_ts, end_ts, status, summary.
- **Relationships:** has many observations, media assets, sync events.
- **Lifecycle:** draft → reviewed → corrected → finalized.

## 2) observation
- **Purpose:** structured agronomic observations linked to visit.
- **Key fields:** observation_id, visit_id, type, value, unit, confidence, source.
- **Relationships:** belongs to visit_event; referenced by recommendations.
- **Lifecycle:** captured → validated → superseded (optional).

## 3) media_asset
- **Purpose:** store photo/audio/video metadata and references.
- **Key fields:** media_id, visit_id, local_uri, remote_uri, mime_type, captured_ts, hash.
- **Relationships:** linked to observation and retrieval context.
- **Lifecycle:** local_saved → queued_upload → uploaded → indexed.

## 4) location_context
- **Purpose:** preserve spatial context for capture and retrieval.
- **Key fields:** location_id, visit_id, lat, lon, accuracy_m, geohash, timestamp.
- **Relationships:** belongs to visit_event; enriches retrieval.
- **Lifecycle:** captured → validated.

## 5) sync_event
- **Purpose:** track sync attempts and outcomes per object.
- **Key fields:** sync_id, object_type, object_id, direction, attempt_no, result, error, ts.
- **Relationships:** references visit/media/recommendation entities.
- **Lifecycle:** queued → in_progress → succeeded | failed | dead_letter.

## 6) retrieval_context
- **Purpose:** immutable snapshot of context assembled for reasoning.
- **Key fields:** retrieval_id, query, retrieved_items, scores, filters, ts, provenance.
- **Relationships:** consumed by recommendation_event / ask_twin responses.
- **Lifecycle:** generated → consumed → archived.

## 7) recommendation_event
- **Purpose:** store suggested action and rationale.
- **Key fields:** rec_id, retrieval_id, model_mode, recommendation, rationale, confidence, ts.
- **Relationships:** linked to observations and user decision events.
- **Lifecycle:** proposed → accepted | modified | rejected.

## 8) user_correction_event
- **Purpose:** represent human edits/overrides with traceability.
- **Key fields:** correction_id, target_entity, target_id, before, after, reason, actor_id, ts.
- **Relationships:** references any mutable domain entity.
- **Lifecycle:** submitted → applied.

## 9) report_snapshot_event
- **Purpose:** persist generated summaries/reports.
- **Key fields:** report_id, scope, inputs, output_uri, generated_by, ts.
- **Relationships:** references retrieval_context + recommendation_events.
- **Lifecycle:** generated → shared | superseded.

## 10) audit_history_event
- **Purpose:** immutable audit stream for governance.
- **Key fields:** audit_id, event_type, actor, payload_ref, ts.
- **Relationships:** spans all entities.
- **Lifecycle:** append-only.

## State transition policy
- No destructive overwrites of operational history.
- Corrections and decisions append events; derived state updates views.
- Retrieval and reasoning artifacts must reference exact input snapshots.
