from __future__ import annotations

from dataclasses import dataclass


@dataclass
class InputParams:
    """Input parameters for profit calculation.

    Attributes:
        mass_kg: Quantity of material in kilograms.
        sale_price_per_kg: Selling price in dollars per kilogram ($/kg).
        cost_per_kg: Cost in dollars per kilogram ($/kg).
    """

    mass_kg: float
    sale_price_per_kg: float
    cost_per_kg: float


@dataclass
class ProfitResult:
    """Results from the profit calculation.

    Attributes:
        revenue: Total revenue in dollars.
        cost: Total cost in dollars.
        profit: Net profit in dollars, computed as revenue - cost.
    """

    revenue: float
    cost: float
    profit: float


def compute_profit_raw(mass_kg: float, sale_price_per_kg: float, cost_per_kg: float) -> float:
    """Compute raw profit in dollars.

    Formula:
        profit = (sale_price_per_kg - cost_per_kg) * mass_kg

    Args:
        mass_kg: Material mass in kilograms.
        sale_price_per_kg: Selling price in dollars per kilogram ($/kg).
        cost_per_kg: Cost in dollars per kilogram ($/kg).

    Returns:
        Net profit in dollars.
    """

    return (sale_price_per_kg - cost_per_kg) * mass_kg


def compute_profit(params: InputParams) -> ProfitResult:
    """Compute detailed profit summary from ``params``.

    The following formulas are applied:

    ``revenue = params.sale_price_per_kg * params.mass_kg``
    ``cost = params.cost_per_kg * params.mass_kg``
    ``profit = revenue - cost``

    Args:
        params: Parameters for the calculation.

    Returns:
        A :class:`ProfitResult` with revenue, cost, and profit in dollars.
    """

    revenue = params.sale_price_per_kg * params.mass_kg
    cost = params.cost_per_kg * params.mass_kg
    profit = compute_profit_raw(params.mass_kg, params.sale_price_per_kg, params.cost_per_kg)
    return ProfitResult(revenue=revenue, cost=cost, profit=profit)


__all__ = ["InputParams", "ProfitResult", "compute_profit", "compute_profit_raw"]
