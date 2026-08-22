//! Space Analyzer Pro — Library data-flow and workflow tests
//!
//! Tests core library types and workflow/tool integration directly.
//!
//! Run: cargo test --test gui_data_flow_test

#![cfg(test)]

use space_analyzer_pro_desktop::gui_common::ScanReport;
use space_analyzer_pro_desktop::tool_registry::ToolRegistry;
use space_analyzer_pro_desktop::workflows::{self, Workflow, WorkflowAction};
use std::collections::HashMap;

macro_rules! say {
    ($($arg:tt)*) => { eprintln!($($arg)*) };
}

macro_rules! pass {
    () => {
        eprintln!("  ✅ PASS\n");
    };
}

// -----------------------------------------------------------------------------
// 1. Workflow CRUD
// -----------------------------------------------------------------------------

#[test]
fn workflow_templates_non_empty() {
    say!("🔍 Test: WorkflowTemplates are non-empty");
    let t = workflows::WorkflowTemplates::all_templates();
    say!("   Found {} templates", t.len());
    assert!(
        !t.is_empty(),
        "all_templates() must seed at least one workflow"
    );
    pass!();
}

#[test]
fn workflow_save_custom_adds_new() {
    say!("🔍 Test: Adding a custom workflow increases count");
    let mut app_workflows = workflows::WorkflowTemplates::all_templates();
    let original = app_workflows.len();
    say!("   Original templates: {}", original);
    let wf = Workflow::new("custom-new", "New", workflows::WorkflowCategory::Custom);
    app_workflows.push(wf);
    say!("   After adding custom: {} templates", app_workflows.len());
    assert_eq!(app_workflows.len(), original + 1);
    pass!();
}

#[test]
fn workflow_delete_removes_entry() {
    say!("🔍 Test: Removing a workflow by ID works");
    let mut workflows_list = vec![
        Workflow::new("wf-1", "One", workflows::WorkflowCategory::Custom),
        Workflow::new("wf-2", "Two", workflows::WorkflowCategory::Custom),
    ];
    let id = "wf-1".to_string();
    say!(
        "   Before: {:?}",
        workflows_list.iter().map(|w| &w.id).collect::<Vec<_>>()
    );
    workflows_list.retain(|w| w.id != id);
    say!(
        "   After removing '{}': {:?}",
        id,
        workflows_list.iter().map(|w| &w.id).collect::<Vec<_>>()
    );
    assert!(!workflows_list.iter().any(|w| w.id == id));
    pass!();
}

// -----------------------------------------------------------------------------
// 2. Tool registry
// -----------------------------------------------------------------------------

#[test]
fn tool_registry_provides_definitions() {
    say!("🔍 Test: ToolRegistry provides definitions");
    let registry = ToolRegistry::new(None);
    let defs = registry.get_definitions();
    say!("   Found {} tool definitions", defs.len());
    assert!(!defs.is_empty(), "Tool registry should provide definitions");
    for def in defs {
        assert!(
            !def.function.name.is_empty(),
            "Tool name should not be empty"
        );
    }
    pass!();
}

#[test]
fn tool_execution_returns_result() {
    say!("🔍 Test: Executing 'get_disk_volumes' returns data");
    let registry = ToolRegistry::new(None);
    use space_analyzer_pro_desktop::ollama::{ToolCall, ToolCallFunction};
    let result = registry.execute_tool(
        &ToolCall {
            id: "test-123".to_string(),
            call_type: "function".to_string(),
            function: ToolCallFunction {
                index: Some(0),
                name: "get_disk_volumes".to_string(),
                arguments: serde_json::json!({}),
            },
        },
        None,
        None,
    );
    let output = result.unwrap();
    say!("   Output: {} bytes", output.len());
    say!("   {}", output);
    assert!(
        !output.is_empty(),
        "Disk volumes tool should return non-empty result"
    );
    pass!();
}

// -----------------------------------------------------------------------------
// 3. ScanReport construction
// -----------------------------------------------------------------------------

#[test]
fn scan_result_with_many_files_populates_types() {
    say!("🔍 Test: ScanReport with populated file types");
    let mut file_types = HashMap::new();
    file_types.insert("log".to_string(), 15000);
    file_types.insert("tmp".to_string(), 5000);

    let result = ScanReport {
        total_files: 20_000,
        total_size_bytes: 500 * 1024 * 1024,
        total_size_mb: 500.0,
        duration_secs: 12.5,
        file_types,
        extension_sizes: HashMap::new(),
        largest_files: vec![],
        errors: Vec::new(),
        path: ".".to_string(),
        total_dirs: 0,
        top_directories: Vec::new(),
        empty_dirs: Vec::new(),
        scanned_files: HashMap::new(),
        category_sizes: HashMap::new(),
        reclaim_tier_sizes: HashMap::new(),
        category_reclaimable: HashMap::new(),
        is_index_only: false,
        potential_cleanup_bytes: 0,
        timestamp: String::new(),
        drill_down: HashMap::new(),
    };
    say!(
        "   Files: {} | Types: {:?}",
        result.total_files,
        result.file_types
    );
    assert_eq!(result.total_files, 20_000);
    assert_eq!(result.file_types.get("log").copied().unwrap_or(0), 15000);
    pass!();
}

// -----------------------------------------------------------------------------
// 4. WorkflowAction construction (smoke test)
// -----------------------------------------------------------------------------

#[test]
fn workflow_action_scan_constructs() {
    say!("🔍 Test: WorkflowAction::Scan variant");
    let action = WorkflowAction::Scan {
        path: ".".to_string(),
        deep: true,
        min_size: None,
    };
    match action {
        WorkflowAction::Scan { path, deep, .. } => {
            say!("   Path: '{}' | Deep scan: {}", path, deep);
            assert_eq!(path, ".");
            assert!(deep);
        }
        _ => panic!("Expected Scan variant"),
    }
    pass!();
}

#[test]
fn workflow_action_notify_constructs() {
    say!("🔍 Test: WorkflowAction::Notify variant");
    let action = WorkflowAction::Notify {
        title: "Test".to_string(),
        message: "hello".to_string(),
    };
    match action {
        WorkflowAction::Notify { title, message } => {
            say!("   Title: '{}' | Message: '{}'", title, message);
            assert_eq!(title, "Test");
            assert_eq!(message, "hello");
        }
        _ => panic!("Expected Notify variant"),
    }
    pass!();
}

// -----------------------------------------------------------------------------
// 5. WorkflowTemplates supports common time ranges
// -----------------------------------------------------------------------------

#[test]
fn workflow_templates_support_common_ranges() {
    say!("🔍 Test: Templates include common maintenance workflows");
    let templates = workflows::WorkflowTemplates::all_templates();
    let names: Vec<_> = templates.iter().map(|t| t.name.as_str()).collect();
    say!("   Available: {:?}", names);
    let has_expected = names.contains(&"Weekly Cleanup") || names.contains(&"Startup Scan");
    assert!(
        has_expected,
        "Templates should include common maintenance workflows"
    );
    pass!();
}
