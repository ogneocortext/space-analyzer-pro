
const PHASE_ORDER = ["features", "vision", "analysis", "summary", "code", "done"];
let startedAt = null;
// Frozen elapsed (ms) captured the moment a run ends, so the Elapsed · ETA
// header stops ticking for a finished/stopped session instead of counting up forever.
let frozenElapsed = null;
let lastKey = null;
let lastPersona = null;
let lastPreviewKey = null;
let outputCleared = false;
let ratePrev = null;

function fmtElapsed(ms) {
  if (ms == null) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  return m + "m " + (s % 60) + "s";
}

function fmtStarted(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Render the run log tail as colour-coded lines instead of one flat block.
function renderLogLines(tail) {
  if (!tail) return "";
  return tail.split("\n").map(line => {
    const lv = /\[(ERROR|ERR)\]/.test(line) ? "err"
      : /\[(WARN|WARNING)\]/.test(line) ? "warn"
      : /\[(DEBUG)\]/.test(line) ? "debug"
      : /\[INFO\]/.test(line) ? "info" : "";
    return `<div class="run-line ${lv}">${escapeHtml(line)}</div>`;
  }).join("");
}

function setStatus(s) {
  const el = document.getElementById("status");
  el.className = "badge " + s;
  el.textContent = s;
}

function renderRunMessage(d) {
  const msgEl = document.getElementById("msg");
  if (d.status === "error") {
    const body = d.message || "Analysis failed";
    msgEl.innerHTML = escapeHtml(body)
      + ' · <a href="/api/run-log" target="_blank" rel="noopener">view run log &rarr;</a>';
    return;
  }
  if (d.status === "running") {
    const parts = [];
    if (d.phase) parts.push(d.phase.charAt(0).toUpperCase() + d.phase.slice(1));
    if (d.model) parts.push(d.model);
    const done = (d.features_done || 0) + (d.vision_done || 0) + (d.analysis_done || 0);
    const total3 = (d.total || 0) * 3;
    if (total3) parts.push(done + "/" + total3 + " steps");
    if (d.current) parts.push("on " + d.current);
    msgEl.textContent = parts.join(" · ");
    return;
  }
  if (d.status === "stopped") {
    msgEl.textContent = d.message || "Analysis stopped.";
    return;
  }
  msgEl.textContent = d.message || "";
}

function setTileState(st) {
  const cls = st === "running" ? "running"
    : (st === "done" || st === "stopped") ? "done"
    : (st === "error") ? "error" : "";
  ["st-model", "st-phase", "st-prog", "st-msg"].forEach(id => {
    const e = document.getElementById(id);
    e.classList.remove("running", "done", "error");
    if (cls) e.classList.add(cls);
  });
}

function tweenNumber(el, to, suffix) {
  suffix = suffix || "";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (to == null || reduce) {
    el.textContent = (to == null ? "—" : to + suffix);
    el.dataset.val = (to == null ? "" : to);
    return;
  }
  // Derive 'from' from the displayed text rather than dataset.val, so a
  // mid-animation value from a previous interrupted tween doesn't cause the
  // next tween to start from the wrong point.
  const displayed = parseFloat((el.textContent || "").replace(/[^0-9.\-]/g, "")) || 0;
  const from = displayed;
  if (!isNaN(to) && from !== to) {
    const dur = 500, start = performance.now();
    el.dataset.val = to;
    (function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased) + suffix;
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  } else {
    el.textContent = (to == null ? "—" : to + suffix);
    el.dataset.val = (to == null ? "" : to);
  }
}

function setKpis(status, pct, shotsTotal) {
  const map = { running: "running", done: "done", stopped: "done", error: "error", idle: "idle" };
  const cls = map[status] || "idle";
  document.getElementById("kpi-status-card").className = "kpi " + cls;
  document.getElementById("kpi-status").textContent = status;
  document.getElementById("kpi-progress-card").className = "kpi " + cls;
  // For terminal states (done/error/stopped) set the final value immediately
  // so there is never a stale intermediate value visible after the run ends.
  if (status === "done" || status === "error" || status === "stopped") {
    var pe = document.getElementById("kpi-progress");
    pe.textContent = (pct == null ? "—" : pct + "%");
    pe.dataset.val = (pct == null ? "" : pct);
    if (shotsTotal != null) {
      var se = document.getElementById("kpi-shots");
      se.textContent = shotsTotal;
      se.dataset.val = shotsTotal;
    }
  } else {
    tweenNumber(document.getElementById("kpi-progress"), pct, "%");
    if (shotsTotal != null) tweenNumber(document.getElementById("kpi-shots"), shotsTotal, "");
  }
}

function renderPhases(phase, prog) {
  const wrap = document.getElementById("phases");
  const cur = PHASE_ORDER.indexOf(phase);
  const pct = (name) => {
    if (name === "features") return Math.round(((prog.features_done || 0) / (prog.total || 1)) * 100);
    if (name === "vision") return Math.round(((prog.vision_done || 0) / (prog.total || 1)) * 100);
      if (name === "analysis") { const at = prog.analysis_total || prog.total || 1; return Math.round(((prog.analysis_done || 0) / at) * 100); }
    return cur >= PHASE_ORDER.indexOf(name) ? 100 : 0;
  };
  wrap.innerHTML = PHASE_ORDER.map((p, i) => {
    const cls = i === cur ? "active" : (i < cur ? "past" : "");
    const p2 = pct(p);
    const indet = (i === cur && p !== "done") ? "indet" : "";
    return `<span class="phase ${cls}"><span class="plabel">${p}</span>`
      + `<span class="phasebar"><i class="${indet}" style="width:${p2}%"></i></span>`
      + `<span class="ppct">${p2}%</span></span>`;
  }).join("");
}

// Jump from an issue to the exact screen that triggered it. If the live run's
// shot list already has this key we highlight it in place; otherwise we open the
// captured PNG directly (served by /api/shot, which rglobs the capture root).
function gotoShot(key) {
  const li = document.getElementById("shot-" + key);
  if (li) {
    switchSideTab("shots");
    li.scrollIntoView({ block: "center" });
    li.classList.add("flash");
    setTimeout(() => li.classList.remove("flash"), 1400);
    return;
  }
  window.open("/api/shot?key=" + encodeURIComponent(key), "_blank");
}

function renderShots(shots, currentKey) {
  const ul = document.getElementById("shots");
  if (!shots || !Object.keys(shots).length) {
    ul.innerHTML = `<li class="shot-sub">no screenshots yet</li>`;
    return;
  }
  ul.innerHTML = Object.entries(shots).map(([k, v]) => {
    const st = v.status || "pending";
    const rowcls = (k === currentKey) ? " active-row" : "";
    const pv = previewMap[k] || {};
    let cards = "";
    if (pv.vision_html) cards += `<div class="shot-card">${pv.vision_html}</div>`;
    if (pv.analysis_html) cards += `<div class="shot-card ap-card">${pv.analysis_html}</div>`;
    return `<li id="shot-${escapeHtml(k)}" class="${rowcls.trim()}">
      <span class="dot ${st}"></span>
      <div>
        <div class="shot-name">${escapeHtml(v.label || k)}</div>
        <div class="shot-sub">${st}</div>
        ${cards}
      </div>
    </li>`;
  }).join("");
}

// Friendly previews for every shot are fetched once (in a batch) and refreshed
// only when the set of available previews changes — not on every 1s poll.
let previewMap = {};
let previewSig = "";
async function maybeLoadPreviews(d) {
  const shots = d.shots || {};
  const keys = Object.keys(shots).filter(k => (shots[k].vision_preview || shots[k].analysis_preview));
  const sig = keys.map(k =>
    k + ":" + (shots[k].vision_preview || "").length + ":" + (shots[k].analysis_preview || "").length
  ).join("|");
  if (sig === previewSig) return;
  previewSig = sig;
  try {
    const r = await fetch("/api/shot-previews", { cache: "no-store" });
    if (r.ok) previewMap = await r.json();
  } catch (e) { previewMap = {}; }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

async function loadReport() {
  // Render the rich HTML report inline (best presentation) via an iframe,
  // and keep the "Open in new tab" link as an escape hatch. The previous
  // HEAD-then-JSON fallback rendered raw model JSON as plain text, which read
  // as a broken report; the iframe always loads the full HTML page.
  const body = document.getElementById("report-body");
  const frame = document.getElementById("report-frame");
  const btn = document.getElementById("load-report");
  const show = body.style.display === "none";
  body.style.display = show ? "block" : "none";
  btn.querySelector(".label").textContent = show ? "Hide report" : "Show report";
  if (show && !frame.getAttribute("data-loaded")) {
    frame.src = "/report";
    frame.setAttribute("data-loaded", "1");
  }
  if (show) btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function poll() {
  try {
    const res = await fetch("/api/progress", { cache: "no-store" });
    const d = await res.json();
    if (d.status === "idle") {
      setStatus("idle");
      setTileState("idle");
      // Surface the Issue Tracker (the only populated panel when no run is
      // active) unless the user has explicitly chosen a different tab.
      if (!userPickedTab && activeTabName() !== "issues") switchSideTab("issues");
      setKpis("idle", 0, "—");
      startedAt = null;
      frozenElapsed = null;
      document.getElementById("time").textContent = "0s · —";
      document.getElementById("st-rate").style.display = "none";
      document.getElementById("model").textContent = "—";
      document.getElementById("phase-tile").textContent = "—";
      document.getElementById("pct-tile").textContent = "0%";
      document.getElementById("st-bar").style.width = "0%";
      document.getElementById("msg").textContent = "Ready — pick a screenshot set and model, then Start Analysis.";
              document.getElementById("bar").style.width = "0%";
              document.getElementById("current").textContent = "—";
              renderPhases("features", {});
              renderShots({});
              return;
    }
    if (d.status === "running") {
      if (d.started_at) {
        const serverStarted = new Date(d.started_at).getTime();
        // A new run can start while this page is already polling an older run;
        // reset the timer when the server's start time changes.
        if (startedAt == null || Math.abs(startedAt - serverStarted) > 5000) startedAt = serverStarted;
      }
      // A live run owns the timer; release any previously frozen value.
      frozenElapsed = null;
    }
    setStatus(d.status);
    setTileState(d.status);
    // While a run is live, pull the user to the Live Preview unless they have
    // already picked a different tab themselves.
    if (d.status === "running" && !userPickedTab && activeTabName() !== "preview") switchSideTab("preview");
    // The progress file is the authoritative run state. The server's
    // in-memory run-status can be unavailable after a server reload, but the
    // user should still be able to request a stop while work is progressing.
    document.getElementById("stop-btn").disabled = d.status !== "running";
    document.getElementById("model").textContent = d.model || "—";
    renderRunMessage(d);
    const total = d.total || 1;
    const feat = Math.round((d.features_done || 0) / total * 33);
    const vis = Math.round((d.vision_done || 0) / total * 33);
    const an = Math.round((d.analysis_done || 0) / total * 34);
    const pct = Math.min(100, feat + vis + an);
    setKpis(d.status, pct, d.total || null);
    document.getElementById("bar").style.width = pct + "%";
    document.querySelector(".bar").classList.toggle("running", d.status === "running");
    document.getElementById("phase-tile").textContent = d.phase || "—";
    const pe = document.getElementById("persona");
    if (d.persona && d.persona !== lastPersona) {
      pe.classList.remove("persona-idle");
      if (lastPersona) pe.classList.remove("persona-" + lastPersona);
      pe.classList.add("persona-" + d.persona, "flash");
      setTimeout(() => pe.classList.remove("flash"), 900);
      lastPersona = d.persona;
    }
    pe.textContent = d.persona_label || "—";
    document.getElementById("pct-tile").textContent = pct + "%";
    document.getElementById("st-bar").style.width = pct + "%";
    document.getElementById("s-feat").textContent = (d.features_done || 0) + "/" + total;
    document.getElementById("s-vis").textContent = (d.vision_done || 0) + "/" + total;
    document.getElementById("s-an").textContent = (d.analysis_done || 0) + "/" + total;
    renderPhases(d.phase, d);
    const spin = d.status === "running" ? '<span class="spinner"></span>' : "";
    document.getElementById("current").innerHTML = spin + (d.current_label ? escapeHtml(d.current_label) : escapeHtml(d.message || "—"));

    const done = (d.features_done || 0) + (d.vision_done || 0) + (d.analysis_done || 0);
    const total3 = total * 3;
    let eta = "—";
    if (d.status === "running" && done > 0 && startedAt) {
      const elapsedMs = Date.now() - startedAt;
      const rate = done / elapsedMs;
      eta = fmtElapsed((total3 - done) / rate);
    }
    // Only re-baseline ratePrev when a step actually completes, so the rate is
    // measured across real completion intervals (tens of seconds) instead of
    // being reset on every 1s poll (which made it never update).
    if (!ratePrev || done > ratePrev.done) {
      if (ratePrev && done > ratePrev.done) {
        const dtm = (Date.now() - ratePrev.t) / 60000;
        if (dtm > 0.001) {
          const rpm = ((done - ratePrev.done) / dtm).toFixed(1) + "/min";
          document.getElementById("s-rate").textContent = rpm;
          document.getElementById("s-rate-card").textContent = rpm;
        }
      }
      ratePrev = { done, t: Date.now() };
    }

    await maybeLoadPreviews(d);
    renderShots(d.shots, d.current);

    if (d.current && d.current !== lastKey) {
      lastKey = d.current;
      const img = document.getElementById("live-img");
      img.style.display = "block";
      img.classList.add("loading");
      img.onload = () => img.classList.remove("loading");
      img.src = "/api/shot?key=" + encodeURIComponent(d.current) + "&t=" + Date.now();
      const li = document.getElementById("shot-" + d.current);
      if (li) li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const liveVis = document.getElementById("live-vis");
    const liveCap = document.getElementById("live-vis-cap");
    // Pick the shot to show: the in-flight one only if it already has a preview,
    // otherwise fall back to the most recently completed shot that has one,
    // so the panel always surfaces real results instead of an empty in-flight card.
    let showKey = null, showLabel = "";
    if (d.shots && d.current && d.shots[d.current] && d.shots[d.current].vision_preview) {
      showKey = d.current; showLabel = "now: " + d.current;
    } else if (d.shots) {
      for (const [k, v] of Object.entries(d.shots)) {
        if (v && v.status === "done" && v.vision_preview) { showKey = k; showLabel = "last completed: " + k; }
      }
    }
    if (!showKey) showLabel = d.current ? "analyzing " + d.current + " — no vision output yet" : "waiting for first result…";
    liveCap.textContent = showLabel;
    if (showKey) {
      if (lastPreviewKey !== showKey) {
        lastPreviewKey = showKey;
        liveVis.innerHTML = '<span class="vp-note">rendering friendly preview…</span>';
        fetch("/api/shot-preview?key=" + encodeURIComponent(showKey), { cache: "no-store" })
          .then(r => (r.ok ? r.text() : Promise.reject()))
          .then(h => { liveVis.innerHTML = h && h.trim() ? h : '<p class="vp-note">No vision output yet.</p>'; })
          .catch(() => { liveVis.textContent = "analyzing " + showKey + "…"; });
      }
    } else {
      lastPreviewKey = null;
      liveVis.textContent = d.current ? "analyzing " + d.current + "…" : "No screenshot being analyzed yet.";
    }

    const errs = d.errors && d.errors.length ? d.errors.join("\n") : "none";
    document.getElementById("errors").textContent = errs;

    if (outputCleared && d.live_output) outputCleared = false;
    const lo = outputCleared ? "" : (d.live_output || "");
    const loEl = document.getElementById("live-out");
    loEl.textContent = lo + (d.status === "running" && lo ? "▋" : "");
    document.getElementById("output-count").textContent = lo.length.toLocaleString() + " characters";
    const outputState = document.getElementById("output-state");
    outputState.textContent = d.status === "running" ? "streaming" : (lo ? "available" : "waiting");
    outputState.classList.toggle("live", d.status === "running");
    if (!document.getElementById("pause-output").checked) loEl.scrollTop = loEl.scrollHeight;

    if (d.status === "done" || d.status === "stopped") {
      const rs = document.getElementById("report-state");
      rs.textContent = (d.status === "stopped" ? "Partial report preserved: " : "Report written: ") + (d.report_path || "ux_analysis_*.json");
      document.getElementById("load-report").style.display = "inline-block";
      document.getElementById("open-report-tab").style.display = "inline-block";
      if (document.querySelector('.side-tab[data-tab="report"]').classList.contains("active")
          && document.getElementById("report-body").style.display === "none") {
        loadReport();
      }
    }
    // Freeze the Elapsed value once a run ends, so the header stops ticking
    // for a finished/stopped/errored session. While running, it counts live.
    if (d.status === "running") {
      frozenElapsed = startedAt ? (Date.now() - startedAt) : null;
    } else if (frozenElapsed == null && startedAt) {
      frozenElapsed = Date.now() - startedAt;
    }
    const liveElapsed = d.status === "running"
      ? (startedAt ? Date.now() - startedAt : 0)
      : frozenElapsed;
    const elTxt = (d.status === "running" || frozenElapsed != null)
      ? fmtElapsed(liveElapsed)
      : "0s";
    document.getElementById("time").textContent = elTxt + " · " + eta;
    document.getElementById("st-rate").style.display = (d.status === "running") ? "" : "none";
  } catch (e) {
    document.getElementById("msg").textContent = "polling error: " + e.message;
  }
}

async function loadRunSets() {
  try {
    const res = await fetch("/api/analysis-sets", { cache: "no-store" });
    const d = await res.json();
    const sel = document.getElementById("run-set");
    while (sel.options.length > 1) sel.remove(1);
    (d.sets || []).forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = formatRunSet(s); o.title = s; sel.appendChild(o);
    });
  } catch (e) { /* non-fatal */ }
}

function formatRunSet(value) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})__(.+?)__(.+)$/);
  if (!match) return value;
  return `${match[1]} · ${match[2].replace(/[-_]+/g, " ")} · ${match[3].replace(/[-_]+/g, " ")}`;
}

async function refreshDashboard() {
  const btn = document.getElementById("refresh-dashboard");
  const lbl = btn.querySelector(".label");
  btn.disabled = true;
  lbl.textContent = "Refreshing…";
  lastKey = null;
  try {
    await Promise.all([poll(), loadRunSets(), refreshRunStatus(), refreshLoopStatus(), loadIssues()]);
  } finally {
    btn.disabled = false;
    lbl.textContent = "Refresh";
  }
}

async function launchGui() {
  const btn = document.getElementById("launch-gui");
  const lbl = btn.querySelector(".label");
  const label = lbl.textContent;
  btn.disabled = true;
  lbl.textContent = "Launching…";
  try {
    const res = await fetch("/api/launch-gui", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await res.json();
    btn.title = d.path ? d.path : (d.message || "Open the latest built Space Analyzer GUI");
    if (!d.ok) alert("Could not launch GUI:\n" + (d.message || "unknown error"));
  } catch (e) {
    btn.title = "Launch failed: " + e.message;
  } finally {
    btn.disabled = false;
    lbl.textContent = label;
  }
}
async function startRun() {
  const set = document.getElementById("run-set").value;
  const selectedModel = document.getElementById("run-model").value;
  const model = (selectedModel === "__custom__"
    ? document.getElementById("run-model-custom").value
    : selectedModel).trim();
  const st = document.getElementById("run-status");
  st.style.display = "block";
  try {
    const res = await fetch("/api/run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set, model }),
    });
    const d = await res.json();
    if (d.ok) {
      st.style.display = "block";
      st.innerHTML = `<div class="run-summary"><span class="run-state running">Started analysis</span>`
        + `<span class="run-chip">pid <b>${d.pid}</b></span></div>`;
      document.getElementById("run-log-btn").style.display = "inline-block";
      document.getElementById("run-btn").disabled = true;
      document.getElementById("run-btn").querySelector(".label").textContent = "Running…";
      document.getElementById("stop-btn").disabled = false;
    } else if (d.status === "already_running") {
      st.style.display = "block";
      st.innerHTML = `<div class="run-summary"><span class="run-state running">Already running</span>`
        + `<span class="run-chip">pid <b>${d.pid}</b></span></div>`;
    } else {
      st.style.display = "block";
      st.textContent = "Failed to start: " + (d.error || "unknown error");
    }
  } catch (e) {
    st.textContent = "Request failed: " + e.message;
  }
}

async function stopRun() {
  const stop = document.getElementById("stop-btn");
  const st = document.getElementById("run-status");
  if (!confirm("Stop the in-progress analysis? Completed results will be kept.")) return;
  stop.disabled = true;
  st.style.display = "block";
  st.textContent = "Stopping analysis…";
  try {
    const res = await fetch("/api/stop", { method: "POST" });
    const d = await res.json();
    st.textContent = d.ok ? "Analysis stopped. Completed results were kept." : (d.error || "No analysis is running.");
    if (d.ok) {
      document.getElementById("run-btn").disabled = false;
      document.getElementById("run-btn").querySelector(".label").textContent = "Start Analysis";
    }
  } catch (e) {
    stop.disabled = false;
    st.textContent = "Stop request failed: " + e.message;
  }
}

async function startLoop() {
  const maxEl = document.getElementById("loop-max");
  const modelSel = document.getElementById("loop-model");
  const modelCustom = document.getElementById("loop-model-custom");
  const catEl = document.getElementById("loop-category");
  const dryEl = document.getElementById("loop-dry-run");
  let model = modelSel.value;
  if (model === "__custom__") model = modelCustom.value.trim();
  const category = catEl.value;
  const max = parseInt(maxEl.value, 10);
  const st = document.getElementById("loop-status");
  st.style.display = "block";
  try {
    const res = await fetch("/api/run-loop", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        max_iterations: isNaN(max) ? 3 : max,
        model: model || "",
        category: category || "",
        dry_run: !!dryEl.checked,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      const dry = dryEl.checked ? ' <span class="run-badge dry">dry run</span>' : "";
      st.innerHTML = `<div class="run-summary"><span class="run-state running">Started improvement loop${dry}</span>`
        + `<span class="run-chip">pid <b>${d.pid}</b></span></div>`;
      document.getElementById("loop-run-btn").disabled = true;
      document.getElementById("loop-run-btn").querySelector(".label").textContent = "Running…";
      document.getElementById("loop-stop-btn").disabled = false;
      document.getElementById("loop-log-btn").style.display = "inline-block";
    } else if (d.status === "already_running") {
      st.innerHTML = `<div class="run-summary"><span class="run-state running">Already running</span>`
        + `<span class="run-chip">pid <b>${d.pid}</b></span></div>`;
      document.getElementById("loop-log-btn").style.display = "inline-block";
    } else {
      st.textContent = "Failed to start: " + (d.error || "unknown error");
    }
  } catch (e) {
    st.textContent = "Request failed: " + e.message;
  }
}

async function stopLoop() {
  const stop = document.getElementById("loop-stop-btn");
  const st = document.getElementById("loop-status");
  st.style.display = "block";
  st.textContent = "Stopping loop…";
  try {
    const res = await fetch("/api/stop-loop", { method: "POST" });
    const d = await res.json();
    st.textContent = d.ok ? "Improvement loop stopped." : (d.error || "No loop is running.");
    if (d.ok) {
      document.getElementById("loop-run-btn").disabled = false;
      document.getElementById("loop-run-btn").querySelector(".label").textContent = "Run Loop";
    }
  } catch (e) {
    stop.disabled = false;
    st.textContent = "Stop request failed: " + e.message;
  }
}

async function refreshLoopStatus() {
  const btn = document.getElementById("loop-run-btn");
  const st = document.getElementById("loop-status");
  const logBtn = document.getElementById("loop-log-btn");
  try {
    const res = await fetch("/api/loop-status", { cache: "no-store" });
    const d = await res.json();
    const running = d.running === true;
    btn.disabled = running;
    btn.querySelector(".label").textContent = running ? "Running…" : "Run Loop";
    document.getElementById("loop-stop-btn").disabled = !running;
    if (running || d.finished) {
      logBtn.style.display = "inline-block";
      st.style.display = "block";
      const state = d.state || {};
      const cfg = d.config || {};
      const iter = state.iteration || 0;
      const processed = (state.processed || []).length;
      const failed = (state.failed || []).length;
      const dry = cfg.dry_run ? ' <span class="run-badge dry">dry run</span>' : "";
      const cat = cfg.category ? ` <span class="run-badge">${cfg.category}</span>` : "";
      const maxIt = cfg.max_iterations ? ` / ${cfg.max_iterations}` : "";
      const head = running
        ? `<span class="run-state running">Loop running</span>`
        : `<span class="run-state ${d.exit_code === 0 ? "done" : "error"}">Loop exited (code ${d.exit_code})</span>`;
      let html = `<div class="run-summary">${head}${dry}${cat}`
        + `<span class="run-chip">iteration <b>${iter}${maxIt}</b></span>`
        + `<span class="run-chip">processed <b>${processed}</b></span>`
        + `<span class="run-chip">failed <b>${failed}</b></span></div>`;
      if (d.tail) html += `<div class="run-log">${renderLogLines(d.tail)}</div>`;
      st.innerHTML = html;
    } else {
      st.style.display = "none";
      logBtn.style.display = "none";
    }
  } catch (e) { /* non-fatal */ }
}

// ---- Issue Tracker panel (shared docs/issues.json) ----
let issCategoriesLoaded = false;

function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

async function loadIssues() {
  const status = document.getElementById("iss-status").value;
  const category = document.getElementById("iss-category").value;
  const severity = document.getElementById("iss-severity").value;
  const scope = document.getElementById("iss-scope").value;
  const q = document.getElementById("iss-q").value.trim();
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  if (severity) params.set("severity", severity);
  if (scope) params.set("scope", scope);
  if (q) params.set("q", q);
  try {
    const res = await fetch("/api/issues?" + params.toString(), { cache: "no-store" });
    const d = await res.json();
    renderIssues(d);
  } catch (e) { /* non-fatal */ }
}

function renderIssues(d) {
  const counts = d.counts || {};
  const order = ["open", "in_progress", "blocked", "pending", "done", "wontfix"];
  const countsEl = document.getElementById("iss-counts");
  countsEl.innerHTML = order.filter(s => counts[s]).map(s =>
    `<span class="iss-count"><b>${counts[s]}</b> ${s.replace("_", " ")}</span>`).join("")
    + `<span class="iss-count"><b>${d.total || 0}</b> total</span>`;
  const open = counts.open || 0;
  const issKpi = document.getElementById("kpi-issues");
  const issKpiCard = document.getElementById("kpi-issues-card");
  tweenNumber(issKpi, open, "");
  issKpiCard.className = "kpi " + (open > 0 ? "warn" : "done");
  const catSel = document.getElementById("iss-category");
  if (!issCategoriesLoaded && (d.categories || []).length) {
    d.categories.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c; catSel.appendChild(o);
    });
    issCategoriesLoaded = true;
  }
  const list = document.getElementById("iss-list");
  const issues = d.issues || [];
  if (!issues.length) {
    list.innerHTML = `<li class="iss-empty">No issues match the current filter.</li>`;
    return;
  }
  const statuses = ["open", "in_progress", "done", "wontfix", "blocked", "pending"];
  list.innerHTML = issues.map(it => {
    const id = escapeHtml(it.issue_id || "");
    const title = escapeHtml(it.title || "(untitled)");
    const cat = escapeHtml(it.category || "");
    const sev = escapeHtml(it.severity || "low");
    const st = escapeHtml(it.status || "open");
    const notes = escapeHtml((it.notes || "").slice(0, 400));
    const extra = it.extra || {};
    const set = escapeHtml(extra.source_set || extra.shot_label || "");
    const file = escapeHtml(extra.file || "");
    const shotKey = extra.screenshot_key || extra.shot_label || "";
    const meta = [set ? `set: ${set}` : "", file ? `file: ${file}` : "",
                  it.last_seen ? `updated ${fmtStarted(it.last_seen)}` : ""]
      .filter(Boolean).join(" · ");
    const shotChip = shotKey
      ? `<button type="button" class="iss-shot" title="Jump to the captured screen for this issue" onclick="gotoShot('${escapeHtml(shotKey)}')"><svg class="ic"><use href="#i-images"/></svg>View screenshot ›</button>`
      : "";
    const cur = statuses.map(s =>
      `<option value="${s}" ${s === st ? "selected" : ""}>${s.replace("_", " ")}</option>`).join("");
    return `<li class="iss-item" data-id="${id}">
      <div class="iss-top">
        <span class="iss-title">${title}</span>
        <span class="iss-badge iss-sev-${sev}">${sev}</span>
        <span class="iss-badge iss-st-${st}">${st.replace("_", " ")}</span>
        <span class="iss-id">${cat ? cat + " · " : ""}${id}</span>
      </div>
      ${notes ? `<div class="iss-notes">${notes}</div>` : ""}
      ${meta ? `<div class="iss-meta">${meta}</div>` : ""}
      ${shotChip ? `<div class="iss-shotrow">${shotChip}</div>` : ""}
      <div class="iss-actions">
        <select data-role="status" aria-label="status">${cur}</select>
        <input data-role="resolution" placeholder="resolution note (optional)" />
        <button type="button" onclick="updateIssue(this)"><svg class="ic"><use href="#i-check"/></svg><span class="label">Save</span></button>
      </div>
    </li>`;
  }).join("");
}

async function updateIssue(btn) {
  const li = btn.closest(".iss-item");
  const id = li.getAttribute("data-id");
  const status = li.querySelector('[data-role="status"]').value;
  const resolution = li.querySelector('[data-role="resolution"]').value.trim();
  btn.disabled = true; btn.querySelector(".label").textContent = "Saving…";
  try {
    const res = await fetch("/api/issues/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_id: id, status, resolution }),
    });
    const d = await res.json();
    if (d.status === "ok") {
      btn.querySelector(".label").textContent = "Saved";
      setTimeout(loadIssues, 300);
    } else {
      btn.querySelector(".label").textContent = d.message || "Error";
      setTimeout(() => { btn.querySelector(".label").textContent = "Save"; btn.disabled = false; }, 1500);
    }
  } catch (e) {
    btn.querySelector(".label").textContent = "Error"; btn.disabled = false;
  }
}

const MODEL_INFO = {
  "qwen3-vl:4b": "Balanced vision + language · 4B",
  "qwen3-vl:2b": "Faster, lighter · 2B",
  "gemma4:e2b-it-qat": "Detailed, strong reasoning · 4B",
};
function updateModelInfo() {
  const sel = document.getElementById("run-model");
  const info = document.getElementById("run-model-info");
  const v = sel.value;
  info.textContent = (v === "__custom__") ? "custom installed model" : (MODEL_INFO[v] || "");
}

document.getElementById("run-model").addEventListener("change", (event) => {
  const custom = document.getElementById("run-model-custom");
  custom.style.display = event.target.value === "__custom__" ? "inline-block" : "none";
  if (event.target.value === "__custom__") custom.focus();
  updateModelInfo();
});
document.getElementById("loop-model").addEventListener("change", (event) => {
  const custom = document.getElementById("loop-model-custom");
  custom.style.display = event.target.value === "__custom__" ? "inline-block" : "none";
  if (event.target.value === "__custom__") custom.focus();
});
document.getElementById("refresh-dashboard").addEventListener("click", refreshDashboard);
document.getElementById("launch-gui").addEventListener("click", launchGui);
document.getElementById("iss-refresh").addEventListener("click", loadIssues);
document.getElementById("iss-status").addEventListener("change", loadIssues);
document.getElementById("iss-category").addEventListener("change", loadIssues);
document.getElementById("iss-severity").addEventListener("change", loadIssues);
document.getElementById("iss-scope").addEventListener("change", loadIssues);
document.getElementById("iss-q").addEventListener("input", debounce(loadIssues, 300));
document.getElementById("clear-output").addEventListener("click", () => {
  outputCleared = true;
  document.getElementById("live-out").textContent = "Output cleared for this view. New streamed text will appear when the next update arrives.";
  document.getElementById("output-count").textContent = "0 characters";
});
document.getElementById("copy-output").addEventListener("click", async () => {
  const text = document.getElementById("live-out").textContent;
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById("copy-output").querySelector(".label").textContent = "Copied";
    setTimeout(() => document.getElementById("copy-output").querySelector(".label").textContent = "Copy", 1200);
  } catch (e) {
    document.getElementById("copy-output").querySelector(".label").textContent = "Copy unavailable";
  }
});

// ---- Tabbed sidebar ----
// Only one live panel (Preview / Output / Errors / Report) is shown at a time,
// so the four tall cards no longer stack and push the sidebar past the viewport.
// `userPickedTab` records whether the user explicitly chose a tab, so the
// dashboard can auto-surface the most useful panel for the current state
// (Issues when idle, Live Preview when a run is active) without yanking the
// tab out from under them once they've made a choice.
let userPickedTab = false;
function activeTabName() {
  const a = document.querySelector(".side-tab.active");
  return a ? a.dataset.tab : null;
}
function switchSideTab(name) {
  document.querySelectorAll(".side-tab").forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".side-panel").forEach(p => { p.hidden = p.dataset.panel !== name; });
  if (name === "report") {
    const rb = document.getElementById("report-body");
    if (rb && rb.style.display === "none" && document.getElementById("load-report").style.display !== "none") {
      loadReport();
    }
  }
}
// Open the Issue Tracker when arriving via the cross-page "#issue-tracker" link
// (the sub-page nav links there). Guarded so it only acts on an explicit hash.
function syncTabFromHash() {
  if (location.hash === "#issue-tracker") {
    userPickedTab = true;
    switchSideTab("issues");
  }
}
window.addEventListener("hashchange", syncTabFromHash);
syncTabFromHash();
document.querySelectorAll(".side-tab").forEach(t =>
  t.addEventListener("click", () => { userPickedTab = true; switchSideTab(t.dataset.tab); }));

async function refreshRunStatus() {
  const btn = document.getElementById("run-btn");
  const st = document.getElementById("run-status");
  try {
    const res = await fetch("/api/run-status", { cache: "no-store" });
    const d = await res.json();
    if (d.running) {
      btn.disabled = true; btn.querySelector(".label").textContent = "Running…";
      document.getElementById("stop-btn").disabled = false;
      st.style.display = "block";
      st.innerHTML = `<div class="run-summary">`
        + `<span class="run-state running">Analysis running</span>`
        + `<span class="run-chip">pid <b>${d.pid}</b></span>`
        + `<span class="run-chip">started <b>${fmtStarted(d.started)}</b></span>`
        + `</div>`
        + (d.tail ? `<div class="run-log">${renderLogLines(d.tail)}</div>` : "");
    } else if (d.finished) {
      btn.disabled = false; btn.querySelector(".label").textContent = "Start Analysis";
      document.getElementById("stop-btn").disabled = true;
      st.style.display = "block";
      const ok = d.exit_code === 0;
      st.innerHTML = `<div class="run-summary">`
        + `<span class="run-state ${ok ? "done" : "error"}">Last run ${ok ? "finished successfully" : "exited with code " + d.exit_code}</span>`
        + `<span class="run-chip">pid <b>${d.pid}</b></span>`
        + `<span class="run-chip">started <b>${fmtStarted(d.started)}</b></span>`
        + `</div>`
        + (d.tail ? `<div class="run-log">${renderLogLines(d.tail)}</div>` : "");
    } else {
      st.style.display = "none";
    }
  } catch (e) { /* non-fatal */ }
}

// ---- Ollama Model Status (live VRAM / resident models) ----
// Best-effort VRAM budget for THIS machine (GTX 1070 Ti, 8 GB). Used only to
// scale the VRAM bar; the raw used GB is always shown so it stays meaningful
// even if the real card differs.
const TOTAL_VRAM_GB = 8;
const GB = 1024 * 1024 * 1024;

function fmtBytesGb(bytes) {
  const v = (bytes || 0) / GB;
  return v >= 1 ? v.toFixed(1) + " GB" : Math.round((bytes || 0) / (1024 * 1024)) + " MB";
}

async function refreshModelStatus() {
  const box = document.getElementById("model-status");
  if (!box) return;
  try {
    const res = await fetch("/api/model_status", { cache: "no-store" });
    const d = await res.json();
    if (!d.ok) {
      box.innerHTML = `<div class="model-status-offline">Ollama offline — ${escapeHtml(d.error || "unreachable")}</div>`;
      return;
    }
    const running = d.running || [];
    if (!running.length) {
      box.innerHTML = `<div class="model-status-empty">No models loaded — Ollama idle.</div>`;
      return;
    }
    const used = running.reduce((a, m) => a + (m.size_vram_bytes || 0), 0);
    const usedGb = used / GB;
    const pct = Math.min(100, Math.round((used / GB / TOTAL_VRAM_GB) * 100));
    const summary = `<div class="model-summary"><span><b>${running.length}</b> model${running.length > 1 ? "s" : ""} resident</span>`
      + `<span>VRAM used <b>${usedGb.toFixed(1)} GB</b> / ${TOTAL_VRAM_GB} GB</span></div>`;
    const rows = running.map(m => {
      const mUsed = (m.size_vram_bytes || 0) / GB;
      const mPct = Math.min(100, Math.round((mUsed / TOTAL_VRAM_GB) * 100));
      const hot = mPct >= 75 ? " hot" : "";
      const fam = m.family ? ` · ${escapeHtml(m.family)}` : "";
      const ps = m.parameter_size ? ` · ${escapeHtml(String(m.parameter_size))}` : "";
      const exp = m.expires_at ? ` · keeps until ${escapeHtml(String(m.expires_at))}` : "";
      return `<div class="model-row">
        <div class="model-row-top">
          <span class="model-name">${escapeHtml(m.name)}</span>
          <span class="model-badge loading">in VRAM</span>
        </div>
        <div class="model-vram">using <b>${mUsed.toFixed(1)} GB</b> · ${fmtBytesGb(m.size_bytes)} on disk${fam}${ps}${exp}</div>
        <div class="model-bar${hot}"><i style="width:${mPct}%"></i></div>
      </div>`;
    }).join("");
    box.innerHTML = summary + rows;
  } catch (e) {
    box.innerHTML = `<div class="model-status-offline">model status error: ${escapeHtml(e.message)}</div>`;
  }
}
