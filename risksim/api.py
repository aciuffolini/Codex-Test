from fastapi import FastAPI
from pydantic import BaseModel
from .core.calculations import InputParams, compute_profit


class InputSchema(BaseModel):
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


class OutputSchema(BaseModel):
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


app = FastAPI()


@app.post("/compute", response_model=OutputSchema)
def compute_endpoint(params: InputSchema) -> OutputSchema:
    p = InputParams(**params.dict())
    result = compute_profit(p)
    return OutputSchema(**result.__dict__)
