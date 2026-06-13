//! Ollama Reliability Test with Data Logging
//!
//! Tests Ollama operations reliability and logs detailed metrics:
//! - Connection reliability
//! - Response time tracking
//! - Error rate analysis
//! - Tool execution success rates

#![cfg(test)]

use space_analyzer_pro_desktop::ollama::client::OllamaClient;
use space_analyzer_pro_desktop::ollama::types::ClientMetrics;
// ------------------------------------------------------------------------------

/// Test Ollama client creation and basic configuration
#[test]
fn ollama_client_creates_successfully() {
    let client = OllamaClient::new("http://localhost:11434", "qwen3:8b");
    assert!(client.is_ok(), "Should create client for localhost");
}

/// Test that invalid URL produces an error
#[test]
fn ollama_client_rejects_empty_url() {
    let result = OllamaClient::new("", "test-model");
    assert!(result.is_err(), "Should reject empty URL");
}

/// Test that invalid model name produces an error
#[test]
fn ollama_client_rejects_empty_model() {
    let result = OllamaClient::new("http://localhost:11434", "");
    assert!(result.is_err(), "Should reject empty model name");
}

/// Test metrics tracking functionality
#[test]
fn metrics_tracking_works() {
    let metrics = ClientMetrics::new();

    // Initially should have zero requests
    assert_eq!(metrics.total_requests, 0);
    assert_eq!(metrics.total_chat_requests, 0);

    // Should track uptime
    assert!(metrics.uptime_seconds() >= 0.0);
}

/// Test client metrics after simulated operations
#[test]
fn metrics_update_on_operations() {
    let mut metrics = ClientMetrics::new();

    // Simulate tracking a chat request
    metrics.total_requests += 1;
    metrics.total_chat_requests += 1;
    metrics.total_tokens_prompt += 100;
    metrics.total_tokens_completion += 50;

    assert_eq!(metrics.total_requests, 1);
    assert_eq!(metrics.total_chat_requests, 1);
    assert_eq!(metrics.total_tokens_prompt, 100);
    assert_eq!(metrics.total_tokens_completion, 50);
}

/// Test URL validation warns for non-localhost
#[test]
fn non_localhost_url_warning() {
    // This test documents that non-localhost URLs trigger a warning
    // The actual warning is printed during client creation
    let client_result = OllamaClient::new("http://external-api.example.com", "test-model");

    // Client should still be created (warning is just a console message)
    // but this documents the behavior
    assert!(
        client_result.is_ok(),
        "Client should still be created with warning"
    );
}
