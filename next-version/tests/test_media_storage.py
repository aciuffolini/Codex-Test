"""Tests for the multimodal backend storage (media upload/serve)."""
from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from gateway.app import create_app


class GatewayMediaStorageTests(unittest.TestCase):
    """Test media upload and serving via StaticFiles."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.db_path = Path(cls.tmp.name) / "test-media.db"
        cls.app = create_app(db_path=cls.db_path)
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_media_upload_saves_file_and_serves_it(self):
        """Upload a dummy image and verify it gets saved to disk and served."""
        # Start a visit first to satisfy state requirements
        r_start = self.client.post("/api/action", json={"action": "start_visit"})
        self.assertEqual(r_start.status_code, 200)
        
        # Determine visit_id from state
        state_r = self.client.get("/api/state")
        visit_id = state_r.json()["state"]["active_visit_id"]
        
        file_content = b"fake-jpg-content"

        # 1. Upload
        r = self.client.post(
            "/sync/media/upload",
            data={"visit_id": visit_id, "type": "photo"},
            files={"file": ("test.jpg", io.BytesIO(file_content), "image/jpeg")},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertIn("uri", data)
        uri = data["uri"]
        self.assertTrue(uri.startswith(f"/media/{visit_id}/"))

        # 2. Verify on disk
        # uri is like /media/visit_id/uuid.jpg
        # The file is saved at DATA_DIR / "media" / visit_id / uuid.jpg
        # We can extract the relative path
        rel_path = uri.lstrip("/media/")
        actual_path = self.db_path.parent / "media" / rel_path
        self.assertTrue(actual_path.exists())
        self.assertEqual(actual_path.read_bytes(), file_content)

        # 3. Verify serving via StaticFiles mount
        r2 = self.client.get(uri)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.content, file_content)
