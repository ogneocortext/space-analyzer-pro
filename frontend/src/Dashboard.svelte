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
          <a href="#/scan" class="action-btn">Start Scan</a>
          <a href="#/results" class="action-btn">View Results</a>
          <a href="#/dedup" class="action-btn">Find Duplicates</a>
          <a href="#/large-files" class="action-btn">Large Files</a>
          <a href="#/cleanup" class="action-btn">Cleanup</a>
          <a href="#/system" class="action-btn">System Info</a>
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
                <span>{drive.mount_point}</span>
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
  h1 { margin: 0; font-size: 2rem; background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .subtitle { margin: 0.5rem 0 0; color: #94a3b8; }
  .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; }
  .sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
  .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
  h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #f1f5f9; }
  .info-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
  .info-row:last-child { border-bottom: none; }
  .label { color: #94a3b8; font-size: 0.9rem; }
  .value { color: #e2e8f0; font-weight: 600; }
  .value.ok { color: #4ade80; }
  .status { padding: 0.75rem 1rem; border-radius: 8px; }
  .status.loading { background: #334155; color: #94a3b8; }
  .status.error { background: #7f1d1d; color: #fca5a5; }
  .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; }
  .action-btn { display: block; text-align: center; padding: 0.75rem; background: #334155; color: #e2e8f0; text-decoration: none; border-radius: 8px; font-weight: 500; }
  .action-btn:hover { background: #475569; }
  .drive-list { display: grid; gap: 1rem; }
  .drive { padding: 0.75rem; background: #0f172a; border: 1px solid #334155; border-radius: 10px; }
  .drive-header { display: flex; justify-content: space-between; color: #e2e8f0; font-weight: 600; }
  .drive-meta { display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.85rem; margin-top: 0.25rem; }
  .progress { height: 8px; background: #334155; border-radius: 999px; overflow: hidden; margin-top: 0.75rem; }
  .progress-bar { height: 100%; background: linear-gradient(90deg, #60a5fa, #a78bfa); border-radius: 999px; }
  .drive-totals { display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.8rem; margin-top: 0.4rem; }
  .tips ul { margin: 0; padding-left: 1.2rem; color: #cbd5e1; line-height: 1.7; }
  .tips li { margin-bottom: 0.25rem; }
</style>