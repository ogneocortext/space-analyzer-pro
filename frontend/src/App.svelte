<script lang="ts">
  import Dashboard from './Dashboard.svelte';
  import ScanPage from './routes/ScanPage.svelte';
  import DedupPage from './routes/DedupPage.svelte';
  import SystemPage from './routes/SystemPage.svelte';
  import AiChatPage from './routes/AiChatPage.svelte';
  import ResultsPage from './routes/ResultsPage.svelte';
  import CleanupPage from './routes/CleanupPage.svelte';
  import LargeFilesPage from './routes/LargeFilesPage.svelte';

  let page = $state(window.location.hash.replace('#', '') || '/');
</script>

<svelte:window on:hashchange={() => (page = window.location.hash.replace('#', '') || '/')} />

<div class="container">
  <nav class="navbar">
    <a href="#/" class="brand">Space Analyzer Pro</a>
    <div class="nav-links">
      <a href="#/" class:active={page === '/'}>Dashboard</a>
      <a href="#/scan" class:active={page === '/scan'}>Scan</a>
      <a href="#/results" class:active={page === '/results'}>Results</a>
      <a href="#/dedup" class:active={page === '/dedup'}>Duplicates</a>
      <a href="#/system" class:active={page === '/system'}>System</a>
      <a href="#/large-files" class:active={page === '/large-files'}>Large Files</a>
      <a href="#/cleanup" class:active={page === '/cleanup'}>Cleanup</a>
      <a href="#/ai" class:active={page === '/ai'}>AI Chat</a>
    </div>
  </nav>

  {#if page === '/'}
    <Dashboard />
  {:else if page === '/scan'}
    <ScanPage />
  {:else if page === '/results'}
    <ResultsPage />
  {:else if page === '/dedup'}
    <DedupPage />
  {:else if page === '/system'}
    <SystemPage />
  {:else if page === '/large-files'}
    <LargeFilesPage />
  {:else if page === '/cleanup'}
    <CleanupPage />
  {:else if page === '/ai'}
    <AiChatPage />
  {:else}
    <div class="not-found">
      <h2>404</h2>
      <a href="#/">Go Home</a>
    </div>
  {/if}
</div>

<style>
  .container { max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem; }
  .navbar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid #334155; margin-bottom: 2rem; }
  .brand { font-size: 1.25rem; font-weight: 700; background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-decoration: none; }
  .nav-links { display: flex; gap: 1rem; }
  .nav-links a { color: #94a3b8; text-decoration: none; font-weight: 500; padding: 0.5rem 0.75rem; border-radius: 6px; }
  .nav-links a:hover { color: #e2e8f0; background: #334155; }
  .nav-links a.active { color: #60a5fa; background: #1e293b; }
  .not-found { text-align: center; padding: 4rem; }
  .not-found a { color: #60a5fa; }
</style>