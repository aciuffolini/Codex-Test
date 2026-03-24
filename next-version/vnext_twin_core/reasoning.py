"""Reasoning boundary for Vertical Slice 1.

Rule enforced: ask/recommend requires retrieval_context first.
"""
from __future__ import annotations

from .models import TwinEvent, ContractError
from .store import TwinStore


class ReasoningService:
    def __init__(self, store: TwinStore):
        self.store = store

    def ask_twin(self, visit_id: str, retrieval_event_id: str, question: str) -> TwinEvent:
        if not question.strip():
            raise ContractError("question is required")

        retrieval_events = [
            e
            for e in self.store.list_events(visit_id)
            if e["event_type"] == "retrieval_context" and e["event_id"] == retrieval_event_id
        ]
        if not retrieval_events:
            raise ContractError("retrieval_context is required before reasoning")

        rec = TwinEvent.make(
            "recommendation_event",
            visit_id,
            {
                "question": question,
                "recommendation": "Inspect affected zone within 24h and capture follow-up evidence.",
                "confidence": 0.62,
                "mode": "local_stub_reasoning",
                "grounded_by": retrieval_event_id,
            },
        )
        self.store.append(rec)
        return rec
