"""Tests for upgraded retrieval service with ranked scoring and provenance."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_twin_core import TwinService
from vnext_twin_core.sqlite_store import SqliteTwinStore
from vnext_twin_core.models import ContractError, TwinEvent
from vnext_twin_core.retrieval_contract import validate_retrieval_context


class RetrievalProviderTests(unittest.TestCase):
    """Test ranked retrieval with provenance."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = SqliteTwinStore(Path(self.tmp.name) / "retrieval-test.db")
        self.service = TwinService(store=self.store)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_retrieval_returns_scored_items_with_provenance(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "leaf rust detected on wheat", "local://a.jpg", -31.5, -64.3)
        self.service.review_and_correct(visit_id, "confirmed leaf rust on plot A3")

        retrieval = self.service.retrieve(visit_id, "leaf rust wheat")

        self.assertEqual(retrieval.event_type, "retrieval_context")
        self.assertTrue(retrieval.payload["grounded"])
        self.assertIn("query_hash", retrieval.payload)
        self.assertIn("max_score", retrieval.payload)
        self.assertIn("strategies_used", retrieval.payload)
        self.assertEqual(retrieval.payload["source"], "unified_multimodal_pipeline")

        items = retrieval.payload["items"]
        self.assertGreater(len(items), 0)

        # Each item should have score, source, modality
        for item in items:
            self.assertIn("score", item)
            self.assertIn("source", item)
            self.assertIn("modality", item)
            self.assertGreaterEqual(item["score"], 0.0)
            self.assertLessEqual(item["score"], 1.0)

    def test_retrieval_contract_validation_passes(self) -> None:
        """Retrieval output satisfies formal contract."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)

        retrieval = self.service.retrieve(visit_id, "what is the current status?")
        violations = validate_retrieval_context(retrieval.payload)
        self.assertEqual(violations, [], f"Contract violations: {violations}")

    def test_empty_question_raises_contract_error(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        with self.assertRaises(ContractError):
            self.service.retrieve(visit_id, "")

    def test_unknown_visit_raises_contract_error(self) -> None:
        with self.assertRaises(ContractError):
            self.service.retrieve("nonexistent-visit", "hello")

    def test_items_are_sorted_by_score_descending(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "drought stress wheat", "local://a.jpg", 0.0, 0.0)
        self.service.capture(visit_id, "normal healthy corn", "local://b.jpg", 0.0, 0.0)

        retrieval = self.service.retrieve(visit_id, "drought wheat stress")
        items = retrieval.payload["items"]

        scores = [item["score"] for item in items]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_recommendation_references_valid_retrieval_id(self) -> None:
        """Every recommendation_event must reference a valid retrieval_context id."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        retrieval = self.service.retrieve(visit_id, "next action")
        rec = self.service.ask(visit_id, retrieval.event_id, "recommend")

        self.assertEqual(rec.payload["grounded_by"], retrieval.event_id)

        # Verify the referenced retrieval exists in the store
        events = self.store.list_events(visit_id)
        retrieval_ids = [
            e["event_id"] for e in events
            if e["event_type"] == "retrieval_context"
        ]
        self.assertIn(rec.payload["grounded_by"], retrieval_ids)

    def test_reasoning_without_retrieval_still_fails(self) -> None:
        """Guard: asking without retrieval still raises ContractError."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")
        with self.assertRaises(ContractError):
            self.service.ask(visit_id, "fake-id", "premature question")

    def test_query_hash_is_deterministic(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)

        r1 = self.service.retrieve(visit_id, "same question")
        r2 = self.service.retrieve(visit_id, "same question")

        self.assertEqual(r1.payload["query_hash"], r2.payload["query_hash"])

    def test_strategies_used_list_populated(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)

        retrieval = self.service.retrieve(visit_id, "what happened")
        strategies = retrieval.payload["strategies_used"]
        self.assertIn("LocalTwinStrategy", strategies)
        self.assertIn("StructuredDataStrategy", strategies)
        self.assertIn("EmbeddingStrategy", strategies)


if __name__ == "__main__":
    unittest.main()
