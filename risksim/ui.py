"""Streamlit front-end with scenario save/load modal."""

from __future__ import annotations

import streamlit as st

from .core.calculations import InputParams, compute_profit
from .storage import ScenarioRepository


def scenario_modal(repo: ScenarioRepository, params: InputParams) -> InputParams:
    """Render a sidebar modal for saving and loading scenarios.

    Returns the loaded InputParams if a scenario is loaded, otherwise the
    original params.
    """

    with st.sidebar.expander("Scenarios", expanded=False):
        save_name = st.text_input("Save as", key="save_name")
        if st.button("Save scenario") and save_name:
            repo.save(save_name, params)
            st.success(f"Saved {save_name}")

        scenarios = repo.list()
        names = [s.name for s in scenarios]
        load_name = st.selectbox("Load", options=names, key="load_name")
        if st.button("Load scenario") and load_name:
            loaded = repo.get(load_name)
            if loaded:
                st.info(f"Loaded {load_name}")
                return loaded.params
    return params


def app() -> None:
    repo = ScenarioRepository()
    params = InputParams(
        precio_compra=st.number_input("Precio compra", value=950.0),
        precio_venta=st.number_input("Precio venta", value=835.0),
        num_cabezas=st.number_input("Num. cabezas", value=100, step=1),
        peso_compra=st.number_input("Peso compra", value=200.0),
        peso_salida=st.number_input("Peso salida", value=460.0),
        precio_por_tn=st.number_input("Precio por TN", value=64.0),
        conversion=st.number_input("Conversion", value=8.0),
        mortandad=st.number_input("Mortandad", value=1.0),
        adpv=st.number_input("ADPV", value=1.2),
        estadia=st.number_input("Estadia", value=30.0),
        sanidad=st.number_input("Sanidad", value=1200.0),
    )

    params = scenario_modal(repo, params)

    result = compute_profit(params)
    st.write(f"Margen neto: {result.margen_neto:.2f}")


if __name__ == "__main__":
    app()
