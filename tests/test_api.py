import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402
from risksim.api import app  # noqa: E402


def default_payload() -> dict:
    return {
        "precio_compra": 950,
        "precio_venta": 835,
        "num_cabezas": 100,
        "peso_compra": 200,
        "peso_salida": 460,
        "precio_por_tn": 64,
        "conversion": 8,
        "mortandad": 1,
        "adpv": 1.2,
        "estadia": 30,
        "sanidad": 1200,
    }


def test_compute_endpoint(tmp_path) -> None:
    client = TestClient(app)
    payload = default_payload()
    response = client.post("/compute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["margen_neto"] == 53280.0

    out_file = Path(tmp_path) / "response.json"
    out_file.write_text(json.dumps(data))
    assert json.loads(out_file.read_text()) == data
