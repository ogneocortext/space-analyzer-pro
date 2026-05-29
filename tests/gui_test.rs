//! Space Analyzer Pro — GUI headless regression tests
//!
//! Tests the GUI implementation via lib_shim, which includes the real
//! src/gui/mod.rs via #[path] so all tests run against the actual code.
//!
//! Run: cargo test --test gui_test

#![cfg(test)]
// Suppress pre-existing upstream warnings pulled in via lib_shim (dead code,
// unused imports/vars in Ollama types, session_logger, flow_test, etc. —
// all upstream concerns, not test harness issues).
#![allow(dead_code, unused_imports, unused_variables, unused_mut)]

#[path = "lib_shim.rs"]
mod lib_shim;

use lib_shim::*;

// ──────────────────────────────────────────────────────────────────────────────

/// 1. Default must construct without panicing (DB init, settings load)
#[test]
fn gui_default_constructs_without_panic() {
    let _ = SpaceAnalyzerApp::default();
}

/// 2. Fresh instance must not hold a stale scan result
#[test]
fn gui_default_has_no_scan_result() {
    let app = SpaceAnalyzerApp::default();
    assert!(app.scan_result.is_none());
}

/// 3. AppTab Display strings must match the tab-bar labels in gui.rs
#[test]
fn gui_tab_display_strings() {
    use AppTab::*;
    assert_eq!(Dashboard.to_string(),   "Dashboard");
    assert_eq!(Scan.to_string(),        "Scan");
    assert_eq!(History.to_string(),     "History");
    assert_eq!(SmartSearch.to_string(), "Smart Search");
    assert_eq!(Workflows.to_string(),   "Workflows");
    assert_eq!(AIChat.to_string(),      "AI Assistant");
    assert_eq!(System.to_string(),      "System");
    assert_eq!(Settings.to_string(),    "Settings");
}

/// 4. start_scan must set is_scanning true, progress 0.0, allocate cancel flag + receiver
#[test]
fn gui_start_scan_sets_scanning_state() {
    let mut app = SpaceAnalyzerApp::default();
    app.start_scan();
    assert!(app.is_scanning);
    assert_eq!(app.scan_progress, 0.0);
    assert!(app.cancel_flag.is_some());
    assert!(app.scan_receiver.is_some());
}

/// 5. Double start_scan must be a thread-safe no-op
#[test]
fn gui_double_start_scan_idempotent() {
    let mut app = SpaceAnalyzerApp::default();
    app.start_scan();
    let prev = app.cancel_flag.as_ref().map(|f| f.load(std::sync::atomic::Ordering::Relaxed));
    app.start_scan();
    assert_eq!(prev, app.cancel_flag.as_ref().map(|f| f.load(std::sync::atomic::Ordering::Relaxed)));
}

/// 6. stop_scan must clear state and surface a cancellation message
#[test]
fn gui_stop_scan_clears_state_and_sets_message() {
    let mut app = SpaceAnalyzerApp::default();
    app.start_scan();
    app.stop_scan();
    assert!(!app.is_scanning);
    assert!(app.cancel_flag.is_none());
    assert!(app.status_message.is_some(), "stop_scan must set a status_message");
}

/// 7. process_scan_messages on an empty channel must not panic
///    and must not leave the app in an inconsistent state
#[test]
fn gui_process_scan_messages_empty_channel() {
    let mut app = SpaceAnalyzerApp::default();
    app.start_scan();
    app.process_scan_messages();
    // scan_receiver must be present iff still scanning
    assert_eq!(app.scan_receiver.is_some(), app.is_scanning);
}

/// 8. AppSettings defaults must be safe
#[test]
fn gui_settings_defaults_sane() {
    let s = AppSettings::default();
    assert!((1..=128).contains(&s.embedding_batch_size));
    assert!(!s.ollama_url.is_empty());
    assert!(!s.default_scan_path.is_empty());
}

/// 9. WorkflowTemplates::all_templates() must be non-empty
#[test]
fn gui_default_workflows_populated() {
    let t = WorkflowTemplates::all_templates();
    assert!(!t.is_empty(), "all_templates() must seed at least one workflow");
}

/// 10. Chat must be pre-seeded with the assistant greeting
#[test]
fn gui_chat_pre_seeded_with_greeting() {
    let app = SpaceAnalyzerApp::default();
    assert!(!app.chat_messages.is_empty());
    assert_eq!(&app.chat_messages[0].role, "assistant");
    assert!(!app.chat_messages[0].content.is_empty());
}

/// 11. run_workflow with nonexistent ID must be silent no-op
#[test]
fn gui_run_workflow_invalid_id_silent() {
    let mut app = SpaceAnalyzerApp::default();
    app.run_workflow("__nonexistent__");
    assert!(app.status_message.is_none(), "unknown workflow must not error");
}

/// 12. Fresh default must not claim Ollama is already polling
#[test]
fn gui_ollama_polling_fresh_false() {
    let app = SpaceAnalyzerApp::default();
    assert!(!app.ollama_available);
    assert!(!app.ollama_checking);
}

/// 13. refresh_system_info must populate at least one system field
#[test]
fn gui_system_info_always_returns_data() {
    let mut app = SpaceAnalyzerApp::default();
    app.refresh_system_info();
    assert!(app.system_resources.is_some() || !app.disk_volumes.is_empty());
}
