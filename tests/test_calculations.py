import math
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from risksim.core.calculations import InputParams, compute_profit, safe_div


def default_params() -> InputParams:
    return InputParams(
        precio_compra=950,
        precio_venta=835,
        num_cabezas=100,
        peso_compra=200,
        peso_salida=460,
        precio_por_tn=64,
        conversion=8,
        mortandad=1,
        adpv=1.2,
        estadia=30,
        sanidad=1200,
    )


@pytest.mark.parametrize(
    "field,expected",
    [
        ("margen_neto", 53280.0),
        ("margen_compra_venta", -23000),
        ("margen_alimentacion", 83980),
        ("costo_feed_por_kg_gain", 512),
        ("rent_mensual", 2.2299833048880866),
        ("rent_anual", 26.759799658657037),
        ("breakeven_compra", 1216.4),
        ("breakeven_venta", 719.1739130434783),
        ("dof", 216.66666666666669),
        ("total_inversion", 330820.0),
        ("total_margen_neto", 5274720.0),
    ],
)
def test_compute_profit_formulas(field: str, expected: float) -> None:
    res = compute_profit(default_params())
    value = getattr(res, field)
    assert math.isclose(value, expected, rel_tol=1e-9, abs_tol=1e-9)


@pytest.mark.parametrize(
    "a,b,expected",
    [
        (10, 2, 5),
        (1, 0, math.nan),
    ],
)
def test_safe_div(a: float, b: float, expected: float) -> None:
    result = safe_div(a, b)
    if math.isnan(expected):
        assert math.isnan(result)
    else:
        assert result == expected
