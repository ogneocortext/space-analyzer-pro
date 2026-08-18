use crate::embedding_service::SearchResult;
use crate::gui_common;

pub struct SemanticSearchInput {
    /// Natural-language query (e.g. "find documents about my taxes").
    pub query: String,
    /// Files to search over: `(absolute_path, size_bytes, extension)`.
    pub files: Vec<(String, u64, String)>,
    /// How many top matches to return.
    pub top_k: usize,
}

pub struct SemanticSearchOutput {
    pub matches: Vec<SearchResult>,
    pub query_dim: usize,
    pub files_searched: usize,
    pub duration_ms: u128,
    /// Number of vectors the model returned for the query (usually 1).
    pub query_tokens: u32,
}

pub struct ScanSummaryInput {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub potential_cleanup_bytes: Option<u64>,
    pub path: Option<String>,
    pub top_files: Vec<gui_common::LargestFileEntry>,
    pub file_types: Vec<(String, u64)>,
}

pub struct ScanSummaryOutput {
    pub summary: String,
    pub key_insights: Vec<String>,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub duration_ms: u128,
}

pub struct CleanupPlanInput {
    /// The user's question, e.g. "Plan how to free 20GB on my D: drive".
    pub question: String,
    /// Optional disk/scan context to ground the answer.
    pub context: Option<String>,
}

pub struct CleanupPlanOutput {
    pub plan: String,
    /// Chain-of-thought produced by the model. Useful for debugging
    /// and for the GUI's "Show reasoning" toggle. Not shown by default.
    pub thinking: Option<String>,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub duration_ms: u128,
}

pub struct ScreenshotInput {
    /// Absolute path to the image file. PNG / JPEG supported.
    pub image_path: String,
    /// Question to ask about the image.
    pub question: String,
    /// Max dimension (px) on the longest side before base64-encoding.
    /// 0 = keep original size. Default 1024 keeps the payload small.
    pub max_dim: u32,
}

pub struct ScreenshotOutput {
    pub answer: String,
    pub thinking: Option<String>,
    pub original_bytes: u64,
    pub sent_bytes: u64,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub duration_ms: u128,
}

pub struct AgenticStep {
    pub kind: StepKind,
    pub text: String,
    pub tool_name: Option<String>,
    pub tool_args: Option<serde_json::Value>,
    pub duration_ms: u128,
}

#[derive(Debug, PartialEq)]
pub enum StepKind {
    /// Model emitted text (final answer or partial).
    ModelText,
    /// Model requested a tool call.
    ModelToolCall,
    /// Tool was executed locally; result was appended to the conversation.
    ToolResult,
}

pub struct AgenticOutput {
    pub final_answer: String,
    pub steps: Vec<AgenticStep>,
    pub rounds: usize,
    pub total_prompt_tokens: u32,
    pub total_completion_tokens: u32,
    pub duration_ms: u128,
}
