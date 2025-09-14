"""Simple schema migration helpers for scenario storage."""

from __future__ import annotations

SCHEMA_VERSION = 1


def migrate(data: dict) -> dict:
    """Upgrade older schema versions to the current format."""
    version = data.get("version", 0)
    if version < 1:
        # Legacy files may just be a list of scenarios without metadata
        scenarios = data if isinstance(data, list) else data.get("scenarios", [])
        data = {"version": 1, "scenarios": scenarios}
        version = 1
    # Future migrations would be chained here
    data["version"] = SCHEMA_VERSION
    return data
