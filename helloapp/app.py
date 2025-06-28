from __future__ import annotations

# Use an absolute import so the module works when executed directly
# via `streamlit run helloapp/app.py` where `__package__` is not set.
from helloapp.cli import greet


def main() -> None:
    """Run the Streamlit web interface."""
    import streamlit as st

    st.title("Hello App")
    name = st.text_input("Name", "World")
    if st.button("Greet"):
        st.write(greet(name))


if __name__ == "__main__":
    main()
