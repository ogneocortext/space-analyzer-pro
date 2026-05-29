use super::*;

impl OllamaClient {
    /// Send chat messages with optional tool definitions and tool_choice control
    /// Returns (content, tool_calls, usage) - if tool_calls is Some, the model wants to call tools
    pub async fn chat_with_tools(
        &self,
        messages: Vec<ChatMessage>,
        tools: Option<Vec<ToolDefinition>>,
        tool_choice: Option<String>,
    ) -> OllamaResult<(String, Option<Vec<ToolCall>>, TokenUsage)> {
        self.chat_internal(&self.model, messages, tools, tool_choice, false).await
    }

    /// Shared helper: POST a ChatRequest, validate status, parse JSON, track timing, build TokenUsage.
    pub(super) async fn post_chat_and_parse(
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
        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| OllamaError::ParseError(format!("Failed to parse chat response: {}", e)))?;
        let usage = TokenUsage::from_chat_response(&chat_response);
        self.track_request(tag, elapsed, usage.prompt_tokens, usage.completion_tokens);
        Ok((chat_response, usage, elapsed))
    }

    /// Internal chat implementation with model fallback
    async fn chat_internal(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        tools: Option<Vec<ToolDefinition>>,
        tool_choice: Option<String>,
        force_json: bool,
    ) -> OllamaResult<(String, Option<Vec<ToolCall>>, TokenUsage)> {
        let request = ChatRequest {
            model: model.to_string(),
            messages,
            stream: Some(false),
            options: Some(self.default_options.clone()),
            keep_alive: Some(self.keep_alive.clone()),
            format: if force_json { Some("json".to_string()) } else { None },
            tools,
            tool_choice,
        };
        let (chat_response, usage, _elapsed) = self.post_chat_and_parse(&request, self.operation_timeouts.chat, "chat").await?;
        let tool_calls = chat_response.message.tool_calls;
        Ok((chat_response.message.content, tool_calls, usage))
    }
}
