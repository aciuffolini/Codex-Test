from __future__ import annotations

from .cli import greet


def main() -> None:
    """Run the Streamlit web interface."""
    import streamlit as st

    st.title("Hello App")
    name = st.text_input("Name", "World")
    if st.button("Greet"):
        st.write(greet(name))


if __name__ == "__main__":
    main()
