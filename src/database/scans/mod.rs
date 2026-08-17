//! Scan history and duplicate-analysis queries.
//!
//! This module handles saving, retrieving, pruning, and backfilling
//! scan history and duplicate analysis data.

pub mod models;
pub mod queries;

pub use models::*;
