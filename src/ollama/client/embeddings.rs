use super::*;

impl OllamaClient {
    // ── Embedding API ────────────────────────────────────────────

    /// Generate embeddings for text inputs
    pub async fn embed(&self, inputs: Vec<String>) -> OllamaResult<(Vec<Vec<f32>>, TokenUsage)> {
        if inputs.is_empty() {
            return Err(OllamaError::ConfigError(
                "inputs cannot be empty".to_string(),
            ));
        }

        let start = Instant::now();

        let request = EmbedRequest {
            model: self.model.clone(),
            input: inputs,
            truncate: Some(true),
            keep_alive: Some(self.keep_alive.clone()),
            task: None,
        };

        let response = self
            .post_with_timeout(
                &format!("{}/api/embed", self.base_url),
                &request,
                self.operation_timeouts.embed,
            )
            .await?;

        let elapsed = start.elapsed().as_millis() as u64;

        if !response.status().is_success() {
            return Err(Self::handle_http_error(response).await);
        }

        let embed_response: EmbedResponse = response.json().await.map_err(|e| {
            OllamaError::ParseError(format!("Failed to parse embed response: {}", e))
        })?;

        let prompt_tokens = embed_response.prompt_eval_count.unwrap_or(0);

        self.track_request("embed", elapsed, prompt_tokens, 0);

        let usage = TokenUsage {
            prompt_tokens,
            completion_tokens: 0,
            total_duration_ms: embed_response.total_duration.map(|ns| ns / 1_000_000),
            load_duration_ms: None,
        };

        Ok((embed_response.embeddings, usage))
    }
}
