<script lang="ts">
  import { lastScanResult, type ScanResult } from '../lib/stores';

  let path = $state('C:\\');
  let maxDepth = $state<number | undefined>(undefined);
  let minSize = $state<number | undefined>(undefined);
  let maxSize = $state<number | undefined>(undefined);
  let includeHidden = $state(false);
  let followSymlinks = $state(false);
  let scanning = $state(false);
  let error = $state<string | null>(null);
  let result = $state<ScanResult | null>(null);

  async function startScan() {
    scanning = true;
    error = null;
    result = null;
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, max_depth: maxDepth, min_size: minSize, max_size: maxSize, include_hidden: includeHidden, follow_symlinks: followSymlinks }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScanResult = await res.json();
      result = data;
      lastScanResult.set(data);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      scanning = false;
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<div class="container">
  <header>
    <h1>Disk Scan</h1>
    <a href="/" class="back-link">← Back to Dashboard</a>
  </header>

  <div class="card">
    <h2>Scan Options</h2>
    <div class="form-grid">
      <label>
        <span>Path</span>
        <input type="text" bind:value={path} />
      </label>
      <label>
        <span>Max Depth</span>
        <input type="number" bind:value={maxDepth} min="1" />
      </label>
      <label>
        <span>Min Size (bytes)</span>
        <input type="number" bind:value={minSize} min="0" />
      </label>
      <label>
        <span>Max Size (bytes)</span>
        <input type="number" bind:value={maxSize} min="0" />
      </label>
      <label class="checkbox">
        <input type="checkbox" bind:checked={includeHidden} />
        <span>Include Hidden</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" bind:checked={followSymlinks} />
        <span>Follow Symlinks</span>
      </label>
    </div>
    <button onclick={startScan} disabled={scanning} class="primary">
      {scanning ? 'Scanning...' : 'Start Scan'}
    </button>
  </div>

  {#if error}
    <div class="card"><p class="status error">Error: {error}</p></div>
  {/if}

  {#if result}
    <div class="card">
      <h2>Scan Summary</h2>
      <div class="summary-grid">
        <div><span class="label">Files</span><span class="value">{result.total_files.toLocaleString()}</span></div>
        <div><span class="label">Directories</span><span class="value">{result.total_directories.toLocaleString()}</span></div>
        <div><span class="label">Total Size</span><span class="value">{formatBytes(result.total_size)}</span></div>
        <div><span class="label">Largest Files</span><span class="value">{result.largest_files.length}</span></div>
      </div>
      <a href="#/results" class="secondary">View Full Results →</a>
    </div>
  {/if}
</div>

<style>
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: #94a3b8; }
  label span { font-weight: 500; color: #e2e8f0; }
  input[type="text"], input[type="number"] { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 0.5rem; border-radius: 6px; }
  .checkbox { flex-direction: row; align-items: center; gap: 0.5rem; }
  .primary { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .primary:hover:not(:disabled) { background: #2563eb; }
  .primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin: 1rem 0; }
  .summary-grid .label { display: block; color: #94a3b8; font-size: 0.85rem; }
  .summary-grid .value { display: block; color: #e2e8f0; font-weight: 700; font-size: 1.1rem; }
  .secondary { display: inline-block; margin-top: 0.5rem; color: #60a5fa; text-decoration: none; }
  .secondary:hover { text-decoration: underline; }
</style>
