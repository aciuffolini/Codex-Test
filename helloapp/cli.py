from __future__ import annotations

import argparse


def greet(name: str = "World") -> str:
    """Return greeting message for the given name."""
    return f"Hello, {name}!"


def main(argv: list[str] | None = None) -> None:
    """Run command-line interface."""
    parser = argparse.ArgumentParser(description="Greet the user")
    parser.add_argument("name", nargs="?", default="World", help="Name to greet")
    args = parser.parse_args(argv)
    message = greet(args.name)
    print(message)


if __name__ == "__main__":
    main()
