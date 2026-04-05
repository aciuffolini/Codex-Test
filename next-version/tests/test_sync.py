"""Tests for sync engine consolidation — full lifecycle and error tracking."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_twin_core import TwinService
from vnext_twin_core.sqlite_store import SqliteTwinStore
from vnext_twin_core.models import TwinEvent
from vnext_twin_core.sync import SyncEngine


class SyncLifecycleTests(unittest.TestCase):
    """Full sync lifecycle tests."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = SqliteTwinStore(Path(self.tmp.name) / "sync-test.db")
        self.service = TwinService(store=self.store)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_online_sync_transitions_through_in_progress(self) -> None:
        """Online sync should emit in_progress then succeeded events."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        sync_event = self.service.sync(visit_id, online=True)
        self.assertEqual(sync_event.payload["status"], "succeeded")

        # Should have both in_progress and succeeded events
        events = self.store.list_events(visit_id)
        sync_statuses = [
            e["payload"]["status"]
            for e in events
            if e["event_type"] == "sync_event"
        ]
        self.assertIn("in_progress", sync_statuses)
        self.assertIn("succeeded", sync_statuses)

    def test_offline_sync_queues(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        sync_event = self.service.sync(visit_id, online=False)
        self.assertEqual(sync_event.payload["status"], "queued")

    def test_offline_sync_idempotent(self) -> None:
        """Calling sync offline twice returns same event."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        first = self.service.sync(visit_id, online=False)
        second = self.service.sync(visit_id, online=False)
        self.assertEqual(first.event_id, second.event_id)

    def test_sync_events_have_timestamps(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        sync_event = self.service.sync(visit_id, online=True)
        self.assertIn("timestamp", sync_event.payload)

    def test_sync_failure_records_error_reason(self) -> None:
        """Simulate failure by manually creating a failed sync event."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        # Manually record a failure
        engine = SyncEngine(self.store)
        failed = engine._emit_sync(visit_id, "failed", retry_count=1, error_reason="network_timeout")
        self.assertEqual(failed.payload["status"], "failed")
        self.assertEqual(failed.payload["error_reason"], "network_timeout")
        self.assertEqual(failed.payload["retry_count"], 1)

    def test_retry_after_failure(self) -> None:
        """After a failed sync, retrying online should succeed."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        # Create a failure
        engine = SyncEngine(self.store)
        engine._emit_sync(visit_id, "failed", retry_count=0, error_reason="network_error")

        # Now retry online — should succeed
        result = engine.sync_visit(visit_id, online=True)
        self.assertEqual(result.payload["status"], "succeeded")
        self.assertEqual(result.payload["retry_count"], 1)

    def test_no_silent_drops(self) -> None:
        """Every sync attempt must be traceable in event log."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        # Multiple sync attempts
        self.service.sync(visit_id, online=False)  # queued
        self.service.sync(visit_id, online=False)  # idempotent

        events = self.store.list_events(visit_id)
        sync_events = [e for e in events if e["event_type"] == "sync_event"]

        # At least 1 sync event, nothing was dropped
        self.assertGreaterEqual(len(sync_events), 1)

        # All sync events have status
        for e in sync_events:
            self.assertIn("status", e["payload"])


if __name__ == "__main__":
    unittest.main()
