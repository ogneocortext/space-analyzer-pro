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

DETERMINISTIC CAPTURE (no flaky UI Automation tab switching):
  Each page is captured by launching a FRESH SpaceAnalyzer.exe with the app's
  stable ``--page <token>`` launch argument (see App.xaml.cs s_pageAliases), so
  the app opens directly on the target tab. This is robust and self-diagnosing:
  a page that fails to load only loses its own screenshot, and the run writes a
  capture_manifest.json recording per-page success / process return code.

  The earlier approach drove tab navigation through the UI Automation
  SelectionItemPattern, which intermittently left the History tab unreachable and
  made the process appear dead. That code (_select_tab / snap) is retained as a
  fallback library but is no longer used by main().

Legacy UIA findings (retained for reference / fallback use):
  - Window title includes a version suffix: "Space Analyzer Pro v4.0.0"
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
LSFW_LOCK = 1  # LockSetForegroundWindow: stop any process stealing foreground

user32.LockSetForegroundWindow.argtypes = [ctypes.c_uint]
user32.LockSetForegroundWindow.restype = ctypes.c_int
user32.GetMonitorInfoW.argtypes = [HWND, ctypes.c_void_p]
user32.GetMonitorInfoW.restype = ctypes.c_int
user32.IsWindow.argtypes = [HWND]
user32.IsWindow.restype = ctypes.c_int
user32.IsWindowVisible.argtypes = [HWND]
user32.IsWindowVisible.restype = ctypes.c_int
user32.GetClassNameW.argtypes = [HWND, ctypes.c_wchar_p, ctypes.c_int]
user32.GetClassNameW.restype = ctypes.c_int
user32.GetWindowTextW.argtypes = [HWND, ctypes.c_wchar_p, ctypes.c_int]
user32.GetWindowTextW.restype = ctypes.c_int

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


class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint32),
        ("rcMonitor", ctypes.wintypes.RECT),
        ("rcWork", ctypes.wintypes.RECT),
        ("dwFlags", ctypes.c_uint32),
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
    ("Installed Apps",      "installed-apps"),
    ("System",              "system"),
    ("Cleanup",             "cleanup"),
    ("USN Journal",         "usn-journal"),
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

# The app exposes a stable, automation-friendly launch entry point:
#   SpaceAnalyzer.exe --page <token>
# where <token> matches a key in App.xaml.cs s_pageAliases (case-insensitive).
# Driving capture through this (one fresh process per page) is DETERMINISTIC and
# immune to the flaky UIA tab-selection that used to leave the History tab
# unreachable / the process to appear dead. Each slug maps to the token passed to
# --page; the visible label is still used for the gallery note.
SLUG_PAGE_TOKEN = {
    "dashboard":      "dashboard",
    "scan":           "scan",
    "history":        "history",
    "smart-search":   "advancedsearch",
    "workflows":      "automationworkflows",
    "ai-chat":        "aichat",
    "dedup":          "dedup",
    "installed-apps": "installedapps",
    "system":         "system",
    "cleanup":        "cleanup",
    "usn-journal":    "usnjournal",
    "settings":       "settings",
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

def enum_monitors() -> list[tuple[int, int, int, int, int]]:
    """Return list of (hmon, left, top, right, bottom) for each display.

    The HMONITOR handle is captured so we can later query the per-monitor work
    area (excluding the taskbar) via GetMonitorInfo.
    """
    monitors: list[tuple[int, int, int, int, int]] = []

    def cb(hmon, _hdc, lprect, _lparam):
        r = lprect.contents
        monitors.append((int(hmon), r.left, r.top, r.right, r.bottom))
        return True

    user32.EnumDisplayMonitors(0, 0, MonitorEnumProc(cb), 0)
    return monitors


def get_monitor_work_area(monitor_index: int) -> tuple[int, int, int, int] | None:
    """Return the (left, top, right, bottom) WORK area of a monitor — the
    usable space excluding the taskbar/docked bars. Falls back to the full
    monitor rect when GetMonitorInfo fails."""
    monitors = enum_monitors()
    if not monitors:
        return None
    idx = max(0, min(monitor_index, len(monitors) - 1))
    hmon = monitors[idx][0]
    mi = MONITORINFO()
    mi.cbSize = ctypes.sizeof(MONITORINFO)
    if user32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
        wa = mi.rcWork
        return (wa.left, wa.top, wa.right, wa.bottom)
    _, left, top, right, bottom = monitors[idx]
    return (left, top, right, bottom)


def pin_window_to_monitor(hwnd, monitor_index: int = 1, margin: int = 40,
                          width: int | None = None, height: int | None = None) -> bool:
    """Move the window onto a specific monitor WITHOUT stealing focus, and size
    it so every top-bar nav tab is visible (avoids the NavigationView 'More'
    overflow flyout that hides trailing tabs like Duplicates/System/Cleanup
    from UI Automation).

    Pass an explicit ``width`` (wider than the monitor) on a narrow/portrait
    display so the top bar never overflows: WinUI lays the nav out by the
    window's client width, not by what is visible on screen, so a wide window
    keeps all tabs in the UIA tree even when it extends past the monitor edge.

    Position/size is applied with ``SetWindowPos(..., SWP_NOACTIVATE)`` which
    never activates the window — the user's foreground window (on another
    screen) stays focused and the app never pops over their work.
    """
    monitors = enum_monitors()
    if not monitors:
        return False
    idx = max(0, min(monitor_index, len(monitors) - 1))
    left, top, right, bottom = monitors[idx][1:5]
    if width and height:
        # Explicit wide size (narrow/portrait displays): position at the monitor
        # origin and extend past the edge — invisible to the user on a separate
        # screen, but keeps every tab in the UIA tree.
        x, y, w, h = left + margin, top + margin, width, height
    else:
        # Default: fill the monitor's WORK area (no taskbar). This is effectively
        # "maximize" but applied with SWP_NOACTIVATE so it never takes focus.
        wa = get_monitor_work_area(monitor_index) or (left, top, right, bottom)
        x, y = wa[0], wa[1]
        h = wa[3] - wa[1]
        # Force a wide client width so all 12 top-bar tabs stay visible and NONE
        # overflow into the NavigationView 'More' flyout (overflowing tabs become
        # MenuItemControls that UIA tab-search misses). WinUI lays the nav out by
        # client width, not visible width, so a window wider than the monitor is
        # fine — it just extends off the (separate) screen edge and is captured in
        # full by PrintWindow. 3200px comfortably fits the longest labels.
        w = max(wa[2] - wa[0], 3200)
    res = user32.SetWindowPos(
        hwnd, 0, x, y, w, h,
        SWP_NOZORDER | SWP_NOACTIVATE,
    )
    return bool(res)


def keep_window_background() -> None:
    """Best-effort: lock the foreground so the captured app cannot steal focus
    and pop over the user's other screen while we drive its UI Automation.

    LockSetForegroundWindow(LSFW_LOCK) prevents any process (including the
    target app) from changing the foreground window until the current foreground
    process releases it. We re-call this before each navigation to keep the lock
    fresh, so the app stays put in the background on its separate screen.
    """
    try:
        user32.LockSetForegroundWindow(LSFW_LOCK)
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


WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, HWND, ctypes.wintypes.LPARAM)
user32.EnumWindows.argtypes = [WNDENUMPROC, ctypes.wintypes.LPARAM]
user32.EnumWindows.restype = ctypes.c_bool
user32.GetWindowThreadProcessId.argtypes = [HWND, ctypes.POINTER(ctypes.wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = ctypes.wintypes.DWORD


def find_window_by_pid(pid: int) -> tuple[auto.WindowControl | None, int | None]:
    """Locate the main window belonging to a specific launched process by PID.

    This is deterministic and immune to title-based search matching a STALE window
    from a previous still-terminating process during rapid sequential launches.

    IMPORTANT: we must NOT use ``auto.WindowControl(Handle=...)`` here. In practice
    that constructor does not wrap the passed HWND — it returns a stale/foreground
    control (e.g. an unrelated OpenCode window), so every window would mis-report
    as 'Chrome_WidgetWin_1' / 'OpenCode' and the class check would fail. Instead we
    identify the real window via raw Win32 ``GetClassNameW`` / ``GetWindowTextW`` /
    ``IsWindowVisible``. Only the HWND is needed downstream (pin + PrintWindow), so a
    ``WindowControl`` is intentionally not returned.
    """
    found: list[tuple[int, str, str, bool]] = []
    name_buf = ctypes.create_unicode_buffer(512)

    def cb(hwnd, _lparam):
        dwpid = ctypes.wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(dwpid))
        if dwpid.value == pid:
            try:
                user32.GetClassNameW(hwnd, name_buf, 512)
                cls = name_buf.value
                user32.GetWindowTextW(hwnd, name_buf, 512)
                title = name_buf.value
                vis = bool(user32.IsWindowVisible(hwnd))
                found.append((int(hwnd), cls, title, vis))
            except Exception:
                pass
        return True

    user32.EnumWindows(WNDENUMPROC(cb), 0)

    # Prefer the visible WinUI top-level window (the class is stable across versions).
    for hwnd, cls, title, vis in found:
        if vis and cls == "WinUIDesktopWin32WindowClass":
            return None, hwnd
    # Fallback: any visible window whose title carries the app prefix.
    for hwnd, cls, title, vis in found:
        if vis and title.lower().startswith("space analyzer"):
            return None, hwnd
    return None, None


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
            # The WinUI window can be destroyed (app crash / close) mid-run, but
            # a stale HWND still yields a truthy WindowControl. Guard with the
            # real Win32 liveness check so we never drive or snapshot a dead
            # window — instead we fall through to a fresh title search (or report
            # the window lost).
            if user32.IsWindow(_CACHED_HWND):
                wc = auto.WindowControl(searchDepth=1, Handle=_CACHED_HWND)
                if wc:
                    return wc, _CACHED_HWND
        except Exception:
            pass
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


def _select_tab_via_more(name: str) -> bool:
    """Last-resort selector for tabs that overflow the top NavigationView into
    the 'More' flyout. In the flyout the items are ``MenuItemControl``s (not
    ``TabItemControl``s) with the same UIA Name.

    Invokes the 'More' button programmatically — NO ``SetFocus`` — so this does
    not activate the window and pop it over the user's other screen. Then it
    selects the overflow item by Name.
    """
    try:
        more = None
        for ctrl_cls in (auto.ButtonControl, auto.MenuItemControl, auto.TabItemControl):
            try:
                c = ctrl_cls(searchDepth=20, Name="More")
                if c:
                    more = c
                    break
            except Exception:
                continue
        if more is None:
            return False
        try:
            pat = more.GetSelectionItemPattern()
            if pat is not None:
                pat.Select()
            else:
                more.Invoke()
        except Exception:
            try:
                more.Invoke()
            except Exception:
                return False
        time.sleep(1.0)  # flyout needs a beat to populate its items
        target = None
        for ctrl_cls in (auto.MenuItemControl, auto.ButtonControl, auto.ListItemControl):
            try:
                c = ctrl_cls(searchDepth=20, Name=name)
                if c:
                    target = c
                    break
            except Exception:
                continue
        if target is None:
            return False
        try:
            pat = target.GetSelectionItemPattern()
            if pat is not None:
                pat.Select()
                print(f"    [select] '{name}' via More flyout (SelectionItemPattern)")
                return True
        except Exception:
            pass
        if hasattr(target, "Invoke") and callable(getattr(target, "Invoke", None)):
            target.Invoke()
            print(f"    [select] '{name}' via More flyout (Invoke)")
            return True
    except Exception:
        return False
    return False


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
            # IMPORTANT: never call item.SetFocus() here. SetFocus on a control in
            # another window activates that window and pops it over the user's
            # other screen. SelectionItemPattern.Select() performs the real tab
            # switch programmatically and cursor-less, without taking focus.
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
    # Last resort: the tab may have overflowed into the NavigationView 'More'
    # flyout, where it is a MenuItemControl rather than a TabItemControl.
    if _select_tab_via_more(name):
        return True
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


def capture_one_page(page_token: str, label: str, slug: str,
                     monitor: int, width, height, delay: float) -> dict:
    """Launch a FRESH SpaceAnalyzer process directly on <page_token> via the app's
    stable ``--page`` entry point, capture it, then terminate. Using one process
    per page is deterministic: a page that fails to load (or crashes) only loses
    its own screenshot and is recorded as a failure in the manifest, instead of
    cascading through UIA tab-selection that used to leave later tabs unreachable.

    Returns a manifest entry dict describing success/failure for self-diagnosis.
    """
    global _CACHED_HWND
    _CACHED_HWND = None  # previous process is gone; never reuse its HWND

    EXE = find_binary()
    result = {"slug": slug, "label": label, "page": page_token, "ok": False}

    proc = subprocess.Popen([str(EXE), "--page", page_token], cwd=str(EXE.parent))
    print(f"  launched pid={proc.pid} (--page {page_token})")

    window, hwnd = None, None
    for _ in range(60):  # poll up to ~30s for cold start + navigation
        window, hwnd = find_window_by_pid(proc.pid)
        if hwnd is not None:
            break
        # Bail early if the process already exited (a crash surfaces here).
        if proc.poll() is not None:
            break
        time.sleep(0.5)

    if hwnd is None:
        result["error"] = "window not found"
        rc = proc.poll()
        if rc is not None:
            result["returncode"] = rc
            result["error"] = f"process exited early (code {rc})"
        proc.terminate()
        return result

    # Pin WITHOUT stealing focus; size so all top-bar tabs stay visible.
    pin_window_to_monitor(hwnd, monitor, width=width, height=height)
    keep_window_background()
    time.sleep(delay)           # let the destination page build its visual tree
    keep_window_background()    # re-lock in case the page raised the window

    path = friendly_name(BUCKET, slug, "png")
    saved = capture_window_png(hwnd, str(path))
    if saved:
        note = (f"WinUI3 automated capture (--page {page_token}) — {label} page. "
                f"{TAB_NOTES.get(slug, '')} Captured {BUCKET.name.split('__')[0]} "
                f"(origin: {ORIGIN}, representation: {REPRESENTATION}).")
        write_note(path, note)
        result["ok"] = True
        result["file"] = path.name
        print(f"    saved {path.name}")
    else:
        result["error"] = "PrintWindow capture failed"

    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
    result["returncode"] = proc.returncode
    return result


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Headed, deterministic screenshot capture via the app's --page launch entry point.")
    ap.add_argument("--monitor", type=int, default=1,
                    help="Monitor index to pin the app to (0=primary, 1=secondary...). Default 1.")
    ap.add_argument("--exe", type=str, default=None, help="Explicit path to SpaceAnalyzer.exe")
    ap.add_argument("--origin", type=str, default=DEFAULT_ORIGIN,
                    help=f"What produced the shots (default {DEFAULT_ORIGIN}); recorded in the bucket + notes.")
    ap.add_argument("--representation", type=str, default=DEFAULT_REPRESENTATION,
                    help=f"What the shots show (default {DEFAULT_REPRESENTATION}); recorded in the bucket + notes.")
    ap.add_argument("--width", type=int, default=None,
                    help="Explicit window width in px. On a narrow/portrait monitor, pass a wide value "
                         "(e.g. 2800) so the top nav never overflows and every tab stays visible.")
    ap.add_argument("--height", type=int, default=None,
                    help="Explicit window height in px (paired with --width).")
    ap.add_argument("--delay", type=float, default=2.5,
                    help="Seconds to wait after launch before capturing each page (default 2.5).")
    ap.add_argument("--tags", type=str, default=None,
                    help="Comma-separated slugs to capture (e.g. 'history,scan'). Default: all pages.")
    ap.add_argument("--keep", type=int, default=MAX_BUCKETS,
                    help=f"Retain only the most recent N capture buckets (default {MAX_BUCKETS}).")
    args = ap.parse_args()

    auto.uiautomation.SetGlobalSearchTimeout(6)

    global BUCKET, ORIGIN, REPRESENTATION
    ORIGIN = args.origin
    REPRESENTATION = args.representation
    date = time.strftime("%Y-%m-%d")
    BUCKET = MACRO_LOGS / f"{date}__{ORIGIN}__{REPRESENTATION}"
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

    wanted = None
    if args.tags:
        wanted = {t.strip().lower() for t in args.tags.split(",") if t.strip()}

    manifest: list[dict] = []
    for label, slug in NAV_ITEMS:
        if wanted is not None and slug not in wanted:
            continue
        token = SLUG_PAGE_TOKEN.get(slug, slug)
        print(f"capturing '{label}' (--page {token})...")
        res = capture_one_page(token, label, slug, args.monitor, args.width, args.height, args.delay)
        manifest.append(res)
        status = "OK" if res.get("ok") else f"FAIL ({res.get('error', 'unknown')})"
        print(f"    -> {status}")

    # Self-diagnosing manifest: no need to manually inspect logs to learn which
    # pages rendered. A non-zero returncode / missing file flags an app crash.
    (BUCKET / "capture_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    ok = sum(1 for r in manifest if r.get("ok"))
    print(f"screenshots saved to {BUCKET}")
    print(f"manifest -> {BUCKET / 'capture_manifest.json'}")
    print(f"captured {ok}/{len(manifest)} pages")
    if ok != len(manifest):
        print("FAILURES:")
        for r in manifest:
            if not r.get("ok"):
                print(f"  - {r['label']} ({r['slug']}): {r.get('error', 'unknown')} "
                      f"returncode={r.get('returncode')}")

    removed = prune_old_buckets(MACRO_LOGS, args.keep)
    if removed:
        print(f"retention: removed {removed} old bucket(s), keeping latest {args.keep}")
    return 0 if ok == len(manifest) else 2


if __name__ == "__main__":
    sys.exit(main())
