"""Simple risk simulation engine using validated schemas."""
from __future__ import annotations

from typing import Union, Dict, Any

from .schemas import EngineConfig, load_defaults


class Engine:
    """Risk simulation engine.

    Parameters
    ----------
    config:
        Configuration for the engine. A dictionary can be provided and will be
        validated through :class:`EngineConfig`. If ``None`` a default
        configuration is loaded via :func:`load_defaults`.
    """

    def __init__(self, config: Union[EngineConfig, Dict[str, Any], None] = None) -> None:
        if config is None:
            config = load_defaults()
        elif isinstance(config, dict):
            config = EngineConfig(**config)
        self.config = config

    def run(self) -> float:
        """Run the simulation and return a dummy result.

        The implementation here is purposely simple; it merely returns a value
        based on the configuration to demonstrate usage of the validated schema.
        """
        return self.config.peso_compra * self.config.iterations
