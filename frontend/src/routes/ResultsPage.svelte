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
</script>

<div class="container">
  <header>
    <h1>Scan Results</h1>
    <a href="/" class="back-link">← Dashboard</a>
  </header>

  {#if loading}
    <div class="card"><p class="status loading">Loading...</p></div>
  {:else if error}
    <div class="card"><p class="status error">Error: {error}</p></div>
  {:else if result}
    <div class="summary-grid">
      <div class="card">
        <h2>Total Files</h2>
        <p class="big">{result.total_files.toLocaleString()}</p>
      </div>
      <div class="card">
        <h2>Directories</h2>
        <p class="big">{result.total_directories.toLocaleString()}</p>
      </div>
      <div class="card">
        <h2>Total Size</h2>
        <p class="big">{formatBytes(result.total_size)}</p>
      </div>
      <div class="card">
        <h2>Largest Files</h2>
        <p class="big">{result.largest_files.length}</p>
      </div>
    </div>

    {#if sizeBucketEntries.length}
      <div class="card">
        <h2>Size Distribution</h2>
        <div class="buckets">
          {#each sizeBucketEntries as [label, count]}
            <div class="bucket">
              <div class="bucket-label">
                <span>{label}</span>
                <span class="count">{count.toLocaleString()}</span>
              </div>
              <div class="bar">
                <div class="fill" style="width: {(count / maxBucket) * 100}%"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="two-col">
      <div class="card">
        <h2>File Types</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Extension</th><th>Count</th><th>Total Size</th></tr>
            </thead>
            <tbody>
              {#each fileTypeEntries as [ext, count]}
                <tr>
                  <td>.{ext}</td>
                  <td>{count.toLocaleString()}</td>
                  <td>{formatBytes(result.extension_sizes[ext] || 0)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>Largest Files</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Size</th><th>Modified</th></tr>
            </thead>
            <tbody>
              {#each result.largest_files as file}
                <tr>
                  <td class="path">{file.name || file.path}</td>
                  <td>{formatBytes(file.size)}</td>
                  <td>{file.modified || 'Unknown'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {#if result.subdirectories.length}
      <div class="card">
        <h2>Top Subdirectories</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Directory</th><th>Size</th><th>Files</th><th>Dirs</th></tr>
            </thead>
            <tbody>
              {#each result.subdirectories.slice(0, 20) as dir}
                <tr>
                  <td class="path">{dir.path}</td>
                  <td>{formatBytes(dir.total_size)}</td>
                  <td>{dir.file_count.toLocaleString()}</td>
                  <td>{dir.dir_count.toLocaleString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#if result.empty_directories.length}
      <div class="card">
        <h2>Empty Directories</h2>
        <ul>
          {#each result.empty_directories as dir}
            <li>{dir}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if result.errors.length}
      <div class="card">
        <h2>Errors</h2>
        <ul class="errors">
          {#each result.errors as err}
            <li>{err}</li>
          {/each}
        </ul>
      </div>
    {/if}
  {:else}
    <div class="card">
      <p>No scan results yet. Run a scan from the <a href="#/scan">Scan</a> page first.</p>
    </div>
  {/if}
</div>

<style>
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .big {
    font-size: 1.6rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0.5rem 0 0;
  }
  .two-col {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }
  th, td {
    text-align: left;
    padding: 0.6rem 0.5rem;
    border-bottom: 1px solid #334155;
    color: #cbd5e1;
  }
  th {
    color: #94a3b8;
    font-weight: 600;
  }
  td.path {
    color: #e2e8f0;
    word-break: break-all;
  }
  .buckets {
    display: grid;
    gap: 0.75rem;
  }
  .bucket-label {
    display: flex;
    justify-content: space-between;
    color: #cbd5e1;
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }
  .count {
    color: #94a3b8;
  }
  .bar {
    height: 8px;
    background: #1e293b;
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, #60a5fa, #a78bfa);
    border-radius: 999px;
  }
  ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #cbd5e1;
  }
  li {
    margin: 0.25rem 0;
  }
  .errors {
    color: #fca5a5;
  }
</style>
