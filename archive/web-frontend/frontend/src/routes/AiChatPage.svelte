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
  <header class="page-header">
    <div class="header-content">
      <h1>AI Assistant</h1>
      <p class="subtitle">Ask about your files, disk usage, or cleanup</p>
    </div>
    <div class="header-actions">
      <label class="model-select">
        <span>Model</span>
        <select bind:value={model}>
          <option value="qwen3:8b">qwen3:8b</option>
          <option value="gemma3:4b">gemma3:4b</option>
        </select>
      </label>
      <a href="#/" class="back-link">Dashboard</a>
    </div>
  </header>

  <div class="chat">
    {#each messages as msg}
      <div class="message {msg.role}">
        <div class="message-bubble">
          <div class="role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
          <div class="content">{msg.content}</div>
        </div>
      </div>
    {/each}
    {#if sending}
      <div class="message assistant">
        <div class="message-bubble">
          <div class="role">Assistant</div>
          <div class="content thinking">Thinking…</div>
        </div>
      </div>
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
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 1rem; }
  .header-content h1 { margin: 0; font-size: 1.75rem; font-weight: 800; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em; }
  .subtitle { margin: 0.25rem 0 0; color: var(--text-muted); font-size: 0.95rem; }
  .header-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .model-select { display: flex; flex-direction: column; gap: 0.35rem; }
  .model-select span { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  select { background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.9rem; cursor: pointer; }
  .back-link { color: var(--accent-blue); text-decoration: none; font-weight: 500; font-size: 0.9rem; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); transition: all 0.2s; }
  .back-link:hover { background: var(--bg-surface); border-color: var(--border-default); }
  .chat { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 1.25rem; min-height: 420px; display: flex; flex-direction: column; gap: 1rem; box-shadow: var(--shadow-sm); }
  .message { display: flex; flex-direction: column; max-width: 85%; }
  .message.user { align-self: flex-end; align-items: flex-end; }
  .message.assistant { align-self: flex-start; }
  .message-bubble { padding: 0.85rem 1.1rem; border-radius: 14px; border: 1px solid var(--border-subtle); }
  .message.user .message-bubble { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: white; border-color: transparent; border-bottom-right-radius: 4px; }
  .message.assistant .message-bubble { background: var(--bg-base); color: var(--text-primary); border-bottom-left-radius: 4px; }
  .role { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 0.35rem; font-weight: 700; }
  .message.user .role { color: rgba(255, 255, 255, 0.75); }
  .content { font-size: 0.95rem; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
  .thinking { color: var(--text-muted); font-style: italic; }
  .error-banner { background: rgba(248, 113, 113, 0.1); color: var(--accent-rose); padding: 0.85rem 1.1rem; border-radius: 10px; margin-top: 1rem; border: 1px solid rgba(248, 113, 113, 0.2); }
  .input-bar { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
  .input-bar input { flex: 1; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 0.85rem 1.1rem; border-radius: 12px; font-size: 0.95rem; transition: all 0.2s; }
  .input-bar input:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15); outline: none; }
  .input-bar button { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: white; border: none; padding: 0 1.75rem; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; min-height: 48px; }
  .input-bar button:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
  .input-bar button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
</style>
