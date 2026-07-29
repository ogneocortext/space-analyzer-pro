//!
//! # space-analyzer-web
//!
//! Axum-based web server for Space Analyzer Pro.
//! Serves the Svelte 5 frontend and exposes REST APIs.

pub mod server;

pub use server::run;