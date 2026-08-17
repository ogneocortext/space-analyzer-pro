//! Screenshot description feature using Ollama vision.

use std::time::Instant;

use super::client::OllamaClient;
use crate::ollama::helpers::encode_image_for_ollama;
use crate::ollama::helpers::split_thinking;
use crate::ollama::models::{ScreenshotInput, ScreenshotOutput};

/// Send an image + question to a vision-capable model. The image is
/// read, optionally downscaled, and embedded as a base64 data URL in
/// the user message. We never re-encode as JPEG (lossy); we resize
/// PNG or convert PNG→PNG with the new dimensions.
pub async fn describe_screenshot(
    client: &OllamaClient,
    model: &str,
    input: ScreenshotInput,
) -> Result<ScreenshotOutput, String> {
    let started = Instant::now();

    let bytes = std::fs::read(&input.image_path)
        .map_err(|e| format!("read {}: {}", input.image_path, e))?;
    let original_bytes = bytes.len() as u64;

    let (encoded, sent_bytes) = encode_image_for_ollama(&bytes, input.max_dim)?;

    let request = crate::ollama::types::ChatRequest {
        model: model.to_string(),
        messages: vec![crate::ollama::types::ChatMessage::user_with_image(
            input.question.clone(),
            encoded,
        )],
        stream: Some(false),
        options: Some(crate::ollama::types::OllamaOptions::default()),
        think: None,
        keep_alive: Some("2m".to_string()),
        format: None,
        tools: None,
        tool_choice: None,
    };

    let response = client
        .with_model(model)
        .map_err(|e| e.to_string())?
        .post_chat(&request)
        .await
        .map_err(|e| format!("describe_screenshot: {}", e))?;

    let (thinking, answer) = split_thinking(&response);
    if answer.trim().is_empty() {
        return Err("describe_screenshot: model returned empty answer".to_string());
    }

    Ok(ScreenshotOutput {
        answer,
        thinking,
        original_bytes,
        sent_bytes,
        prompt_tokens: response.prompt_eval_count.unwrap_or(0),
        completion_tokens: response.eval_count.unwrap_or(0),
        duration_ms: started.elapsed().as_millis(),
    })
}
