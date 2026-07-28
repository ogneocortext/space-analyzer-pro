<script lang="ts">
  let path = $state('C:\\');
  let minSize = $state(100 * 1024 * 1024); // 100MB default
  let files = $state<Array<{ path: string; name: string; size: number; modified: string | null; extension: string }>>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function loadFiles() {
    loading = true;
    error = null;
    files = [];
    try {
      const res = await fetch(`/api/large-files?path=${encodeURIComponent(path)}&min_size=${minSize}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      files = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
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
    <h1>Large Files</h1>
    <a href="/" class="back-link">← Dashboard</a>
  </header>

  <div class="card">
    <h2>Search Options</h2>
    <div class="form-grid">
      <label>
        <span>Path</span>
        <input type="text" bind:value={path} />
      </label>
      <label>
        <span>Min Size (bytes)</span>
        <input type="number" bind:value={minSize} min="0" step={1024 * 1024} />
      </label>
    </div>
    <button onclick={loadFiles} disabled={loading} class="primary">
      {loading ? 'Scanning...' : 'Find Large Files'}
    </button>
  </div>

  {#if error}
    <div class="card"><p class="status error">Error: {error}</p></div>
  {/if}

  {#if files.length}
    <div class="card">
      <h2>Results ({files.length} files ≥ {formatBytes(minSize)})</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Path</th><th>Size</th><th>Modified</th></tr>
          </thead>
          <tbody>
            {#each files as file}
              <tr>
                <td class="name">{file.name || file.path}</td>
                <td class="path">{file.path}</td>
                <td>{formatBytes(file.size)}</td>
                <td>{file.modified || 'Unknown'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: #94a3b8; }
  label span { font-weight: 500; color: #e2e8f0; }
  input[type="text"], input[type="number"] { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 0.5rem; border-radius: 6px; }
  .primary { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .primary:hover:not(:disabled) { background: #2563eb; }
  .primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
  th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid #334155; color: #cbd5e1; }
  th { color: #94a3b8; font-weight: 600; }
  td.name { color: #e2e8f0; font-weight: 500; }
  td.path { color: #94a3b8; word-break: break-all; }
</style>
