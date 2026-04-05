"""Local-first Twin memory store for Vertical Slice 1."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import TwinEvent, ContractError
from .store_base import TwinStoreBase


class TwinStore(TwinStoreBase):
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.db_path.exists():
            self._write({"events": []})

    def _read(self) -> dict[str, Any]:
        return json.loads(self.db_path.read_text())

    def _write(self, data: dict[str, Any]) -> None:
        self.db_path.write_text(json.dumps(data, indent=2))

    def create_farm(self, farm_id: str, name: str, kmz_data: str | None = None) -> None:
        from datetime import datetime, timezone
        created_at = datetime.now(timezone.utc).isoformat()
        data = self._read()
        if "farms" not in data:
            data["farms"] = {}
        data["farms"][farm_id] = {
            "farm_id": farm_id,
            "name": name,
            "created_at": created_at,
            "kmz_data": kmz_data
        }
        self._write(data)

    def list_farms(self) -> list[dict[str, Any]]:
        data = self._read()
        farms = list(data.get("farms", {}).values())
        farms.sort(key=lambda x: x["created_at"], reverse=True)
        return farms

    def append(self, event: TwinEvent) -> None:
        event.validate()
        data = self._read()
        if any(e["event_id"] == event.event_id for e in data["events"]):
            raise ContractError(f"duplicate event_id: {event.event_id}")
        data["events"].append(event.to_dict())
        self._write(data)

    def list_events(self, visit_id: str | None = None) -> list[dict[str, Any]]:
        events = self._read()["events"]
        if visit_id is None:
            return events
        return [e for e in events if e["visit_id"] == visit_id]

    def latest_visit_state(self, visit_id: str) -> str | None:
        visit_events = [e for e in self.list_events(visit_id) if e["event_type"] == "visit_event"]
        if not visit_events:
            return None
        return visit_events[-1]["payload"].get("status")
