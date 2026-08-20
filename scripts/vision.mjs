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
// Flags: --prompt, --mode ui|responsive|regression|compare, --viewport WxH,
//   --label "text", --context "text", --lines (number code context), --low (640px),
//   --high (1280px), --max-dim N, --quality N, --raw (no auto metadata), --json
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

function parseArgs(argv) {
  const opts = {
    prompt: process.env.VISION_PROMPT || null,
    mode: 'ui',
    viewport: null,
    label: null,
    context: null,
    lines: false,
    raw: false,
    json: false,
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
    else if (a === '--json') opts.json = true;
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
  lines.push('Always end with a "Top 3 fixes:" list, most impactful first.');
  return lines.join('\n');
}

async function callOllama(prompt, payloadImages, attempt = 1) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      images: payloadImages,
      stream: false,
      keep_alive: process.env.VISION_KEEP_ALIVE || '5m',
    }),
  });
  if (!res.ok) {
    console.error(`[vision] Ollama error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const j = await res.json();
  let text = (j.response || '').trim();
  // Small models occasionally return an empty/garbage token on the first try.
  if ((text.length < 5 || text === '(no response)') && attempt === 1) {
    console.error('[vision] empty/short response on first pass — retrying once with a nudge');
    return callOllama(prompt + '\n\n(Respond with a concrete, detailed analysis now.)', payloadImages, 2);
  }
  return text;
}

async function analyze(argv) {
  const { opts, images, codeFiles } = parseArgs(argv);
  if (!images.length) {
    console.error('Usage: node scripts/vision.mjs analyze <img1> [img2...] [code.js...] ["prompt" | --prompt "prompt"] [--mode ui|responsive|regression|compare] [--viewport WxH] [--label "x"] [--context "x"] [--lines] [--low|--high]');
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

  const basePrompt = opts.prompt || MODE_PROMPTS[opts.mode] || MODE_PROMPTS.ui;
  const meta = opts.raw ? '' : `\n\n${buildMetadata(opts, images, codeFiles, dims)}`;
  const finalPrompt = basePrompt + meta +
    (codeContext ? `\n\nThe following source code is provided as context:\n${codeContext}` : '');

  console.error(`[vision] model=${MODEL} mode=${opts.mode} images=${images.length} codeFiles=${codeFiles.length} maxDim=${opts.maxDim} q=${opts.quality}`);
  const text = await callOllama(finalPrompt, payloadImages);

  if (opts.json) {
    console.log(JSON.stringify({
      model: MODEL,
      mode: opts.mode,
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
  console.error('Usage: node scripts/vision.mjs analyze <img1> [img2...] [code.js...] ["prompt" | --prompt "prompt"]');
  process.exit(1);
}
