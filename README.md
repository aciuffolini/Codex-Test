# RiskSim

RiskSim provides core calculations for livestock risk and profit analysis. The
package exposes a small API for computing margins, breakeven prices and related
metrics given production parameters. A simple command line interface is
available as an example entry point.

## Installation

```bash
pip install -e .
```

## Command line usage

```bash
risksim PRECIO_COMPRA PRECIO_VENTA PESO_COMPRA PESO_SALIDA PRECIO_POR_TN CONVERSION MORTANDAD ADPV ESTADIA SANIDAD NUM_CABEZAS
```

The command will print the margin neto for the provided parameters.

## Development

Install development dependencies and run the tests with:

```bash
pip install -e .[test]
pytest
```
