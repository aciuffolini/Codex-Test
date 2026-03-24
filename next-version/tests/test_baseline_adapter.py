from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_ui.baseline_adapter import BaselineCockpitAdapter


class BaselineAdapterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.adapter = BaselineCockpitAdapter(Path(self.tmp.name) / "adapter-events.json")

    def tearDown(self):
        self.tmp.cleanup()

    def test_slice_a_flow_and_status_surfaces(self):
        self.assertTrue(self.adapter.act("start_visit", {})[1] is None)
        self.adapter.act("capture", {"observation": "obs"})
        self.adapter.act("review_correct", {"corrected_observation": "corr"})
        self.adapter.act("save_local", {})
        self.adapter.act("sync", {"online": False})
        self.adapter.act("retrieve", {"question": "what now"})
        self.adapter.act("ask", {"question": "recommend"})
        self.adapter.act("decide", {"decision": "accepted"})
        state = self.adapter.state
        self.assertEqual(state["slice_state"], "finalized")
        self.assertEqual(state["sync_status"], "queued")

    def test_retrieval_before_reasoning_enforced(self):
        self.adapter.act("start_visit", {})
        self.adapter.act("capture", {"observation": "obs"})
        self.adapter.act("review_correct", {"corrected_observation": "corr"})
        self.adapter.act("save_local", {})
        state, err = self.adapter.act("ask", {"question": "premature"})
        self.assertIsNotNone(err)
        self.assertIn("retrieval_context", err)
        self.assertIn("retrieval_context", state.last_error)


if __name__ == "__main__":
    unittest.main()
