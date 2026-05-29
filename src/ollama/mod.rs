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

pub mod error;
pub mod prompts;
pub mod types;
#[allow(dead_code)] // Used by modular gui and tests, not the legacy binary
pub mod client;
#[allow(dead_code)] // Used by modular gui and tests, not the legacy binary
pub mod stream;
#[allow(dead_code)] // Used by modular gui and tests, not the legacy binary
pub mod json_utils;
#[allow(dead_code)] // Used by modular gui and tests, not the legacy binary
pub mod prompt_cache;

// Re-export everything at module root for backward compatibility.
// Allow unused imports — these form the public API surface consumed by the GUI
// once the Ollama integration is wired up end-to-end.
#[allow(unused_imports)]
pub use error::{OllamaError, OllamaResult};
#[allow(unused_imports)]
pub use prompts::*;
#[allow(unused_imports)]
pub use types::*;
#[allow(unused_imports)]
pub use client::{OllamaClient, OllamaClientBuilder};
#[allow(unused_imports)]
pub use stream::StreamChunk;
#[allow(unused_imports)]
pub use json_utils::{repair_json, validate_json, parse_with_repair, extract_and_validate};
#[allow(unused_imports)]
pub use prompt_cache::{PromptCache, PromptCacheConfig, CacheStats, ModelTokenBudget};
