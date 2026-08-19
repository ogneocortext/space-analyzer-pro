"""Data / IO helpers, issue tracker, gallery scan, and GUI launcher for the
live progress dashboard.

Pure-ish: these read or write files under the configured root but hold no
subprocess/run state, so they are safe to import and call from tests or other
tools without starting the HTTP server.
"""
import hashlib
import io
import json
import os
import subprocess
import time
from pathlib import Path

try:
    from PIL import Image
    _HAVE_PIL = True
except Exception:  # pragma: no cover - PIL optional for thumbnails/dims
    _HAVE_PIL = False

try:
    from ux_reports_db import ReportsStore as _ReportsStore
    _HAVE_REPORTS_DB = True
except Exception:  # pragma: no cover - sqlite store optional
    _HAVE_REPORTS_DB = False

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
DEFAULT_SHOTS_ROOT = Path("macro_logs")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
CTYPE = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp",
}

# Issue tracker integration: docs/issues.json is the canonical, shared store.
TRACKER_PATH = REPO_ROOT / "docs" / "issues.json"

# GUI launcher: newest built SpaceAnalyzer.exe under gui-winui/.
_GUI_GLOB = "gui-winui/**/bin/**/SpaceAnalyzer.exe"

_VALID_STATUSES = {"open", "in_progress", "done", "wontfix", "blocked", "pending"}


def _read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _latest_report(shots_root: Path) -> dict | None:
    candidates = sorted(shots_root.glob("ux_analysis_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    for c in candidates:
        data = _read_json(c)
        if data:
            return data
    return None


def _get_store(root_base: Path):
    """Return a ``ReportsStore`` for ``root_base``, or ``None`` if unavailable."""
    if not _HAVE_REPORTS_DB:
        return None
    try:
        return _ReportsStore(root_base / "ux_reports.db")
    except Exception:  # pragma: no cover - db open failure
        return None


# --- GUI launcher ---------------------------------------------------------
def _latest_gui_exe() -> Path | None:
    """Return the most recently built SpaceAnalyzer.exe, or None if not built."""
    matches = list(REPO_ROOT.glob(_GUI_GLOB))
    if not matches:
        return None
    return max(matches, key=lambda p: p.stat().st_mtime)


def _launch_gui() -> dict:
    exe = _latest_gui_exe()
    if exe is None or not exe.is_file():
        return {
            "ok": False,
            "message": "No SpaceAnalyzer.exe build found. Build the WinUI project first.",
        }
    try:
        flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
            subprocess, "CREATE_NEW_PROCESS_GROUP", 0
        )
        # Redirect the std handles so the GUI does not inherit the server's console
        # pipe, and use a new process group so it survives server restarts.
        subprocess.Popen(
            [str(exe)],
            creationflags=flags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
        return {"ok": True, "path": str(exe), "message": "Launched Space Analyzer GUI."}
    except (OSError, ValueError) as exc:
        return {"ok": False, "path": str(exe), "message": f"Failed to launch: {exc}"}


# --- Issue tracker integration -------------------------------------------
def _read_tracker() -> dict:
    """Read the canonical issue tracker (docs/issues.json). Missing/empty -> empty store."""
    if TRACKER_PATH.exists():
        raw = TRACKER_PATH.read_bytes()
        data = None
        for enc in ("utf-8", "cp1252"):
            try:
                data = json.loads(raw.decode(enc))
                break
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
        if isinstance(data, dict):
            data.setdefault("issues", [])
            return data
    return {"schema_version": 1, "issues": []}


def _write_json(path: Path, data, *, indent: int = 2, sort_keys: bool = False) -> None:
    """Write JSON as UTF-8 with non-ASCII preserved (no mojibake, human-readable).

    Consolidates the repeated ``json.dumps(...).write_text(...)`` pattern so every
    file write in the dashboard uses the same encoding and error behavior.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, indent=indent, sort_keys=sort_keys, ensure_ascii=False),
        encoding="utf-8",
    )


def _write_tracker(data: dict) -> None:
    """Write the issue tracker (same shape as the pipeline store)."""
    _write_json(TRACKER_PATH, data, indent=2, sort_keys=True)


# Categories that describe the WinUI 3 desktop GUI surface (as opposed to the
# backend/Rust core, the separate Tauri "mainissuetracker" app, or docs).
_WINUI_GUI_CATS = {"winui", "visual_polish", "interaction", "content", "frontend", "layout"}


def _is_winui_gui(it: dict) -> bool:
    """True when an issue describes the WinUI 3 GUI (not the Tauri app or backend)."""
    tid = (it.get("issue_id") or "").lower()
    # The "mainissuetracker:*" issues come from a different (Tauri) desktop app and
    # must not pollute the WinUI 3 triage view.
    if tid.startswith("mainissuetracker:") or tid.startswith("mainissue"):
        return False
    if it.get("category") in _WINUI_GUI_CATS:
        return True
    tags = " ".join(it.get("tags", []) if isinstance(it.get("tags"), list) else []).lower()
    return any(t in tags for t in ("winui", "xaml", "csharp"))


def _norm_status(value: str) -> str:
    """Coerce a status string (plus friendly aliases) into a valid tracker status."""
    if not value:
        return "open"
    v = str(value).strip().lower()
    aliases = {"completed": "done", "closed": "done", "resolved": "done",
               "working": "in_progress", "skip": "wontfix", "ignore": "wontfix"}
    if v in _VALID_STATUSES:
        return v
    return aliases.get(v, "open")


def _issue_counts(issues: list[dict]) -> dict[str, int]:
    out: dict[str, int] = {}
    for it in issues:
        s = it.get("status") or "open"
        out[s] = out.get(s, 0) + 1
    return out


def _build_issues_payload(status=None, category=None, q=None, severity=None, scope=None, limit=200) -> dict:
    data = _read_tracker()
    issues = data.get("issues", [])
    # Scope first so the counts/KPI reflect the requested slice (e.g. WinUI GUI
    # only), then layer the finer status/category/severity/search filters.
    if scope == "winui":
        scoped = [it for it in issues if _is_winui_gui(it)]
    else:
        scoped = issues
    out: list[dict] = []
    ql = (q or "").strip().lower()
    for it in scoped:
        if status and it.get("status") != status:
            continue
        if category and it.get("category") != category:
            continue
        if severity and it.get("severity") != severity:
            continue
        if ql:
            extra = it.get("extra") or {}
            hay = " ".join([
                str(it.get("title", "")), str(it.get("notes", "")),
                str(it.get("issue_id", "")),
                " ".join(it.get("tags", []) if isinstance(it.get("tags"), list) else []),
                str(extra.get("file", "")), str(extra.get("source_set", "")),
            ]).lower()
            if ql not in hay:
                continue
        out.append(it)
    counts = _issue_counts(scoped)
    categories = sorted({it.get("category") for it in scoped if it.get("category")})
    sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    out.sort(key=lambda i: (
        0 if i.get("status") in ("open", "in_progress") else 1,
        sev_rank.get(i.get("severity"), 9),
        (i.get("last_seen") or ""),
    ))
    if limit:
        out = out[:limit]
    return {"status": "ok", "counts": counts, "categories": categories,
            "total": len(scoped), "issues": out}


def _safe_path(root_base: Path, raw: str) -> Path | None:
    """Resolve and ensure the path stays inside root_base (macro_logs)."""
    try:
        p = Path(raw)
        p = (root_base / p) if not p.is_absolute() else p
        p = p.resolve()
        p.relative_to(root_base)
    except (OSError, ValueError):
        return None
    return p


def _read_log_bytes(path: Path) -> bytes:
    """Read a log file that may be actively held open by a child process.

    On Windows the subprocess keeps the log file open for writing, so a
    concurrent read can transiently raise PermissionError (sharing violation).
    Retry briefly to tolerate that instead of 500-ing the endpoint.
    """
    for _ in range(6):
        try:
            return path.read_bytes()
        except OSError:
            time.sleep(0.05)
    # Last attempt: surface a clear message rather than an opaque 500.
    try:
        return path.read_bytes()
    except OSError as e:
        return ("Log temporarily unavailable: " + str(e)).encode("utf-8", "replace")


def _discover_capture_sets(root_base: Path, direct_only: bool = False) -> list[dict]:
    """Enumerate capture-set directories under ``root_base``.

    A capture set is any top-level subdirectory (excluding names that start
    with ``_``) that contains at least one image file. ``direct_only=True``
    restricts the count to images sitting directly inside the set — used by
    the run picker, which points the analyzer at a directory of PNGs. The
    default scans anywhere beneath the set, so capture sets whose images
    live in a ``screenshots/`` subfolder (e.g. ``20260817_213432``) are still
    browsable in the gallery.

    This single source of truth keeps the dashboard run-set picker and the
    gallery root picker consistent (previously they enumerated different
    directory shapes, so a set browsable in one was invisible in the other).
    """
    roots: list[dict] = []
    for d in sorted(root_base.iterdir()):
        if not d.is_dir() or d.name.startswith("_"):
            continue
        try:
            if direct_only:
                entries = [f for f in d.iterdir() if f.is_file()]
                imgs = [f for f in entries if f.suffix.lower() in IMAGE_EXTS]
            else:
                imgs = [f for f in d.rglob("*")
                        if f.is_file() and f.suffix.lower() in IMAGE_EXTS]
        except OSError:
            continue
        if not imgs:
            continue
        rel = d.relative_to(root_base).as_posix()
        roots.append({
            "rel": rel, "label": rel, "count": len(imgs),
            "mtime": d.stat().st_mtime,
        })
    roots.sort(key=lambda r: r["mtime"], reverse=True)
    return roots


def _discover_roots(root_base: Path) -> list[dict]:
    roots = _discover_capture_sets(root_base, direct_only=False)
    total = sum(1 for f in root_base.rglob("*")
                if f.is_file() and f.suffix.lower() in IMAGE_EXTS)
    roots.append({"rel": "__all__", "label": "<entire macro_logs>", "count": total, "mtime": 0})
    return roots


def _scan_gallery(root_base: Path, root_rel: str) -> dict | None:
    base = root_base if root_rel == "__all__" else _safe_path(root_base, root_rel)
    if base is None or not base.is_dir():
        return None
    files = [f for f in base.rglob("*") if f.is_file() and f.suffix.lower() in IMAGE_EXTS]
    images: list[dict] = []
    groups: dict[str, list[str]] = {}
    for f in files:
        try:
            data = f.read_bytes()
        except OSError:
            continue
        h = hashlib.sha256(data).hexdigest()
        try:
            if _HAVE_PIL:
                with Image.open(io.BytesIO(data)) as im:
                    w, hgt = im.size
            else:
                w = hgt = None
        except Exception:
            w = hgt = None
        rel = f.relative_to(root_base).as_posix()
        groups.setdefault(h, []).append(rel)
        images.append({"rel": rel, "path": str(f.resolve()), "size": f.stat().st_size,
                       "w": w, "h": hgt, "mtime": f.stat().st_mtime, "hash": h})
    for h, rels in groups.items():
        if len(rels) > 1:
            keeper = sorted(rels, key=lambda r: (0 if "screenshots_unique" in r else 1, len(r), r))[0]
            for im in images:
                if im["hash"] == h:
                    im["dup_group"] = h[:10]
                    im["keeper"] = (im["rel"] == keeper)
                    im["is_dup"] = (im["rel"] != keeper)
    dup_images = [im for im in images if im.get("is_dup")]
    summary = {"total": len(images), "unique": len(groups),
               "dup_count": len(dup_images), "reclaimable": sum(im["size"] for im in dup_images)}
    images.sort(key=lambda im: im["rel"])
    return {"summary": summary, "images": images, "root": root_rel}


def _delete_one(root_base: Path, raw: str) -> dict:
    p = _safe_path(root_base, raw)
    if p is None:
        return {"ok": False, "error": "path outside allowed root"}
    if not p.is_file():
        return {"ok": False, "error": "not a file"}
    if p.suffix.lower() not in IMAGE_EXTS:
        return {"ok": False, "error": "not an image file"}
    try:
        size = p.stat().st_size
        p.unlink()
    except OSError as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "freed": size, "path": str(p)}


def _analysis_sets(root_base: Path) -> dict:
    """List capture directories under root_base that hold screenshots directly.

    Reuses ``_discover_capture_sets(direct_only=True)`` so the run picker and
    the gallery agree on which directories are valid capture sets, and empty
    buckets (e.g. a stale ``screenshots_*`` prefix dir with no PNGs) are
    excluded instead of offering a run that would find nothing.
    """
    sets = [r["rel"] for r in _discover_capture_sets(root_base, direct_only=True)]
    return {"sets": sets}
