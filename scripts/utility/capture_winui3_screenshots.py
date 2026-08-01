#!/usr/bin/env python3
"""Launch SpaceAnalyzer and capture screenshots of each page via UI Automation.

The WinUI 3 NavigationView uses PaneDisplayMode="Top" (horizontal top bar,
NOT a left sidebar - the old coordinate-math approach clicked Dashboard content
every time). Keyboard navigation (Right+Enter) also failed intermittently: focus
shifted to Quick Action buttons and opened browser tabs.

This script uses Windows UI Automation (`uiautomation` package) to click each
NavigationViewItem by its visible Name. Key findings from UIA tree inspection:
  - Window title includes a version suffix: "Space Analyzer Pro v4.0.0"
  - Nav items are TabItemControl (class=NavigationViewItem), NOT ListItemControl
  - "System" and "Cleanup" overflow into a "More" button menu
  - "Settings" and "About" are FooterMenuItem TabItemControls
  - UIA Invoke.Click() throws HRESULT after the first navigation (app's event
    handler fails). pyautogui.click() at BoundingRectangle center works.
  - Window must be found by process PID, not title (other apps may match).
  - WindowControl must be re-created from HWND each iteration (elements go stale).
"""
import pygetwindow as gw
import subprocess
import time
from pathlib import Path

import pyautogui
import uiautomation as auto

REPO = Path(r"E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer")
EXE = REPO / "gui-winui" / "SpaceAnalyzer" / "bin" / "x64" / "Debug" / "net10.0-windows10.0.22621.0" / "SpaceAnalyzer.exe"
TS = time.strftime("%Y%m%d_%H%M%S")
SHOTS = REPO / "macro_logs" / f"screenshots_{TS}"
SHOTS.mkdir(parents=True, exist_ok=True)

# Nav items in XAML order - exact Content labels from MainWindow.xaml MenuItems + FooterMenuItems.
NAV_ITEMS = [
    ("Dashboard",          "01_tab_dashboard"),
    ("Scan",               "02_tab_scan"),
    ("History",            "03_tab_history"),
    ("Advanced Search",    "04_tab_smart_search"),
    ("Automation Workflows", "05_tab_workflows"),
    ("AI Assistant",       "06_tab_ai_chat"),
    ("Duplicates",         "07_tab_dedup"),
    ("System",             "08_tab_system"),  # in overflow "More" menu
    ("Cleanup",            "10_tab_cleanup"),  # in overflow "More" menu
    ("Settings",           "09_tab_settings"),  # footer item
]
OVERFLOW_ITEMS = {"System", "Cleanup"}

pyautogui.FAILSAFE = True
auto.uiautomation.SetGlobalSearchTimeout(2)


def snap(name: str):
    path = SHOTS / f"{name}.png"
    img = pyautogui.screenshot()
    img.save(path)
    print(f"saved {path.name}")
    time.sleep(0.3)


# Cached HWND - set on first successful find, reused for all subsequent
# lookups. The window title changes after navigation (no longer starts with
# "Space Analyzer"), so we cannot rely on title-based search after the first
# click.
_CACHED_HWND = None


def find_window() -> auto.WindowControl | None:
    """Find the Space Analyzer window via pygetwindow + UIA by HWND.

    On first call, searches by title prefix "Space Analyzer" and caches the
    HWND. On subsequent calls, uses the cached HWND directly (the window
    title changes after navigation, so title-based search would fail).
    Falls back to title search if the cached HWND is no longer valid.
    """
    global _CACHED_HWND

    # Try cached HWND first
    if _CACHED_HWND is not None:
        print(f"    [find_window] trying cached HWND {_CACHED_HWND}")
        try:
            wc = auto.WindowControl(searchDepth=1, Handle=_CACHED_HWND)
            if wc:
                # The class name can change during navigation (observed:
                # WinUIDesktopWin32WindowClass -> Chrome_WidgetWin_1).
                # Accept any top-level window at our cached HWND.
                return wc
        except Exception as exc:
            print(f"      cached HWND failed: {exc}")
            _CACHED_HWND = None

# Fall back to title-based search
    for attempt in range(5):
        wins = gw.getAllWindows()
        space_wins = [w for w in wins if w.title and w.title.lower().startswith("space analyzer")]
        if space_wins:
            print(f"    [find_window] attempt {attempt+1}: found {len(space_wins)} Space Analyzer window(s)")
            for w in space_wins:
                try:
                    hwnd = int(w._hWnd)
                    wc = auto.WindowControl(searchDepth=1, Handle=hwnd)
                    cls = wc.ClassName if wc else "(none)"
                    print(f"      hwnd={hwnd} class={cls!r} title={w.title!r}")
                    if wc and cls == "WinUIDesktopWin32WindowClass":
                        _CACHED_HWND = hwnd
                        return wc
                except Exception as exc:
                    print(f"      hwnd={w._hWnd} error: {exc}")
                    continue
        else:
            print(f"    [find_window] attempt {attempt+1}: no Space Analyzer windows found (total={len(wins)})")
        time.sleep(0.5)
    return None


def click_overflow_item(window: auto.Control, label: str) -> bool:
    """Open the 'More' overflow menu and click an item inside it."""
    auto.uiautomation.SetGlobalSearchTimeout(2)
    # Find and click the "More" overflow button
    rect = get_nav_item_bounds(window, "More")
    if rect is None:
        # Fallback: try as ButtonControl
        try:
            more = window.ButtonControl(searchDepth=20, Name="More")
            rect = more.BoundingRectangle
        except Exception:
            pass
    if rect is None:
        # Coordinate fallback: "More" button is at the right end of the nav bar
        try:
            win_rect = window.BoundingRectangle
            if win_rect and win_rect.top >= -500:
                # "More" button is typically at window_right - 60, nav_bar_y + center
                x = win_rect.right - 60
                y = win_rect.top + _NAV_BAR_Y_OFFSET + 22
                print(f"    [overflow-coord] clicking 'More' at ({x},{y})")
                pyautogui.click(x, y)
                time.sleep(0.5)
        except Exception:
            return False
    else:
        _click_at_center(rect)
        time.sleep(0.5)
    # The overflow popup is a separate window - find it
    try:
        popup = auto.WindowControl(searchDepth=2, ClassName="Popup")
        if popup and popup.Exists(3):
            rect = get_nav_item_bounds(popup, label)
            if rect is not None:
                _click_at_center(rect)
                time.sleep(0.3)
                return True
    except Exception:
        pass
    # Fallback: search entire window tree for the overflow item
    try:
        item = auto.Control(searchDepth=20, Name=label)
        if item:
            r = item.BoundingRectangle
            if r and r.top >= 0:
                _click_at_center(r)
                time.sleep(0.3)
                return True
    except Exception:
        pass
    return False


def _click_at_center(rect) -> None:
    """Click at the center of a UIA BoundingRectangle using pyautogui."""
    cx = (rect.left + rect.right) / 2
    cy = (rect.top + rect.bottom) / 2
    pyautogui.click(cx, cy)


# Map of nav item labels to their horizontal offset from the window left edge.
# These are empirical offsets measured from successful UIA hits. The nav bar
# sits at a fixed Y offset from the window top (~45px into the title bar).
# Fixed screen coordinates for nav items, measured from a window positioned
# at (100, 50) with the nav bar at y=105. These are used when UIA cannot find
# the nav item (WinUI 3 content islands hide nav items from UIA after nav).
# The window is normalized to (100, 50) before each click.
_FIXED_NAV_COORDS = {
    "Dashboard":             (182, 105),
    "Scan":                  (306, 105),
    "History":               (430, 105),
    "Advanced Search":       (554, 105),
    "Automation Workflows":  (678, 105),
    "AI Assistant":          (802, 105),
    "Duplicates":            (926, 105),
    "System":               (1050, 105),  # overflow item
    "Cleanup":              (1050, 105),  # overflow item
    "Settings":              (100,  963),  # footer item
}


def _click_nav_by_coord(window, label):
    """Click a nav item using fixed screen coordinates.

    Used as fallback when UIA cannot find the nav item (common in WinUI 3
    after navigation, where content islands may hide nav items from UIA).

    Normalizes the window to (100, 50) first so the fixed coordinates are
    accurate regardless of where the app moved the window.
    """
    if label not in _FIXED_NAV_COORDS:
        return False
    try:
        # Normalize window position -- the app can move/resize the window
        # after navigation, making relative coordinates wrong.
        try:
            hwnd = window.NativeWindowHandle
            for w in gw.getAllWindows():
                if hasattr(w, '_hWnd') and int(w._hWnd) == hwnd:
                    if w.left is not None and (w.top != 50 or w.left != 100):
                        w.restore()
                        w.moveTo(100, 50)
                        w.activate()
                        time.sleep(0.5)
                    break
        except Exception:
            pass

        x, y = _FIXED_NAV_COORDS[label]
        print(f'    [coord-fallback] clicking {label!r} at fixed ({x},{y})')
        pyautogui.click(x, y)
        return True
    except Exception as exc:
        print(f'    [coord-fallback] error: {exc}')
        return False

def get_nav_item_bounds(window: auto.Control, label: str) -> auto.Rect | None:
    """Find a NavigationViewItem (TabItemControl) and return its BoundingRectangle.

    Accessing BoundingRectangle triggers a UIA search. We skip Exists() because
    it triggers WalkControl->GetFirstChildControl which throws on stale elements.

    CRITICAL: After navigation, UIA may find content headings (same Name) inside
    the page content instead of the actual nav tab. We reject any hit whose
    top edge is below 150px -- the nav bar is always at the top of the window.
    """
    candidates = []
    for ctrl_cls in (auto.TabItemControl, auto.ButtonControl):
        try:
            item = ctrl_cls(searchDepth=20, Name=label)
            rect = item.BoundingRectangle
            if rect and rect.left != -32000 and rect.right != 0:
                candidates.append((item.ControlTypeName, rect))
        except Exception:
            continue

    for ctrl_type, rect in candidates:
        # Only accept items in the top nav bar region (y < 150).
        # Content headings can share the same Name after navigation.
        if rect.top < 150:
            print(f"    found {ctrl_type} '{label}' at {rect}")
            return rect
        else:
            print(f"    [nav-filter] skipping {ctrl_type} '{label}' at y={rect.top} (content heading?)")

    return None


# Launch
proc = subprocess.Popen([str(EXE)], cwd=str(EXE.parent))
print(f"launched pid={proc.pid}")
time.sleep(5)

snap("01_launched")

# -- Navigate via UI Automation --
print("locating Space Analyzer window via UI Automation (HWND)...")
window = find_window()
if window is None:
    raise RuntimeError("Could not find Space Analyzer window via UI Automation")

print(f"  found window: title={window.Name!r}")
window.SetFocus()
time.sleep(0.5)

for label, stem in NAV_ITEMS:
    print(f"  navigating to '{label}'...")
    try:
        # Re-acquire the window from HWND each iteration. UIA elements go stale
        # after page navigation (HRESULT -2147417851 / -2147220991 on refind).
        # Re-finding by HWND gives a fresh element tree.
        window = find_window()
        if window is None:
            print(f"    FATAL: cannot find window for '{label}'")
            break
        window.SetFocus()
        time.sleep(0.5)

        # Normalize window position -- UIA BoundingRectangle can report wrong
        # coordinates after navigation (window appears off-screen). Use
        # pygetwindow to restore to a consistent on-screen position.
        try:
            hwnd = window.NativeWindowHandle
            for w in gw.getAllWindows():
                if hasattr(w, "_hWnd") and int(w._hWnd) == hwnd:
                    if w.left is not None and (w.top < 0 or w.left > 2000 or w.top > 1000):
                        w.restore()
                        w.moveTo(100, 50)
                        w.activate()
                        time.sleep(0.5)
                    break
        except Exception:
            pass

        if label in OVERFLOW_ITEMS:
            ok = click_overflow_item(window, label)
            if not ok:
                print(f"    WARNING: '{label}' not found in overflow menu")
            time.sleep(1.0)
        else:
            # Try UIA first
            rect = get_nav_item_bounds(window, label)
            if rect is not None:
                _click_at_center(rect)
                time.sleep(1.0)
            else:
                # Settings is a footer item that UIA rarely finds -- use coords directly
                if label == "Settings":
                    print(f"    using fixed coordinates for footer item '{label}'")
                    _click_nav_by_coord(window, label)
                    time.sleep(1.0)
                else:
                    # UIA failed -- fall back to coordinate-based nav bar click.
                    # Nav bar is at a fixed offset from the window title bar.
                    ok = _click_nav_by_coord(window, label)
                    if not ok:
                        print(f"    WARNING: '{label}' not found via UIA or coordinates")
                    time.sleep(1.0)
        snap(stem)
    except Exception as exc:
        print(f"    click failed for '{label}': {exc}")
        snap(stem)

# Close
proc.terminate()
try:
    proc.wait(timeout=10)
except subprocess.TimeoutExpired:
    proc.kill()

print(f"screenshots saved to {SHOTS}")
