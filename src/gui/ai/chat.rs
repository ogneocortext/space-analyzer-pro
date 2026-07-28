//! Chat message handling functions
//!
//! This module contains functions for processing chat messages,
//! handling tool calls, and managing the chat conversation flow.

use super::super::{
    formatting, ChatMessage, OllamaChatMessage, OllamaMessage, ToolCall, ToolCallFunction,
    ToolResultDisplay,
};
use std::sync::mpsc;

use super::super::SpaceAnalyzerApp;

const MAX_TOOL_CALL_DEPTH: u32 = 5;
/// Token budget: trim conversation to stay under ~2000 tokens (~8000 chars)
const MAX_CONVERSATION_CHARS: usize = 8000;

impl SpaceAnalyzerApp {
    /// Keep conversation history within token budget.
    /// Always preserves the system prompt (first message).
    fn trim_conversation_history(&mut self) {
        if self.conversation_history.is_empty() {
            return;
        }
        // Fast path: under budget
        let total: usize = self
            .conversation_history
            .iter()
            .map(|m| m.content.len())
            .sum();
        if total <= MAX_CONVERSATION_CHARS {
            return;
        }
        // Preserve system prompt, trim oldest messages
        let system = self.conversation_history.remove(0);
        while !self.conversation_history.is_empty() {
            let remaining: usize = self
                .conversation_history
                .iter()
                .map(|m| m.content.len())
                .sum();
            if remaining <= MAX_CONVERSATION_CHARS {
                break;
            }
            self.conversation_history.remove(0);
        }
        self.conversation_history.insert(0, system);
    }
}

impl SpaceAnalyzerApp {
    /// Process incoming Ollama messages
    pub(crate) fn process_ollama_messages(&mut self) {
        if let Some(rx) = self.ollama_receiver.take() {
            let mut tool_calls_received: Vec<(String, serde_json::Value)> = Vec::new();
            let mut assistant_reply = String::new();
            let mut assistant_thinking = None;
            let mut usage_received = None;
            let mut error_received = None;

            while let Ok(msg) = rx.try_recv() {
                match msg {
                    OllamaMessage::Availability(available) => {
                        self.ollama_available = available;
                        self.ollama_checking = false;
                        if available {
                            self.tool_runtime_state.ollama_auto_started = false;
                        } else if self.settings.auto_start_ollama
                            && !self.tool_runtime_state.ollama_auto_started
                        {
                            self.tool_runtime_state.ollama_auto_started = true;
                            self.start_ollama_process();
                            self.check_ollama();
                        }
                    }
                    OllamaMessage::AvailabilityDetailed {
                        available,
                        version,
                        error,
                    } => {
                        self.ollama_available = available;
                        self.ollama_checking = false;
                        if let Some(v) = version {
                            self.ollama_version = Some(v);
                        }
                        if let Some(err) = error {
                            self.last_ollama_error = Some(err);
                        } else if available {
                            // Clear any prior error from a stale connection
                            // failure — the server is reachable now.
                            self.last_ollama_error = None;
                        }
                        if available {
                            self.tool_runtime_state.ollama_auto_started = false;
                        } else if self.settings.auto_start_ollama
                            && !self.tool_runtime_state.ollama_auto_started
                        {
                            self.tool_runtime_state.ollama_auto_started = true;
                            self.start_ollama_process();
                            self.check_ollama();
                        }
                    }
                    OllamaMessage::ToolCall(name, args) => {
                        tool_calls_received.push((name, args));
                    }
                    OllamaMessage::ChatReply { content, thinking } => {
                        assistant_reply = content;
                        assistant_thinking = thinking;
                    }
                    OllamaMessage::TokenUsage {
                        prompt_tokens,
                        completion_tokens,
                        duration_ms,
                    } => {
                        usage_received = Some((prompt_tokens, completion_tokens, duration_ms));
                    }
                    OllamaMessage::Error(e) => {
                        error_received = Some(e);
                    }
                    OllamaMessage::CacheStore {
                        key,
                        system_prompt,
                        user_prompt,
                        response,
                        prompt_tokens,
                        completion_tokens,
                        model,
                    } => {
                        self.prompt_cache_state.prompt_cache.store(
                            key,
                            system_prompt,
                            user_prompt,
                            response,
                            prompt_tokens,
                            completion_tokens,
                            model,
                        );
                    }
                    // Model discovery is handled in `process_model_discovery`,
                    // not here. Silently ignore any spurious delivery on this
                    // channel rather than failing.
                    OllamaMessage::ModelDiscovery { .. } => {}
                }
            }

            // Handle tool calls if any
            if !tool_calls_received.is_empty() {
                self.tool_runtime_state.tool_call_depth += 1;
                if self.tool_runtime_state.tool_call_depth >= MAX_TOOL_CALL_DEPTH {
                    self.chat_messages.push(ChatMessage {
                        role: "assistant".to_string(),
                        content: format!("[Tool call limit exceeded: stopped after {} rounds to prevent runaway execution. Please rephrase your request.]", MAX_TOOL_CALL_DEPTH),
                        thinking: None,
                        tool_result: None,
                    });
                    self.conversation_history.push(OllamaChatMessage::assistant(
                        format!("Tool call limit exceeded: stopped after {} rounds. The final assistant response must now be given without further tool calls.", MAX_TOOL_CALL_DEPTH)
                    ));
                    self.tool_runtime_state.tool_call_depth = 0;
                    self.chat_processing = false;
                    return;
                }
                for (name, args) in &tool_calls_received {
                    // Display tool call in chat
                    self.chat_messages.push(ChatMessage {
                        role: "assistant".to_string(),
                        content: format!("[Calling tool: {}({})]", name, args),
                        thinking: None,
                        tool_result: None,
                    });

                    // Execute tool
                    if let Some(ref registry) = self.tool_registry {
                        let tool_call = ToolCall {
                            id: format!("call_{}", name),
                            call_type: "function".to_string(),
                            function: ToolCallFunction {
                                index: None,
                                name: name.clone(),
                                arguments: args.clone(),
                            },
                        };
                        let result = match registry.execute_tool(
                            &tool_call,
                            self.scan_result.as_ref(),
                            self.db.as_ref(),
                        ) {
                            Ok(r) => r,
                            Err(e) => format!("Tool execution error: {}", e),
                        };

                        // Create formatted tool result for user display
                        let display = ToolResultDisplay::from_raw(name, &result);

                        // Display tool result in chat with formatted data
                        self.chat_messages.push(ChatMessage {
                            role: "assistant".to_string(),
                            content: format!("[Tool result: {}]", name),
                            thinking: None,
                            tool_result: Some(display),
                        });

                        // Add tool result to conversation history (JSON format for functionary compatibility)
                        let result_json = serde_json::json!({"result": result});
                        self.conversation_history.push(OllamaChatMessage::tool(
                            result_json.to_string(),
                            format!("call_{}", name),
                        ));
                    }
                }

                // Add assistant's tool call response to history
                if !assistant_reply.is_empty() {
                    self.chat_messages.push(ChatMessage {
                        role: "assistant".to_string(),
                        content: assistant_reply.clone(),
                        thinking: assistant_thinking.clone(),
                        tool_result: None,
                    });
                    self.conversation_history
                        .push(OllamaChatMessage::assistant(&assistant_reply));
                }

                // Send follow-up request with tool results
                self.send_follow_up_with_tools();
                // New receiver is already set by send_follow_up_with_tools;
                // return now to avoid restoring the old drained receiver below.
                return;
            } else if let Some(e) = error_received {
                self.chat_messages.push(ChatMessage {
                    role: "assistant".to_string(),
                    content: format!("Error: {}. Make sure Ollama is running.", e),
                    thinking: None,
                    tool_result: None,
                });
                self.chat_processing = false;
                self.ollama_checking = false;
            } else if !assistant_reply.is_empty() {
                // Normal response without tool calls
                self.chat_messages.push(ChatMessage {
                    role: "assistant".to_string(),
                    content: assistant_reply.clone(),
                    thinking: assistant_thinking.clone(),
                    tool_result: None,
                });
                self.conversation_history
                    .push(OllamaChatMessage::assistant(&assistant_reply));

                self.tool_runtime_state.tool_call_depth = 0;
                if let Some((prompt, completion, duration)) = usage_received {
                    let duration_str = duration
                        .map(|ms| format!("{:.1}s", ms as f64 / 1000.0))
                        .unwrap_or_default();
                    self.chat_messages.push(ChatMessage {
                        role: "assistant".to_string(),
                        content: format!(
                            "[Tokens: {} prompt + {} completion | {}]",
                            prompt, completion, duration_str
                        ),
                        thinking: None,
                        tool_result: None,
                    });
                }
                self.chat_processing = false;
            }

            if self.ollama_checking || self.chat_processing {
                self.ollama_receiver = Some(rx);
            }
        }
    }

    fn send_follow_up_with_tools(&mut self) {
        // Send a follow-up request to get the final response after tool execution
        let tools = if self.settings.agentic_tools_enabled {
            self.tool_registry
                .as_ref()
                .map(|tr| tr.get_definitions().to_vec())
        } else {
            None
        };
        let client = self.ollama_client.clone().and_then(|c| {
            let base = if self.settings.agentic_tools_enabled {
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

        let tool_choice = self.settings.tool_choice.clone();
        if let Some(client) = client {
            self.trim_conversation_history();
            let (tx, rx) = mpsc::channel();
            let conversation = self.conversation_history.clone();

            std::thread::spawn(move || {
                let rt = super::super::shared_runtime();
                let response = rt.block_on(async {
                    client
                        .chat_with_tools(conversation, tools, Some(tool_choice))
                        .await
                });

                match response {
                    Ok((content, thinking, tool_calls, usage)) => {
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
            self.chat_processing = false;
        }
    }

    /// Send a chat message to Ollama
    pub(crate) fn send_chat_message(&mut self) {
        if self.chat_input.is_empty() || self.chat_processing {
            return;
        }

        self.tool_runtime_state.tool_call_depth = 0;
        let user_message = self.chat_input.clone();

        // Auto-select model based on query content
        if self.settings.auto_model_selection {
            let msg_lower = user_message.to_lowercase();
            let task_type = if msg_lower.contains("analyz")
                || msg_lower.contains("recommend")
                || msg_lower.contains("report")
            {
                "Analysis"
            } else if msg_lower.contains("run")
                || msg_lower.contains("execute")
                || msg_lower.contains("clean")
                || msg_lower.contains("delete")
            {
                "Tool Calling"
            } else if msg_lower.contains("search")
                || msg_lower.contains("find")
                || msg_lower.contains("file")
                || msg_lower.contains("scan")
            {
                "Semantic Search"
            } else {
                "General Chat"
            };
            self.select_model_for_task(task_type);
        }

        self.chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: user_message.clone(),
            thinking: None,
            tool_result: None,
        });
        self.chat_input.clear();
        self.chat_processing = true;

        let tools = if self.settings.agentic_tools_enabled {
            self.tool_registry
                .as_ref()
                .map(|tr| tr.get_definitions().to_vec())
        } else {
            None
        };
        let model_name = if self.settings.agentic_tools_enabled {
            self.settings.tool_calling_model.clone()
        } else {
            self.settings.ollama_model.clone()
        };
        let client = self.ollama_client.clone().and_then(|c| {
            let base = if self.settings.agentic_tools_enabled {
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

        // Build scan context for analysis queries
        let scan_context = if let Some(ref result) = self.scan_result {
            let file_type_summary: String = result
                .file_types
                .iter()
                .take(10)
                .map(|(ext, count)| format!("  .{}: {} files", ext, count))
                .collect::<Vec<_>>()
                .join("\n");
            let large_files_summary: String = result
                .largest_files
                .iter()
                .take(5)
                .map(|(path, size)| format!("  {} ({})", path, formatting::format_bytes(*size)))
                .collect::<Vec<_>>()
                .join("\n");
            format!(
                "Current scan results:\n\
                 Path: {}\n\
                 Total files: {}\n\
                 Total size: {}\n\
                 File types:\n{}\n\
                 Largest files:\n{}",
                result.path,
                result.total_files,
                formatting::format_bytes(result.total_size_bytes),
                if file_type_summary.is_empty() {
                    "  (none)"
                } else {
                    &file_type_summary
                },
                if large_files_summary.is_empty() {
                    "  (none)"
                } else {
                    &large_files_summary
                }
            )
        } else {
            "No scan results available.".to_string()
        };

        // Check prompt cache (only for single-turn, no tool calls)
        let system_prompt = self
            .conversation_history
            .first()
            .map(|m| m.content.clone())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| super::super::ollama::SYSTEM_PROMPT_ANALYSIS.to_string());
        let cache_key = super::super::ollama::PromptCache::generate_key(
            &model_name,
            &system_prompt,
            &format!("{}\n{}", scan_context, user_message),
        );

        if let Some(cached) = self
            .prompt_cache_state
            .prompt_cache
            .lookup(&cache_key, &model_name)
        {
            // Cache hit - return cached response immediately
            self.conversation_history
                .push(OllamaChatMessage::user(&user_message));
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

        // Cache miss - proceed with API call
        let tool_choice = self.settings.tool_choice.clone();
        if let Some(client) = client {
            // Inject scan context before user message if not already present
            let has_context = self
                .conversation_history
                .iter()
                .any(|m| m.content.contains("Total files:"));
            if !has_context && !scan_context.starts_with("No scan") {
                self.conversation_history
                    .push(OllamaChatMessage::system(&scan_context));
            }

            // Add user message to conversation history
            self.conversation_history
                .push(OllamaChatMessage::user(&user_message));

            self.trim_conversation_history();

            let (tx, rx) = mpsc::channel();
            let conversation = self.conversation_history.clone();
            let prompt_cache_tx = tx.clone();
            let cache_key_clone = cache_key.clone();
            let system_prompt_clone = system_prompt.clone();
            let user_message_clone = user_message.clone();
            let model_name_clone = model_name.clone();

            std::thread::spawn(move || {
                let rt = super::super::shared_runtime();
                let messages = conversation;
                let tools_clone = tools.clone();

                let response = rt.block_on(async {
                    client
                        .chat_with_tools(messages, tools_clone, Some(tool_choice))
                        .await
                });

                match response {
                    Ok((content, thinking, tool_calls, usage)) => {
                        // Store in cache (only if no tool calls - tool responses are dynamic)
                        if tool_calls.is_none() {
                            let _ = prompt_cache_tx.send(OllamaMessage::CacheStore {
                                key: cache_key_clone,
                                system_prompt: system_prompt_clone,
                                user_prompt: user_message_clone,
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
                content: "Ollama is not enabled. Enable it in Settings to use AI features."
                    .to_string(),
                thinking: None,
                tool_result: None,
            });
            self.chat_processing = false;
        }
    }
}
