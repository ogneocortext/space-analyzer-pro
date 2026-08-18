//! Agentic question feature using Ollama tool calling.

use std::time::Instant;

use super::client::OllamaClient;
use crate::ollama::helpers::resolve_tool_choice;
use crate::ollama::helpers::split_thinking;
use crate::ollama::models::{AgenticOutput, AgenticStep, StepKind};
use crate::ollama::types::{ChatMessage, ChatRequest, ToolCall, ToolDefinition};

/// One round of the agentic loop. The closure decides what each tool
/// does. In production this is the `ToolRegistry`; in tests it's a
/// small mock that returns canned strings.
pub type ToolExecutor = Box<dyn Fn(&ToolCall) -> String + Send + Sync>;

/// Run a multi-round tool-calling conversation. Each round:
///   1. Send the current message list (system + user + tool_results)
///   2. If the model returns tool_calls, execute them, append the
///      results, and loop.
///   3. If the model returns text, we're done.
pub async fn agentic_question(
    client: &OllamaClient,
    model: &str,
    question: &str,
    tools: Vec<ToolDefinition>,
    execute: ToolExecutor,
    max_rounds: usize,
) -> Result<AgenticOutput, String> {
    let started = Instant::now();
    let mut messages: Vec<ChatMessage> = vec![
        ChatMessage::system(
            "You are a disk-space analyst. Answer the user's question \
             by calling the available tools. Call only the tools you \
             need. Once you have enough information, reply with a \
             concise natural-language answer — no JSON, no tool calls.",
        ),
        ChatMessage::user(question),
    ];

    let mut steps: Vec<AgenticStep> = Vec::new();
    let mut total_prompt = 0u32;
    let mut total_completion = 0u32;
    let mut rounds = 0usize;
    let mut final_answer = String::new();

    while rounds < max_rounds {
        rounds += 1;
        let round_start = Instant::now();

        let request = ChatRequest {
            model: model.to_string(),
            messages: messages.clone(),
            stream: Some(false),
            options: Some(crate::ollama::types::OllamaOptions::default()),
            think: None,
            keep_alive: Some("5m".to_string()),
            format: None,
            tools: Some(tools.clone()),
            tool_choice: Some(if rounds == 1 {
                resolve_tool_choice(question, &tools)
            } else {
                "auto".to_string()
            }),
        };

        let response = client
            .with_model(model)
            .map_err(|e| e.to_string())?
            .post_chat(&request)
            .await
            .map_err(|e| format!("agentic_question: {}", e))?;

        total_prompt += response.prompt_eval_count.unwrap_or(0);
        total_completion += response.eval_count.unwrap_or(0);

        // Case 1: model wants to call tools
        if let Some(calls) = response.message.tool_calls.clone() {
            if !calls.is_empty() {
                // Record the model step (may have empty content alongside the calls)
                let content = response.message.content.clone();
                if !content.trim().is_empty() {
                    steps.push(AgenticStep {
                        kind: StepKind::ModelText,
                        text: content,
                        tool_name: None,
                        tool_args: None,
                        duration_ms: round_start.elapsed().as_millis(),
                    });
                }

                // Append the assistant message (with the tool_calls attached)
                messages.push(response.message.clone());

                for call in &calls {
                    let exec_start = Instant::now();
                    let result = execute(call);
                    steps.push(AgenticStep {
                        kind: StepKind::ToolResult,
                        text: result.clone(),
                        tool_name: Some(call.function.name.clone()),
                        tool_args: Some(call.function.arguments.clone()),
                        duration_ms: exec_start.elapsed().as_millis(),
                    });
                    messages.push(ChatMessage::tool(result, call.id.clone()));
                }
                continue;
            }
        }

        // Case 2: model returned text — done.
        let (thinking, content) = split_thinking(&response);
        if !thinking.as_deref().unwrap_or("").is_empty() {
            // If the model also thought, surface it as a step.
            steps.push(AgenticStep {
                kind: StepKind::ModelText,
                text: format!("[thinking] {}", thinking.unwrap_or_default()),
                tool_name: None,
                tool_args: None,
                duration_ms: 0,
            });
        }
        final_answer = content;
        steps.push(AgenticStep {
            kind: StepKind::ModelText,
            text: final_answer.clone(),
            tool_name: None,
            tool_args: None,
            duration_ms: round_start.elapsed().as_millis(),
        });
        break;
    }

    if final_answer.is_empty() && rounds == max_rounds {
        return Err(format!(
            "agentic_question: hit max_rounds ({}) without a final answer",
            max_rounds
        ));
    }

    Ok(AgenticOutput {
        final_answer,
        steps,
        rounds,
        total_prompt_tokens: total_prompt,
        total_completion_tokens: total_completion,
        duration_ms: started.elapsed().as_millis(),
    })
}
