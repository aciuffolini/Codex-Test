"""Vertical Slice 1 Twin event model + contract validation."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Literal
import uuid

EventType = Literal[
    "visit_event",
    "observation",
    "media_asset",
    "location_context",
    "sync_event",
    "retrieval_context",
    "recommendation_event",
    "user_correction_event",
    "audit_history_event",
]

VISIT_ALLOWED_STATES = {"draft", "reviewed", "finalized"}
SYNC_ALLOWED_STATUSES = {"queued", "in_progress", "succeeded", "failed"}


class ContractError(ValueError):
    """Raised when incoming event/capability payload violates Slice-1 contracts."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TwinEvent:
    event_id: str
    event_type: EventType
    visit_id: str
    payload: dict[str, Any]
    ts: str
    farm_id: str | None = None

    @staticmethod
    def make(event_type: EventType, visit_id: str, payload: dict[str, Any], farm_id: str | None = None) -> "TwinEvent":
        if not visit_id:
            raise ContractError("visit_id is required")
        if not isinstance(payload, dict):
            raise ContractError("payload must be a dict")
        event = TwinEvent(
            event_id=str(uuid.uuid4()),
            event_type=event_type,
            visit_id=visit_id,
            payload=payload,
            ts=utc_now(),
            farm_id=farm_id,
        )
        event.validate()
        return event

    def validate(self) -> None:
        if not self.event_id:
            raise ContractError("event_id is required")
        if self.event_type == "visit_event":
            status = self.payload.get("status")
            if status is not None and status not in VISIT_ALLOWED_STATES:
                raise ContractError(f"invalid visit state: {status}")
        if self.event_type == "sync_event":
            status = self.payload.get("status")
            if status not in SYNC_ALLOWED_STATUSES:
                raise ContractError(f"invalid sync status: {status}")
        if self.event_type == "retrieval_context":
            if not self.payload.get("question"):
                raise ContractError("retrieval_context requires question")
            if self.payload.get("grounded") is not True:
                raise ContractError("retrieval_context must be grounded=True")
        if self.event_type == "recommendation_event":
            if not self.payload.get("grounded_by"):
                raise ContractError("recommendation_event requires grounded_by retrieval id")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "TwinEvent":
        event = TwinEvent(**data)
        event.validate()
        return event
