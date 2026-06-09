//! Ollama API request/response types, chat messages, and tool calling types
//!
//! This module now acts as a small facade over focused submodules so the
//! Ollama type surface stays easier to navigate and maintain.

#![allow(dead_code)] // Planned Ollama integration — types not yet consumed by GUI

#[path = "chat.rs"]
mod chat;
#[path = "fallback.rs"]
mod fallback;
#[path = "history.rs"]
mod history;
#[path = "metadata.rs"]
mod metadata;
#[path = "requests.rs"]
mod requests;
#[path = "schema.rs"]
mod schema;
#[path = "telemetry.rs"]
mod telemetry;

pub use chat::*;
pub use fallback::*;
pub use history::*;
pub use metadata::*;
pub use requests::*;
pub use schema::*;
pub use telemetry::*;
