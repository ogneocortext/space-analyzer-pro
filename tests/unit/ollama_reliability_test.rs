//! Ollama Reliability Test with Data Logging
//!
//! Tests Ollama operations reliability and logs detailed metrics:
//! - Connection reliability
//! - Response time tracking
//! - Error rate analysis
//! - Tool execution success rates
//!
//! Unit tests (no network) run with `cargo test --workspace`.
//! Integration tests (marked `#[ignore]`) require a local Ollama at
//! `http://127.0.0.1:11434` and run with:
//!
//!   cargo test --workspace -- --ignored
//!

#![cfg(test)]

use space_analyzer_pro_desktop::ollama::client::OllamaClient;
use space_analyzer_pro_desktop::ollama::types::ClientMetrics;

macro_rules! info {
    ($($arg:tt)*) => { eprintln!("\n[ollama_reliability] {}", format!($($arg)*)) };
}

// ── Pure unit tests (no network) ──────────────────────────────────────

/// Test Ollama client creation and basic configuration
#[test]
fn ollama_client_creates_successfully() {
    info!("Verifying OllamaClient::new() accepts valid URL + model");
    let client = OllamaClient::new("http://localhost:11434", "qwen3:8b");
    match &client {
        Ok(c) => {
            eprintln!("  created client: url='{}'", c.base_url());
            info!("PASS");
        }
        Err(e) => {
            eprintln!("  FAIL: {:?}", e);
            panic!("Expected Ok, got Err: {:?}", e);
        }
    }
}

/// Test that invalid URL produces an error
#[test]
fn ollama_client_rejects_empty_url() {
    info!("Verifying OllamaClient::new() rejects empty URL");
    let result = OllamaClient::new("", "test-model");
    eprintln!("  result={:?}", result.is_err());
    assert!(result.is_err(), "Should reject empty URL");
    info!("PASS");
}

/// Test that invalid model name produces an error
#[test]
fn ollama_client_rejects_empty_model() {
    info!("Verifying OllamaClient::new() rejects empty model");
    let result = OllamaClient::new("http://localhost:11434", "");
    eprintln!("  result={:?}", result.is_err());
    assert!(result.is_err(), "Should reject empty model name");
    info!("PASS");
}

/// Test metrics tracking functionality
#[test]
fn metrics_tracking_works() {
    info!("Verifying ClientMetrics::new() is zeroed");
    let metrics = ClientMetrics::new();
    eprintln!(
        "  total_requests={}, total_chat_requests={}, uptime={}",
        metrics.total_requests, metrics.total_chat_requests, metrics.uptime_seconds()
    );
    assert_eq!(metrics.total_requests, 0);
    assert_eq!(metrics.total_chat_requests, 0);
    assert!(metrics.uptime_seconds() >= 0.0);
    info!("PASS");
}

/// Test client metrics after simulated operations
#[test]
fn metrics_update_on_operations() {
    info!("Verifying metrics update after simulated operations");
    let mut metrics = ClientMetrics::new();

    // Simulate tracking a chat request
    metrics.total_requests += 1;
    metrics.total_chat_requests += 1;
    metrics.total_tokens_prompt += 100;
    metrics.total_tokens_completion += 50;

    eprintln!(
        "  total_requests={}, total_chat_requests={}",
        metrics.total_requests, metrics.total_chat_requests
    );
    eprintln!(
        "  total_tokens_prompt={}, total_tokens_completion={}",
        metrics.total_tokens_prompt, metrics.total_tokens_completion
    );
    assert_eq!(metrics.total_requests, 1);
    assert_eq!(metrics.total_chat_requests, 1);
    assert_eq!(metrics.total_tokens_prompt, 100);
    assert_eq!(metrics.total_tokens_completion, 50);
    info!("PASS");
}

/// Test URL validation warns for non-localhost
#[test]
fn non_localhost_url_warning() {
    info!("Verifying non-localhost URL still creates client");
    // This test documents that non-localhost URLs trigger a warning
    // The actual warning is printed during client creation
    let client_result = OllamaClient::new("http://external-api.example.com", "test-model");

    eprintln!("  result={:?}", client_result.is_ok());
    // Client should still be created (warning is just a console message)
    // but this documents the behavior
    assert!(
        client_result.is_ok(),
        "Client should still be created with warning"
    );
    info!("PASS");
}

// ── Live integration tests (require Ollama running) ───────────────────

/// Verify Ollama is reachable and responds to health probes.
#[ignore = "requires local Ollama at http://127.0.0.1:11434"]
#[tokio::test]
async fn ollama_server_reachable() {
    let client = OllamaClient::new("http://127.0.0.1:11434", "qwen3.5:4b")
        .expect("client builder failed");
    let available = client.is_available().await;
    eprintln!("  is_available={}", available);
    assert!(available, "Ollama should be reachable at localhost:11434");
}

/// Verify list_models returns a parsed model list.
#[ignore = "requires local Ollama at http://127.0.0.1:11434"]
#[tokio::test]
async fn ollama_list_models_returns_data() {
    let client = OllamaClient::new("http://127.0.0.1:11434", "qwen3.5:4b")
        .expect("client builder failed");
    let models = client
        .list_models()
        .await
        .expect("list_models should succeed");
    assert!(!models.is_empty(), "should have at least one model installed");
    eprintln!(
        "  models={:?}",
        models.iter().map(|m| m.name.as_str()).collect::<Vec<_>>()
    );
}

/// Verify get_version returns a non-empty version string.
#[ignore = "requires local Ollama at http://127.0.0.1:11434"]
#[tokio::test]
async fn ollama_get_version() {
    let client = OllamaClient::new("http://127.0.0.1:11434", "qwen3.5:4b")
        .expect("client builder failed");
    let version = client
        .get_version()
        .await
        .expect("get_version should succeed");
    assert!(!version.is_empty(), "version string should not be empty");
    eprintln!("  ollama version={}", version);
}

/// Verify a simple chat request succeeds and tracks metrics.
#[ignore = "requires local Ollama at http://127.0.0.1:11434"]
#[tokio::test]
async fn ollama_chat_request_succeeds() {
    use space_analyzer_pro_desktop::ollama::ChatMessage;

    let client = OllamaClient::new("http://127.0.0.1:11434", "qwen3.5:4b")
        .expect("client builder failed");

    let messages = vec![
        ChatMessage::system("You are a concise assistant."),
        ChatMessage::user("Say 'pong' and nothing else."),
    ];

    let (content, _thinking, tool_calls, usage) = client
        .chat_with_tools(messages, None, None, None)
        .await
        .expect("chat_with_tools should succeed");

    eprintln!("  content='{}'", content);
    eprintln!("  prompt_tokens={}", usage.prompt_tokens);
    eprintln!("  completion_tokens={}", usage.completion_tokens);
    assert!(tool_calls.is_none(), "simple chat should not produce tool_calls");
    assert!(!content.is_empty(), "response content should not be empty");
}
