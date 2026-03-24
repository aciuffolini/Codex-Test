"""Baseline-aligned adapter for Adoption Slice A.

Purpose:
- keep React UI thin
- keep controller/service as source of behavior
- expose stable state/action surface for canonical flow
"""
from __future__ import annotations

from pathlib import Path

from .controller import CockpitController


class BaselineCockpitAdapter:
    def __init__(self, db_path: Path):
        self.controller = CockpitController(db_path)

    @property
    def state(self) -> dict:
        return self.controller.state.__dict__

    def act(self, action: str, payload: dict):
        c = self.controller
        if action == "start_visit":
            return c.safe_call(c.start_visit)
        if action == "capture":
            return c.safe_call(c.capture, payload.get("observation", ""))
        if action == "review_correct":
            return c.safe_call(c.review_correct, payload.get("corrected_observation", ""))
        if action == "save_local":
            return c.safe_call(c.save_local)
        if action == "sync":
            return c.safe_call(c.sync, bool(payload.get("online", True)))
        if action == "retrieve":
            return c.safe_call(c.retrieve, payload.get("question", ""))
        if action == "ask":
            return c.safe_call(c.ask, payload.get("question", ""))
        if action == "decide":
            return c.safe_call(c.decide, payload.get("decision", "accepted"))
        return c.state, f"unknown action: {action}"
