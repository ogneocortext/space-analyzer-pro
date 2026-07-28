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
  <header>
    <h1>System Info</h1>
    <a href="/" class="back-link">← Back to Dashboard</a>
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
      </div>
      <div class="card">
        <h2>Drives</h2>
        {#each system.drives as drive}
          <div class="drive">
            <div class="drive-header">
              <strong>{drive.name}</strong>
              <span class="mount">{drive.mount_point}</span>
            </div>
            <div class="info-row"><span class="label">FS</span><span class="value">{drive.file_system}</span></div>
            <div class="info-row"><span class="label">Total</span><span class="value">{formatBytes(drive.total_space)}</span></div>
            <div class="info-row"><span class="label">Free</span><span class="value">{formatBytes(drive.available_space)}</span></div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .back-link { color: #60a5fa; text-decoration: none; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
  .drive { padding: 1rem 0; border-bottom: 1px solid #334155; }
  .drive:last-child { border-bottom: none; }
  .drive-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
  .mount { color: #94a3b8; font-size: 0.9rem; }
</style>