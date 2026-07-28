<script lang="ts">
  let path = $state('C:\\');
  let suggestions = $state<string[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function loadSuggestions() {
    loading = true;
    error = null;
    suggestions = [];
    try {
      const res = await fetch(`/api/cleanup/suggestions?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      suggestions = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }
</script>

<div class="container">
  <header>
    <h1>Cleanup Recommendations</h1>
    <a href="/" class="back-link">← Dashboard</a>
  </header>

  <div class="card">
    <h2>Analyze Path</h2>
    <div class="form-grid">
      <label>
        <span>Path</span>
        <input type="text" bind:value={path} />
      </label>
    </div>
    <button onclick={loadSuggestions} disabled={loading} class="primary">
      {loading ? 'Analyzing...' : 'Get Suggestions'}
    </button>
  </div>

  {#if error}
    <div class="card"><p class="status error">Error: {error}</p></div>
  {/if}

  {#if suggestions.length}
    <div class="card">
      <h2>Suggestions</h2>
      <ul>
        {#each suggestions as suggestion}
          <li>{suggestion}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: #94a3b8; }
  label span { font-weight: 500; color: #e2e8f0; }
  input[type="text"] { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 0.5rem; border-radius: 6px; }
  .primary { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .primary:hover:not(:disabled) { background: #2563eb; }
  .primary:disabled { opacity: 0.6; cursor: not-allowed; }
  ul { margin: 0; padding-left: 1.25rem; color: #cbd5e1; line-height: 1.7; }
  li { margin-bottom: 0.35rem; }
</style>
