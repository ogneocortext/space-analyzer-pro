<script lang="ts">
  let health = $state<{ status: string; version: string } | null>(null);
  let system = $state<any | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function checkHealth() {
    try {
      loading = true;
      error = null;
      const [healthRes, systemRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/system'),
      ]);
      if (!healthRes.ok) throw new Error(`Health HTTP ${healthRes.status}`);
      if (!systemRes.ok) throw new Error(`System HTTP ${systemRes.status}`);
      health = await healthRes.json();
      system = await systemRes.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    checkHealth();
  });

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<div class="dashboard">
  <header>
    <h1>Space Analyzer Pro</h1>
    <p class="subtitle">Rust-Powered Disk Analytics Dashboard</p>
  </header>

  {#if loading}
    <div class="card"><p class="status loading">Loading...</p></div>
  {:else if error}
    <div class="card"><p class="status error">Error: {error}</p></div>
  {:else if health && system}
    <div class="dashboard-grid">
      <div class="card">
        <h2>System Health</h2>
        <div class="info-row"><span class="label">Status</span><span class="value ok">{health.status}</span></div>
        <div class="info-row"><span class="label">Version</span><span class="value">{health.version}</span></div>
        <div class="info-row"><span class="label">Backend</span><span class="value">Axum / Rust</span></div>
      </div>
      <div class="card">
        <h2>System</h2>
        <div class="info-row"><span class="label">OS</span><span class="value">{system.os}</span></div>
        <div class="info-row"><span class="label">Arch</span><span class="value">{system.arch}</span></div>
        <div class="info-row"><span class="label">CPU Cores</span><span class="value">{system.cpu_cores}</span></div>
        <div class="info-row"><span class="label">Memory</span><span class="value">{formatBytes(system.total_memory)}</span></div>
        <div class="info-row"><span class="label">Available</span><span class="value">{formatBytes(system.available_memory)}</span></div>
      </div>
      <div class="card">
        <h2>Quick Actions</h2>
        <div class="actions">
          <a href="#/scan" class="action-btn">Scan</a>
          <a href="#/results" class="action-btn">Results</a>
          <a href="#/dedup" class="action-btn">Duplicates</a>
          <a href="#/large-files" class="action-btn">Large Files</a>
          <a href="#/cleanup" class="action-btn">Cleanup</a>
          <a href="#/system" class="action-btn">System</a>
          <a href="#/ai" class="action-btn">AI Chat</a>
        </div>
      </div>
    </div>

    <div class="sections">
      <div class="card storage">
        <h2>Storage Overview</h2>
        <div class="drive-list">
          {#each system.drives as drive}
            <div class="drive">
              <div class="drive-header">
                <strong>{drive.name || drive.mount_point}</strong>
                <span class="mount">{drive.mount_point}</span>
              </div>
              <div class="drive-meta">
                <span>{drive.file_system}</span>
                <span>{formatBytes(drive.available_space)} free</span>
              </div>
              <div class="progress">
                <div class="progress-bar" style="width: {drive.total_space > 0 ? ((drive.total_space - drive.available_space) / drive.total_space * 100).toFixed(1) : 0}%"></div>
              </div>
              <div class="drive-totals">
                <span>Total {formatBytes(drive.total_space)}</span>
                <span>{drive.total_space > 0 ? ((drive.total_space - drive.available_space) / drive.total_space * 100).toFixed(1) : 0}% used</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="card tips">
        <h2>Tips</h2>
        <ul>
          <li>Use <strong>Scan</strong> to analyze directory size and large files.</li>
          <li>Use <strong>Duplicates</strong> to find files with identical content.</li>
          <li>Use <strong>AI Chat</strong> to ask for cleanup recommendations.</li>
          <li>Use <strong>System Info</strong> to review drives and memory.</li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard { max-width: 1200px; margin: 0 auto; }
  h1 { margin: 0; font-size: 2rem; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.02em; }
  .subtitle { margin: 0.5rem 0 0; color: var(--text-muted); font-size: 1rem; }
  .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
  .sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem; margin-top: 1.5rem; }
  .card { background: var(--bg-surface); border-radius: 16px; padding: 1.5rem; border: 1px solid var(--border-subtle); box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
  .card:hover { border-color: var(--border-default); box-shadow: var(--shadow-md); }
  h2 { margin: 0 0 1.25rem; font-size: 1.05rem; color: var(--text-primary); font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--border-subtle); }
  .info-row:last-child { border-bottom: none; }
  .label { color: var(--text-muted); font-size: 0.9rem; }
  .value { color: var(--text-primary); font-weight: 600; }
  .value.ok { color: var(--accent-green); }
  .status { padding: 0.75rem 1rem; border-radius: 8px; }
  .status.loading { background: var(--bg-surface); color: var(--text-muted); }
  .status.error { background: rgba(248, 113, 113, 0.1); color: var(--accent-rose); border: 1px solid rgba(248, 113, 113, 0.2); }
  .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; }
  .action-btn { display: flex; align-items: center; justify-content: center; padding: 0.85rem 0.5rem; background: var(--bg-elevated); color: var(--text-primary); text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; border: 1px solid var(--border-subtle); transition: all 0.2s; text-align: center; min-height: 48px; }
  .action-btn:hover { background: #475569; border-color: var(--border-default); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .drive-list { display: grid; gap: 1rem; }
  .drive { padding: 1rem; background: var(--bg-base); border: 1px solid var(--border-subtle); border-radius: 12px; transition: border-color 0.2s; }
  .drive:hover { border-color: var(--border-default); }
  .drive-header { display: flex; justify-content: space-between; align-items: center; color: var(--text-primary); font-weight: 600; margin-bottom: 0.25rem; }
  .drive-meta { display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; }
  .progress { height: 10px; background: var(--bg-elevated); border-radius: 999px; overflow: hidden; margin-top: 0.75rem; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25); }
  .progress-bar { height: 100%; background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple)); border-radius: 999px; transition: width 0.4s ease; }
  .drive-totals { display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem; font-variant-numeric: tabular-nums; }
  .tips ul { margin: 0; padding-left: 1.2rem; color: var(--text-secondary); line-height: 1.8; }
  .tips li { margin-bottom: 0.35rem; }
  .tips strong { color: var(--accent-blue); font-weight: 600; }
</style>
