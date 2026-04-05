"""Reasoning boundary for vNext — pluggable reasoning after retrieval.

Rule enforced: ask/recommend requires retrieval_context first.
Provider pattern: reasoning is delegated to pluggable providers.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .models import TwinEvent, ContractError
from .store_base import TwinStoreBase


class ReasoningProvider(ABC):
    """Abstract reasoning provider interface."""

    @abstractmethod
    def synthesize(
        self, retrieval_snapshot: dict[str, Any], question: str
    ) -> dict[str, Any]:
        """Generate recommendation from retrieval snapshot + question.

        Returns dict with: recommendation, confidence, mode.
        """
        ...


class LocalStubProvider(ReasoningProvider):
    """Stub provider returning a fixed recommendation.

    Used for development and testing; no external API calls.
    """

    def synthesize(
        self, retrieval_snapshot: dict[str, Any], question: str
    ) -> dict[str, Any]:
        item_count = retrieval_snapshot.get("item_count", 0)
        max_score = retrieval_snapshot.get("max_score", 0.0)

        return {
            "recommendation": (
                "Inspect affected zone within 24h and capture follow-up evidence."
            ),
            "confidence": round(min(0.5 + max_score * 0.3, 0.95), 2),
            "mode": "local_stub_reasoning",
            "context_items_used": item_count,
        }


class CloudProvider(ReasoningProvider):
    """Cloud LLM reasoning provider skeleton.

    When wired to a real API (e.g. OpenAI, Gemini), this provider would:
    1. Format the retrieval snapshot + question as a prompt
    2. Call the LLM API with appropriate system instructions
    3. Parse and return the structured recommendation

    Current implementation raises NotImplementedError.
    """

    def __init__(self, api_key: str | None = None, model: str = "default"):
        self.api_key = api_key
        self.model = model

    def synthesize(
        self, retrieval_snapshot: dict[str, Any], question: str
    ) -> dict[str, Any]:
        raise NotImplementedError(
            f"CloudProvider ({self.model}) not yet wired to a real API. "
            "Use LocalStubProvider for development."
        )


class ReasoningService:
    def __init__(self, store: TwinStoreBase, provider: ReasoningProvider | None = None):
        self.store = store
        self.provider = provider or LocalStubProvider()

    def ask_twin(
        self, visit_id: str, retrieval_event_id: str, question: str
    ) -> TwinEvent:
        if not question.strip():
            raise ContractError("question is required")

        # Validate retrieval exists
        retrieval_events = [
            e
            for e in self.store.list_events(visit_id)
            if e["event_type"] == "retrieval_context"
            and e["event_id"] == retrieval_event_id
        ]
        if not retrieval_events:
            raise ContractError("retrieval_context is required before reasoning")

        retrieval_snapshot = retrieval_events[0]["payload"]

        # Delegate to provider
        result = self.provider.synthesize(retrieval_snapshot, question)

        rec = TwinEvent.make(
            "recommendation_event",
            visit_id,
            {
                "question": question,
                "recommendation": result["recommendation"],
                "confidence": result["confidence"],
                "mode": result["mode"],
                "grounded_by": retrieval_event_id,
                "context_items_used": result.get("context_items_used", 0),
            },
        )
        self.store.append(rec)
        return rec
