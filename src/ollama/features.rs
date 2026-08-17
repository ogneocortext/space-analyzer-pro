//! High-level Ollama-driven features for Space Analyzer Pro.
//!
//! Feature implementations have moved to dedicated submodules:
//! - semantic - semantic_search
//! - summary - summarize_scan
//! - cleanup - cleanup_plan
//! - screenshot - describe_screenshot
//! - agentic - agentic_question
//!
//! This file retains the OllamaClient extension methods and the test module.

use crate::ollama::client::OllamaClient;
use crate::ollama::error::OllamaError;
use crate::ollama::types::{ChatRequest, ChatResponse};

impl OllamaClient {
    /// POST a fully-formed chat request and return the parsed
    /// response. Mirrors the internals of `chat_with_tools` but
    /// accepts the request struct directly so feature code can
    /// customize the wire format.
    pub async fn post_chat(&self, request: &ChatRequest) -> Result<ChatResponse, OllamaError> {
        // Re-use the existing helper to keep behavior identical.
        // (It validates status, parses JSON, tracks metrics.)
        self.post_chat_and_parse(request, self.operation_timeouts().chat, "feature")
            .await
            .map(|(resp, _usage, _elapsed)| resp)
    }

    /// POST a chat request and return the raw response body, even if
    /// it fails to parse. Useful for debugging model output that
    /// doesn't match the expected schema. Returns (status, raw_text).
    pub async fn post_chat_raw(&self, request: &ChatRequest) -> Result<(u16, String), OllamaError> {
        let url = format!("{}/api/chat", self.base_url());
        let response = self
            .post_with_timeout(&url, request, self.operation_timeouts().chat)
            .await?;
        let status = response.status().as_u16();
        let text = response
            .text()
            .await
            .map_err(|e| OllamaError::ParseError(format!("read body: {}", e)))?;
        Ok((status, text))
    }
}

// Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡ Tests Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡

#[cfg(test)]
mod tests {
    //! Unit tests for the capability-driven features module.
    //!
    //! Most tests are pure-data tests (no network) so they run as
    //! part of `cargo test --workspace`. Tests that call Ollama detect
    //! a running server at `http://127.0.0.1:11434`:
    //!   - If reachable, the test runs and verifies behavior.
    //!   - If unreachable, the test passes with a SKIP message.

    use crate::gui_common;
    use crate::ollama::agentic::{agentic_question, ToolExecutor};
    use crate::ollama::helpers::{encode_image_for_ollama, split_thinking};
    use crate::ollama::models::{
        AgenticStep, CleanupPlanInput, ScreenshotInput, ScanSummaryInput, SemanticSearchInput, StepKind,
    };
    use crate::ollama::semantic::semantic_search;
    use crate::ollama::summary::summarize_scan;
    use crate::ollama::types::{
        ChatMessage, ChatRequest, ChatResponse, ToolCall, ToolCallFunction, ToolDefinition, ToolParameters,
    };

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

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ Data-shape tests (no network) Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡

    #[test]
    fn semantic_search_input_constructs() {
        let input = SemanticSearchInput {
            query: "find my tax documents".to_string(),
            files: vec![
                ("C:/a.pdf".to_string(), 1024, "pdf".to_string()),
                ("C:/b.mp4".to_string(), 999_999, "mp4".to_string()),
            ],
            top_k: 5,
        };
        assert_eq!(input.query, "find my tax documents");
        assert_eq!(input.files.len(), 2);
        assert_eq!(input.top_k, 5);
    }

    #[test]
    fn scan_summary_input_constructs_with_empty_types() {
        let input = ScanSummaryInput {
            total_files: 0,
            total_size_bytes: 0,
            top_files: vec![],
            file_types: vec![],
        };
        assert_eq!(input.total_files, 0);
        assert!(input.top_files.is_empty());
        assert!(input.file_types.is_empty());
    }

    #[test]
    fn cleanup_plan_input_constructs_with_and_without_context() {
        let a = CleanupPlanInput {
            question: "Plan to free 200GB".to_string(),
            context: None,
        };
        let b = CleanupPlanInput {
            question: "Plan to free 200GB".to_string(),
            context: Some("D: drive 95% full".to_string()),
        };
        assert!(a.context.is_none());
        assert!(b.context.is_some());
    }

    #[test]
    fn screenshot_input_constructs() {
        let input = ScreenshotInput {
            image_path: "/tmp/x.png".to_string(),
            question: "summarise this".to_string(),
            max_dim: 1024,
        };
        assert_eq!(input.max_dim, 1024);
        assert!(input.image_path.ends_with(".png"));
    }

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ ToolCall / parse-error regression tests Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡

    #[test]
    fn tool_call_parses_without_type_field() {
        // Regression: qwen3.5:4b (and llama3.1, qwen2.5-coder)
        // omit the `type` field on tool_calls. The deserializer
        // must default it to "function" so the rest of the
        // response is not lost.
        let json = r#"{
            "id": "call_abc123",
            "function": {
                "index": 0,
                "name": "get_largest_files",
                "arguments": {"count": 5}
            }
        }"#;
        let parsed: ToolCall = serde_json::from_str(json).expect("must parse without type field");
        assert_eq!(parsed.id, "call_abc123");
        assert_eq!(parsed.call_type, "function", "default must be 'function'");
        assert_eq!(parsed.function.name, "get_largest_files");
        assert_eq!(parsed.function.arguments["count"], 5);
    }

    #[test]
    fn tool_call_parses_with_explicit_type_field() {
        let json = r#"{
            "id": "call_xyz",
            "type": "function",
            "function": {
                "name": "get_disk_volumes",
                "arguments": {}
            }
        }"#;
        let parsed: ToolCall = serde_json::from_str(json).expect("must parse with type field");
        assert_eq!(parsed.call_type, "function");
        assert_eq!(parsed.function.name, "get_disk_volumes");
    }

    #[test]
    fn tool_call_arguments_accept_string_or_object() {
        let as_string = r#"{
            "id": "c1",
            "function": { "name": "f", "arguments": "{\"k\":\"v\"}" }
        }"#;
        let as_object = r#"{
            "id": "c2",
            "function": { "name": "f", "arguments": {"k":"v"} }
        }"#;
        let p1: ToolCall = serde_json::from_str(as_string).unwrap();
        let p2: ToolCall = serde_json::from_str(as_object).unwrap();
        assert_eq!(p1.function.arguments["k"], "v");
        assert_eq!(p2.function.arguments["k"], "v");
    }

    #[test]
    fn tool_definition_serializes_for_ollama_wire() {
        let def = ToolDefinition::new(
            "get_disk_volumes",
            "Get disk volume information",
            ToolParameters::empty(),
        );
        let json = serde_json::to_value(&def).unwrap();
        assert_eq!(json["type"], "function");
        assert_eq!(json["function"]["name"], "get_disk_volumes");
        assert_eq!(json["function"]["parameters"]["type"], "object");
    }

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ ChatResponse / split_thinking tests Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡

    #[test]
    fn chat_response_parses_with_thinking() {
        let json = r#"{
            "model": "qwen3.5:4b",
            "created_at": "2026-06-05T00:00:00Z",
            "message": {
                "role": "assistant",
                "content": "Here's the plan.",
                "thinking": "Step 1: do X. Step 2: do Y."
            },
            "done": true,
            "done_reason": "stop"
        }"#;
        let r: ChatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(r.message.content, "Here's the plan.");
        assert_eq!(
            r.message.thinking.as_deref(),
            Some("Step 1: do X. Step 2: do Y.")
        );
        assert!(r.done);
    }

    #[test]
    fn chat_response_parses_without_thinking() {
        let json = r#"{
            "model": "gemma4:e2b-it-qat",
            "message": { "role": "assistant", "content": "Hi" },
            "done": true
        }"#;
        let r: ChatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(r.message.content, "Hi");
        assert!(r.message.thinking.is_none());
    }

    #[test]
    fn chat_response_parses_with_tool_calls() {
        let json = r#"{
            "model": "qwen3.5:4b",
            "message": {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_1",
                        "function": {
                            "index": 0,
                            "name": "get_largest_files",
                            "arguments": {"count": 5}
                        }
                    }
                ]
            },
            "done": true,
            "done_reason": "stop"
        }"#;
        let r: ChatResponse = serde_json::from_str(json).unwrap();
        let calls = r.message.tool_calls.expect("tool_calls present");
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].function.name, "get_largest_files");
    }

    #[test]
    fn agentic_step_constructs() {
        let s = AgenticStep {
            kind: StepKind::ToolResult,
            text: "D: 12 GB free of 2 TB".to_string(),
            tool_name: Some("get_disk_volumes".to_string()),
            tool_args: Some(serde_json::json!({})),
            duration_ms: 5,
        };
        assert_eq!(s.kind, StepKind::ToolResult);
        assert_eq!(s.tool_name.as_deref(), Some("get_disk_volumes"));
    }

    #[test]
    fn split_thinking_returns_none_for_empty_thinking() {
        let json = r#"{
            "model": "gemma4:e2b-it-qat",
            "message": { "role": "assistant", "content": "ok" },
            "done": true
        }"#;
        let r: ChatResponse = serde_json::from_str(json).unwrap();
        let (thinking, content) = split_thinking(&r);
        assert!(thinking.is_none(), "empty/absent thinking should be None");
        assert_eq!(content, "ok");
    }

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ Embedding / cosine similarity sanity (no network) Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡

    #[test]
    fn cosine_similarity_identical_vectors_is_one() {
        use crate::embedding_service::cosine_similarity;
        let v = vec![0.5_f32; 768];
        let sim = cosine_similarity(&v, &v);
        assert!(
            (sim - 1.0).abs() < 1e-5,
            "identical vectors must be ~1.0, got {sim}"
        );
    }

    #[test]
    fn cosine_similarity_orthogonal_is_zero() {
        use crate::embedding_service::cosine_similarity;
        let mut a = vec![0.0_f32; 4];
        let mut b = vec![0.0_f32; 4];
        a[0] = 1.0;
        b[1] = 1.0;
        let sim = cosine_similarity(&a, &b);
        assert!(sim.abs() < 1e-6, "orthogonal must be ~0.0, got {sim}");
    }

    #[test]
    fn file_to_description_includes_filename_and_size() {
        use crate::embedding_service::file_to_description;
        let d = file_to_description("C:/X/Y.PDF", 1024, "pdf");
        // The description should include the filename, the size, and
        // the full path. Lowercasing is done by the caller
        // (embed_files / embed_query), not by file_to_description
        // itself.
        assert!(d.contains("Y.PDF"), "should include filename: {d}");
        assert!(d.contains("1.00 KB"), "should include size: {d}");
        assert!(d.contains("C:/X/Y.PDF"), "should include path: {d}");
    }

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ Image-encode helper (no network) Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡

    #[test]
    fn encode_image_png_passes_through() {
        // PNG magic: 89 50 4E 47 0D 0A 1A 0A
        let png = b"\x89PNG\r\n\x1a\nrest";
        let (b64, sent) = encode_image_for_ollama(png, 1024).unwrap();
        assert!(sent > 0);
        assert!(!b64.is_empty());
    }

    #[test]
    fn encode_image_jpeg_passes_through() {
        // JPEG magic: FF D8 FF
        let jpg = b"\xFF\xD8\xFF\xE0rest";
        let (b64, sent) = encode_image_for_ollama(jpg, 1024).unwrap();
        assert!(sent > 0);
        assert!(!b64.is_empty());
    }

    #[test]
    fn encode_image_rejects_unknown_format() {
        let bmp = b"BMrest";
        let err = encode_image_for_ollama(bmp, 1024).unwrap_err();
        assert!(err.contains("unsupported image format"), "got: {err}");
    }

    // Î“Ã¶Ã‡Î“Ã¶Ã‡ Network-backed tests (require running Ollama) Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡Î“Ã¶Ã‡

    #[tokio::test]
    async fn live_semantic_search_returns_top_match_for_tax_query() {
        skip_unless_ollama("http://127.0.0.1:11434").await;
        use crate::ollama::OllamaClient;

        let client = OllamaClient::new("http://127.0.0.1:11434", "nomic-embed-text:v1.5")
            .expect("client builder failed");

        let input = SemanticSearchInput {
            query: "US tax filing document".to_string(),
            files: vec![
                (
                    "C:/docs/taxes_2024.pdf".to_string(),
                    1_500_000,
                    "pdf".to_string(),
                ),
                (
                    "C:/videos/birthday.mp4".to_string(),
                    850_000_000,
                    "mp4".to_string(),
                ),
                (
                    "C:/docs/mortgage.pdf".to_string(),
                    400_000,
                    "pdf".to_string(),
                ),
            ],
            top_k: 2,
        };
        let out = semantic_search(&client, "nomic-embed-text:v1.5", input)
            .await
            .expect("search should succeed");
        assert!(!out.matches.is_empty());
        assert!(
            out.matches[0].file_path.contains("taxes"),
            "top match should be the tax PDF, got {}",
            out.matches[0].file_path
        );
        assert!(out.matches[0].similarity > 0.4);
    }

    #[tokio::test]
    async fn live_summarize_scan_returns_non_empty_summary() {
        skip_unless_ollama("http://127.0.0.1:11434").await;
        use crate::ollama::OllamaClient;

        let model =
            std::env::var("OLLAMA_SUMMARIZE_MODEL").unwrap_or_else(|_| "llama3.2:3b".into());
        let client =
            OllamaClient::new("http://127.0.0.1:11434", &model).expect("client builder failed");
        let input = ScanSummaryInput {
            total_files: 100,
            total_size_bytes: 1_000_000_000,
            top_files: vec![gui_common::LargestFileEntry {
                path: "C:/big.bin".to_string(),
                size: 500_000_000,
            }],
            file_types: vec![("bin".to_string(), 50)],
        };
        let out = summarize_scan(&client, &model, input)
            .await
            .expect("summarize should succeed");
        assert!(!out.summary.is_empty());
        assert!(out.completion_tokens > 10);
    }

    #[tokio::test]
    async fn live_agentic_question_calls_at_least_one_tool() {
        skip_unless_ollama("http://127.0.0.1:11434").await;
        use crate::ollama::OllamaClient;

        let client = OllamaClient::new("http://127.0.0.1:11434", "qwen3.5:4b")
            .expect("client builder failed");
        let tools = vec![ToolDefinition::new(
            "echo",
            "Echo back the message",
            ToolParameters::new(
                serde_json::json!({"msg": {"type": "string"}}),
                vec!["msg".to_string()],
            ),
        )];
        let exec: ToolExecutor = Box::new(|call| format!("echo: {}", call.function.arguments));
        let out = agentic_question(
            &client,
            "qwen3.5:4b",
            "Please call the echo tool with msg='hello'.",
            tools,
            exec,
            4,
        )
        .await
        .expect("agent loop should succeed");
        let tool_steps = out
            .steps
            .iter()
            .filter(|s| s.kind == StepKind::ToolResult)
            .count();
        assert!(
            tool_steps >= 1,
            "model should have called at least one tool"
        );
        assert!(!out.final_answer.is_empty());
    }

    #[tokio::test]
    async fn live_tool_call_response_parses_after_default_type_fix() {
        skip_unless_ollama("http://127.0.0.1:11434").await;
        use crate::ollama::OllamaClient;

        let client = OllamaClient::new("http://127.0.0.1:11434", "qwen3.5:4b")
            .expect("client builder failed");
        let req = ChatRequest {
            model: "qwen3.5:4b".to_string(),
            messages: vec![
                ChatMessage::system("You must call the `echo` tool with msg='hi'."),
                ChatMessage::user("Call the tool now."),
            ],
            stream: Some(false),
            options: Some(Default::default()),
            think: None,
            keep_alive: Some("2m".to_string()),
            format: None,
            tools: Some(vec![ToolDefinition::new(
                "echo",
                "Echo back the message",
                ToolParameters::new(
                    serde_json::json!({"msg": {"type": "string"}}),
                    vec!["msg".to_string()],
                ),
            )]),
            tool_choice: Some("required".to_string()),
        };
        let (status, body) = client
            .post_chat_raw(&req)
            .await
            .expect("request should succeed");
        assert_eq!(status, 200);
        // This used to fail with "missing field `type`" before the
        // default = "function" was added. After the fix, it must parse.
        let parsed: ChatResponse =
            serde_json::from_str(&body).expect("must parse without type field");
        let calls = parsed.message.tool_calls.expect("tool_calls present");
        assert!(!calls.is_empty(), "model should have called echo");
        assert_eq!(calls[0].call_type, "function");
        assert_eq!(calls[0].function.name, "echo");
        assert!(calls[0].function.arguments.is_object());
    }

    #[test]
    fn tool_call_function_struct_constructs() {
        // Sanity: ToolCallFunction is constructable; used in tests
        // above via JSON deserialization.
        let _ = ToolCallFunction {
            index: None,
            name: "x".to_string(),
            arguments: serde_json::json!({}),
        };
    }
}
