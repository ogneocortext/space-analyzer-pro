"""Tiny localhost HTTP dashboard for the UX pipeline.

Uses only the standard library (``http.server`` + ``json``) so we don't pull
in a web framework as a dependency. The server is bound to ``127.0.0.1`` by
default and is intended for local development use only — it is not
hardenend for production.

Routes:

* ``GET /``            — Dashboard HTML
* ``GET /api/issues``  — JSON list of tracker rows
* ``GET /api/issues/stats`` — JSON aggregate counts by status/severity/category
* ``GET /api/quality`` — JSON quality-history summary
* ``GET /api/links``   — JSON screenshot links
* ``GET /api/loop/state`` — JSON self-improvement loop state
* ``GET /api/loop/history`` — JSON loop iteration history
* ``GET /api/search``  — Query issues (q, status, category, severity, limit)
* ``GET /api/categories`` — JSON category list with counts
* ``GET /api/ollama/models`` — List available Ollama models
* ``POST /api/issues/<id>/done`` — mark an issue done
* ``POST /api/issues/<id>/wontfix`` — mark an issue wontfix
* ``POST /api/issues/<id>/open`` — reopen an issue
* ``POST /api/issues/<id>/in_progress`` — set issue in progress
* ``POST /api/issues/<id>/resolve`` — send issue to Ollama for AI resolution
* ``POST /api/issues/create`` — create a new issue
* ``POST /api/test/run`` — run a code testing tool (test, clippy, fmt, verify)
* ``POST /api/rust/run`` — run the Space Analyzer CLI or launch the GUI
* ``POST /api/loop/reset`` — reset loop state for a fresh run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import secrets
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, unquote, urlparse

from ._issue_tracker import IssueRow, IssueStatus, IssueTracker, make_issue_id
from ._ollama_client import OllamaClient, OllamaError
from ._pipeline_config import PipelineConfig, load_config
from ._quality_history import QualityHistory
from ._screenshot_links import ScreenshotLinkStore
from ._sqlite_store import SqliteIssueStore

logger = logging.getLogger("ux_pipeline.dashboard")


INDEX_HTML: str = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Issue Tracker Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
:root { --bg: #0f1117; --panel: #1a1d27; --panel-2: #21242f; --panel-3: #282c38; --accent: #f0c674; --text: #e8e8ed; --muted: #7a7d8a; --ok: #4ade80; --warn: #fbbf24; --danger: #f87171; --info: #60a5fa; --border: #2a2d3a; --radius: 10px; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; overflow-x: hidden; }

/* === TOP BAR === */
.topbar { background: var(--panel); border-bottom: 1px solid var(--border); padding: 0.6rem 1.25rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; position: sticky; top: 0; z-index: 50; }
.topbar h1 { font-size: 1.1rem; margin: 0; color: var(--accent); white-space: nowrap; }
.metrics { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.metric { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 0.3rem 0.6rem; font-size: 0.78rem; white-space: nowrap; }
.metric b { font-size: 1rem; margin-right: 0.15rem; }
.metric.ok b { color: var(--ok); } .metric.warn b { color: var(--warn); } .metric.danger b { color: var(--danger); } .metric.info b { color: var(--info); }

/* === PROGRESS BAR === */
.progress-wrap { flex: 1; min-width: 120px; max-width: 250px; }
.progress-bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--ok), #22d3ee); border-radius: 4px; transition: width 0.4s ease; }
.progress-label { font-size: 0.7rem; color: var(--muted); margin-top: 2px; text-align: center; }

/* === MODEL SELECTOR === */
.model-select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.25rem 0.4rem; font-size: 0.78rem; max-width: 160px; height: 28px; }

/* === MAIN LAYOUT === */
.main { display: grid; grid-template-columns: 300px 1fr; gap: 0.75rem; padding: 0.75rem 1rem; min-height: calc(100vh - 52px); }
@media (max-width: 1100px) { .main { grid-template-columns: 1fr; } }

/* === PANELS === */
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem; }
.panel h2 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 0.5rem; display: flex; align-items: center; gap: 0.4rem; }
.panel h2 .count { background: var(--panel-2); border: 1px solid var(--border); border-radius: 999px; padding: 0.1rem 0.45rem; font-size: 0.7rem; }

/* === SIDEBAR === */
.sidebar { display: flex; flex-direction: column; gap: 0.75rem; }

/* === FILTERS === */
.filters { display: flex; flex-direction: column; gap: 0.4rem; }
.filters label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.filters input, .filters select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.5rem; font-size: 0.82rem; width: 100%; }
.filters select { height: 32px; }
.btn { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.65rem; cursor: pointer; font-size: 0.82rem; transition: all 0.15s; }
.btn:hover { border-color: var(--accent); background: var(--panel-3); }
.btn-primary { background: var(--accent); color: #0f1117; border-color: var(--accent); font-weight: 600; }
.btn-primary:hover { background: #e6b85a; }
.btn-sm { padding: 0.2rem 0.45rem; font-size: 0.75rem; }
.btn-ok { color: var(--ok); } .btn-warn { color: var(--warn); } .btn-danger { color: var(--danger); } .btn-info { color: var(--info); } .btn-accent { color: var(--accent); }
.btn-group { display: flex; gap: 0.3rem; flex-wrap: wrap; }

/* === CATEGORY LIST === */
.cat-list { max-height: 320px; overflow-y: auto; }
.cat-item { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--border); font-size: 0.78rem; cursor: pointer; border-radius: 4px; transition: background 0.1s; }
.cat-item:hover { background: rgba(99,102,241,0.06); }
.cat-item.active { background: rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.25); }
.cat-item:last-child { border-bottom: none; }
.cat-item .cat-head { display: flex; justify-content: space-between; align-items: center; }
.cat-item .cat-name { font-weight: 500; color: var(--text); }
.cat-item.active .cat-name { color: var(--accent); font-weight: 600; }
.cat-item .cat-counts { display: flex; gap: 0.3rem; align-items: center; font-size: 0.68rem; }
.cat-item .cat-total { color: var(--muted); }
.cat-item .cat-open { color: var(--warn); font-weight: 600; }
.cat-item .cat-done { color: var(--ok); }
.cat-item .cat-bar { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
.cat-item .cat-bar-fill { height: 100%; background: var(--ok); border-radius: 2px; transition: width 0.3s; }
.cat-item .cat-sevs { display: flex; gap: 0.2rem; margin-top: 0.1rem; }
.cat-item .cat-sev-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.cat-clear-btn { font-size: 0.65rem; padding: 0.1rem 0.4rem; background: rgba(99,102,241,0.15); color: var(--accent); border: 1px solid rgba(99,102,241,0.3); border-radius: 4px; cursor: pointer; margin-bottom: 0.3rem; }
.cat-clear-btn:hover { background: rgba(99,102,241,0.25); }

/* === CHARTS === */
.charts-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
@media (max-width: 1100px) { .charts-grid { grid-template-columns: 1fr; } }
.chart-box { position: relative; width: 100%; }
.chart-box.timeline { height: 180px; }
.chart-box.severity { height: 180px; }
.chart-box.category { height: 240px; }
@keyframes metric-pulse { 0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1)} }
.metric.pulse { animation: metric-pulse 0.4s ease; }

/* === ISSUE GRID === */
.issue-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 0.6rem; }
@media (max-width: 800px) { .issue-grid { grid-template-columns: 1fr; } }

/* === ISSUE CARD === */
.issue-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.4rem; transition: border-color 0.15s, box-shadow 0.15s; cursor: pointer; }
.issue-card:hover { border-color: var(--accent); }
.issue-card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(99,102,241,0.25); }
.bulk-bar { display: flex; gap: 0.3rem; align-items: center; padding: 0.35rem 0.5rem; background: var(--bg); border: 1px solid var(--accent); border-radius: 6px; margin-bottom: 0.5rem; font-size: 0.78rem; }
.bulk-bar span { color: var(--accent); font-weight: 600; margin-right: auto; }
.bulk-cb { position: absolute; top: 0.5rem; right: 0.5rem; z-index: 1; cursor: pointer; }
.bulk-cb input { accent-color: var(--accent); width: 14px; height: 14px; }
.issue-card { position: relative; }
.issue-head { display: flex; justify-content: space-between; gap: 0.5rem; align-items: flex-start; }
.issue-title { font-size: 0.9rem; font-weight: 600; line-height: 1.3; }
.issue-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.7rem; color: #a5b4fc; word-break: break-all; opacity: 0.7; }
.badge { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.12rem 0.4rem; border-radius: 6px; border: 1px solid var(--border); white-space: nowrap; font-weight: 600; }
.badge.status-open { color: var(--warn); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.08); }
.badge.status-in_progress { color: var(--info); border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.08); }
.badge.status-done { color: var(--ok); border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.08); }
.badge.status-wontfix { color: var(--muted); border-color: rgba(122,125,138,0.3); background: rgba(122,125,138,0.08); }
.badge.status-blocked { color: var(--warn); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.08); }
.badge.status-pending { color: var(--info); border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.08); }
.badge.sev-critical { color: var(--danger); border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.08); }
.badge.sev-high { color: var(--warn); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.08); }
.badge.sev-medium { color: #fcd34d; border-color: rgba(252,211,77,0.3); background: rgba(252,211,77,0.08); }
.badge.sev-low { color: var(--ok); border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.08); }
.meta-row { display: flex; gap: 0.4rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--muted); align-items: center; }
.meta-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 5px; padding: 0.1rem 0.35rem; }
.notes { font-size: 0.8rem; color: #a0a0b0; line-height: 1.4; max-height: 3em; overflow: hidden; }
.card-actions { display: flex; gap: 0.3rem; justify-content: flex-end; padding-top: 0.2rem; border-top: 1px solid var(--border); flex-wrap: wrap; }
.card-actions .btn { padding: 0.18rem 0.45rem; font-size: 0.72rem; }

/* === MODAL === */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
.modal { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; max-width: 750px; width: 100%; max-height: 85vh; overflow-y: auto; position: relative; }
.modal h2 { font-size: 1rem; margin: 0 0 0.75rem; color: var(--accent); }
.modal .close { position: absolute; top: 0.75rem; right: 1rem; background: none; border: none; color: var(--muted); font-size: 1.4rem; cursor: pointer; }
.modal .close:hover { color: var(--text); }
.modal dl { display: grid; grid-template-columns: auto 1fr; gap: 0.3rem 0.75rem; font-size: 0.85rem; }
.modal dt { color: var(--muted); font-weight: 600; text-align: right; }
.modal dd { margin: 0; }
.modal pre { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto; }
.modal .modal-actions { display: flex; gap: 0.4rem; justify-content: flex-end; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); flex-wrap: wrap; }
.modal .modal-actions .btn { padding: 0.3rem 0.7rem; font-size: 0.82rem; }

/* === AI RESPONSE PANEL === */
.ai-panel { display: none; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }
.ai-panel.visible { display: block; }
.ai-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.ai-header h3 { font-size: 0.85rem; color: var(--accent); margin: 0; }
.ai-spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; display: none; }
.ai-spinner.active { display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.ai-response { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; font-size: 0.82rem; line-height: 1.5; max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }
.ai-response.error { border-color: rgba(248,113,113,0.3); color: var(--danger); }

/* === ADD ISSUE FORM === */
.add-form { display: none; }
.add-form.visible { display: block; }
.add-form .form-row { margin-bottom: 0.5rem; }
.add-form .form-row label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.15rem; text-transform: uppercase; letter-spacing: 0.04em; }
.add-form .form-row input, .add-form .form-row select, .add-form .form-row textarea { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.5rem; font-size: 0.82rem; font-family: inherit; }
.add-form .form-row textarea { resize: vertical; min-height: 50px; }
.add-form .form-actions { display: flex; gap: 0.4rem; justify-content: flex-end; }

/* === LOOP SECTION === */
.loop-section { margin-bottom: 0; }
.loop-state { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
.pill { background: var(--panel-2); border: 1px solid var(--border); border-radius: 999px; padding: 0.15rem 0.5rem; font-size: 0.75rem; color: #c9c9d6; }
.pill.running { border-color: var(--ok); color: var(--ok); animation: pill-pulse 1.5s ease-in-out infinite; }
@keyframes pill-pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
.loop-progress-wrap { margin-bottom: 0.4rem; }
.loop-progress-bar { height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; border: 1px solid var(--border); }
.loop-progress-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s ease; width: 0%; }
.loop-progress-label { font-size: 0.7rem; color: var(--muted); margin-top: 0.15rem; text-align: right; }
.loop-current { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.5rem; margin-bottom: 0.4rem; font-size: 0.78rem; }
.loop-current .lc-label { color: var(--muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; }
.loop-current .lc-issue { color: var(--accent); font-weight: 600; margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.loop-current .lc-detail { color: #a0a0b0; margin-top: 0.1rem; font-size: 0.72rem; }
.loop-config { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem 0.5rem; margin-bottom: 0.4rem; padding: 0.4rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; }
.loop-cfg-row { display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; }
.loop-cfg-row label { color: var(--muted); font-size: 0.72rem; white-space: nowrap; }
.loop-cfg-row select, .loop-cfg-row input[type="number"] { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 0.15rem 0.3rem; font-size: 0.75rem; }
.loop-cfg-row input[type="checkbox"] { accent-color: var(--accent); }
.loop-controls { display: flex; gap: 0.3rem; margin-bottom: 0.3rem; }
.loop-history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
.history { max-height: 180px; overflow-y: auto; }
.history-item { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem; padding: 0.3rem 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.78rem; align-items: center; border-radius: 4px; cursor: pointer; transition: background 0.1s; }
.history-item:hover { background: rgba(99,102,241,0.06); }
.history-item:last-child { border-bottom: none; }
.h-status { font-weight: 600; }
.h-status.completed { color: var(--ok); } .h-status.partial { color: var(--warn); } .h-status.failed { color: var(--danger); }
.h-meta { color: var(--muted); font-size: 0.7rem; }
.h-detail { display: none; font-size: 0.72rem; color: #a0a0b0; grid-column: 1 / -1; padding: 0.25rem 0; white-space: pre-wrap; word-break: break-word; border-top: 1px solid var(--border); margin-top: 0.2rem; }
.history-item.expanded .h-detail { display: block; }

/* === TOAST === */
.toast { position: fixed; bottom: 1.5rem; right: 1.5rem; background: var(--panel-3); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.82rem; z-index: 9999; opacity: 0; transform: translateY(10px); transition: opacity 0.2s, transform 0.2s; pointer-events: none; }
.toast.visible { opacity: 1; transform: translateY(0); }
.toast-success { border-color: rgba(34,197,94,0.4); color: var(--ok); }
.toast-error { border-color: rgba(239,68,68,0.4); color: var(--danger); }

/* === TEST RUNNER === */
.test-runner { display: flex; flex-direction: column; gap: 0.4rem; }
.test-btns { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.test-output { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.72rem; line-height: 1.4; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; color: #a0a0b0; min-height: 40px; }
.test-output.success { color: var(--ok); }
.test-output.error { color: var(--danger); }

/* === RUST TOOLS === */
.rust-tools { display: flex; flex-direction: column; gap: 0.4rem; }
.rust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem 0.5rem; }
.rust-field { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.72rem; color: var(--muted); }
.rust-field input, .rust-field select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.45rem; font-size: 0.78rem; }
.rust-field input[type="checkbox"] { accent-color: var(--accent); }
.rust-checks { display: flex; gap: 0.5rem; align-items: center; color: var(--muted); font-size: 0.72rem; }

/* === SORT BAR === */
.sort-bar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
.sort-bar label { font-size: 0.75rem; color: var(--muted); }
.sort-bar select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.25rem 0.4rem; font-size: 0.8rem; }
.sort-bar .result-count { font-size: 0.78rem; color: var(--muted); margin-left: auto; }

/* === SCROLLBAR === */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3a3d4a; }

.empty { color: var(--muted); font-size: 0.82rem; font-style: italic; }
/* === PRIORITY PANEL === */
.priority-list { max-height: 280px; overflow-y: auto; }
.priority-item { display: grid; grid-template-columns: 28px 1fr auto; gap: 0.4rem; align-items: start; padding: 0.3rem 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.78rem; cursor: pointer; border-radius: 4px; transition: background 0.1s; }
.priority-item:hover { background: rgba(99,102,241,0.06); }
.priority-item.selected { background: rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.25); }
.priority-item:last-child { border-bottom: none; }
.priority-item .p-rank { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; color: var(--muted); font-size: 0.68rem; font-weight: 600; min-width: 20px; text-align: center; padding-top: 0.1rem; }
.priority-item .p-title { font-size: 0.75rem; color: var(--text); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.priority-item .p-meta { display: flex; gap: 0.3rem; align-items: center; margin-top: 0.15rem; flex-wrap: wrap; }
.priority-item .p-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; color: #a5b4fc; opacity: 0.7; font-size: 0.65rem; }
.priority-item .p-note { color: var(--muted); font-size: 0.68rem; font-style: italic; }
.priority-item .p-sev { font-size: 0.6rem; padding: 0.08rem 0.3rem; }
.priority-item .p-ai { display: flex; align-items: center; gap: 0.25rem; margin-top: 0.2rem; }
.priority-item .p-ai-status { font-size: 0.62rem; padding: 0.06rem 0.25rem; border-radius: 4px; }
.priority-item .p-ai-status.processing { color: var(--info); border: 1px solid rgba(96,165,250,0.3); background: rgba(96,165,250,0.08); }
.priority-item .p-ai-status.done { color: var(--ok); border: 1px solid rgba(74,222,128,0.3); background: rgba(74,222,128,0.08); }
.priority-item .p-ai-status.error { color: var(--danger); border: 1px solid rgba(248,113,113,0.3); background: rgba(248,113,113,0.08); }
.priority-item .p-fix-btn { font-size: 0.6rem; padding: 0.08rem 0.3rem; background: rgba(99,102,241,0.15); color: var(--accent); border: 1px solid rgba(99,102,241,0.3); border-radius: 4px; cursor: pointer; white-space: nowrap; }
.priority-item .p-fix-btn:hover { background: rgba(99,102,241,0.25); }
.priority-item .p-fix-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.priority-input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 0.15rem 0.3rem; font-size: 0.72rem; width: 48px; }
.priority-quick-btns { display: flex; gap: 0.2rem; }
.priority-quick-btns .btn { padding: 0.1rem 0.35rem; font-size: 0.65rem; min-width: 0; }
.priority-feedback { font-size: 0.68rem; color: var(--ok); opacity: 0; transition: opacity 0.3s; height: 0.9rem; }
.priority-feedback.show { opacity: 1; }

</style>
</head>
<body>
<div class="topbar">
  <h1>&#x1f4cb; Issue Tracker</h1>
  <div class="metrics" id="metrics"></div>
  <div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
    <div class="progress-label" id="progress-label">0% resolved</div>
  </div>
  <label style="font-size:0.7rem;color:#7a7d8a;margin-bottom:0.1rem;display:block;">AI Model (local Ollama)</label>
  <select class="model-select" id="model-select" title="Ollama model for AI resolution"><option value="">Loading models...</option></select>
  <button class="btn btn-primary" id="btn-add-toggle">+ New Issue</button>
</div>
<div class="main">
  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="panel">
      <h2>Filters</h2>
      <div class="filters">
        <input id="search-q" placeholder="Search issues..." />
        <label>Status</label>
        <select id="filter-status"><option value="">All</option><option value="open" selected>Open</option><option value="in_progress">In Progress</option><option value="done">Done</option><option value="wontfix">Wontfix</option></select>
        <label>Category</label>
        <select id="filter-category"><option value="">All categories</option></select>
        <label>Severity</label>
        <select id="filter-severity"><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <div class="btn-group">
          <button class="btn" id="btn-apply">Apply</button>
          <button class="btn" id="btn-clear">Clear</button>
          <button class="btn" id="btn-show-all">Show All</button>
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>Categories</h2>
      <div id="cat-list" class="cat-list"><span class="empty">Loading...</span></div>
    </div>
    <div class="panel">
      <h2>Priority Tracker <span class="count" id="priority-count">0</span></h2>
      <div class="priority-list" id="priority-list"><span class="empty">Loading...</span></div>
      <div id="priority-feedback" class="priority-feedback"></div>
      <div style="margin-top:0.3rem;display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
        <input id="priority-rank" class="priority-input" type="number" min="0" max="99" placeholder="Rank" />
        <div class="priority-quick-btns">
          <button class="btn btn-sm" id="btn-pri-up" title="Rank +1">&#9650;</button>
          <button class="btn btn-sm" id="btn-pri-down" title="Rank -1">&#9660;</button>
          <button class="btn btn-sm btn-warn" id="btn-pri-clear" title="Clear priority (set to 0)">&#10005;</button>
        </div>
        <input id="priority-note" style="flex:1;min-width:60px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.15rem 0.3rem;font-size:0.72rem;" placeholder="Note" />
        <button class="btn btn-sm btn-ok" id="btn-set-priority">Set</button>
      </div>
    </div>
    <div class="panel">
      <h2>Severity Breakdown</h2>
      <div id="sev-summary"></div>
    </div>
    <div class="panel">
      <h2>&#x2699;&#xfe0f; Test Runner</h2>
      <div class="test-runner">
        <div class="test-btns">
          <button class="btn btn-sm" data-test="test" title="Run cargo test">&#9654; Test</button>
          <button class="btn btn-sm btn-warn" data-test="clippy" title="Run cargo clippy">&#x26a0; Clippy</button>
          <button class="btn btn-sm btn-info" data-test="fmt" title="Run cargo fmt --check">&#x2702; Fmt</button>
          <button class="btn btn-sm btn-ok" data-test="fmt-fix" title="Run cargo fmt to auto-fix formatting">&#x2702; Fmt Fix</button>
          <button class="btn btn-sm btn-ok" data-test="verify" title="Run full verify (fmt+clippy+test)">&#x2714; Verify</button>
        </div>
        <div class="test-output" id="test-output">Click a button to run tests...</div>
      </div>
    </div>
    <div class="panel">
      <h2>&#x26a1; Rust Tools</h2>
      <div class="rust-tools">
        <div class="rust-grid">
          <label class="rust-field">Scan path
            <input id="rust-path" value="." title="Directory for the Space Analyzer CLI scan" />
          </label>
          <label class="rust-field">Output
            <select id="rust-format" title="CLI output format">
              <option value="text">text</option>
              <option value="json">json</option>
              <option value="csv">csv</option>
            </select>
          </label>
        </div>
        <label class="rust-field">Top items
          <input id="rust-top" type="number" min="1" max="200" value="20" title="Number of top files/directories to show" />
        </label>
        <div class="rust-checks">
          <label><input id="rust-deep" type="checkbox" /> Deep scan</label>
          <label><input id="rust-report" type="checkbox" /> Markdown report</label>
        </div>
        <div class="test-btns">
          <button class="btn btn-sm btn-primary" data-rust="cli" title="Run cargo run --bin space-analyzer-pro">&#9654; Run CLI</button>
          <button class="btn btn-sm btn-ok" data-rust="gui" title="Launch cargo run --bin space-analyzer-gui">&#x2197; Launch GUI</button>
        </div>
        <div class="test-output" id="rust-output">Run the CLI scan or launch the GUI from this tracker page...</div>
      </div>
    </div>
    <div class="panel loop-section">
      <h2>Improvement Loop</h2>
      <div id="loop-status" class="loop-state"><span class="empty">Loading...</span></div>
      <div id="loop-progress-wrap" class="loop-progress-wrap" style="display:none;">
        <div class="loop-progress-bar"><div class="loop-progress-fill" id="loop-progress-fill"></div></div>
        <div class="loop-progress-label" id="loop-progress-label"></div>
      </div>
      <div id="loop-current" class="loop-current" style="display:none;"></div>
      <div id="loop-config" class="loop-config">
        <div class="loop-cfg-row">
          <label>Model</label>
          <select id="loop-model"><option value="qwen3:8b">qwen3:8b</option><option value="qwen3:4b">qwen3:4b</option><option value="qwen3:1.7b">qwen3:1.7b</option><option value="llama3.2:3b">llama3.2:3b</option><option value="codellama:7b">codellama:7b</option></select>
        </div>
        <div class="loop-cfg-row">
          <label>Max Iters</label>
          <input type="number" id="loop-max-iters" min="1" max="200" value="10" style="width:50px;" />
        </div>
        <div class="loop-cfg-row">
          <label>Per Iter</label>
          <input type="number" id="loop-per-iter" min="1" max="20" value="2" style="width:50px;" />
        </div>
        <div class="loop-cfg-row">
          <label>Category</label>
          <select id="loop-category"><option value="">All</option></select>
        </div>
        <div class="loop-cfg-row">
          <label><input type="checkbox" id="loop-auto-verify" checked /> Auto-verify</label>
          <label><input type="checkbox" id="loop-dry-run" /> Dry run</label>
        </div>
      </div>
      <div class="loop-controls">
        <button class="btn btn-sm btn-primary" id="btn-start-loop" title="Start the improvement loop">&#9654; Start</button>
        <button class="btn btn-sm btn-danger" id="btn-stop-loop" title="Stop the running loop" style="display:none;">&#9632; Stop</button>
        <button class="btn btn-sm" id="btn-reset-loop" title="Reset loop state">&#x21bb; Reset</button>
      </div>
      <div id="ollama-status" style="margin-top:0.3rem;font-size:0.72rem;"></div>
      <div class="loop-history-header">
        <span>History</span>
        <button class="btn btn-sm" id="btn-clear-loop-history" title="Clear history">Clear</button>
      </div>
      <div id="loop-history" class="history"></div>
    </div>
  </div>

  <!-- MAIN CONTENT -->
  <div style="display:flex;flex-direction:column;gap:0.75rem;">
    <!-- ADD ISSUE FORM -->
    <div class="panel add-form" id="add-form">
      <h2>Create New Issue</h2>
      <div class="form-row"><label>Title</label><input id="new-title" placeholder="Brief description of the issue" /></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
        <div class="form-row"><label>Category</label><select id="new-category"><option value="functionality">functionality</option><option value="code-quality">code-quality</option><option value="frontend">frontend</option><option value="backend">backend</option><option value="security">security</option><option value="performance">performance</option><option value="reliability">reliability</option><option value="configuration">configuration</option><option value="feature-gap">feature-gap</option><option value="bug">bug</option><option value="documentation">documentation</option><option value="testing">testing</option><option value="devops">devops</option><option value="architecture">architecture</option><option value="user-experience">user-experience</option><option value="error-handling">error-handling</option><option value="database">database</option><option value="integration">integration</option><option value="compatibility">compatibility</option><option value="dependencies">dependencies</option><option value="logging">logging</option><option value="memory-management">memory-management</option><option value="stability">stability</option><option value="api">api</option><option value="build-&-deployment">build-&-deployment</option><option value="build-process">build-process</option><option value="ux">ux</option></select></div>
        <div class="form-row"><label>Severity</label><select id="new-severity"><option value="medium">Medium</option><option value="critical">Critical</option><option value="high">High</option><option value="low">Low</option></select></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="new-notes" placeholder="Details, reproduction steps, etc."></textarea></div>
      <div class="form-actions">
        <button class="btn" id="btn-add-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-add-submit">Create Issue</button>
      </div>
    </div>

    <!-- CHARTS -->
    <div class="panel">
      <h2>Analytics</h2>
      <div class="charts-grid">
        <div class="chart-box timeline"><canvas id="chart-timeline"></canvas></div>
        <div class="chart-box severity"><canvas id="chart-severity"></canvas></div>
        <div class="chart-box category"><canvas id="chart-category"></canvas></div>
      </div>
    </div>

    <!-- ISSUES -->
    <div class="panel">
      <h2>Issues <span class="count" id="issue-count">0</span></h2>
      <div class="sort-bar">
        <label>Sort:</label>
        <select id="sort-field">
          <option value="last_seen">Last Seen</option>
          <option value="first_seen">First Seen</option>
          <option value="severity">Severity</option>
          <option value="title">Title</option>
          <option value="category">Category</option>
          <option value="occurrences">Occurrences</option>
        </select>
        <select id="sort-dir">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <span class="result-count" id="result-count"></span>
      </div>
      <div id="bulk-bar" class="bulk-bar" style="display:none;">
        <span id="bulk-count">0 selected</span>
        <button class="btn btn-sm btn-ok" id="bulk-done" title="Mark selected as done">&#x2714; Done</button>
        <button class="btn btn-sm btn-warn" id="bulk-wontfix" title="Mark selected as wontfix">&#x2718; Wontfix</button>
        <button class="btn btn-sm btn-info" id="bulk-open" title="Reopen selected">&#x25b6; Reopen</button>
        <button class="btn btn-sm" id="bulk-clear" title="Clear selection">Clear</button>
      </div>
      <div id="issue-grid" class="issue-grid"></div>
    </div>
  </div>
</div>

<!-- MODAL -->
<div id="modal-backdrop" class="modal-backdrop" style="display:none;">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <button id="modal-close" class="close" aria-label="Close">&times;</button>
    <h2 id="modal-title">Issue Detail</h2>
    <div id="modal-body"></div>
  </div>
</div>

<script>
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const API = (p) => '/api' + p;
async function loadJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' toast-' + type : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 2500);
}

/* === FILTERS STATE === */
function getFilters() {
  return {
    q: document.getElementById('search-q').value.trim(),
    status: document.getElementById('filter-status').value,
    category: document.getElementById('filter-category').value,
    severity: document.getElementById('filter-severity').value,
  };
}
function setFilters(f) {
  document.getElementById('search-q').value = f.q || '';
  document.getElementById('filter-status').value = f.status || '';
  document.getElementById('filter-category').value = f.category || '';
  document.getElementById('filter-severity').value = f.severity || '';
}

/* === METRICS === */
let _prevStats = {};
function renderMetrics(stats) {
  const metrics = [
    { label: 'Total', value: stats.total ?? '?', cls: 'info', key: 'total' },
    { label: 'Open', value: stats.open ?? '?', cls: 'warn', key: 'open' },
    { label: 'In Progress', value: stats.in_progress ?? '?', cls: 'info', key: 'in_progress' },
    { label: 'Done', value: stats.done ?? '?', cls: 'ok', key: 'done' },
    { label: 'Wontfix', value: stats.wontfix ?? '?', cls: '', key: 'wontfix' },
  ];
  document.getElementById('metrics').innerHTML = metrics.map(c => {
    const changed = _prevStats[c.key] !== undefined && _prevStats[c.key] !== c.value;
    return '<div class="metric ' + c.cls + (changed ? ' pulse' : '') + '"><b>' + c.value + '</b>' + c.label + '</div>';
  }).join('');
  _prevStats = { total: stats.total, open: stats.open, in_progress: stats.in_progress, done: stats.done, wontfix: stats.wontfix };
  const pct = stats.total > 0 ? Math.round(((stats.done + stats.wontfix) / stats.total) * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = pct + '% resolved (' + (stats.done + stats.wontfix) + '/' + stats.total + ')';
}

/* === SEVERITY SUMMARY (sidebar) === */
function renderSevSummary(stats) {
  const bySev = stats.by_severity || {};
  const total = stats.total || 1;
  const order = ['critical', 'high', 'medium', 'low'];
  const colors = { critical: 'var(--danger)', high: 'var(--warn)', medium: '#fcd34d', low: 'var(--ok)' };
  document.getElementById('sev-summary').innerHTML = order.map(s => {
    const n = bySev[s] || 0;
    const pct = Math.round((n / total) * 100);
    return '<div style="margin-bottom:0.4rem;">' +
      '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:0.15rem;">' +
      '<span style="color:' + colors[s] + ';text-transform:uppercase;font-weight:600;">' + s + '</span>' +
      '<span style="color:var(--muted);">' + n + ' (' + pct + '%)</span></div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%;background:' + colors[s] + ';"></div></div></div>';
  }).join('');
}

/* === CATEGORIES (sidebar) === */
const _catColors = { critical:'#f87171', high:'#fbbf24', medium:'#fcd34d', low:'#4ade80' };
function renderCategories(data, currentFilter) {
  const cats = data.categories || [];
  const el = document.getElementById('cat-list');
  let html = '';
  if (currentFilter) {
    html += '<button class="cat-clear-btn" id="cat-clear-filter">&#x2715; Clear: ' + esc(currentFilter) + '</button>';
  }
  html += cats.map(c => {
    const isActive = currentFilter === c.category;
    const openCount = c.open || 0;
    const doneCount = c.done || 0;
    const total = c.count || 1;
    const resolvedPct = Math.round(((doneCount + (c.wontfix || 0)) / total) * 100);
    const bySev = c.by_severity || {};
    const sevDots = ['critical', 'high', 'medium', 'low']
      .filter(s => bySev[s])
      .map(s => '<span class="cat-sev-dot" style="background:' + _catColors[s] + ';" title="' + s + ': ' + bySev[s] + '"></span>')
      .join('');
    return '<div class="cat-item' + (isActive ? ' active' : '') + '" data-cat="' + esc(c.category) + '">' +
      '<div class="cat-head"><span class="cat-name">' + esc(c.category) + '</span>' +
        '<div class="cat-counts">' +
          (openCount > 0 ? '<span class="cat-open">' + openCount + ' open</span>' : '<span class="cat-done">&#x2713;</span>') +
          '<span class="cat-total">' + total + '</span>' +
        '</div></div>' +
      '<div class="cat-bar"><div class="cat-bar-fill" style="width:' + resolvedPct + '%;"></div></div>' +
      (sevDots ? '<div class="cat-sevs">' + sevDots + '</div>' : '') +
    '</div>';
  }).join('');
  el.innerHTML = html;
  const clearBtn = el.querySelector('#cat-clear-filter');
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const f = getFilters();
      f.category = '';
      setFilters(f);
      refresh();
    });
  }
  el.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      const cat = item.dataset.cat;
      const f = getFilters();
      f.category = f.category === cat ? '' : cat;
      setFilters(f);
      refresh();
    });
  });
  const sel = document.getElementById('filter-category');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' + cats.map(c =>
    '<option value="' + esc(c.category) + '">' + esc(c.category) + ' (' + c.count + ')</option>'
  ).join('');
  sel.value = cur;
}

/* === PRIORITY TRACKER === */
let _selectedPriorityId = null;
function renderPriorityTracker(rows) {
  const allowed = new Set(['open','in_progress','blocked','pending']);
  const open = (rows || []).filter(r => allowed.has(r.status));
  const sorted = [...open].sort((a, b) => {
    const va = (a.priority_rank) || 0;
    const vb = (b.priority_rank) || 0;
    if (va !== vb) return vb - va;
    return (b.last_seen || '').localeCompare(a.last_seen || '');
  });
  const el = document.getElementById('priority-list');
  const countEl = document.getElementById('priority-count');
  if (countEl) countEl.textContent = String(sorted.length);
  if (!sorted.length) { el.innerHTML = '<span class="empty">No active issues.</span>'; _selectedPriorityId = null; return; }
  el.innerHTML = sorted.map(r => {
    const rank = (r.priority_rank) || 0;
    const note = (r.priority_note) ? ('<span class="p-note">' + esc(r.priority_note) + '</span>') : '';
    const title = esc((r.title || r.issue_id).slice(0, 80));
    const sel = r.issue_id === _selectedPriorityId ? ' selected' : '';
    const aiStatus = (r.extra && r.extra.ai_status) || '';
    const aiDur = (r.extra && r.extra.ai_duration_s) || 0;
    let aiBadge = '';
    if (aiStatus === 'processing') {
      aiBadge = '<span class="p-ai-status processing"><span class="ai-spinner active" style="width:10px;height:10px;border-width:1.5px;display:inline-block;vertical-align:middle;"></span> AI working...</span>';
    } else if (aiStatus === 'done') {
      aiBadge = '<span class="p-ai-status done">AI done' + (aiDur ? ' ' + aiDur + 's' : '') + '</span>';
    } else if (aiStatus === 'error') {
      aiBadge = '<span class="p-ai-status error" title="' + esc((r.extra && r.extra.ai_last_error) || '') + '">AI error</span>';
    }
    const fixBtn = '<button class="p-fix-btn" data-priority-fix="' + esc(r.issue_id) + '" title="Send to AI for fix">&#x1f916; Fix</button>';
    return '<div class="priority-item' + sel + '" data-issue-id="' + esc(r.issue_id) + '" data-rank="' + rank + '" data-note="' + esc((r.priority_note) || '') + '">' +
      '<span class="p-rank">' + rank + '</span>' +
      '<div style="min-width:0;"><div class="p-title" title="' + esc(r.title || r.issue_id) + '">' + title + '</div>' +
        '<div class="p-meta"><span class="p-id">' + esc(r.issue_id.slice(0, 8)) + '</span>' + note + aiBadge + '</div></div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.2rem;">' +
        '<span class="badge p-sev sev-' + esc(r.severity) + '">' + esc(r.severity) + '</span>' +
        fixBtn +
      '</div>' +
    '</div>';
  }).join('');
  el.querySelectorAll('.priority-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-priority-fix]')) return;
      el.querySelectorAll('.priority-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      _selectedPriorityId = item.dataset.issueId;
      document.getElementById('priority-rank').value = item.dataset.rank || '0';
      document.getElementById('priority-note').value = item.dataset.note || '';
    });
  });
  el.querySelectorAll('[data-priority-fix]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const issueId = btn.dataset.priorityFix;
      const row = sorted.find(r => r.issue_id === issueId);
      if (!row) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="ai-spinner active" style="width:10px;height:10px;border-width:1.5px;display:inline-block;vertical-align:middle;"></span>';
      const result = await resolveWithAI(issueId, null, btn, (html) => _updatePriorityAiStatus(issueId, html));
      if (result && result.response) {
        openModal(row, null, result.response);
      } else if (result && result.error) {
        btn.innerHTML = '&#x1f916; Fix';
        btn.disabled = false;
      } else {
        btn.innerHTML = '&#x1f916; Fix';
        btn.disabled = false;
      }
      refresh();
    });
  });
}
function showPriorityFeedback(msg) {
  const el = document.getElementById('priority-feedback');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}
function _getSelectedPriorityId() {
  if (_selectedPriorityId) return _selectedPriorityId;
  const sel = document.querySelector('.priority-item.selected');
  return sel ? sel.dataset.issueId : null;
}
async function _setPriority(rank, note) {
  const issueId = _getSelectedPriorityId();
  if (!issueId) { showPriorityFeedback('Select an issue first'); return; }
  rank = Math.max(0, Math.min(99, parseInt(rank || '0', 10) || 0));
  await fetch('/api/priority/' + encodeURIComponent(issueId) + '/rank', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({priority_rank: rank, priority_note: note || ''})
  });
  document.getElementById('priority-rank').value = String(rank);
  showPriorityFeedback('Rank set to ' + rank);
  refresh();
}

/* === LOOP STATE === */
let _loopRunning = false;
let _loopPollTimer = null;
function renderLoop(state, history) {
  const done = (state.processed || []).length;
  const failed = (state.failed || []).length;
  const iter = state.iteration || 0;
  const maxIter = parseInt(document.getElementById('loop-max-iters')?.value || '10', 10);
  const running = !!state.running;
  _loopRunning = running;
  const pct = maxIter > 0 ? Math.min(100, Math.round((iter / maxIter) * 100)) : 0;
  let pills = '<span class="pill' + (running ? ' running' : '') + '">Iter: ' + iter + (running ? '/' + maxIter : '') + '</span>' +
    '<span class="pill" style="color:var(--ok)">OK: ' + done + '</span>' +
    '<span class="pill" style="color:var(--danger)">Fail: ' + failed + '</span>';
  if (running) {
    const elapsed = state.started_at ? Math.round((Date.now() - new Date(state.started_at).getTime()) / 1000) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    pills += '<span class="pill" style="color:var(--info)">' + String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0') + '</span>';
  }
  document.getElementById('loop-status').innerHTML = pills;
  const progWrap = document.getElementById('loop-progress-wrap');
  const progFill = document.getElementById('loop-progress-fill');
  const progLabel = document.getElementById('loop-progress-label');
  if (running || iter > 0) {
    progWrap.style.display = '';
    progFill.style.width = pct + '%';
    progLabel.textContent = iter + ' / ' + maxIter + ' iterations (' + pct + '%)';
  } else {
    progWrap.style.display = 'none';
  }
  const curEl = document.getElementById('loop-current');
  if (running && state.current_issue) {
    curEl.style.display = '';
    curEl.innerHTML = '<div class="lc-label">Processing</div>' +
      '<div class="lc-issue">' + esc(state.current_issue) + '</div>' +
      (state.current_detail ? '<div class="lc-detail">' + esc(state.current_detail.slice(0, 80)) + '</div>' : '');
  } else {
    curEl.style.display = 'none';
  }
  document.getElementById('btn-start-loop').style.display = running ? 'none' : '';
  document.getElementById('btn-stop-loop').style.display = running ? '' : 'none';
  const el = document.getElementById('loop-history');
  if (!history || !history.length) { el.innerHTML = '<span class="empty">No iterations yet.</span>'; return; }
  el.innerHTML = history.slice(-20).reverse().map((it, idx) => {
    const when = it.when ? new Date(it.when).toLocaleString() : '';
    const cls = it.ok ? 'completed' : 'failed';
    const parts = [];
    if (it.issue_id) parts.push(it.issue_id.split(':').pop());
    const detail = it.detail || '';
    const shortDetail = detail.slice(0, 50);
    return '<div class="history-item" data-hidx="' + idx + '">' +
      '<span><span class="h-status ' + cls + '">' + esc(it.ok ? 'OK' : 'FAIL') + '</span> ' + esc(parts.join(' - ')) +
      (shortDetail.length < detail.length ? ' ' + esc(shortDetail) + '...' : (shortDetail ? ' ' + esc(shortDetail) : '')) + '</span>' +
      '<span class="h-meta">' + esc(when) + '</span>' +
      '<div class="h-detail">' + esc(detail) + '</div></div>';
  }).join('');
  el.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => item.classList.toggle('expanded'));
  });
}
function _populateLoopCategories(categories) {
  const sel = document.getElementById('loop-category');
  if (!sel) return;
  const cur = sel.value;
  const cats = (categories || []).map(c => typeof c === 'string' ? c : c.category).filter(Boolean).sort();
  sel.innerHTML = '<option value="">All</option>' + cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  sel.value = cur;
}
async function _startLoop() {
  const cfg = {
    model: document.getElementById('loop-model').value,
    max_iterations: parseInt(document.getElementById('loop-max-iters').value, 10) || 10,
    issues_per_iteration: parseInt(document.getElementById('loop-per-iter').value, 10) || 2,
    category: document.getElementById('loop-category').value || null,
    dry_run: document.getElementById('loop-dry-run').checked,
    auto_verify: document.getElementById('loop-auto-verify').checked,
  };
  try {
    const resp = await fetch(API('/loop/start'), { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(cfg) });
    const data = await resp.json();
    if (data.error) { showToast('Start failed: ' + data.error, 'error'); return; }
    showToast('Loop started', 'success');
    _loopRunning = true;
    _startLoopPoll();
    refresh();
  } catch (e) { showToast('Start failed: ' + e.message, 'error'); }
}
async function _stopLoop() {
  try {
    const resp = await fetch(API('/loop/stop'), { method: 'POST' });
    const data = await resp.json();
    showToast(data.status === 'stopped' ? 'Loop stopped' : 'Stop acknowledged');
    _loopRunning = false;
    _stopLoopPoll();
    refresh();
  } catch (e) { showToast('Stop failed: ' + e.message, 'error'); }
}
function _startLoopPoll() {
  _stopLoopPoll();
  _loopPollTimer = setInterval(() => { refresh(); }, 3000);
}
function _stopLoopPoll() {
  if (_loopPollTimer) { clearInterval(_loopPollTimer); _loopPollTimer = null; }
}

/* === SCREENSHOTS === */
function renderThumbs(screenshots) {
  if (!screenshots || !screenshots.length) return '';
  const base = '/api/screenshot/';
  return '<div class="meta-row">' + screenshots.filter(Boolean).map(name =>
    '<a href="' + base + encodeURIComponent(name) + '" target="_blank" title="' + esc(name) + '"><img style="width:64px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" src="' + base + encodeURIComponent(name) + '" loading="lazy" /></a>'
  ).join('') + '</div>';
}

/* === AI RESOLUTION === */
const _activeResolves = new Map();
function _updatePriorityAiStatus(issueId, html) {
  const item = document.querySelector('.priority-item[data-issue-id="' + CSS.escape(issueId) + '"]');
  if (!item) return;
  let badge = item.querySelector('.p-ai-status');
  if (!badge) {
    const meta = item.querySelector('.p-meta');
    if (!meta) return;
    badge = document.createElement('span');
    badge.className = 'p-ai-status';
    meta.appendChild(badge);
  }
  badge.outerHTML = html;
}
async function resolveWithAI(issueId, model, btn, onProgress) {
  const modelSel = document.getElementById('model-select');
  const selectedModel = model || modelSel.value;
  if (!selectedModel) { alert('Please select an Ollama model first.'); return; }
  if (_activeResolves.has(issueId)) return null;
  btn && (btn.disabled = true);
  _activeResolves.set(issueId, true);
  const startedAt = Date.now();
  const progress = onProgress || (() => {});
  try {
    const updateBtn = (text, spin) => {
      if (!btn) return;
      btn.innerHTML = spin ? '<span class="ai-spinner active"></span> ' + text : text;
      btn.disabled = !spin;
    };
    updateBtn(selectedModel + ' ...', true);
    progress('<span class="p-ai-status processing"><span class="ai-spinner active" style="width:10px;height:10px;border-width:1.5px;display:inline-block;vertical-align:middle;"></span> Preparing...</span>');
    await new Promise(r => setTimeout(r, 100));
    progress('<span class="p-ai-status processing"><span class="ai-spinner active" style="width:10px;height:10px;border-width:1.5px;display:inline-block;vertical-align:middle;"></span> Searching codebase...</span>');
    const timer = setInterval(() => {
      const sec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      updateBtn(selectedModel + ' \u00b7 ' + sec + 's\u2026', true);
      if (sec >= 2) {
        progress('<span class="p-ai-status processing"><span class="ai-spinner active" style="width:10px;height:10px;border-width:1.5px;display:inline-block;vertical-align:middle;"></span> ' + esc(selectedModel) + ' thinking... ' + sec + 's</span>');
      }
    }, 1000);
    const res = await fetch(API('/issues/' + encodeURIComponent(issueId) + '/resolve'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel }),
    });
    clearInterval(timer);
    const data = await res.json();
    _activeResolves.delete(issueId);
    if (!res.ok) {
      updateBtn('AI Fix', false);
      progress('<span class="p-ai-status error" title="' + esc((data.error || '').slice(0, 100)) + '">AI error</span>');
      return { error: data.error || 'HTTP ' + res.status, issue_id: issueId };
    }
    const dur = data.duration_s || Math.round((Date.now() - startedAt) / 1000);
    updateBtn((data.model || selectedModel) + ' \u00b7 ' + dur + 's', false);
    progress('<span class="p-ai-status done">AI done ' + dur + 's</span>');
    return { response: data.response, model: data.model, issue_id: issueId };
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'AI Fix'; }
    _activeResolves.delete(issueId);
    progress('<span class="p-ai-status error">Network error</span>');
    return { error: 'Network error: ' + e.message };
  }
}

/* === ISSUE CARDS === */
function renderIssues(rows, linksByIssue) {
  const grid = document.getElementById('issue-grid');
  grid.innerHTML = '';
  if (!rows.length) { grid.innerHTML = '<span class="empty" style="grid-column:1/-1;padding:1rem;">No issues match your filters.</span>'; return; }
  for (const row of rows) {
    const screenshots = (linksByIssue && linksByIssue[row.issue_id]) ? linksByIssue[row.issue_id] : (row.screenshot ? [row.screenshot] : []);
    const card = document.createElement('div');
    card.className = 'issue-card';
    card.dataset.row = JSON.stringify(row);
    const filePath = (row.extra && row.extra.file) ? '<span class="meta-tag" title="File">' + esc(row.extra.file.split('/').pop()) + '</span>' : '';
    const tagChips = (row.tags || []).slice(0, 4).map(t => '<span class="meta-tag">' + esc(t) + '</span>').join(' ');

    let actions = '';
    if (row.status === 'open' || row.status === 'in_progress') {
      actions = '<button class="btn btn-sm btn-ok" data-action="done" title="Mark done">&#10003; Done</button>' +
        '<button class="btn btn-sm btn-info" data-action="in_progress" title="Set in progress">&#9654; WIP</button>' +
        '<button class="btn btn-sm" data-action="wontfix" title="Won\'t fix">&#10005; Skip</button>' +
        '<button class="btn btn-sm btn-accent" data-action="ai-resolve" title="Send to AI for resolution">&#x1f916; AI Fix</button>' +
        (row.extra && row.extra.ai_status ? ' <span class="badge status-' + esc((row.extra.ai_status || 'processing')) + '">AI ' + esc((row.extra.ai_status || 'processing')) + '</span>' : '') +
        (row.extra && row.extra.ai_last_error ? ' <span class="badge sev-critical" title="' + esc(row.extra.ai_last_error) + '">AI err</span>' : '');
    } else if (row.status === 'done') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>';
    } else if (row.status === 'wontfix') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>' +
        '<button class="btn btn-sm btn-ok" data-action="done" title="Mark done">&#10003; Done</button>';
    }

    card.innerHTML =
      '<label class="bulk-cb"><input type="checkbox" class="bulk-check" data-id="' + esc(row.issue_id) + '" /></label>' +
      '<div class="issue-head"><div style="flex:1;min-width:0;">' +
        '<div class="issue-title" title="' + esc(row.title || '') + '">' + esc((row.title || '').slice(0, 120)) + '</div>' +
        '<div class="issue-id">' + esc(row.issue_id) + '</div>' +
      '</div><div style="display:flex;gap:0.3rem;flex-shrink:0;">' +
        '<span class="badge status-' + esc(row.status) + '">' + esc(row.status) + '</span>' +
        '<span class="badge sev-' + esc(row.severity) + '">' + esc(row.severity) + '</span>' +
      '</div></div>' +
      '<div class="meta-row"><span class="meta-tag">' + esc(row.category) + '</span>' + filePath +
        '<span class="meta-tag">seen ' + esc((row.last_seen || row.first_seen || '').slice(0, 10)) + '</span>' +
        (row.occurrences > 1 ? '<span class="meta-tag">' + row.occurrences + 'x</span>' : '') +
      '</div>' +
      (tagChips ? '<div class="meta-row">' + tagChips + '</div>' : '') +
      (row.notes ? '<div class="notes">' + esc(row.notes.slice(0, 200)) + '</div>' : '') +
      renderThumbs(screenshots) +
      (actions ? '<div class="card-actions">' + actions + '</div>' : '');
    grid.appendChild(card);
  }
  /* Wire action buttons */
  grid.querySelectorAll('.card-actions .btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const row = JSON.parse(btn.closest('.issue-card').dataset.row || '{}');
      if (!row.issue_id || !action) return;
      if (action === 'wontfix') {
        const reason = prompt('Why is this issue being skipped? (optional: type a reason or leave blank)');
        const res = await fetch('/api/issues/' + encodeURIComponent(row.issue_id) + '/' + action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: (reason || '').trim() }),
        });
        if (res.ok) { closeModal(); }
        else { btn.disabled = false; }
        return;
      }
      if (action === 'ai-resolve') {
        const result = await resolveWithAI(row.issue_id, null, btn);
        if (result && result.response) {
          openModal(row, linksByIssue, result.response);
        } else if (result && result.error) {
          alert('AI Error: ' + result.error);
        }
        refresh();
        return;
      }
      btn.disabled = true;
      try {
        await fetch('/api/issues/' + encodeURIComponent(row.issue_id) + '/' + action, { method: 'POST' });
        refresh();
      } catch(err) { console.error(err); btn.disabled = false; }
    });
  });
  grid.querySelectorAll('.issue-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-actions') || e.target.closest('button') || e.target.closest('.bulk-cb')) return;
      openModal(JSON.parse(card.dataset.row || '{}'), linksByIssue);
    });
  });
  grid.querySelectorAll('.bulk-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const card = cb.closest('.issue-card');
      if (cb.checked) card.classList.add('selected'); else card.classList.remove('selected');
      _updateBulkBar();
    });
  });
}
const _bulkSelected = () => [...document.querySelectorAll('.bulk-check:checked')].map(cb => cb.dataset.id);
function _updateBulkBar() {
  const ids = _bulkSelected();
  const bar = document.getElementById('bulk-bar');
  if (ids.length) { bar.style.display = ''; document.getElementById('bulk-count').textContent = ids.length + ' selected'; }
  else { bar.style.display = 'none'; }
}
async function _bulkAction(status) {
  const ids = _bulkSelected();
  if (!ids.length) return;
  const label = status === 'done' ? 'done' : status === 'wontfix' ? 'wontfix' : 'open';
  if (!confirm('Mark ' + ids.length + ' issue(s) as ' + label + '?')) return;
  const body = status === 'wontfix' ? JSON.stringify({reason:''}) : undefined;
  const headers = status === 'wontfix' ? {'Content-Type':'application/json'} : undefined;
  const results = await Promise.allSettled(ids.map(id =>
    fetch('/api/issues/' + encodeURIComponent(id) + '/' + label, { method: 'POST', headers, body }).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r;
    })
  ));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed) showToast(failed + ' of ' + ids.length + ' updates failed', 'error');
  document.querySelectorAll('.bulk-check').forEach(cb => { cb.checked = false; cb.closest('.issue-card')?.classList.remove('selected'); });
  _updateBulkBar();
  refresh();
}
document.getElementById('bulk-done')?.addEventListener('click', () => _bulkAction('done'));
document.getElementById('bulk-wontfix')?.addEventListener('click', () => _bulkAction('wontfix'));
document.getElementById('bulk-open')?.addEventListener('click', () => _bulkAction('open'));
document.getElementById('bulk-clear')?.addEventListener('click', () => {
  document.querySelectorAll('.bulk-check').forEach(cb => { cb.checked = false; cb.closest('.issue-card')?.classList.remove('selected'); });
  _updateBulkBar();
});

/* === SORTING === */
const sevRank = (s) => SEV_ORDER[s] ?? 9;
function sortIssues(rows) {
  const field = document.getElementById('sort-field').value;
  const dir = document.getElementById('sort-dir').value === 'asc' ? 1 : -1;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let va, vb;
    if (field === 'severity') { va = sevRank(a.severity); vb = sevRank(b.severity); }
    else if (field === 'occurrences') { va = a.occurrences || 0; vb = b.occurrences || 0; }
    else { va = (a[field] || '').toString().toLowerCase(); vb = (b[field] || '').toString().toLowerCase(); }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return sorted;
}

/* === STATS COMPUTATION === */
function computeStats(rows) {
  const by_status = {}, by_severity = {}, by_category = {};
  for (const r of rows) {
    by_status[r.status] = (by_status[r.status] || 0) + 1;
    by_severity[r.severity] = (by_severity[r.severity] || 0) + 1;
    by_category[r.category] = (by_category[r.category] || 0) + 1;
  }
  return { total: rows.length, open: by_status.open || 0, in_progress: by_status.in_progress || 0, blocked: by_status.blocked || 0, pending: by_status.pending || 0, done: by_status.done || 0, wontfix: by_status.wontfix || 0, by_severity, by_category };
}

/* === MAIN REFRESH === */
let _allIssues = [];
let _filteredIssues = [];
async function refresh() {
  try {
    const [allIssues, filteredIssues, quality, loopState, loopHistory, categories, linksRaw] = await Promise.all([
      loadJSON(API('/issues')).catch(() => []),
      buildIssuesUrl().catch(() => []),
      loadJSON(API('/quality')).catch(() => ({})),
      loadJSON(API('/loop/state')).catch(() => ({iteration:0,processed:[],failed:[]})),
      loadJSON(API('/loop/history')).catch(() => []),
      loadJSON(API('/categories')).catch(() => ({categories:[]})),
      loadJSON(API('/links')).catch(() => ({})),
    ]);
    _allIssues = allIssues;
    _filteredIssues = filteredIssues;
    const linksByIssue = {};
    for (const [k, v] of Object.entries(linksRaw || {})) {
      linksByIssue[k] = (v && v.screenshots) ? v.screenshots : [];
    }
    const totalStats = computeStats(allIssues);
    document.title = 'Issue Tracker - ' + (totalStats.open + totalStats.in_progress) + ' open / ' + totalStats.total + ' total';
    renderMetrics(totalStats);
    renderSevSummary(totalStats);
    renderCategories(categories, getFilters().category);
    renderPriorityTracker(filteredIssues);
    renderLoop(loopState, loopHistory);
    if (categories && categories.categories) _populateLoopCategories(categories.categories);
    if (loopState.running && !_loopRunning) { _startLoopPoll(); }
    else if (!loopState.running && _loopRunning) { _loopRunning = false; _stopLoopPoll(); }
    const sorted = sortIssues(filteredIssues);
    document.getElementById('issue-count').textContent = sorted.length;
    document.getElementById('result-count').textContent = sorted.length + ' of ' + allIssues.length + ' total';
    renderIssues(sorted, linksByIssue);
    renderCharts(allIssues);
  } catch (err) {
    console.error('Refresh failed:', err);
    showToast('Failed to refresh data', 'error');
  }
}

/* === CHARTS === */
function computeTimeline(rows) {
  if (!rows || !rows.length) return { labels: [], opened: [], closed: [] };
  const days = {};
  for (const r of rows) {
    const d = (r.first_seen || r.last_seen || '').slice(0, 10);
    if (!d) continue;
    if (!days[d]) days[d] = { opened: 0, closed: 0 };
    if (r.status === 'open' || r.status === 'in_progress' || r.status === 'blocked' || r.status === 'pending') days[d].opened += 1;
    if (r.status === 'done' || r.status === 'wontfix') days[d].closed += 1;
  }
  const sorted = Object.keys(days).sort();
  return { labels: sorted, opened: sorted.map(d => days[d].opened), closed: sorted.map(d => days[d].closed) };
}
function renderCharts(rows) {
  const timeline = computeTimeline(rows);
  const sevCounts = {}, catCounts = {};
  for (const r of rows) { sevCounts[r.severity] = (sevCounts[r.severity]||0)+1; catCounts[r.category] = (catCounts[r.category]||0)+1; }
  const sevLabels = Object.keys(sevCounts);
  const sevColors = { critical:'rgba(248,113,113,0.8)', high:'rgba(251,191,36,0.8)', medium:'rgba(252,211,77,0.8)', low:'rgba(74,222,128,0.8)' };
  const catSorted = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
  const catLabels = catSorted.map(x=>x[0]);
  const catData = catSorted.map(x=>x[1]);
  const catColors = ['rgba(96,165,250,0.8)','rgba(52,211,153,0.8)','rgba(251,191,36,0.8)','rgba(248,113,113,0.8)','rgba(167,139,250,0.8)','rgba(244,114,182,0.8)','rgba(148,163,184,0.8)','rgba(45,212,191,0.8)','rgba(251,146,60,0.8)','rgba(192,132,252,0.8)'];
  const ctxT = document.getElementById('chart-timeline');
  if (!ctxT) return;
  if (window._cT) {
    window._cT.data.labels = timeline.labels;
    window._cT.data.datasets[0].data = timeline.opened;
    window._cT.data.datasets[1].data = timeline.closed;
    window._cT.update();
  } else {
    window._cT = new Chart(ctxT, { type:'line', data:{ labels:timeline.labels, datasets:[
      { label:'Opened', data:timeline.opened, borderColor:'rgba(251,191,36,1)', backgroundColor:'rgba(251,191,36,0.1)', fill:true, tension:0.3, pointRadius:2 },
      { label:'Closed', data:timeline.closed, borderColor:'rgba(74,222,128,1)', backgroundColor:'rgba(74,222,128,0.1)', fill:true, tension:0.3, pointRadius:2 }
    ]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e8e8ed',boxWidth:10,font:{size:10}}}}, scales:{ x:{ticks:{color:'#7a7d8a',maxTicksLimit:6,font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'}}, y:{ticks:{color:'#7a7d8a',stepSize:1,font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'},beginAtZero:true} } } });
  }
  const ctxS = document.getElementById('chart-severity');
  if (!ctxS) return;
  if (window._cS) {
    window._cS.data.labels = sevLabels;
    window._cS.data.datasets[0].data = sevLabels.map(l=>sevCounts[l]);
    window._cS.data.datasets[0].backgroundColor = sevLabels.map(l=>sevColors[l]||'rgba(122,125,138,0.8)');
    window._cS.update();
  } else {
    window._cS = new Chart(ctxS, { type:'doughnut', data:{ labels:sevLabels, datasets:[{ data:sevLabels.map(l=>sevCounts[l]), backgroundColor:sevLabels.map(l=>sevColors[l]||'rgba(122,125,138,0.8)'), borderColor:'rgba(26,29,39,1)', borderWidth:2 }]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right',labels:{color:'#e8e8ed',boxWidth:8,font:{size:10},padding:6}}} } });
  }
  const ctxC = document.getElementById('chart-category');
  if (!ctxC) return;
  if (window._cC) {
    window._cC.data.labels = catLabels;
    window._cC.data.datasets[0].data = catData;
    window._cC.data.datasets[0].backgroundColor = catColors.slice(0,catLabels.length);
    window._cC.update();
  } else {
    window._cC = new Chart(ctxC, { type:'bar', data:{ labels:catLabels, datasets:[{ label:'Issues', data:catData, backgroundColor:catColors.slice(0,catLabels.length), borderColor:'rgba(26,29,39,1)', borderWidth:1 }]}, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#7a7d8a',stepSize:1,font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'},beginAtZero:true}, y:{ticks:{color:'#e8e8ed',font:{size:9}},grid:{display:false}} } } });
  }
}

/* === MODAL === */
function openModal(row, linksByIssue, aiResponse) {
  const bb = document.getElementById('modal-backdrop');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  title.textContent = row.title || row.issue_id;
  const screenshots = (linksByIssue && linksByIssue[row.issue_id]) ? linksByIssue[row.issue_id] : (row.screenshot ? [row.screenshot] : []);
  const thumbsHtml = screenshots.filter(Boolean).map(name =>
    '<a href="/api/screenshot/' + encodeURIComponent(name) + '" target="_blank"><img style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" src="/api/screenshot/' + encodeURIComponent(name) + '" loading="lazy" title="' + esc(name) + '" /></a>'
  ).join('');
  const extraJson = row.extra && Object.keys(row.extra).length ? '<pre>' + esc(JSON.stringify(row.extra, null, 2)) + '</pre>' : '';
  let aiHtml = '';
  if (aiResponse) {
    let content = '';
    try {
      const j = JSON.parse(aiResponse);
      content = '<div style="display:flex;flex-direction:column;gap:0.6rem;">'
        + '<div><b style="color:var(--accent);">Root Cause:</b><br>' + esc(j.root_cause || '') + '</div>'
        + (j.file ? '<div><b style="color:var(--accent);">File:</b> <code>' + esc(j.file) + '</code>' + (j.line_range ? ' (lines ' + esc(j.line_range) + ')' : '') + '</div>' : '')
        + (j.current_code ? '<div><b>Current Code:</b><pre style="background:#1a0000;border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:0.5rem;font-size:0.75rem;overflow-x:auto;">' + esc(j.current_code) + '</pre></div>' : '')
        + (j.fixed_code ? '<div><b>Fixed Code:</b><pre style="background:#001a00;border:1px solid rgba(74,222,128,0.3);border-radius:6px;padding:0.5rem;font-size:0.75rem;overflow-x:auto;">' + esc(j.fixed_code) + '</pre></div>' : '<div style="color:var(--warn);font-size:0.82rem;">&#x26a0; No code fix provided — the AI could not identify a concrete change.</div>')
        + (j.explanation ? '<div><b style="color:var(--accent);">Explanation:</b><br>' + esc(j.explanation) + '</div>' : '')
        + '</div>';
    } catch(e) {
      content = '<pre style="white-space:pre-wrap;">' + esc(aiResponse) + '</pre>';
    }
    aiHtml = '<div class="ai-panel visible"><div class="ai-header"><h3>&#x1f916; AI Resolution</h3></div><div class="ai-response">' + content + '</div></div>';
  }
  body.innerHTML =
    '<dl>' +
      '<dt>ID</dt><dd style="font-family:monospace;font-size:0.8rem;color:#a5b4fc;">' + esc(row.issue_id) + '</dd>' +
      '<dt>Status</dt><dd><span class="badge status-' + esc(row.status) + '">' + esc(row.status) + '</span></dd>' +
      '<dt>Severity</dt><dd><span class="badge sev-' + esc(row.severity) + '">' + esc(row.severity) + '</span></dd>' +
      '<dt>Category</dt><dd>' + esc(row.category) + '</dd>' +
      '<dt>First seen</dt><dd>' + esc((row.first_seen || '-').slice(0, 19)) + '</dd>' +
      '<dt>Last seen</dt><dd>' + esc((row.last_seen || '-').slice(0, 19)) + '</dd>' +
      '<dt>Occurrences</dt><dd>' + esc(String(row.occurrences ?? '-')) + '</dd>' +
      '<dt>Title</dt><dd>' + esc(row.title || '-') + '</dd>' +
      '<dt>Notes</dt><dd>' + esc(row.notes || '-') + '</dd>' +
      (extraJson ? '<dt>Extra</dt><dd>' + extraJson + '</dd>' : '') +
    '</dl>' +
    (thumbsHtml ? '<div class="meta-row" style="margin-top:0.5rem;">' + thumbsHtml + '</div>' : '') +
    '<div class="modal-actions">' +
      '<select id="modal-status" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0.25rem 0.5rem;font-size:0.82rem;">' +
        '<option value="open" ' + (row.status==='open'?'selected':'') + '>Open</option>' +
        '<option value="in_progress" ' + (row.status==='in_progress'?'selected':'') + '>In Progress</option>' +
        '<option value="blocked" ' + (row.status==='blocked'?'selected':'') + '>Blocked</option>' +
        '<option value="pending" ' + (row.status==='pending'?'selected':'') + '>Pending</option>' +
        '<option value="done" ' + (row.status==='done'?'selected':'') + '>Done</option>' +
        '<option value="wontfix" ' + (row.status==='wontfix'?'selected':'') + '>Wontfix</option>' +
      '</select>' +
      (row.extra && row.extra.ai_status ? ' <span class="badge status-' + esc((row.extra.ai_status || 'processing')) + '">AI ' + esc((row.extra.ai_status || 'processing')) + '</span>' : '') +
      (row.extra && row.extra.ai_last_error ? ' <span class="badge sev-critical" title="' + esc(row.extra.ai_last_error) + '">AI err</span>' : '') +
      (row.status === 'done' ? '<button class="btn" data-action="open">Reopen</button>' : '') +
      (row.status === 'wontfix' ? '<button class="btn" data-action="open">Reopen</button><button class="btn btn-ok" data-action="done">Mark Done</button>' : '') +
    '</div>' +
    '<div class="ai-panel" id="modal-ai-panel"><div class="ai-header"><h3>&#x1f916; AI Resolution</h3><span class="ai-spinner" id="modal-ai-spinner"></span></div><div class="ai-response" id="modal-ai-response" style="display:none;"></div></div>';
  bb.style.display = 'flex';

  /* Show AI response if provided */
  if (aiResponse) {
    const aiEl = body.querySelector('#modal-ai-response');
    if (aiEl) {
      try {
        const j = JSON.parse(aiResponse);
        let html = '<div style="display:flex;flex-direction:column;gap:0.6rem;">'
          + '<div><b style="color:var(--accent);">Root Cause:</b><br>' + esc(j.root_cause || '') + '</div>'
          + (j.file ? '<div><b style="color:var(--accent);">File:</b> <code>' + esc(j.file) + '</code>' + (j.line_range ? ' (lines ' + esc(j.line_range) + ')' : '') + '</div>' : '')
          + (j.current_code ? '<div><b>Current Code:</b><pre style="background:#1a0000;border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:0.5rem;font-size:0.75rem;overflow-x:auto;">' + esc(j.current_code) + '</pre></div>' : '')
          + (j.fixed_code ? '<div><b>Fixed Code:</b><pre style="background:#001a00;border:1px solid rgba(74,222,128,0.3);border-radius:6px;padding:0.5rem;font-size:0.75rem;overflow-x:auto;">' + esc(j.fixed_code) + '</pre></div>' : '<div style="color:var(--warn);font-size:0.82rem;">&#x26a0; No code fix provided — the AI could not identify a concrete change.</div>')
          + (j.explanation ? '<div><b style="color:var(--accent);">Explanation:</b><br>' + esc(j.explanation) + '</div>' : '')
          + (j.file && j.current_code && j.fixed_code ? '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;"><button class="btn btn-ok" id="modal-apply-fix" style="margin-top:0.3rem;">&#x2714; Confirm Apply Fix</button><button class="btn btn-info" id="modal-verify-fix" style="margin-top:0.3rem;display:none;">&#x2699; Verify</button><span id="apply-fix-status" style="font-size:0.75rem;"></span></div>' : '')
          + '</div>';
        aiEl.innerHTML = html;
      } catch(e) {
        aiEl.textContent = aiResponse;
      }
      aiEl.style.display = 'block';
      aiEl.closest('.ai-panel').classList.add('visible');
      /* Wire Apply Fix + Verify buttons for pre-loaded AI response */
      const applyBtn = body.querySelector('#modal-apply-fix');
      const verifyBtn = body.querySelector('#modal-verify-fix');
      if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
          const statusEl = body.querySelector('#apply-fix-status');
          try {
            const j = JSON.parse(aiResponse);
            statusEl.textContent = 'Applying...';
            statusEl.style.color = 'var(--info)';
            applyBtn.disabled = true;
            const confirmRes = await fetch(API('/apply-fix/confirm'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file: j.file, current_code: j.current_code, fixed_code: j.fixed_code }),
            });
            const confirmData = await confirmRes.json();
            if (!confirmRes.ok) { throw new Error(confirmData.error || 'Patch confirmation failed'); }
            const res = await fetch(API('/apply-fix'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file: j.file, current_code: j.current_code, fixed_code: j.fixed_code, patch_token: confirmData.patch_token }),
            });
            const data = await res.json();
            if (res.ok) {
              statusEl.textContent = 'Applied! Backup: ' + (data.backup || 'none');
              statusEl.style.color = 'var(--ok)';
              applyBtn.textContent = '\u2714 Applied';
              if (verifyBtn) { verifyBtn.style.display = 'inline-block'; }
            } else {
              statusEl.textContent = 'Error: ' + (data.error || 'unknown');
              statusEl.style.color = 'var(--danger)';
              applyBtn.disabled = false;
            }
          } catch(e) {
            statusEl.textContent = 'Error: ' + e.message;
            statusEl.style.color = 'var(--danger)';
            applyBtn.disabled = false;
          }
        });
      }
      if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
          const statusEl = body.querySelector('#apply-fix-status');
          verifyBtn.disabled = true;
          verifyBtn.textContent = '\u23f3 Verifying...';
          statusEl.textContent = 'Running cargo test...';
          statusEl.style.color = 'var(--info)';
          try {
            const res = await fetch(API('/test/run'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tool: 'test' }),
            });
            const data = await res.json();
            if (data.exit_code === 0) {
              statusEl.textContent = '\u2714 Tests passed!';
              statusEl.style.color = 'var(--ok)';
              verifyBtn.textContent = '\u2714 Verified';
            } else {
              const failMatch = data.stdout.match(/(\d+) failed/);
              statusEl.textContent = '\u2718 Tests failed' + (failMatch ? ' (' + failMatch[1] + ' failed)' : '');
              statusEl.style.color = 'var(--danger)';
              verifyBtn.textContent = '\u2718 Failed';
            }
          } catch(e) {
            statusEl.textContent = 'Error: ' + e.message;
            statusEl.style.color = 'var(--danger)';
            verifyBtn.textContent = '\u2699; Verify';
            verifyBtn.disabled = false;
          }
        });
      }
    }
  }
  body.querySelectorAll('.modal-actions .btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (!action) return;
      if (action === 'ai-resolve') {
        const result = await resolveWithAI(row.issue_id, null, btn);
        const aiPanel = body.querySelector('#modal-ai-panel');
        const aiResp = body.querySelector('#modal-ai-response');
        const aiSpin = body.querySelector('#modal-ai-spinner');
        if (aiSpin) aiSpin.classList.remove('active');
        if (result && result.response) {
          let html = '';
          try {
            const j = JSON.parse(result.response);
            html = '<div style="display:flex;flex-direction:column;gap:0.6rem;">'
              + '<div><b style="color:var(--accent);">Root Cause:</b><br>' + esc(j.root_cause || '') + '</div>'
              + (j.file ? '<div><b style="color:var(--accent);">File:</b> <code>' + esc(j.file) + '</code>' + (j.line_range ? ' (lines ' + esc(j.line_range) + ')' : '') + '</div>' : '')
              + (j.current_code ? '<div><b>Current Code:</b><pre style="background:#1a0000;border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:0.5rem;font-size:0.75rem;overflow-x:auto;">' + esc(j.current_code) + '</pre></div>' : '')
              + (j.fixed_code ? '<div><b>Fixed Code:</b><pre style="background:#001a00;border:1px solid rgba(74,222,128,0.3);border-radius:6px;padding:0.5rem;font-size:0.75rem;overflow-x:auto;">' + esc(j.fixed_code) + '</pre></div>' : '<div style="color:var(--warn);font-size:0.82rem;">&#x26a0; No code fix provided — the AI could not identify a concrete change.</div>')
              + (j.explanation ? '<div><b style="color:var(--accent);">Explanation:</b><br>' + esc(j.explanation) + '</div>' : '')
              + (j.file && j.current_code && j.fixed_code ? '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;"><button class="btn btn-ok" id="modal-apply-fix" style="margin-top:0.3rem;">&#x2714; Confirm Apply Fix</button><button class="btn btn-info" id="modal-verify-fix" style="margin-top:0.3rem;display:none;">&#x2699; Verify</button><span id="apply-fix-status" style="font-size:0.75rem;"></span></div>' : '')
              + '</div>';
          } catch(e) {
            html = '<pre style="white-space:pre-wrap;">' + esc(result.response) + '</pre>';
          }
          aiResp.innerHTML = html;
          aiResp.style.display = 'block';
          aiPanel.classList.add('visible');
          /* Wire Apply Fix button */
          const applyBtn = body.querySelector('#modal-apply-fix');
          const verifyBtn = body.querySelector('#modal-verify-fix');
          if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
              const statusEl = body.querySelector('#apply-fix-status');
              try {
                const j = JSON.parse(result.response);
                statusEl.textContent = 'Applying...';
                statusEl.style.color = 'var(--info)';
                applyBtn.disabled = true;
                const confirmRes = await fetch(API('/apply-fix/confirm'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: j.file, current_code: j.current_code, fixed_code: j.fixed_code }),
                });
                const confirmData = await confirmRes.json();
                if (!confirmRes.ok) { throw new Error(confirmData.error || 'Patch confirmation failed'); }
                const res = await fetch(API('/apply-fix'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: j.file, current_code: j.current_code, fixed_code: j.fixed_code, patch_token: confirmData.patch_token }),
                });
                const data = await res.json();
                if (res.ok) {
                  statusEl.textContent = 'Applied! Backup: ' + (data.backup || 'none');
                  statusEl.style.color = 'var(--ok)';
                  applyBtn.textContent = '\u2714 Applied';
                  if (verifyBtn) { verifyBtn.style.display = 'inline-block'; }
                } else {
                  statusEl.textContent = 'Error: ' + (data.error || 'unknown');
                  statusEl.style.color = 'var(--danger)';
                  applyBtn.disabled = false;
                }
              } catch(e) {
                statusEl.textContent = 'Error: ' + e.message;
                statusEl.style.color = 'var(--danger)';
                applyBtn.disabled = false;
              }
            });
          }
          if (verifyBtn) {
            verifyBtn.addEventListener('click', async () => {
              const statusEl = body.querySelector('#apply-fix-status');
              verifyBtn.disabled = true;
              verifyBtn.textContent = '\u23f3 Verifying...';
              statusEl.textContent = 'Running cargo test...';
              statusEl.style.color = 'var(--info)';
              try {
                const res = await fetch(API('/test/run'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tool: 'test' }),
                });
                const data = await res.json();
                if (data.exit_code === 0) {
                  statusEl.textContent = '\u2714 Tests passed! (' + (data.stdout.match(/test result:.*finished in ([\d.]+s)/)?.[1] || 'ok') + ')';
                  statusEl.style.color = 'var(--ok)';
                  verifyBtn.textContent = '\u2714 Verified';
                } else {
                  const failMatch = data.stdout.match(/(\d+) failed/);
                  const errMatch = data.stderr ? data.stderr.slice(0, 200) : '';
                  statusEl.textContent = '\u2718 Tests failed' + (failMatch ? ' (' + failMatch[1] + ' failed)' : '') + (errMatch ? ' - ' + errMatch : '');
                  statusEl.style.color = 'var(--danger)';
                  verifyBtn.textContent = '\u2718 Failed';
                }
              } catch(e) {
                statusEl.textContent = 'Error: ' + e.message;
                statusEl.style.color = 'var(--danger)';
                verifyBtn.textContent = '\u2699; Verify';
                verifyBtn.disabled = false;
              }
            });
          }
        } else if (result && result.error) {
          aiResp.textContent = 'Error: ' + result.error;
          aiResp.style.display = 'block';
          aiResp.classList.add('error');
          aiPanel.classList.add('visible');
        }
        return;
      }
      btn.disabled = true;
      const targetStatus = action || (document.getElementById('modal-status')?.value || null);
      if (targetStatus) {
        await fetch('/api/issues/' + encodeURIComponent(row.issue_id) + '/' + targetStatus, { method: 'POST' });
      }
      closeModal();
    });
  });
}
function closeModal() { document.getElementById('modal-backdrop').style.display = 'none'; refresh(); }

/* === BUILD ISSUES URL === */
function buildIssuesUrl() {
  const f = getFilters();
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.status) params.set('status', f.status);
  if (f.category) params.set('category', f.category);
  if (f.severity) params.set('severity', f.severity);
  const s = params.toString();
  return fetch(API('/issues' + (s ? '?' + s : ''))).then(r => r.json());
}

/* === LOAD MODELS === */
async function loadModels() {
  try {
    const data = await loadJSON(API('/ollama/models'));
    const sel = document.getElementById('model-select');
    const loopSel = document.getElementById('loop-model');
    const models = data.models || [];
    const statusEl = document.getElementById('ollama-status');
    if (loopSel && models.length) {
      const curLoop = loopSel.value;
      loopSel.innerHTML = models.map(m => '<option value="' + esc(m) + '"' + (m === curLoop ? ' selected' : '') + '>' + esc(m) + '</option>').join('');
    }
    if (!models.length) {
      sel.innerHTML = '<option value="">No models found</option>';
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--warn);">Ollama: no models</span>';
      document.querySelectorAll('[data-action="ai-resolve"]').forEach(b => b.disabled = true);
      return;
    }
    sel.innerHTML = models.map(m => '<option value="' + esc(m.name) + '">' + esc(m.name) + '</option>').join('');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--ok);">Ollama: ' + models.length + ' model(s) ready</span>';
    document.querySelectorAll('[data-action="ai-resolve"]').forEach(b => b.disabled = false);
  } catch (e) {
    const sel = document.getElementById('model-select');
    sel.innerHTML = '<option value="">Ollama offline</option>';
    const statusEl = document.getElementById('ollama-status');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger);">Ollama: offline</span>';
    document.querySelectorAll('[data-action="ai-resolve"]').forEach(b => { b.disabled = true; b.title = 'Ollama is not reachable'; });
  }
}

/* === RUST TOOLS === */
function getSelectedIssueContext() {
  const card = document.querySelector('.issue-card.selected');
  if (!card) return null;
  const row = JSON.parse(card.dataset.row || '{}');
  return {
    issue_id: row.issue_id || null,
    title: row.title || null,
    category: row.category || null,
    notes: row.notes || null,
    file: row.extra && row.extra.file ? row.extra.file : null,
    screenshot: row.screenshot || null,
  };
}

function setupRustTools() {
  document.querySelectorAll('[data-rust]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tool = btn.dataset.rust;
      const out = document.getElementById('rust-output');
      const payload = {
        tool,
        path: (document.getElementById('rust-path').value || '.').trim(),
        format: document.getElementById('rust-format').value,
        top: document.getElementById('rust-top').value,
        deep: document.getElementById('rust-deep').checked,
        report: document.getElementById('rust-report').checked,
        context: getSelectedIssueContext(),
      };
      out.textContent = tool === 'gui' ? 'Launching GUI...': 'Running CLI scan...';
      out.className = 'test-output';
      btn.disabled = true;
      try {
        const res = await fetch(API('/rust/run'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const lines = [];
        if (data.command) lines.push('$ ' + data.command);
        if (data.status) lines.push(data.status);
        if (data.pid) lines.push('pid: ' + data.pid);
        if (data.log) lines.push('log: ' + data.log);
        if (data.stdout || data.stderr) lines.push((data.stdout || '') + (data.stderr ? '\n--- STDERR ---\n' + data.stderr : ''));
        if (data.error) lines.push('Error: ' + data.error);
        if (typeof data.exit_code === 'number') lines.push('\nExit code: ' + data.exit_code);
        out.textContent = lines.join('\n').trim();
        if (res.ok && (data.status || data.exit_code === 0)) { out.classList.add('success'); }
        else { out.classList.add('error'); }
      } catch (e) {
        out.textContent = 'Error: ' + e.message;
        out.classList.add('error');
      }
      btn.disabled = false;
    });
  });
}

/* === TEST RUNNER === */
function setupTestRunner() {
  document.querySelectorAll('[data-test]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tool = btn.dataset.test;
      const out = document.getElementById('test-output');
      out.textContent = 'Running ' + tool + '...';
      out.className = 'test-output';
      btn.disabled = true;
      try {
        const res = await fetch(API('/test/run'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool }),
        });
        const data = await res.json();
        out.textContent = (data.stdout || '') + (data.stderr ? '\n--- STDERR ---\n' + data.stderr : '');
        if (data.exit_code === 0) { out.classList.add('success'); }
        else { out.classList.add('error'); out.textContent += '\n\nExit code: ' + data.exit_code; }
      } catch (e) {
        out.textContent = 'Error: ' + e.message;
        out.classList.add('error');
      }
      btn.disabled = false;
    });
  });
}

/* === EVENT LISTENERS === */
document.getElementById('btn-apply').addEventListener('click', refresh);
document.getElementById('btn-clear').addEventListener('click', () => { setFilters({}); refresh(); });
document.getElementById('btn-show-all').addEventListener('click', () => { document.getElementById('filter-status').value = ''; refresh(); });
document.getElementById('sort-field').addEventListener('change', refresh);
document.getElementById('sort-dir').addEventListener('change', refresh);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const cards = document.querySelectorAll('.issue-card');
  if (!cards.length) return;
  const focused = document.querySelector('.issue-card.selected');
  let idx = -1;
  if (focused) { cards.forEach((c, i) => { if (c === focused) idx = i; }); }
  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault();
    const next = idx < cards.length - 1 ? idx + 1 : 0;
    cards.forEach(c => c.classList.remove('selected'));
    cards[next].classList.add('selected');
    cards[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = idx > 0 ? idx - 1 : cards.length - 1;
    cards.forEach(c => c.classList.remove('selected'));
    cards[prev].classList.add('selected');
    cards[prev].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (e.key === 'Enter' && focused) {
    e.preventDefault();
    focused.querySelector('.issue-title')?.click();
  } else if (e.key === 'd' && focused) {
    e.preventDefault();
    try { var id = JSON.parse(focused.dataset.row || '{}').issue_id; } catch(e) { var id = null; }
    if (id && confirm('Mark ' + id + ' as done?')) {
      fetch(API('/issues/' + encodeURIComponent(id) + '/done'), { method: 'POST' }).then(() => refresh());
    }
  } else if (e.key === 'w' && focused) {
    e.preventDefault();
    try { var id = JSON.parse(focused.dataset.row || '{}').issue_id; } catch(e) { var id = null; }
    if (id && confirm('Mark ' + id + ' as wontfix?')) {
      fetch(API('/issues/' + encodeURIComponent(id) + '/wontfix'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({reason:''}) }).then(() => refresh());
    }
  }
});
document.getElementById('btn-reset-loop').addEventListener('click', async () => { if (!confirm('Reset loop state?')) return; await fetch(API('/loop/reset'), { method: 'POST' }); refresh(); });
document.getElementById('btn-start-loop').addEventListener('click', _startLoop);
document.getElementById('btn-stop-loop').addEventListener('click', _stopLoop);
document.getElementById('btn-clear-loop-history').addEventListener('click', async () => { if (!confirm('Clear loop history?')) return; await fetch(API('/loop/clear-history'), { method: 'POST' }); refresh(); });
document.getElementById('btn-add-toggle').addEventListener('click', () => { const f = document.getElementById('add-form'); f.classList.toggle('visible'); if (f.classList.contains('visible')) document.getElementById('new-title').focus(); });
document.getElementById('btn-add-cancel').addEventListener('click', () => { document.getElementById('add-form').classList.remove('visible'); });
document.getElementById('btn-set-priority').addEventListener('click', async () => {
    const rank = document.getElementById('priority-rank').value || '0';
    const note = (document.getElementById('priority-note').value || '').trim();
    await _setPriority(rank, note);
  });
document.getElementById('btn-pri-up').addEventListener('click', async () => {
    const inp = document.getElementById('priority-rank');
    const cur = parseInt(inp.value || '0', 10) || 0;
    inp.value = String(Math.min(99, cur + 1));
    await _setPriority(inp.value, (document.getElementById('priority-note').value || '').trim());
  });
document.getElementById('btn-pri-down').addEventListener('click', async () => {
    const inp = document.getElementById('priority-rank');
    const cur = parseInt(inp.value || '0', 10) || 0;
    inp.value = String(Math.max(0, cur - 1));
    await _setPriority(inp.value, (document.getElementById('priority-note').value || '').trim());
  });
document.getElementById('btn-pri-clear').addEventListener('click', async () => {
    document.getElementById('priority-rank').value = '0';
    document.getElementById('priority-note').value = '';
    await _setPriority('0', '');
  });
  document.getElementById('btn-add-submit').addEventListener('click', async () => {
  const title = document.getElementById('new-title').value.trim();
  if (!title) { alert('Title is required.'); return; }
  const payload = { title, category: document.getElementById('new-category').value, severity: document.getElementById('new-severity').value, notes: document.getElementById('new-notes').value.trim() };
  try {
    const r = await fetch(API('/issues/create'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) { document.getElementById('new-title').value = ''; document.getElementById('new-notes').value = ''; document.getElementById('add-form').classList.remove('visible'); refresh(); }
    else { const err = await r.json(); alert('Error: ' + (err.error || 'Unknown error')); }
  } catch (e) { alert('Network error: ' + e.message); }
});
let _searchTimer;
document.getElementById('search-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(_searchTimer); refresh(); } });
document.getElementById('search-q').addEventListener('input', () => { clearTimeout(_searchTimer); _searchTimer = setTimeout(refresh, 300); });

refresh();
loadModels();
setupRustTools();
setupTestRunner();
</script>
</body>
</html>
"""


class _DashboardState:
    """Container for shared service state (one per server process)."""

    LOOP_STATE_FILENAME = ".loop_state.json"

    def __init__(self, cfg: PipelineConfig) -> None:
        self.cfg: PipelineConfig = cfg
        self.tracker: IssueTracker = IssueTracker(cfg.tracker_path)
        self.history: QualityHistory = QualityHistory(cfg.quality_history_path)
        self.links: ScreenshotLinkStore = ScreenshotLinkStore(
            cfg.tracker_path.with_name("ux_screenshot_links.json")
        )
        self.store: SqliteIssueStore | None = None
        try:
            self.store = SqliteIssueStore(cfg.tracker_path)
        except Exception as exc:
            logger.debug("SQLite store unavailable: %s", exc)
        self.ollama: OllamaClient = OllamaClient(timeout=240.0, retries=0)
        self._test_lock = threading.Lock()
        self._rust_lock = threading.Lock()
        self._patch_confirm_lock = threading.Lock()
        self._patch_confirmations: dict[str, str] = {}
        self.tracker.load()
        self.links.load()
        self._sync_store()

    def _sync_store(self) -> None:
        if self.store is None:
            return
        try:
            self.store.rebuild([row.to_dict() for row in self.tracker.all()])
        except Exception as exc:
            logger.debug("store sync failed: %s", exc)

    def resolve_screenshot(self, filename: str) -> Path | None:
        if not filename:
            return None
        candidates = [
            self.cfg.screenshots_root / filename,
            self.cfg.screenshots_root / "screenshots_latest" / filename,
        ]
        for p in candidates:
            if p.exists():
                return p
        if self.cfg.screenshots_root.is_dir():
            for d in sorted(self.cfg.screenshots_root.iterdir(), reverse=True):
                if d.is_dir() and d.name.startswith("screenshots_"):
                    hit = d / filename
                    if hit.exists():
                        return hit
        return None

    def _loop_state_path(self) -> Path:
        """Resolve the loop state file, checking common locations."""
        # Preferred: loop script writes next to its cwd
        candidate = self.cfg.tracker_path.parent / "loop_feedback" / self.LOOP_STATE_FILENAME
        if candidate.exists():
            return candidate
        # Fallback: legacy location next to the tracker
        return self.cfg.tracker_path.parent / self.LOOP_STATE_FILENAME

    def load_loop_state(self) -> dict:
        path = self._loop_state_path()
        if not path.exists():
            return {"iteration": 0, "processed": [], "failed": [], "history": []}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {"iteration": 0, "processed": [], "failed": [], "history": []}

    def save_loop_state(self, state: dict) -> None:
        path = self._loop_state_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")

    def _record_loop_step(self, issue_id: str, ok: bool, detail: str = "") -> None:
        """Append one AI-resolution attempt to the loop state."""
        path = self._loop_state_path()
        state: dict = {"iteration": 0, "processed": [], "failed": [], "history": []}
        try:
            if path.exists():
                state = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
        state.setdefault("processed", [])
        state.setdefault("failed", [])
        state.setdefault("history", [])
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        rec = {"issue_id": issue_id, "ok": ok, "when": now, "detail": detail}
        if ok:
            state["processed"].append(issue_id)
        else:
            state["failed"].append(issue_id)
        state["history"].append(rec)
        state["processed"] = list(dict.fromkeys(state["processed"]))[:500]
        state["failed"] = list(dict.fromkeys(state["failed"]))[:500]
        state["history"] = state["history"][-200:]
        state["iteration"] = int(state.get("iteration", 0)) + 1
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")



    def _is_sensitive_source_path(self, rel_path: str, project_root: Path) -> bool:
        parts = set(Path(rel_path).parts)
        excluded_parts = {".git", ".venv", "venv", "node_modules", "target", "build", "dist", "logs", "loop_feedback"}
        excluded_names = {".env", ".secrets", "secrets", "credentials", "credential", "config", "configuration"}
        excluded_suffixes = (".env", ".pem", ".key", ".p12", ".pfx", ".db", ".sqlite", ".sqlite3", ".log")
        return bool(
            parts & excluded_parts
            or parts & excluded_names
            or rel_path.endswith(excluded_suffixes)
            or rel_path.startswith(("target/", "node_modules/", ".git/"))
            or str(project_root / rel_path).lower().find("secret") >= 0
            or str(project_root / rel_path).lower().find("credential") >= 0
        )

    def _redact_source_snippet(self, snippet: str) -> str:
        patterns = [
            (r'(?i)\b(api[_-]?key|secret|token|password|passwd|pwd|client_secret|private_key)\b\s*[:=]\s*["\'][^"\']+["\']', r'\1=[REDACTED_SECRET]'),
            (r'(?i)\b(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b', '[REDACTED_SECRET]'),
            (r'(?i)\b(bearer)\s+[A-Za-z0-9._~+/=-]{16,}', r'\1 [REDACTED_TOKEN]'),
            (r'(?i)\b(mongodb\+srv|postgres(?:ql)?|mysql|redis)://[^\s"\']+', '[REDACTED_CONNECTION_STRING]'),
        ]
        redacted = snippet
        for pattern, replacement in patterns:
            redacted = re.sub(pattern, replacement, redacted)
        return redacted

    def _source_path_is_writable(self, rel_path: str) -> bool:
        allowed_suffixes = (".rs", ".toml", ".md", ".json", ".yaml", ".yml", ".py", ".js", ".ts", ".tsx", ".css", ".html", ".sh", ".ps1", ".cmd")
        return rel_path.endswith(allowed_suffixes) or Path(rel_path).name in {"justfile", "AGENTS.md"}

    def _request_patch_confirmation(self, file_path: str, current_code: str, fixed_code: str) -> str:
        token = secrets.token_urlsafe(24)
        payload = json.dumps({
            "file": file_path,
            "current_hash": hashlib.sha256(current_code.encode("utf-8")).hexdigest(),
            "fixed_hash": hashlib.sha256(fixed_code.encode("utf-8")).hexdigest(),
        }, sort_keys=True)
        with self._patch_confirm_lock:
            self._patch_confirmations[token] = {"payload": payload, "expires_at": time.time() + 600}
        return token

    def _consume_patch_confirmation(self, token: str, file_path: str, current_code: str, fixed_code: str) -> bool:
        if not token:
            return False
        expected = json.dumps({
            "file": file_path,
            "current_hash": hashlib.sha256(current_code.encode("utf-8")).hexdigest(),
            "fixed_hash": hashlib.sha256(fixed_code.encode("utf-8")).hexdigest(),
        }, sort_keys=True)
        with self._patch_confirm_lock:
            stored = self._patch_confirmations.pop(token, None)
        if not stored or stored.get("expires_at", 0) < time.time():
            return False
        return stored.get("payload") == expected

    def run_rust_tool(self, tool: str, payload: dict[str, Any]) -> dict:
        """Run Space Analyzer CLI or launch the GUI from the dashboard."""
        if not self._rust_lock.acquire(blocking=False):
            return {"error": "Another Rust tool is already running.", "exit_code": -1}
        try:
            if tool == "cli":
                return self._run_space_analyzer_cli(payload)
            if tool == "gui":
                return self._launch_space_analyzer_gui(payload)
            return {"error": f"Unknown rust tool: {tool}", "exit_code": -1}
        finally:
            self._rust_lock.release()

    def _project_root(self) -> Path:
        return Path(__file__).parent.parent.parent.parent

    def _run_space_analyzer_cli(self, payload: dict[str, Any]) -> dict:
        """Run `cargo run --bin space-analyzer-pro` with a validated target path."""
        repo_root = self._project_root()
        raw_path = (payload.get("path") or ".").strip() or "."
        scan_path = Path(raw_path)
        if not scan_path.is_absolute():
            scan_path = repo_root / scan_path
        try:
            scan_path = scan_path.resolve()
        except OSError as exc:
            return {"stdout": "", "stderr": f"Could not resolve scan path: {exc}", "exit_code": -1}
        if not scan_path.exists():
            return {"stdout": "", "stderr": f"Scan path does not exist: {scan_path}", "exit_code": -1}
        if not scan_path.is_dir():
            return {"stdout": "", "stderr": f"Scan path is not a directory: {scan_path}", "exit_code": -1}

        output_format = (payload.get("format") or "text").strip().lower()
        if output_format not in {"text", "json", "csv"}:
            return {"stdout": "", "stderr": "Invalid format. Use text, json, or csv.", "exit_code": -1}
        try:
            top = int(payload.get("top") or 20)
        except (TypeError, ValueError):
            return {"stdout": "", "stderr": "Invalid top value. Use an integer.", "exit_code": -1}
        if top < 1 or top > 200:
            return {"stdout": "", "stderr": "Invalid top value. Use a number from 1 to 200.", "exit_code": -1}

        cmd = [
            "cargo",
            "run",
            "--quiet",
            "--bin",
            "space-analyzer-pro",
            "--",
            "--path",
            str(scan_path),
            "--format",
            output_format,
            "--top",
            str(top),
        ]
        if payload.get("deep"):
            cmd.append("--deep")
        if payload.get("report"):
            cmd.append("--report")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,
                cwd=str(repo_root),
                encoding="utf-8",
                errors="replace",
            )
            return {
                "stdout": result.stdout[-8000:] if result.stdout else "",
                "stderr": result.stderr[-4000:] if result.stderr else "",
                "exit_code": result.returncode,
                "command": subprocess.list2cmdline(cmd),
            }
        except subprocess.TimeoutExpired:
            return {"stdout": "", "stderr": "Command timed out after 10 minutes.", "exit_code": -1, "command": subprocess.list2cmdline(cmd)}
        except FileNotFoundError:
            return {"stdout": "", "stderr": "Command not found: cargo. Is Rust installed?", "exit_code": -1, "command": subprocess.list2cmdline(cmd)}
        except Exception as exc:
            return {"stdout": "", "stderr": str(exc), "exit_code": -1, "command": subprocess.list2cmdline(cmd)}

    def _launch_space_analyzer_gui(self, payload: dict[str, Any]) -> dict:
        """Launch the GUI binary in the background and return immediately."""
        repo_root = self._project_root()
        allowed_tabs = {"dashboard", "scan", "history", "smart_search", "workflows", "ai_chat", "system", "settings"}
        tab = (payload.get("tab") or "scan").strip().lower()
        if tab not in allowed_tabs:
            tab = "scan"

        cmd = ["cargo", "run", "--quiet", "--bin", "space-analyzer-gui", "--", "--tab", tab]
        log_dir = self.cfg.tracker_path.parent / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "space-analyzer-gui.log"
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        if sys.platform == "win32":
            creationflags |= getattr(subprocess, "DETACHED_PROCESS", 0)
        try:
            log_handle = log_path.open("a", encoding="utf-8", errors="replace")
            proc = subprocess.Popen(
                cmd,
                cwd=str(repo_root),
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                creationflags=creationflags,
            )
        except FileNotFoundError:
            return {"error": "Command not found: cargo. Is Rust installed?", "command": subprocess.list2cmdline(cmd)}
        except Exception as exc:
            return {"error": str(exc), "command": subprocess.list2cmdline(cmd)}
        return {
            "status": "launched",
            "pid": proc.pid,
            "command": subprocess.list2cmdline(cmd),
            "log": str(log_path),
        }

    def run_test(self, tool: str) -> dict:
        """Run a code testing tool and return the output."""
        if not self._test_lock.acquire(blocking=False):
            return {"stdout": "", "stderr": "Another test is already running.", "exit_code": -1}
        try:
            # Cargo commands used directly; removed dead intermediate just list
            cargo_commands = {
            "test": ["cargo", "test", "--workspace", "--exclude", "node_modules_cleaner", "--exclude", "gpu-compute"],
                "clippy": ["cargo", "clippy", "--all-targets", "--all-features", "--", "-D", "warnings"],
                "fmt": ["cargo", "fmt", "--all", "--", "--check"],
                "fmt-fix": ["cargo", "fmt", "--all"],
                "verify": None,  # handled separately
            }
            if tool == "verify":
                # Run fmt-check + clippy + test sequentially
                results = []
                for sub in ["fmt", "clippy", "test"]:
                    r = self._run_cargo(sub)
                    results.append(f"=== {sub.upper()} ===\n{r['stdout']}\n{r['stderr']}")
                    if r["exit_code"] != 0:
                        return {"stdout": "\n\n".join(results), "stderr": "", "exit_code": r["exit_code"]}
                return {"stdout": "\n\n".join(results), "stderr": "", "exit_code": 0}
            else:
                return self._run_cargo(tool)
        finally:
            self._test_lock.release()

    def _run_cargo(self, tool: str) -> dict:
        """Run a single cargo command."""
        cargo_commands = {
            "test": ["cargo", "test", "--workspace", "--exclude", "node_modules_cleaner", "--exclude", "gpu-compute"],
            "clippy": ["cargo", "clippy", "--all-targets", "--all-features", "--", "-D", "warnings"],
            "fmt": ["cargo", "fmt", "--all", "--", "--check"],
            "fmt-fix": ["cargo", "fmt", "--all"],
        }
        cmd = cargo_commands.get(tool)
        if not cmd:
            return {"stdout": "", "stderr": f"Unknown tool: {tool}", "exit_code": -1}
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
                cwd=str(Path(__file__).parent.parent.parent.parent),
                encoding="utf-8",
                errors="replace",
            )
            return {
                "stdout": result.stdout[-8000:] if result.stdout else "",
                "stderr": result.stderr[-4000:] if result.stderr else "",
                "exit_code": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"stdout": "", "stderr": "Command timed out after 5 minutes.", "exit_code": -1}
        except FileNotFoundError:
            return {"stdout": "", "stderr": f"Command not found: {cmd[0]}. Is Rust installed?", "exit_code": -1}
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "exit_code": -1}

    def _find_relevant_files(self, title: str, category: str, notes: str) -> list[tuple[str, str]]:
        """Search the codebase for files relevant to an issue.

        Returns list of (relative_path, content) tuples, capped at ~8KB total.
        """
        project_root = Path(__file__).parent.parent.parent.parent
        src_dir = project_root / "src"
        if not src_dir.is_dir():
            return []

        # Build search keywords from the issue
        keywords = set()
        for word in title.lower().split():
            if len(word) >= 4:
                keywords.add(word)
        for word in (notes or "").lower().split():
            if len(word) >= 5:
                keywords.add(word)
        if not keywords:
            return []

        # Category -> likely file patterns
        cat_hints = {
            "frontend": ["gui/", "app.rs", "dashboard.rs", "ui_"],
            "backend": ["main.rs", "cli.rs", "database/"],
            "security": ["auth", "validation", "sanitize", "security"],
            "performance": ["scan", "optim", "cache", "parallel"],
            "error-handling": ["error", "result", "unwrap", "expect"],
            "architecture": ["lib.rs", "mod.rs", "trait", "impl"],
            "testing": ["test", "spec"],
            "code-quality": ["clippy", "lint", "warn"],
            "database": ["database", "sqlite", "db"],
            "api": ["api", "endpoint", "route", "handler"],
        }
        hints = cat_hints.get(category, [])

        # Search Rust source files
        candidates: list[tuple[int, str, str]] = []  # (score, path, content)
        for rs_file in src_dir.rglob("*.rs"):
            if rs_file.name == "mod.rs":
                continue
            try:
                content = rs_file.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            lower_content = content.lower()
            score = 0
            for kw in keywords:
                if kw in lower_content:
                    score += 2
                if kw in rs_file.name.lower():
                    score += 3
            for hint in hints:
                if hint in str(rs_file.relative_to(project_root)).lower():
                    score += 1
            if score > 0:
                rel = str(rs_file.relative_to(project_root)).replace("\\", "/")
                if self._is_sensitive_source_path(rel, project_root):
                    continue
                safe_content = self._redact_source_snippet(content)
                candidates.append((score, rel, safe_content))

        candidates.sort(key=lambda x: -x[0])

        # Pick top 2 files with content (up to 8KB each, 12KB total)
        result: list[tuple[str, str]] = []
        total = 0
        for _, rel, content in candidates[:2]:
            snippet = content[:8000]
            if total + len(snippet) > 12000:
                break
            result.append((rel, snippet))
            total += len(snippet)
        return result

    def resolve_issue(self, issue_id: str, model: str) -> dict:
        """Send an issue to Ollama for AI resolution with codebase context."""
        self.tracker.load()
        row = self.tracker.get(issue_id)
        if row is None:
            return {"error": f"Issue not found: {issue_id}"}
        started = datetime.now(timezone.utc).isoformat(timespec="seconds")
        row.extra = dict(row.extra or {})
        row.extra.update({
            "ai_status": "processing",
            "ai_model": model,
            "ai_started_at": started,
            "ai_response": "",
            "ai_duration_s": 0,
            "ai_last_error": "",
        })
        self.tracker.upsert(row)
        self.tracker.save()
        self._sync_store()

        # Find relevant source files
        relevant = self._find_relevant_files(row.title, row.category, row.notes or "")

        prompt = (
            "You are a Rust software engineer. Analyze this issue and provide a specific, actionable fix.\n\n"
            f"Issue: {row.title}\n"
            f"Category: {row.category} | Severity: {row.severity}\n"
            f"Notes: {row.notes}\n"
        )
        if relevant:
            prompt += "\nRelevant source files:\n"
            for path, content in relevant:
                prompt += f"\n--- {path} ---\n{content}\n---\n"

        prompt += (
            "CRITICAL RULES:\n"
            "1. For current_code, copy the EXACT text from the source files above character-for-character.\n"
            "2. Do NOT paraphrase, reformat, or add comments. Only change what needs fixing in fixed_code.\n"
            "3. If fixed_code is identical to current_code, you have NOT fixed anything. Set fixed_code to null instead.\n"
            "4. If you cannot identify a concrete code change, set fixed_code to null and explain why in root_cause.\n"
            "5. Do NOT return the same code with trivial changes (e.g., adding a comment, reformatting whitespace).\n\n"
            "Respond with ONLY valid JSON (no markdown, no explanation outside JSON):\n"
            "{\n"
            '  "root_cause": "1-2 sentence diagnosis",\n'
            '  "file": "path/to/file.rs",\n'
            '  "line_range": "start-end or approximate area",\n'
            '  "current_code": "EXACT copy of the problematic code from the source above",\n'
            '  "fixed_code": "the corrected code (only the changed part) OR null if no fix possible",\n'
            '  "explanation": "brief explanation of the change"\n'
            "}\n"
        )

        try:
            response = self.ollama.generate(model, prompt, think=False, options={"temperature": 0.2, "num_predict": 4096})
            duration_s = round((datetime.now(timezone.utc) - datetime.fromisoformat(started)).total_seconds(), 1)
            row.extra.update({
                "ai_status": "done",
                "ai_response": (response or "")[:2000],
                "ai_duration_s": duration_s,
                "ai_last_error": "",
            })
            self.tracker.upsert(row)
            self.tracker.save()
            self._sync_store()
            self._record_loop_step(issue_id, True, (response or "")[:120])
            return {"response": response, "model": model, "issue_id": issue_id, "duration_s": duration_s, "started_at": started}
        except OllamaError as e:
            self.tracker.load()
            row = self.tracker.get(issue_id) or row
            row.extra = dict(row.extra or {})
            row.extra.update({"ai_status": "error", "ai_last_error": str(e)[:300]})
            self.tracker.upsert(row)
            self.tracker.save()
            self._sync_store()
            self._record_loop_step(issue_id, False, str(e)[:120])
            return {"error": f"Ollama error: {e}", "issue_id": issue_id, "started_at": started}
        except Exception as e:
            self.tracker.load()
            row = self.tracker.get(issue_id) or row
            row.extra = dict(row.extra or {})
            row.extra.update({"ai_status": "error", "ai_last_error": str(e)[:300]})
            self.tracker.upsert(row)
            self.tracker.save()
            self._sync_store()
            self._record_loop_step(issue_id, False, str(e)[:120])
            return {"error": str(e), "issue_id": issue_id, "started_at": started}

    _loop_process: subprocess.Popen | None = None

    def start_loop(self, cfg_data: dict) -> dict:
        """Start the improvement loop as a background subprocess."""
        if _DashboardState._loop_process and _DashboardState._loop_process.poll() is None:
            return {"error": "Loop is already running"}
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        script = repo_root / "docs" / "improvement_loop.py"
        if not script.exists():
            return {"error": f"Loop script not found: {script}"}
        cmd = [sys.executable, str(script)]
        if cfg_data.get("model"):
            cmd += ["--model", str(cfg_data["model"])]
        if cfg_data.get("max_iterations"):
            cmd += ["--max-iterations", str(int(cfg_data["max_iterations"]))]
        if cfg_data.get("issues_per_iteration"):
            cmd += ["--issues-per-iteration", str(int(cfg_data["issues_per_iteration"]))]
        if cfg_data.get("category"):
            cmd += ["--category", str(cfg_data["category"])]
        if cfg_data.get("dry_run"):
            cmd.append("--dry-run")
        try:
            proc = subprocess.Popen(cmd, cwd=str(repo_root), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            _DashboardState._loop_process = proc
            ls = self.load_loop_state()
            ls["running"] = True
            ls["started_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            ls["pid"] = proc.pid
            self.save_loop_state(ls)
            import threading
            threading.Thread(target=self._monitor_loop, args=(proc,), daemon=True).start()
            return {"status": "started", "pid": proc.pid}
        except Exception as e:
            return {"error": str(e)}

    def stop_loop(self) -> dict:
        """Stop the running improvement loop subprocess."""
        proc = _DashboardState._loop_process
        if not proc or proc.poll() is not None:
            ls = self.load_loop_state()
            ls["running"] = False
            ls.pop("pid", None)
            self.save_loop_state(ls)
            return {"status": "not_running"}
        try:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        except Exception:
            pass
        _DashboardState._loop_process = None
        ls = self.load_loop_state()
        ls["running"] = False
        ls.pop("pid", None)
        self.save_loop_state(ls)
        return {"status": "stopped"}

    def _monitor_loop(self, proc: subprocess.Popen) -> None:
        """Watch the loop subprocess and update state when it exits."""
        try:
            proc.wait()
        except Exception:
            pass
        _DashboardState._loop_process = None
        ls = self.load_loop_state()
        ls["running"] = False
        ls.pop("pid", None)
        self.save_loop_state(ls)


def _make_handler(state: _DashboardState) -> type[BaseHTTPRequestHandler]:
    """Build a ``BaseHTTPRequestHandler`` subclass bound to ``state``."""

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(format, *args)

        def _write_image(self, path: Path) -> None:
            data = path.read_bytes()
            ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _write_json(self, status: int, payload: Any) -> None:
            body = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _write_html(self, body: str) -> None:
            data = body.encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length", 0))
            return self.rfile.read(length) if length > 0 else b""

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/favicon.ico":
                self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            if path.startswith("/api/screenshot/"):
                filename = urlparse(self.path).path[len("/api/screenshot/"):]
                resolved = state.resolve_screenshot(filename)
                if resolved and resolved.exists():
                    self._write_image(resolved)
                else:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "screenshot not found", "filename": filename})
                return
            if path in ("/", "/index.html"):
                state.tracker.load()
                state._sync_store()
                self._write_html(INDEX_HTML)
                return
            if path == "/api/issues":
                state.tracker.load()
                # Reset any stale "processing" statuses (interrupted requests)
                cleaned = False
                for row in state.tracker.all():
                    if (row.extra or {}).get("ai_status") == "processing":
                        row.extra["ai_status"] = "error"
                        row.extra["ai_last_error"] = "Interrupted - please retry"
                        cleaned = True
                if cleaned:
                    state.tracker.save()
                    state._sync_store()
                rows = [row.to_dict() for row in state.tracker.all()]
                qs = urlparse(self.path).query
                params = dict(parse_qsl(qs))
                if params.get("status"):
                    rows = [r for r in rows if r.get("status") == params["status"]]
                if params.get("category"):
                    rows = [r for r in rows if r.get("category") == params["category"]]
                if params.get("severity"):
                    rows = [r for r in rows if r.get("severity") == params["severity"]]
                if params.get("q"):
                    ql = params["q"].lower()
                    rows = [r for r in rows if ql in r.get("title", "").lower() or ql in r.get("issue_id", "").lower() or ql in r.get("notes", "").lower() or ql in r.get("category", "").lower()]
                self._write_json(HTTPStatus.OK, rows)
                return
            if path == "/api/issues/stats":
                state.tracker.load()
                rows = list(state.tracker.all())
                by_status: dict[str, int] = {}
                by_severity: dict[str, int] = {}
                by_category: dict[str, int] = {}
                for row in rows:
                    by_status[row.status.value] = by_status.get(row.status.value, 0) + 1
                    by_severity[row.severity] = by_severity.get(row.severity, 0) + 1
                    by_category[row.category] = by_category.get(row.category, 0) + 1
                self._write_json(HTTPStatus.OK, {
                    "total": len(rows),
                    "open": by_status.get("open", 0),
                    "in_progress": by_status.get("in_progress", 0),
                    "done": by_status.get("done", 0),
                    "wontfix": by_status.get("wontfix", 0),
                    "by_severity": by_severity,
                    "by_category": by_category,
                })
                return
            if path == "/api/categories":
                state.tracker.load()
                rows = list(state.tracker.all())
                by_cat: dict[str, dict] = {}
                for row in rows:
                    cat = row.category
                    if cat not in by_cat:
                        by_cat[cat] = {"category": cat, "count": 0, "open": 0, "done": 0, "wontfix": 0, "by_severity": {}}
                    by_cat[cat]["count"] += 1
                    st = row.status.value if hasattr(row.status, "value") else str(row.status)
                    if st == "open":
                        by_cat[cat]["open"] += 1
                    elif st == "done":
                        by_cat[cat]["done"] += 1
                    elif st == "wontfix":
                        by_cat[cat]["wontfix"] += 1
                    sev = row.severity
                    by_cat[cat]["by_severity"][sev] = by_cat[cat]["by_severity"].get(sev, 0) + 1
                cats = sorted(by_cat.values(), key=lambda c: -c["count"])
                self._write_json(HTTPStatus.OK, {"categories": cats})
                return
            if path == "/api/search":
                q = urlparse(self.path).query
                params = dict(parse_qsl(q))
                query = params.get("q", "")
                status = params.get("status", "")
                category = params.get("category", "")
                severity = params.get("severity", "")
                limit = int(params.get("limit", "100"))
                state.tracker.load()
                rows = [row.to_dict() for row in state.tracker.all()]
                if status:
                    rows = [r for r in rows if r.get("status") == status]
                if category:
                    rows = [r for r in rows if r.get("category") == category]
                if severity:
                    rows = [r for r in rows if r.get("severity") == severity]
                if query:
                    ql = query.lower()
                    rows = [r for r in rows if ql in r.get("title", "").lower() or ql in r.get("issue_id", "").lower() or ql in r.get("notes", "").lower()]
                rows = rows[:limit]
                self._write_json(HTTPStatus.OK, rows)
                return
            if path == "/api/ollama/models":
                try:
                    models = state.ollama.list_models()
                    self._write_json(HTTPStatus.OK, {"models": models})
                except Exception as e:
                    self._write_json(HTTPStatus.OK, {"models": [], "error": str(e)})
                return
            if path == "/api/quality":
                self._write_json(HTTPStatus.OK, state.history.summary())
                return
            if path == "/api/links":
                self._write_json(HTTPStatus.OK, state.links.all())
                return
            if path == "/api/loop/state":
                self._write_json(HTTPStatus.OK, state.load_loop_state())
                return
            if path == "/api/loop/history":
                loop_state = state.load_loop_state()
                history = loop_state.get("history", [])
                self._write_json(HTTPStatus.OK, history)
                return
            if path == "/api/priority":
                self._write_json(HTTPStatus.OK, state.tracker.list_priority())
                return
            self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found", "path": path})

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            parts = [p for p in path.split("/") if p]
            # POST /api/issues/create
            if path == "/api/issues/create" or (len(parts) >= 3 and parts[0] == "api" and parts[1] == "issues" and parts[2] == "create"):
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "invalid JSON"})
                    return
                title = (data.get("title") or "").strip()
                if not title:
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "title is required"})
                    return
                category = (data.get("category") or "functionality").strip()
                severity = (data.get("severity") or "medium").strip()
                notes = (data.get("notes") or "").strip()
                screenshot = (data.get("screenshot") or "").strip() or None
                issue_id = make_issue_id(category, title, screenshot)
                row = IssueRow(
                    issue_id=issue_id, title=title, category=category,
                    severity=severity, status=IssueStatus.OPEN,
                    screenshot=screenshot, notes=notes,
                )
                state.tracker.load()
                state.tracker.upsert(row)
                state.tracker.save()
                state._sync_store()
                self._write_json(HTTPStatus.CREATED, {"issue_id": issue_id, "status": "open"})
                return
            # POST /api/issues/<id>/resolve — AI resolution
            if len(parts) >= 4 and parts[0] == "api" and parts[1] == "issues" and parts[3] == "resolve":
                issue_id = unquote("/".join(parts[2:-1]))
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                model = (data.get("model") or "qwen3:8b").strip()
                result = state.resolve_issue(issue_id, model)
                if "error" in result:
                    self._write_json(HTTPStatus.BAD_REQUEST, result)
                else:
                    self._write_json(HTTPStatus.OK, result)
                return
            # POST /api/rust/run — run Space Analyzer CLI or launch the GUI
            if path == "/api/rust/run":
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                tool = (data.get("tool") or "cli").strip()
                if tool not in ("cli", "gui"):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": f"Unknown rust tool: {tool}. Use cli or gui."})
                    return
                result = state.run_rust_tool(tool, data)
                if "error" in result:
                    self._write_json(HTTPStatus.BAD_REQUEST, result)
                else:
                    self._write_json(HTTPStatus.OK, result)
                return
            # POST /api/test/run — run code testing tools
            if path == "/api/test/run":
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                tool = (data.get("tool") or "test").strip()
                if tool not in ("test", "clippy", "fmt", "fmt-fix", "verify"):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": f"Unknown tool: {tool}. Use test, clippy, fmt, or verify."})
                    return
                result = state.run_test(tool)
                self._write_json(HTTPStatus.OK, result)
                return
            # POST /api/issues/<id>/<action> — mark status
            if len(parts) >= 3 and parts[0] == "api" and parts[1] == "issues":
                action_part = parts[-1]
                if action_part == "done":
                    status = IssueStatus.DONE
                elif action_part == "wontfix":
                    status = IssueStatus.WONTFIX
                elif action_part == "open":
                    status = IssueStatus.OPEN
                elif action_part == "in_progress":
                    status = IssueStatus.IN_PROGRESS
                elif action_part == "blocked":
                    status = IssueStatus.BLOCKED
                elif action_part == "pending":
                    status = IssueStatus.PENDING
                else:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "unknown action", "path": path})
                    return
                issue_id = unquote("/".join(parts[2:-1]))
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                state.tracker.load()
                row = state.tracker.get(issue_id)
                if row is None:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "no such issue", "issue_id": issue_id})
                    return
                if status == IssueStatus.WONTFIX:
                    row.extra = dict(row.extra or {})
                    reason = (data.get("reason") or "").strip()
                    if reason:
                        row.extra["wontfix_reason"] = reason
                    row.extra["wontfix_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                    state.tracker.upsert(row)
                ok = state.tracker.mark_status(issue_id, status)
                state.tracker.save()
                state._sync_store()
                self._write_json(HTTPStatus.OK, {"issue_id": issue_id, "status": status.value})
                return
            if path.startswith("/api/priority/") and path.endswith("/rank"):
                issue_id = unquote(path.split("/")[3])
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                rank = int(data.get("priority_rank") or 0)
                note = (data.get("priority_note") or "").strip()
                state.tracker.load()
                ok = state.tracker.set_priority(issue_id, rank, note)
                if not ok:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "no such issue", "issue_id": issue_id})
                    return
                state.tracker.save()
                state._sync_store()
                self._write_json(HTTPStatus.OK, {"issue_id": issue_id, "priority_rank": rank, "priority_note": note})
                return
            if path == "/api/apply-fix/confirm":
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "invalid JSON"})
                    return
                file_path = (data.get("file") or "").strip()
                current_code = data.get("current_code") or ""
                fixed_code = data.get("fixed_code") or ""
                if not file_path or not current_code or not fixed_code:
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "file, current_code, and fixed_code are required"})
                    return
                if not state._source_path_is_writable(file_path):
                    self._write_json(HTTPStatus.FORBIDDEN, {"error": "file type is not writable through the dashboard"})
                    return
                project_root = Path(__file__).parent.parent.parent.parent
                target = (project_root / file_path).resolve()
                if not str(target).startswith(str(project_root.resolve())):
                    self._write_json(HTTPStatus.FORBIDDEN, {"error": "path escapes project root"})
                    return
                if not target.exists():
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": f"file not found: {file_path}"})
                    return
                try:
                    content = target.read_text(encoding="utf-8", errors="replace")
                except OSError as e:
                    self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"read failed: {e}"})
                    return
                if current_code not in content:
                    self._write_json(HTTPStatus.CONFLICT, {"error": "current_code not found in file — code may have changed"})
                    return
                patch_token = state._request_patch_confirmation(file_path, current_code, fixed_code)
                self._write_json(HTTPStatus.OK, {"patch_token": patch_token, "file": file_path})
                return
            if path == "/api/apply-fix":
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "invalid JSON"})
                    return
                file_path = (data.get("file") or "").strip()
                current_code = data.get("current_code") or ""
                fixed_code = data.get("fixed_code") or ""
                patch_token = (data.get("patch_token") or "").strip()
                if not file_path or not current_code or not fixed_code:
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "file, current_code, and fixed_code are required"})
                    return
                if not self._source_path_is_writable(file_path):
                    self._write_json(HTTPStatus.FORBIDDEN, {"error": "file type is not writable through the dashboard"})
                    return
                # Resolve relative to project root
                project_root = Path(__file__).parent.parent.parent.parent
                target = (project_root / file_path).resolve()
                if not str(target).startswith(str(project_root.resolve())):
                    self._write_json(HTTPStatus.FORBIDDEN, {"error": "path escapes project root"})
                    return
                if not target.exists():
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": f"file not found: {file_path}"})
                    return
                if not self._consume_patch_confirmation(patch_token, file_path, current_code, fixed_code):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "patch confirmation is missing or does not match this file/content"})
                    return
                try:
                    content = target.read_text(encoding="utf-8", errors="replace")
                except OSError as e:
                    self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"read failed: {e}"})
                    return
                # Try exact match first, then line-trimmed fallback
                new_content = None
                if current_code in content:
                    new_content = content.replace(current_code, fixed_code, 1)
                else:
                    def _norm_lines(s):
                        return [l.strip() for l in s.splitlines()]
                    content_lines = content.splitlines()
                    code_lines = current_code.splitlines()
                    code_norm = _norm_lines(current_code)
                    for i in range(len(content_lines) - len(code_lines) + 1):
                        if all(content_lines[i + j].strip() == code_norm[j] for j in range(len(code_lines))):
                            fixed_lines = fixed_code.splitlines()
                            content_lines[i:i + len(code_lines)] = fixed_lines
                            new_content = "\n".join(content_lines)
                            break
                if new_content is None:
                    self._write_json(HTTPStatus.CONFLICT, {"error": "current_code not found in file — code may have changed"})
                    return
                # Backup then write
                backup = target.with_suffix(target.suffix + ".bak")
                try:
                    backup.write_text(content, encoding="utf-8")
                except OSError:
                    pass
                try:
                    target.write_text(new_content, encoding="utf-8")
                except OSError as e:
                    self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"write failed: {e}"})
                    return
                self._write_json(HTTPStatus.OK, {"status": "applied", "file": file_path, "backup": str(backup.name), "patch_token": patch_token})
                return
            if path == "/api/loop/reset":
                state.save_loop_state({"iteration": 0, "processed": [], "failed": [], "history": []})
                self._write_json(HTTPStatus.OK, {"status": "reset"})
                return
            if path == "/api/loop/clear-history":
                ls = state.load_loop_state()
                ls["history"] = []
                state.save_loop_state(ls)
                self._write_json(HTTPStatus.OK, {"status": "cleared"})
                return
            if path == "/api/loop/start":
                try:
                    body = self._read_body()
                    cfg_data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": "invalid JSON"})
                    return
                result = state.start_loop(cfg_data)
                self._write_json(HTTPStatus.OK, result)
                return
            if path == "/api/loop/stop":
                result = state.stop_loop()
                self._write_json(HTTPStatus.OK, result)
                return
            self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found", "path": path})

    Handler.__name__ = "UxPipelineDashboardHandler"
    return Handler


def serve(
    host: str = "127.0.0.1",
    port: int = 8765,
    cfg: PipelineConfig | None = None,
) -> None:
    """Start the dashboard server and block forever."""
    effective_cfg = cfg or load_config()
    state = _DashboardState(effective_cfg)
    handler = _make_handler(state)
    server = ThreadingHTTPServer((host, port), handler)
    print(f"UX pipeline dashboard listening on http://{host}:{port}", flush=True)
    print(f"  tracker:  {effective_cfg.tracker_path}", flush=True)
    print(f"  history:  {effective_cfg.quality_history_path}", flush=True)
    print(f"  ollama:   {state.ollama.host}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down…", flush=True)
    finally:
        server.server_close()


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ux-pipeline-dashboard",
        description="Localhost dashboard for the ux-pipeline tracker.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="TCP port (default 8765)")
    parser.add_argument("--tracker", default=None, help="Path to the issue tracker JSON")
    parser.add_argument("--history", default=None, help="Path to the quality history JSONL")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return parser


def main(argv: list[str] | None = None) -> int:
    """Entry point for the dashboard CLI."""
    args = _build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    cfg = load_config()
    if args.tracker:
        cfg.tracker_path = Path(args.tracker)
    if args.history:
        cfg.quality_history_path = Path(args.history)
    serve(host=args.host, port=args.port, cfg=cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main())

