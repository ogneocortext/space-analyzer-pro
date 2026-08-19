//! Space Analyzer Pro — Library root
//!
//! All internal modules are declared here at crate level.
//! Binary targets (space-analyzer-cli) depend on this lib.
//! Integration tests import this lib instead of using a #[path] shim.

pub mod app_inventory;
pub mod category;
pub mod database;
pub mod disk_monitor;
pub mod embedding_service;
pub mod error;
pub mod file_relations;
pub mod gui_common;
pub mod offline_ai;
pub mod ollama;
pub mod recommendations;
pub mod origin_tracer;
pub mod session_logger;
pub mod system_monitor;
pub mod tool_registry;
pub mod utils;
pub mod workflows;

pub mod flow_test;
