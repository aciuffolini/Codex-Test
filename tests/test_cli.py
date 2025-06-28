import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from helloapp.cli import greet
import subprocess




def test_greet():
    assert greet("Codex") == "Hello, Codex!"


def test_cli_output():
    result = subprocess.run(
        [sys.executable, "-m", "helloapp.cli", "Codex"],
        capture_output=True,
        text=True,
        check=True,
    )
    assert result.stdout.strip() == "Hello, Codex!"
