//! Tool registry for AI function calling
//!
//! Provides a registry of tools that the AI can call during conversations.
//! Each tool has a definition (sent to Ollama) and is executed against
//! the current application state.

use super::database::Database;
use super::gui_common::{formatting, ScanResult};
use super::ollama::{ToolCall, ToolDefinition, ToolParameters};
use super::system_monitor::SystemMonitor;
use super::workflows::WorkflowTemplates;

pub mod definitions;
pub mod execution;

/// Registry of tools available for AI function calling
pub struct ToolRegistry {
    definitions: Vec<ToolDefinition>,
}

impl ToolRegistry {
    /// Create a new tool registry with all available tools
    pub fn new(scan_result: Option<ScanResult>) -> Self {
        let mut registry = Self {
            definitions: Vec::new(),
        };

        registry.add_definitions(scan_result.is_some());
        registry
    }

    /// Get the tool definitions to send to Ollama
    pub fn get_definitions(&self) -> &[ToolDefinition] {
        &self.definitions
    }
}

#[cfg(test)]
mod tests {
    use super::super::ollama::ToolCallFunction;
    use super::*;

    /// Create a tool call struct for testing
    fn make_tool_call(name: &str, args: serde_json::Value) -> ToolCall {
        ToolCall {
            id: format!("call_{}", name),
            call_type: "function".to_string(),
            function: ToolCallFunction {
                index: None,
                name: name.to_string(),
                arguments: args,
            },
        }
    }

    /// Create a sample scan result for testing
    fn sample_scan() -> ScanResult {
        let mut file_types = std::collections::HashMap::new();
        file_types.insert("pdf".to_string(), 150);
        file_types.insert("txt".to_string(), 300);
        file_types.insert("jpg".to_string(), 75);
        file_types.insert("png".to_string(), 50);
        file_types.insert("zip".to_string(), 20);
        let mut extension_sizes = std::collections::HashMap::new();
        extension_sizes.insert("pdf".to_string(), 150);
        extension_sizes.insert("txt".to_string(), 300);
        extension_sizes.insert("jpg".to_string(), 75);
        extension_sizes.insert("png".to_string(), 50);
        extension_sizes.insert("zip".to_string(), 20);

        ScanResult {
            total_files: 595,
            total_size_bytes: 2_500_000_000,
            total_size_mb: 2_500_000_000.0 / (1024.0 * 1024.0),
            duration_secs: 12.5,
            path: "C:\\Users\\test".to_string(),
            largest_files: vec![
                ("C:\\big_file.zip".to_string(), 500_000_000),
                ("C:\\large_video.mp4".to_string(), 350_000_000),
                ("C:\\dataset.tar.gz".to_string(), 200_000_000),
                ("C:\\documents\\report.pdf".to_string(), 15_000_000),
                ("C:\\images\\photo.jpg".to_string(), 5_000_000),
            ],
            file_types,
            extension_sizes,
            errors: Vec::new(),
        }
    }

    #[test]
    fn test_get_definitions_count_no_scan() {
        // 6 original always-available + 3 new destructive-preview tools
        // (preview_impact, move_to_trash, hardlink_duplicates)
        let registry = ToolRegistry::new(None);
        assert_eq!(registry.definitions.len(), 9);
    }

    #[test]
    fn test_get_definitions_count_with_scan() {
        // 11 with scan + 3 new destructive-preview tools
        let registry = ToolRegistry::new(Some(sample_scan()));
        assert_eq!(registry.definitions.len(), 14);
    }

    #[test]
    fn test_get_definitions_no_scan_only_always_available() {
        let registry = ToolRegistry::new(None);
        let names: Vec<&str> = registry
            .definitions
            .iter()
            .map(|d| d.function.name.as_str())
            .collect();
        assert!(names.contains(&"get_scan_history"));
        assert!(names.contains(&"get_disk_volumes"));
        assert!(names.contains(&"get_system_resources"));
        assert!(names.contains(&"get_storage_trend"));
        assert!(names.contains(&"list_workflows"));
        assert!(names.contains(&"predict_storage"));
        // Scan-dependent tools should NOT be present
        assert!(!names.contains(&"get_scan_summary"));
        assert!(!names.contains(&"get_file_type_breakdown"));
        assert!(!names.contains(&"analyze_file_patterns"));
        assert!(!names.contains(&"search_files"));
        assert!(!names.contains(&"get_largest_files"));
    }

    #[test]
    fn test_get_definitions_includes_all_tools_with_scan() {
        let registry = ToolRegistry::new(Some(sample_scan()));
        let names: Vec<&str> = registry
            .definitions
            .iter()
            .map(|d| d.function.name.as_str())
            .collect();
        assert!(names.contains(&"get_scan_history"));
        assert!(names.contains(&"get_disk_volumes"));
        assert!(names.contains(&"get_system_resources"));
        assert!(names.contains(&"get_storage_trend"));
        assert!(names.contains(&"list_workflows"));
        assert!(names.contains(&"predict_storage"));
        // Scan-dependent tools should be present
        assert!(names.contains(&"get_scan_summary"));
        assert!(names.contains(&"get_file_type_breakdown"));
        assert!(names.contains(&"analyze_file_patterns"));
        assert!(names.contains(&"search_files"));
        assert!(names.contains(&"get_largest_files"));
    }

    #[test]
    fn test_execute_unknown_tool() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("non_existent_tool", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(result, "Unknown tool: non_existent_tool");
    }

    #[test]
    fn test_get_scan_summary_with_scan() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("get_scan_summary", serde_json::json!({}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("Scan of: C:\\Users\\test"));
        assert!(result.contains("Total files: 595"));
        assert!(result.contains(".pdf: 150 files"));
        assert!(result.contains("big_file.zip"));
    }

    #[test]
    fn test_get_scan_summary_without_scan() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("get_scan_summary", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(
            result,
            "No scan results available. Please run a scan first."
        );
    }

    #[test]
    fn test_get_scan_history_without_db() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("get_scan_history", serde_json::json!({"limit": 5}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(result, "Database not available.");
    }

    #[test]
    fn test_get_disk_volumes() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("get_disk_volumes", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        // Should return disk info or appropriate message
        assert!(result.contains("Disk volumes") || result.contains("No disk volumes"));
    }

    #[test]
    fn test_get_system_resources() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("get_system_resources", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        assert!(result.contains("CPU usage") || result.contains("Memory"));
    }

    #[test]
    fn test_list_workflows() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("list_workflows", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        assert!(result.contains("Available workflows"));
    }

    #[test]
    fn test_get_file_type_breakdown_with_scan() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("get_file_type_breakdown", serde_json::json!({}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("File type breakdown"));
        assert!(result.contains(".pdf: 150 files"));
        assert!(result.contains("595 total files"));
    }

    #[test]
    fn test_get_file_type_breakdown_without_scan() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("get_file_type_breakdown", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(result, "No scan results available.");
    }

    #[test]
    fn test_analyze_file_patterns_with_scan() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("analyze_file_patterns", serde_json::json!({}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("File Pattern Analysis"));
    }

    #[test]
    fn test_search_files_by_extension() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("search_files", serde_json::json!({"extension": "pdf"}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("Search results"));
        assert!(result.contains("report.pdf"));
    }

    #[test]
    fn test_search_files_no_matches() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("search_files", serde_json::json!({"extension": "xyz"}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert_eq!(result, "No files match the search criteria.");
    }

    #[test]
    fn test_search_files_without_scan() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("search_files", serde_json::json!({"extension": "pdf"}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(
            result,
            "No scan results available. Please run a scan first."
        );
    }

    #[test]
    fn test_get_largest_files_default_count() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("get_largest_files", serde_json::json!({}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("Largest files"));
        assert!(result.contains("big_file.zip"));
        assert!(result.contains("476") || result.contains("MB"));
    }

    #[test]
    fn test_get_largest_files_with_count() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("get_largest_files", serde_json::json!({"count": 3}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("Largest files (top 3)"));
    }

    #[test]
    fn test_get_largest_files_with_min_size() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        let call = make_tool_call("get_largest_files", serde_json::json!({"min_size_mb": 100}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("Largest files"));
        assert!(result.contains("big_file.zip"));
        assert!(result.contains("large_video.mp4"));
        assert!(!result.contains("report.pdf")); // 15MB < 100MB
    }

    #[test]
    fn test_get_largest_files_without_scan() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("get_largest_files", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(
            result,
            "No scan results available. Please run a scan first."
        );
    }

    #[test]
    fn test_get_storage_trend_without_db() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("get_storage_trend", serde_json::json!({}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(result, "Database not available.");
    }

    #[test]
    fn test_predict_storage_without_db() {
        let registry = ToolRegistry::new(None);
        let call = make_tool_call("predict_storage", serde_json::json!({"days_ahead": 30}));
        let result = registry.execute_tool(&call, None, None);
        assert_eq!(
            result,
            "Database not available. Cannot make predictions without historical data."
        );
    }

    #[test]
    fn test_get_largest_files_count_clamped_to_100() {
        let registry = ToolRegistry::new(None);
        let scan = sample_scan();
        // Even though count is 999, only 5 files exist in sample
        let call = make_tool_call("get_largest_files", serde_json::json!({"count": 999}));
        let result = registry.execute_tool(&call, Some(&scan), None);
        assert!(result.contains("Largest files (top 5)"));
    }

    #[test]
    fn test_get_definitions_are_sendable() {
        // Verify definitions serialize correctly for the Ollama API
        let registry = ToolRegistry::new(None);
        let defs = registry.get_definitions();
        for def in defs {
            let json = serde_json::to_string(def);
            assert!(
                json.is_ok(),
                "Definition {} should serialize to JSON",
                def.function.name
            );
        }
    }
}
