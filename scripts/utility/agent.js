// ---- AI Assistant (tool-calling agent) ----
let agentRunning = false;

function agentStatus(html, show = true) {
  const s = document.getElementById("agent-status");
  s.style.display = show ? "block" : "none";
  if (show) s.innerHTML = html;
}

function agentAppend(html) {
  const t = document.getElementById("agent-transcript");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const node = tmp.firstElementChild || tmp;
  t.appendChild(node);
  t.scrollTop = t.scrollHeight;
}

function agentClear() { document.getElementById("agent-transcript").innerHTML = ""; }

function renderAgentStep(step) {
  if (step.role === "assistant") {
    let h = `<div class="agent-step assistant"><div class="agent-role">assistant</div>`;
    if (step.content) h += `<div class="agent-msg">${escapeHtml(step.content)}</div>`;
    (step.tool_calls || []).forEach(tc => {
      const fn = tc.function || {};
      if (!fn.name) return;
      let args = fn.arguments;
      try { args = typeof args === "string" ? args : JSON.stringify(args); } catch (e) { args = String(args); }
      h += `<div class="agent-toolcall">↳ ${escapeHtml(fn.name || "")}(${escapeHtml(args)})</div>`;
    });
    return h + `</div>`;
  }
  if (step.role === "tool") {
    let r = step.result, txt = "";
    try { txt = typeof r === "string" ? r : JSON.stringify(r, null, 2); } catch (e) { txt = String(r); }
    if (txt.length > 1500) txt = txt.slice(0, 1500) + "\n… (truncated)";
    return `<div class="agent-step tool"><div class="agent-role">tool: ${escapeHtml(step.name || "")}</div><pre class="agent-result">${escapeHtml(txt)}</pre></div>`;
  }
  return "";
}

let agentTraceRunId = null;
let agentTraceTimer = null;
let agentTraceLastSeq = 0;
let agentFinalRendered = false;

async function runAgent() {
  if (agentRunning) return;
  const msgEl = document.getElementById("agent-msg");
  const msg = msgEl.value.trim();
  if (!msg) { agentStatus("Type a message first.", true); return; }
  const modelSel = document.getElementById("agent-model");
  let model = modelSel.value;
  if (model === "__custom__") model = document.getElementById("agent-model-custom").value.trim();
  const max = parseInt(document.getElementById("agent-max").value, 10);
  const auto = document.getElementById("agent-edits").checked;
  agentRunning = true;
  const btn = document.getElementById("agent-run");
  btn.disabled = true; btn.querySelector(".label").textContent = "Running…";
  const stopBtn = document.getElementById("agent-stop");
  if (stopBtn) stopBtn.disabled = false;
  agentStatus('<span class="spinner"></span> agent working…', true);
  agentClear();
  document.getElementById("agent-trace").innerHTML = "";
  agentTraceLastSeq = 0;
  agentFinalRendered = false;
  try {
    const res = await fetch("/api/agent/run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, model: model || "", max_iterations: isNaN(max) ? 6 : max, auto_apply: auto }),
    });
    const d = await res.json();
    if (d.error) {
      agentStatus("Error: " + escapeHtml(d.error), true);
      finishAgent();
      return;
    }
    agentTraceRunId = d.run_id;
    startAgentTracePoll();
  } catch (e) {
    agentStatus("Request failed: " + escapeHtml(e.message), true);
    finishAgent();
  }
}

function startAgentTracePoll() {
  if (agentTraceTimer) clearInterval(agentTraceTimer);
  agentTraceTimer = setInterval(pollAgentTrace, 500);
  pollAgentTrace();
}

async function pollAgentTrace() {
  if (!agentTraceRunId) return;
  try {
    const res = await fetch("/api/agent/trace?run=" + encodeURIComponent(agentTraceRunId), { cache: "no-store" });
    const d = await res.json();
    renderAgentTrace(d);
    if (!d.running && d.found) {
      if (agentTraceTimer) { clearInterval(agentTraceTimer); agentTraceTimer = null; }
      finishAgent();
    }
  } catch (e) { /* keep polling; transient network blip */ }
}

function renderAgentTrace(d) {
  const box = document.getElementById("agent-trace");
  if (!box) return;
  const events = d.events || [];
  let maxT = 0;
  events.forEach(e => { if (e.t_ms > maxT) maxT = e.t_ms; });
  for (const e of events) {
    if (e.seq <= agentTraceLastSeq) continue;
    agentTraceLastSeq = e.seq;
    box.appendChild(renderTraceEvent(e, maxT));
  }
  box.scrollTop = box.scrollHeight;
  const badge = document.getElementById("agent-trace-status");
  if (badge) {
    badge.textContent = (d.running ? "running" : "done") + " · " + events.length +
      " events · " + (d.total_tokens_in || 0) + "→" + (d.total_tokens_out || 0) + " tok";
  }
  if (!d.running && d.result) renderAgentFinal(d.result);
}

function renderAgentFinal(result) {
  if (agentFinalRendered) return;
  agentFinalRendered = true;
  const answer = result.answer || "";
  const modelTag = result.model ? " · model " + escapeHtml(result.model) : "";
  agentAppend(`<div class="agent-step final"><div class="agent-role">final answer · ${result.iterations || 0} iterations${modelTag}</div><div class="agent-msg">${escapeHtml(answer)}</div></div>`);
  if (result.error) {
    agentStatus("Error: " + escapeHtml(result.error), true);
  } else if (!answer) {
    agentStatus("Done in " + (result.iterations || 0) + " iteration(s)" + modelTag
      + " — the model returned no answer. It may not support tool calling; try a tool-capable model (e.g. qwen3.5:9b).", true);
  } else {
    agentStatus("Done in " + (result.iterations || 0) + " iteration(s)" + modelTag + ".", true);
  }
}

function renderTraceEvent(e, maxT) {
  const div = document.createElement("div");
  div.className = "trace-ev trace-" + e.kind;
  const pct = maxT > 0 ? Math.min(100, (e.t_ms / maxT) * 100) : 0;
  let icon = "•", body = "";
  const d = e.data || {};
  switch (e.kind) {
    case "run.start":
      icon = "▶";
      body = `model <b>${escapeHtml(d.model || "?")}</b> · max ${d.max_iterations} iter · ${(d.tools || []).length} tools`;
      break;
    case "iteration.start":
      icon = "↻";
      body = `iteration ${d.iteration} · ${d.message_count} msgs`;
      break;
    case "llm.call":
      icon = "🧠";
      body = `iter ${d.iteration} · <b>${escapeHtml(d.model || "")}</b> · ${d.prompt_tokens ?? "?"}→${d.completion_tokens ?? "?"} tok · ${d.duration_ms} ms · finish=<b>${escapeHtml(d.finish_reason || "")}</b>` +
        (d.error ? ` · <span class="trace-err">${escapeHtml(d.error)}</span>` : "");
      break;
    case "tool.call":
      icon = "🔧";
      body = `<b>${escapeHtml(d.name || "")}</b> · ${d.ok ? "ok" : "ERR"} · ${d.latency_ms} ms · ${d.result_size}B` +
        (d.error ? ` · <span class="trace-err">${escapeHtml(d.error)}</span>` : "");
      if (d.args) {
        const aj = JSON.stringify(d.args);
        body += `<details class="trace-args"><summary>args</summary><pre>${escapeHtml(aj)}</pre></details>`;
      }
      break;
    case "warning":
      icon = "⚠";
      div.classList.add("trace-warn");
      body = escapeHtml(d.message || d.type || "");
      break;
    case "enforcement":
      icon = "🔒";
      div.classList.add("trace-block");
      body = escapeHtml((d.type || "") + (d.reason ? ": " + d.reason : "") + (d.path ? " · " + d.path : ""));
      break;
    case "note":
      icon = "•";
      body = escapeHtml(d.message || "");
      break;
    case "run.end":
      icon = "■";
      body = `stop=<b>${escapeHtml(d.stop_reason || "")}</b> · ${d.iterations || 0} iter · ${d.total_tokens_in || 0}→${d.total_tokens_out || 0} tok · ${d.duration_ms || 0} ms` +
        (d.error ? ` · <span class="trace-err">${escapeHtml(d.error)}</span>` : "");
      break;
    default:
      body = escapeHtml(JSON.stringify(d));
  }
  div.innerHTML = `<span class="trace-t">${e.t_ms} ms</span>` +
    `<span class="trace-bar"><i style="width:${pct}%"></i></span>` +
    `<span class="trace-ic" title="${escapeHtml(e.kind)}">${icon}</span>` +
    `<span class="trace-body">${body}</span>`;
  return div;
}

async function stopAgent() {
  if (!agentTraceRunId) return;
  try {
    await fetch("/api/agent/stop-run?run=" + encodeURIComponent(agentTraceRunId), { method: "POST" });
    agentStatus("Stop requested — agent will halt after the current step.", true);
  } catch (e) {
    agentStatus("Stop failed: " + escapeHtml(e.message), true);
  }
}

function finishAgent() {
  agentRunning = false;
  const btn = document.getElementById("agent-run");
  if (btn) { btn.disabled = false; btn.querySelector(".label").textContent = "Run Agent"; }
  const stopBtn = document.getElementById("agent-stop");
  if (stopBtn) stopBtn.disabled = true;
}

async function callAgentTool(tool, args) {
  const auto = document.getElementById("agent-edits").checked;
  agentStatus("Calling " + escapeHtml(tool) + "…", true);
  try {
    const res = await fetch("/api/agent/tool", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args: args || {}, auto_apply: auto }),
    });
    const d = await res.json();
    agentAppend(`<div class="agent-step tool"><div class="agent-role">tool: ${escapeHtml(tool)}</div><pre class="agent-result">${escapeHtml(typeof d === "string" ? d : JSON.stringify(d, null, 2))}</pre></div>`);
  } catch (e) {
    agentStatus("Tool failed: " + escapeHtml(e.message), true);
  }
}

async function loadAgentModels() {
  const sel = document.getElementById("agent-model");
  try {
    const res = await fetch("/api/agent/models", { cache: "no-store" });
    const d = await res.json();
    const models = d.models || [];
    const chatDefault = d.chat_default || "";
    const def = sel.querySelector('option[value=""]');
    if (def && chatDefault) def.textContent = "Default (" + chatDefault + ")";
    const info = document.getElementById("agent-model-info");
    if (info) info.textContent = chatDefault ? ("chat → " + chatDefault + (d.vision_default ? " · vision → " + d.vision_default : "")) : "";
    while (sel.options.length > 1) sel.remove(1);
    models.forEach(m => {
      const o = document.createElement("option");
      o.value = m; o.textContent = m; sel.appendChild(o);
    });
    const o = document.createElement("option");
    o.value = "__custom__"; o.textContent = "Enter another installed model…"; sel.appendChild(o);
  } catch (e) { /* non-fatal */ }
}

async function loadAgentTools() {
  const box = document.getElementById("agent-tools");
  try {
    const res = await fetch("/api/agent/tools", { cache: "no-store" });
    const d = await res.json();
    const tools = d.tools || [];
    box.innerHTML = (tools.length ? tools.map(t =>
      `<div class="agent-tool"><b>${escapeHtml(t.name || "")}</b><div class="agent-tool-desc">${escapeHtml(t.description || "")}</div></div>`
    ).join("") : '<div class="agent-tool-desc">No tools available.</div>');
  } catch (e) {
    box.innerHTML = '<div class="agent-tool-desc">Could not load tools.</div>';
  }
}

document.getElementById("agent-model").addEventListener("change", (e) => {
  const c = document.getElementById("agent-model-custom");
  c.style.display = e.target.value === "__custom__" ? "inline-block" : "none";
  if (e.target.value === "__custom__") c.focus();
});
document.getElementById("agent-msg").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runAgent(); }
});
document.querySelectorAll(".agent-quick button").forEach(b => {
  b.addEventListener("click", () => callAgentTool(b.dataset.tool, {}));
});

loadRunSets();
loadIssues();
loadAgentModels();
loadAgentTools();
updateModelInfo();
setInterval(refreshRunStatus, 3000);
setInterval(refreshLoopStatus, 3000);
setInterval(refreshModelStatus, 3000);
setInterval(loadIssues, 8000);

refreshModelStatus();
poll();
setInterval(poll, 1000);
