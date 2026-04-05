"""Retrieval boundary for vNext — ranked, provenance-rich retrieval.

Replaces Slice-1 stub with strategy-based retrieval pipeline.
Rule enforced: every retrieval_context is grounded with provenance.

Grounding feedback loop:
- If retrieved context is insufficient (empty or low-score), the event
  records a 'low_confidence_warning' flag, signaling the agentic layer
  to consider re-querying or prompting the human for more data.
"""
from __future__ import annotations

from .models import TwinEvent, ContractError
from .store_base import TwinStoreBase
from .retrieval_strategies import (
    LocalTwinStrategy,
    StructuredDataStrategy,
    EmbeddingStrategy,
    RetrievalItem,
    compute_query_hash,
    merge_strategies,
)

# Threshold below which we flag low confidence
LOW_CONFIDENCE_THRESHOLD = 0.2


class RetrievalService:
    def __init__(self, store: TwinStoreBase):
        self.store = store
        self.strategies = [
            LocalTwinStrategy(),
            StructuredDataStrategy(),
            EmbeddingStrategy(),  # currently a stub
        ]

    def retrieve_context(self, visit_id: str, question: str) -> TwinEvent:
        if not question.strip():
            raise ContractError("question is required")

        events = self.store.list_events(visit_id)
        if not events:
            raise ContractError("cannot retrieve context for unknown visit")

        # Run unified pipeline
        items = merge_strategies(self.strategies, events, question)

        # Compute provenance
        query_hash = compute_query_hash(question)
        max_score = items[0].score if items else 0.0
        low_confidence = max_score < LOW_CONFIDENCE_THRESHOLD

        retrieval = TwinEvent.make(
            "retrieval_context",
            visit_id,
            {
                "question": question,
                "query_hash": query_hash,
                "items": [item.to_dict() for item in items],
                "item_count": len(items),
                "max_score": max_score,
                "grounded": True,
                "source": "unified_multimodal_pipeline",
                "strategies_used": [
                    type(s).__name__ for s in self.strategies
                ],
                "low_confidence_warning": low_confidence,
            },
        )
        self.store.append(retrieval)
        return retrieval
