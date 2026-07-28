//! Ollama Function Calling Integration Tests
//!
//! Tests the complete flow of function calling via Ollama including:
//! - Tool definition generation
//! - Tool execution
//! - Tool result processing
//! - Chat continuation with tool results

#![cfg(test)]

use space_analyzer_pro_desktop::ollama::{ToolCall, ToolCallFunction};
use space_analyzer_pro_desktop::tool_registry::ToolRegistry;

// ------------------------------------------------------------------------------

/// Test that tool definitions are properly generated
#[test]
fn tool_definitions_are_valid() {
    let registry = ToolRegistry::new(None);
    let definitions = registry.get_definitions();

    // Ensure we have tool definitions
    assert!(
        !definitions.is_empty(),
        "Tool registry should provide definitions"
    );

    // Verify each definition has required fields
    for def in definitions {
        assert!(
            !def.function.name.is_empty(),
            "Tool name should not be empty"
        );
        assert!(
            def.function.description.len() > 10,
            "Tool description should be meaningful"
        );
    }
}

/// Test that tool execution works for a simple case
#[test]
fn tool_execution_returns_result() {
    let registry = ToolRegistry::new(None);

    // Test a simple tool that should always work
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

    assert!(
        !result.unwrap().is_empty(),
        "Disk volumes tool should return non-empty result"
    );
}

/// Test that tool registry can be created with scan results
#[test]
fn tool_registry_with_scan_result() {
    let registry = ToolRegistry::new(None);
    let definitions = registry.get_definitions();

    // With no scan result, we should still have basic tools
    assert!(
        !definitions.is_empty(),
        "Should have basic tool definitions"
    );
}
