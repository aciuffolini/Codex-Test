"""Agent-facing capability façade for Vertical Slice 1.

This is an in-process adapter over TwinService (no network yet).
Deferred: HTTP server, auth, multi-tenant controls.
"""
from __future__ import annotations

from pathlib import Path

from vnext_twin_core import TwinService
from vnext_twin_core.store_base import TwinStoreBase


class TwinCapabilities:
    def __init__(self, db_path: Path | None = None, *, store: TwinStoreBase | None = None):
        self.twin = TwinService(db_path=db_path, store=store)

    def create_farm(self, farm_id: str, name: str, kmz_data: str | None = None) -> None:
        self.twin.store.create_farm(farm_id, name, kmz_data)

    def list_farms(self):
        return self.twin.store.list_farms()

    def ingest_visit(self, farm_id: str | None = None) -> str:
        return self.twin.start_visit(farm_id=farm_id)

    def upload_media(self, visit_id: str, media_type: str, media_uri: str) -> None:
        self.twin.upload_media(visit_id, media_type, media_uri)

    def sync_event(self, visit_id: str, online: bool):
        return self.twin.sync(visit_id, online)

    def retrieve_context(self, visit_id: str, query: str):
        return self.twin.retrieve(visit_id, query)

    def ask_twin(self, visit_id: str, retrieval_event_id: str, question: str):
        return self.twin.ask(visit_id, retrieval_event_id, question)

    def get_entity_history(self, visit_id: str):
        return self.twin.store.list_events(visit_id)

    def generate_report(self, visit_id: str) -> dict:
        # Deferred: full report templating.
        events = self.twin.store.list_events(visit_id)
        return {"visit_id": visit_id, "event_count": len(events), "status": "stubbed_report"}

    def propose_next_action(self, visit_id: str, retrieval_event_id: str, question: str):
        return self.ask_twin(visit_id, retrieval_event_id, question)
