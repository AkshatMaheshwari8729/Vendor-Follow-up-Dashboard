from __future__ import annotations

import gc
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class MacroExecutionResult:
    """Represents the output of a macro execution run."""

    output_path: Path
    message: str


class ExcelMacroRunner:
    """High-level helper for detecting and running VBA macros in .xlsm files."""

    def __init__(self, keep_excel_open_on_error: bool = False) -> None:
        self.keep_excel_open_on_error = keep_excel_open_on_error

    @staticmethod
    def _normalize_macro_names(names: List[str]) -> List[str]:
        seen = set()
        ordered = []
        for name in names:
            cleaned = name.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            ordered.append(cleaned)
        return ordered

    def detect_macros(self, workbook_path: Path) -> List[str]:
        """Best-effort macro discovery.

        Strategy:
        1. Attempt COM-based VBProject introspection (requires trusted VBA project access).
        2. Fallback to oletools parsing from the file content.
        """

        macros: List[str] = []

        try:
            macros.extend(self._detect_macros_via_com(workbook_path))
        except Exception:
            # Ignore and fallback to file-based parsing.
            pass

        if not macros:
            try:
                macros.extend(self._detect_macros_via_oletools(workbook_path))
            except Exception:
                pass

        return self._normalize_macro_names(macros)

    def _detect_macros_via_com(self, workbook_path: Path) -> List[str]:
        import pythoncom
        import win32com.client as win32

        macros: List[str] = []
        excel = None
        workbook = None
        pythoncom.CoInitialize()
        try:
            excel = win32.DispatchEx("Excel.Application")
            excel.Visible = False
            excel.DisplayAlerts = False
            workbook = excel.Workbooks.Open(str(workbook_path), ReadOnly=True)

            vb_project = workbook.VBProject  # Requires trusted access setting in Excel.
            for component in vb_project.VBComponents:
                module_name = component.Name
                code_module = component.CodeModule
                total_lines = code_module.CountOfLines
                if total_lines <= 0:
                    continue
                source = code_module.Lines(1, total_lines)
                macros.extend(self._extract_macro_names_from_source(source, module_name))

        finally:
            if workbook is not None:
                workbook.Close(SaveChanges=False)
            if excel is not None:
                excel.Quit()
            workbook = None
            excel = None
            gc.collect()
            pythoncom.CoUninitialize()

        return macros

    @staticmethod
    def _detect_macros_via_oletools(workbook_path: Path) -> List[str]:
        from oletools.olevba import VBA_Parser

        parser = VBA_Parser(str(workbook_path))
        macros: List[str] = []

        try:
            if not parser.detect_vba_macros():
                return []

            for (_, stream_path, vba_filename, vba_code) in parser.extract_macros():
                module_name = Path(vba_filename).stem if vba_filename else "Module"
                if stream_path:
                    module_name = Path(stream_path).stem
                macros.extend(ExcelMacroRunner._extract_macro_names_from_source(vba_code, module_name))
        finally:
            parser.close()

        return macros

    @staticmethod
    def _extract_macro_names_from_source(vba_source: str, module_name: str) -> List[str]:
        """Return both qualified and unqualified macro names discovered in VBA code."""

        pattern = re.compile(
            r"^\s*(?:Public\s+|Private\s+)?Sub\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(",
            re.IGNORECASE | re.MULTILINE,
        )
        discovered = []
        for match in pattern.findall(vba_source or ""):
            discovered.append(match)
            discovered.append(f"{module_name}.{match}")
        return discovered

    def run_macro(
        self,
        source_workbook_path: Path,
        macro_name: str,
    ) -> MacroExecutionResult:
        """Run a macro in visible Excel and return the processed output path.

        The macro call is synchronous in Excel COM automation.
        """

        if not macro_name.strip():
            raise ValueError("A macro name is required.")

        import pythoncom
        import win32com.client as win32

        run_copy = self._prepare_workbook_copy(source_workbook_path)
        output_copy = run_copy.with_name(f"{run_copy.stem}_processed{run_copy.suffix}")

        excel = None
        workbook = None
        pythoncom.CoInitialize()

        try:
            excel = win32.DispatchEx("Excel.Application")
            excel.Visible = True
            excel.DisplayAlerts = True
            excel.EnableEvents = True

            workbook = excel.Workbooks.Open(str(run_copy), ReadOnly=False)

            # NOTE: Application.Run blocks until macro completion.
            excel.Application.Run(macro_name)

            workbook.SaveAs(str(output_copy), FileFormat=52)
            workbook.Close(SaveChanges=True)

            return MacroExecutionResult(
                output_path=output_copy,
                message=(
                    f"Macro '{macro_name}' completed successfully. "
                    f"Processed file saved as {output_copy.name}."
                ),
            )
        except Exception as exc:
            if workbook is not None and not self.keep_excel_open_on_error:
                try:
                    workbook.Close(SaveChanges=False)
                except Exception:
                    pass
            raise RuntimeError(f"Macro execution failed: {exc}") from exc
        finally:
            if excel is not None and not self.keep_excel_open_on_error:
                try:
                    excel.Quit()
                except Exception:
                    pass
            workbook = None
            excel = None
            gc.collect()
            pythoncom.CoUninitialize()

    @staticmethod
    def _prepare_workbook_copy(source_path: Path) -> Path:
        if source_path.suffix.lower() != ".xlsm":
            raise ValueError("Only .xlsm files are supported.")

        temp_dir = Path(tempfile.mkdtemp(prefix="macro_runner_"))
        destination = temp_dir / source_path.name
        shutil.copy2(source_path, destination)

        # Remove Mark-of-the-Web if present to reduce blocked-file issues on Windows.
        zone_identifier = Path(f"{destination}:Zone.Identifier")
        if zone_identifier.exists():
            try:
                zone_identifier.unlink()
            except Exception:
                # Non-fatal.
                pass

        return destination
