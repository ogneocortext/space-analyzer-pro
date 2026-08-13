use super::*;

const CHAT_RETRIES: u32 = 2;
const CHAT_RETRY_BASE_MS: u64 = 400;

fn is_transient_chat_error(err: &OllamaError) -> bool {
    match err {
        OllamaError::Timeout(_) => true,
        OllamaError::ConnectionError(_) => true,
        OllamaError::HttpError { status, .. } => *status >= 500,
        _ => false,
    }
}

impl OllamaClient {
    /// Send chat messages with optional tool definitions and tool_choice control.
    /// Returns `(content, thinking, tool_calls, usage)`:
    /// - `thinking` is the model's reasoning trace (may be `None` when thinking is off)
    /// - if `tool_calls` is `Some`, the model wants to call one or more tools
    pub async fn chat_with_tools(
        &self,
        messages: Vec<ChatMessage>,
        tools: Option<Vec<ToolDefinition>>,
        tool_choice: Option<String>,
        format: Option<serde_json::Value>,
    ) -> OllamaResult<(String, Option<String>, Option<Vec<ToolCall>>, TokenUsage)> {
        self.chat_internal(&self.model, messages, tools, tool_choice, format)
            .await
    }

    /// Shared helper: POST a ChatRequest, validate status, parse JSON, track timing, build TokenUsage.
    pub(crate) async fn post_chat_and_parse(
        &self,
        request: &ChatRequest,
        timeout: std::time::Duration,
        tag: &str,
    ) -> OllamaResult<(ChatResponse, TokenUsage, u64)> {
        let start = Instant::now();
        let response = self
            .post_with_timeout(&format!("{}/api/chat", self.base_url), request, timeout)
            .await?;
        let elapsed = start.elapsed().as_millis() as u64;
        if !response.status().is_success() {
            return Err(Self::handle_http_error(response).await);
        }
        let chat_response: ChatResponse = response.json().await.map_err(|e| {
            OllamaError::ParseError(format!("Failed to parse chat response: {}", e))
        })?;
        let usage = TokenUsage::from_chat_response(&chat_response);
        self.track_request(tag, elapsed, usage.prompt_tokens, usage.completion_tokens);
        Ok((chat_response, usage, elapsed))
    }

    /// Internal chat implementation with model fallback and retry on transient failures.
    async fn chat_internal(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        tools: Option<Vec<ToolDefinition>>,
        tool_choice: Option<String>,
        format: Option<serde_json::Value>,
    ) -> OllamaResult<(String, Option<String>, Option<Vec<ToolCall>>, TokenUsage)> {
        let mut candidates = vec![model.to_string()];
        let fallback_config = self.fallback_config.lock().unwrap().clone();
        if fallback_config.enabled {
            candidates.extend(fallback_config.fallback_models.clone());
        }

        let mut last_err = None;
        for (idx, candidate) in candidates.iter().enumerate() {
            let request = ChatRequest {
                model: candidate.clone(),
                messages: messages.clone(),
                stream: Some(false),
                options: Some(self.default_options.clone()),
                keep_alive: Some(self.keep_alive.clone()),
                format: format.clone(),
                think: self.think.clone(),
                tools: tools.clone(),
                tool_choice: tool_choice.clone(),
            };

            let retries = if idx == 0 { CHAT_RETRIES } else { 1 };
            for attempt in 0..retries {
                let tag = if idx == 0 && attempt == 0 {
                    "chat"
                } else if idx == 0 {
                    "chat_retry"
                } else {
                    "chat_fallback"
                };
                match self
                    .post_chat_and_parse(&request, self.operation_timeouts.chat, tag)
                    .await
                {
                    Ok((chat_response, usage, _elapsed)) => {
                        let tool_calls = chat_response.message.tool_calls;
                        let thinking = chat_response.message.thinking.clone();
                        return Ok((chat_response.message.content, thinking, tool_calls, usage));
                    }
                    Err(err) => {
                        if !is_transient_chat_error(&err) || attempt + 1 >= retries {
                            last_err = Some(err);
                            break;
                        }
                        let backoff = CHAT_RETRY_BASE_MS * 2u64.pow(attempt);
                        tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
                        last_err = Some(err);
                    }
                }
            }
        }
        Err(last_err.unwrap_or_else(|| OllamaError::ConnectionError("chat failed".to_string())))
    }
}
