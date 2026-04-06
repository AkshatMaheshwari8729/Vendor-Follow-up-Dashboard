# Vendor Follow-up Dashboard — Excel VBA Macro Runner

A professional Streamlit-based internal tool for running Excel VBA macros from `.xlsm` workbooks through a point-and-click interface.

## Features

- Upload macro-enabled Excel files (`.xlsm`).
- Best-effort automatic macro discovery:
  - COM/VBProject inspection (when Excel trust settings allow it)
  - Fallback parsing with `oletools`
- Manual macro entry when auto-detection is blocked.
- Executes VBA macros through `pywin32` COM automation.
- Launches Excel in **visible mode** so users can interact with dialogs/prompts.
- Saves and returns a processed workbook for download.
- Defensive error handling for common automation issues.

## Requirements

- Windows with Microsoft Excel installed
- Python 3.10+

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
streamlit run app.py
```

Then open the local Streamlit URL shown in terminal (usually `http://localhost:8501`).

## Notes on Macro Detection

Excel security settings can prevent automatic macro enumeration. If detection fails:

1. Confirm Excel Trust Center allows access to the VBA project object model (if your organization permits).
2. Use manual macro name input (for example: `Module1.MyMacro`).

## Reliability Considerations

- The app works on a temporary copy of the uploaded workbook to protect original files.
- COM objects are explicitly initialized and cleaned up.
- Errors are surfaced with actionable messages for blocked files, permission issues, and invalid macro names.
