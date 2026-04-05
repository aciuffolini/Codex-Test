import argparse
from typing import Any

from .core.calculations import InputParams, compute_profit
from .storage import ScenarioRepository


def add_param_arguments(parser: argparse.ArgumentParser) -> None:
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
    parser.add_argument("--num_cabezas", type=int, default=1)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="RiskSim CLI")
    sub = parser.add_subparsers(dest="command")

    run = sub.add_parser("run", help="Run a scenario calculation")
    add_param_arguments(run)

    sc = sub.add_parser("scenario", help="Scenario storage operations")
    sc_sub = sc.add_subparsers(dest="sc_command")

    list_p = sc_sub.add_parser("list", help="List saved scenarios")
    list_p.add_argument("--store", default="scenarios.json")

    save_p = sc_sub.add_parser("save", help="Save a scenario")
    save_p.add_argument("name")
    add_param_arguments(save_p)
    save_p.add_argument("--store", default="scenarios.json")

    show_p = sc_sub.add_parser("show", help="Show a scenario")
    show_p.add_argument("name")
    show_p.add_argument("--store", default="scenarios.json")

    del_p = sc_sub.add_parser("delete", help="Delete a scenario")
    del_p.add_argument("name")
    del_p.add_argument("--store", default="scenarios.json")

    return parser


def params_from_args(args: Any) -> InputParams:
    return InputParams(
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


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "run":
        params = params_from_args(args)
        result = compute_profit(params)
        print(f"Margen neto: {result.margen_neto:.2f}")
        return

    if args.command == "scenario":
        repo = ScenarioRepository(getattr(args, "store", "scenarios.json"))
        if args.sc_command == "list":
            for scn in repo.list():
                print(scn.name)
            return
        if args.sc_command == "save":
            params = params_from_args(args)
            repo.save(args.name, params)
            print(f"Saved {args.name}")
            return
        if args.sc_command == "show":
            scenario = repo.get(args.name)
            if scenario:
                print(scenario)
            else:
                print("Scenario not found")
            return
        if args.sc_command == "delete":
            repo.delete(args.name)
            print(f"Deleted {args.name}")
            return

    parser.print_help()


if __name__ == "__main__":
    main()
