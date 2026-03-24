"""Single-path sync contract stub for Vertical Slice 1.

Deferred:
- real network transport
- conflict resolution
- retries/backoff strategy
"""
from __future__ import annotations

from .models import TwinEvent
from .store import TwinStore


class SyncEngine:
    def __init__(self, store: TwinStore):
        self.store = store

    def sync_visit(self, visit_id: str, online: bool) -> TwinEvent:
        status = "succeeded" if online else "queued"

        # Idempotent behavior for repeated same-status calls.
        prior = [
            e for e in self.store.list_events(visit_id)
            if e["event_type"] == "sync_event" and e["payload"].get("status") == status
        ]
        if prior:
            return TwinEvent.from_dict(prior[-1])

        event = TwinEvent.make(
            "sync_event",
            visit_id,
            {
                "status": status,
                "mode": "single_path",
                "idempotency_key": f"{visit_id}:{status}",
            },
        )
        self.store.append(event)
        return event
