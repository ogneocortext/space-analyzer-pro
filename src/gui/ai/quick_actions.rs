//! Quick action functions
//!
//! This module contains functions for handling quick actions
//! that provide pre-defined prompts for common tasks.

use super::super::{formatting, ChatMessage, OllamaChatMessage, OllamaMessage};
use std::sync::mpsc;

use super::super::SpaceAnalyzerApp;

impl SpaceAnalyzerApp {
    pub(crate) fn send_quick_action(&mut self, prompt: &str, action_type: &str) {
        if self.chat_processing || self.ollama_client.is_none() {
            return;
        }

        // Display the quick action in chat
        self.chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: format!("[Quick Action: {}]", action_type),
            thinking: None,
            tool_result: None,
        });

        // Use the appropriate system prompt for the action
        let system_prompt = super::super::ollama::get_prompt_by_name(action_type)
            .unwrap_or(super::super::ollama::SYSTEM_PROMPT_ANALYSIS);

        // Build user message content
        let user_content = if let Some(ref result) = self.scan_result {
            let scan_summary = format!(
                "Scan of: {}\nTotal files: {}\nTotal size: {:.2} MB\nDuration: {:.2}s\n\nFile types:\n{}\n\nLargest files:\n{}",
                result.path,
                result.total_files,
                result.total_size_mb,
                result.duration_secs,
                result.file_types.iter().map(|(ext, count)| format!("  .{}: {} files", ext, count)).collect::<Vec<_>>().join("\n"),
                result.largest_files.iter().take(10).map(|(path, size)| format!("  {} ({})", path, formatting::format_bytes(*size))).collect::<Vec<_>>().join("\n"),
            );
            format!("{}\n\n{}", scan_summary, prompt)
        } else {
            prompt.to_string()
        };

        // Select model and tools
        let use_tools = self.settings.agentic_tools_enabled && self.tool_registry.is_some();
        let model_name = if use_tools {
            self.settings.tool_calling_model.clone()
        } else {
            self.settings.ollama_model.clone()
        };
        let tools = if use_tools {
            self.tool_registry
                .as_ref()
                .map(|tr| tr.get_definitions().to_vec())
        } else {
            None
        };
        let tool_choice = self.settings.tool_choice.clone();

        // Build messages with the specialized system prompt
        let mut messages = vec![super::super::ollama::ChatMessage::system(system_prompt)];
        messages.push(super::super::ollama::ChatMessage::user(
            user_content.clone(),
        ));

        // Add to conversation history
        self.conversation_history
            .push(OllamaChatMessage::user(&user_content));

        // Check prompt cache (only when not using tools - tool results are dynamic)
        if tools.is_none() {
            let cache_key = super::super::ollama::PromptCache::generate_key(
                &model_name,
                system_prompt,
                &user_content,
            );
            if let Some(cached) = self
                .prompt_cache_state
                .prompt_cache
                .lookup(&cache_key, &model_name)
            {
                self.chat_messages.push(ChatMessage {
                    role: "assistant".to_string(),
                    content: cached.response.clone(),
                    thinking: None,
                    tool_result: None,
                });
                self.conversation_history
                    .push(OllamaChatMessage::assistant(&cached.response));
                self.chat_messages.push(ChatMessage {
                    role: "system".to_string(),
                    content: format!(
                        "[Cache hit] Response retrieved from prompt cache ({} tokens saved).",
                        cached.total_tokens()
                    ),
                    thinking: None,
                    tool_result: None,
                });
                self.chat_processing = false;
                return;
            }
        }

        self.chat_processing = true;

        let client = self.ollama_client.clone().and_then(|c| {
            let base = if use_tools {
                c.with_model(&self.settings.tool_calling_model).ok()
            } else {
                Some(c)
            };
            base.map(|bc| {
                if self.settings.ollama_think {
                    bc.with_think(Some(crate::ollama::TopLevelThink::Bool(true)))
                } else {
                    bc.with_think(Some(crate::ollama::TopLevelThink::Bool(false)))
                }
            })
        });
        if let Some(client) = client {
            let (tx, rx) = mpsc::channel();
            let prompt_cache_tx = tx.clone();
            let system_prompt_clone = system_prompt.to_string();
            let user_content_clone = user_content.clone();
            let model_name_clone = model_name.clone();

            std::thread::spawn(move || {
                let rt = super::super::shared_runtime();

                let response = rt.block_on(async {
                    client
                        .chat_with_tools(messages, tools, Some(tool_choice), None)
                        .await
                });

                match response {
                    Ok((content, thinking, tool_calls, usage)) => {
                        // Store in cache (only if no tool calls - tool responses are dynamic)
                        if tool_calls.is_none() {
                            let _ = prompt_cache_tx.send(OllamaMessage::CacheStore {
                                key: format!(
                                    "qa_{}",
                                    chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
                                ),
                                system_prompt: system_prompt_clone,
                                user_prompt: user_content_clone,
                                response: content.clone(),
                                prompt_tokens: usage.prompt_tokens,
                                completion_tokens: usage.completion_tokens,
                                model: model_name_clone,
                            });
                        }
                        if let Some(calls) = tool_calls {
                            for call in &calls {
                                let _ = tx.send(OllamaMessage::ToolCall(
                                    call.function.name.clone(),
                                    call.function.arguments.clone(),
                                ));
                            }
                        }
                        let _ = tx.send(OllamaMessage::ChatReply { content, thinking });
                        let _ = tx.send(OllamaMessage::TokenUsage {
                            prompt_tokens: usage.prompt_tokens,
                            completion_tokens: usage.completion_tokens,
                            duration_ms: usage.total_duration_ms,
                        });
                    }
                    Err(e) => {
                        let _ = tx.send(OllamaMessage::Error(e.to_string()));
                    }
                }
            });
            self.ollama_receiver = Some(rx);
        } else {
            self.chat_messages.push(ChatMessage {
                role: "assistant".to_string(),
                content: "Failed to initialize Ollama client for quick action.".to_string(),
                thinking: None,
                tool_result: None,
            });
            self.chat_processing = false;
        }
    }
}
