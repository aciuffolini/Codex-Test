"""Abstract store interface for Twin event persistence.

All store implementations must inherit from TwinStoreBase and implement
the required methods. This enables swapping between JSON, SQLite, or
future backends without changing the service layer.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .models import TwinEvent


class TwinStoreBase(ABC):
    """Abstract base for Twin event stores."""

    @abstractmethod
    def append(self, event: TwinEvent) -> None:
        """Append a validated event. Raises ContractError on duplicate event_id."""
        ...

    @abstractmethod
    def create_farm(self, farm_id: str, name: str, kmz_data: str | None = None) -> None:
        """Create or update a farm entity."""
        ...

    @abstractmethod
    def list_farms(self) -> list[dict[str, Any]]:
        """List all registered farms."""
        ...

    @abstractmethod
    def list_events(self, visit_id: str | None = None) -> list[dict[str, Any]]:
        """List events, optionally filtered by visit_id."""
        ...

    @abstractmethod
    def latest_visit_state(self, visit_id: str) -> str | None:
        """Return the latest visit_event status for a visit, or None."""
        ...
