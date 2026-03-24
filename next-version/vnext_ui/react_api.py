"""Local in-process API for thin React cockpit over Slice-1 controller.

No external backend integration; this only exposes current local controller behavior.
"""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .baseline_adapter import BaselineCockpitAdapter

ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = Path(__file__).resolve().parent / "react_cockpit"
BASELINE_SHAPE_DIR = STATIC_DIR / "baseline_shape"


class ReactCockpitApi:
    def __init__(self, db_path: Path):
        self.adapter = BaselineCockpitAdapter(db_path)

    def dispatch(self, action: str, payload: dict):
        return self.adapter.act(action, payload)


def make_handler(api: ReactCockpitApi):
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, code: int, obj: dict):
            body = json.dumps(obj).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_file(self, path: Path, content_type: str):
            if not path.exists():
                self.send_error(404)
                return
            data = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path in ["/", "/index.html"]:
                self._send_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
                return
            if parsed.path in ["/baseline", "/baseline/"]:
                self._send_file(BASELINE_SHAPE_DIR / "index.html", "text/html; charset=utf-8")
                return
            if parsed.path.startswith("/baseline/apps/web/src/"):
                rel = parsed.path.replace("/baseline/", "")
                self._send_file(BASELINE_SHAPE_DIR / rel, "application/javascript; charset=utf-8")
                return
            if parsed.path == "/app.js":
                self._send_file(STATIC_DIR / "app.js", "application/javascript; charset=utf-8")
                return
            if parsed.path == "/api/state":
                self._send_json(200, {"state": api.adapter.state})
                return
            self.send_error(404)

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path != "/api/action":
                self.send_error(404)
                return

            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                self._send_json(400, {"error": "invalid json"})
                return

            action = payload.get("action")
            state, err = api.dispatch(action, payload)
            self._send_json(200, {"ok": err is None, "error": err, "state": state.__dict__})

        def log_message(self, format, *args):  # noqa: A003
            return

    return Handler


def run_server(host: str = "127.0.0.1", port: int = 8765):
    api = ReactCockpitApi(ROOT / "data" / "react-cockpit-events.json")
    server = ThreadingHTTPServer((host, port), make_handler(api))
    print(f"React cockpit server running at http://{host}:{port}")
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
