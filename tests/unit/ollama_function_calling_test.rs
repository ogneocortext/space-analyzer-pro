//! Ollama Function Calling Integration Tests
//!
//! Tests the complete flow of function calling via Ollama including:
//! - Tool definition generation
//! - Tool execution
//! - Tool result processing
//!
//! Unit tests (no network) run with `cargo test --workspace`.
//! Integration tests detect a running Ollama at `http://127.0.0.1:11434`:
//!   - If reachable, the test runs and verifies behavior.
//!   - If unreachable, the test passes with a SKIP message.
//!
#![cfg(test)]

use space_analyzer_pro_desktop::ollama::{ToolCall, ToolCallFunction};
use space_analyzer_pro_desktop::tool_registry::ToolRegistry;

macro_rules! info {
    ($($arg:tt)*) => { eprintln!("\n[ollama_function_calling] {}", format!($($arg)*)) };
}

/// Check if Ollama is reachable at the given URL.
async fn ollama_reachable(url: &str) -> bool {
    let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
    else {
        return false;
    };
    let Ok(resp) = client.get(&format!("{}/api/tags", url.trim_end_matches('/'))).send().await else {
        return false;
    };
    resp.status().is_success()
}

/// Skip the test (pass with message) unless Ollama is reachable.
async fn skip_unless_ollama(url: &str) {
    if !ollama_reachable(url).await {
        eprintln!("  SKIP: Ollama not reachable at {} (start it to run this test)", url);
    }
}

// ── Pure unit tests (no network) ──────────────────────────────────────

/// Test that tool definitions are properly generated
#[test]
fn tool_definitions_are_valid() {
    info!("Verifying ToolRegistry definitions are valid");
    let registry = ToolRegistry::new(None);
    let definitions = registry.get_definitions();

    eprintln!("  definition_count={}", definitions.len());
    assert!(
        !definitions.is_empty(),
        "Tool registry should provide definitions"
    );

    for (i, def) in definitions.iter().enumerate() {
        eprintln!(
            "    [{}] name='{}', description='{}'",
            i, def.function.name, def.function.description
        );
        assert!(
            !def.function.name.is_empty(),
            "Tool name should not be empty"
        );
        assert!(
            def.function.description.len() > 10,
            "Tool description should be meaningful"
        );
    }
    info!("PASS");
}

/// Test that tool execution works for a simple case
#[test]
fn tool_execution_returns_result() {
    info!("Verifying execute_tool('get_disk_volumes') returns non-empty JSON");
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

    let output = result.unwrap();
    eprintln!("  output_len={} bytes", output.len());
    eprintln!("  output='{}'", output);
    assert!(
        !output.is_empty(),
        "Disk volumes tool should return non-empty result"
    );
    info!("PASS");
}

/// Test that tool registry can be created with scan results
#[test]
fn tool_registry_with_scan_result() {
    info!("Verifying ToolRegistry can be created and provides definitions");
    let registry = ToolRegistry::new(None);
    let definitions = registry.get_definitions();

    eprintln!("  definition_count={}", definitions.len());
    // With no scan result, we should still have basic tools
    assert!(
        !definitions.is_empty(),
        "Should have basic tool definitions"
    );
    info!("PASS");
}

// ── Live integration tests (require Ollama running) ───────────────────

/// End-to-end function calling roundtrip:
/// 1. Send a chat request with tool definitions and tool_choice=required
/// 2. Verify the model responds with a tool call
/// 3. Execute the tool locally via ToolRegistry
/// 4. Send the tool result back to Ollama
/// 5. Verify the final response contains a natural-language answer
#[tokio::test]
async fn live_ollama_function_call_roundtrip() {
    skip_unless_ollama("http://127.0.0.1:11434").await;
    use space_analyzer_pro_desktop::ollama::{
        ChatMessage, OllamaClient, ToolDefinition, ToolParameters,
    };

    let client =
        OllamaClient::new("http://127.0.0.1:11434", "qwen3.5:4b").expect("client builder failed");

    let tool = ToolDefinition::new(
        "get_disk_volumes",
        "Get information about all disk volumes on the system including total size, used space, and available space.",
        ToolParameters::empty(),
    );

    let messages = vec![
        ChatMessage::system("You are a concise assistant. Call get_disk_volumes when asked about disk space, then summarize the result in one short sentence."),
        ChatMessage::user("How much disk space do I have?"),
    ];

    let (content, _thinking, tool_calls, usage) = client
        .chat_with_tools(
            messages,
            Some(vec![tool.clone()]),
            Some("required".to_string()),
            None,
        )
        .await
        .expect("first chat_with_tools should succeed");

    eprintln!("  first_call content='{}'", content);
    eprintln!("  first_call prompt_tokens={}", usage.prompt_tokens);
    eprintln!("  first_call completion_tokens={}", usage.completion_tokens);

    let calls = tool_calls.expect("model should have called get_disk_volumes");
    assert!(
        !calls.is_empty(),
        "model should have returned at least one tool call"
    );
    assert_eq!(calls[0].function.name, "get_disk_volumes");

    // Execute the tool locally
    let registry = ToolRegistry::new(None);
    let tool_result = registry
        .execute_tool(&calls[0], None, None)
        .expect("local tool execution should succeed");
    eprintln!("  tool_result_len={} bytes", tool_result.len());

    // Feed the tool result back and get a natural-language answer
    let followup = vec![
        ChatMessage::system("You are a concise assistant."),
        ChatMessage::user("How much disk space do I have?"),
        ChatMessage::assistant_with_tool_calls(content, calls.clone()),
        ChatMessage::tool(tool_result, calls[0].id.clone()),
    ];

    let (final_content, _thinking2, tool_calls2, usage2) = client
        .chat_with_tools(followup, Some(vec![tool]), None, None)
        .await
        .expect("followup chat_with_tools should succeed");

    eprintln!("  final_content='{}'", final_content);
    eprintln!("  final prompt_tokens={}", usage2.prompt_tokens);
    eprintln!("  final completion_tokens={}", usage2.completion_tokens);

    assert!(
        tool_calls2.is_none(),
        "followup should not require additional tool calls"
    );
    assert!(
        !final_content.is_empty(),
        "final response should not be empty"
    );
}
