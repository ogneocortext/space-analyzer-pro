//! Ollama client error types
#![allow(dead_code)] // Planned Ollama integration — not yet wired into GUI

use std::fmt;

/// Ollama client error types
#[derive(Debug)]
pub enum OllamaError {
    /// Connection failed (Ollama not running, wrong URL, etc.)
    ConnectionError(String),
    /// HTTP error with status code
    HttpError { status: u16, message: String },
    /// Response parsing failed
    ParseError(String),
    /// Model not found or not available
    ModelNotFound(String),
    /// Request timed out
    Timeout(String),
    /// Invalid configuration (bad URL, empty model name, etc.)
    ConfigError(String),
}

impl fmt::Display for OllamaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OllamaError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            OllamaError::HttpError { status, message } => {
                write!(f, "HTTP {} error: {}", status, message)
            }
            OllamaError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            OllamaError::ModelNotFound(model) => {
                write!(f, "Model not found: {}. Run 'ollama pull {}' first.", model, model)
            }
            OllamaError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            OllamaError::ConfigError(msg) => write!(f, "Config error: {}", msg),

        }
    }
}

impl std::error::Error for OllamaError {}

impl From<reqwest::Error> for OllamaError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            OllamaError::Timeout(err.to_string())
        } else {
            OllamaError::ConnectionError(err.to_string())
        }
    }
}

pub type OllamaResult<T> = Result<T, OllamaError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ollama_error_display() {
        let err = OllamaError::ModelNotFound("llama3".to_string());
        assert!(err.to_string().contains("llama3"));

        let err = OllamaError::HttpError {
            status: 404,
            message: "not found".to_string(),
        };
        assert!(err.to_string().contains("404"));
    }
}
