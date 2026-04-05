"""SQLite-backed Twin event store.

Production-shaped persistence with proper concurrent-write safety
and idempotency via PRIMARY KEY constraint on event_id.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .models import TwinEvent, ContractError
from .store_base import TwinStoreBase


class SqliteTwinStore(TwinStoreBase):
    """SQLite store that satisfies the TwinStoreBase contract."""
    DDL = """
        CREATE TABLE IF NOT EXISTS farms (
            farm_id    TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            created_at TEXT NOT NULL,
            kmz_data   TEXT
        );
        CREATE TABLE IF NOT EXISTS twin_events (
            event_id   TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            visit_id   TEXT NOT NULL,
            payload    TEXT NOT NULL,
            ts         TEXT NOT NULL,
            farm_id    TEXT NULL,
            FOREIGN KEY(farm_id) REFERENCES farms(farm_id)
        );
        CREATE INDEX IF NOT EXISTS idx_twin_events_visit_id
            ON twin_events(visit_id);
    """

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    # ---- internal ----------------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=5)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=3000")
        return conn

    def _init_schema(self) -> None:
        conn = self._connect()
        try:
            conn.executescript(self.DDL)
            conn.commit()
            
            # Backwards compatibility for existing databases
            try:
                conn.execute("ALTER TABLE twin_events ADD COLUMN farm_id TEXT")
                conn.commit()
            except sqlite3.OperationalError:
                pass # Column exists

            conn.execute("CREATE INDEX IF NOT EXISTS idx_twin_events_farm_id ON twin_events(farm_id)")
            conn.commit()
        finally:
            conn.close()

    # ---- Farm API ----------------------------------------------------------

    def create_farm(self, farm_id: str, name: str, kmz_data: str | None = None) -> None:
        from datetime import datetime, timezone
        created_at = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO farms (farm_id, name, created_at, kmz_data) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(farm_id) DO UPDATE SET name=excluded.name, kmz_data=excluded.kmz_data",
                (farm_id, name, created_at, kmz_data)
            )
            conn.commit()
        finally:
            conn.close()

    def list_farms(self) -> list[dict[str, Any]]:
        conn = self._connect()
        try:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT farm_id, name, created_at, kmz_data FROM farms ORDER BY created_at DESC").fetchall()
            result = [dict(r) for r in rows]
        finally:
            conn.close()
        return result

    # ---- Event API ---------------------------------------------------------

    def append(self, event: TwinEvent) -> None:
        event.validate()
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO twin_events (event_id, event_type, visit_id, payload, ts, farm_id) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    event.event_id,
                    event.event_type,
                    event.visit_id,
                    json.dumps(event.payload),
                    event.ts,
                    event.farm_id,
                ),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ContractError(f"duplicate event_id: {event.event_id}")
        finally:
            conn.close()

    def list_events(self, visit_id: str | None = None) -> list[dict[str, Any]]:
        conn = self._connect()
        try:
            if visit_id is None:
                cursor = conn.execute(
                    "SELECT event_id, event_type, visit_id, payload, ts, farm_id "
                    "FROM twin_events ORDER BY rowid"
                )
            else:
                cursor = conn.execute(
                    "SELECT event_id, event_type, visit_id, payload, ts, farm_id "
                    "FROM twin_events WHERE visit_id = ? ORDER BY rowid",
                    (visit_id,),
                )
            result = [
                {
                    "event_id": row[0],
                    "event_type": row[1],
                    "visit_id": row[2],
                    "payload": json.loads(row[3]),
                    "ts": row[4],
                    "farm_id": row[5],
                }
                for row in cursor.fetchall()
            ]
        finally:
            conn.close()
        return result

    def latest_visit_state(self, visit_id: str) -> str | None:
        conn = self._connect()
        try:
            cursor = conn.execute(
                "SELECT payload FROM twin_events "
                "WHERE visit_id = ? AND event_type = 'visit_event' "
                "ORDER BY rowid DESC LIMIT 1",
                (visit_id,),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            return json.loads(row[0]).get("status")
        finally:
            conn.close()

    # ---- migration helpers -------------------------------------------------

    @classmethod
    def from_json_store(cls, json_path: Path, sqlite_path: Path) -> "SqliteTwinStore":
        """Migrate events from a JSON store file to a new SQLite store."""
        store = cls(sqlite_path)
        if json_path.exists():
            data = json.loads(json_path.read_text())
            for event_dict in data.get("events", []):
                event = TwinEvent.from_dict(event_dict)
                try:
                    store.append(event)
                except ContractError:
                    pass  # skip duplicates (idempotent migration)
        return store
