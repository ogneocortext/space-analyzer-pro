<script lang="ts">
  let system = $state<{ os: string; arch: string; total_memory: number; available_memory: number; cpu_cores: number; drives: Array<{ name: string; mount_point: string; total_space: number; available_space: number }> } | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function loadSystem() {
    try {
      loading = true;
      error = null;
      const res = await fetch('/api/system');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      system = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadSystem();
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
      <h1>System Info</h1>
      <p class="subtitle">Hardware, OS, and drive overview</p>
    </div>
    <a href="#/" class="back-link">Dashboard</a>
  </header>

  {#if loading}
    <div class="card"><p class="status loading">Loading system info...</p></div>
  {:else if error}
    <div class="card"><p class="status error">Error: {error}</p></div>
  {:else if system}
    <div class="grid">
      <div class="card">
        <h2>OS / Arch</h2>
        <div class="info-row"><span class="label">OS</span><span class="value">{system.os}</span></div>
        <div class="info-row"><span class="label">Arch</span><span class="value">{system.arch}</span></div>
        <div class="info-row"><span class="label">CPU Cores</span><span class="value">{system.cpu_cores}</span></div>
      </div>
      <div class="card">
        <h2>Memory</h2>
        <div class="info-row"><span class="label">Total</span><span class="value">{formatBytes(system.total_memory)}</span></div>
        <div class="info-row"><span class="label">Available</span><span class="value">{formatBytes(system.available_memory)}</span></div>
        {#if system.total_memory > 0}
          {@const usedPct = ((system.total_memory - system.available_memory) / system.total_memory * 100).toFixed(1)}
          <div class="mini-progress"><div class="mini-fill" style="width: {usedPct}%"></div></div>
          <div class="mini-caption">{usedPct}% used</div>
        {/if}
      </div>
      <div class="card">
        <h2>Drives</h2>
        {#each system.drives as drive}
          <div class="drive">
            <div class="drive-header">
              <strong>{drive.name}</strong>
              <span class="mount">{drive.mount_point}</span>
            </div>
            <div class="drive-meta">
              <span>{drive.file_system}</span>
              <span>{formatBytes(drive.available_space)} free</span>
            </div>
            {#if drive.total_space > 0}
              {@const usedPct = ((drive.total_space - drive.available_space) / drive.total_space * 100).toFixed(1)}
              <div class="mini-progress"><div class="mini-fill drive-fill" style="width: {usedPct}%"></div></div>
              <div class="drive-totals">
                <span>Total {formatBytes(drive.total_space)}</span>
                <span>{usedPct}% used</span>
              </div>
            {/if}
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
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; }
  .status { margin: 0; }
  .status.loading { color: var(--text-muted); }
  .status.error { color: var(--accent-rose); }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--border-subtle); }
  .info-row:last-child { border-bottom: none; }
  .label { color: var(--text-muted); font-size: 0.9rem; }
  .value { color: var(--text-primary); font-weight: 600; }
  .mini-progress { height: 8px; background: var(--bg-elevated); border-radius: 999px; overflow: hidden; margin-top: 0.75rem; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25); }
  .mini-fill { height: 100%; background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple)); border-radius: 999px; transition: width 0.4s ease; }
  .mini-fill.drive-fill { background: linear-gradient(90deg, #f472b6, var(--accent-purple)); }
  .mini-caption { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.35rem; text-align: right; }
  .drive { padding: 1rem 0; border-bottom: 1px solid var(--border-subtle); }
  .drive:last-child { border-bottom: none; }
  .drive-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
  .mount { color: var(--text-muted); font-size: 0.9rem; }
  .drive-meta { display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; }
  .drive-totals { display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.4rem; font-variant-numeric: tabular-nums; }
</style>
