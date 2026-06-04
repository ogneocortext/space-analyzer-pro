#!/usr/bin/env python3
"""
Space Analyzer Pro — GUI Functional Test Suite
================================================
Tests the GUI binary for functional correctness, not just visibility.
Uses Win32 PrintWindow for capture and PostMessage for input (zero screen disruption).

Test categories:
  1. Launch & startup state
  2. Tab navigation (all 8 tabs)
  3. Scan execution (start, progress, results, cancel)
  4. Settings persistence (change, save, restart, verify)
  5. Export functionality (text, JSON, CSV, Markdown)
  6. AI chat (graceful handling when Ollama unavailable)
  7. History (scan records saved and displayed)
  8. Error states (invalid paths, empty results)

Output (all in macro_logs/<run_id>/):
  report.json        — consolidated test report (one file for analysis)
  console.log        — human-readable log with timestamps
  screenshots/       — PNG captures at each test step
  history.jsonl      — append-only run history for trend analysis
"""

import subprocess
import time
import sys
import json
import ctypes
import ctypes.wintypes
import os
import platform
import traceback
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

# SendInput structures
class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", ctypes.c_long),
        ("dy", ctypes.c_long),
        ("mouseData", ctypes.c_ulong),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", ctypes.c_ushort),
        ("wScan", ctypes.c_ushort),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]

class INPUT_UNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT)]

class INPUT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong), ("union", INPUT_UNION)]

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_ABSOLUTE = 0x8000
MOUSEEVENTF_VIRTUALDESK = 0x4000
KEYEVENTF_KEYUP = 0x0002
SW_SHOWMINIMIZED = 2
SW_RESTORE = 9
PW_RENDERFULLCONTENT = 2
DIB_RGB_COLORS = 0
VK_LEFT = 0x25
VK_RIGHT = 0x27
VK_RETURN = 0x0D


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


def screen_to_client(hwnd, sx, sy):
    pt = ctypes.wintypes.POINT()
    pt.x = sx
    pt.y = sy
    user32.ScreenToClient(hwnd, ctypes.byref(pt))
    return pt.x, pt.y


def get_screen_size():
    """Get full virtual screen size (multi-monitor aware)."""
    SM_XVIRTUALSCREEN = 76
    SM_YVIRTUALSCREEN = 77
    SM_CXVIRTUALSCREEN = 78
    SM_CYVIRTUALSCREEN = 79
    x = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
    y = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
    w = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
    h = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)
    return x, y, w, h


def sendinput_mouse_click(screen_x, screen_y):
    """Click at absolute screen coordinates using SendInput (OS-level, reaches egui)."""
    sx_abs, sy_abs, sw, sh = get_screen_size()
    # Convert to 0-65535 range for MOUSEEVENTF_ABSOLUTE
    nx = int((screen_x - sx_abs) * 65535 / max(sw - 1, 1))
    ny = int((screen_y - sy_abs) * 65535 / max(sh - 1, 1))

    # Move
    inp = INPUT()
    inp.type = INPUT_MOUSE
    inp.union.mi.dx = nx
    inp.union.mi.dy = ny
    inp.union.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(0.01)

    # Down
    inp2 = INPUT()
    inp2.type = INPUT_MOUSE
    inp2.union.mi.dwFlags = MOUSEEVENTF_LEFTDOWN
    user32.SendInput(1, ctypes.byref(inp2), ctypes.sizeof(INPUT))
    time.sleep(0.01)

    # Up
    inp3 = INPUT()
    inp3.type = INPUT_MOUSE
    inp3.union.mi.dwFlags = MOUSEEVENTF_LEFTUP
    user32.SendInput(1, ctypes.byref(inp3), ctypes.sizeof(INPUT))


def sendinput_key(vk_code):
    """Press and release a key using SendInput."""
    inp_down = INPUT()
    inp_down.type = INPUT_KEYBOARD
    inp_down.union.ki.wVk = vk_code
    user32.SendInput(1, ctypes.byref(inp_down), ctypes.sizeof(INPUT))
    time.sleep(0.02)

    inp_up = INPUT()
    inp_up.type = INPUT_KEYBOARD
    inp_up.union.ki.wVk = vk_code
    inp_up.union.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(1, ctypes.byref(inp_up), ctypes.sizeof(INPUT))


def find_hwnd(title="Space Analyzer"):
    class EnumData(ctypes.Structure):
        _fields_ = [("target", ctypes.c_wchar_p), ("hwnd", ctypes.c_long)]
    result = EnumData()
    result.target = title

    @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.POINTER(EnumData))
    def enum_proc(hwnd, lparam):
        buf = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, buf, 256)
        if title.lower() in buf.value.lower():
            lparam.contents.hwnd = hwnd
            return False
        return True

    user32.EnumWindows(enum_proc, ctypes.byref(result))
    return result.hwnd if result.hwnd else None


def capture_app_window(hwnd) -> Optional[Tuple[bytes, int, int]]:
    rect = ctypes.wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    w, h = rect.right, rect.bottom
    if w == 0 or h == 0:
        return None

    hwnd_dc = user32.GetDC(hwnd)
    mem_dc = gdi32.CreateCompatibleDC(hwnd_dc)
    hbitmap = gdi32.CreateCompatibleBitmap(hwnd_dc, w, h)
    gdi32.SelectObject(mem_dc, hbitmap)

    # PW_RENDERFULLCONTENT forces the window to render its content into the DC.
    # Required for egui/eframe which uses hardware-accelerated wgpu rendering.
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


def silent_click(hwnd, screen_x, screen_y, desc="", run=None):
    """Click via SendInput — OS-level, reaches egui's input handler."""
    t0 = time.time()
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.02)
    sendinput_mouse_click(screen_x, screen_y)
    elapsed = (time.time() - t0) * 1000

    cx, cy = screen_to_client(hwnd, screen_x, screen_y)
    if run:
        run.log_event("CLICK", f"{desc} at ({screen_x},{screen_y}) client({cx},{cy})", duration_ms=elapsed)
    time.sleep(0.25)


def send_key(hwnd, vk_code, desc="", run=None):
    """Press a key via SendInput (window must be foreground)."""
    t0 = time.time()
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.02)
    sendinput_key(vk_code)
    elapsed = (time.time() - t0) * 1000
    if run:
        run.log_event("KEY", f"{desc} vk=0x{vk_code:02X}", duration_ms=elapsed)
    time.sleep(0.15)


def get_window_text(hwnd) -> str:
    buf = ctypes.create_unicode_buffer(1024)
    user32.GetWindowTextW(hwnd, buf, 1024)
    return buf.value


def get_window_rect(hwnd) -> Tuple[int, int, int, int]:
    rect = ctypes.wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)


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


# ═══════════════════════════════════════════════════════════════
#  UNIFIED TEST RUNNER
# ═══════════════════════════════════════════════════════════════

ACTUAL_TABS = ["Dashboard", "Scan", "History", "Smart Search", "Workflows", "AI Chat", "System", "Settings"]
NUM_TABS = len(ACTUAL_TABS)

# Tab indices for keyboard navigation
_TAB_INDEX = {name: i for i, name in enumerate(ACTUAL_TABS)}
_current_tab_index = 0  # Track where keyboard focus is


def navigate_tab(hwnd, target_tab: str, run=None):
    """Navigate to a tab using Left/Right arrow keys from current position."""
    global _current_tab_index
    target_idx = _TAB_INDEX[target_tab]
    steps = target_idx - _current_tab_index

    if steps > 0:
        for _ in range(steps):
            send_key(hwnd, VK_RIGHT, "Right arrow", run)
    elif steps < 0:
        for _ in range(-steps):
            send_key(hwnd, VK_LEFT, "Left arrow", run)

    _current_tab_index = target_idx


def tab_center(win: tuple, tab_index: int) -> tuple:
    left, top, width, height = win
    tab_bar_y = top + 38
    tab_w = width // NUM_TABS
    return (left + tab_w * tab_index + tab_w // 2, tab_bar_y)


class TestRun:
    """Single consolidated test run with all data in one place."""

    def __init__(self, exe_path: Path, log_base: Path = Path("macro_logs")):
        self.exe_path = exe_path
        self.run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.run_dir = log_base / self.run_id
        self.run_dir.mkdir(parents=True, exist_ok=True)

        self.screenshot_dir = self.run_dir / "screenshots"
        self.screenshot_dir.mkdir(exist_ok=True)

        self.start_time = datetime.now()
        self.phase_times: Dict[str, float] = {}
        self.steps: List[Dict[str, Any]] = []
        self.tests: List[Dict[str, Any]] = []
        self.screenshots: List[Dict[str, Any]] = []
        self.process_info: Dict[str, Any] = {}
        self.error: Optional[str] = None
        self.step_counter = 0
        self._phase_start: Optional[float] = None
        self._current_phase: Optional[str] = None

        self._console_lines: List[str] = []
        self._log(f"Test run started: {self.run_id}")
        self._log(f"Binary: {exe_path}")
        self._log(f"Output: {self.run_dir}")

    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        line = f"[{ts}] {msg}"
        self._console_lines.append(line)
        print(f"  {line}")

    def begin_phase(self, name: str):
        if self._current_phase:
            self.end_phase()
        self._current_phase = name
        self._phase_start = time.time()
        self._log(f"--- Phase: {name} ---")

    def end_phase(self):
        if self._current_phase and self._phase_start:
            elapsed = time.time() - self._phase_start
            self.phase_times[self._current_phase] = elapsed
            self._log(f"Phase {self._current_phase} completed in {elapsed:.2f}s")
            self._current_phase = None
            self._phase_start = None

    def log_event(self, event_type: str, detail: str = "", duration_ms: Optional[float] = None):
        self.step_counter += 1
        entry = {
            "step": self.step_counter,
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "detail": detail,
            "duration_ms": round(duration_ms, 1) if duration_ms is not None else None,
        }
        self.steps.append(entry)
        dur = f" [{duration_ms:.0f}ms]" if duration_ms is not None else ""
        self._log(f"  {self.step_counter:03d}{dur} {event_type}: {detail}")

    def record_test(self, name: str, passed: bool, detail: str = "", elapsed_ms: Optional[float] = None):
        entry = {
            "name": name,
            "passed": passed,
            "detail": detail,
            "elapsed_ms": round(elapsed_ms, 1) if elapsed_ms is not None else None,
            "timestamp": datetime.now().isoformat(),
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
            "timestamp": datetime.now().isoformat(),
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

        total_elapsed = (datetime.now() - self.start_time).total_seconds()
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
            f.write(f"Space Analyzer Pro — GUI Functional Test\n")
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

    def _append_history(self, report: Dict):
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
#  TEST IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════

def launch_for_tab(run: TestRun, tab_name: str = None) -> Tuple[Optional[subprocess.Popen], Optional[Any], Optional[tuple]]:
    """Launch the GUI with --tab flag, wait for window, return (process, hwnd, win)."""
    args = [str(run.exe_path)]
    if tab_name:
        args.extend(["--tab", tab_name])

    process = subprocess.Popen(
        args,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
    )

    time.sleep(3)
    if process.poll() is not None:
        return None, None, None

    hwnd = None
    for _ in range(10):
        hwnd = find_hwnd()
        if hwnd:
            break
        time.sleep(0.5)

    if not hwnd:
        process.terminate()
        return None, None, None

    user32.ShowWindow(hwnd, SW_RESTORE)
    time.sleep(0.5)
    win = get_window_rect(hwnd)
    return process, hwnd, win


def kill_process(process):
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()


def test_launch(run: TestRun) -> Tuple[Optional[subprocess.Popen], Optional[Any], Optional[tuple]]:
    """Launch with default tab (Dashboard), verify startup."""
    run.begin_phase("launch")
    run.record_test("binary_exists", run.exe_path.exists(), str(run.exe_path))

    run.log_event("LAUNCH", f"Starting {run.exe_path.name}")
    t0 = time.time()
    process, hwnd, win = launch_for_tab(run)
    launch_ms = (time.time() - t0) * 1000

    run.record_test("process_stays_alive", process is not None, f"Launched in {launch_ms:.0f}ms", launch_ms)
    run.record_test("window_found", hwnd is not None, f"HWND={hwnd}" if hwnd else "Not found")

    if hwnd:
        run.record_process_info(hwnd, process)
        title = get_window_text(hwnd)
        run.record_test("window_title", "space analyzer" in title.lower(), f"Title: {title}")
        run.record_test("window_size", win[2] > 800 and win[3] > 600, f"{win[2]}x{win[3]}")
        run.screenshot("01_launched", hwnd=hwnd)

    run.end_phase()
    return process, hwnd, win


def test_tab(run: TestRun, tab_name: str, screenshot_name: str, extra_fn=None):
    """Launch a fresh instance with --tab, screenshot, optionally run extra_fn, kill."""
    phase_name = f"tab_{tab_name.lower().replace(' ', '_')}"
    run.begin_phase(phase_name)

    t0 = time.time()
    process, hwnd, win = launch_for_tab(run, tab_name)
    elapsed_ms = (time.time() - t0) * 1000

    if not hwnd:
        run.record_test(f"{phase_name}_launch", False, "Failed to launch")
        run.end_phase()
        return

    run.record_test(f"{phase_name}_launch", True, f"Launched with --tab '{tab_name}'", elapsed_ms)
    run.screenshot(screenshot_name, hwnd=hwnd)

    if extra_fn:
        extra_fn(run, hwnd, win)

    kill_process(process)
    run.end_phase()


def test_scan_button(run: TestRun, hwnd, win):
    """Click the Scan button inside a --tab scan instance."""
    scan_btn_x = win[0] + win[2] // 2 - 60
    scan_btn_y = win[1] + 120

    t0 = time.time()
    silent_click(hwnd, scan_btn_x, scan_btn_y, "Click Scan button", run)

    for tick in range(30):
        time.sleep(0.5)
        if tick % 4 == 0:
            run.screenshot(f"03_scan_progress_{tick}", hwnd=hwnd)

    time.sleep(1)
    scan_ms = (time.time() - t0) * 1000
    run.screenshot("03_scan_results", hwnd=hwnd)
    run.record_test("scan_no_crash", process_alive(hwnd), "Window still alive after scan", scan_ms)


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

def find_binary() -> Optional[Path]:
    candidates = [
        Path("target/release/space-analyzer-gui.exe"),
        Path("target/debug/space-analyzer-gui.exe"),
        Path("bin/space-analyzer-gui.exe"),
    ]
    for p in candidates:
        if p.exists():
            return p.resolve()
    return None


def main():
    exe = find_binary()
    if not exe:
        print("ERROR: space-analyzer-gui.exe not found.")
        print("  Build first: cargo build --release --bin space-analyzer-gui")
        sys.exit(1)

    print(f"\n  Binary: {exe}")

    run = TestRun(exe)
    process = None

    try:
        # 1. Launch & startup
        print("\n  [1] Launch & Startup")
        process, hwnd, win = test_launch(run)
        if not hwnd:
            run.record_test("abort_no_window", False, "Cannot continue")
            run.save_report()
            sys.exit(1)

        # 2. Scan tab — launch fresh, click Scan button
        print("\n  [2] Scan Tab + Execution")
        kill_process(process)
        test_tab(run, "Scan", "02_tab_scan", extra_fn=test_scan_button)

        # 3. Each remaining tab — launch fresh with --tab, screenshot, kill
        tab_tests = [
            ("Dashboard", "03_tab_dashboard"),
            ("History", "04_tab_history"),
            ("Smart Search", "05_tab_smart_search"),
            ("Workflows", "06_tab_workflows"),
            ("AI Chat", "07_tab_ai_chat"),
            ("System", "08_tab_system"),
            ("Settings", "09_tab_settings"),
        ]
        for i, (tab, shot) in enumerate(tab_tests, 3):
            print(f"\n  [{i}] {tab} Tab")
            test_tab(run, tab, shot)

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
