//! Space Analyzer Pro — Library root
//!
//! All internal modules are declared here at crate level.
//! Binary targets (space-analyzer-gui, space-analyzer-pro) depend on this lib.
//! Integration tests import this lib instead of using a #[path] shim.

pub mod database;
pub mod embedding_service;
pub mod gui_common;
pub mod ollama;
pub mod session_logger;
pub mod system_monitor;
pub mod tool_registry;
pub mod utils;
pub mod workflows;

// GUI module is private (used internally by the gui binary)
pub mod gui;
