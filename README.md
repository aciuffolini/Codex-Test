# RiskSim

RiskSim provides core calculations for livestock risk and profit analysis. The
package exposes a small API for computing margins, breakeven prices and related
metrics given production parameters. A simple command line interface is
available as an example entry point. Scenarios can be persisted to disk using a
lightweight JSON repository so that they may be reused or shared.

## Installation

```bash
pip install -e .
```

## Command line usage

The CLI now exposes a small set of sub-commands:

```bash
# run a one-off calculation
risksim run PRECIO_COMPRA PRECIO_VENTA PESO_COMPRA PESO_SALIDA PRECIO_POR_TN CONVERSION MORTANDAD ADPV ESTADIA SANIDAD --num_cabezas 10

# scenario CRUD operations
risksim scenario save my-scenario PRECIO_COMPRA PRECIO_VENTA PESO_COMPRA PESO_SALIDA PRECIO_POR_TN CONVERSION MORTANDAD ADPV ESTADIA SANIDAD
risksim scenario list
risksim scenario show my-scenario
risksim scenario delete my-scenario
```

`run` prints the margin neto for the provided parameters. Scenarios are stored
in a JSON file (``scenarios.json`` by default) that can be backed up or shared
between environments.

## Streamlit UI

For an interactive front-end, install the optional ``ui`` dependency and run

```bash
streamlit run -m risksim.ui
```

The sidebar exposes a modal for saving and loading scenarios.

## Schema migrations

Scenario files store a ``version`` field that allows the repository to migrate
older files to the current schema. The ``risksim.storage.migrations`` module
contains the upgrade logic.

## Backup and restore

Scenario files are ordinary JSON documents. To back up the repository simply
copy ``scenarios.json`` somewhere safe. Use the ``backup`` and ``restore``
helpers on ``ScenarioRepository`` if you prefer programmatic control.

## Development

Install development dependencies and run the tests with:

```bash
pip install -e .[test]
pytest
```
