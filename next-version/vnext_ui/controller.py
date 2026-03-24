"""Thin UI controller over Twin capabilities for Slice-1 GUI."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from vnext_api.capabilities import TwinCapabilities  # noqa: E402
from vnext_twin_core.models import ContractError  # noqa: E402


@dataclass
class CockpitState:
    visit_id: str = ""
    slice_state: str = "idle"
    captured_observation: str = ""
    corrected_observation: str = ""
    local_save_status: str = "not_saved"
    sync_status: str = "not_synced"
    retrieval_summary: str = ""
    retrieval_event_id: str = ""
    recommendation: str = ""
    decision: str = ""
    last_error: str = ""


class CockpitController:
    def __init__(self, db_path: Path):
        self.caps = TwinCapabilities(db_path)
        self.state = CockpitState()

    def _update_state(self, **kwargs: str) -> CockpitState:
        for key, value in kwargs.items():
            setattr(self.state, key, value)
        return self.state

    def start_visit(self) -> CockpitState:
        visit_id = self.caps.ingest_visit()
        return self._update_state(
            visit_id=visit_id,
            slice_state="draft",
            local_save_status="not_saved",
            sync_status="not_synced",
            retrieval_summary="",
            retrieval_event_id="",
            recommendation="",
            decision="",
            last_error="",
        )

    def capture(self, observation: str) -> CockpitState:
        self.caps.twin.capture(self.state.visit_id, observation, "local://gui-photo.jpg", 0.0, 0.0)
        return self._update_state(captured_observation=observation, slice_state="draft", last_error="")

    def review_correct(self, corrected_observation: str) -> CockpitState:
        self.caps.twin.review_and_correct(self.state.visit_id, corrected_observation)
        return self._update_state(corrected_observation=corrected_observation, slice_state="reviewed", last_error="")

    def save_local(self) -> CockpitState:
        self.caps.twin.save_local(self.state.visit_id)
        return self._update_state(local_save_status="saved", last_error="")

    def sync(self, online: bool) -> CockpitState:
        sync_event = self.caps.sync_event(self.state.visit_id, online=online)
        return self._update_state(sync_status=sync_event.payload["status"], last_error="")

    def retrieve(self, question: str) -> CockpitState:
        retrieval = self.caps.retrieve_context(self.state.visit_id, question)
        return self._update_state(
            retrieval_event_id=retrieval.event_id,
            retrieval_summary=f"{len(retrieval.payload['items'])} events grounded",
            last_error="",
        )

    def ask(self, question: str) -> CockpitState:
        rec = self.caps.ask_twin(self.state.visit_id, self.state.retrieval_event_id, question)
        return self._update_state(recommendation=rec.payload["recommendation"], slice_state="reviewed", last_error="")

    def decide(self, decision: str) -> CockpitState:
        self.caps.twin.decide(self.state.visit_id, decision)
        return self._update_state(decision=decision, slice_state="finalized", last_error="")

    def safe_call(self, fn, *args):
        try:
            state = fn(*args)
            return state, None
        except ContractError as err:
            self.state.last_error = str(err)
            return self.state, str(err)
        except Exception as err:  # noqa: BLE001
            self.state.last_error = f"unexpected: {err}"
            return self.state, self.state.last_error
