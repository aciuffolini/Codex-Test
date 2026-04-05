from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_api import TwinCapabilities
from vnext_twin_core import TwinService
from vnext_twin_core.models import ContractError, TwinEvent


class Slice1Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "events.json"
        self.service = TwinService(self.db)

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

    def test_duplicate_event_rejected(self) -> None:
        visit_id = self.service.start_visit()
        event = TwinEvent.make("audit_history_event", visit_id, {"action": "x"})
        self.service.store.append(event)
        with self.assertRaises(ContractError):
            self.service.store.append(event)

    def test_api_facade_consistency(self) -> None:
        caps = TwinCapabilities(self.db)
        visit_id = caps.ingest_visit()
        caps.upload_media(visit_id, "photo", "local://b.jpg")
        retrieval = caps.retrieve_context(visit_id, "question")
        rec = caps.ask_twin(visit_id, retrieval.event_id, "next")
        self.assertEqual(rec.payload["grounded_by"], retrieval.event_id)


if __name__ == "__main__":
    unittest.main()
