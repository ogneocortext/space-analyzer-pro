//! AI functionality modules for Space Analyzer
//!
//! This module is organized into several submodules:
//! - ollama: Ollama process management (availability checking, process spawning)
//! - model_discovery: Model discovery and auto-selection functionality
//! - chat: Chat message processing and tool call handling
//! - quick_actions: Quick action buttons for common tasks
//! - features_panel: Capability-driven feature buttons (v3.5.0+)
//! - rendering: AI chat UI rendering
//! - settings: AI-specific settings rendering

pub mod chat;
pub mod features_panel;
pub mod model_discovery;
pub mod ollama;
pub mod quick_actions;
pub mod rendering;
pub mod settings;
