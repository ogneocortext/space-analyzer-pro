#![cfg(test)]

use space_analyzer_pro_desktop::gui::{NotificationLevel, SpaceAnalyzerApp};
use space_analyzer_pro_desktop::gui_common::ScanResult;
use space_analyzer_pro_desktop::workflows::{self, WorkflowAction};
use std::collections::HashMap;

// ──────────────────────────────────────────────────────────────────────────────
// 1. Deduplication flow
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn dedup_start_sets_state_and_allocates_receiver() {
    let mut app = SpaceAnalyzerApp::default();
    assert!(!app.is_deduplicating);
    assert!(app.dedup_receiver.is_none());
    app.start_deduplication(vec!["/nonexistent/dedup_test_path".to_string()], false);
    assert!(app.is_deduplicating);
    assert!(app.dedup_receiver.is_some());
}

#[test]
fn dedup_process_messages_clears_state_on_error() {
    let mut app = SpaceAnalyzerApp::default();
    app.start_deduplication(vec!["/nonexistent/dedup_test_path".to_string()], false);
    assert!(app.is_deduplicating);
    for _ in 0..100 {
        app.process_dedup_messages();
        if !app.is_deduplicating {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    assert!(!app.is_deduplicating);
    assert!(app.dedup_receiver.is_none());
}

#[test]
fn dedup_double_start_is_idempotent() {
    let mut app = SpaceAnalyzerApp::default();
    app.start_deduplication(vec!["/nonexistent/dedup_test_path".to_string()], false);
    let was_deduplicating = app.is_deduplicating;
    app.start_deduplication(vec!["/nonexistent/dedup_test_path".to_string()], false);
    assert_eq!(app.is_deduplicating, was_deduplicating);
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Embeddings flow
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn embedding_start_gates_when_already_indexing() {
    let mut app = SpaceAnalyzerApp::default();
    app.is_indexing = true;
    app.start_embedding_index();
    assert!(app.is_indexing);
}

#[test]
fn embedding_start_gates_when_no_scan_result() {
    let mut app = SpaceAnalyzerApp::default();
    assert!(app.scan_result.is_none());
    app.start_embedding_index();
    assert!(!app.is_indexing);
}

#[test]
fn embedding_start_gates_when_no_ollama_client() {
    let mut app = SpaceAnalyzerApp::default();
    app.ollama_client = None;
    app.scan_result = Some(space_analyzer_pro_desktop::gui_common::ScanResult::new());
    app.start_embedding_index();
    assert!(!app.is_indexing);
}

#[test]
fn load_embeddings_from_db_sets_state() {
    let mut app = SpaceAnalyzerApp::default();
    app.load_embeddings_from_db(None);
    // With no prior scan data, search_status should reflect "no index found"
    assert!(app.search_status.contains("No semantic index") || app.cached_embeddings.is_empty());
}

#[test]
fn load_embeddings_from_db_clears_state_on_no_records() {
    let mut app = SpaceAnalyzerApp::default();
    app.load_embeddings_from_db(None);
    assert!(app.embedding_scan_id.is_none() || app.cached_embeddings.is_empty());
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. AI recommendations
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn generate_ai_recommendations_falls_back_when_ollama_client_none() {
    let mut app = SpaceAnalyzerApp::default();
    app.ollama_client = None;
    app.ai_recommendations.clear();
    app.generate_ai_recommendations();
    assert_eq!(app.ai_recommendation_source, "heuristic");
}

#[test]
fn generate_ai_recommendations_falls_back_when_ollama_not_available() {
    let mut app = SpaceAnalyzerApp::default();
    app.ollama_available = false;
    app.ai_recommendations.clear();
    app.generate_ai_recommendations();
    assert_eq!(app.ai_recommendation_source, "heuristic");
}

#[test]
fn generate_storage_recommendations_populates_list() {
    let mut app = SpaceAnalyzerApp::default();
    app.scan_result = Some(scan_result_with_many_files());
    app.generate_storage_recommendations();
    assert_eq!(app.ai_recommendation_source, "heuristic");
    assert!(!app.ai_recommendations.is_empty());
}

#[test]
fn generate_storage_recommendations_clears_without_scan() {
    let mut app = SpaceAnalyzerApp::default();
    app.scan_result = None;
    app.generate_storage_recommendations();
    assert!(app.ai_recommendations.is_empty());
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Workflow actions
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn workflow_action_notify_pushes_notification() {
    let mut app = SpaceAnalyzerApp::default();
    let count = app.notifications.len();
    app.handle_workflow_action(&WorkflowAction::Notify {
        title: "Test".to_string(),
        message: "hello".to_string(),
    });
    assert_eq!(app.notifications.len(), count + 1);
}

#[test]
fn workflow_action_generate_recommendations_populates_list() {
    let mut app = SpaceAnalyzerApp::default();
    app.scan_result = Some(scan_result_with_many_files());
    app.handle_workflow_action(&WorkflowAction::GenerateRecommendations);
    assert_eq!(app.ai_recommendation_source, "heuristic");
}

#[test]
fn workflow_action_scan_sets_path_and_starts_scan() {
    let mut app = SpaceAnalyzerApp::default();
    app.handle_workflow_action(&WorkflowAction::Scan {
        path: ".".to_string(),
        deep: true,
        min_size: None,
    });
    assert_eq!(app.current_path, std::path::PathBuf::from("."));
    assert!(app.is_scanning);
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Workflow CRUD
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn workflow_save_custom_adds_new() {
    let mut app = SpaceAnalyzerApp::default();
    let original = app.workflows.len();
    let wf = workflows::Workflow::new("custom-new", "New", workflows::WorkflowCategory::Custom);
    app.save_custom_workflow(wf);
    assert_eq!(app.workflows.len(), original + 1);
}

#[test]
fn workflow_save_custom_replaces_existing() {
    let mut app = SpaceAnalyzerApp::default();
    let existing_id = app
        .workflows
        .first()
        .map(|w| w.id.clone())
        .unwrap_or_default();
    let mut replacement = workflows::Workflow::new(
        existing_id.clone(),
        "Replaced",
        workflows::WorkflowCategory::Custom,
    );
    replacement.description = "Updated".to_string();
    let original_len = app.workflows.len();
    app.save_custom_workflow(replacement);
    assert_eq!(app.workflows.len(), original_len);
    let updated = app.workflows.iter().find(|w| w.id == existing_id).unwrap();
    assert_eq!(updated.name, "Replaced");
}

#[test]
fn workflow_delete_removes_entry() {
    let mut app = SpaceAnalyzerApp::default();
    let existing_id = app
        .workflows
        .first()
        .map(|w| w.id.clone())
        .unwrap_or_default();
    app.delete_workflow(&existing_id);
    assert!(!app.workflows.iter().any(|w| w.id == existing_id));
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Settings save / reload
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn settings_save_writes_to_db_and_reloads() {
    let mut app = SpaceAnalyzerApp::default();
    app.settings.default_scan_path = "./test_save_path".to_string();
    app.save_settings();

    let fresh = SpaceAnalyzerApp::default();
    assert_eq!(fresh.settings.default_scan_path, "./test_save_path");
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. Notifications
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn push_notification_increments_and_trims_at_six() {
    let mut app = SpaceAnalyzerApp::default();
    app.notifications.clear();
    for i in 0..5 {
        app.push_notification(format!("msg {}", i), NotificationLevel::Info);
    }
    assert_eq!(app.notifications.len(), 5);
    assert_eq!(app.notifications[0].message, "msg 0");

    app.push_notification("overflow".to_string(), NotificationLevel::Info);
    assert_eq!(app.notifications.len(), 5);
    assert_eq!(app.notifications[0].message, "msg 1");
    assert_eq!(app.notifications[4].message, "overflow");
}

// ──────────────────────────────────────────────────────────────────────────────
// 8. AI / Ollama path
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn check_ollama_is_noop_when_receiver_already_some() {
    let mut app = SpaceAnalyzerApp::default();
    use std::sync::mpsc;
    let (_, rx) = mpsc::channel::<space_analyzer_pro_desktop::gui::OllamaMessage>();
    app.ollama_receiver = Some(rx);
    let was_checking = app.ollama_checking;
    app.check_ollama();
    assert_eq!(app.ollama_checking, was_checking);
}

#[test]
fn start_ollama_process_sets_status_message() {
    let mut app = SpaceAnalyzerApp::default();
    app.start_ollama_process();
    assert!(app.status_message.is_some());
}

// ──────────────────────────────────────────────────────────────────────────────
// 9. Model selection
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn select_model_for_task_noop_when_auto_selection_disabled() {
    let mut app = SpaceAnalyzerApp::default();
    app.settings.auto_model_selection = false;
    let prev = app.current_active_model.clone();
    app.select_model_for_task("Complex Analysis");
    assert_eq!(app.current_active_model, prev);
}

#[test]
fn select_model_for_task_noop_when_no_discovered_models() {
    let mut app = SpaceAnalyzerApp::default();
    app.settings.auto_model_selection = true;
    app.discovered_models.clear();
    let prev = app.current_active_model.clone();
    app.select_model_for_task("Complex Analysis");
    assert_eq!(app.current_active_model, prev);
}

#[test]
fn select_model_for_task_updates_active_model_on_match() {
    let mut app = SpaceAnalyzerApp::default();
    app.settings.auto_model_selection = true;
    app.discovered_models = vec![space_analyzer_pro_desktop::gui::OllamaModelInfo {
        name: "test-model:7b".to_string(),
        size: "4.7 GB".to_string(),
        capabilities: vec!["chat".to_string(), "reasoning".to_string()],
        recommended_for: "General".to_string(),
        vram_requirement: "8 GB".to_string(),
        tooltip: String::new(),
        performance_metrics: Default::default(),
        is_running: false,
        vram_usage_mb: None,
        cpu_usage_percent: None,
    }];
    app.select_model_for_task("Complex Analysis");
    assert_eq!(app.current_active_model, Some("test-model:7b".to_string()));
}

// ──────────────────────────────────────────────────────────────────────────────
// 10. Scheduled workflows (no-panic)
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn process_scheduled_workflows_does_not_panic() {
    let mut app = SpaceAnalyzerApp::default();
    app.process_scheduled_workflows();
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

fn scan_result_with_many_files() -> ScanResult {
    ScanResult {
        total_files: 20_000,
        total_size_bytes: 500 * 1024 * 1024,
        total_size_mb: 500.0,
        duration_secs: 12.5,
        file_types: HashMap::from([("log".to_string(), 15000), ("tmp".to_string(), 5000)]),
        extension_sizes: HashMap::new(),
        largest_files: vec![("/tmp/big.bin".to_string(), 200 * 1024 * 1024)],
        errors: Vec::new(),
        path: ".".to_string(),
        total_dirs: 0,
        top_directories: Vec::new(),
        empty_dirs: Vec::new(),
        scanned_files: HashMap::new(),
    }
}
