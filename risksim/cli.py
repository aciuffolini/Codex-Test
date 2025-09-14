import argparse
from .core.calculations import InputParams, compute_profit


def main() -> None:
    parser = argparse.ArgumentParser(description="RiskSim CLI")
    parser.add_argument("precio_compra", type=float)
    parser.add_argument("precio_venta", type=float)
    parser.add_argument("peso_compra", type=float)
    parser.add_argument("peso_salida", type=float)
    parser.add_argument("precio_por_tn", type=float)
    parser.add_argument("conversion", type=float)
    parser.add_argument("mortandad", type=float)
    parser.add_argument("adpv", type=float)
    parser.add_argument("estadia", type=float)
    parser.add_argument("sanidad", type=float)
    parser.add_argument("num_cabezas", type=int, default=1)
    args = parser.parse_args()
    params = InputParams(
        precio_compra=args.precio_compra,
        precio_venta=args.precio_venta,
        num_cabezas=args.num_cabezas,
        peso_compra=args.peso_compra,
        peso_salida=args.peso_salida,
        precio_por_tn=args.precio_por_tn,
        conversion=args.conversion,
        mortandad=args.mortandad,
        adpv=args.adpv,
        estadia=args.estadia,
        sanidad=args.sanidad,
    )
    result = compute_profit(params)
    print(f"Margen neto: {result.margen_neto:.2f}")


if __name__ == "__main__":
    main()
