# LOCAL_RAG_VS_FRONTIER_REASONING

## Decision split

## What stays local (operational truth)
- Visit/observation/media canonical records.
- Sync queue/outbox state and retry history.
- Audit trail and correction history.
- Local index/embeddings where feasible for offline retrieval.

## What retrieval does
- Assembles relevant context from Twin memory.
- Produces ranked, provenance-rich retrieval snapshots.
- Enforces grounding boundary for downstream reasoning.

## What frontier reasoning does
- Synthesis: summarize cross-event patterns.
- Interpretation: infer likely causes and implications.
- Planning: propose next actions/report narratives.

## Source of truth
- Twin memory/events are source of truth.
- Model outputs are advisory artifacts unless accepted and written back as events.

## What should never bypass grounding
- Recommendations.
- Risk/priority scoring shown to operators.
- Generated reports sent externally.
- Any automated action proposal.

## Privacy / latency / offline implications
- Local-first mode protects continuity and minimizes network dependency.
- Frontier calls are optional and policy-gated.
- System degrades gracefully: retrieval + local heuristics when cloud unavailable.
- Sensitive data can remain local while sharing only minimal grounded context upstream.
