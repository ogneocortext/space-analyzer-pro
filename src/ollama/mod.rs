//! Ollama AI client for Space Analyzer Pro
//!
//! Provides optional integration with local Ollama LLM for AI-powered
//! file analysis, cleanup recommendations, and natural language queries.
//! Works completely offline - no cloud services required.
//!
//! # Module Structure
//! - `error` — Error types and Result alias
//! - `prompts` — System prompt constants
//! - `types` — Chat messages, tool calling, request/response types, metrics, conversation history
//! - `client` — OllamaClient with builder pattern and all API methods (chat, generate, embed, vision, model mgmt)
//! - `stream` — Streaming response parser
//! - `json_utils` — JSON validation, repair, and extraction utilities
//! - `prompt_cache` — LRU prompt cache with token budget tracking
//! - `features` — High-level features: semantic_search, summarize_scan, cleanup_plan, describe_screenshot, agentic_question

pub mod client;
pub mod error;
pub mod features;
pub mod helpers;
pub mod models;
pub mod semantic;
pub mod summary;
pub mod cleanup;
pub mod screenshot;
pub mod agentic;
pub mod json_utils;
pub mod prompt_cache;
pub mod prompts;
pub mod stream;
pub mod types;

// Re-export everything at module root for backward compatibility.
pub use agentic::agentic_question;
pub use client::{OllamaClient, OllamaClientBuilder};
pub use cleanup::cleanup_plan;
pub use error::{OllamaError, OllamaResult};
pub use helpers::{encode_image_for_ollama, resolve_tool_choice, split_thinking};
pub use json_utils::{extract_and_validate, parse_with_repair, repair_json, validate_json};
pub use models::{
    AgenticOutput, AgenticStep, CleanupPlanInput, CleanupPlanOutput, ScreenshotInput,
    ScreenshotOutput, ScanSummaryInput, ScanSummaryOutput, SemanticSearchInput, SemanticSearchOutput,
};
pub use prompt_cache::{CacheStats, ModelTokenBudget, PromptCache, PromptCacheConfig};
pub use prompts::*;
pub use screenshot::describe_screenshot;
pub use semantic::semantic_search;
pub use stream::StreamChunk;
pub use summary::summarize_scan;
pub use types::*;
