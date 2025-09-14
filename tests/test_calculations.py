from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure the src directory is on the path so that risksim can be imported
sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

from risksim.core.calculations import (
    InputParams,
    ProfitResult,
    compute_profit,
    compute_profit_raw,
)


def test_compute_profit_raw() -> None:
    profit = compute_profit_raw(10.0, 5.0, 3.0)
    assert profit == pytest.approx(20.0)


def test_compute_profit() -> None:
    params = InputParams(mass_kg=10.0, sale_price_per_kg=5.0, cost_per_kg=3.0)
    result = compute_profit(params)
    assert isinstance(result, ProfitResult)
    assert result.revenue == pytest.approx(50.0)
    assert result.cost == pytest.approx(30.0)
    assert result.profit == pytest.approx(20.0)
