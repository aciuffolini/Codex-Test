"""Tests for pluggable reasoning adapter.

Property test: impossible to obtain recommendation without retrieval id.
"""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_twin_core import TwinService
from vnext_twin_core.sqlite_store import SqliteTwinStore
from vnext_twin_core.models import ContractError
from vnext_twin_core.reasoning import (
    CloudProvider,
    LocalStubProvider,
    ReasoningService,
)


class ReasoningProviderTests(unittest.TestCase):
    """Property tests for reasoning guard."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = SqliteTwinStore(Path(self.tmp.name) / "reasoning-test.db")
        self.service = TwinService(store=self.store)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_no_recommendation_without_retrieval_id(self) -> None:
        """Property: impossible to get recommendation without valid retrieval."""
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        with self.assertRaises(ContractError) as ctx:
            self.service.ask(visit_id, "nonexistent-id", "recommend")
        self.assertIn("retrieval_context", str(ctx.exception))

    def test_no_recommendation_with_empty_retrieval_id(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        with self.assertRaises(ContractError):
            self.service.ask(visit_id, "", "recommend")

    def test_no_recommendation_with_wrong_visit_retrieval(self) -> None:
        """Retrieval from visit A cannot ground reasoning for visit B."""
        v1 = self.service.start_visit()
        self.service.capture(v1, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(v1, "corrected")
        r1 = self.service.retrieve(v1, "question")

        v2 = self.service.start_visit()
        self.service.capture(v2, "obs", "local://b.jpg", 0.0, 0.0)
        self.service.review_and_correct(v2, "corrected")

        # Try to use visit 1's retrieval for visit 2
        with self.assertRaises(ContractError):
            self.service.ask(v2, r1.event_id, "recommend")

    def test_recommendation_with_valid_retrieval_succeeds(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")

        retrieval = self.service.retrieve(visit_id, "what now")
        rec = self.service.ask(visit_id, retrieval.event_id, "recommend")

        self.assertEqual(rec.event_type, "recommendation_event")
        self.assertEqual(rec.payload["grounded_by"], retrieval.event_id)
        self.assertIn("confidence", rec.payload)
        self.assertIn("mode", rec.payload)

    def test_local_stub_provider_adapts_confidence(self) -> None:
        """LocalStubProvider confidence should scale with retrieval quality."""
        provider = LocalStubProvider()

        # Low quality context
        low = provider.synthesize({"item_count": 1, "max_score": 0.1}, "q")
        # High quality context
        high = provider.synthesize({"item_count": 10, "max_score": 0.9}, "q")

        self.assertGreater(high["confidence"], low["confidence"])

    def test_cloud_provider_raises_not_implemented(self) -> None:
        """CloudProvider is a skeleton — should raise NotImplementedError."""
        provider = CloudProvider(api_key="test-key", model="gpt-4")
        with self.assertRaises(NotImplementedError):
            provider.synthesize({"items": []}, "question")

    def test_empty_question_raises_contract_error(self) -> None:
        visit_id = self.service.start_visit()
        self.service.capture(visit_id, "obs", "local://a.jpg", 0.0, 0.0)
        self.service.review_and_correct(visit_id, "corrected")
        retrieval = self.service.retrieve(visit_id, "q")

        with self.assertRaises(ContractError):
            self.service.ask(visit_id, retrieval.event_id, "")


if __name__ == "__main__":
    unittest.main()
