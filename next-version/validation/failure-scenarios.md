# Failure scenarios (Slice 1 + Phase 3-6)

## Contract errors
- malformed/invalid event payloads
- invalid visit state transitions
- empty retrieval/reasoning questions
- reasoning without retrieval grounding
- duplicate event id append

## Retrieval failure modes (Phase 3)
- empty results: returns grounded context with `item_count=0` and `low_confidence_warning=true`
- low-confidence retrieval: `max_score < 0.2` sets `low_confidence_warning=true`, signaling the agent to re-query or prompt human
- query against unknown visit: contract error (visit must exist)
- strategy timeout: deferred (future: per-strategy timeout with fallback)
- embedding strategy unavailable: graceful degradation (returns empty, other strategies still contribute)
- stale context: deferred (future: TTL-based cache invalidation)

## Grounding feedback loop (Phase 3)
- If `low_confidence_warning` is set, agentic layer should consider:
  1. Re-querying with reformulated question
  2. Prompting human for additional context
  3. Proceeding with caveated confidence

## CLI handling
- contract errors return exit code `2`
- unexpected errors return exit code `1`

## Sync failure modes (Phase 6)
- failed sync stores `error_reason` and `retry_count`
- `in_progress` → `failed` transition with retry tracking
- no silent drops: every sync attempt is traceable

## Explicitly deferred
- remote network faults and partial write recovery
- advanced queue retries/backoff
- sync conflict reconciliation
- embedding vector index corruption recovery
