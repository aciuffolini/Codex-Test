# CANONICAL_WORKFLOW

## Primary product loop
Reality → Capture → Memory → Retrieval → Reasoning → Recommendation/Action → Feedback → Updated Twin

## One primary workflow

1. **Capture**
   - User captures structured observations + media + context.
2. **Review**
   - User sees extracted fields, metadata, and capture completeness.
3. **Correct**
   - User edits inaccuracies before commit.
4. **Save locally**
   - Twin writes canonical local events/assets immediately.
5. **Sync**
   - Sync engine publishes queued events/media to backend when online.
6. **Retrieve context**
   - Retrieval assembles relevant Twin history and media context.
7. **Ask / reason**
   - Reasoning layer produces grounded interpretation and recommendations.
8. **Decide**
   - Human accepts/adjusts/rejects proposed action.
9. **Write back**
   - Decision + rationale + outcome are persisted as Twin events.

## Offline behavior
- Capture/review/correct/save must be fully local.
- Retrieval uses local index first.
- Reasoning may degrade to local model/rules if frontier unavailable.
- All generated recommendations are marked with confidence/source mode.

## Online behavior
- Outbox sync runs continuously with idempotent semantics.
- Retrieval may enrich from backend/global corpus.
- Frontier reasoning can be invoked after retrieval snapshot is frozen.

## Sync failure behavior
- Failed sync attempts create explicit sync events.
- User sees actionable failure states (retry now, retry later, inspect error).
- No data loss: local Twin remains source of truth until confirmed sync.

## Human correction loop
- Corrections can happen before or after sync.
- Every correction writes a correction event linked to original event.
- Retrieval should prefer most recent validated state.

## Agent-triggered workflow loop
- Agent API can ingest/retrieve/ask/propose.
- Agent proposals are suggestions, never silent state overrides.
- Human or policy gate confirms consequential actions.
