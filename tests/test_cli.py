import os
import subprocess
import sys
from pathlib import Path


def test_cli_output(tmp_path) -> None:
    cmd = [
        sys.executable,
        "-m",
        "risksim.cli",
        "950",
        "835",
        "200",
        "460",
        "64",
        "8",
        "1",
        "1.2",
        "30",
        "1200",
        "100",
    ]
    project_root = Path(__file__).resolve().parents[1]
    env = {**os.environ, "PYTHONPATH": str(project_root)}
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=tmp_path, env=env)
    assert result.returncode == 0
    assert "Margen neto: 53280.00" in result.stdout
