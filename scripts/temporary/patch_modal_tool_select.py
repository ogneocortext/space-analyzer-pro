path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_verify_tools = """<div class="test-btns">
          <button class="btn btn-sm" data-test="test" title="Run cargo test">&#9654; Test</button>
          <button class="btn btn-sm btn-warn" data-test="clippy" title="Run cargo clippy">&#x26a0; Clippy</button>
          <button class="btn btn-sm btn-info" data-test="fmt" title="Run cargo fmt --check">&#x2702; Fmt</button>
          <button class="btn btn-sm btn-ok" data-test="verify" title="Run full verify (fmt+clippy+test)">&#x2714; Verify</button>
        </div>"""

new_verify_tools = """<div class="test-btns">
          <button class="btn btn-sm" data-test="test" title="Run cargo test">&#9654; Test</button>
          <button class="btn btn-sm btn-warn" data-test="clippy" title="Run cargo clippy">&#x26a0; Clippy</button>
          <button class="btn btn-sm btn-info" data-test="fmt" title="Run cargo fmt --check">&#x2702; Fmt</button>
          <button class="btn btn-sm btn-ok" data-test="verify" title="Run full verify (fmt+clippy+test)">&#x2714; Verify</button>
        </div>
        <select id="verify-tool-select" title="Verification tool for AI fixes" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.4rem;font-size:0.72rem;margin-left:0.4rem;">
          <option value="verify">verify</option>
          <option value="test">test</option>
          <option value="clippy">clippy</option>
          <option value="fmt">fmt</option>
        </select>"""

if old_verify_tools not in content:
    raise SystemExit('Old test runner buttons not found')
content = content.replace(old_verify_tools, new_verify_tools)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 7 done: verify tool selector added')
