from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional

from ..core.calculations import InputParams
from .migrations import SCHEMA_VERSION, migrate


@dataclass
class Scenario:
    """Represents a stored scenario."""

    name: str
    params: InputParams

    def to_dict(self) -> dict:
        return {"name": self.name, "params": asdict(self.params)}

    @staticmethod
    def from_dict(data: dict) -> "Scenario":
        return Scenario(name=data["name"], params=InputParams(**data["params"]))


class ScenarioRepository:
    """Persist scenarios to a JSON file."""

    def __init__(self, path: str | Path = "scenarios.json") -> None:
        self.path = Path(path)
        self.data = self._load()

    def _load(self) -> dict:
        if not self.path.exists():
            data = {"version": SCHEMA_VERSION, "scenarios": []}
            self._write(data)
            return data
        with self.path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if data.get("version", 0) < SCHEMA_VERSION:
            data = migrate(data)
            self._write(data)
        return data

    def _write(self, data: dict) -> None:
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    # CRUD operations
    def list(self) -> List[Scenario]:
        return [Scenario.from_dict(s) for s in self.data.get("scenarios", [])]

    def get(self, name: str) -> Optional[Scenario]:
        for s in self.data.get("scenarios", []):
            if s["name"] == name:
                return Scenario.from_dict(s)
        return None

    def save(self, name: str, params: InputParams) -> Scenario:
        scenario_dict = Scenario(name, params).to_dict()
        scenarios = self.data.setdefault("scenarios", [])
        for idx, existing in enumerate(scenarios):
            if existing["name"] == name:
                scenarios[idx] = scenario_dict
                self._write(self.data)
                return Scenario.from_dict(scenario_dict)
        scenarios.append(scenario_dict)
        self._write(self.data)
        return Scenario.from_dict(scenario_dict)

    def delete(self, name: str) -> None:
        scenarios = self.data.get("scenarios", [])
        self.data["scenarios"] = [s for s in scenarios if s["name"] != name]
        self._write(self.data)

    # Backup and restore helpers
    def backup(self, backup_path: str | Path) -> Path:
        backup_path = Path(backup_path)
        shutil.copy(self.path, backup_path)
        return backup_path

    def restore(self, backup_path: str | Path) -> None:
        backup_path = Path(backup_path)
        shutil.copy(backup_path, self.path)
        self.data = self._load()
