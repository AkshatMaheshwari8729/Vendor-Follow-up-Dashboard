from __future__ import annotations

import platform
import tempfile
from pathlib import Path

import streamlit as st

from excel_automation import ExcelMacroRunner


st.set_page_config(page_title="Excel VBA Macro Dashboard", layout="wide")
st.title("📊 Excel VBA Macro Dashboard")
st.caption(
    "Upload a macro-enabled workbook (.xlsm), detect available macros, and execute one safely via Excel COM automation."
)

if platform.system() != "Windows":
    st.error(
        "This tool requires Microsoft Excel + pywin32 on Windows. "
        "Please run it on a Windows machine where Excel is installed."
    )
    st.stop()

runner = ExcelMacroRunner()

if "detected_macros" not in st.session_state:
    st.session_state.detected_macros = []
if "uploaded_path" not in st.session_state:
    st.session_state.uploaded_path = None

left, right = st.columns([2, 1])

with left:
    uploaded_file = st.file_uploader("Upload .xlsm workbook", type=["xlsm"])

    if uploaded_file is not None:
        temp_dir = Path(tempfile.mkdtemp(prefix="uploaded_workbook_"))
        uploaded_path = temp_dir / uploaded_file.name
        uploaded_path.write_bytes(uploaded_file.getbuffer())
        st.session_state.uploaded_path = uploaded_path

        st.success(f"Workbook uploaded: {uploaded_file.name}")

        if st.button("Detect macros", type="primary"):
            with st.spinner("Scanning workbook for VBA macros..."):
                try:
                    macros = runner.detect_macros(uploaded_path)
                    st.session_state.detected_macros = macros

                    if macros:
                        st.success(f"Detected {len(macros)} macro candidates.")
                    else:
                        st.warning(
                            "No macros were auto-detected. This may be due to Excel security settings. "
                            "You can still run a macro by typing its name manually (for example: Module1.MyMacro)."
                        )
                except Exception as exc:
                    st.session_state.detected_macros = []
                    st.error(f"Macro detection failed: {exc}")

with right:
    st.subheader("Execution")
    st.markdown(
        "Excel will open in **visible mode** during execution so users can interact with dialogs and prompts."
    )

    macro_options = st.session_state.detected_macros or ["(manual entry)"]
    selected = st.selectbox("Detected macros", options=macro_options)
    manual_macro = st.text_input(
        "Manual macro name",
        placeholder="Example: Module1.GenerateReport",
        help="Used when detection fails or if you prefer a specific qualified macro name.",
    )

    run_clicked = st.button("Run selected macro")

    if run_clicked:
        if st.session_state.uploaded_path is None:
            st.error("Upload a workbook first.")
        else:
            macro_to_run = manual_macro.strip() or (selected if selected != "(manual entry)" else "")
            if not macro_to_run:
                st.error("Please choose or type a macro name before running.")
            else:
                with st.spinner("Launching Excel and running macro..."):
                    try:
                        result = runner.run_macro(st.session_state.uploaded_path, macro_to_run)
                        st.success(result.message)
                        st.download_button(
                            label="Download processed workbook",
                            data=result.output_path.read_bytes(),
                            file_name=result.output_path.name,
                            mime="application/vnd.ms-excel.sheet.macroEnabled.12",
                        )
                    except Exception as exc:
                        st.error(
                            "Execution error. Common causes include blocked files, insufficient permissions, "
                            "Excel Trust Center restrictions, or invalid macro names. "
                            f"Details: {exc}"
                        )

with st.expander("Operational notes and reliability guidance"):
    st.markdown(
        """
- The app runs macros **without requiring VBA code modifications**.
- Automatic detection may fail if *Trust access to the VBA project object model* is disabled.
- If detection fails, manually enter a fully qualified macro name (for example, `Module1.ProcessData`).
- The workbook is executed on a temporary copy to protect the original upload.
- If Excel is left running due to an external dialog, close it manually and rerun.
"""
    )
