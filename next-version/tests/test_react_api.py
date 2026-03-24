from __future__ import annotations

import json
import threading
import time
import unittest
from http.client import HTTPConnection
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vnext_ui.react_api import ReactCockpitApi, make_handler
from http.server import ThreadingHTTPServer


class ReactApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db = Path(__file__).resolve().parents[1] / "data" / "react-api-test-events.json"
        api = ReactCockpitApi(db)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(api))
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.05)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def post(self, action: str, **payload):
        conn = HTTPConnection("127.0.0.1", self.port, timeout=3)
        body = json.dumps({"action": action, **payload})
        conn.request("POST", "/api/action", body=body, headers={"Content-Type": "application/json"})
        res = conn.getresponse()
        data = json.loads(res.read().decode("utf-8"))
        conn.close()
        return data

    def test_static_baseline_shape_route_available(self):
        conn = HTTPConnection("127.0.0.1", self.port, timeout=3)
        conn.request("GET", "/baseline")
        res = conn.getresponse()
        body = res.read().decode("utf-8")
        conn.close()
        self.assertEqual(res.status, 200)
        self.assertIn("Baseline-Shaped Slice A Cockpit", body)

    def test_api_canonical_flow(self):
        self.assertTrue(self.post("start_visit")["ok"])
        self.assertTrue(self.post("capture", observation="obs")["ok"])
        self.assertTrue(self.post("review_correct", corrected_observation="corr")["ok"])
        self.assertTrue(self.post("save_local")["ok"])
        sync = self.post("sync", online=False)
        self.assertTrue(sync["ok"])
        self.assertEqual(sync["state"]["sync_status"], "queued")
        self.assertTrue(self.post("retrieve", question="what now")["ok"])
        self.assertTrue(self.post("ask", question="recommend")["ok"])
        decide = self.post("decide", decision="accepted")
        self.assertTrue(decide["ok"])
        self.assertEqual(decide["state"]["slice_state"], "finalized")

    def test_retrieval_before_reasoning_enforced(self):
        self.post("start_visit")
        self.post("capture", observation="obs")
        self.post("review_correct", corrected_observation="corr")
        self.post("save_local")
        ask = self.post("ask", question="no retrieval")
        self.assertFalse(ask["ok"])
        self.assertIn("retrieval_context", ask["error"])


if __name__ == "__main__":
    unittest.main()
