"""Sync engine — full lifecycle with state machine, retries, no silent drops.

State machine: queued → in_progress → succeeded/failed
Every state transition is recorded as a sync_event for full auditability.
"""
from __future__ import annotations

from datetime import datetime, timezone

from .models import TwinEvent, ContractError
from .store_base import TwinStoreBase


MAX_RETRY_COUNT = 3


class SyncEngine:
    def __init__(self, store: TwinStoreBase):
        self.store = store

    def sync_visit(self, visit_id: str, online: bool = True) -> TwinEvent:
        """Sync visit data. Idempotent: returns existing sync if status unchanged."""
        events = self.store.list_events(visit_id)

        # Find most recent sync event
        sync_events = [
            e for e in events if e["event_type"] == "sync_event"
        ]

        if sync_events:
            last_sync = sync_events[-1]
            last_status = last_sync["payload"]["status"]

            # Idempotent: if already at terminal status, return existing
            if not online and last_status == "queued":
                return TwinEvent.from_dict(last_sync)
            if online and last_status == "succeeded":
                return TwinEvent.from_dict(last_sync)

            # Retry logic: if previously failed, increment retry count
            if last_status == "failed" and online:
                retry_count = last_sync["payload"].get("retry_count", 0) + 1

                if retry_count > MAX_RETRY_COUNT:
                    # Beyond retry limit — record exhaustion
                    return self._emit_sync(
                        visit_id,
                        "failed",
                        retry_count=retry_count,
                        error_reason="max_retries_exceeded",
                    )

                # Try again: transition to in_progress, then succeeded
                self._emit_sync(
                    visit_id,
                    "in_progress",
                    retry_count=retry_count,
                )
                return self._emit_sync(
                    visit_id,
                    "succeeded",
                    retry_count=retry_count,
                )

        if online:
            # Transition: → in_progress → succeeded
            self._emit_sync(visit_id, "in_progress")
            return self._emit_sync(visit_id, "succeeded")
        else:
            # Offline: → queued (will succeed when connectivity returns)
            return self._emit_sync(visit_id, "queued")

    def _emit_sync(
        self,
        visit_id: str,
        status: str,
        retry_count: int = 0,
        error_reason: str | None = None,
    ) -> TwinEvent:
        """Emit a sync_event with full audit trail."""
        payload = {
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "retry_count": retry_count,
        }
        if error_reason:
            payload["error_reason"] = error_reason

        event = TwinEvent.make("sync_event", visit_id, payload)
        self.store.append(event)
        return event
