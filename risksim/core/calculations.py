from dataclasses import dataclass
import math


@dataclass
class InputParams:
    precio_compra: float
    precio_venta: float
    num_cabezas: int
    peso_compra: float
    peso_salida: float
    precio_por_tn: float
    conversion: float
    mortandad: float
    adpv: float
    estadia: float
    sanidad: float
    scale_totals_by_survivors: bool = True


@dataclass
class ProfitResult:
    margen_neto: float
    margen_compra_venta: float
    margen_alimentacion: float
    costo_feed_por_kg_gain: float
    rent_mensual: float
    rent_anual: float
    breakeven_compra: float
    breakeven_venta: float
    dof: float
    total_inversion: float
    total_margen_neto: float


def safe_div(a: float, b: float) -> float:
    try:
        return a / b
    except (ZeroDivisionError, ValueError, TypeError):
        return math.nan


def compute_profit(p: InputParams) -> ProfitResult:
    gain = p.peso_salida - p.peso_compra
    dof_raw = safe_div(gain, p.adpv)
    dof = max(dof_raw, 0) if math.isfinite(dof_raw) else math.nan

    costo_feed_por_kg_gain = p.conversion * p.precio_por_tn
    costo_feed_total = gain * costo_feed_por_kg_gain
    costo_estadia_total = dof * p.estadia if math.isfinite(dof) else math.nan
    costo_sanidad_total = p.sanidad

    ingreso = p.precio_venta * p.peso_salida
    costo_compra = p.precio_compra * p.peso_compra
    costo_total = (
        costo_compra + costo_feed_total + costo_estadia_total + costo_sanidad_total
    )

    margen_neto = ingreso - costo_total
    margen_compra_venta = (p.precio_venta - p.precio_compra) * p.peso_compra
    margen_alimentacion = (p.precio_venta - costo_feed_por_kg_gain) * gain

    breakeven_compra = safe_div(
        (p.precio_venta * p.peso_salida)
        - (gain * costo_feed_por_kg_gain)
        - (0 if math.isnan(dof) else dof * p.estadia)
        - p.sanidad,
        p.peso_compra,
    )
    breakeven_venta = safe_div(
        costo_compra
        + costo_feed_total
        + (0 if math.isnan(dof) else dof * p.estadia)
        + p.sanidad,
        p.peso_salida,
    )

    _costo_kg_producido = safe_div(
        costo_feed_total + costo_estadia_total + costo_sanidad_total, gain
    )
    total_inversion = costo_total

    rent_sobre_inv = safe_div(margen_neto, total_inversion) * 100
    rent_mensual = (
        safe_div(rent_sobre_inv, safe_div(dof, 30)) if not math.isnan(dof) else math.nan
    )
    rent_anual = rent_mensual * 12 if not math.isnan(rent_mensual) else math.nan

    supervivencia = 1 - p.mortandad / 100
    cabezas_efectivas = (
        p.num_cabezas * supervivencia if p.scale_totals_by_survivors else p.num_cabezas
    )
    total_margen_neto = margen_neto * cabezas_efectivas

    return ProfitResult(
        margen_neto=margen_neto,
        margen_compra_venta=margen_compra_venta,
        margen_alimentacion=margen_alimentacion,
        costo_feed_por_kg_gain=costo_feed_por_kg_gain,
        rent_mensual=rent_mensual,
        rent_anual=rent_anual,
        breakeven_compra=breakeven_compra,
        breakeven_venta=breakeven_venta,
        dof=dof,
        total_inversion=total_inversion,
        total_margen_neto=total_margen_neto,
    )
