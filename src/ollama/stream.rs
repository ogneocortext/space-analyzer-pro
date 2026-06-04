//! Streaming response parser for Ollama API

use futures::Stream;
use futures::StreamExt;
use serde::Deserialize;
use std::pin::Pin;

use super::error::{OllamaError, OllamaResult};
use super::types::{ChatMessage, TokenUsage};

/// A chunk of streamed response
#[derive(Debug, Clone)]
pub struct StreamChunk {
    pub content: String,
    /// Partial thinking text when think is enabled on the request.
    pub thinking: Option<String>,
    pub done: bool,
    pub usage: Option<TokenUsage>,
}

pub fn parse_stream(
    stream: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send + 'static,
) -> Pin<Box<dyn Stream<Item = OllamaResult<StreamChunk>> + Send>> {
    #[derive(Deserialize)]
    struct StreamResponse {
        message: Option<ChatMessage>,
        done: bool,
        #[serde(default)]
        #[allow(dead_code)]
        done_reason: Option<String>,
        #[serde(default)]
        prompt_eval_count: Option<u32>,
        #[serde(default)]
        eval_count: Option<u32>,
        #[serde(default)]
        total_duration: Option<u64>,
        #[serde(default)]
        load_duration: Option<u64>,
    }

    Box::pin(stream.then(|chunk| async move {
        let chunk = match chunk {
            Ok(c) => c,
            Err(e) => return futures::stream::iter(vec![Err(OllamaError::from(e))]),
        };
        let text = match String::from_utf8(chunk.to_vec()) {
            Ok(t) => t,
            Err(e) => {
                return futures::stream::iter(vec![Err(OllamaError::ParseError(format!(
                    "Invalid UTF-8 in stream: {}",
                    e
                )))])
            }
        };

        let mut results = Vec::new();
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            match serde_json::from_str::<StreamResponse>(line) {
                Ok(parsed) => {
                    let message = parsed.message;
                    let content = message
                        .as_ref()
                        .map(|m| m.content.clone())
                        .unwrap_or_default();

                    let usage = if parsed.done {
                        Some(TokenUsage {
                            prompt_tokens: parsed.prompt_eval_count.unwrap_or(0),
                            completion_tokens: parsed.eval_count.unwrap_or(0),
                            total_duration_ms: parsed.total_duration.map(|ns| ns / 1_000_000),
                            load_duration_ms: parsed.load_duration.map(|ns| ns / 1_000_000),
                        })
                    } else {
                        None
                    };

                    let thinking = message.and_then(|m| m.thinking);
                    results.push(Ok(StreamChunk {
                        content,
                        thinking,
                        done: parsed.done,
                        usage,
                    }));
                }
                Err(e) => {
                    results.push(Err(OllamaError::ParseError(format!(
                        "Failed to parse stream chunk: {}",
                        e
                    ))));
                }
            }
        }

        futures::stream::iter(results)
    }))
    .flatten()
    .boxed()
}
