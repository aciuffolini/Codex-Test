"""Retrieval boundary for Vertical Slice 1 (local-only context)."""
from __future__ import annotations

from .models import TwinEvent, ContractError
from .store import TwinStore


class RetrievalService:
    def __init__(self, store: TwinStore):
        self.store = store

    def retrieve_context(self, visit_id: str, question: str) -> TwinEvent:
        if not question.strip():
            raise ContractError("question is required")
        events = self.store.list_events(visit_id)
        if not events:
            raise ContractError("cannot retrieve context for unknown visit")

        compact = [
            {
                "event_type": e["event_type"],
                "ts": e["ts"],
            }
            for e in events
        ][-10:]
        retrieval = TwinEvent.make(
            "retrieval_context",
            visit_id,
            {
                "question": question,
                "items": compact,
                "grounded": True,
                "source": "local_twin_memory",
            },
        )
        self.store.append(retrieval)
        return retrieval
