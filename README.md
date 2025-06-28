# Codex Test

This repository contains a small example Python project called **helloapp**. The
project provides a command-line interface that prints a friendly greeting.

## Usage

After installing the package, run the command:

```bash
helloapp [name]
```

If `name` is provided, it will print `Hello, <name>!`. Otherwise it defaults to
`Hello, World!`.

## Web interface

A small Streamlit UI is also available. Install the optional dependencies and
run the app with:

```bash
pip install -e .[ui]
streamlit run helloapp/app.py
```

## Development

Install development dependencies and run the tests with:

```bash
pip install -e .[test]
pytest
```

