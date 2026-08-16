use serde::{Deserialize, Serialize};

use super::chat::{ChatMessage, ToolDefinition};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_gpu: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_ctx: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_predict: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repeat_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mirostat: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_batch: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_thread: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub numa: Option<bool>,
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
            repeat_penalty: Some(1.1),
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
    pub fn with_auto_context(
        mut self,
        system_prompt: &str,
        user_prompt: &str,
        safety_margin: f32,
    ) -> Self {
        let estimated_chars = system_prompt.len() + user_prompt.len();
        let estimated_tokens =
            ((estimated_chars as f32 / 4.0) * (1.0 + safety_margin)).ceil() as i32;
        let min_ctx = 2048i32.max(estimated_tokens + 512);
        self.num_ctx = Some(min_ctx.min(128_000));
        self
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<OllamaOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub think: Option<TopLevelThink>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_alive: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ToolDefinition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<String>,
}

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub think: Option<TopLevelThink>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_alive: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TopLevelThink {
    Bool(bool),
    Level(String),
}

#[derive(Debug, Clone, Serialize)]
pub struct EmbedRequest {
    pub model: String,
    pub input: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncate: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_alive: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatResponse {
    pub model: String,
    pub created_at: Option<String>,
    pub message: ChatMessage,
    pub done: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub done_reason: Option<String>,
    #[serde(default)]
    pub total_duration: Option<u64>,
    #[serde(default)]
    pub load_duration: Option<u64>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
    #[serde(default)]
    pub eval_count: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GenerateResponse {
    pub model: String,
    pub response: String,
    pub done: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub done_reason: Option<String>,
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

#[derive(Debug, Clone, Deserialize)]
pub struct EmbedResponse {
    pub model: String,
    pub embeddings: Vec<Vec<f32>>,
    #[serde(default)]
    pub total_duration: Option<u64>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
}

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
