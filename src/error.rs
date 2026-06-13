//! Unified application error type for root-level CLI and GUI entry points.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("CLI error: {0}")]
    Cli(#[from] clap::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("scanner error: {0}")]
    Scanner(#[from] anyhow::Error),

    #[error("validation error: {0}")]
    Validation(String),

    #[error("invalid --min-size: {0}")]
    InvalidMinSize(String),
}

pub type AppResult<T> = Result<T, AppError>;
