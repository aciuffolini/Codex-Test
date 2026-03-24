from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_ui.controller import CockpitController


class GuiControllerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.controller = CockpitController(Path(self.tmp.name) / "gui-events.json")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_canonical_flow_reaches_finalized(self) -> None:
        self.controller.start_visit()
        self.controller.capture("obs")
        self.controller.review_correct("corr")
        self.controller.save_local()
        self.controller.sync(online=False)
        self.controller.retrieve("what now")
        self.controller.ask("recommend")
        self.controller.decide("accepted")
        self.assertEqual(self.controller.state.slice_state, "finalized")
        self.assertEqual(self.controller.state.sync_status, "queued")

    def test_retrieval_before_reasoning_enforced_in_gui_controller(self) -> None:
        self.controller.start_visit()
        self.controller.capture("obs")
        self.controller.review_correct("corr")
        self.controller.save_local()
        state, err = self.controller.safe_call(self.controller.ask, "recommend now")
        self.assertIsNotNone(err)
        self.assertIn("retrieval_context", state.last_error)


if __name__ == "__main__":
    unittest.main()
