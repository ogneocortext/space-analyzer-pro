<script lang="ts">
  import { lastScanResult, type ScanResult } from '../lib/stores';
  import { onDestroy } from 'svelte';

  let path = $state('C:\\');
  let maxDepth = $state<number | undefined>(undefined);
  let minSize = $state<number | undefined>(undefined);
  let maxSize = $state<number | undefined>(undefined);
  let includeHidden = $state(false);
  let followSymlinks = $state(false);
  let scanning = $state(false);
  let error = $state<string | null>(null);
  let result = $state<ScanResult | null>(null);
  let eventSource = $state<EventSource | null>(null);

  let progress = $state({
    filesScanned: 0,
    directoriesScanned: 0,
    totalSize: 0,
    currentFile: '',
    percentage: 0,
  });
  let recentFiles = $state<string[]>([]);

  function startScan() {
    if (scanning) return;

    scanning = true;
    error = null;
    result = null;
    recentFiles = [];
    progress = { filesScanned: 0, directoriesScanned: 0, totalSize: 0, currentFile: '', percentage: 0 };

    const params = new URLSearchParams({
      path: path,
      include_hidden: String(includeHidden),
      follow_symlinks: String(followSymlinks),
    });
    if (maxDepth !== undefined) params.set('max_depth', String(maxDepth));
    if (minSize !== undefined) params.set('min_size', String(minSize));
    if (maxSize !== undefined) params.set('max_size', String(maxSize));

    const es = new EventSource(`/api/scan/stream?${params.toString()}`);
    eventSource = es;

    es.addEventListener('progress', ((e: Event) => {
      const data = JSON.parse((e as MessageEvent).data);
      progress = {
        filesScanned: data.files_scanned,
        directoriesScanned: data.directories_scanned,
        totalSize: data.total_size,
        currentFile: data.current_file,
        percentage: data.percentage,
      };

      if (data.current_file) {
        recentFiles = [...recentFiles.slice(-49), data.current_file];
      }
    }) as EventListener);

    es.addEventListener('complete', ((e: Event) => {
      const data: ScanResult = JSON.parse((e as MessageEvent).data);
      result = data;
      lastScanResult.set(data);
      scanning = false;
      es.close();
    }) as EventListener);

    es.addEventListener('error', ((e: Event) => {
      const data = JSON.parse((e as MessageEvent).data);
      error = data.error || 'Scan failed';
      scanning = false;
      es.close();
    }) as EventListener);

    es.onerror = () => {
      if (scanning) {
        error = 'Connection lost. Scan may have been cancelled.';
        scanning = false;
      }
    };
  }

  onDestroy(() => {
    eventSource?.close();
  });

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<div class="container">
  <header class="page-header">
    <div class="header-content">
      <h1>Disk Scan</h1>
      <p class="subtitle">Scan a directory to analyze storage usage</p>
    </div>
    <a href="#/" class="back-link">Dashboard</a>
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

  {#if scanning}
    <div class="card">
      <h2>Live Scan</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress.percentage}%"></div>
      </div>
      <div class="progress-stats">
        <span>{progress.filesScanned.toLocaleString()} files</span>
        <span>{progress.directoriesScanned.toLocaleString()} dirs</span>
        <span>{formatBytes(progress.totalSize)}</span>
        <span>{progress.percentage.toFixed(1)}%</span>
      </div>
      <div class="current-file">Scanning: {progress.currentFile}</div>
      <div class="recent-files">
        {#each recentFiles as file}
          <div class="file-entry">{file}</div>
        {/each}
      </div>
    </div>
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
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); }
  .header-content h1 { margin: 0; font-size: 1.75rem; font-weight: 800; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em; }
  .subtitle { margin: 0.25rem 0 0; color: var(--text-muted); font-size: 0.95rem; }
  .back-link { color: var(--accent-blue); text-decoration: none; font-weight: 500; font-size: 0.9rem; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); transition: all 0.2s; }
  .back-link:hover { background: var(--bg-surface); border-color: var(--border-default); }
</style>

