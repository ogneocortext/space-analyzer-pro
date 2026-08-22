#!/usr/bin/env node
// Space-Analyzer vision helper — routes a screenshot through the local gemma4
// vision model (Ollama), implementing the vision-feedback skill pattern for this
// repo. Dependency-free core (global fetch in Node 18+); uses local `sharp` for
// resizing when available.
//
// The data-flow goal is to give the model the *least ambiguous, most grounded*
// context it can use: real image dimensions, the intended viewport, what screen
// it is looking at, and the exact source code that produced it (line-numbered so
// the model can cite locations). That context, not raw pixels, is what makes the
// advice actionable.
//
// Usage:
//   node scripts/vision.mjs analyze shot.png [code.js...] ["prompt" | --prompt "prompt"]
//   node scripts/vision.mjs analyze a.png b.png "compare these two states"
//   node scripts/vision.mjs analyze shot.png src/components/Foo.jsx --mode ui
//   node scripts/vision.mjs analyze shot.png --viewport 1366x768 --label "gallery desktop"
//
// Optional env: VISION_MODEL (default gemma4:e2b-it-qat), OLLAMA_URL,
//   VISION_PROMPT, VISION_KEEP_ALIVE, VISION_MAX_DIM (default 1024), VISION_QUALITY (default 82)
// Flags: --prompt, --mode ui|responsive|regression|compare|winui, --persona
//   <name|all>, --viewport WxH,
//   --label "text", --context "text", --lines (number code context), --low (640px),
//   --high (1280px), --max-dim N, --quality N, --raw (no auto metadata), --json,
//   --no-stream (print the full response once at the end instead of token-by-token)
//   (--mode winui uses a professional frontend-engineer persona targeting 2025-2026
//   WinUI 3 / Fluent 2 desktop design standards; best for Space Analyzer Pro audit.
//   --persona general|accessibility|design_systems|data_viz|interaction|winui|all
//   runs a narrow specialist lens; --persona all runs ALL lenses on the same image
//   and appends a cross-persona consensus note — best for weak models like gemma4:e2b.)
import { readFile } from 'node:fs/promises';
import { existsSync, writeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.VISION_MODEL || 'gemma4:e2b-it-qat';
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const CODE_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|css|json|html?|py|go|sh|sql|md|txt|ya?ml|vue|svelte|rs|java|kt)$/i;

// gemma4-e2b is a SMALL vision model: its vision encoder resamples the input to a
// fixed token grid, so feeding it 1280px rarely helps and burns context/tokens.
// 1024 is the sweet spot; --low (640) sharpens focus on text-dense screens.
const DEFAULT_MAX_DIM = Number(process.env.VISION_MAX_DIM) || 1024;
const DEFAULT_QUALITY = Number(process.env.VISION_QUALITY) || 82;

const MODE_PROMPTS = {
  // Professional frontend-engineer persona for WinUI 3 / Windows App SDK 2.x desktop
  // apps (Fluent 2 design language, 2025-2026 Windows 11 conventions). Produces
  // specific, implementation-ready feedback that names the exact WinUI 3 control /
  // attribute / XAML pattern to change, instead of generic "make it cleaner" advice.
  winui: `You are a SENIOR FRONTEND ENGINEER specializing in WinUI 3 / Windows App SDK 2.x desktop applications, with deep expertise in the Fluent 2 design language and current (2025-2026) Windows 11 desktop UX conventions. You are reviewing ONE screenshot of "Space Analyzer Pro", a disk-space analyzer built in WinUI 3.

Evaluate the screen STRICTLY against what is visibly rendered, using this WinUI 3 / Fluent 2 rubric:
- Navigation & shell: correct NavigationView usage (pane mode, item icons, Settings pinned to footer), no overflow into a "More" flyout, consistent iconography.
- Layout & spacing: 4px base grid; ~24px desktop page padding, 8/12/16px gaps, content max-width for readability, no cramped/overlapping controls.
- Typography: Segoe UI Variable type ramp (Caption/Body/BodyStrong/Subtitle/Title/Display), correct weights, proper TextTrimming/TextWrapping, no mis-sized or low-contrast text.
- Color & materials: ThemeResource-driven colors (NO hardcoded hex brushes), accent usage, neutral card layers (CardBackgroundFillColorDefaultBrush etc.), Mica backdrop, severity palette (Info/Warning/Error/Success), text-on-accent contrast.
- Controls: the RIGHT control for the job (ListView/DataGrid/ItemsRepeater; ProgressRing vs ProgressBar; ToggleSwitch vs CheckBox; InfoBar for notifications; CommandBar for grouped actions; ContentDialog for confirmation; teaching tip / tooltip for hints); consistent 8px corner radius and subtle elevation.
- Data viz: legible charts/labels/legends, hover tooltips, colorblind-safe palette, clear empty states.
- Interaction & states: hover/pressed/disabled states, loading (ProgressRing), empty/error states (InfoBar), confirmation (ContentDialog), purposeful subtle motion.
- Accessibility: keyboard focus visuals, logical tab order, AutomationProperties.Name on icon-only controls, body-text contrast >= 4.5:1, >= 40px hit targets, high-contrast support.
- 2025-2026 idioms: customized title bar (drag regions + caption buttons), optional compact density, layered backdrops, rounded corners, consistent density.

Report concisely and factually (do NOT speculate beyond the pixels):
1. What screen this is and its primary task.
2. Concrete usability/visual problems, each tied to the rubric above and citing the SPECIFIC WinUI 3 control/attribute involved (e.g. "the bottom action bar mixes primary + destructive actions with no CommandBar separation"; "the stat card uses a hardcoded hex brush that breaks dark mode"; "the icon-only button has no AutomationProperties.Name").
3. Overlapping, clipped, unreadable, or misaligned elements; right-edge clipping or content cut off.
4. Theming/contrast issues (dark or light), broken or inconsistent colors, severity colors used wrong.
5. Always end with a "Top 3 fixes:" list, most impactful first, where each fix NAMES the exact WinUI 3 control/XAML change (e.g. "Move destructive actions into a CommandBar SecondaryCommands / ContextFlyout using an AppBarButton with a red severity brush"; "Replace the hardcoded #1F1F1F brush with CardBackgroundFillColorDefaultBrush so it follows the theme").`,
  ui: `Analyze this UI screenshot. Report concisely and factually (do not speculate beyond what is visible):
 1. What screen/app/UI is shown.
 2. Any UI errors, crashes, blank/loading states, broken or missing layouts.
 3. Overlapping, cut-off, or unreadable elements; misaligned or inconsistent styling.
 4. Whether content fits the viewport or is clipped/cut off on any edge (especially the right side).
 5. Concrete, actionable suggestions to improve clarity, usefulness, or correctness.`,
  responsive: `This screenshot is being reviewed for RESPONSIVE behavior. Using the viewport/screen context provided:
1. Does the layout fit the intended viewport without horizontal scroll or right-edge clipping?
2. Are elements cramped, overlapping, or awkwardly spaced at this width?
3. Does spacing/contrast/readability hold up at this size?
4. What specific breakpoints or layout changes would improve it at this width?`,
  regression: `Compare what is VISIBLY rendered against the provided source-code context. Report factually:
1. Elements present in the code but missing/broken in the render.
2. Elements rendered but not matching the code's intent (styling, position, content).
3. Any visual regression vs. what the code describes.
4. Concrete fixes mapped to the relevant source file/lines.`,
  compare: `You are shown TWO screenshots. Treat the FIRST as the BEFORE/reference state and the SECOND as the AFTER/changed state. Report factually:
1. What changed between the two states (layout, content, styling, errors).
2. Whether the change improved or degraded clarity/usefulness.
3. Any NEW issues introduced in the after state.
4. Concrete suggestions for the after state.`,
};

// Persona lenses for multi-angle feedback. A small vision model (gemma4:e2b) gives
// shallow, primed output from a single prompt, so rotating narrow lenses on the
// SAME image set (`--persona all`) is the highest-leverage way to extract broader,
// less biased, more actionable feedback. The `--mode winui` prompt above stays the
// default single-lens for a full Fluent 2 critique; these are tighter specialists.
const PERSONA_ORDER = ["general", "accessibility", "design_systems", "data_viz", "interaction"];
const PERSONA_NAMES = {
  general: "General UX Lead",
  accessibility: "Accessibility Specialist",
  design_systems: "Design Systems / Consistency Lead",
  data_viz: "Information Density & Data-Viz Expert",
  interaction: "Interaction / Affordance Engineer",
};
const PERSONA_GUARDRAIL = `NOTE: screenshots may be captured programmatically (PrintWindow) of a running WinUI 3 app — minor text blur or sub-pixel rendering are CAPTURE ARTIFACTS, not design defects; do not report them as contrast/typography bugs. Intentionally subtle UI (muted helper text, correctly styled empty/warning states, low-emphasis captions) is deliberate, not broken. Only flag text that is genuinely unreadable as a real accessibility issue.`;
const PERSONA_PROMPTS = {
  general: `You are a GENERAL UX LEAD reviewing this UI screenshot of "Space Analyzer Pro" (a WinUI 3 disk-space analyzer). Take a balanced, end-to-end view of clarity and usability. Report concisely and factually (do not speculate beyond the pixels):
1. What screen this is and its primary task.
2. Concrete usability/visual problems (cite the specific control/area).
3. Top 3 fixes that most improve first-run comprehension and everyday use.`,
  accessibility: `You are an ACCESSIBILITY SPECIALIST reviewing this UI screenshot of "Space Analyzer Pro" (a WinUI 3 app). Focus on WCAG 2.1 AA: text/background contrast ratios, focus-visibility, readable font sizes, and screen-reader-friendly semantics/labels (AutomationProperties.Name on icon-only controls). Only file an issue when a real user with low vision or a keyboard-only flow would be blocked — never for stylistic subtlety. Report concisely: (1) screen, (2) real accessibility blockers, (3) top 3 fixes naming the exact control/attribute.`,
  design_systems: `You are a DESIGN SYSTEMS / CONSISTENCY LEAD reviewing this UI screenshot of "Space Analyzer Pro" (a WinUI 3 app). Focus on cross-screen consistency: shared spacing rhythm, ThemeResource/token color usage (NO hardcoded hex), button and card styles, header patterns, and reusable components. Flag deviations from the established pattern and propose the canonical Fluent 2 fix (name the exact XAML control/attribute/brush). Report concisely: (1) screen, (2) inconsistencies, (3) top 3 canonical fixes.`,
  data_viz: `You are an INFORMATION DENSITY & DATA-VIZ EXPERT reviewing this UI screenshot of "Space Analyzer Pro" (a WinUI 3 system-monitoring app). Focus on information hierarchy and scannability: whether stat cards, lists, charts, and tables let a user extract meaning at a glance, and whether density is appropriate. Report concisely: (1) screen, (2) hierarchy/scannability problems, (3) top 3 fixes improving glanceability.`,
  interaction: `You are an INTERACTION / AFFORDANCE ENGINEER reviewing this UI screenshot of "Space Analyzer Pro" (a WinUI 3 app). Focus on affordances and state communication: button hierarchy, hover/focus/pressed states, empty/loading/error states, and whether each control's purpose is obvious without trial-and-error. Report concisely: (1) screen, (2) affordance/state problems, (3) top 3 fixes naming the exact control/pattern.`,
};

function parseArgs(argv) {
  const opts = {
    prompt: process.env.VISION_PROMPT || null,
    persona: null,
    mode: 'ui',
    viewport: null,
    label: null,
    context: null,
    lines: false,
    raw: false,
    json: false,
    noStream: false,
    maxDim: DEFAULT_MAX_DIM,
    quality: DEFAULT_QUALITY,
  };
  const images = [];
  const codeFiles = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prompt') opts.prompt = argv[++i];
    else if (a === '--mode') opts.mode = (argv[++i] || 'ui');
    else if (a === '--viewport') opts.viewport = argv[++i];
    else if (a === '--label') opts.label = argv[++i];
    else if (a === '--context') opts.context = argv[++i];
    else if (a === '--max-dim') opts.maxDim = Number(argv[++i]) || DEFAULT_MAX_DIM;
    else if (a === '--quality') opts.quality = Number(argv[++i]) || DEFAULT_QUALITY;
    else if (a === '--low') { opts.maxDim = 640; opts.quality = 75; }
    else if (a === '--high') { opts.maxDim = 1280; opts.quality = 85; }
    else if (a === '--lines') opts.lines = true;
    else if (a === '--raw') opts.raw = true;
    else if (a === '--persona') opts.persona = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--no-stream') opts.noStream = true;
    else if (IMAGE_EXT.test(a)) images.push(a);
    else if (CODE_EXT.test(a)) codeFiles.push(a);
    else if (!a.startsWith('--')) {
      // Positional prompt string (documented usage: analyze shot.png [code.js...] "prompt").
      // Only the first such positional wins; --prompt takes precedence if both are given.
      if (!opts.prompt) opts.prompt = a;
    }
  }
  return { opts, images, codeFiles };
}

async function loadSharp() {
  const candidates = ['sharp'];
  try {
    const saParent = resolve(__dirname, '..', '..'); // Self-Built-Web-and-Mobile-Apps
    candidates.push(resolve(saParent, 'Moto_Monitor_(Created_June_2026)', 'node_modules', 'sharp'));
  } catch { /* ignore */ }
  if (process.env.SHARP_PATH) candidates.unshift(process.env.SHARP_PATH);
  for (const c of candidates) {
    try { return (await import(c)).default; } catch { /* try next */ }
  }
  return null;
}

async function resizeIfPossible(buf, maxDim, quality) {
  const sharp = await loadSharp();
  if (!sharp) return { buf, w: null, h: null }; // sharp unavailable: send original
  try {
    const meta = await sharp(buf).metadata();
    const scale = Math.min(1, maxDim / Math.max(meta.width || maxDim, meta.height || maxDim));
    const w = Math.round((meta.width || maxDim) * scale);
    const h = Math.round((meta.height || maxDim) * scale);
    const out = await sharp(buf).resize(w, h).jpeg({ quality }).toBuffer();
    return { buf: out, w, h };
  } catch {
    return { buf, w: null, h: null };
  }
}

async function buildCodeContext(codeFiles, withLines) {
  let ctx = '';
  for (const f of codeFiles) {
    try {
      let content = await readFile(f, 'utf8');
      const total = content.length;
      const cap = 24000;
      let body = total > cap ? content.slice(0, cap) + `\n…(truncated, ${total} bytes total)` : content;
      if (withLines) {
        body = body.split('\n').map((l, i) => `${String(i + 1).padStart(4, ' ')}|${l}`).join('\n');
      }
      ctx += `\n\n--- ${f}${withLines ? ' (line-numbered)' : ''} ---\n\`\`\`\n${body}\n\`\`\``;
    } catch (e) {
      ctx += `\n\n[could not read ${f}: ${e.message}]`;
    }
  }
  return ctx;
}

function buildMetadata(opts, images, codeFiles, dims) {
  const lines = [];
  lines.push('=== ANALYSIS CONTEXT (ground truth for the model) ===');
  if (opts.label) lines.push(`Screen/subject: ${opts.label}`);
  if (opts.viewport) lines.push(`Intended viewport / window size: ${opts.viewport} px`);
  lines.push(`Review mode: ${opts.mode}`);
  lines.push(`Image(s) provided: ${images.length} (${images.map((p, i) => `#${i + 1}=${p}`).join(', ')})`);
  const dimStr = dims.filter((d) => d.w).map((d, i) => `#${i + 1}=${d.w}x${d.h}`).join(', ');
  if (dimStr) lines.push(`Resized image dimensions sent: ${dimStr}`);
  if (codeFiles.length) lines.push(`Source code attached: ${codeFiles.join(', ')}`);
  if (opts.context) lines.push(`Additional context: ${opts.context}`);
  lines.push('=== END CONTEXT ===');
  lines.push('Use the context above to ground your analysis; do not assume viewports or screens not stated.');
  // The `winui` persona prompt already closes with an explicit "Top 3 fixes:" list,
  // so avoid appending a redundant instruction for that mode.
  if (opts.mode !== 'winui') {
    lines.push('Always end with a "Top 3 fixes:" list, most impactful first.');
  }
  return lines.join('\n');
}

// Stream tokens from Ollama's /api/generate. Returns the full response text while
// invoking `onToken(text)` for every chunk so the caller can render it live.
// In non-streaming mode (e.g. --json), onToken is not called and the full text is
// returned once at the end.
async function callOllama(prompt, payloadImages, onToken = null) {
  const useStream = typeof onToken === 'function';
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      images: payloadImages,
      stream: useStream,
      keep_alive: process.env.VISION_KEEP_ALIVE || '5m',
    }),
  });
  if (!res.ok) {
    console.error(`[vision] Ollama error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  // Non-streaming: single JSON object, return it verbatim.
  if (!useStream) {
    const j = await res.json();
    return (j.response || '').trim();
  }

  // Streaming: NDJSON, one JSON object per line. Read incrementally and flush each
  // token to the caller as it arrives so the user sees generation happen live.
  // A lightweight prefill indicator keeps stderr active during the model's warm-up
  // (small models can sit silently for several seconds before the first token).
  process.stderr.write('▷ generating');
  const spinner = setInterval(() => process.stderr.write('.'), 400);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let firstTokenAt = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const j = JSON.parse(line);
        if (j.response) {
          if (!firstTokenAt) { firstTokenAt = Date.now(); clearInterval(spinner); process.stderr.write(' done\n'); }
          full += j.response;
          onToken(j.response);
        }
      } catch { /* ignore partial frame */ }
    }
  }
  clearInterval(spinner);
  const tail = buffer.trim();
  if (tail) {
    try {
      const j = JSON.parse(tail);
      if (j.response) { full += j.response; if (!firstTokenAt) process.stderr.write(' done\n'); onToken(j.response); }
    } catch { /* ignore */ }
  }
  return full.trim();
}

// Small models occasionally return an empty/garbage token on the first try. Retry
// once with a nudge, preserving the same streaming callback.
async function callOllamaWithRetry(prompt, payloadImages, onToken = null) {
  let text = await callOllama(prompt, payloadImages, onToken);
  if ((text.length < 5 || text === '(no response)')) {
    console.error('[vision] empty/short response on first pass — retrying once with a nudge');
    text = await callOllama(prompt + '\n\n(Respond with a concrete, detailed analysis now.)', payloadImages, onToken);
  }
  return text;
}

async function analyze(argv) {
  const { opts, images, codeFiles } = parseArgs(argv);
  if (!images.length) {
    console.error('Usage: node scripts/vision.mjs analyze <img1> [img2...] [code.js...] ["prompt" | --prompt "prompt"] [--mode ui|responsive|regression|compare|winui] [--persona <name|all>] [--viewport WxH] [--label "x"] [--context "x"] [--lines] [--low|--high] [--json] [--no-stream]');
    process.exit(1);
  }

  const payloadImages = [];
  const dims = [];
  for (const p of images) {
    if (!existsSync(p)) { console.error(`[vision] missing image: ${p}`); process.exit(1); }
    const buf = await readFile(p);
    const { buf: resized, w, h } = await resizeIfPossible(buf, opts.maxDim, opts.quality);
    payloadImages.push(resized.toString('base64'));
    dims.push({ w, h });
    console.error(`[vision] ${p}: ${buf.length} -> ${resized.length} bytes${w ? ` (${w}x${h})` : ''}`);
  }

  const codeContext = await buildCodeContext(codeFiles, opts.lines);

  const meta = opts.raw ? '' : `\n\n${buildMetadata(opts, images, codeFiles, dims)}`;
  const codeBlock = codeContext ? `\n\nThe following source code is provided as context:\n${codeContext}` : '';

  // --persona all: run every specialist lens on the SAME image(s), then a
  // cross-persona consensus note. Issues flagged by >1 lens are the reliable ones.
  console.error(`[vision] model=${MODEL} mode=${opts.mode} persona=${opts.persona || '(none)'} images=${images.length} code=${codeFiles.length} maxDim=${opts.maxDim} q=${opts.quality} ${opts.json ? '(json)' : (opts.noStream ? '(buffered)' : '(streaming)')}`);

  if (opts.persona === 'all') {
    const results = [];
    for (const key of PERSONA_ORDER) {
      const lens = PERSONA_PROMPTS[key] + "\n\n" + PERSONA_GUARDRAIL;
      const finalPrompt = lens + meta + codeBlock;
      const streamOut = !opts.json && !opts.noStream;
      console.error(`[vision] ▶ lens ${key} (${PERSONA_NAMES[key]}) — streaming…`);
      if (!opts.json) writeSync(1, `\n### Persona: ${PERSONA_NAMES[key]} (${key})\n\n`);
      const text = await callOllamaWithRetry(finalPrompt, payloadImages, streamOut ? (t) => writeSync(1, t) : null);
      if (!opts.json) writeSync(1, '\n');
      results.push({ persona: key, name: PERSONA_NAMES[key] || key, analysis: text });
    }
    if (opts.json) {
      console.log(JSON.stringify({
        model: MODEL, persona: "all", label: opts.label, viewport: opts.viewport,
        images: images.map((p, i) => ({ file: p, width: dims[i].w, height: dims[i].h })),
        codeFiles, analyses: results,
      }, null, 2));
    } else {
      writeSync(1, "### Cross-persona consensus\n\nThe issues most worth acting on are those flagged by MORE THAN ONE lens above — treat them as high-confidence. Single-lens nits are lower priority. Consolidate duplicates across sections into one fix each.\n");
    }
    return;
  }

  // Single lens: explicit --persona (specialist or winui), else --mode, else 'ui'.
  const lensKey = (opts.persona && (PERSONA_PROMPTS[opts.persona] || MODE_PROMPTS[opts.persona]))
    ? opts.persona : null;
  const lens = opts.prompt
    ? opts.prompt
    : lensKey
      ? (PERSONA_PROMPTS[lensKey] ? PERSONA_PROMPTS[lensKey] + "\n\n" + PERSONA_GUARDRAIL : MODE_PROMPTS[lensKey])
      : (MODE_PROMPTS[opts.mode] || MODE_PROMPTS.ui);
  const finalPrompt = lens + meta + codeBlock;

  const streamOut = !opts.json && !opts.noStream;
  const subject = opts.label ? ` "${opts.label}"` : '';
  console.error(`[vision] ▶ analyzing${subject} — ${streamOut ? 'streaming tokens live' : 'collecting full response'}…`);
  const text = await callOllamaWithRetry(finalPrompt, payloadImages, streamOut ? (t) => writeSync(1, t) : null);
  if (streamOut) {
    writeSync(1, '\n');
  } else if (opts.json) {
    console.log(JSON.stringify({
      model: MODEL,
      mode: opts.mode,
      persona: opts.persona || null,
      label: opts.label,
      viewport: opts.viewport,
      images: images.map((p, i) => ({ file: p, width: dims[i].w, height: dims[i].h })),
      codeFiles,
      analysis: text,
    }, null, 2));
  } else {
    console.log(text);
  }
}

const cmd = process.argv[2];
if (cmd === 'analyze') {
  await analyze(process.argv.slice(3));
} else {
  console.error('Usage: node scripts/vision.mjs analyze <img1> [img2...] [code.js...] ["prompt" | --prompt "prompt"] [--mode ui|responsive|regression|compare|winui] [--persona <name|all>] [--json] [--no-stream]');
  process.exit(1);
}
