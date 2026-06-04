from pathlib import Path

# Instrument src/gui/mod.rs
p = Path('src/gui/mod.rs')
text = p.read_text(encoding='utf-8', errors='replace')

# 1. Notification push
old_notif = 'pub fn push_notification(&mut self, message: String, level: NotificationLevel) {'
new_notif = 'pub fn push_notification(&mut self, message: String, level: NotificationLevel) {\n        self.ux_log("notification_pushed", message=%message, level=?level);'
if old_notif in text:
    text = text.replace(old_notif, new_notif, 1)
    print('mod.rs: instrumented push_notification')
else:
    print('mod.rs: push_notification not found')

# 2. Settings change (save)
old_save = 'pub fn save_settings(&mut self) {'
new_save = 'pub fn save_settings(&mut self) {\n        self.ux_log("settings_saved");'
if old_save in text:
    text = text.replace(old_save, new_save, 1)
    print('mod.rs: instrumented save_settings')
else:
    print('mod.rs: save_settings not found')

# 3. Chat send (find the send_chat_message method signature)
old_chat = 'pub fn send_chat_message(&mut self) {'
new_chat = 'pub fn send_chat_message(&mut self) {\n        self.ux_log("chat_send", prompt=%self.chat_input);'
if old_chat in text:
    text = text.replace(old_chat, new_chat, 1)
    print('mod.rs: instrumented send_chat_message')
else:
    print('mod.rs: send_chat_message not found')

# 4. Workflow run
old_run = 'pub fn run_workflow(&mut self, workflow_id: &str) {'
new_run = 'pub fn run_workflow(&mut self, workflow_id: &str) {\n        self.ux_log("workflow_run", workflow_id=%workflow_id);'
if old_run in text:
    text = text.replace(old_run, new_run, 1)
    print('mod.rs: instrumented run_workflow')
else:
    print('mod.rs: run_workflow not found')

# 5. Cancel scan
old_cancel = 'pub fn cancel_scan(&mut self) {'
new_cancel = 'pub fn cancel_scan(&mut self) {\n        self.ux_log("scan_cancelled");'
if old_cancel in text:
    text = text.replace(old_cancel, new_cancel, 1)
    print('mod.rs: instrumented cancel_scan')
else:
    print('mod.rs: cancel_scan not found')

# 6. Error/status message — no-op for now, left as placeholder
# TODO: Add actual instrumentation when status_message logging is needed

p.write_text(text, encoding='utf-8')

# Instrument src/gui/scan.rs
scan_path = Path('src/gui/scan.rs')
scan_text = scan_path.read_text(encoding='utf-8', errors='replace')

# 7. Export from scan tab
old_export = 'fn export_results(&mut self) {'
new_export = 'fn export_results(&mut self) {\n        self.ux_log("results_exported");'
if old_export in scan_text:
    scan_text = scan_text.replace(old_export, new_export, 1)
    print('scan.rs: instrumented export_results')
else:
    print('scan.rs: export_results not found')

# 8. Browse button in scan tab
old_browse = 'if let Some(path) = rfd::FileDialog::new().pick_folder() {'
new_browse = 'if let Some(path) = rfd::FileDialog::new().pick_folder() {\n            self.ux_log("browse_folder", path=%path.display());'
if old_browse in scan_text:
    scan_text = scan_text.replace(old_browse, new_browse, 1)
    print('scan.rs: instrumented browse_folder')
else:
    print('scan.rs: browse_folder not found')

# 9. Switch to duplicate page
old_dedup = 'fn switch_to_dedup(&mut self) {'
new_dedup = 'fn switch_to_dedup(&mut self) {\n        self.ux_log("switch_to_dedup");'
if old_dedup in scan_text:
    scan_text = scan_text.replace(old_dedup, new_dedup, 1)
    print('scan.rs: instrumented switch_to_dedup')
else:
    print('scan.rs: switch_to_dedup not found')

scan_path.write_text(scan_text, encoding='utf-8')

print('Done')
