"""Vertical Slice 1 orchestration service for canonical workflow."""
from __future__ import annotations

from pathlib import Path
import uuid

from .models import TwinEvent, ContractError
from .store_base import TwinStoreBase
from .store import TwinStore
from .sync import SyncEngine
from .retrieval import RetrievalService
from .reasoning import ReasoningService


class TwinService:
    def __init__(self, db_path: Path | None = None, *, store: TwinStoreBase | None = None):
        if store is not None:
            self.store = store
        elif db_path is not None:
            self.store = TwinStore(db_path)
        else:
            raise ValueError("Either db_path or store must be provided")
        self.sync_engine = SyncEngine(self.store)
        self.retrieval = RetrievalService(self.store)
        self.reasoning = ReasoningService(self.store)

    def _require_state(self, visit_id: str, allowed: set[str]) -> None:
        current = self.store.latest_visit_state(visit_id)
        if current not in allowed:
            raise ContractError(f"invalid transition from state={current}; allowed={sorted(allowed)}")

    def start_visit(self, farm_id: str | None = None) -> str:
        visit_id = str(uuid.uuid4())
        self.store.append(TwinEvent.make("visit_event", visit_id, {"status": "draft"}, farm_id=farm_id))
        return visit_id

    def capture(self, visit_id: str, observation: str, media_uri: str, lat: float, lon: float) -> None:
        self._require_state(visit_id, {"draft"})
        if not observation.strip():
            raise ContractError("observation is required")
        self.store.append(TwinEvent.make("observation", visit_id, {"text": observation}))
        if media_uri and not media_uri.startswith("baseline://"):
            self.store.append(TwinEvent.make("media_asset", visit_id, {"local_uri": media_uri, "state": "local_saved"}))
        self.store.append(TwinEvent.make("location_context", visit_id, {"lat": lat, "lon": lon}))

    def upload_media(self, visit_id: str, media_type: str, uri: str) -> None:
        self._require_state(visit_id, {"draft", "reviewed"})
        if not uri.strip():
            raise ContractError("uri is required")
        self.store.append(
            TwinEvent.make("media_asset", visit_id, {"local_uri": uri, "type": media_type, "state": "local_saved"})
        )

    def review_and_correct(self, visit_id: str, corrected_observation: str) -> None:
        self._require_state(visit_id, {"draft"})
        if not corrected_observation.strip():
            raise ContractError("corrected_observation is required")
        self.store.append(TwinEvent.make("user_correction_event", visit_id, {"observation": corrected_observation}))
        self.store.append(TwinEvent.make("visit_event", visit_id, {"status": "reviewed"}))

    def save_local(self, visit_id: str) -> None:
        self._require_state(visit_id, {"draft", "reviewed"})
        self.store.append(TwinEvent.make("audit_history_event", visit_id, {"action": "save_local"}))

    def sync(self, visit_id: str, online: bool) -> TwinEvent:
        self._require_state(visit_id, {"reviewed", "draft"})
        return self.sync_engine.sync_visit(visit_id, online)

    def retrieve(self, visit_id: str, question: str) -> TwinEvent:
        self._require_state(visit_id, {"reviewed", "draft"})
        return self.retrieval.retrieve_context(visit_id, question)

    def ask(self, visit_id: str, retrieval_event_id: str, question: str) -> TwinEvent:
        self._require_state(visit_id, {"reviewed", "draft"})
        return self.reasoning.ask_twin(visit_id, retrieval_event_id, question)

    def decide(self, visit_id: str, decision: str) -> TwinEvent:
        self._require_state(visit_id, {"reviewed", "draft"})
        if decision not in {"accepted", "modified", "rejected"}:
            raise ContractError("decision must be one of: accepted, modified, rejected")
        event = TwinEvent.make("user_correction_event", visit_id, {"decision": decision})
        self.store.append(event)
        self.store.append(TwinEvent.make("visit_event", visit_id, {"status": "finalized"}))
        return event
