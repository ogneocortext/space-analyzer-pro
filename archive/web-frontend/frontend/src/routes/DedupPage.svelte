<script lang="ts">
  let path = $state('C:\\');
  let minFileSize = $state<number | undefined>(undefined);
  let scanning = $state(false);
  let result = $state<any | null>(null);
  let error = $state<string | null>(null);

  async function findDupes() {
    scanning = true;
    error = null;
    result = null;
    try {
      const res = await fetch('/api/dedup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, min_file_size: minFileSize }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      result = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      scanning = false;
    }
  }
</script>

<div class="container">
  <header class="page-header">
    <div class="header-content">
      <h1>Duplicate Finder</h1>
      <p class="subtitle">Find files with identical content</p>
    </div>
    <a href="#/" class="back-link">Dashboard</a>
  </header>

  <div class="card">
    <h2>Options</h2>
    <div class="form-grid">
      <label>
        <span>Path</span>
        <input type="text" bind:value={path} />
      </label>
      <label>
        <span>Min File Size (bytes)</span>
        <input type="number" bind:value={minFileSize} min="0" />
      </label>
    </div>
    <button onclick={findDupes} disabled={scanning} class="primary">
      {scanning ? 'Scanning...' : 'Find Duplicates'}
    </button>
  </div>

  {#if error}
    <div class="card"><p class="status error">Error: {error}</p></div>
  {/if}

  {#if result}
    <div class="card result-card">
      <h2>Results</h2>
      <div class="summary-bar">
        <div class="summary-item"><span class="summary-label">Files Scanned</span><span class="summary-value">{result.total_files_scanned?.toLocaleString() || '—'}</span></div>
        <div class="summary-item"><span class="summary-label">Duplicate Groups</span><span class="summary-value">{result.duplicate_groups?.length || 0}</span></div>
        <div class="summary-item"><span class="summary-label">Space Saved</span><span class="summary-value">{typeof result.space_saved === 'number' ? formatBytes(result.space_saved) : (result.space_saved || '—')}</span></div>
      </div>
      {#if result.duplicate_groups?.length}
        <div class="groups">
          {#each result.duplicate_groups as group}
            <div class="group">
              <div class="group-header">
                <span class="hash">{group.hash?.slice(0, 24) || 'unknown'}…</span>
                <span class="size">{typeof group.size === 'number' ? formatBytes(group.size) : group.size}</span>
              </div>
              <ul>
                {#each group.files as file}
                  <li>{file.path}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}
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
  .summary-bar { display: flex; gap: 1.25rem; flex-wrap: wrap; margin-bottom: 1.25rem; padding: 1rem; background: var(--bg-base); border-radius: 10px; border: 1px solid var(--border-subtle); }
  .summary-item { display: flex; flex-direction: column; gap: 0.25rem; }
  .summary-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  .summary-value { font-size: 1.25rem; color: var(--text-primary); font-weight: 700; font-variant-numeric: tabular-nums; }
  .groups { display: grid; gap: 1rem; margin-top: 1rem; }
  .group { background: var(--bg-base); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1.25rem; transition: border-color 0.2s; }
  .group:hover { border-color: var(--border-default); }
  .group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .hash { color: var(--accent-amber); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9rem; }
  .size { color: var(--accent-green); font-weight: 600; font-variant-numeric: tabular-nums; }
  ul { margin: 0; padding-left: 1.25rem; }
  li { color: var(--text-secondary); margin: 0.35rem 0; font-size: 0.95rem; word-break: break-all; }
</style>
