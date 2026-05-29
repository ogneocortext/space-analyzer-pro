//! AI functionality modules for Space Analyzer
//!
//! This module is organized into several submodules:
//! - ollama: Ollama process management (availability checking, process spawning)
//! - model_discovery: Model discovery and auto-selection functionality
//! - chat: Chat message processing and tool call handling
//! - quick_actions: Quick action buttons for common tasks
//! - rendering: AI chat UI rendering

pub mod chat;
pub mod model_discovery;
pub mod ollama;
pub mod quick_actions;
pub mod rendering;
