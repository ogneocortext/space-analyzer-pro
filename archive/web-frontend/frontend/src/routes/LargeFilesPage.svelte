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
  <header class="page-header">
    <div class="header-content">
      <h1>Large Files</h1>
      <p class="subtitle">Find files larger than a threshold</p>
    </div>
    <a href="#/" class="back-link">Dashboard</a>
  </header>

  <div class="card">
    <h2>Search Options</h2>
    <div class="form-grid">
      <label>
        <span>Path</span>
        <input type="text" bind:value={path} />
      </label>
      <label>
        <span>Min Size</span>
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
    <div class="card result-card">
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
                <td class="size">{formatBytes(file.size)}</td>
                <td class="num">{file.modified || 'Unknown'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); }
  .header-content h1 { margin: 0; font-size: 1.75rem; font-weight: 800; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em; }
  .subtitle { margin: 0.25rem 0 0; color: var(--text-muted); font-size: 0.95rem; }
  .back-link { color: var(--accent-blue); text-decoration: none; font-weight: 500; font-size: 0.9rem; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); transition: all 0.2s; }
  .back-link:hover { background: var(--bg-surface); border-color: var(--border-default); }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; margin-bottom: 1.25rem; }
  label { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; color: var(--text-muted); }
  label span { font-weight: 600; color: var(--text-primary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  input[type="text"], input[type="number"] { background: var(--bg-base); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 0.75rem 1rem; border-radius: 10px; transition: all 0.2s; }
  input[type="text"]:focus, input[type="number"]:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15); outline: none; }
  .primary { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: white; border: none; padding: 0.85rem 2rem; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); min-height: 48px; }
  .primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-md); filter: brightness(1.1); }
  .primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .status { margin: 0; }
  .status.error { color: var(--accent-rose); }
  .result-card { margin-top: 1.25rem; }
  .table-wrap { overflow-x: auto; max-height: 520px; overflow-y: auto; border-radius: 10px; border: 1px solid var(--border-subtle); }
  table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
  th, td { text-align: left; padding: 0.75rem 0.85rem; border-bottom: 1px solid var(--border-subtle); }
  th { color: var(--text-muted); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; position: sticky; top: 0; background: var(--bg-surface); z-index: 1; }
  tbody tr { transition: background 0.15s; }
  tbody tr:hover { background: rgba(255, 255, 255, 0.03); }
  td.name { color: var(--text-primary); font-weight: 600; }
  td.path { color: var(--text-muted); word-break: break-all; white-space: normal; }
  td.size { color: var(--accent-green); font-weight: 600; font-variant-numeric: tabular-nums; }
  td.num { color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>

