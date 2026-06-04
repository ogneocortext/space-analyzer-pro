from pathlib import Path

p = Path('src/gui/mod.rs')
lines = p.read_text(encoding='utf-8', errors='replace').splitlines()

# Insert logging after push_notification signature (line 939, 1-indexed)
new_lines = lines[:939] + [
    '    pub fn push_notification(&mut self, message: impl Into<String>, level: NotificationLevel) {',
    '        tracing::info!(target: "ux", message=%message.into(), level=?level, "notification_pushed");',
] + lines[939:]
p.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')
print('Done')
