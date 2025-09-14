from pathlib import Path

from risksim.core.calculations import InputParams
from risksim.storage import ScenarioRepository


def sample_params() -> InputParams:
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


def test_repository_crud(tmp_path: Path) -> None:
    repo = ScenarioRepository(tmp_path / "scenarios.json")
    params = sample_params()
    repo.save("baseline", params)
    assert repo.get("baseline").params == params

    # update
    params2 = InputParams(**{**params.__dict__, "precio_compra": 900})
    repo.save("baseline", params2)
    assert repo.get("baseline").params == params2

    repo.delete("baseline")
    assert repo.get("baseline") is None


def test_backup_and_restore(tmp_path: Path) -> None:
    repo = ScenarioRepository(tmp_path / "scenarios.json")
    repo.save("a", sample_params())
    backup = tmp_path / "backup.json"
    repo.backup(backup)

    # remove and restore
    repo.delete("a")
    repo.restore(backup)
    assert repo.get("a") is not None
