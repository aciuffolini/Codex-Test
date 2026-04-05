"""Tests for SqliteTwinStore — mirrors Slice-1 tests + SQLite-specific cases."""
from __future__ import annotations

import json
import tempfile
import threading
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_twin_core.sqlite_store import SqliteTwinStore
from vnext_twin_core.models import ContractError, TwinEvent
from vnext_twin_core import TwinService


class SqliteStoreUnitTests(unittest.TestCase):
    """Unit tests for SqliteTwinStore interface compliance."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "test_events.db"
        self.store = SqliteTwinStore(self.db)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_append_and_list(self) -> None:
        event = TwinEvent.make("visit_event", "v1", {"status": "draft"})
        self.store.append(event)
        events = self.store.list_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_id"], event.event_id)

    def test_list_by_visit_id(self) -> None:
        self.store.append(TwinEvent.make("visit_event", "v1", {"status": "draft"}))
        self.store.append(TwinEvent.make("visit_event", "v2", {"status": "draft"}))
        self.assertEqual(len(self.store.list_events("v1")), 1)
        self.assertEqual(len(self.store.list_events("v2")), 1)
        self.assertEqual(len(self.store.list_events()), 2)

    def test_duplicate_event_rejected(self) -> None:
        event = TwinEvent.make("audit_history_event", "v1", {"action": "x"})
        self.store.append(event)
        with self.assertRaises(ContractError):
            self.store.append(event)

    def test_latest_visit_state(self) -> None:
        self.store.append(TwinEvent.make("visit_event", "v1", {"status": "draft"}))
        self.assertEqual(self.store.latest_visit_state("v1"), "draft")
        self.store.append(TwinEvent.make("visit_event", "v1", {"status": "reviewed"}))
        self.assertEqual(self.store.latest_visit_state("v1"), "reviewed")

    def test_latest_visit_state_unknown_visit(self) -> None:
        self.assertIsNone(self.store.latest_visit_state("nonexistent"))


class SqliteServiceIntegrationTests(unittest.TestCase):
    """Full canonical flow using TwinService with SqliteTwinStore backend."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "service_events.db"
        self.store = SqliteTwinStore(self.db)
        self.service = TwinService(store=self.store)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_happy_path_end_to_end(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 1.0, 2.0)
        self.service.review_and_correct(visit_id, "corrected")
        self.service.save_local(visit_id)
        sync_event = self.service.sync(visit_id, online=True)
        retrieval = self.service.retrieve(visit_id, "what now")
        rec = self.service.ask(visit_id, retrieval.event_id, "next action")
        self.service.decide(visit_id, "accepted")

        self.assertEqual(sync_event.payload["status"], "succeeded")
        self.assertEqual(rec.event_type, "recommendation_event")
        self.assertEqual(self.service.store.latest_visit_state(visit_id), "finalized")

    def test_offline_sync_status(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 1.0, 2.0)
        self.service.review_and_correct(visit_id, "corrected")
        sync_event = self.service.sync(visit_id, online=False)
        self.assertEqual(sync_event.payload["status"], "queued")

    def test_reasoning_requires_retrieval(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 1.0, 2.0)
        self.service.review_and_correct(visit_id, "corrected")
        with self.assertRaises(ContractError):
            self.service.ask(visit_id, "missing", "next")

    def test_sync_idempotent_same_status(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 1.0, 2.0)
        self.service.review_and_correct(visit_id, "corrected")
        first = self.service.sync(visit_id, online=False)
        second = self.service.sync(visit_id, online=False)
        self.assertEqual(first.event_id, second.event_id)


class SqliteConcurrencyTests(unittest.TestCase):
    """Verify SQLite store handles concurrent writes without corruption."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "concurrent_events.db"
        self.store = SqliteTwinStore(self.db)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_concurrent_append_no_corruption(self) -> None:
        """Two threads appending events should not corrupt or lose data."""
        errors: list[Exception] = []
        visit_id = "concurrent-test"

        # Pre-create the visit
        self.store.append(TwinEvent.make("visit_event", visit_id, {"status": "draft"}))

        def append_events(prefix: str, count: int) -> None:
            try:
                for i in range(count):
                    self.store.append(
                        TwinEvent.make("observation", visit_id, {"text": f"{prefix}-{i}"})
                    )
            except Exception as e:
                errors.append(e)

        t1 = threading.Thread(target=append_events, args=("thread1", 20))
        t2 = threading.Thread(target=append_events, args=("thread2", 20))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(len(errors), 0, f"Concurrent append errors: {errors}")
        # 1 visit_event + 40 observations
        events = self.store.list_events(visit_id)
        self.assertEqual(len(events), 41)


class SqliteMigrationTests(unittest.TestCase):
    """Test migration from JSON store to SQLite store."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_from_json_store_migrates_all_events(self) -> None:
        json_path = Path(self.tmp.name) / "events.json"
        sqlite_path = Path(self.tmp.name) / "migrated.db"

        # Create JSON fixture with 3 events
        events = []
        for i, (etype, payload) in enumerate([
            ("visit_event", {"status": "draft"}),
            ("observation", {"text": "obs1"}),
            ("visit_event", {"status": "reviewed"}),
        ]):
            event = TwinEvent.make(etype, "v1", payload)
            events.append(event.to_dict())

        json_path.write_text(json.dumps({"events": events}))

        # Migrate
        sqlite_store = SqliteTwinStore.from_json_store(json_path, sqlite_path)
        migrated = sqlite_store.list_events("v1")

        self.assertEqual(len(migrated), 3)
        self.assertEqual(migrated[0]["event_type"], "visit_event")
        self.assertEqual(migrated[1]["event_type"], "observation")
        self.assertEqual(migrated[2]["payload"]["status"], "reviewed")

    def test_from_json_store_idempotent(self) -> None:
        """Running migration twice should not duplicate events."""
        json_path = Path(self.tmp.name) / "events.json"
        sqlite_path = Path(self.tmp.name) / "migrated.db"

        event = TwinEvent.make("visit_event", "v1", {"status": "draft"})
        json_path.write_text(json.dumps({"events": [event.to_dict()]}))

        SqliteTwinStore.from_json_store(json_path, sqlite_path)
        store = SqliteTwinStore.from_json_store(json_path, sqlite_path)  # second run
        self.assertEqual(len(store.list_events()), 1)


if __name__ == "__main__":
    unittest.main()
