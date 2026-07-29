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
  <header class="page-header">
    <div class="header-content">
      <h1>Cleanup Recommendations</h1>
      <p class="subtitle">Analyze your storage and find cleanup opportunities</p>
    </div>
    <a href="#/" class="back-link">Dashboard</a>
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
    <div class="card result-card">
      <h2>Suggestions</h2>
      <div class="suggestion-list">
        {#each suggestions as suggestion}
          {@const category = getCategory(suggestion)}
          <div class="suggestion-item {category}">
            <span class="suggestion-icon">{getIcon(category)}</span>
            <span class="suggestion-text">{suggestion}</span>
          </div>
        {/each}
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
  input[type="text"] { background: var(--bg-base); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 0.75rem 1rem; border-radius: 10px; transition: all 0.2s; }
  input[type="text"]:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15); outline: none; }
  .primary { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: white; border: none; padding: 0.85rem 2rem; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); min-height: 48px; }
  .primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-md); filter: brightness(1.1); }
  .primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .status { margin: 0; }
  .status.error { color: var(--accent-rose); }
  .result-card { margin-top: 1.25rem; }
  .suggestion-list { display: grid; gap: 0.75rem; }
  .suggestion-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem 1.25rem; background: var(--bg-base); border: 1px solid var(--border-subtle); border-radius: 12px; transition: all 0.2s; }
  .suggestion-item:hover { border-color: var(--border-default); transform: translateX(4px); }
  .suggestion-icon { font-size: 1.25rem; flex-shrink: 0; }
  .suggestion-text { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; }
  .suggestion-item.empty { border-left: 3px solid var(--accent-rose); }
  .suggestion-item.temp { border-left: 3px solid var(--accent-blue); }
  .suggestion-item.old { border-left: 3px solid var(--accent-purple); }
  .suggestion-item.logs { border-left: 3px solid var(--accent-amber); }
  .suggestion-item.build { border-left: 3px solid #f472b6; }
  .suggestion-item.large { border-left: 3px solid var(--accent-green); }
  .suggestion-item.concentration { border-left: 3px solid #22d3ee; }
  .suggestion-item.errors { border-left: 3px solid var(--accent-rose); }
  .suggestion-item.general { border-left: 3px solid var(--border-default); }
</style>

