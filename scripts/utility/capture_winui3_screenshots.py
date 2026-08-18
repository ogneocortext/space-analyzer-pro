#!/usr/bin/env python3
"""Launch SpaceAnalyzer and capture screenshots of each page via UI Automation.

NON-INTRUSIVE DESIGN (run on a separate screen without disrupting your work):
  • Screenshots use PrintWindow (PW_RENDERFULLCONTENT) — captures ONLY the app's
    own window content, never the rest of the desktop / your other monitor.
  • The window is pinned to a chosen monitor with SetWindowPos(SWP_NOACTIVATE),
    so it never steals focus from whatever you are doing on another screen.
  • Tab navigation uses the UIA SelectionItemPattern.Select() — a programmatic
    selection that performs the real tab switch WITHOUT ever moving the system
    cursor. No mouse_event / SetCursorPos / pyautogui.click / PostMessage is used
    anywhere, so your pointer stays exactly where it is on your other screen.

CAPTURE POLICY (self-improvement loop — see analyze_design_feedback.py):
  Only run this script when a UI change has been made that would VISIBLY differ
  from the screenshots already under macro_logs/<date>__<origin>__<representation>
  buckets. Do NOT re-capture merely to get fresh feedback — instead re-run
  analyze_design_feedback.py, which rotates through designer personas on the SAME
  images and accumulates a categorized backlog. Re-capture only after an
  implemented change is visible.

The WinUI 3 NavigationView uses PaneDisplayMode="Top" (horizontal top bar, NOT a
left sidebar). Keyboard navigation (Right+Enter) failed intermittently: focus
shifted to Quick Action buttons and opened browser tabs.

Key findings from UIA tree inspection:
  - Window title includes a version suffix: "Space Analyzer Pro v4.0.0"
  - Nav items are TabItemControl (class=NavigationViewItem) with a UIA Name that
    usually equals the visible label — EXCEPT "Advanced Search" (UIA Name "Search")
    and "Automation Workflows" (UIA Name "Workflows").
  - At a normal window width all tabs are visible TabItemControls; when the window
    is narrow some overflow into a "More" flyout (exposed as MenuItemControl).
  - UIA Invoke() throws HRESULT after the first navigation, but
    SelectionItemPattern.Select() switches tabs reliably and cursor-less.
  - Window must be found by process PID/HWND, not title (other apps may match).
  - WindowControl must be re-created from HWND each iteration (elements go stale).
"""
import argparse
import ctypes
import ctypes.wintypes
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pyautogui
import pygetwindow as gw
import uiautomation as auto

# ── Win32 constants ─────────────────────────────────────────────
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

PW_RENDERFULLCONTENT = 2
DIB_RGB_COLORS = 0
SWP_NOSIZE = 0x0001
SWP_NOZORDER = 0x0004
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
SW_SHOWNOACTIVATE = 8

MonitorEnumProc = ctypes.WINFUNCTYPE(
    ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p,
    ctypes.POINTER(ctypes.wintypes.RECT), ctypes.c_void_p,
)


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


REPO = Path(__file__).resolve().parents[2]
MACRO_LOGS = REPO / "macro_logs"
META_FILE = "_gallery_meta.json"

# Thematic bucketing. Each capture run lands in a "bucket" named
#   <date>__<origin>__<representation>
# so the gallery groups shots by the day they were taken, what produced them
# (origin), and what they show (representation). The date is first, so a plain
# alphabetical sort is also chronological. Repeated runs on the same day with the
# same origin/representation append into the SAME bucket instead of spawning a new
# per-run folder (that was the old, messy behaviour).
DEFAULT_ORIGIN = "winui3-capture"
DEFAULT_REPRESENTATION = "ui-pages"

# Retention: keep only the most recent capture buckets so macro_logs cannot grow
# without bound as re-captures accumulate.
MAX_BUCKETS = 6

# Nav items in XAML order: (display_label, slug).
NAV_ITEMS = [
    ("Dashboard",           "dashboard"),
    ("Scan",                "scan"),
    ("History",             "history"),
    ("Advanced Search",     "smart-search"),
    ("Automation Workflows","workflows"),
    ("AI Assistant",        "ai-chat"),
    ("Duplicates",          "dedup"),
    ("System",              "system"),
    ("Cleanup",             "cleanup"),
    ("Settings",            "settings"),  # footer item
]

# One-line human context written as the gallery note for each captured tab.
TAB_NOTES = {
    "dashboard":    "Home overview — disk-usage summary, drive health, and quick stats.",
    "scan":         "Disk/folder scan results with treemap and the largest-files list.",
    "history":      "Past scan history with trend charts and saved snapshots.",
    "smart-search": "Smart search / filters across scans (content, size, date).",
    "workflows":    "Automation workflow builder and saved routines.",
    "ai-chat":      "AI assistant chat for natural-language queries and actions.",
    "dedup":        "Duplicate-file finder results with reclaimable space.",
    "system":       "System resources monitor (CPU / RAM / disk activity).",
    "cleanup":      "Cleanup recommendations and safe-deletion actions.",
    "settings":     "App settings and configuration.",
}

# UIA automation Name differs from the visible label for two tabs.
AUTO_NAME = {
    "Advanced Search": "Search",
    "Automation Workflows": "Workflows",
}

# Set at runtime (main): the active bucket and its origin/representation.
BUCKET: Path | None = None
ORIGIN = DEFAULT_ORIGIN
REPRESENTATION = DEFAULT_REPRESENTATION

# A capture bucket is named <date>__<origin>__<representation>.
CAPTURE_BUCKET_RE = re.compile(r"^\d{4}-\d{2}-\d{2}__.+__.+$")


def load_meta(root: Path) -> dict:
    f = root / META_FILE
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_meta(root: Path, meta: dict) -> None:
    (root / META_FILE).write_text(json.dumps(meta, indent=2), encoding="utf-8")


def write_note(image_path: Path, note: str) -> None:
    meta = load_meta(MACRO_LOGS)
    rel = image_path.relative_to(MACRO_LOGS).as_posix()
    entry = meta.setdefault(rel, {})
    entry["note"] = note
    entry.setdefault("tags", [])
    save_meta(MACRO_LOGS, meta)

pyautogui.FAILSAFE = False  # we never move the cursor; no need for corner-abort
auto.uiautomation.SetGlobalSearchTimeout(2)


# ── Monitor helpers (keep the app off the user's working screen) ──

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
    """Move the window onto a specific monitor WITHOUT stealing focus, and size
    it to fill the monitor so every top-bar nav tab is visible (avoids the
    NavigationView 'More' overflow flyout that hides trailing tabs like
    Duplicates/System/Cleanup from UI Automation).

    SetWindowPos with SWP_NOACTIVATE keeps the user's foreground window focused,
    so there is no cursor/focus disruption on other screens.
    """
    monitors = enum_monitors()
    if not monitors:
        return False
    idx = max(0, min(monitor_index, len(monitors) - 1))
    left, top, right, bottom = monitors[idx]
    x = left + margin
    y = top + margin
    w = max(800, (right - left) - 2 * margin)
    h = max(600, (bottom - top) - 2 * margin)
    res = user32.SetWindowPos(
        hwnd, 0, x, y, w, h,
        SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW,
    )
    return bool(res)


SW_MAXIMIZE = 3


def maximize_window(hwnd) -> None:
    """Maximize the app window so all top-bar nav tabs are visible (avoids the
    NavigationView 'More' overflow that hides trailing tabs from UIA)."""
    try:
        user32.ShowWindow.argtypes = [HWND, ctypes.c_int]
        user32.ShowWindow.restype = ctypes.c_int
        user32.ShowWindow(hwnd, SW_MAXIMIZE)
    except Exception:
        pass


def capture_window_png(hwnd, path: str) -> bool:
    """Capture ONLY the app window via PrintWindow (no desktop capture)."""
    from PIL import Image

    rect = ctypes.wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    w, h = rect.right, rect.bottom
    if w == 0 or h == 0:
        return False

    hwnd_dc = user32.GetDC(hwnd)
    mem_dc = gdi32.CreateCompatibleDC(hwnd_dc)
    hbitmap = gdi32.CreateCompatibleBitmap(hwnd_dc, w, h)
    gdi32.SelectObject(mem_dc, hbitmap)

    result = user32.PrintWindow(hwnd, mem_dc, PW_RENDERFULLCONTENT)
    if not result:
        gdi32.DeleteObject(hbitmap)
        gdi32.DeleteDC(mem_dc)
        user32.ReleaseDC(hwnd, hwnd_dc)
        return False

    bmi = BITMAPINFO()
    bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.bmiHeader.biWidth = w
    bmi.bmiHeader.biHeight = -h
    bmi.bmiHeader.biPlanes = 1
    bmi.bmiHeader.biBitCount = 32
    bmi.bmiHeader.biCompression = 0

    buf_size = w * h * 4
    buf = ctypes.create_string_buffer(buf_size)
    res = gdi32.GetDIBits(hwnd_dc, hbitmap, 0, h, buf, ctypes.byref(bmi), DIB_RGB_COLORS)
    gdi32.DeleteObject(hbitmap)
    gdi32.DeleteDC(mem_dc)
    user32.ReleaseDC(hwnd, hwnd_dc)
    if not res:
        return False

    img = Image.frombuffer("RGBA", (w, h), buf.raw, "raw", "BGRA", 0, 1)
    img.save(path)
    return True


def friendly_name(bucket: Path, slug: str, ext: str = "png") -> Path:
    """Collision-free, human-friendly file name inside a bucket: <slug>.png, or
    <slug>-2.png / <slug>-3.png for repeated captures of the same view. The
    bucket already encodes the date, so the file itself only needs to say what
    the shot shows."""
    base = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-") or "image"
    cand = bucket / f"{base}.{ext}"
    i = 2
    while cand.exists():
        cand = bucket / f"{base}-{i}.{ext}"
        i += 1
    return cand


def snap(slug: str, hwnd, label: str) -> bool:
    """Capture the current window into the active bucket as <slug>.png (or
    <slug>-2.png on repeat) and record a human-readable note for the gallery."""
    path = friendly_name(BUCKET, slug, "png")
    if hwnd:
        saved = capture_window_png(hwnd, str(path))
    else:
        # Only if we somehow have no HWND: this is the one case that captures
        # the whole desktop, so avoid it whenever possible.
        img = pyautogui.screenshot()
        img.save(path)
        saved = True
    if not saved:
        print(f"ERROR: failed to capture '{label}'")
        return False
    note = (f"WinUI3 automated capture — {label} page. {TAB_NOTES.get(slug, '')} "
            f"Captured {BUCKET.name.split('__')[0]} "
            f"(origin: {ORIGIN}, representation: {REPRESENTATION}).")
    write_note(path, note)
    print(f"saved {path.name}")
    time.sleep(0.3)
    return True


# Cached HWND - set on first successful find, reused for all subsequent
# lookups. The window title changes after navigation (no longer starts with
# "Space Analyzer"), so we cannot rely on title-based search after the first
# click.
_CACHED_HWND = None


def find_window() -> tuple[auto.WindowControl | None, int | None]:
    """Find the Space Analyzer window via pygetwindow + UIA by HWND.

    Returns (WindowControl, hwnd). On first call searches by title prefix
    "Space Analyzer" and caches the HWND. On subsequent calls uses the cached
    HWND directly (the window title changes after navigation). Falls back to
    title search if the cached HWND is no longer valid.
    """
    global _CACHED_HWND

    if _CACHED_HWND is not None:
        try:
            wc = auto.WindowControl(searchDepth=1, Handle=_CACHED_HWND)
            if wc:
                return wc, _CACHED_HWND
        except Exception:
            _CACHED_HWND = None

    for attempt in range(5):
        wins = gw.getAllWindows()
        space_wins = [w for w in wins if w.title and w.title.lower().startswith("space analyzer")]
        if space_wins:
            for w in space_wins:
                try:
                    hwnd = int(w._hWnd)
                    wc = auto.WindowControl(searchDepth=1, Handle=hwnd)
                    cls = wc.ClassName if wc else "(none)"
                    if wc and cls == "WinUIDesktopWin32WindowClass":
                        _CACHED_HWND = hwnd
                        return wc, hwnd
                except Exception:
                    continue
        time.sleep(0.5)
    return None, None


def _select_tab(window: auto.Control, label: str) -> bool:
    """Select a nav tab via the UIA SelectionItemPattern.Select().

    This performs the real tab switch programmatically and does NOT move the
    system cursor. Falls back through ButtonControl/MenuItemControl when a
    TabItemControl lacks both SelectionItemPattern and Invoke. Retries with a
    settle delay because the NavigationView can rebuild after the prior
    navigation and the control may not be ready immediately.
    """
    name = AUTO_NAME.get(label, label)
    for attempt in range(3):
        auto.uiautomation.SetGlobalSearchTimeout(6)
        time.sleep(1.2)  # let the previous navigation settle
        item = None
        for ctrl_cls in (auto.TabItemControl, auto.ButtonControl, auto.MenuItemControl):
            try:
                candidate = ctrl_cls(searchDepth=20, Name=name)
                if candidate:
                    item = candidate
                    break
            except Exception:
                continue
        if item is None:
            print(f"    [select] attempt {attempt + 1}: could not find tab '{label}'")
            continue
        try:
            try:
                item.SetFocus()
            except Exception:
                pass
            try:
                pat = item.GetSelectionItemPattern()
                if pat is not None:
                    pat.Select()
                    print(f"    [select] '{label}' via SelectionItemPattern")
                    return True
            except Exception:
                pass
            if hasattr(item, "Invoke") and callable(getattr(item, "Invoke", None)):
                item.Invoke()
                print(f"    [select] '{label}' via Invoke")
                return True
        except Exception as exc:
            print(f"    [select] '{label}' attempt {attempt + 1} failed: {exc}")
    print(f"    [select] '{label}' failed after retries")
    return False


def find_binary() -> Path:
    candidates = [
        REPO / "gui-winui" / "SpaceAnalyzer" / "bin" / "x64" / "Release" / "net10.0-windows10.0.22621.0" / "SpaceAnalyzer.exe",
        REPO / "gui-winui" / "SpaceAnalyzer" / "bin" / "x64" / "Debug" / "net10.0-windows10.0.22621.0" / "SpaceAnalyzer.exe",
    ]
    for p in candidates:
        if p.exists():
            return p.resolve()
    return REPO / "gui-winui" / "SpaceAnalyzer" / "bin" / "x64" / "Debug" / "net10.0-windows10.0.22621.0" / "SpaceAnalyzer.exe"


def prune_old_buckets(root: Path, keep: int = MAX_BUCKETS) -> int:
    """Delete all but the `keep` most-recent capture buckets.

    Buckets are named `YYYY-MM-DD__<origin>__<representation>`; sorting by
    modification time keeps the freshest days. Non-bucket entries (meta file,
    legacy artifacts, generated HTML) are left untouched.
    """
    if keep < 1:
        keep = 1
    buckets = sorted(
        (p for p in root.iterdir() if p.is_dir() and CAPTURE_BUCKET_RE.match(p.name)),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    removed = 0
    for old in buckets[keep:]:
        shutil.rmtree(old)
        removed += 1
    return removed


def main() -> int:
    ap = argparse.ArgumentParser(description="Headed screenshot capture (non-intrusive, cursor-less).")
    ap.add_argument("--monitor", type=int, default=1,
                    help="Monitor index to pin the app to (0=primary, 1=secondary...). Default 1.")
    ap.add_argument("--exe", type=str, default=None, help="Explicit path to SpaceAnalyzer.exe")
    ap.add_argument("--origin", type=str, default=DEFAULT_ORIGIN,
                    help=f"What produced the shots (default {DEFAULT_ORIGIN}); recorded in the bucket + notes.")
    ap.add_argument("--representation", type=str, default=DEFAULT_REPRESENTATION,
                    help=f"What the shots show (default {DEFAULT_REPRESENTATION}); recorded in the bucket + notes.")
    ap.add_argument("--keep", type=int, default=MAX_BUCKETS,
                    help=f"Retain only the most recent N capture buckets (default {MAX_BUCKETS}).")
    args = ap.parse_args()

    global BUCKET, ORIGIN, REPRESENTATION
    ORIGIN = args.origin
    REPRESENTATION = args.representation
    date = time.strftime("%Y-%m-%d")
    BUCKET = MACRO_LOGS / f"{date}__{ORIGIN}__{REPRESENTATION}"
    # Reuse an existing bucket of the same day/origin/representation so repeated
    # runs accumulate instead of spawning a new per-run folder.
    BUCKET.mkdir(parents=True, exist_ok=True)

    EXE = Path(args.exe) if args.exe else find_binary()
    if not EXE.exists():
        print(f"ERROR: SpaceAnalyzer.exe not found at {EXE}")
        print("Build first: MSBuild gui-winui/SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64")
        return 1

    monitors = enum_monitors()
    print(f"Detected {len(monitors)} monitor(s); pinning app to monitor index {args.monitor}")
    if len(monitors) <= args.monitor:
        print(f"  (only {len(monitors)} monitor(s) available; using index {len(monitors)-1})")

    # Launch
    proc = subprocess.Popen([str(EXE)], cwd=str(EXE.parent))
    print(f"launched pid={proc.pid}")

    window, hwnd = None, None
    for _ in range(50):  # poll up to ~25s for the (slow) cold start
        window, hwnd = find_window()
        if window is not None and hwnd is not None:
            break
        time.sleep(0.5)

    if window is None or hwnd is None:
        print("Could not find Space Analyzer window via UI Automation")
        proc.terminate()
        return 1

    # Pin to the chosen monitor WITHOUT stealing focus from your other screen.
    pin_window_to_monitor(hwnd, args.monitor)
    maximize_window(hwnd)
    time.sleep(0.5)
    snap("launched", hwnd, "App launch")

    print(f"  found window: title={window.Name!r}")
    for label, slug in NAV_ITEMS:
        print(f"  navigating to '{label}'...")
        try:
            window, hwnd = find_window()
            if window is None or hwnd is None:
                print(f"    FATAL: cannot find window for '{label}'")
                break
            # Keep the window pinned (no activate) so it never pops over your work.
            pin_window_to_monitor(hwnd, args.monitor)
            maximize_window(hwnd)
            time.sleep(0.4)

            ok = _select_tab(window, label)
            if not ok:
                print(f"    WARNING: could not select '{label}'")
            # WinUI can report the selection before the destination page has
            # finished constructing its visual tree. Give it time to render
            # before PrintWindow snapshots the window surface.
            time.sleep(2.0)
            snap(slug, hwnd, label)
        except Exception as exc:
            print(f"    select failed for '{label}': {exc}")
            snap(slug, hwnd, label)

    # Close
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()

    print(f"screenshots saved to {BUCKET}")
    removed = prune_old_buckets(MACRO_LOGS, args.keep)
    if removed:
        print(f"retention: removed {removed} old bucket(s), keeping latest {args.keep}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
