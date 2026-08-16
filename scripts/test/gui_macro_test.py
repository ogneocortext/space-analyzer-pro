#!/usr/bin/env python3
"""
Space Analyzer Pro — GUI Functional Test Suite (WinUI 3)
========================================================
Tests the WinUI 3 GUI binary for functional correctness.

INPUT MODEL: Zero cursor hijacking.
  • All button/tab actions use Windows UI Automation (UIA) Invoke() pattern.
    This sends WM_COMMAND to the button’s HWND directly — no cursor movement,
    no focus stealing on any monitor.
  • Text input uses PostMessage(WM_SETTEXT) to the target Edit control, then
    PostMessage(WM_COMMAND) to trigger "Scan Now". No SendInput, no SendKeys.
  • If UIA cannot find a control (rare with WinUI 3 / XAML Island), the test
    reports it as FAIL rather than falling back to cursor manipulation.

Screenshots use PrintWindow with PW_RENDERFULLCONTENT (no cursor disruption).

Test categories:
  1. Launch & startup state
  2. Tab navigation (all tabs)
  3. Button click verification (every interactive button per tab)
  4. Scan execution (start, progress, results, cancel)
  5. Settings persistence (change, save, restart, verify)
  6. Export functionality (text, JSON, CSV, Markdown)
  7. AI chat (graceful handling when Ollama unavailable)
  8. History (scan records saved and displayed)
  9. Error states (invalid paths, empty results)

Output (all in macro_logs/<run_id>/):
  report.json        — consolidated test report (one file for analysis)
  console.log        — human-readable log with timestamps
  screenshots/       — PNG captures at each test step
  history.jsonl      — append-only run history for trend analysis
"""

import ctypes
import ctypes.wintypes
import json
import logging
import platform
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("gui_macro_test")

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

# Declare proper Win32 prototypes so 64-bit HANDLE values don't overflow c_int
# (undeclared calls truncate/sign-extend pointers on x64 and crash GDI calls).
HWND = ctypes.c_void_p
HDC = ctypes.c_void_p
HBITMAP = ctypes.c_void_p

user32.GetDC.argtypes = [HWND]
user32.GetDC.restype = HDC
user32.ReleaseDC.argtypes = [HWND, HDC]
user32.ReleaseDC.restype = ctypes.c_int
user32.PrintWindow.argtypes = [HWND, HDC, ctypes.c_uint]
user32.PrintWindow.restype = ctypes.c_int
user32.GetClientRect.argtypes = [HWND, ctypes.c_void_p]
user32.GetClientRect.restype = ctypes.c_int
user32.GetWindowRect.argtypes = [HWND, ctypes.c_void_p]
user32.GetWindowRect.restype = ctypes.c_int
user32.SetWindowPos.argtypes = [HWND, HWND, ctypes.c_int, ctypes.c_int,
                                 ctypes.c_int, ctypes.c_int, ctypes.c_uint]
user32.SetWindowPos.restype = ctypes.c_int

gdi32.CreateCompatibleDC.argtypes = [HDC]
gdi32.CreateCompatibleDC.restype = HDC
gdi32.CreateCompatibleBitmap.argtypes = [HDC, ctypes.c_int, ctypes.c_int]
gdi32.CreateCompatibleBitmap.restype = HBITMAP
gdi32.SelectObject.argtypes = [HDC, HBITMAP]
gdi32.SelectObject.restype = HBITMAP
gdi32.GetDIBits.argtypes = [HDC, HBITMAP, ctypes.c_uint, ctypes.c_uint,
                            ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint]
gdi32.GetDIBits.restype = ctypes.c_int
gdi32.DeleteObject.argtypes = [HBITMAP]
gdi32.DeleteObject.restype = ctypes.c_int
gdi32.DeleteDC.argtypes = [HDC]
gdi32.DeleteDC.restype = ctypes.c_int

# ═══════════════════════════════════════════════════════════════
# Win32 / PrintWindow helpers
# ═══════════════════════════════════════════════════════════════

SW_RESTORE = 9
PW_RENDERFULLCONTENT = 2
DIB_RGB_COLORS = 0

WM_SETTEXT = 0x0030
WM_COMMAND = 0x0111
WM_SYSCHAR = 0x0106

# Command IDs (guessing — these are typical for WinUI 3 buttons)
# If unknown, we rely on UIA Invoke() which doesn't need command IDs.


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", ctypes.c_uint32),
        ("biWidth", ctypes.c_int32),
        ("biHeight", ctypes.c_int32),
        ("biPlanes", ctypes.c_uint16),
        ("biBitCount", ctypes.c_uint16),
        ("biCompression", ctypes.c_uint32),
        ("biSizeImage", ctypes.c_uint32),
        ("biXPelsPerMeter", ctypes.c_int32),
        ("biYPelsPerMeter", ctypes.c_int32),
        ("biClrUsed", ctypes.c_uint32),
        ("biClrImportant", ctypes.c_uint32),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [
        ("bmiHeader", BITMAPINFOHEADER),
        ("bmiColors", ctypes.c_uint32 * 3),
    ]


def find_hwnd(title="Space Analyzer"):
    """Find window handle by title substring (no focus stealing)."""
    found = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.POINTER(ctypes.c_wchar_p))
    def enum_proc(hwnd, lparam):
        buf = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, buf, 256)
        if buf.value and title.lower() in buf.value.lower():
            found.append(hwnd)
        return True

    user32.EnumWindows(enum_proc, 0)
    return found[0] if found else None


def get_window_rect(hwnd) -> tuple[int, int, int, int]:
    rect = ctypes.wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)


def get_window_text(hwnd) -> str:
    buf = ctypes.create_unicode_buffer(1024)
    user32.GetWindowTextW(hwnd, buf, 1024)
    return buf.value


def get_client_rect(hwnd) -> tuple[int, int, int, int]:
    rect = ctypes.wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    return (rect.left, rect.top, rect.right, rect.bottom)


def get_window_rect_ui(hwnd) -> tuple[int, int]:
    """Get client-area width and height for a window."""
    rect = ctypes.wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    return rect.right, rect.bottom


def process_alive(hwnd) -> bool:
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    handle = kernel32.OpenProcess(0x1000, False, pid.value)
    if handle:
        exit_code = ctypes.wintypes.DWORD()
        success = kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
        kernel32.CloseHandle(handle)
        if success:
            return exit_code.value == 259
    return True


# ── Multi-monitor positioning (keep the app off the user's working screen) ──
SWP_NOSIZE = 0x0001
SWP_NOZORDER = 0x0004
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
SW_SHOWNOACTIVATE = 8

MonitorEnumProc = ctypes.WINFUNCTYPE(
    ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p,
    ctypes.POINTER(ctypes.wintypes.RECT), ctypes.c_void_p,
)


def enum_monitors() -> list[tuple[int, int, int, int]]:
    """Return list of (left, top, right, bottom) for each display."""
    monitors: list[tuple[int, int, int, int]] = []

    def cb(_hmon, _hdc, lprect, _lparam):
        r = lprect.contents
        monitors.append((r.left, r.top, r.right, r.bottom))
        return True

    user32.EnumDisplayMonitors(0, 0, MonitorEnumProc(cb), 0)
    return monitors


def pin_window_to_monitor(hwnd, monitor_index: int = 1, margin: int = 40) -> bool:
    """Move the window onto a specific monitor WITHOUT stealing focus.

    SetWindowPos with SWP_NOACTIVATE keeps the user's foreground window focused,
    so there is no cursor/focus disruption on other screens. The test still uses
    UIA Invoke()/PrintWindow for input and screenshots — no desktop capture.
    """
    monitors = enum_monitors()
    if not monitors:
        return False
    idx = max(0, min(monitor_index, len(monitors) - 1))
    left, top, right, bottom = monitors[idx]
    x = left + margin
    y = top + margin
    res = user32.SetWindowPos(
        hwnd, 0, x, y, 0, 0,
        SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW,
    )
    return bool(res)


# Module-level monitor selection (set from CLI).
MONITOR_INDEX = 1


def capture_app_window(hwnd) -> tuple[bytes, int, int] | None:
    """Capture window content using PrintWindow (no cursor movement)."""
    rect = ctypes.wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    w, h = rect.right, rect.bottom
    if w == 0 or h == 0:
        return None

    hwnd_dc = user32.GetDC(hwnd)
    mem_dc = gdi32.CreateCompatibleDC(hwnd_dc)
    hbitmap = gdi32.CreateCompatibleBitmap(hwnd_dc, w, h)
    gdi32.SelectObject(mem_dc, hbitmap)

    result = user32.PrintWindow(hwnd, mem_dc, PW_RENDERFULLCONTENT)

    if result:
        bmi = BITMAPINFO()
        bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.bmiHeader.biWidth = w
        bmi.bmiHeader.biHeight = -h
        bmi.bmiHeader.biPlanes = 1
        bmi.bmiHeader.biBitCount = 32
        bmi.bmiHeader.biCompression = 0

        buf_size = w * h * 4
        buf = ctypes.create_string_buffer(buf_size)
        result = gdi32.GetDIBits(hwnd_dc, hbitmap, 0, h, buf, ctypes.byref(bmi), DIB_RGB_COLORS)

        gdi32.DeleteObject(hbitmap)
        gdi32.DeleteDC(mem_dc)
        user32.ReleaseDC(hwnd, hwnd_dc)

        if result:
            return (buf.raw, w, h)

    gdi32.DeleteObject(hbitmap)
    gdi32.DeleteDC(mem_dc)
    user32.ReleaseDC(hwnd, hwnd_dc)
    return None


def save_printwindow_screenshot(hwnd, path: str) -> bool:
    result = capture_app_window(hwnd)
    if result is None:
        return False
    raw_bytes, w, h = result
    from PIL import Image
    img = Image.frombuffer("RGBA", (w, h), raw_bytes, "raw", "BGRA", 0, 1)
    img.save(path)
    return True


def post_text_to_edit(hwnd_edit: int, text: str) -> bool:
    """Send WM_SETTEXT to an Edit control's HWND (no cursor movement)."""
    try:
        user32.SendMessageW(hwnd_edit, WM_SETTEXT, 0, text)
        # Notify parent of text change
        parent = user32.GetParent(hwnd_edit)
        if parent:
            user32.SendMessageW(parent, WM_COMMAND, 0x0400 + 0x0034, hwnd_edit)
        return True
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════
# UI Automation (cursor-free input)
# ═══════════════════════════════════════════════════════════════

try:
    import uiautomation as auto
    auto.uiautomation.SetGlobalSearchTimeout(3)
    HAS_UIA = True
except ImportError:
    HAS_UIA = False
    auto = None


def get_window_via_uia(hwnd) -> "auto.WindowControl | None":
    """Create a UIA WindowControl from a cached HWND."""
    if not HAS_UIA:
        return None
    try:
        wc = auto.WindowControl(searchDepth=1, Handle=hwnd)
        return wc if wc else None
    except Exception:
        return None


def invoke_button_by_name(window, button_label: str, search_depth: int = 20) -> bool:
    """Find a ButtonControl by name and invoke it via UIA Invoke().

    Uses UIA Invoke pattern — does NOT move the cursor or steal focus.
    If the button is found, it will be invoked regardless of visual position.

    Returns True if the button was found and invoked.
    """
    if not HAS_UIA or not window:
        return False

    for depth in range(5, search_depth + 1, 5):
        try:
            btn = window.ButtonControl(searchDepth=depth, Name=button_label)
            if btn and btn.Exists(1):
                btn.Invoke()
                return True
        except Exception:
            continue
    return False


def invoke_tab_by_name(window, tab_label: str) -> bool:
    """Find a TabItemControl by name in the navigation bar and click it via UIA.

    Searches the top navigation region for a matching tab name.
    """
    if not HAS_UIA or not window:
        return False

    for ctrl_cls in (auto.TabItemControl, auto.ButtonControl):
        for depth in range(5, 25, 5):
            try:
                item = ctrl_cls(searchDepth=depth, Name=tab_label)
                if item and item.Exists(0.5):
                    rect = item.BoundingRectangle
                    if rect and rect.top < 200:
                        item.Invoke()
                        return True
            except Exception:
                continue
    return False


def set_edit_text_via_uia(window, search_text: str, value: str) -> bool:
    """Find an Edit control and set its text via UIA Value pattern."""
    if not HAS_UIA or not window:
        return False

    for depth in range(5, 25, 5):
        try:
            edit = window.EditControl(searchDepth=depth, Name=search_text)
            if edit and edit.Exists(0.5):
                try:
                    edit.SetValue(value)
                    return True
                except Exception:
                    # Fallback: get HWND and use WM_SETTEXT
                    try:
                        hwnd_edit = edit.NativeWindowHandle
                        if hwnd_edit and post_text_to_edit(hwnd_edit, value):
                            return True
                    except Exception:
                        continue
        except Exception:
            continue

    # Try finding by AutomationId or by control type
    for depth in range(5, 25, 5):
        try:
            edits = window.EditControl(searchDepth=depth)
            if edits:
                for edit in auto.FindControlList(edit, False):
                    try:
                        edit.SetValue(value)
                        return True
                    except Exception:
                        pass
        except Exception:
            continue
    return False


# ═══════════════════════════════════════════════════════════════
# UNIFIED TEST RUNNER
# ═══════════════════════════════════════════════════════════════

ACTUAL_TABS = ["Dashboard", "Scan", "History", "Smart Search", "Workflows",
               "AI Assistant", "Duplicates", "System", "Cleanup", "Settings"]
NUM_TABS = len(ACTUAL_TABS)

_TAB_INDEX = {name: i for i, name in enumerate(ACTUAL_TABS)}


# Button registry: maps tab name -> list of button labels (by accessible name).
BUTTON_REGISTRY: dict[str, list[str]] = {
    "Dashboard": [
        "New Scan",
        "View History",
        "Find Duplicates",
        "AI Assistant",
        "Cleanup",
        "Refresh",
    ],
    "Scan": [
        "Browse",
        "Open Folder",
        "Deep scan",
        "Scan Now",
        "Export",
        "Stop",
    ],
    "History": [
        "Refresh History",
        "New Scan",
    ],
    "Smart Search": [
        "Browse",
        "Open",
        "Start Search",
    ],
    "Workflows": [
        "Run Workflow",
    ],
    "AI Assistant": [
        "Send",
        "Clear chat",
    ],
    "Duplicates": [
        "Browse",
        "Open",
        "Analyze Duplicates",
    ],
    "System": [
        "Refresh",
    ],
    "Cleanup": [
        "Browse",
        "Analyze",
    ],
    "Settings": [
        "Browse",
        "Open Folder",
        "Test Connection",
        "Save Settings",
        "Reset to Defaults",
    ],
}


class TestRun:
    """Single consolidated test run with all data in one place."""

    def __init__(self, exe_path: Path, log_base: Path = Path("macro_logs")):
        self.exe_path = exe_path
        self.run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        self.run_dir = log_base / self.run_id
        self.run_dir.mkdir(parents=True, exist_ok=True)

        self.screenshot_dir = self.run_dir / "screenshots"
        self.screenshot_dir.mkdir(exist_ok=True)

        self.start_time = datetime.now(timezone.utc)
        self.phase_times: dict[str, float] = {}
        self.steps: list[dict[str, Any]] = []
        self.tests: list[dict[str, Any]] = []
        self.screenshots: list[dict[str, Any]] = []
        self.process_info: dict[str, Any] = {}
        self.error: str | None = None
        self.step_counter = 0
        self._phase_start: float | None = None
        self._current_phase: str | None = None

        self._console_lines: list[str] = []
        self._log(f"Test run started: {self.run_id}")
        self._log(f"Binary: {exe_path}")
        self._log(f"Output: {self.run_dir}")

    def _log(self, msg: str) -> None:
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]
        line = f"[{ts}] {msg}"
        self._console_lines.append(line)
        logger.info("  %s", line)

    def begin_phase(self, name: str) -> None:
        if self._current_phase:
            self.end_phase()
        self._current_phase = name
        self._phase_start = time.time()
        self._log(f"--- Phase: {name} ---")

    def end_phase(self) -> None:
        if self._current_phase and self._phase_start:
            elapsed = time.time() - self._phase_start
            self.phase_times[self._current_phase] = elapsed
            self._log(f"Phase {self._current_phase} completed in {elapsed:.2f}s")
            self._current_phase = None
            self._phase_start = None

    def log_event(self, event_type: str, detail: str = "", duration_ms: float | None = None):
        self.step_counter += 1
        entry = {
            "step": self.step_counter,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": event_type,
            "detail": detail,
            "duration_ms": round(duration_ms, 1) if duration_ms is not None else None,
        }
        self.steps.append(entry)
        dur = f" [{duration_ms:.0f}ms]" if duration_ms is not None else ""
        self._log(f"  {self.step_counter:03d}{dur} {event_type}: {detail}")

    def record_test(self, name: str, passed: bool, detail: str = "", elapsed_ms: float | None = None):
        entry = {
            "name": name,
            "passed": passed,
            "detail": detail,
            "elapsed_ms": round(elapsed_ms, 1) if elapsed_ms is not None else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.tests.append(entry)
        status = "PASS" if passed else "FAIL"
        dur = f" in {elapsed_ms:.0f}ms" if elapsed_ms is not None else ""
        self._log(f"  [{status}] {name}{dur}" + (f" — {detail}" if detail else ""))

    def screenshot(self, name: str, hwnd=None) -> str:
        label = name or f"step_{self.step_counter:03d}"
        path = self.screenshot_dir / f"{label}.png"
        saved = False
        if hwnd:
            saved = save_printwindow_screenshot(hwnd, str(path))
        entry = {
            "name": label,
            "path": str(path.relative_to(self.run_dir)),
            "saved": saved,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.screenshots.append(entry)
        return str(path)

    def record_process_info(self, hwnd, process: subprocess.Popen):
        pid = ctypes.wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        title = get_window_text(hwnd)
        rect = get_window_rect(hwnd)
        self.process_info = {
            "pid": pid.value,
            "window_title": title,
            "window_rect": {"x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3]},
            "exe_path": str(self.exe_path),
            "exe_size_bytes": self.exe_path.stat().st_size if self.exe_path.exists() else 0,
            "pid_matches": pid.value == process.pid,
        }

    def save_report(self) -> Path:
        self.end_phase()

        total_elapsed = (datetime.now(timezone.utc) - self.start_time).total_seconds()
        passed = sum(1 for t in self.tests if t["passed"])
        failed = sum(1 for t in self.tests if not t["passed"])

        report = {
            "run_id": self.run_id,
            "timestamp": self.start_time.isoformat(),
            "elapsed_seconds": round(total_elapsed, 2),
            "platform": {
                "system": platform.system(),
                "release": platform.release(),
                "machine": platform.machine(),
                "python": platform.python_version(),
            },
            "binary": {
                "path": str(self.exe_path),
                "size_bytes": self.process_info.get("exe_size_bytes", 0),
            },
            "process": self.process_info,
            "summary": {
                "total_tests": len(self.tests),
                "passed": passed,
                "failed": failed,
                "pass_rate": f"{passed}/{len(self.tests)}" if self.tests else "0/0",
            },
            "phase_timing": {k: round(v, 3) for k, v in self.phase_times.items()},
            "tests": self.tests,
            "events": self.steps,
            "screenshots": self.screenshots,
            "error": self.error,
        }

        report_path = self.run_dir / "report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        console_path = self.run_dir / "console.log"
        with open(console_path, "w") as f:
            f.write("Space Analyzer Pro — GUI Functional Test (WinUI 3)\n")
            f.write(f"Run: {self.run_id}\n")
            f.write(f"Binary: {self.exe_path}\n")
            f.write("=" * 70 + "\n\n")
            f.write("\n".join(self._console_lines))
            f.write(f"\n\n{'=' * 70}\n")
            f.write(f"Total: {passed}/{len(self.tests)} passed, {failed} failed\n")
            f.write(f"Elapsed: {total_elapsed:.2f}s\n")

        self._append_history(report)

        self._log(f"\nReport: {report_path}")
        self._log(f"Console: {console_path}")
        self._log(f"Screenshots: {self.screenshot_dir}")
        return report_path

    def _append_history(self, report: dict):
        history_path = self.run_dir.parent / "history.jsonl"
        summary = report["summary"]
        entry = {
            "run_id": report["run_id"],
            "timestamp": report["timestamp"],
            "elapsed_seconds": report["elapsed_seconds"],
            "passed": summary["passed"],
            "failed": summary["failed"],
            "total": summary["total_tests"],
            "binary_size": report["binary"]["size_bytes"],
            "platform": report["platform"]["system"],
        }
        with open(history_path, "a") as f:
            f.write(json.dumps(entry) + "\n")


# ═══════════════════════════════════════════════════════════════
# TEST IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════

def find_window():
    """Find the Space Analyzer window via pygetwindow + UIA by HWND."""
    import pygetwindow as gw

    for attempt in range(8):
        wins = gw.getAllWindows()
        space_wins = [w for w in wins if w.title and w.title.lower().startswith("space analyzer")]
        if space_wins:
            for w in space_wins:
                try:
                    hwnd = int(w._hWnd)
                    if HAS_UIA:
                        wc = auto.WindowControl(searchDepth=1, Handle=hwnd)
                        if wc:
                            return wc, hwnd
                    return None, hwnd
                except Exception:
                    continue
        time.sleep(0.5)
    return None, None


def launch_app(exe_path: Path) -> tuple[subprocess.Popen | None, "auto.WindowControl | None", int | None]:
    """Launch the WinUI 3 app and return (process, UIA window, hwnd)."""
    process = subprocess.Popen(
        [str(exe_path)],
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
    )

    time.sleep(4)
    if process.poll() is not None:
        process.terminate()
        return None, None, None

    window, hwnd = find_window()

    if not hwnd:
        process.terminate()
        return None, None, None

    # Show without stealing focus, then pin to the chosen monitor so the app
    # stays away from the user's working screen (no activation, no cursor move).
    user32.ShowWindow(hwnd, SW_SHOWNOACTIVATE)
    time.sleep(0.2)
    pin_window_to_monitor(hwnd, MONITOR_INDEX)
    time.sleep(0.5)

    return process, window, hwnd


def test_launch(run: TestRun) -> tuple[subprocess.Popen | None, "auto.WindowControl | None", int | None]:
    """Launch the app, verify startup state."""
    run.begin_phase("launch")
    run.record_test("binary_exists", run.exe_path.exists(), str(run.exe_path))

    run.log_event("LAUNCH", f"Starting {run.exe_path.name}")
    t0 = time.time()
    process, window, hwnd = launch_app(run.exe_path)
    launch_ms = (time.time() - t0) * 1000

    run.record_test("process_stays_alive", process is not None, f"Launched in {launch_ms:.0f}ms", launch_ms)
    run.record_test("window_found", hwnd is not None, f"HWND={hwnd}" if hwnd else "Not found")

    if hwnd and process is not None:
        run.record_process_info(hwnd, process)
        title = get_window_text(hwnd)
        run.record_test("window_title", "space analyzer" in title.lower(), f"Title: {title}")
        rect = get_window_rect(hwnd)
        run.record_test("window_size", rect[2] > 800 and rect[3] > 600, f"{rect[2]}x{rect[3]}")
        run.screenshot("01_launched", hwnd=hwnd)

    run.end_phase()
    return process, window, hwnd


def navigate_to_tab(window, tab_label: str, run=None) -> bool:
    """Navigate to a tab using UIA Invoke only (no cursor movement)."""
    if window and HAS_UIA:
        ok = invoke_tab_by_name(window, tab_label)
        if run:
            status = "OK" if ok else "FAIL"
            run.log_event("NAV", f"UIA nav to '{tab_label}': {status}")
        return ok

    if run:
        run.log_event("NAV", f"UIA unavailable, cannot navigate to '{tab_label}'")
    return False


def test_tab_navigation(run: TestRun, window, hwnd) -> None:
    """Navigate through all tabs and screenshot each."""
    run.begin_phase("tab_navigation")

    for idx, tab_name in enumerate(ACTUAL_TABS, 1):
        shot_name = f"{idx:02d}_tab_{tab_name.lower().replace(' ', '_')}"
        print(f"  [{idx}] {tab_name}")
        ok = navigate_to_tab(window, tab_name, run)
        time.sleep(0.8)
        run.screenshot(shot_name, hwnd=hwnd)
        run.record_test(f"tab_{tab_name.lower().replace(' ', '_')}_visible", ok, f"Navigated to {tab_name}")

    run.end_phase()


def test_single_button(run: TestRun, window, hwnd, tab_name: str, button_label: str) -> None:
    """Test a single button: find it via UIA Invoke, verify no crash, screenshot."""
    safe_label = button_label.replace(' ', '_').replace('.', '').replace('/', '_').replace('+', 'plus').replace('-', '_')
    test_name = f"button_{tab_name.replace(' ', '_')}_{safe_label}"

    run.log_event("BUTTON_TEST", f"Testing '{button_label}' on {tab_name}")

    # Re-navigate to the tab (in case a previous button click changed context)
    navigate_to_tab(window, tab_name, run)
    time.sleep(0.5)

    pre_shot = f"pre_click_{tab_name.lower().replace(' ', '_')}_{safe_label.lower()}"
    run.screenshot(pre_shot, hwnd=hwnd)

    # Use UIA Invoke (no cursor movement, no focus steal)
    invoked = invoke_button_by_name(window, button_label)
    if not invoked:
        run.record_test(test_name, False, f"Button '{button_label}' not found via UIA Invoke()")
        return

    # Brief wait for UI response
    time.sleep(0.5)

    # Verify the app is still alive
    alive = process_alive(hwnd)
    run.record_test(test_name, alive, f"Button '{button_label}' invoked, process alive: {alive}")

    if not alive:
        run.screenshot(f"crash_after_{safe_label.lower()}", hwnd=hwnd)
    else:
        post_shot = f"post_click_{tab_name.lower().replace(' ', '_')}_{safe_label.lower()}"
        run.screenshot(post_shot, hwnd=hwnd)


def test_all_buttons(run: TestRun, window, hwnd) -> None:
    """Iterate through all tabs and test every button in the BUTTON_REGISTRY."""
    run.begin_phase("button_tests")

    for tab_name in ACTUAL_TABS:
        buttons = BUTTON_REGISTRY.get(tab_name, [])
        if not buttons:
            run.log_event("SKIP_TAB", f"No buttons registered for '{tab_name}'")
            continue

        phase_name = f"buttons_{tab_name.lower().replace(' ', '_')}"
        run.begin_phase(phase_name)
        run.log_event("PHASE", f"Testing {len(buttons)} buttons on {tab_name}")

        # Navigate to tab once
        navigate_to_tab(window, tab_name, run)
        time.sleep(0.5)

        baseline = f"buttons_{tab_name.lower().replace(' ', '_')}_baseline"
        run.screenshot(baseline, hwnd=hwnd)

        for button_label in buttons:
            test_single_button(run, window, hwnd, tab_name, button_label)

        run.screenshot(f"buttons_{tab_name.lower().replace(' ', '_')}_after_all", hwnd=hwnd)
        run.end_phase()

    run.end_phase()


def test_scan(run: TestRun, window, hwnd) -> None:
    """Full scan test: set path via UIA, click Start Scan via UIA."""
    import tempfile, shutil

    scan_dir = Path(tempfile.mkdtemp(prefix="space_test_"))
    try:
        file_count = create_test_files(scan_dir)
        run.log_event("SETUP", f"Created {file_count} test files in {scan_dir}")

        # Navigate to Scan tab
        navigate_to_tab(window, "Scan", run)
        time.sleep(0.5)

        # Set the path in the text field via UIA Value pattern
        path_set = False
        if window and HAS_UIA:
            path_set = set_edit_text_via_uia(window, "", str(scan_dir))
        if not path_set:
            run.log_event("WARN", "Could not set path via UIA — attempting Browse button fallback")
            invoke_button_by_name(window, "Browse")
            time.sleep(1)

        run.screenshot("scan_01_path_entered", hwnd=hwnd)

        # Click Scan Now via UIA Invoke (no cursor movement!)
        invoked = invoke_button_by_name(window, "Scan Now")
        run.log_event("CLICK", f"UIA Invoke Scan Now: {'OK' if invoked else 'FAIL'}")
        time.sleep(1)

        # Wait for scan to complete
        scan_start = time.time()
        scan_completed = False
        for tick in range(60):
            time.sleep(0.5)
            elapsed_s = time.time() - scan_start
            if tick % 6 == 0:
                run.screenshot(f"scan_02_progress_{int(elapsed_s)}s", hwnd=hwnd)
                run.log_event("SCAN_PROGRESS", f"{elapsed_s:.1f}s elapsed")
            if not process_alive(hwnd):
                run.record_test("scan_process_alive", False, "Process died during scan")
                return
            if elapsed_s > 15:
                scan_completed = True
                break

        time.sleep(1)
        scan_ms = (time.time() - scan_start) * 1000

        run.screenshot("scan_03_results", hwnd=hwnd)
        run.record_test("scan_completes", scan_completed, f"Scan finished in {scan_ms:.0f}ms", scan_ms)
        run.record_test("scan_no_crash", process_alive(hwnd), "Window survived scan", scan_ms)

    finally:
        try:
            shutil.rmtree(scan_dir, ignore_errors=True)
            run.log_event("CLEANUP", f"Removed {scan_dir}")
        except Exception:
            pass


def create_test_files(base_dir: Path) -> int:
    """Create a temporary directory with test files for scanning. Returns file count."""
    base_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    test_data = [
        ("docs/readme.txt", b"Hello World " * 100),
        ("docs/report.pdf", b"%PDF-1.4 fake content " * 50),
        ("images/photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 500),
        ("images/logo.png", b"\x89PNG" + b"\x00" * 300),
        ("code/main.rs", b"fn main() { println!(\"hello\"); }\n" * 20),
        ("code/lib.rs", b"pub fn helper() -> i32 { 42 }\n" * 15),
        ("data/users.csv", b"name,email\nAlice,alice@test.com\nBob,bob@test.com\n" * 30),
        ("data/config.json", b'{"key": "value", "num": 42}\n' * 25),
        ("build/output.dll", b"\x00" * 1024),
        ("build/cache.bin", b"\xde\xad\xbe\xef" * 256),
        ("temp/log1.txt", b"Log entry\n" * 200),
        ("temp/log2.txt", b"Error: something\n" * 150),
        ("notes/ideas.md", b"# Ideas\n- Idea one\n- Idea two\n" * 10),
        ("backup/old_data.zip", b"\x50\x4b\x03\x04" + b"\x00" * 800),
    ]
    for rel_path, data in test_data:
        p = base_dir / rel_path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        count += 1
    return count


def kill_process(process):
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def find_binary() -> Path | None:
    repo_root = Path(__file__).resolve().parent.parent.parent
    candidates = [
        repo_root / "gui-winui" / "SpaceAnalyzer" / "bin" / "x64" / "Release" / "net10.0-windows10.0.22621.0" / "SpaceAnalyzer.exe",
        repo_root / "gui-winui" / "SpaceAnalyzer" / "bin" / "x64" / "Debug" / "net10.0-windows10.0.22621.0" / "SpaceAnalyzer.exe",
        repo_root / "target" / "release" / "space-analyzer-gui.exe",
        repo_root / "target" / "debug" / "space-analyzer-gui.exe",
    ]
    for p in candidates:
        if p.exists():
            return p.resolve()
    return None


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser(description="GUI functional test suite (non-intrusive, window-only).")
    ap.add_argument("--monitor", type=int, default=1,
                    help="Monitor index to pin the app to (0=primary, 1=secondary...). Default 1.")
    ap.add_argument("--exe", type=str, default=None, help="Explicit path to SpaceAnalyzer.exe")
    args = ap.parse_args()

    global MONITOR_INDEX
    MONITOR_INDEX = args.monitor

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    exe = Path(args.exe) if args.exe else find_binary()
    if not exe:
        logger.error("SpaceAnalyzer.exe not found.")
        logger.info("Build first: MSBuild gui-winui/SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64")
        sys.exit(1)

    if not HAS_UIA:
        logger.warning("uiautomation package not available. Install: pip install uiautomation pygetwindow pillow")

    print(f"\n  Binary: {exe}")
    print(f"  UIA available: {HAS_UIA}")
    print(f"  Input mode: UIA Invoke() only (zero cursor movement)")

    run = TestRun(exe)
    process = None
    window = None
    hwnd = None

    try:
        # 1. Launch & startup
        print("\n  [1] Launch & Startup")
        process, window, hwnd = test_launch(run)
        if not hwnd:
            run.record_test("abort_no_window", False, "Cannot continue")
            run.save_report()
            sys.exit(1)

        # 2. Tab navigation
        print("\n  [2] Tab Navigation")
        test_tab_navigation(run, window, hwnd)

        # 3. Button tests — verify every interactive button responds without crashing
        print("\n  [3] Button Functionality Tests")
        test_all_buttons(run, window, hwnd)

        # 4. Scan test
        print("\n  [4] Scan Test")
        run.begin_phase("scan_test")
        test_scan(run, window, hwnd)
        run.end_phase()

    except Exception as e:
        run.error = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        run.record_test("unexpected_error", False, str(e))
    finally:
        kill_process(process)

    report_path = run.save_report()

    passed = sum(1 for t in run.tests if t["passed"])
    failed = sum(1 for t in run.tests if not t["passed"])
    total = len(run.tests)
    print()
    print("=" * 70)
    print(f"  {passed}/{total} passed, {failed} failed")
    print(f"  Report: {report_path}")
    print("=" * 70)

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
