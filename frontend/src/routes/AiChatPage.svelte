<script lang="ts">
  let messages = $state<Array<{ role: string; content: string }>>([
    { role: 'assistant', content: 'Hello! I am your Space Analyzer AI assistant. Ask me anything about your files, disk usage, or cleanup recommendations.' }
  ]);
  let input = $state('');
  let sending = $state(false);
  let model = $state('qwen3:8b');
  let error = $state<string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg = { role: 'user', content: text };
    messages = [...messages, userMsg];
    input = '';
    sending = true;
    error = null;
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      messages = [...messages, data.message];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      sending = false;
    }
  }
</script>

<div class="container">
  <header>
    <h1>AI Assistant</h1>
    <div class="header-meta">
      <label>
        <span>Model</span>
        <select bind:value={model}>
          <option value="qwen3:8b">qwen3:8b</option>
          <option value="gemma3:4b">gemma3:4b</option>
        </select>
      </label>
      <a href="/" class="back-link">← Dashboard</a>
    </div>
  </header>

  <div class="chat">
    {#each messages as msg}
      <div class="message {msg.role}">
        <div class="role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
        <div class="content">{msg.content}</div>
      </div>
    {/each}
    {#if sending}
      <div class="message assistant"><div class="content">Thinking...</div></div>
    {/if}
    {#if error}
      <div class="error-banner">Error: {error}</div>
    {/if}
  </div>

  <form class="input-bar" onsubmit={(e) => { e.preventDefault(); send(); }}>
    <input bind:value={input} placeholder="Ask about your disk, files, duplicates..." />
    <button type="submit" disabled={sending || !input.trim()}>Send</button>
  </form>
</div>

<style>
  .header-meta { display: flex; justify-content: space-between; align-items: center; }
  select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 0.5rem; border-radius: 6px; }
  .chat { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1rem; min-height: 400px; display: flex; flex-direction: column; gap: 1rem; }
  .message { display: flex; flex-direction: column; gap: 0.25rem; max-width: 85%; }
  .message.user { align-self: flex-end; align-items: flex-end; }
  .message.assistant { align-self: flex-start; }
  .role { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  .content { background: #334155; padding: 0.75rem 1rem; border-radius: 10px; color: #e2e8f0; white-space: pre-wrap; }
  .message.user .content { background: #3b82f6; color: white; }
  .error-banner { background: #7f1d1d; color: #fca5a5; padding: 0.75rem 1rem; border-radius: 8px; margin-top: 1rem; }
  .input-bar { display: flex; gap: 0.5rem; margin-top: 1rem; }
  .input-bar input { flex: 1; background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 0.75rem 1rem; border-radius: 8px; }
  .input-bar button { background: #3b82f6; color: white; border: none; padding: 0 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .input-bar button:hover:not(:disabled) { background: #2563eb; }
  .input-bar button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>