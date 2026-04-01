import streamlit as st
from pathlib import Path

st.set_page_config(
    page_title="Integration Window Calculator",
    page_icon="🔭",
    layout="wide",
)

html_content = Path("dist/index.html").read_text(encoding="utf-8")

st.components.v1.html(html_content, height=1200, scrolling=True)
