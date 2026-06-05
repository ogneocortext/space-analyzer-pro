//! Ollama API request/response types, chat messages, and tool calling types

#![allow(dead_code)] // Planned Ollama integration — types not yet consumed by GUI

use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::Instant;

// ── Chat Message Types ───────────────────────────────────────────

/// Role of a chat message participant
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Role::System => write!(f, "system"),
            Role::User => write!(f, "user"),
            Role::Assistant => write!(f, "assistant"),
            Role::Tool => write!(f, "tool"),
        }
    }
}

/// A single chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: Role,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }
    pub fn tool(content: impl Into<String>, tool_call_id: impl Into<String>) -> Self {
        Self {
            role: Role::Tool,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
        }
    }
    pub fn assistant_with_tool_calls(
        content: impl Into<String>,
        tool_calls: Vec<ToolCall>,
    ) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: Some(tool_calls),
            tool_call_id: None,
        }
    }
    /// Create a user message with an image (base64-encoded)
    pub fn user_with_image(content: impl Into<String>, image_base64: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            thinking: None,
            images: Some(vec![image_base64.into()]),
            tool_calls: None,
            tool_call_id: None,
        }
    }
    /// Create a user message with multiple images (base64-encoded)
    pub fn user_with_images(content: impl Into<String>, images: Vec<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            thinking: None,
            images: Some(images),
            tool_calls: None,
            tool_call_id: None,
        }
    }
}

// ── Tool Calling Types ───────────────────────────────────────────

/// A tool definition to send to Ollama for function calling
#[derive(Debug, Clone, Serialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: FunctionDefinition,
}

/// Function definition within a tool
#[derive(Debug, Clone, Serialize)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: ToolParameters,
}

/// Parameters schema for a tool function
#[derive(Debug, Clone, Serialize)]
pub struct ToolParameters {
    #[serde(rename = "type")]
    pub param_type: String,
    pub properties: serde_json::Value,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub required: Vec<String>,
}

/// A tool call request from the assistant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolCallFunction,
}

/// Function call details within a tool call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    #[serde(default)]
    pub index: Option<u32>,
    pub name: String,
    #[serde(deserialize_with = "deserialize_arguments")]
    pub arguments: serde_json::Value,
}

fn deserialize_arguments<'de, D>(deserializer: D) -> Result<serde_json::Value, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(s) => {
            if s.is_empty() || s == "{}" {
                Ok(serde_json::json!({}))
            } else {
                serde_json::from_str(&s).map_err(serde::de::Error::custom)
            }
        }
        serde_json::Value::Object(_) => Ok(value),
        _ => Ok(serde_json::json!({})),
    }
}

impl ToolCallFunction {
    pub fn get_argument(&self, key: &str) -> Option<&serde_json::Value> {
        self.arguments.get(key)
    }
}

impl ToolDefinition {
    pub fn new(name: &str, description: &str, parameters: ToolParameters) -> Self {
        Self {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: name.to_string(),
                description: description.to_string(),
                parameters,
            },
        }
    }
}

impl ToolParameters {
    pub fn new(properties: serde_json::Value, required: Vec<String>) -> Self {
        Self {
            param_type: "object".to_string(),
            properties,
            required,
        }
    }

    pub fn empty() -> Self {
        Self {
            param_type: "object".to_string(),
            properties: serde_json::json!({}),
            required: vec![],
        }
    }
}

// ── Request/Response Types ───────────────────────────────────────

/// Configurable options for Ollama requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaOptions {
    /// Number of GPU layers to offload (-1 = all)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_gpu: Option<i32>,
    /// Temperature for sampling (0.0-2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Context window size in tokens (default 2048, recommend 8192+ for analysis)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_ctx: Option<i32>,
    /// Maximum tokens to generate (-1 = unlimited)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_predict: Option<i32>,
    /// Top-p sampling threshold
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    /// Minimum probability threshold for token selection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_p: Option<f32>,
    /// Top-k sampling threshold
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<i32>,
    /// Repeat penalty (1.0 = no penalty)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repeat_penalty: Option<f32>,
    /// Stop sequences
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,
    /// Random seed for deterministic output (used for JSON retry stability)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    /// Mirostat sampling (0 = disabled, 1 = Mirostat, 2 = Mirostat 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mirostat: Option<i32>,
    /// Batch size for prompt evaluation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_batch: Option<i32>,
    /// Number of parallel threads
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_thread: Option<i32>,
    /// Whether to use F16 for KV cache
    #[serde(skip_serializing_if = "Option::is_none")]
    pub numa: Option<bool>,
    /// Penalize newline token
    #[serde(skip_serializing_if = "Option::is_none")]
    pub penalize_newline: Option<bool>,
}

impl Default for OllamaOptions {
    fn default() -> Self {
        Self {
            num_gpu: Some(-1),
            temperature: Some(0.3),
            num_ctx: Some(8192),
            num_predict: Some(-1),
            top_p: None,
            min_p: None,
            top_k: None,
            repeat_penalty: None,
            stop: None,
            seed: None,
            mirostat: None,
            num_batch: None,
            num_thread: None,
            numa: None,
            penalize_newline: None,
        }
    }
}

impl OllamaOptions {
    /// Auto-size context window based on input length
    pub fn with_auto_context(
        mut self,
        system_prompt: &str,
        user_prompt: &str,
        safety_margin: f32,
    ) -> Self {
        let estimated_chars = system_prompt.len() + user_prompt.len();
        // ~4 chars per token, add 50% safety margin, minimum 2048
        let estimated_tokens =
            ((estimated_chars as f32 / 4.0) * (1.0 + safety_margin)).ceil() as i32;
        let min_ctx = 2048i32.max(estimated_tokens + 512); // +512 for output
        self.num_ctx = Some(min_ctx.min(128_000)); // cap at 128K
        self
    }
}

/// Chat completion request
#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<OllamaOptions>,
    /// Enable/disable extended thinking output (Ollama 0.30+).
    /// Must be a top-level field; placing it inside options is silently ignored.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub think: Option<TopLevelThink>,
    /// How long to keep the model loaded (-1 = forever, 0 = immediate unload, "5m" = 5 minutes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_alive: Option<String>,
    /// Force JSON output mode
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    /// Tool definitions for function calling
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ToolDefinition>>,
    /// Control tool choice: "auto" (default), "none", or "required"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<String>,
}

/// Generation request (raw text, no chat format)
#[derive(Debug, Clone, Serialize)]
pub struct GenerateRequest {
    pub model: String,
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<OllamaOptions>,
    /// Extended thinking flag for generate endpoint (Ollama 0.30+).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub think: Option<TopLevelThink>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_alive: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
}

/// The think field on chat/generate requests in Ollama 0.30+.
/// true/false toggles thinking; string levels ("low", "medium", "high")
/// select tiered budgets (gpt-oss models).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TopLevelThink {
    Bool(bool),
    Level(String),
}

/// Embedding request
#[derive(Debug, Clone, Serialize)]
pub struct EmbedRequest {
    pub model: String,
    pub input: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncate: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_alive: Option<String>,
    /// Optional task type hint for embedding models
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task: Option<String>,
}

/// Chat completion response
#[derive(Debug, Clone, Deserialize)]
pub struct ChatResponse {
    pub model: String,
    pub created_at: Option<String>,
    pub message: ChatMessage,
    pub done: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub done_reason: Option<String>,
    /// Total request duration in nanoseconds
    #[serde(default)]
    pub total_duration: Option<u64>,
    /// Model load duration in nanoseconds
    #[serde(default)]
    pub load_duration: Option<u64>,
    /// Prompt evaluation token count
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
    /// Response evaluation token count
    #[serde(default)]
    pub eval_count: Option<u32>,
}

/// Generation response
#[derive(Debug, Clone, Deserialize)]
pub struct GenerateResponse {
    pub model: String,
    pub response: String,
    pub done: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub done_reason: Option<String>,
    /// Extended thinking trace when think is enabled on the request.
    #[serde(default)]
    pub thinking: Option<String>,
    #[serde(default)]
    pub total_duration: Option<u64>,
    #[serde(default)]
    pub load_duration: Option<u64>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
    #[serde(default)]
    pub eval_count: Option<u32>,
}

/// Embedding response
#[derive(Debug, Clone, Deserialize)]
pub struct EmbedResponse {
    pub model: String,
    pub embeddings: Vec<Vec<f32>>,
    #[serde(default)]
    pub total_duration: Option<u64>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
}

/// Token usage statistics from a response
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_duration_ms: Option<u64>,
    pub load_duration_ms: Option<u64>,
}

impl TokenUsage {
    pub fn total_tokens(&self) -> u32 {
        self.prompt_tokens + self.completion_tokens
    }

    pub fn from_chat_response(response: &ChatResponse) -> Self {
        Self {
            prompt_tokens: response.prompt_eval_count.unwrap_or(0),
            completion_tokens: response.eval_count.unwrap_or(0),
            total_duration_ms: response.total_duration.map(|ns| ns / 1_000_000),
            load_duration_ms: response.load_duration.map(|ns| ns / 1_000_000),
        }
    }
}

/// Server-reported capability strings. Ollama 0.30+ returns these on `/api/tags`.
/// Recognized values: "completion", "tools", "thinking", "vision", "embedding", "insert".
#[derive(Debug, Clone, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: u64,
    pub digest: String,
    pub modified_at: String,
    #[serde(default)]
    pub details: Option<ModelDetails>,
    /// Capabilities reported by Ollama 0.30+ (completion, tools, thinking, vision, …).
    /// Older servers omit the field; we default to an empty list.
    #[serde(default)]
    pub capabilities: Vec<String>,
    /// Set when the model is hosted remotely (Ollama cloud models).
    /// Examples: `https://ollama.com:443`.
    #[serde(default)]
    pub remote_host: Option<String>,
    /// The remote model identifier (only present for cloud models).
    #[serde(default)]
    pub remote_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModelDetails {
    #[serde(default)]
    pub parent_model: String,
    #[serde(default)]
    pub format: String,
    #[serde(default)]
    pub family: String,
    #[serde(default)]
    pub families: Vec<String>,
    #[serde(default)]
    pub parameter_size: String,
    #[serde(default)]
    pub quantization_level: String,
    /// Context length in tokens (Ollama 0.30+).
    #[serde(default)]
    pub context_length: Option<u32>,
    /// Embedding vector dimension (Ollama 0.30+, embedding models only).
    #[serde(default)]
    pub embedding_length: Option<u32>,
}

/// Models list response
#[derive(Debug, Clone, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

/// Response of `GET /api/version`. Introduced in Ollama 0.4.10+ but present in
/// 0.30+ as well — older servers may return 404, callers should treat the
/// error as "unknown version".
#[derive(Debug, Clone, Deserialize)]
pub struct VersionResponse {
    pub version: String,
}

/// Response of `GET /api/ps` — currently loaded / running models.
#[derive(Debug, Clone, Deserialize)]
pub struct PsResponse {
    pub models: Vec<RunningModel>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunningModel {
    pub name: String,
    pub model: String,
    /// Total model size in bytes.
    pub size: u64,
    /// Bytes resident in VRAM.
    pub size_vram: u64,
    /// ISO 8601 timestamp when the model will be unloaded if no activity.
    pub expires_at: String,
}

/// Convenience: is the model hosted in the cloud rather than locally?
pub fn is_cloud_model(info: &ModelInfo) -> bool {
    info.remote_host.is_some() || info.remote_model.is_some()
}

/// Show model response
#[derive(Debug, Clone, Deserialize)]
pub struct ShowModelResponse {
    #[serde(default)]
    pub modelfile: Option<String>,
    #[serde(default)]
    pub parameters: Option<String>,
    #[serde(default)]
    pub template: Option<String>,
    #[serde(default)]
    pub details: Option<ModelDetails>,
}

/// Pull model request
#[derive(Debug, Clone, Serialize)]
pub struct PullRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

/// Pull model response (non-streaming)
#[derive(Debug, Clone, Deserialize)]
pub struct PullResponse {
    pub status: String,
}

/// Pull model progress for streaming responses
#[derive(Debug, Clone, Deserialize)]
pub struct PullProgress {
    pub status: String,
    #[serde(default)]
    pub digest: Option<String>,
    #[serde(default)]
    pub total: Option<u64>,
    #[serde(default)]
    pub completed: Option<u64>,
}

impl PullProgress {
    pub fn progress_pct(&self) -> f64 {
        match (self.completed, self.total) {
            (Some(c), Some(t)) if t > 0 => c as f64 / t as f64 * 100.0,
            _ => 0.0,
        }
    }
}

/// Copy model request
#[derive(Debug, Clone, Serialize)]
pub struct CopyModelRequest {
    pub source: String,
    pub destination: String,
}

/// Delete model request
#[derive(Debug, Clone, Serialize)]
pub struct DeleteModelRequest {
    pub name: String,
}

/// Create model request (from Modelfile)
#[derive(Debug, Clone, Serialize)]
pub struct CreateModelRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modelfile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

// ── JSON Schema Types ────────────────────────────────────────────

/// JSON Schema for structured output validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonSchema {
    #[serde(rename = "type")]
    pub schema_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Box<JsonSchema>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl JsonSchema {
    /// Create a simple object schema with string properties
    pub fn object(
        properties: serde_json::Map<String, serde_json::Value>,
        required: Vec<String>,
    ) -> Self {
        Self {
            schema_type: "object".to_string(),
            properties: Some(properties),
            items: None,
            required: Some(required),
            description: None,
            extra: serde_json::Map::new(),
        }
    }

    /// Create an array schema
    pub fn array(items: JsonSchema) -> Self {
        Self {
            schema_type: "array".to_string(),
            properties: None,
            items: Some(Box::new(items)),
            required: None,
            description: None,
            extra: serde_json::Map::new(),
        }
    }
}

// ── Conversation History ─────────────────────────────────────────

/// A message entry in a conversation history
#[derive(Debug, Clone)]
pub struct ConversationEntry {
    pub message: ChatMessage,
    pub timestamp: Instant,
    pub token_usage: Option<TokenUsage>,
}

impl ConversationEntry {
    pub fn new(message: ChatMessage, token_usage: Option<TokenUsage>) -> Self {
        Self {
            message,
            timestamp: Instant::now(),
            token_usage,
        }
    }
}

/// Conversation history manager for multi-turn interactions
#[derive(Debug, Clone)]
pub struct ConversationHistory {
    pub entries: Vec<ConversationEntry>,
    pub max_turns: usize,
    pub system_prompt: Option<String>,
}

impl ConversationHistory {
    pub fn new(max_turns: usize) -> Self {
        Self {
            entries: Vec::with_capacity(max_turns * 2),
            max_turns,
            system_prompt: None,
        }
    }

    /// Add a message to the conversation
    pub fn add_message(&mut self, message: ChatMessage, token_usage: Option<TokenUsage>) {
        // Trim oldest non-system entries if at capacity (each turn is user + assistant = 2 entries)
        while self.entries.len() >= self.max_turns * 2 {
            // Find the first non-system entry and remove it (along with its paired response if possible)
            if let Some(pos) = self
                .entries
                .iter()
                .position(|e| !matches!(e.message.role, Role::System))
            {
                self.entries.remove(pos);
            } else {
                break;
            }
        }
        self.entries
            .push(ConversationEntry::new(message, token_usage));
    }

    /// Get all messages for API call (prepends system prompt if set)
    pub fn get_messages(&self) -> Vec<ChatMessage> {
        let mut messages = Vec::with_capacity(self.entries.len() + 1);

        // Add system prompt first if set
        if let Some(system) = &self.system_prompt {
            messages.push(ChatMessage::system(system));
        }

        // Add all entries
        for entry in &self.entries {
            messages.push(entry.message.clone());
        }

        messages
    }

    /// Set or update the system prompt
    pub fn set_system_prompt(&mut self, prompt: String) {
        self.system_prompt = Some(prompt);
    }

    /// Clear conversation history (keeps system prompt)
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Total tokens used in this conversation
    pub fn total_tokens(&self) -> u32 {
        self.entries
            .iter()
            .filter_map(|e| e.token_usage.as_ref())
            .map(|u| u.total_tokens())
            .sum()
    }

    /// Number of turns (user messages)
    pub fn turn_count(&self) -> usize {
        self.entries
            .iter()
            .filter(|e| matches!(e.message.role, Role::User))
            .count()
    }
}

// ── Metrics / Telemetry ──────────────────────────────────────────

/// Performance and usage metrics for the Ollama client
#[derive(Debug, Clone)]
pub struct ClientMetrics {
    pub total_requests: u64,
    pub total_chat_requests: u64,
    pub total_generate_requests: u64,
    pub total_embed_requests: u64,
    pub total_vision_requests: u64,
    pub total_tokens_prompt: u64,
    pub total_tokens_completion: u64,
    pub total_errors: u64,
    pub last_error: Option<String>,
    pub cumulative_duration_ms: u64,
    pub start_time: Instant,
}

impl Default for ClientMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            total_chat_requests: 0,
            total_generate_requests: 0,
            total_embed_requests: 0,
            total_vision_requests: 0,
            total_tokens_prompt: 0,
            total_tokens_completion: 0,
            total_errors: 0,
            last_error: None,
            cumulative_duration_ms: 0,
            start_time: Instant::now(),
        }
    }
}

impl ClientMetrics {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn uptime_seconds(&self) -> f64 {
        self.start_time.elapsed().as_secs_f64()
    }

    pub fn avg_duration_ms(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            self.cumulative_duration_ms as f64 / self.total_requests as f64
        }
    }

    pub fn total_tokens(&self) -> u64 {
        self.total_tokens_prompt + self.total_tokens_completion
    }

    pub fn error_rate(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            self.total_errors as f64 / self.total_requests as f64 * 100.0
        }
    }
}

/// Operation timeout configuration
#[derive(Debug, Clone, Copy)]
pub struct OperationTimeouts {
    pub connect: std::time::Duration,
    pub chat: std::time::Duration,
    pub generate: std::time::Duration,
    pub embed: std::time::Duration,
    pub pull_model: std::time::Duration,
    pub model_management: std::time::Duration,
    pub list_models: std::time::Duration,
    pub vision: std::time::Duration,
}

impl Default for OperationTimeouts {
    fn default() -> Self {
        Self {
            connect: std::time::Duration::from_secs(5),
            chat: std::time::Duration::from_secs(120),
            generate: std::time::Duration::from_secs(120),
            embed: std::time::Duration::from_secs(60),
            pull_model: std::time::Duration::from_secs(600),
            model_management: std::time::Duration::from_secs(30),
            list_models: std::time::Duration::from_secs(10),
            vision: std::time::Duration::from_secs(180),
        }
    }
}

// ── Fallback Model Configuration ─────────────────────────────────

/// Configure model fallback behavior
#[derive(Debug, Clone)]
pub struct ModelFallbackConfig {
    pub enabled: bool,
    /// Ordered list of fallback models to try
    pub fallback_models: Vec<String>,
    /// Whether to log fallback attempts
    pub log_fallbacks: bool,
}

impl Default for ModelFallbackConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            fallback_models: vec![],
            log_fallbacks: true,
        }
    }
}

impl ModelFallbackConfig {
    /// Create config with common fallback chain
    pub fn with_common_fallbacks(primary_model: &str) -> Self {
        let mut fallbacks = vec![];
        let primary_lower = primary_model.to_lowercase();

        // Build sensible fallback chain based on the primary model family
        if primary_lower.contains("llama")
            || primary_lower.contains("mistral")
            || primary_lower.contains("phi")
        {
            fallbacks.push("llama3.2:3b".to_string());
            fallbacks.push("phi4-mini".to_string());
            fallbacks.push("tinyllama".to_string());
            fallbacks.push("llama3.2:1b".to_string());
        } else {
            // Generic fallbacks
            fallbacks.push("llama3.2:3b".to_string());
            fallbacks.push("phi4-mini".to_string());
            fallbacks.push("tinyllama".to_string());
        }

        Self {
            enabled: true,
            fallback_models: fallbacks,
            log_fallbacks: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_top_level_think_serialization() {
        let req = ChatRequest {
            model: "qwen3".into(),
            messages: vec![ChatMessage::user("hello")],
            stream: None,
            options: None,
            think: Some(TopLevelThink::Bool(true)),
            keep_alive: None,
            format: None,
            tools: None,
            tool_choice: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"think\":true"), "{}", json);

        let req2 = ChatRequest {
            model: "gpt-oss".into(),
            messages: vec![ChatMessage::user("hello")],
            stream: None,
            options: None,
            think: Some(TopLevelThink::Level("low".into())),
            keep_alive: None,
            format: None,
            tools: None,
            tool_choice: None,
        };
        let json2 = serde_json::to_string(&req2).unwrap();
        assert!(json2.contains("\"think\":\"low\""), "{}", json2);
    }

    #[test]
    fn test_top_level_think_skips_none() {
        let req = ChatRequest {
            model: "gemma3".into(),
            messages: vec![ChatMessage::user("hello")],
            stream: None,
            options: Some(OllamaOptions::default()),
            think: None,
            keep_alive: None,
            format: None,
            tools: None,
            tool_choice: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(!json.contains("\"think\""));
    }

    #[test]
    fn test_chat_message_thinking_field() {
        let msg = ChatMessage::system("You are a helpful assistant.");
        assert!(msg.thinking.is_none());
        let json = serde_json::to_string(&msg).unwrap();
        assert!(!json.contains("thinking"));
    }

    fn test_role_serialization() {
        let msg = ChatMessage::system("test");
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"role\":\"system\""));
    }

    #[test]
    fn test_chat_request_serialization() {
        let request = ChatRequest {
            model: "phi4-mini".to_string(),
            messages: vec![ChatMessage::user("hello")],
            stream: Some(false),
            options: Some(OllamaOptions::default()),
            think: None,
            keep_alive: Some("5m".to_string()),
            format: None,
            tools: None,
            tool_choice: None,
        };
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"model\":\"phi4-mini\""));
        assert!(json.contains("\"stream\":false"));
        assert!(json.contains("\"num_ctx\":8192"));
    }

    #[test]
    fn test_chat_request_skips_none_fields() {
        let options = OllamaOptions {
            top_p: None,
            stop: None,
            ..Default::default()
        };
        let request = ChatRequest {
            model: "test".to_string(),
            messages: vec![],
            stream: None,
            options: Some(options),
            think: None,
            keep_alive: None,
            format: None,
            tools: None,
            tool_choice: None,
        };
        let json = serde_json::to_string(&request).unwrap();
        assert!(!json.contains("\"stream\""));
        assert!(!json.contains("\"keep_alive\""));
        assert!(!json.contains("\"format\""));
        assert!(!json.contains("\"tool_choice\""));
        assert!(!json.contains("\"top_p\""));
        assert!(!json.contains("\"stop\""));
    }

    #[test]
    fn test_token_usage() {
        let usage = TokenUsage {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_duration_ms: Some(1200),
            load_duration_ms: Some(300),
        };
        assert_eq!(usage.total_tokens(), 150);
    }

    #[test]
    fn test_ollama_options_default() {
        let opts = OllamaOptions::default();
        assert_eq!(opts.num_gpu, Some(-1));
        assert_eq!(opts.temperature, Some(0.3));
        assert_eq!(opts.num_ctx, Some(8192));
    }

    #[test]
    fn test_chat_message_helpers() {
        let system = ChatMessage::system("sys");
        assert_eq!(system.role, Role::System);

        let user = ChatMessage::user("usr");
        assert_eq!(user.role, Role::User);

        let assistant = ChatMessage::assistant("ast");
        assert_eq!(assistant.role, Role::Assistant);
    }

    #[test]
    fn test_auto_context() {
        let opts = OllamaOptions::default().with_auto_context("Short system", "Short user", 0.5);
        assert!(opts.num_ctx.unwrap() >= 2048);
    }

    #[test]
    fn test_pull_progress() {
        let progress = PullProgress {
            status: "downloading digest".to_string(),
            digest: Some("abc123".to_string()),
            total: Some(1000),
            completed: Some(500),
        };
        assert!((progress.progress_pct() - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_conversation_history() {
        let mut conv = ConversationHistory::new(5);
        conv.set_system_prompt("You are a helper.".to_string());
        conv.add_message(ChatMessage::user("Hello"), None);
        conv.add_message(ChatMessage::assistant("Hi!"), None);

        let messages = conv.get_messages();
        assert_eq!(messages.len(), 3); // system + user + assistant
        assert_eq!(conv.turn_count(), 1);
        assert_eq!(conv.total_tokens(), 0);
    }

    #[test]
    fn test_client_metrics() {
        let metrics = ClientMetrics::new();
        assert!(metrics.uptime_seconds() >= 0.0);
        assert_eq!(metrics.total_requests, 0);
    }

    #[test]
    fn test_user_with_image() {
        let msg = ChatMessage::user_with_image("Describe this", "base64data");
        assert!(msg.images.is_some());
        assert_eq!(msg.images.unwrap()[0], "base64data");
    }

    #[test]
    fn test_fallback_config_creation() {
        let config = ModelFallbackConfig::with_common_fallbacks("llama3.1:8b");
        assert!(config.enabled);
        assert!(!config.fallback_models.is_empty());
    }

    // ── ModelInfo / Version / Ps tests (Ollama 0.30+ payload compatibility) ──

    #[test]
    fn test_model_info_deserializes_ollama_030_payload() {
        // Captured from a real `GET /api/tags` on Ollama 0.30.5.
        // Validates that capabilities, context_length, embedding_length, and
        // remote_host are all parsed (previously silently dropped).
        let json = r#"{
            "name": "qwen3.5:4b",
            "model": "qwen3.5:4b",
            "modified_at": "2026-05-31T19:27:30Z",
            "size": 3389983735,
            "digest": "2a654d98e6fba55d452b7043684e9b57a947e393bbffa62485a7aac05ee4eefd",
            "details": {
                "format": "gguf",
                "family": "qwen35",
                "families": ["qwen35"],
                "parameter_size": "4.7B",
                "quantization_level": "Q4_K_M",
                "context_length": 262144,
                "embedding_length": 2560
            },
            "capabilities": ["vision", "completion", "tools", "thinking"]
        }"#;
        let info: ModelInfo = serde_json::from_str(json).unwrap();
        assert_eq!(info.name, "qwen3.5:4b");
        assert_eq!(info.size, 3_389_983_735);
        assert_eq!(
            info.capabilities,
            vec!["vision", "completion", "tools", "thinking"]
        );
        // Check `is_cloud_model` before consuming `details` (partial move).
        assert!(!is_cloud_model(&info));
        let details = info.details.unwrap();
        assert_eq!(details.context_length, Some(262144));
        assert_eq!(details.embedding_length, Some(2560));
        assert_eq!(details.family, "qwen35");
    }

    #[test]
    fn test_model_info_deserializes_cloud_payload() {
        // Cloud models report `remote_host` and a tiny `size`.
        let json = r#"{
            "name": "deepseek-v4-pro:cloud",
            "model": "deepseek-v4-pro:cloud",
            "remote_model": "deepseek-v4-pro",
            "remote_host": "https://ollama.com:443",
            "modified_at": "2026-06-03T12:19:28Z",
            "size": 344,
            "digest": "22bfd5026abd",
            "details": {"context_length": 1048576},
            "capabilities": ["completion", "tools", "thinking"]
        }"#;
        let info: ModelInfo = serde_json::from_str(json).unwrap();
        assert!(is_cloud_model(&info));
        assert_eq!(info.remote_host.as_deref(), Some("https://ollama.com:443"));
        assert_eq!(info.remote_model.as_deref(), Some("deepseek-v4-pro"));
        assert_eq!(info.size, 344);
        assert_eq!(info.details.unwrap().context_length, Some(1_048_576));
    }

    #[test]
    fn test_model_info_deserializes_pre_030_payload() {
        // Older servers omit capabilities/context_length/remote_host entirely.
        let json = r#"{
            "name": "llama2:7b",
            "size": 3800000000,
            "digest": "abc",
            "modified_at": "2025-01-01T00:00:00Z"
        }"#;
        let info: ModelInfo = serde_json::from_str(json).unwrap();
        assert_eq!(info.name, "llama2:7b");
        assert!(info.capabilities.is_empty());
        assert!(info.remote_host.is_none());
        assert!(info.details.is_none());
        assert!(!is_cloud_model(&info));
    }

    #[test]
    fn test_version_response_deserializes() {
        let json = r#"{"version": "0.30.5"}"#;
        let v: VersionResponse = serde_json::from_str(json).unwrap();
        assert_eq!(v.version, "0.30.5");
    }

    #[test]
    fn test_ps_response_deserializes() {
        let json = r#"{
            "models": [{
                "name": "llama3.1:8b",
                "model": "llama3.1:8b",
                "size": 4920753328,
                "size_vram": 4920753328,
                "expires_at": "2026-06-04T19:00:00Z"
            }]
        }"#;
        let ps: PsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(ps.models.len(), 1);
        assert_eq!(ps.models[0].name, "llama3.1:8b");
        assert_eq!(ps.models[0].size_vram, 4_920_753_328);
    }
}
