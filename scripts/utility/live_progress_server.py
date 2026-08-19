#!/usr/bin/env python3
"""
Live progress server for analyze_ux_screenshots.py, plus an interactive
screenshot gallery / dedup manager.

Run it while the analyzer is working:

    python scripts/utility/live_progress_server.py

 Then open:
    http://127.0.0.1:8777/        live Ollama analysis dashboard
    http://127.0.0.1:8777/gallery  screenshot gallery + duplicate manager

 The analyzer writes macro_logs/analysis_progress.json as it goes; this server
 just serves that file (plus the finished report) over HTTP. The gallery scans a
 chosen screenshot root, groups images by SHA-256, flags exact duplicates, and
 deletes the ones you select (server-side, restricted to macro_logs). No
 third-party dependencies.

 The dashboard can also LAUNCH a fresh analysis (POST /api/run) or the
 self-improvement loop (POST /api/run-loop) as subprocesses, so you don't have
 to run them from a terminal.

Architecture: this file is the thin HTTP layer. Pure HTML rendering lives in
``ux_server_render.py``, data/IO/issue/gallery helpers in ``ux_server_lib.py``,
and the stateful run/loop control in ``ux_server_core.py`` (the
``LiveProgressCore`` class). Splitting them out keeps the pieces independently
importable and unit-testable without starting the server.

Flags:
    --port N          listen port (default 8777)
    --host H          bind host (default 127.0.0.1)
    --shots-root DIR  where to look for analysis_progress.json / screenshots
"""

import argparse
import atexit
import io
import json
import os
import sys
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

from ux_server_render import (
    _render_report_html,
    _inject_report_enhancements,
    _render_vision_preview,
    _render_analysis_preview,
    _render_shared_nav,
    _render_breadcrumb,
    _inject_shared_nav,
    _render_reports_list_page,
)
from ux_server_lib import (
    CTYPE,
    _HAVE_PIL,
    _read_json,
    _latest_report,
    _latest_gui_exe,
    _launch_gui,
    _read_tracker,
    _write_tracker,
    _norm_status,
    _build_issues_payload,
    _safe_path,
    _read_log_bytes,
    _discover_roots,
    _scan_gallery,
    _delete_one,
    _analysis_sets,
    _get_store,
)
from ux_server_core import (
    _run_analysis,
    _run_status,
    _stop_analysis,
    _run_improvement_loop,
    _loop_status,
    _stop_improvement_loop,
    _read_loop_state_file,
    loop_config,
    shutdown_children,
)

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
DEFAULT_SHOTS_ROOT = Path("macro_logs")
HTML_PATH = HERE / "live_progress.html"
GALLERY_HTML_PATH = HERE / "screenshot_gallery.html"
THEME_CSS_PATH = HERE / "theme.css"
NAV_CSS_PATH = HERE / "nav.css"
DASHBOARD_CSS_PATH = HERE / "dashboard.css"
DASHBOARD_JS_PATH = HERE / "dashboard.js"
AGENT_JS_PATH = HERE / "agent.js"
MAX_POST_BYTES = 1 * 1024 * 1024

# Parity: when a run produced JSON without a companion .html, render it with the
# same engine the analyzer uses (deduped grouping, embedded screenshots, quality
# cards, health badges, filter/search/sort toolbar). Falls back to the inline
# renderer in ux_server_render if the analyzer module cannot be imported here.
try:
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    from analyze_ux_screenshots import _render_full_report  # noqa: E402
    _HAVE_FULL_RENDER = True
except Exception:  # pragma: no cover - analyzer deps unavailable
    _HAVE_FULL_RENDER = False

try:
    from PIL import Image
except Exception:  # pragma: no cover - PIL optional for thumbnails
    Image = None


def _agent_ctx(root_base: Path) -> dict:
    """Build the context dict the agent tools expect (root_base + repo_root)."""
    return {
        "root_base": root_base,
        "repo_root": REPO_ROOT,
        "vision_model": os.getenv("VISION_MODEL") or None,
    }


def _coerce_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def build_handler(root_base: Path):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code: int, body: bytes, ctype: str = "application/json") -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if not getattr(self, "_head_mode", False):
                self.wfile.write(body)

        def do_HEAD(self) -> None:  # noqa: N802
            # RFC 7231: HEAD MUST return the same headers as GET but no body.
            # Route through the GET handler so Content-Type/Content-Length match
            # the real response, then suppress the body via the _head_mode flag.
            self._head_mode = True
            try:
                self.do_GET()
            finally:
                self._head_mode = False

        def _json(self, payload: dict, code: int = 200) -> None:
            self._send(
                code,
                json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"),
                "application/json; charset=utf-8",
            )

        def _send_img(self, raw: str, thumb: bool) -> None:
            p = _safe_path(root_base, raw)
            if p is None or not p.is_file():
                self._send(404, b"not found", "text/plain")
                return
            ext = p.suffix.lower()
            ctype = CTYPE.get(ext, "application/octet-stream")
            try:
                data = p.read_bytes()
            except OSError:
                self._send(404, b"not found", "text/plain")
                return
            if thumb and _HAVE_PIL and Image is not None:
                try:
                    im = Image.open(io.BytesIO(data))
                    im.thumbnail((480, 480))
                    buf = io.BytesIO()
                    im.save(buf, format="PNG")
                    data, ctype = buf.getvalue(), "image/png"
                except Exception:
                    pass
            self._send(200, data, ctype)

        def do_GET(self):  # noqa: N802
            try:
                return self._do_get()
            except BaseException as _e:
                import traceback as _tb
                try:
                    with open(HERE / "server_error.log", "a", encoding="utf-8") as _f:
                        _f.write("=== do_GET %s (%s) ===\n" % (type(_e).__name__, self.path))
                        _tb.print_exc(file=_f)
                except Exception:
                    pass
                try:
                    self.send_error(500, "Internal Server Error")
                except Exception:
                    pass

        def _do_get(self):  # noqa: N802
            route = self.path.split("?", 1)[0]
            if route == "/favicon.ico":
                # Avoid a noisy 404 in browsers; this utility intentionally
                # has no bundled icon.
                self._send(204, b"", "image/x-icon")
                return
            if route in ("/", "/index.html"):
                if not HTML_PATH.exists():
                    self._send(404, b"live_progress.html not found", "text/plain")
                    return
                self._send(200, HTML_PATH.read_bytes(), "text/html; charset=utf-8")
                return
            if route == "/gallery":
                if not GALLERY_HTML_PATH.exists():
                    self._send(404, b"screenshot_gallery.html not found", "text/plain")
                    return
                wrapped = _inject_shared_nav(
                    GALLERY_HTML_PATH.read_bytes(), "gallery",
                    crumbs=[("/", "Dashboard"), (None, "Screenshot Gallery")],
                    push_toolbar=True,
                )
                self._send(200, wrapped.encode("utf-8"), "text/html; charset=utf-8")
                return
            if route == "/theme.css":
                if not THEME_CSS_PATH.exists():
                    self._send(404, b"theme.css not found", "text/plain")
                    return
                self._send(200, THEME_CSS_PATH.read_bytes(), "text/css; charset=utf-8")
                return
            if route == "/nav.css":
                if not NAV_CSS_PATH.exists():
                    self._send(404, b"nav.css not found", "text/plain")
                    return
                self._send(200, NAV_CSS_PATH.read_bytes(), "text/css; charset=utf-8")
                return
            if route == "/dashboard.css":
                if not DASHBOARD_CSS_PATH.exists():
                    self._send(404, b"dashboard.css not found", "text/plain")
                    return
                self._send(200, DASHBOARD_CSS_PATH.read_bytes(), "text/css; charset=utf-8")
                return
            if route == "/dashboard.js":
                if not DASHBOARD_JS_PATH.exists():
                    self._send(404, b"dashboard.js not found", "text/plain")
                    return
                self._send(200, DASHBOARD_JS_PATH.read_bytes(), "application/javascript; charset=utf-8")
                return
            if route == "/agent.js":
                if not AGENT_JS_PATH.exists():
                    self._send(404, b"agent.js not found", "text/plain")
                    return
                self._send(200, AGENT_JS_PATH.read_bytes(), "application/javascript; charset=utf-8")
                return
            if route == "/api/progress":
                progress = _read_json(root_base / "analysis_progress.json")
                if progress is None:
                    self._json({"status": "idle", "message": "No analysis running", "shots": {}})
                else:
                    self._json(progress)
                return
            if route == "/api/run-status":
                self._json(_run_status(root_base))
                return
            if route == "/api/stop":
                self._json({"status": "use POST to stop an analysis"}, code=405)
                return
            if route == "/api/analysis-sets":
                self._json(_analysis_sets(root_base))
                return
            if route == "/api/loop-status":
                st = _loop_status(root_base)
                st["state"] = _read_loop_state_file(root_base)
                cfg = loop_config(root_base)
                if cfg is not None:
                    st["config"] = cfg
                self._json(st)
                return
            if route == "/api/gui":
                exe = _latest_gui_exe()
                self._json({
                    "available": bool(exe and exe.is_file()),
                    "path": str(exe) if exe else None,
                    "mtime": exe.stat().st_mtime if exe and exe.is_file() else None,
                })
                return
            if route == "/api/issues":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                status = (q.get("status") or [None])[0]
                category = (q.get("category") or [None])[0]
                search = (q.get("q") or [None])[0]
                severity = (q.get("severity") or [None])[0]
                scope = (q.get("scope") or [None])[0]
                try:
                    limit = int((q.get("limit") or ["300"])[0])
                except ValueError:
                    limit = 300
                self._json(_build_issues_payload(
                    status=status, category=category, q=search,
                    severity=severity, scope=scope, limit=limit))
                return
            if route == "/api/run-log":
                log = root_base / "analyze_run.log"
                if not log.exists():
                    self._send(404, b"No run log yet", "text/plain")
                    return
                self._send(200, _read_log_bytes(log), "text/plain; charset=utf-8")
                return
            if route == "/api/loop-log":
                log = root_base / "loop_run.log"
                if not log.exists():
                    self._send(404, b"No loop log yet", "text/plain")
                    return
                self._send(200, _read_log_bytes(log), "text/plain; charset=utf-8")
                return
            if route == "/api/shot":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                key = (q.get("key") or [""])[0]
                if key:
                    # Shot keys are basenames; strip any directory components so a
                    # crafted "key" can't escape root_base via rglob("../../..").
                    safe_key = Path(key).name
                    if safe_key:
                        matches = sorted(root_base.rglob(safe_key + ".png"), key=lambda p: p.stat().st_mtime, reverse=True)
                        if matches:
                            self._send_img(str(matches[0]), thumb=False)
                            return
                self._send(404, b"not found", "text/plain")
                return
            if route == "/api/shot-preview":
                # Friendly, rendered view of one shot's live vision_preview JSON.
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                key = (q.get("key") or [""])[0]
                progress = _read_json(root_base / "analysis_progress.json") or {}
                shots = progress.get("shots") or {}
                shot = shots.get(key) or {}
                raw = shot.get("vision_preview") or ""
                self._send(200, _render_vision_preview(raw, key).encode("utf-8"),
                           "text/html; charset=utf-8")
                return
            if route == "/api/shot-previews":
                # Batch-friendly render of every shot's vision + analysis previews,
                # so the dashboard's screenshot list can show cards without one
                # fetch per shot. Returns {key: {vision_html, analysis_html, status}}.
                progress = _read_json(root_base / "analysis_progress.json") or {}
                shots = progress.get("shots") or {}
                out = {}
                for key, shot in shots.items():
                    if not isinstance(shot, dict):
                        continue
                    vp = shot.get("vision_preview") or ""
                    ap = shot.get("analysis_preview") or ""
                    out[key] = {
                        "vision_html": _render_vision_preview(vp, key) if vp else "",
                        "analysis_html": _render_analysis_preview(ap) if ap else "",
                        "status": shot.get("status", ""),
                    }
                self._json(out)
                return
            if route == "/api/reports":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                try:
                    limit = int((q.get("limit") or ["50"])[0])
                except ValueError:
                    limit = 50
                model = (q.get("model") or [None])[0]
                set_name = (q.get("set") or [None])[0]
                search_q = (q.get("q") or [None])[0]
                store = _get_store(root_base)
                if store is None:
                    self._json({"status": "error", "message": "reports database unavailable"}, code=503)
                    return
                rows = (
                    store.search(search_q, limit=limit)
                    if search_q
                    else store.list_reports(limit=limit, model=model, screenshot_set=set_name)
                )
                self._json({"status": "ok", "count": len(rows), "reports": rows})
                return
            if route == "/api/report":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                report_key = (q.get("id") or [None])[0]
                store = _get_store(root_base)
                if store is not None:
                    rep = store.get(report_key) if report_key else store.get_latest()
                    if rep is not None:
                        payload = rep.get("report") or {}
                        payload["_meta"] = {
                            k: rep.get(k)
                            for k in (
                                "id", "report_key", "screenshot_set", "model", "status",
                                "timestamp", "num_issues", "num_recommendations",
                                "severity_counts", "created_at",
                            )
                        }
                        self._json(payload)
                        return
                report = _latest_report(root_base)
                if report is None:
                    self._json({"status": "idle", "message": "No report yet"})
                else:
                    self._json(report)
                return
            if route == "/reports":
                store = _get_store(root_base)
                rows = store.list_reports(limit=200) if store else []
                wrapped = _inject_shared_nav(
                    _render_reports_list_page(rows), "reports",
                    crumbs=[("/", "Dashboard"), (None, "Reports")],
                )
                self._send(200, wrapped.encode("utf-8"), "text/html; charset=utf-8")
                return
            if route == "/report":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                report_key = (q.get("id") or [None])[0]
                store = _get_store(root_base)
                final_html = None
                if store is not None:
                    rep = store.get(report_key) if report_key else store.get_latest()
                    if rep is not None:
                        if rep.get("html"):
                            final_html = _inject_report_enhancements(rep["html"])
                        else:
                            report = rep.get("report") or {}
                            final_html = _inject_report_enhancements(
                                _render_full_report(report) if _HAVE_FULL_RENDER
                                else _render_report_html(report, rep.get("report_key", "report"))
                            )
                if final_html is None:
                    candidates = sorted(
                        root_base.glob("ux_analysis_*.html"),
                        key=lambda p: p.stat().st_mtime, reverse=True,
                    )
                    if candidates:
                        final_html = _inject_report_enhancements(candidates[0].read_bytes())
                if final_html is None:
                    # Older/partial runs may have written JSON without an HTML
                    # companion. Keep the report link useful by rendering a safe
                    # readable fallback instead of returning a confusing 404.
                    json_reports = sorted(
                        root_base.glob("ux_analysis_*.json"),
                        key=lambda p: p.stat().st_mtime, reverse=True,
                    )
                    if json_reports:
                        report = _read_json(json_reports[0]) or {}
                        final_html = _inject_report_enhancements(
                            _render_full_report(report) if _HAVE_FULL_RENDER
                            else _render_report_html(report, json_reports[0].name)
                        )
                if final_html is None:
                    self._send(404, b"No analysis report generated yet", "text/plain")
                    return
                wrapped = _inject_shared_nav(
                    final_html, "report",
                    crumbs=[("/", "Dashboard"), (None, "Report")],
                    push_toolbar=True,
                )
                self._send(200, wrapped.encode("utf-8"), "text/html; charset=utf-8")
                return
            if route == "/api/roots":
                self._json({"roots": _discover_roots(root_base)})
                return
            if route == "/api/agent/tools":
                # Lazy import: the agent module pulls in Ollama + sibling helpers;
                # if Ollama is unavailable the dashboard still boots and this just
                # reports an empty catalog rather than crashing the server.
                try:
                    from ux_server_agent import list_tool_schemas
                    self._json({"tools": list_tool_schemas()})
                except Exception as _e:  # pragma: no cover
                    self._json({"tools": [], "error": str(_e)})
                return
            if route == "/api/agent/trace":
                # Live, pollable execution trace for a run (defaults to the most
                # recent run). Drives the dashboard's "Agent Execution Trace" panel.
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                rid = (q.get("run") or [None])[0]
                try:
                    from ux_server_agent import get_agent_trace
                    self._json(get_agent_trace(rid))
                except Exception as _e:  # pragma: no cover
                    self._json({"found": False, "running": False, "events": [],
                                "error": str(_e)})
                return
            if route == "/api/model_status":
                # Live Ollama load state: which models are resident in VRAM right
                # now. Lazy import so the dashboard still boots if Ollama is away.
                try:
                    from ux_server_agent import model_status
                    self._json(model_status())
                except Exception as _e:  # pragma: no cover
                    self._json({"ok": False, "error": str(_e), "running": []}, code=500)
                return
            if route == "/api/agent/models":
                try:
                    from ux_server_agent import (
                        list_ollama_models,
                        select_chat_model,
                        select_vision_model,
                    )
                    self._json({
                        "models": list_ollama_models(),
                        "chat_default": select_chat_model(),
                        "vision_default": select_vision_model(),
                    })
                except Exception as _e:  # pragma: no cover
                    self._json({"models": [], "error": str(_e)})
                return
            if route == "/api/gallery":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                root_rel = (q.get("root") or ["__all__"])[0]
                result = _scan_gallery(root_base, root_rel)
                if result is None:
                    self._json({"status": "error", "message": "invalid root"}, code=400)
                else:
                    self._json(result)
                return
            if route == "/api/img":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                raw = (q.get("path") or [""])[0]
                thumb = (q.get("thumb") or ["0"])[0] == "1"
                self._send_img(raw, thumb=thumb)
                return
            self._send(404, b"not found", "text/plain")

        def do_POST(self):  # noqa: N802
            try:
                return self._do_post()
            except BaseException as _e:
                import traceback as _tb
                try:
                    with open(HERE / "server_error.log", "a", encoding="utf-8") as _f:
                        _f.write("=== do_POST %s (%s) ===\n" % (type(_e).__name__, self.path))
                        _tb.print_exc(file=_f)
                except Exception:
                    pass
                try:
                    self.send_error(500, "Internal Server Error")
                except Exception:
                    pass

        def _do_post(self):  # noqa: N802
            route = self.path.split("?", 1)[0]
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if length > MAX_POST_BYTES:
                self._json({"status": "error", "message": "request body too large"}, code=413)
                return
            raw_body = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._json({"status": "error", "message": "invalid JSON"}, code=400)
                return
            if not isinstance(body, dict):
                self._json({"status": "error", "message": "JSON object required"}, code=400)
                return
            if route == "/api/delete":
                res = _delete_one(root_base, body.get("path", ""))
                self._json(res, code=200 if res.get("ok") else 400)
                return
            if route == "/api/run":
                res = _run_analysis(
                    root_base,
                    model=(body.get("model") or "").strip() or None,
                    set_name=(body.get("set") or "").strip() or None,
                )
                code = 200 if (res.get("ok") or res.get("status") == "already_running") else 400
                self._json(res, code=code)
                return
            if route == "/api/run-loop":
                mi = body.get("max_iterations")
                if mi is not None:
                    try:
                        mi = int(mi)
                    except (TypeError, ValueError):
                        mi = None
                dr = body.get("dry_run")
                if isinstance(dr, str):
                    dr = dr.strip().lower() in ("1", "true", "yes", "on")
                else:
                    dr = bool(dr)
                res = _run_improvement_loop(
                    root_base,
                    model=(body.get("model") or "").strip() or None,
                    max_iterations=mi,
                    category=(body.get("category") or "").strip() or None,
                    dry_run=dr,
                )
                code = 200 if (res.get("ok") or res.get("status") == "already_running") else 400
                self._json(res, code=code)
                return
            if route == "/api/issues/update":
                issue_id = (body.get("issue_id") or "").strip()
                new_status = (body.get("status") or "").strip()
                resolution = (body.get("resolution") or "").strip()
                if not issue_id:
                    self._json({"status": "error", "message": "issue_id required"}, code=400)
                    return
                data = _read_tracker()
                found = None
                for it in data.get("issues", []):
                    if it.get("issue_id") == issue_id:
                        found = it
                        break
                if found is None:
                    self._json({"status": "error", "message": "issue not found"}, code=404)
                    return
                if new_status:
                    found["status"] = _norm_status(new_status)
                found["last_seen"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                if resolution:
                    extra = found.get("extra")
                    if not isinstance(extra, dict):
                        extra = {}
                        found["extra"] = extra
                    extra["resolution"] = resolution
                _write_tracker(data)
                self._json({"status": "ok", "issue": found})
                return
            if route == "/api/launch-gui":
                res = _launch_gui()
                self._json(res, code=200 if res.get("ok") else 409)
                return
            if route == "/api/stop":
                res = _stop_analysis(root_base)
                self._json(res, code=200 if res.get("ok") else 409)
                return
            if route == "/api/stop-loop":
                res = _stop_improvement_loop(root_base)
                self._json(res, code=200 if res.get("ok") else 409)
                return
            if route == "/api/agent/tool":
                # Single tool call (for the explorer / manual mode). Edits require
                # auto_apply (the UI "Allow code edits" toggle).
                from ux_server_agent import run_tool
                name = (body.get("tool") or "").strip()
                if not name:
                    self._json({"ok": False, "error": "tool name required"}, code=400)
                    return
                res = run_tool(
                    name, body.get("args"),
                    _agent_ctx(root_base),
                    auto_apply=_coerce_bool(body.get("auto_apply")),
                )
                self._json(res)
                return
            if route == "/api/agent/run":
                # Full tool-calling agent loop against Ollama, run in a background
                # thread so the dashboard can stream the live execution trace via
                # /api/agent/trace (it returns a run_id immediately).
                from ux_server_agent import run_agent
                msg = (body.get("message") or "").strip()
                if not msg:
                    self._json({"status": "error", "message": "message required"}, code=400)
                    return
                model = (body.get("model") or "").strip()
                mi = body.get("max_iterations")
                if mi is not None:
                    try:
                        mi = int(mi)
                    except (TypeError, ValueError):
                        mi = None
                run_id = "run_" + uuid.uuid4().hex[:12]
                auto = _coerce_bool(body.get("auto_apply"))

                def _agent_worker() -> None:  # background, never blocks the request
                    try:
                        run_agent(
                            msg, model, _agent_ctx(root_base),
                            max_iterations=mi or 6, auto_apply=auto, run_id=run_id,
                        )
                    except Exception:  # traced + persisted inside run_agent
                        pass

                threading.Thread(target=_agent_worker, daemon=True).start()
                self._json({"run_id": run_id, "accepted": True})
                return
            if route == "/api/agent/stop-run":
                # Human-in-the-loop cancel: sets the stop flag so the run halts
                # after the current model/tool step.
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                rid = (q.get("run") or [None])[0]
                try:
                    from ux_server_agent import request_stop_agent
                    self._json({"ok": request_stop_agent(rid)})
                except Exception as _e:  # pragma: no cover
                    self._json({"ok": False, "error": str(_e)})
                return
            if route == "/api/delete-many":
                paths = body.get("paths", []) or []
                if not isinstance(paths, list):
                    self._json({"status": "error", "message": "paths must be an array"}, code=400)
                    return
                results = [_delete_one(root_base, p) for p in paths]
                freed = sum(r.get("freed", 0) for r in results if r.get("ok"))
                self._json({"ok": True, "results": results, "freed": freed, "deleted": sum(1 for r in results if r.get("ok"))})
                return
            self._json({"status": "error", "message": "unknown endpoint"}, code=404)

        def log_message(self, *args):  # silence default stderr logging
            return

        def handle_error(self, e):  # don't silently reset the connection on a handler bug
            import traceback as _tb
            try:
                with open(HERE / "server_error.log", "a", encoding="utf-8") as _f:
                    _f.write("=== %s ===\n" % type(e).__name__)
                    _tb.print_exc(file=_f)
            except Exception:
                pass
            try:
                self.send_error(500, "Internal Server Error")
            except Exception:
                pass

    return Handler


def main() -> int:
    parser = argparse.ArgumentParser(description="Live UX analysis progress + screenshot gallery server")
    parser.add_argument("--port", type=int, default=8777)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--shots-root", default=str(DEFAULT_SHOTS_ROOT))
    args = parser.parse_args()

    root_base = Path(args.shots_root).resolve()
    root_base.mkdir(parents=True, exist_ok=True)
    Handler = build_handler(root_base)
    atexit.register(shutdown_children)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}/"
    print(f"Live progress dashboard: {url}")
    print(f"Screenshot gallery:      {url}gallery")
    print(f"  watching: {root_base / 'analysis_progress.json'}")
    print("  Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
