<script lang="ts">
  import { onMount } from 'svelte';
  import { lastScanResult, type ScanResult } from '../lib/stores';

  let result = $state<ScanResult | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      loading = true;
      error = null;
      const unsub = lastScanResult.subscribe((value) => {
        result = value;
        loading = false;
      });
      return unsub;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
      loading = false;
    }
  });

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatNumber(n: number) {
    return n.toLocaleString();
  }

  const fileTypeEntries = $derived.by(() => {
    if (!result) return [];
    return Object.entries(result.file_types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  });

  const extSizeEntries = $derived.by(() => {
    if (!result) return [];
    return Object.entries(result.extension_sizes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  });

  const sizeBucketEntries = $derived.by(() => {
    if (!result) return [];
    const order = ['0 B', '< 1 KB', '1-10 KB', '10-100 KB', '100 KB-1 MB', '1-10 MB', '10-100 MB', '100 MB-1 GB', '> 1 GB'];
    return order
      .filter((k) => result.size_distribution[k] !== undefined)
      .map((k) => [k, result.size_distribution[k]] as const);
  });

  const maxBucket = $derived.by(() => {
    if (!result) return 0;
    return Math.max(1, ...Object.values(result.size_distribution));
  });

  const maxExtSize = $derived.by(() => {
    if (!result) return 0;
    return Math.max(1, ...Object.values(result.extension_sizes));
  });

  let searchQuery = $state('');
  let showSubdirs = $state(true);
  let showEmptyDirs = $state(true);
  let showErrors = $state(true);

  const filteredLargestFiles = $derived.by(() => {
    if (!result || !searchQuery.trim()) return result?.largest_files || [];
    const q = searchQuery.toLowerCase();
    return (result.largest_files || []).filter(
      (f) => (f.name || f.path || '').toLowerCase().includes(q)
    );
  });

  const filteredSubdirectories = $derived.by(() => {
    if (!result || !searchQuery.trim()) return result?.subdirectories || [];
    const q = searchQuery.toLowerCase();
    return (result.subdirectories || []).filter((d) => d.path.toLowerCase().includes(q));
  });

  const filteredEmptyDirs = $derived.by(() => {
    if (!result || !searchQuery.trim()) return result?.empty_directories || [];
    const q = searchQuery.toLowerCase();
    return (result.empty_directories || []).filter((d) => d.toLowerCase().includes(q));
  });

  const filteredErrors = $derived.by(() => {
    if (!result || !searchQuery.trim()) return result?.errors || [];
    const q = searchQuery.toLowerCase();
    return (result.errors || []).filter((e) => e.toLowerCase().includes(q));
  });

  const totalByType = $derived.by(() => {
    if (!result) return 0;
    return Object.values(result.file_types).reduce((a, b) => a + b, 0);
  });
</script>

<div class="results-page">
  <header class="page-header">
    <div class="header-content">
      <h1>Scan Results</h1>
      <p class="subtitle">Detailed analysis of your storage usage</p>
    </div>
    <a href="#/" class="back-link">← Dashboard</a>
  </header>

  {#if loading}
    <div class="state-card loading-state">
      <div class="spinner"></div>
      <p>Loading scan results...</p>
    </div>
  {:else if error}
    <div class="state-card error-state">
      <span class="icon">⚠️</span>
      <p>Error: {error}</p>
    </div>
  {:else if result}
    <!-- Summary Cards -->
    <section class="summary-section">
      <div class="summary-grid">
        <div class="summary-card files">
          <div class="card-icon">📄</div>
          <div class="card-content">
            <span class="label">Total Files</span>
            <span class="value">{formatNumber(result.total_files)}</span>
          </div>
        </div>
        <div class="summary-card dirs">
          <div class="card-icon">📁</div>
          <div class="card-content">
            <span class="label">Directories</span>
            <span class="value">{formatNumber(result.total_directories)}</span>
          </div>
        </div>
        <div class="summary-card size">
          <div class="card-icon">💾</div>
          <div class="card-content">
            <span class="label">Total Size</span>
            <span class="value">{formatBytes(result.total_size)}</span>
          </div>
        </div>
        <div class="summary-card large">
          <div class="card-icon">🔍</div>
          <div class="card-content">
            <span class="label">Largest Files</span>
            <span class="value">{formatNumber(result.largest_files.length)}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Size Distribution -->
    {#if sizeBucketEntries.length}
      <section class="section">
        <div class="card distribution-card">
          <h2 class="section-title">📊 Size Distribution</h2>
          <div class="buckets">
            {#each sizeBucketEntries as [label, count]}
              {@const pct = maxBucket > 0 ? Math.round((count / maxBucket) * 100) : 0}
              <div class="bucket">
                <div class="bucket-header">
                  <span class="bucket-label">{label}</span>
                  <span class="bucket-count">{formatNumber(count)} <span class="bucket-pct">{pct}%</span></span>
                </div>
                <div class="bar">
                  <div class="fill" style="width: {pct}%"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </section>
    {/if}

    <!-- File Types & Largest Files -->
    <section class="section two-col-section">
      <div class="card types-card">
        <h2 class="section-title">📑 File Types</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Extension</th>
                <th class="num">Count</th>
                <th class="num">Total Size</th>
                <th class="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {#each fileTypeEntries as [ext, count]}
                {@const size = result.extension_sizes[ext] || 0}
                {@const pct = totalByType > 0 ? ((count / totalByType) * 100).toFixed(1) : '0.0'}
                <tr>
                  <td class="ext">.{ext}</td>
                  <td class="num">{formatNumber(count)}</td>
                  <td class="num">{formatBytes(size)}</td>
                  <td class="num">
                    <div class="mini-bar">
                      <div class="mini-fill" style="width: {pct}%"></div>
                    </div>
                    <span class="mini-pct">{pct}%</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card largest-card">
        <h2 class="section-title">🏆 Largest Files</h2>
        <div class="search-box">
          <input
            type="text"
            placeholder="Search files..."
            bind:value={searchQuery}
            class="search-input"
          />
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th class="num">Size</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {#if filteredLargestFiles.length === 0}
                <tr class="empty-row">
                  <td colspan="3" class="empty-cell">No matching files</td>
                </tr>
              {/if}
              {#each filteredLargestFiles as file}
                <tr>
                  <td class="path" title={file.path}>{file.name || file.path}</td>
                  <td class="num">{formatBytes(file.size)}</td>
                  <td class="num">{file.modified || 'Unknown'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Subdirectories -->
    {#if result.subdirectories.length}
      <section class="section collapsible">
        <div class="card subdirs-card">
          <button class="section-header" onclick={() => (showSubdirs = !showSubdirs)}>
            <h2 class="section-title">📂 Top Subdirectories</h2>
            <span class="toggle">{showSubdirs ? '▼' : '▶'}</span>
          </button>
          {#if showSubdirs}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Directory</th>
                    <th class="num">Size</th>
                    <th class="num">Files</th>
                    <th class="num">Dirs</th>
                  </tr>
                </thead>
                <tbody>
                  {#each result.subdirectories.slice(0, 50) as dir}
                    <tr>
                      <td class="path" title={dir.path}>{dir.path}</td>
                      <td class="num">{formatBytes(dir.total_size)}</td>
                      <td class="num">{formatNumber(dir.file_count)}</td>
                      <td class="num">{formatNumber(dir.dir_count)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- Empty Directories -->
    {#if result.empty_directories.length}
      <section class="section collapsible">
        <div class="card empty-card">
          <button class="section-header" onclick={() => (showEmptyDirs = !showEmptyDirs)}>
            <h2 class="section-title">🗑️ Empty Directories</h2>
            <span class="toggle">{showEmptyDirs ? '▼' : '▶'}</span>
          </button>
          {#if showEmptyDirs}
            <div class="empty-list">
              {#each result.empty_directories as dir}
                <span class="empty-tag">{dir}</span>
              {/each}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- Errors -->
    {#if result.errors.length}
      <section class="section collapsible">
        <div class="card errors-card">
          <button class="section-header" onclick={() => (showErrors = !showErrors)}>
            <h2 class="section-title">⚠️ Errors</h2>
            <span class="badge">{result.errors.length}</span>
            <span class="toggle">{showErrors ? '▼' : '▶'}</span>
          </button>
          {#if showErrors}
            <ul class="errors-list">
              {#each result.errors as err}
                <li>{err}</li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    {/if}
  {:else}
    <div class="state-card empty-state">
      <span class="icon">📭</span>
      <p>No scan results yet.</p>
      <a href="#/scan" class="cta-link">Run a scan →</a>
    </div>
  {/if}
</div>

<style>
  .results-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #1e293b;
  }
  .header-content h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }
  .subtitle {
    margin: 0.25rem 0 0;
    color: #94a3b8;
    font-size: 0.95rem;
  }
  .back-link {
    color: #60a5fa;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #1e293b;
    transition: all 0.2s;
  }
  .back-link:hover {
    background: #1e293b;
    border-color: #334155;
  }

  /* State cards */
  .state-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    border-radius: 12px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-size: 1rem;
  }
  .state-card .icon {
    font-size: 2rem;
  }
  .loading-state .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #334155;
    border-top-color: #60a5fa;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .error-state {
    border-color: #7f1d1d;
    background: #1c1517;
    color: #fca5a5;
  }
  .empty-state {
    flex-direction: column;
    gap: 0.75rem;
  }
  .empty-state .icon {
    font-size: 3rem;
    opacity: 0.8;
  }
  .cta-link {
    color: #60a5fa;
    text-decoration: none;
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid #60a5fa;
    transition: all 0.2s;
  }
  .cta-link:hover {
    background: rgba(96, 165, 250, 0.1);
  }

  /* Summary cards */
  .summary-section {
    margin-bottom: 1.5rem;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }
  .summary-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-radius: 12px;
    background: #1e293b;
    border: 1px solid #334155;
    transition: transform 0.2s, border-color 0.2s;
  }
  .summary-card:hover {
    transform: translateY(-2px);
    border-color: #475569;
  }
  .card-icon {
    font-size: 2rem;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: #0f172a;
    flex-shrink: 0;
  }
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    font-weight: 600;
  }
  .value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: -0.01em;
  }
  .summary-card.files .card-icon { background: rgba(96, 165, 250, 0.1); }
  .summary-card.dirs .card-icon { background: rgba(167, 139, 250, 0.1); }
  .summary-card.size .card-icon { background: rgba(52, 211, 153, 0.1); }
  .summary-card.large .card-icon { background: rgba(251, 191, 36, 0.1); }

  /* Sections */
  .section {
    margin-top: 1.5rem;
  }
  .two-col-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 1.5rem;
  }
  .section-title {
    margin: 0 0 1.25rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    font-family: inherit;
  }
  .section-header .section-title {
    margin: 0;
  }
  .toggle {
    color: #94a3b8;
    font-size: 0.75rem;
    transition: transform 0.2s;
  }
  .badge {
    background: #334155;
    color: #e2e8f0;
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-weight: 600;
  }

  /* Size distribution */
  .distribution-card {
    background: linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(30, 41, 59, 1) 100%);
  }
  .buckets {
    display: grid;
    gap: 0.85rem;
  }
  .bucket {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .bucket-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }
  .bucket-label {
    color: #cbd5e1;
    font-weight: 500;
  }
  .bucket-count {
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }
  .bucket-pct {
    color: #64748b;
    font-size: 0.8rem;
    margin-left: 0.35rem;
  }
  .bar {
    height: 10px;
    background: #0f172a;
    border-radius: 999px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, #60a5fa, #a78bfa);
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  /* Tables */
  .table-wrap {
    overflow-x: auto;
    max-height: 420px;
    overflow-y: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th, td {
    text-align: left;
    padding: 0.65rem 0.6rem;
    border-bottom: 1px solid #334155;
    color: #cbd5e1;
    white-space: nowrap;
  }
  th {
    color: #94a3b8;
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    position: sticky;
    top: 0;
    background: #1e293b;
    z-index: 1;
  }
  tbody tr {
    transition: background 0.15s;
  }
  tbody tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }
  td.path {
    color: #e2e8f0;
    word-break: break-all;
    white-space: normal;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  td.ext {
    color: #60a5fa;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  th.num {
    text-align: right;
  }
  .empty-row .empty-cell {
    text-align: center;
    color: #64748b;
    padding: 2rem;
    font-style: italic;
  }

  /* Mini bar in file types */
  .mini-bar {
    display: inline-block;
    width: 60px;
    height: 6px;
    background: #0f172a;
    border-radius: 999px;
    overflow: hidden;
    vertical-align: middle;
    margin-right: 0.5rem;
  }
  .mini-fill {
    height: 100%;
    background: linear-gradient(90deg, #60a5fa, #a78bfa);
    border-radius: 999px;
    transition: width 0.3s ease;
  }
  .mini-pct {
    font-size: 0.8rem;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }

  /* Search */
  .search-box {
    margin-bottom: 1rem;
  }
  .search-input {
    width: 100%;
    padding: 0.6rem 0.9rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }
  .search-input::placeholder {
    color: #64748b;
  }
  .search-input:focus {
    border-color: #60a5fa;
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
  }

  /* Empty dirs tags */
  .empty-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .empty-tag {
    background: #0f172a;
    border: 1px solid #334155;
    color: #cbd5e1;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  /* Errors */
  .errors-list {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
    color: #fca5a5;
    display: grid;
    gap: 0.4rem;
  }
  .errors-list li {
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .errors-card {
    border-color: #7f1d1d;
    background: linear-gradient(180deg, rgba(28, 21, 23, 0.8) 0%, rgba(28, 21, 23, 1) 100%);
  }
  .errors-card .section-title {
    color: #fca5a5;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .two-col-section {
      grid-template-columns: 1fr;
    }
    .summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 560px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }
    .page-header {
      flex-direction: column;
      gap: 0.75rem;
    }
  }
</style>
