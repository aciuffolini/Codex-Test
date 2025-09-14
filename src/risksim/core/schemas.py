"""Schemas and configuration helpers for the risk simulator."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union
import json


@dataclass
class EngineConfig:
    """Configuration for the risk simulation engine.

    Attributes
    ----------
    peso_compra:
        Positive purchase weight.
    iterations:
        Number of simulation iterations; must be greater than zero.
    """

    peso_compra: float
    iterations: int = 1000

    def __post_init__(self) -> None:
        if self.peso_compra <= 0:
            raise ValueError("peso_compra must be > 0")
        if self.iterations <= 0:
            raise ValueError("iterations must be > 0")


def load_defaults(path: Optional[Union[str, Path]] = None) -> EngineConfig:
    """Load default configuration for the simulator.

    Parameters
    ----------
    path:
        Optional path to the JSON file containing defaults. If not supplied, a
        ``defaults.json`` file located in the same directory as this module is
        used.

    Returns
    -------
    EngineConfig
        Parsed configuration object with validated values.
    """
    if path is None:
        path = Path(__file__).with_name("defaults.json")
    else:
        path = Path(path)

    data = json.loads(path.read_text())
    return EngineConfig(**data)
