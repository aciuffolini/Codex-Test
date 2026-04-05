import math
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from risksim.core.calculations import InputParams, compute_profit


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


def test_breakeven_compra_zeroes_margin():
    p = default_params()
    bk = compute_profit(p).breakeven_compra
    p2 = InputParams(**{**p.__dict__, "precio_compra": bk})
    assert math.isclose(compute_profit(p2).margen_neto, 0, abs_tol=1e-6)


def test_margen_compra_venta_zero_when_equal_prices():
    p = default_params()
    p = InputParams(**{**p.__dict__, "precio_compra": 800, "precio_venta": 800})
    assert compute_profit(p).margen_compra_venta == 0


def test_dof_formula():
    p = default_params()
    p = InputParams(**{**p.__dict__, "peso_compra": 200, "peso_salida": 500, "adpv": 1.25})
    result = compute_profit(p)
    assert math.isclose(result.dof, (500 - 200) / 1.25)
