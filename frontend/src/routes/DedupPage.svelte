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
  <header>
    <h1>Duplicate Finder</h1>
    <a href="/" class="back-link">← Back to Dashboard</a>
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
    <div class="card">
      <h2>Results</h2>
      <p class="summary">Scanned: {result.total_files_scanned} | Duplicate Groups: {result.duplicate_groups.length} | Space Saved: {result.space_saved} bytes</p>
      {#each result.duplicate_groups as group}
        <div class="group">
          <div class="group-header">
            <span class="hash">{group.hash.slice(0, 16)}...</span>
            <span class="size">{group.size} bytes</span>
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

<style>
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: #94a3b8; }
  label span { font-weight: 500; color: #e2e8f0; }
  input[type="text"], input[type="number"] { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 0.5rem; border-radius: 6px; }
  .primary { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .primary:hover:not(:disabled) { background: #2563eb; }
  .primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .summary { color: #94a3b8; margin-bottom: 1rem; }
  .group { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .group-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
  .hash { color: #f59e0b; font-family: monospace; }
  .size { color: #4ade80; }
  ul { margin: 0; padding-left: 1.25rem; }
  li { color: #cbd5e1; margin: 0.25rem 0; }
</style>