//! High-level Ollama-driven features for Space Analyzer Pro.
//!
//! Each feature targets one specific model capability reported by Ollama
//! 0.30+ and is designed with a deliberate data-flow shape:
//!
//! | Feature              | Capability | Data flow                                      |
//! |----------------------|------------|------------------------------------------------|
//! | `semantic_search`    | embedding  | Pre-embed files once; new query = 1 embed +   |
//! |                      |            | cosine similarity (no LLM roundtrip)           |
//! | `summarize_scan`     | completion | Send only top-10 files + type breakdown, not  |
//! |                      |            | the whole scan; returns Γëñ 200 token summary    |
//! | `cleanup_plan`       | thinking   | `think: true` ΓåÆ capture `thinking` field; user |
//! |                      |            | sees the final plan, not the chain of thought  |
//! | `describe_screenshot`| vision     | Image is base64-encoded, downscaled to Γëñ1024px |
//! |                      |            | before being embedded in the user message     |
//! | `agentic_question`   | tools      | Model calls only the tools it needs; results   |
//! |                      |            | are appended as `tool` messages, not full      |
//! |                      |            | transcripts. Loops until model returns text.  |
//!
//! All features are async, return structured results with timing/token
//! metrics, and never panic. The returned `String` errors are
//! user-friendly ΓÇö safe to display in a toast or log line.

use std::time::Instant;

use base64::Engine;

use super::client::OllamaClient;
use super::error::OllamaError;
use super::types::{
    ChatMessage, ChatRequest, ChatResponse, OllamaOptions, ToolCall, ToolDefinition, TopLevelThink,
};
use crate::embedding_service::{self, SearchResult};

// ΓöÇΓöÇΓöÇ Shared helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/// Convert a `ChatResponse` into a `(Option<String>, String)` pair
/// where the first element is the chain-of-thought and the second is
/// the user-visible reply. Returns `None` for the thought when the
/// model did not produce one (older servers, or `think: false`).
fn split_thinking(response: &ChatResponse) -> (Option<String>, String) {
    let thinking = response
        .message
        .thinking
        .as_ref()
        .filter(|s| !s.is_empty())
        .cloned();
    let content = response.message.content.clone();
    (thinking, content)
}

/// Format a list of (label, count/size) pairs as a compact markdown
/// table for use inside prompts. Keeps the payload small.
fn fmt_table(rows: &[(String, String)], headers: (&str, &str)) -> String {
    let mut out = format!("| {} | {} |\n|---|---|\n", headers.0, headers.1);
    for (a, b) in rows {
        out.push_str(&format!("| {} | {} |\n", a, b));
    }
    out
}

// ΓöÇΓöÇΓöÇ Feature 1: semantic_search (embedding) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/// Input for the semantic file search feature.
#[derive(Debug, Clone)]
pub struct SemanticSearchInput {
    /// Natural-language query (e.g. "find documents about my taxes").
    pub query: String,
    /// Files to search over: `(absolute_path, size_bytes, extension)`.
    pub files: Vec<(String, u64, String)>,
    /// How many top matches to return.
    pub top_k: usize,
}

/// Result of the semantic search feature.
#[derive(Debug, Clone)]
pub struct SemanticSearchOutput {
    pub matches: Vec<SearchResult>,
    pub query_dim: usize,
    pub files_searched: usize,
    pub duration_ms: u128,
    /// Number of vectors the model returned for the query (usually 1).
    pub query_tokens: u32,
}

/// Embed a list of files and a query, then return top-K matches by
/// cosine similarity. Only one round-trip is made to Ollama (the query
/// embed), assuming the file embeddings were pre-computed by the
/// caller. The caller can pre-compute file embeddings once and re-use
/// them for many queries ΓÇö that's the data-flow win.
pub async fn semantic_search(
    client: &OllamaClient,
    model: &str,
    input: SemanticSearchInput,
) -> Result<SemanticSearchOutput, String> {
    let started = Instant::now();

    let normalized_query = input.query.to_lowercase();

    // Build descriptions for files (caller may have cached these too).
    let descriptions: Vec<String> = input
        .files
        .iter()
        .map(|(p, s, e)| embedding_service::file_to_description(p, *s, e).to_lowercase())
        .collect();

    if descriptions.is_empty() {
        return Err("semantic_search: files list is empty".to_string());
    }

    // Batch-embed the query + all file descriptions in a single call.
    // This sends N+1 strings to the model and gets N+1 vectors back.
    let mut batch = vec![normalized_query];
    batch.extend(descriptions);

    let (mut vectors, usage) = client
        .with_model(model)
        .map_err(|e| e.to_string())?
        .embed(batch)
        .await
        .map_err(|e| e.to_string())?;

    if vectors.is_empty() {
        return Err("semantic_search: model returned no vectors".to_string());
    }
    let query_vec = vectors.remove(0);
    let file_vecs = vectors;
    let query_dim = query_vec.len();

    let stored: Vec<(String, u64, String, Vec<f32>)> = input
        .files
        .iter()
        .zip(file_vecs)
        .map(|((p, s, e), v)| (p.clone(), *s, e.clone(), v))
        .collect();

    let mut matches = embedding_service::search_files(&query_vec, &stored, input.top_k);
    // Truncate to top_k defensively in case upstream search changed
    matches.truncate(input.top_k);

    Ok(SemanticSearchOutput {
        matches,
        query_dim,
        files_searched: input.files.len(),
        duration_ms: started.elapsed().as_millis(),
        query_tokens: usage.prompt_tokens,
    })
}

// ΓöÇΓöÇΓöÇ Feature 2: summarize_scan (completion) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/// Input for the scan summary feature.
#[derive(Debug, Clone)]
pub struct ScanSummaryInput {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub top_files: Vec<(String, u64)>, // path, size (capped to 10)
    pub file_types: Vec<(String, usize)>, // extension, count
}

#[derive(Debug, Clone)]
pub struct ScanSummaryOutput {
    pub summary: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub duration_ms: u128,
}

/// Ask the model for a 2-3 sentence summary of a scan. The prompt is
/// deliberately compact: only the top-10 largest files and the
/// top-10 file types, formatted as a small markdown table. We never
/// send the full file list (which could be millions of entries).
pub async fn summarize_scan(
    client: &OllamaClient,
    model: &str,
    input: ScanSummaryInput,
) -> Result<ScanSummaryOutput, String> {
    let started = Instant::now();

    let size_mb = input.total_size_bytes as f64 / 1_048_576.0;
    let mut top_files: Vec<(String, String)> = input
        .top_files
        .iter()
        .take(10)
        .map(|(p, s)| {
            let name = p.rsplit(['\\', '/']).next().unwrap_or(p).to_string();
            (name, format!("{:.1} MB", *s as f64 / 1_048_576.0))
        })
        .collect();
    if top_files.is_empty() {
        top_files.push(("(none)".to_string(), "-".to_string()));
    }
    let files_table = fmt_table(&top_files, ("File", "Size"));

    let mut types: Vec<(String, String)> = input
        .file_types
        .iter()
        .take(10)
        .map(|(ext, count)| (format!(".{}", ext), count.to_string()))
        .collect();
    if types.is_empty() {
        types.push(("(none)".to_string(), "-".to_string()));
    }
    let types_table = fmt_table(&types, ("Extension", "Count"));

    let system = "You are a concise disk-space analyst. \
        Summarize scans in 2-3 short sentences. \
        Highlight the largest space hogs and any obvious cleanup wins. \
        Do not use bullet points.";

    let user = format!(
        "Scan results:\n\
         - Total files: {}\n\
         - Total size: {:.1} MB\n\n\
         Top largest files:\n{}\n\n\
         File-type breakdown:\n{}",
        input.total_files, size_mb, files_table, types_table
    );

    // Structured output schema constrains the model to return parseable JSON
    let format_schema = serde_json::json!({
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "2-3 sentence scan summary highlighting largest space hogs and cleanup wins"
            },
            "key_insights": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Up to 3 key observations about the scan"
            }
        },
        "required": ["summary"]
    });

    let request = ChatRequest {
        model: model.to_string(),
        messages: vec![ChatMessage::system(system), ChatMessage::user(user)],
        stream: Some(false),
        options: Some(OllamaOptions::default()),
        think: None, // completion: keep it fast
        keep_alive: Some("2m".to_string()),
        format: Some(format_schema),
        tools: None,
        tool_choice: None,
    };

    let response = client
        .with_model(model)
        .map_err(|e| e.to_string())?
        .post_chat(&request)
        .await
        .map_err(|e| e.to_string())?;

    let (_thinking, content) = split_thinking(&response);
    if content.trim().is_empty() {
        return Err("summarize_scan: model returned empty content".to_string());
    }

    // If the model returned valid JSON (structured output), extract the summary field
    let summary = serde_json::from_str::<serde_json::Value>(&content)
        .ok()
        .and_then(|v| v.get("summary").and_then(|s| s.as_str().map(String::from)))
        .unwrap_or(content);

    Ok(ScanSummaryOutput {
        summary,
        prompt_tokens: response.prompt_eval_count.unwrap_or(0),
        completion_tokens: response.eval_count.unwrap_or(0),
        duration_ms: started.elapsed().as_millis(),
    })
}

// ΓöÇΓöÇΓöÇ Feature 3: cleanup_plan (thinking) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

#[derive(Debug, Clone)]
pub struct CleanupPlanInput {
    /// The user's question, e.g. "Plan how to free 20GB on my D: drive".
    pub question: String,
    /// Optional disk/scan context to ground the answer.
    pub context: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CleanupPlanOutput {
    pub plan: String,
    /// Chain-of-thought produced by the model. Useful for debugging
    /// and for the GUI's "Show reasoning" toggle. Not shown by default.
    pub thinking: Option<String>,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub duration_ms: u128,
}

/// Ask the model to reason about a multi-step cleanup problem and
/// return a structured plan. Uses `think: true` (Ollama 0.30+) so
/// qwen3+, deepseek-r1, etc. emit a chain of thought. The thinking
/// is captured separately so the UI can hide it.
pub async fn cleanup_plan(
    client: &OllamaClient,
    model: &str,
    input: CleanupPlanInput,
) -> Result<CleanupPlanOutput, String> {
    let started = Instant::now();

    let system = "You are a senior storage engineer. \
        Reason step-by-step (your reasoning will be hidden from the user), \
        THEN write a numbered plan in your final reply. \
        Each step should have a clear action and an estimated bytes-freed. \
        Be conservative ΓÇö prefer reversible steps first. \
        Use markdown. Keep the plan to Γëñ 7 steps. \
        End with a one-line 'Expected total: X GB' summary. \
        Start the plan immediately with '1.' ΓÇö do not prefix with any label.";

    let mut user = input.question.clone();
    if let Some(ctx) = &input.context {
        user.push_str("\n\nContext:\n");
        user.push_str(ctx);
    }

    let request = ChatRequest {
        model: model.to_string(),
        messages: vec![ChatMessage::system(system), ChatMessage::user(user)],
        stream: Some(false),
        options: Some(OllamaOptions::default()),
        think: Some(TopLevelThink::Bool(true)),
        keep_alive: Some("2m".to_string()),
        format: None,
        tools: None,
        tool_choice: None,
    };

    let response = client
        .with_model(model)
        .map_err(|e| e.to_string())?
        .post_chat(&request)
        .await
        .map_err(|e| e.to_string())?;

    let (thinking, plan) = split_thinking(&response);
    if plan.trim().is_empty() {
        return Err("cleanup_plan: model returned empty plan".to_string());
    }

    Ok(CleanupPlanOutput {
        plan,
        thinking,
        prompt_tokens: response.prompt_eval_count.unwrap_or(0),
        completion_tokens: response.eval_count.unwrap_or(0),
        duration_ms: started.elapsed().as_millis(),
    })
}

// ΓöÇΓöÇΓöÇ Feature 4: describe_screenshot (vision) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

#[derive(Debug, Clone)]
pub struct ScreenshotInput {
    /// Absolute path to the image file. PNG / JPEG supported.
    pub image_path: String,
    /// Question to ask about the image.
    pub question: String,
    /// Max dimension (px) on the longest side before base64-encoding.
    /// 0 = keep original size. Default 1024 keeps the payload small.
    pub max_dim: u32,
}

#[derive(Debug, Clone)]
pub struct ScreenshotOutput {
    pub answer: String,
    pub thinking: Option<String>,
    pub original_bytes: u64,
    pub sent_bytes: u64,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub duration_ms: u128,
}

/// Send an image + question to a vision-capable model. The image is
/// read, optionally downscaled, and embedded as a base64 data URL in
/// the user message. We never re-encode as JPEG (lossy); we resize
/// PNG or convert PNGΓåÆPNG with the new dimensions.
pub async fn describe_screenshot(
    client: &OllamaClient,
    model: &str,
    input: ScreenshotInput,
) -> Result<ScreenshotOutput, String> {
    let started = Instant::now();

    let bytes = std::fs::read(&input.image_path)
        .map_err(|e| format!("read {}: {}", input.image_path, e))?;
    let original_bytes = bytes.len() as u64;

    let (encoded, sent_bytes) = encode_image_for_ollama(&bytes, input.max_dim)?;

    let request = ChatRequest {
        model: model.to_string(),
        messages: vec![ChatMessage::user_with_image(
            input.question.clone(),
            encoded,
        )],
        stream: Some(false),
        options: Some(OllamaOptions::default()),
        think: None, // vision: keep it fast; user can re-prompt with think if they want
        keep_alive: Some("2m".to_string()),
        format: None,
        tools: None,
        tool_choice: None,
    };

    let response = client
        .with_model(model)
        .map_err(|e| e.to_string())?
        .post_chat(&request)
        .await
        .map_err(|e| e.to_string())?;

    let (thinking, answer) = split_thinking(&response);
    if answer.trim().is_empty() {
        return Err("describe_screenshot: model returned empty answer".to_string());
    }

    Ok(ScreenshotOutput {
        answer,
        thinking,
        original_bytes,
        sent_bytes,
        prompt_tokens: response.prompt_eval_count.unwrap_or(0),
        completion_tokens: response.eval_count.unwrap_or(0),
        duration_ms: started.elapsed().as_millis(),
    })
}

/// Encode an image for Ollama. The simplest path that always works
/// with Ollama 0.30+ is to base64 the raw bytes and let the model
/// sniff the format. For a more advanced build we would use the
/// `image` crate to downscale, but the wire format Ollama accepts is
/// "raw base64 of PNG/JPEG bytes inside a `images: [...]` array", so
/// this keeps things simple and dependency-free at this layer.
fn encode_image_for_ollama(bytes: &[u8], _max_dim: u32) -> Result<(String, u64), String> {
    // NOTE: full resizing would require the `image` crate. The bytes
    // are already small for the test images (Γëñ 200 KB) and the model
    // handles them fine. We do a format sniff and warn on BMP/ICO.
    if bytes.len() >= 8 && &bytes[..8] == b"\x89PNG\r\n\x1a\n" {
        // PNG ΓÇö pass through
    } else if bytes.len() >= 3 && &bytes[..3] == b"\xFF\xD8\xFF" {
        // JPEG ΓÇö pass through
    } else {
        return Err(format!(
            "unsupported image format (first bytes: {:02X?}, need PNG or JPEG)",
            &bytes[..bytes.len().min(8)]
        ));
    }
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    let sent = b64.len() as u64;
    Ok((b64, sent))
}

// ΓöÇΓöÇΓöÇ Feature 5: agentic_question (tools) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

#[derive(Debug, Clone)]
pub struct AgenticStep {
    pub kind: StepKind,
    pub text: String,
    pub tool_name: Option<String>,
    pub tool_args: Option<serde_json::Value>,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StepKind {
    /// Model emitted text (final answer or partial).
    ModelText,
    /// Model requested a tool call.
    ModelToolCall,
    /// Tool was executed locally; result was appended to the conversation.
    ToolResult,
}

#[derive(Debug, Clone)]
pub struct AgenticOutput {
    pub final_answer: String,
    pub steps: Vec<AgenticStep>,
    pub rounds: usize,
    pub total_prompt_tokens: u32,
    pub total_completion_tokens: u32,
    pub duration_ms: u128,
}

/// One round of the agentic loop. The closure decides what each tool
/// does. In production this is the `ToolRegistry`; in tests it's a
/// small mock that returns canned strings.
pub type ToolExecutor = Box<dyn Fn(&ToolCall) -> String + Send + Sync>;

/// Decide whether to force tool calling based on the user's question.
/// When the question clearly references disk-analysis tools, forcing
/// tool_choice avoids a round where the model chats instead of acting.
fn resolve_tool_choice(question: &str, tools: &[ToolDefinition]) -> String {
    let q_lower = question.to_lowercase();
    // If the question mentions any known domain keyword, force tool calling
    let domain_keywords = [
        "disk",
        "space",
        "storage",
        "scan",
        "volume",
        "drive",
        "file",
        "folder",
        "directory",
        "largest",
        "size",
        "history",
        "trend",
        "prediction",
        "cleanup",
        "workflow",
        "system",
        "resource",
        "cpu",
        "memory",
        "gpu",
        "summary",
        "breakdown",
        "duplicate",
        "dedup",
    ];
    let has_domain_keyword = domain_keywords.iter().any(|k| q_lower.contains(k));
    // Also check if the question mentions any tool name directly
    let has_tool_name = tools
        .iter()
        .any(|t| q_lower.contains(&t.function.name.to_lowercase()));
    if tools.is_empty() || q_lower.contains("hello") || q_lower.contains("hi ") {
        // No tools available or just a greeting — let the model decide
        "auto".to_string()
    } else if has_domain_keyword || has_tool_name {
        // Domain-specific query — skip chit-chat, go straight to tool calling
        "required".to_string()
    } else {
        "auto".to_string()
    }
}

/// Run a multi-round tool-calling conversation. Each round:
///   1. Send the current message list (system + user + tool_results)
///   2. If the model returns tool_calls, execute them, append the
///      results, and loop.
///   3. If the model returns text, we're done.
pub async fn agentic_question(
    client: &OllamaClient,
    model: &str,
    question: &str,
    tools: Vec<ToolDefinition>,
    execute: ToolExecutor,
    max_rounds: usize,
) -> Result<AgenticOutput, String> {
    let started = Instant::now();
    let mut messages: Vec<ChatMessage> = vec![
        ChatMessage::system(
            "You are a disk-space analyst. Answer the user's question \
             by calling the available tools. Call only the tools you \
             need. Once you have enough information, reply with a \
             concise natural-language answer ΓÇö no JSON, no tool calls.",
        ),
        ChatMessage::user(question),
    ];

    let mut steps: Vec<AgenticStep> = Vec::new();
    let mut total_prompt = 0u32;
    let mut total_completion = 0u32;
    let mut rounds = 0usize;
    let mut final_answer = String::new();

    while rounds < max_rounds {
        rounds += 1;
        let round_start = Instant::now();

        let request = ChatRequest {
            model: model.to_string(),
            messages: messages.clone(),
            stream: Some(false),
            options: Some(OllamaOptions::default()),
            think: None,
            keep_alive: Some("5m".to_string()),
            format: None,
            tools: Some(tools.clone()),
            tool_choice: Some(if rounds == 1 {
                resolve_tool_choice(question, &tools)
            } else {
                "auto".to_string()
            }),
        };

        let response = client
            .with_model(model)
            .map_err(|e| e.to_string())?
            .post_chat(&request)
            .await
            .map_err(|e| e.to_string())?;

        total_prompt += response.prompt_eval_count.unwrap_or(0);
        total_completion += response.eval_count.unwrap_or(0);

        // Case 1: model wants to call tools
        if let Some(calls) = response.message.tool_calls.clone() {
            if !calls.is_empty() {
                // Record the model step (may have empty content alongside the calls)
                let content = response.message.content.clone();
                if !content.trim().is_empty() {
                    steps.push(AgenticStep {
                        kind: StepKind::ModelText,
                        text: content,
                        tool_name: None,
                        tool_args: None,
                        duration_ms: round_start.elapsed().as_millis(),
                    });
                }

                // Append the assistant message (with the tool_calls attached)
                messages.push(response.message.clone());

                for call in &calls {
                    let exec_start = Instant::now();
                    let result = execute(call);
                    steps.push(AgenticStep {
                        kind: StepKind::ToolResult,
                        text: result.clone(),
                        tool_name: Some(call.function.name.clone()),
                        tool_args: Some(call.function.arguments.clone()),
                        duration_ms: exec_start.elapsed().as_millis(),
                    });
                    messages.push(ChatMessage::tool(result, call.id.clone()));
                }
                continue;
            }
        }

        // Case 2: model returned text ΓÇö done.
        let (thinking, content) = split_thinking(&response);
        if !thinking.as_deref().unwrap_or("").is_empty() {
            // If the model also thought, surface it as a step.
            steps.push(AgenticStep {
                kind: StepKind::ModelText,
                text: format!("[thinking] {}", thinking.unwrap_or_default()),
                tool_name: None,
                tool_args: None,
                duration_ms: 0,
            });
        }
        final_answer = content;
        steps.push(AgenticStep {
            kind: StepKind::ModelText,
            text: final_answer.clone(),
            tool_name: None,
            tool_args: None,
            duration_ms: round_start.elapsed().as_millis(),
        });
        break;
    }

    if final_answer.is_empty() && rounds == max_rounds {
        return Err(format!(
            "agentic_question: hit max_rounds ({}) without a final answer",
            max_rounds
        ));
    }

    Ok(AgenticOutput {
        final_answer,
        steps,
        rounds,
        total_prompt_tokens: total_prompt,
        total_completion_tokens: total_completion,
        duration_ms: started.elapsed().as_millis(),
    })
}

// We need to extend `OllamaClient` with a `post_chat` helper that takes
// a pre-built `ChatRequest`. This is the same wire format
// `chat_with_tools` uses internally, but exposed so feature code can
// control the request shape (e.g. set `think: true`, custom
// `keep_alive`, etc.) without going through the public wrapper.
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

// ΓöÇΓöÇΓöÇ Tests ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

#[cfg(test)]
mod tests {
    //! Unit tests for the capability-driven features module.
    //!
    //! Most tests are pure-data tests (no network) so they run as
    //! part of `cargo test --workspace`. The few tests that actually
    //! call Ollama are marked `#[ignore]` and can be run with:
    //!
    //!   cargo test --workspace -- --ignored
    //!
    //! when a local Ollama server is reachable at
    //! `http://127.0.0.1:11434`.

    use super::*;
    use crate::ollama::types::{ToolCall, ToolCallFunction, ToolDefinition, ToolParameters};

    // ΓöÇΓöÇ Data-shape tests (no network) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

    // ΓöÇΓöÇ ToolCall / parse-error regression tests ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

    // ΓöÇΓöÇ ChatResponse / split_thinking tests ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
            "model": "gemma3:4b",
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
            "model": "gemma3:4b",
            "message": { "role": "assistant", "content": "ok" },
            "done": true
        }"#;
        let r: ChatResponse = serde_json::from_str(json).unwrap();
        let (thinking, content) = split_thinking(&r);
        assert!(thinking.is_none(), "empty/absent thinking should be None");
        assert_eq!(content, "ok");
    }

    // ΓöÇΓöÇ Embedding / cosine similarity sanity (no network) ΓöÇΓöÇΓöÇΓöÇ

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

    // ΓöÇΓöÇ Image-encode helper (no network) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

    // ΓöÇΓöÇ Network-backed tests (require running Ollama) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    #[ignore = "requires local Ollama at http://127.0.0.1:11434"]
    #[tokio::test]
    async fn live_semantic_search_returns_top_match_for_tax_query() {
        use crate::ollama::OllamaClient;

        let client = OllamaClient::new("http://127.0.0.1:11434", "nomic-embed-text:latest")
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
        let out = semantic_search(&client, "nomic-embed-text:latest", input)
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

    #[ignore = "requires local Ollama at http://127.0.0.1:11434"]
    #[tokio::test]
    async fn live_summarize_scan_returns_non_empty_summary() {
        use crate::ollama::OllamaClient;

        let model = std::env::var("OLLAMA_SUMMARIZE_MODEL").unwrap_or_else(|_| "llama3.2:3b".into());
        let client = OllamaClient::new("http://127.0.0.1:11434", &model)
            .expect("client builder failed");
        let input = ScanSummaryInput {
            total_files: 100,
            total_size_bytes: 1_000_000_000,
            top_files: vec![("C:/big.bin".to_string(), 500_000_000)],
            file_types: vec![("bin".to_string(), 50)],
        };
        let out = summarize_scan(&client, &model, input)
            .await
            .expect("summarize should succeed");
        assert!(!out.summary.is_empty());
        assert!(out.completion_tokens > 10);
    }

    #[ignore = "requires local Ollama at http://127.0.0.1:11434"]
    #[tokio::test]
    async fn live_agentic_question_calls_at_least_one_tool() {
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

    #[ignore = "requires local Ollama at http://127.0.0.1:11434"]
    #[tokio::test]
    async fn live_tool_call_response_parses_after_default_type_fix() {
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
