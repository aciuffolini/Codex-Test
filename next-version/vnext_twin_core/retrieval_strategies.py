"""Retrieval strategy pattern for unified multimodal grounding.

Strategies define how context is gathered from different data sources.
Each strategy returns scored items with provenance metadata.

Architectural note: The unified pipeline combines results from multiple
strategies (text, image, structured data) into a single retrieval_context
event with per-item provenance (modality, score, source).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import hashlib
from typing import Any


class RetrievalItem:
    """A single retrieved item with provenance."""

    __slots__ = ("event_type", "ts", "score", "source", "modality", "content")

    def __init__(
        self,
        event_type: str,
        ts: str,
        score: float,
        source: str,
        modality: str = "text",
        content: dict[str, Any] | None = None,
    ):
        self.event_type = event_type
        self.ts = ts
        self.score = score
        self.source = source
        self.modality = modality
        self.content = content or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "ts": self.ts,
            "score": self.score,
            "source": self.source,
            "modality": self.modality,
            "content": self.content,
        }


class RetrievalStrategy(ABC):
    """Abstract base for retrieval strategies."""

    @abstractmethod
    def retrieve(
        self, events: list[dict[str, Any]], question: str
    ) -> list[RetrievalItem]:
        """Retrieve and score items from the given events."""
        ...


class LocalTwinStrategy(RetrievalStrategy):
    """Retrieve from local Twin event history with keyword + recency scoring.

    Scoring formula:
    - keyword_score: fraction of question keywords found in event payload
    - recency_score: exponential decay from most recent event
    - final_score: 0.6 * keyword_score + 0.4 * recency_score
    """

    def retrieve(
        self, events: list[dict[str, Any]], question: str
    ) -> list[RetrievalItem]:
        if not events:
            return []

        question_lower = question.lower()
        keywords = set(question_lower.split())

        items: list[RetrievalItem] = []
        n = len(events)

        for i, event in enumerate(events):
            # Keyword matching against payload
            payload_text = str(event.get("payload", {})).lower()
            matched = sum(1 for kw in keywords if kw in payload_text)
            keyword_score = matched / max(len(keywords), 1)

            # Recency score: more recent = higher (exponential decay)
            recency_score = (i + 1) / n

            # Composite score
            score = round(0.6 * keyword_score + 0.4 * recency_score, 3)

            items.append(
                RetrievalItem(
                    event_type=event.get("event_type", "unknown"),
                    ts=event.get("ts", ""),
                    score=score,
                    source="local_twin_memory",
                    modality="text",
                    content={
                        "event_id": event.get("event_id"),
                        "payload_summary": str(event.get("payload", {}))[:100],
                    },
                )
            )

        # Sort by score descending, return top 10
        items.sort(key=lambda x: x.score, reverse=True)
        return items[:10]


class StructuredDataStrategy(RetrievalStrategy):
    """Retrieve from structured data within events (e.g. SQL-shaped fields).

    Looks for structured fields: location_context, media_asset metadata,
    and observation payloads with specific field values.
    """

    STRUCTURED_EVENT_TYPES = {"location_context", "media_asset", "observation"}

    def retrieve(
        self, events: list[dict[str, Any]], question: str
    ) -> list[RetrievalItem]:
        items: list[RetrievalItem] = []

        for event in events:
            if event.get("event_type") not in self.STRUCTURED_EVENT_TYPES:
                continue

            payload = event.get("payload", {})
            question_lower = question.lower()

            # Score based on relevance to query
            score = 0.3  # base score for being structured data
            payload_text = str(payload).lower()
            for word in question_lower.split():
                if word in payload_text:
                    score += 0.1

            items.append(
                RetrievalItem(
                    event_type=event.get("event_type", "unknown"),
                    ts=event.get("ts", ""),
                    score=min(round(score, 3), 1.0),
                    source="structured_twin_data",
                    modality="structured",
                    content={
                        "event_id": event.get("event_id"),
                        "fields": payload,
                    },
                )
            )

        items.sort(key=lambda x: x.score, reverse=True)
        return items[:5]


class EmbeddingStrategy(RetrievalStrategy):
    """Stub for future vector embedding-based retrieval.

    When wired to ChromaDB or similar, this strategy would:
    1. Embed the question using text/CLIP encoder
    2. Query the vector collection
    3. Return scored results with provenance

    Current implementation returns empty list (graceful degradation).
    """

    def retrieve(
        self, events: list[dict[str, Any]], question: str
    ) -> list[RetrievalItem]:
        # Stub — returns empty; will be wired to ChromaDB in production
        return []


def compute_query_hash(question: str) -> str:
    """Deterministic hash for retrieval deduplication and auditing."""
    return hashlib.sha256(question.strip().lower().encode()).hexdigest()[:16]


def merge_strategies(
    strategies: list[RetrievalStrategy],
    events: list[dict[str, Any]],
    question: str,
    max_items: int = 10,
) -> list[RetrievalItem]:
    """Combine results from multiple strategies, deduplicate, re-rank."""
    all_items: list[RetrievalItem] = []
    seen: set[str] = set()

    for strategy in strategies:
        for item in strategy.retrieve(events, question):
            # Deduplicate by event_id
            event_id = item.content.get("event_id", "")
            if event_id and event_id in seen:
                continue
            if event_id:
                seen.add(event_id)
            all_items.append(item)

    # Final ranking: sort by score descending
    all_items.sort(key=lambda x: x.score, reverse=True)
    return all_items[:max_items]
