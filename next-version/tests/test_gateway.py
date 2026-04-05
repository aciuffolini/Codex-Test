"""Integration tests for the vNext compatibility gateway.

Tests cover golden fixture shapes, retrieval-before-reasoning enforcement,
and baseline-compatible route behavior.
"""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from gateway.app import create_app


class GatewayHealthTests(unittest.TestCase):
    """Health endpoint tests."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(db_path=Path(cls.tmp.name) / "test-gateway.db")
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_health_returns_valid_json(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("timestamp", data)
        self.assertIn("twin_capabilities", data)

    def test_health_lists_all_8_capabilities(self):
        response = self.client.get("/health")
        caps = response.json()["twin_capabilities"]
        self.assertEqual(len(caps), 8)
        self.assertIn("ingest_visit", caps)
        self.assertIn("ask_twin", caps)


class GatewayActionFlowTests(unittest.TestCase):
    """Test the /api/action endpoint with the canonical flow."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(db_path=Path(cls.tmp.name) / "test-action-flow.db")
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_canonical_action_flow(self):
        """Full canonical flow through /api/action endpoint."""
        # Start visit
        r = self.client.post("/api/action", json={"action": "start_visit"})
        self.assertTrue(r.json()["ok"])

        # Capture
        r = self.client.post("/api/action", json={"action": "capture", "observation": "leaf rust detected"})
        self.assertTrue(r.json()["ok"])

        # Review
        r = self.client.post("/api/action", json={
            "action": "review_correct",
            "corrected_observation": "confirmed leaf rust on plot A3",
        })
        self.assertTrue(r.json()["ok"])

        # Save local
        r = self.client.post("/api/action", json={"action": "save_local"})
        self.assertTrue(r.json()["ok"])

        # Sync (offline)
        r = self.client.post("/api/action", json={"action": "sync", "online": False})
        self.assertTrue(r.json()["ok"])
        self.assertEqual(r.json()["sync_status"], "queued")

        # Retrieve
        r = self.client.post("/api/action", json={"action": "retrieve", "question": "what is the risk?"})
        self.assertTrue(r.json()["ok"])
        self.assertIn("retrieval_id", r.json())

        # Ask (should succeed — retrieval was done first)
        r = self.client.post("/api/action", json={"action": "ask", "question": "recommended next action?"})
        self.assertTrue(r.json()["ok"])
        self.assertIn("recommendation", r.json())

        # Decide
        r = self.client.post("/api/action", json={"action": "decide", "decision": "accepted"})
        self.assertTrue(r.json()["ok"])

    def test_ask_without_retrieval_fails(self):
        """Retrieval-before-reasoning enforcement via /api/action."""
        # New app instance with fresh state
        tmp2 = tempfile.TemporaryDirectory()
        app2 = create_app(db_path=Path(tmp2.name) / "test-no-retrieval.db")
        client2 = TestClient(app2)

        # Start visit and capture
        client2.post("/api/action", json={"action": "start_visit"})
        client2.post("/api/action", json={"action": "capture", "observation": "obs"})
        client2.post("/api/action", json={"action": "review_correct", "corrected_observation": "corr"})

        # Ask without retrieval — should fail
        r = client2.post("/api/action", json={"action": "ask", "question": "premature"})
        self.assertFalse(r.json()["ok"])
        self.assertIn("retrieval_context", r.json()["error"])

        tmp2.cleanup()


def _parse_sse(response_text: str) -> tuple[str, bool]:
    """Parse SSE response text and return (concatenated content, has_done_marker)."""
    import json as _json
    content_parts = []
    has_done = False
    for line in response_text.strip().split("\n"):
        line = line.strip()
        if not line.startswith("data: "):
            continue
        data = line[6:].strip()
        if data == "[DONE]":
            has_done = True
            continue
        try:
            parsed = _json.loads(data)
            token = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
            if token:
                content_parts.append(token)
        except _json.JSONDecodeError:
            pass
    return "".join(content_parts), has_done


class GatewayChatTests(unittest.TestCase):
    """Test /api/chat with SSE streaming and auto retrieval-before-reasoning."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(db_path=Path(cls.tmp.name) / "test-chat.db")
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_chat_auto_creates_visit_and_streams_sse(self):
        """Chat auto-creates a visit and returns SSE stream."""
        tmp = tempfile.TemporaryDirectory()
        app = create_app(db_path=Path(tmp.name) / "test-auto-visit-chat.db")
        client = TestClient(app)
        r = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "hello"}],
        })
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/event-stream", r.headers.get("content-type", ""))
        content, has_done = _parse_sse(r.text)
        self.assertTrue(len(content) > 0, "SSE stream should contain tokens")
        self.assertTrue(has_done, "SSE stream should end with [DONE]")
        tmp.cleanup()

    def test_chat_with_active_visit_streams_grounded_answer(self):
        """Chat auto-retrieves then reasons, returning SSE-streamed grounded answer."""
        # Set up visit via action endpoint
        self.client.post("/api/action", json={"action": "start_visit"})
        self.client.post("/api/action", json={"action": "capture", "observation": "weeds in field B"})
        self.client.post("/api/action", json={"action": "review_correct", "corrected_observation": "confirmed weeds"})

        # Chat — should auto-retrieve and reason, streamed as SSE
        r = self.client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "what should I do about the weeds?"}],
        })
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/event-stream", r.headers.get("content-type", ""))
        content, has_done = _parse_sse(r.text)
        self.assertTrue(len(content) > 0)
        self.assertTrue(has_done)


class GatewayApiHealthTests(unittest.TestCase):
    """Test /api/health mirror endpoint."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(db_path=Path(cls.tmp.name) / "test-api-health.db")
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_api_health_returns_ok(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("twin_capabilities", data)

    def test_api_health_matches_root_health(self):
        r1 = self.client.get("/health")
        r2 = self.client.get("/api/health")
        d1, d2 = r1.json(), r2.json()
        self.assertEqual(d1["status"], d2["status"])
        self.assertEqual(d1["twin_capabilities"], d2["twin_capabilities"])


class GatewayVisitsApiTests(unittest.TestCase):
    """Test POST /api/visits and GET /api/visits."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(db_path=Path(cls.tmp.name) / "test-visits-api.db")
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_post_api_visits_creates_visit(self):
        r = self.client.post("/api/visits", json={
            "id": "fe-001", "ts": 1700000000000,
            "note": "corn field inspection", "crop": "corn",
        })
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["success"])
        self.assertIn("id", data)

    def test_get_api_visits_returns_list(self):
        # Create a visit first
        self.client.post("/api/visits", json={
            "id": "fe-002", "ts": 1700000001000,
            "note": "soybean field", "crop": "soybean",
        })
        r = self.client.get("/api/visits")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("visits", data)
        self.assertIn("total", data)
        self.assertIn("hasMore", data)
        self.assertGreater(data["total"], 0)


class GatewaySyncUpsertTests(unittest.TestCase):
    """Test baseline-compatible /sync/visits/upsert."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(db_path=Path(cls.tmp.name) / "test-upsert.db")
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_upsert_creates_visit_and_syncs(self):
        """Baseline-shaped upsert creates Twin events."""
        r = self.client.post("/sync/visits/upsert", json={
            "id": "baseline-001",
            "createdAt": 1700000000000,
            "updatedAt": 1700000001000,
            "task_type": "inspection",
            "lat": -31.5,
            "lon": -64.3,
            "note": "Checking wheat field",
            "crop": "wheat",
            "issue": "drought stress",
        })
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("id", data)
        self.assertEqual(data["baseline_id"], "baseline-001")


class GatewayVisitLookupTests(unittest.TestCase):
    """Test /visits/{visit_id}."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(db_path=Path(cls.tmp.name) / "test-lookup.db")
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_visit_not_found_returns_404(self):
        r = self.client.get("/visits/nonexistent")
        self.assertEqual(r.status_code, 404)

    def test_visit_found_returns_events(self):
        # Create a visit
        self.client.post("/api/action", json={"action": "start_visit"})
        state = self.client.get("/api/state").json()
        visit_id = state["state"]["active_visit_id"]

        # Lookup
        r = self.client.get(f"/visits/{visit_id}")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["visit_id"], visit_id)
        self.assertGreater(data["event_count"], 0)


if __name__ == "__main__":
    unittest.main()
