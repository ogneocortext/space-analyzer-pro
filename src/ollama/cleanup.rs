//! Cleanup plan feature using Ollama thinking.

use std::time::Instant;

use super::client::OllamaClient;
use crate::ollama::helpers::split_thinking;
use crate::ollama::models::{CleanupPlanInput, CleanupPlanOutput};

/// Ask the model to reason about a multi-step cleanup problem and
/// return a structured plan. Uses `think: true` (Ollama 0.30+) so
/// qwen3+, deepseek-r1, etc. emit a chain of thought. The thinking
/// is captured separately so the UI can hide it.
pub async fn cleanup_plan(
    client: &OllamaClient,
    model: &str,
    input: CleanupPlanInput,
) -> Result<CleanupPlanOutput, String> {
    let started = Instant::now();

    let system = "You are a senior storage engineer. \
        Reason step-by-step (your reasoning will be hidden from the user), \
        THEN write a numbered plan in your final reply. \
        Each step should have a clear action and an estimated bytes-freed. \
        Be conservative — prefer reversible steps first. \
        Use markdown. Keep the plan to ≤ 7 steps. \
        End with a one-line 'Expected total: X GB' summary. \
        Start the plan immediately with '1.' — do not prefix with any label.";

    let mut user = input.question.clone();
    if let Some(ctx) = &input.context {
        user.push_str("\n\nContext:\n");
        user.push_str(ctx);
    }

    let request = crate::ollama::types::ChatRequest {
        model: model.to_string(),
        messages: vec![
            crate::ollama::types::ChatMessage::system(system),
            crate::ollama::types::ChatMessage::user(user),
        ],
        stream: Some(false),
        options: Some(crate::ollama::types::OllamaOptions::default()),
        think: Some(crate::ollama::types::TopLevelThink::Bool(true)),
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
        .map_err(|e| format!("cleanup_plan: {}", e))?;

    let (thinking, plan) = split_thinking(&response);
    if plan.trim().is_empty() {
        return Err("cleanup_plan: model returned empty plan".to_string());
    }

    Ok(CleanupPlanOutput {
        plan,
        thinking,
        prompt_tokens: response.prompt_eval_count.unwrap_or(0),
        completion_tokens: response.eval_count.unwrap_or(0),
        duration_ms: started.elapsed().as_millis(),
    })
}
