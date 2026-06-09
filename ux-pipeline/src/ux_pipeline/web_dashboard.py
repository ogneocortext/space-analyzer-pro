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
* ``POST /api/loop/reset`` — reset loop state for a fresh run
"""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
import threading
import time
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
.cat-list { max-height: 280px; overflow-y: auto; }
.cat-item { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; border-bottom: 1px solid var(--border); font-size: 0.8rem; cursor: pointer; }
.cat-item:hover { color: var(--accent); }
.cat-item:last-child { border-bottom: none; }
.cat-item .cat-count { color: var(--muted); font-size: 0.75rem; }

/* === CHARTS === */
.charts-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
@media (max-width: 1100px) { .charts-grid { grid-template-columns: 1fr; } }
.chart-box { position: relative; width: 100%; }
.chart-box.timeline { height: 180px; }
.chart-box.severity { height: 180px; }
.chart-box.category { height: 240px; }

/* === ISSUE GRID === */
.issue-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 0.6rem; }
@media (max-width: 800px) { .issue-grid { grid-template-columns: 1fr; } }

/* === ISSUE CARD === */
.issue-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.4rem; transition: border-color 0.15s; cursor: pointer; }
.issue-card:hover { border-color: var(--accent); }
.issue-head { display: flex; justify-content: space-between; gap: 0.5rem; align-items: flex-start; }
.issue-title { font-size: 0.9rem; font-weight: 600; line-height: 1.3; }
.issue-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.7rem; color: #a5b4fc; word-break: break-all; opacity: 0.7; }
.badge { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.12rem 0.4rem; border-radius: 6px; border: 1px solid var(--border); white-space: nowrap; font-weight: 600; }
.badge.status-open { color: var(--warn); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.08); }
.badge.status-in_progress { color: var(--info); border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.08); }
.badge.status-done { color: var(--ok); border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.08); }
.badge.status-wontfix { color: var(--muted); border-color: rgba(122,125,138,0.3); background: rgba(122,125,138,0.08); }
.badge.sev-critical { color: var(--danger); border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.08); }
.badge.sev-high { color: var(--warn); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.08); }
.badge.sev-medium { color: #fcd34d; }
.badge.sev-low { color: var(--ok); }
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
.history { max-height: 120px; overflow-y: auto; }
.history-item { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem; padding: 0.25rem 0; border-bottom: 1px solid var(--border); font-size: 0.78rem; align-items: center; }
.history-item:last-child { border-bottom: none; }
.h-status { font-weight: 600; }
.h-status.completed { color: var(--ok); } .h-status.partial { color: var(--warn); } .h-status.failed { color: var(--danger); }
.h-meta { color: var(--muted); font-size: 0.7rem; }

/* === TEST RUNNER === */
.test-runner { display: flex; flex-direction: column; gap: 0.4rem; }
.test-btns { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.test-output { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.72rem; line-height: 1.4; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; color: #a0a0b0; min-height: 40px; }
.test-output.success { color: var(--ok); }
.test-output.error { color: var(--danger); }

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
          <button class="btn btn-sm btn-ok" data-test="verify" title="Run full verify (fmt+clippy+test)">&#x2714; Verify</button>
        </div>
        <div class="test-output" id="test-output">Click a button to run tests...</div>
      </div>
    </div>
    <div class="panel loop-section">
      <h2>Loop Status</h2>
      <div id="loop-status" class="loop-state"><span class="empty">Loading...</span></div>
      <div id="loop-history" class="history"></div>
      <div style="margin-top:0.4rem;"><button class="btn btn-sm" id="btn-reset-loop">Reset</button></div>
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
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"'); }

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
function renderMetrics(stats) {
  document.getElementById('metrics').innerHTML = [
    { label: 'Total', value: stats.total ?? '?', cls: 'info' },
    { label: 'Open', value: stats.open ?? '?', cls: 'warn' },
    { label: 'In Progress', value: stats.in_progress ?? '?', cls: 'info' },
    { label: 'Done', value: stats.done ?? '?', cls: 'ok' },
    { label: 'Wontfix', value: stats.wontfix ?? '?', cls: '' },
  ].map(c => '<div class="metric ' + c.cls + '"><b>' + c.value + '</b>' + c.label + '</div>').join('');
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
function renderCategories(data, currentFilter) {
  const cats = data.categories || [];
  const el = document.getElementById('cat-list');
  el.innerHTML = cats.map(c =>
    '<div class="cat-item' + (currentFilter === c.category ? ' style="color:var(--accent);font-weight:600;"' : '') + '" data-cat="' + esc(c.category) + '">' +
    '<span>' + esc(c.category) + '</span><span class="cat-count">' + c.count + '</span></div>'
  ).join('');
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

/* === LOOP STATE === */
function renderLoop(state, history) {
  const done = (state.processed || []).length;
  const failed = (state.failed || []).length;
  const iter = state.iteration || 0;
  document.getElementById('loop-status').innerHTML =
    '<span class="pill">Iter: ' + iter + '</span>' +
    '<span class="pill" style="color:var(--ok)">OK: ' + done + '</span>' +
    '<span class="pill" style="color:var(--danger)">Fail: ' + failed + '</span>';
  const el = document.getElementById('loop-history');
  if (!history || !history.length) { el.innerHTML = '<span class="empty">No iterations yet.</span>'; return; }
  el.innerHTML = history.slice(-10).reverse().map(it => {
    const when = new Date((it.ended_at || it.started_at || '')).toLocaleString();
    const cls = it.status === 'completed' ? 'completed' : (it.status === 'failed' ? 'failed' : 'partial');
    const parts = ['Iter ' + it.iteration];
    if (it.model) parts.push(it.model);
    if (it.processed_count) parts.push(it.processed_count + ' fixed');
    if (it.failed_count) parts.push(it.failed_count + ' fail');
    return '<div class="history-item"><span><span class="h-status ' + cls + '">' + esc(it.status) + '</span> ' + esc(parts.join(', ')) + '</span><span class="h-meta">' + esc(when) + '</span></div>';
  }).join('');
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
async function resolveWithAI(issueId, model, btn) {
  const modelSel = document.getElementById('model-select');
  const selectedModel = model || modelSel.value;
  if (!selectedModel) { alert('Please select an Ollama model first.'); return; }
  btn.disabled = true;
  const origText = btn.textContent;
  btn.innerHTML = '<span class="ai-spinner active"></span> Resolving...';
  try {
    const res = await fetch(API('/issues/' + encodeURIComponent(issueId) + '/resolve'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = origText;
    return data;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = origText;
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
        '<button class="btn btn-sm btn-accent" data-action="ai-resolve" title="Send to AI for resolution">&#x1f916; AI Fix</button>';
    } else if (row.status === 'done') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>';
    } else if (row.status === 'wontfix') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>' +
        '<button class="btn btn-sm btn-ok" data-action="done" title="Mark done">&#10003; Done</button>';
    }

    card.innerHTML =
      '<div class="issue-head"><div style="flex:1;min-width:0;">' +
        '<div class="issue-title">' + esc((row.title || '').slice(0, 120)) + '</div>' +
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
      if (action === 'ai-resolve') {
        const result = await resolveWithAI(row.issue_id, null, btn);
        if (result && result.response) {
          openModal(row, linksByIssue, result.response);
        } else if (result && result.error) {
          alert('AI Error: ' + result.error);
        }
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
      if (e.target.closest('.card-actions') || e.target.closest('button')) return;
      openModal(JSON.parse(card.dataset.row || '{}'), linksByIssue);
    });
  });
}

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
  return { total: rows.length, open: by_status.open || 0, in_progress: by_status.in_progress || 0, done: by_status.done || 0, wontfix: by_status.wontfix || 0, by_severity, by_category };
}

/* === MAIN REFRESH === */
let _allIssues = [];
let _filteredIssues = [];
async function refresh() {
  try {
    const [allIssues, filteredIssues, quality, loopState, loopHistory, categories, linksRaw] = await Promise.all([
      loadJSON(API('/issues')).catch(() => []),
      buildIssuesUrl(),
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
    renderLoop(loopState, loopHistory);
    const sorted = sortIssues(filteredIssues);
    document.getElementById('issue-count').textContent = sorted.length;
    document.getElementById('result-count').textContent = sorted.length + ' of ' + allIssues.length + ' total';
    renderIssues(sorted, linksByIssue);
    renderCharts(allIssues);
  } catch (err) {
    console.error('Refresh failed:', err);
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
    if (r.status === 'open' || r.status === 'in_progress') days[d].opened += 1;
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
  if (window._cT) window._cT.destroy();
  window._cT = new Chart(ctxT, { type:'line', data:{ labels:timeline.labels, datasets:[
    { label:'Opened', data:timeline.opened, borderColor:'rgba(251,191,36,1)', backgroundColor:'rgba(251,191,36,0.1)', fill:true, tension:0.3, pointRadius:2 },
    { label:'Closed', data:timeline.closed, borderColor:'rgba(74,222,128,1)', backgroundColor:'rgba(74,222,128,0.1)', fill:true, tension:0.3, pointRadius:2 }
  ]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e8e8ed',boxWidth:10,font:{size:10}}}}, scales:{ x:{ticks:{color:'#7a7d8a',maxTicksLimit:6,font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'}}, y:{ticks:{color:'#7a7d8a',stepSize:1,font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'},beginAtZero:true} } } });
  const ctxS = document.getElementById('chart-severity');
  if (window._cS) window._cS.destroy();
  window._cS = new Chart(ctxS, { type:'doughnut', data:{ labels:sevLabels, datasets:[{ data:sevLabels.map(l=>sevCounts[l]), backgroundColor:sevLabels.map(l=>sevColors[l]||'rgba(122,125,138,0.8)'), borderColor:'rgba(26,29,39,1)', borderWidth:2 }]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right',labels:{color:'#e8e8ed',boxWidth:8,font:{size:10},padding:6}}} } });
  const ctxC = document.getElementById('chart-category');
  if (window._cC) window._cC.destroy();
  window._cC = new Chart(ctxC, { type:'bar', data:{ labels:catLabels, datasets:[{ label:'Issues', data:catData, backgroundColor:catColors.slice(0,catLabels.length), borderColor:'rgba(26,29,39,1)', borderWidth:1 }]}, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#7a7d8a',stepSize:1,font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'},beginAtZero:true}, y:{ticks:{color:'#e8e8ed',font:{size:9}},grid:{display:false}} } } });
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
  const aiHtml = aiResponse ?
    '<div class="ai-panel visible"><div class="ai-header"><h3>&#x1f916; AI Resolution</h3></div><div class="ai-response">' + esc(aiResponse) + '</div></div>' : '';
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
      ((row.status === 'open' || row.status === 'in_progress') ?
        '<button class="btn btn-ok" data-action="done">Mark Done</button>' +
        (row.status === 'open' ? '<button class="btn btn-info" data-action="in_progress">Set In Progress</button>' : '') +
        '<button class="btn" data-action="wontfix">Won\'t Fix</button>' +
        '<button class="btn btn-accent" data-action="ai-resolve">&#x1f916; AI Fix</button>' : '') +
      (row.status === 'done' ? '<button class="btn" data-action="open">Reopen</button>' : '') +
      (row.status === 'wontfix' ? '<button class="btn" data-action="open">Reopen</button><button class="btn btn-ok" data-action="done">Mark Done</button>' : '') +
    '</div>' +
    '<div class="ai-panel" id="modal-ai-panel"><div class="ai-header"><h3>&#x1f916; AI Resolution</h3><span class="ai-spinner" id="modal-ai-spinner"></span></div><div class="ai-response" id="modal-ai-response" style="display:none;"></div></div>';
  bb.style.display = 'flex';
  /* Show AI response if provided */
  if (aiResponse) {
    const aiEl = body.querySelector('#modal-ai-response');
    if (aiEl) { aiEl.textContent = aiResponse; aiEl.style.display = 'block'; aiEl.closest('.ai-panel').classList.add('visible'); }
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
          aiResp.textContent = result.response;
          aiResp.style.display = 'block';
          aiPanel.classList.add('visible');
        } else if (result && result.error) {
          aiResp.textContent = 'Error: ' + result.error;
          aiResp.style.display = 'block';
          aiResp.classList.add('error');
          aiPanel.classList.add('visible');
        }
        return;
      }
      btn.disabled = true;
      await fetch('/api/issues/' + encodeURIComponent(row.issue_id) + '/' + action, { method: 'POST' });
      closeModal();
      refresh();
    });
  });
}
function closeModal() { document.getElementById('modal-backdrop').style.display = 'none'; }

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
    const models = data.models || [];
    if (!models.length) { sel.innerHTML = '<option value="">No models found</option>'; return; }
    sel.innerHTML = models.map(m => '<option value="' + esc(m.name) + '">' + esc(m.name) + '</option>').join('');
  } catch (e) {
    document.getElementById('model-select').innerHTML = '<option value="">Ollama unavailable</option>';
  }
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
document.getElementById('btn-reset-loop').addEventListener('click', async () => { if (!confirm('Reset loop state?')) return; await fetch(API('/loop/reset'), { method: 'POST' }); refresh(); });
document.getElementById('btn-add-toggle').addEventListener('click', () => { const f = document.getElementById('add-form'); f.classList.toggle('visible'); if (f.classList.contains('visible')) document.getElementById('new-title').focus(); });
document.getElementById('btn-add-cancel').addEventListener('click', () => { document.getElementById('add-form').classList.remove('visible'); });
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
document.getElementById('search-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') refresh(); });

refresh();
loadModels();
setupTestRunner();
setInterval(refresh, 10000);
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
        self.ollama: OllamaClient = OllamaClient()
        self._test_lock = threading.Lock()
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
        path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")

    def run_test(self, tool: str) -> dict:
        """Run a code testing tool and return the output."""
        if not self._test_lock.acquire(blocking=False):
            return {"stdout": "", "stderr": "Another test is already running.", "exit_code": -1}
        try:
            commands = {
                "test": [sys.executable, "-m", "just", "test"],
                "clippy": [sys.executable, "-m", "just", "clippy"],
                "fmt": [sys.executable, "-m", "just", "fmt-check"],
                "verify": [sys.executable, "-m", "just", "verify"],
            }
            # Try direct cargo commands as fallback
            cargo_commands = {
                "test": ["cargo", "test", "--workspace"],
                "clippy": ["cargo", "clippy", "--all-targets", "--all-features", "--", "-D", "warnings"],
                "fmt": ["cargo", "fmt", "--all", "--", "--check"],
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
            "test": ["cargo", "test", "--workspace"],
            "clippy": ["cargo", "clippy", "--all-targets", "--all-features", "--", "-D", "warnings"],
            "fmt": ["cargo", "fmt", "--all", "--", "--check"],
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

    def resolve_issue(self, issue_id: str, model: str) -> dict:
        """Send an issue to Ollama for AI resolution."""
        self.tracker.load()
        row = self.tracker.get(issue_id)
        if row is None:
            return {"error": f"Issue not found: {issue_id}"}
        prompt = (
            f"You are a software engineering assistant. Analyze this issue and provide a detailed fix.\n\n"
            f"Issue: {row.title}\n"
            f"Category: {row.category}\n"
            f"Severity: {row.severity}\n"
            f"Notes: {row.notes}\n"
            f"First seen: {row.first_seen}\n"
            f"Last seen: {row.last_seen}\n"
            f"Occurrences: {row.occurrences}\n"
        )
        if row.extra:
            prompt += f"Extra info: {json.dumps(row.extra, indent=2)}\n"
        prompt += (
            "\nPlease provide:\n"
            "1. Root cause analysis\n"
            "2. Step-by-step fix instructions\n"
            "3. Code changes needed (if applicable)\n"
            "4. Testing steps to verify the fix\n"
        )
        try:
            response = self.ollama.generate(model, prompt, options={"temperature": 0.3, "num_predict": 2048})
            return {"response": response, "model": model, "issue_id": issue_id}
        except OllamaError as e:
            return {"error": f"Ollama error: {e}"}
        except Exception as e:
            return {"error": str(e)}


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
                by_cat: dict[str, int] = {}
                for row in rows:
                    by_cat[row.category] = by_cat.get(row.category, 0) + 1
                cats = [{"category": k, "count": v} for k, v in sorted(by_cat.items())]
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
                issue_id = "/".join(parts[2:-1])
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                model = (data.get("model") or "llama3").strip()
                result = state.resolve_issue(issue_id, model)
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
                if tool not in ("test", "clippy", "fmt", "verify"):
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
                else:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "unknown action", "path": path})
                    return
                issue_id = "/".join(parts[2:-1])
                state.tracker.load()
                ok = state.tracker.mark_status(issue_id, status)
                if not ok:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "no such issue", "issue_id": issue_id})
                    return
                state.tracker.save()
                state._sync_store()
                self._write_json(HTTPStatus.OK, {"issue_id": issue_id, "status": status.value})
                return
            if path == "/api/loop/reset":
                state.save_loop_state({"iteration": 0, "processed": [], "failed": [], "history": []})
                self._write_json(HTTPStatus.OK, {"status": "reset"})
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