//! Ollama API client with builder pattern and all API methods
//!
//! Features:
//! - Chat, generate, embed, vision APIs
//! - Streaming responses
//! - JSON repair and validation
//! - Prompt caching with LRU eviction
//! - Model fallback chain
//! - Operation-specific timeouts
//! - Client metrics / telemetry
//! - Conversation history management
//! - Model management (pull, delete, copy, create)

use std::sync::Arc;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::error::{OllamaError, OllamaResult};
use super::prompt_cache::{PromptCache, PromptCacheConfig};
use super::types::*;

mod chat;
mod embeddings;

/// Ollama API client with connection pooling
#[derive(Clone)]
pub struct OllamaClient {
    base_url: String,
    model: String,
    client: reqwest::Client,
    default_options: OllamaOptions,
    keep_alive: String,
    timeout: Duration,
    cache: Arc<Mutex<Option<PromptCache>>>,
    metrics: Arc<Mutex<ClientMetrics>>,
    fallback_config: Arc<Mutex<ModelFallbackConfig>>,
    operation_timeouts: OperationTimeouts,
    think: Option<TopLevelThink>,
}

impl std::fmt::Debug for OllamaClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OllamaClient")
            .field("base_url", &self.base_url)
            .field("model", &self.model)
            .field("keep_alive", &self.keep_alive)
            .field("operation_timeouts", &self.operation_timeouts)
            .finish_non_exhaustive()
    }
}

/// Builder for OllamaClient
pub struct OllamaClientBuilder {
    base_url: String,
    model: String,
    timeout: Duration,
    connect_timeout: Duration,
    default_options: OllamaOptions,
    keep_alive: String,
    cache_config: Option<PromptCacheConfig>,
    fallback_config: Option<ModelFallbackConfig>,
    operation_timeouts: Option<OperationTimeouts>,
    think: Option<TopLevelThink>,
}

impl OllamaClientBuilder {
    pub fn new(base_url: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            model: model.into(),
            timeout: Duration::from_secs(120),
            connect_timeout: Duration::from_secs(5),
            default_options: OllamaOptions::default(),
            keep_alive: "10m".to_string(),
            cache_config: None,
            fallback_config: None,
            operation_timeouts: None,
            think: None,
        }
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub fn connect_timeout(mut self, timeout: Duration) -> Self {
        self.connect_timeout = timeout;
        self
    }

    pub fn options(mut self, options: OllamaOptions) -> Self {
        self.default_options = options;
        self
    }

    pub fn keep_alive(mut self, keep_alive: impl Into<String>) -> Self {
        self.keep_alive = keep_alive.into();
        self
    }

    /// Enable prompt caching with the given configuration
    pub fn with_cache(mut self, config: PromptCacheConfig) -> Self {
        self.cache_config = Some(config);
        self
    }

    /// Configure model fallback behavior
    pub fn with_fallback(mut self, config: ModelFallbackConfig) -> Self {
        self.fallback_config = Some(config);
        self
    }

    /// Set per-operation timeouts
    pub fn with_operation_timeouts(mut self, timeouts: OperationTimeouts) -> Self {
        self.operation_timeouts = Some(timeouts);
        self
    }

    /// Enable/disable extended thinking / reasoning
    pub fn with_think(mut self, think: Option<TopLevelThink>) -> Self {
        self.think = think;
        self
    }

    pub fn build(self) -> OllamaResult<OllamaClient> {
        // Validate base_url
        let base_url = self.base_url.trim_end_matches('/').to_string();
        if base_url.is_empty() {
            return Err(OllamaError::ConfigError(
                "base_url cannot be empty".to_string(),
            ));
        }
        // Warn if not localhost
        if !base_url.contains("localhost")
            && !base_url.contains("127.0.0.1")
            && !base_url.contains("[::1]")
        {
            eprintln!(
                "WARNING: Ollama base_url '{}' is not localhost. \
                 Disk scan data (file paths, sizes) will be sent to this endpoint.",
                base_url
            );
        }

        // OLLAMA_HOST env var override is handled in Database::load_settings()
        // so the URL passed here already has the correct precedence applied.

        // Validate model
        if self.model.is_empty() {
            return Err(OllamaError::ConfigError(
                "model name cannot be empty".to_string(),
            ));
        }

        let client = reqwest::Client::builder()
            .timeout(self.timeout)
            .connect_timeout(self.connect_timeout)
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(4)
            .build()?;

        let cache = self
            .cache_config
            .map(PromptCache::new)
            .or_else(|| Some(PromptCache::new(PromptCacheConfig::default())));

        let fallback_config = self
            .fallback_config
            .unwrap_or_else(|| ModelFallbackConfig::with_common_fallbacks(&self.model));

        Ok(OllamaClient {
            base_url,
            model: self.model,
            client,
            default_options: self.default_options,
            keep_alive: self.keep_alive,
            timeout: self.timeout,
            cache: Arc::new(Mutex::new(cache)),
            metrics: Arc::new(Mutex::new(ClientMetrics::new())),
            fallback_config: Arc::new(Mutex::new(fallback_config)),
            operation_timeouts: self.operation_timeouts.unwrap_or_default(),
            think: self.think,
        })
    }
}

impl OllamaClient {
    /// Create a new client with default settings
    pub fn new(base_url: &str, model: &str) -> OllamaResult<Self> {
        OllamaClientBuilder::new(base_url, model).build()
    }

    /// Create a client with a different model, preserving cache and metrics
    pub fn with_model(&self, model: &str) -> OllamaResult<Self> {
        let operation_timeouts = self.operation_timeouts;
        let mut client = OllamaClientBuilder::new(&self.base_url, model)
            .timeout(self.timeout)
            .options(self.default_options.clone())
            .keep_alive(&self.keep_alive)
            .with_fallback(self.fallback_config.lock().unwrap().clone())
            .with_think(self.think.clone())
            .build()?;
        client.cache = self.cache.clone();
        client.metrics = self.metrics.clone();
        client.operation_timeouts = operation_timeouts;
        Ok(client)
    }

    /// Configure extended thinking for requests
    pub fn with_think(&self, think: Option<TopLevelThink>) -> Self {
        let mut client = self.clone();
        client.think = think;
        client
    }

    /// Get the per-operation timeout durations.
    pub fn operation_timeouts(&self) -> &OperationTimeouts {
        &self.operation_timeouts
    }

    /// Get the base URL the client is talking to (e.g. `http://127.0.0.1:11434`).
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    // ── Internal Helpers ─────────────────────────────────────────

    /// Track a request in metrics
    fn track_request(
        &self,
        category: &str,
        duration_ms: u64,
        prompt_tokens: u32,
        completion_tokens: u32,
    ) {
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.total_requests += 1;
            metrics.cumulative_duration_ms += duration_ms;
            metrics.total_tokens_prompt += prompt_tokens as u64;
            metrics.total_tokens_completion += completion_tokens as u64;
            match category {
                "chat" => metrics.total_chat_requests += 1,
                "generate" => metrics.total_generate_requests += 1,
                "embed" => metrics.total_embed_requests += 1,
                "vision" => metrics.total_vision_requests += 1,
                _ => {}
            }
        }
    }

    pub(crate) async fn post_with_timeout(
        &self,
        url: &str,
        body: &impl serde::Serialize,
        timeout: Duration,
    ) -> OllamaResult<reqwest::Response> {
        self.client
            .post(url)
            .json(body)
            .timeout(timeout)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    OllamaError::Timeout(format!("Request timed out after {:?}: {}", timeout, url))
                } else {
                    OllamaError::ConnectionError(format!("Request failed: {}", e))
                }
            })
    }

    async fn handle_http_error(response: reqwest::Response) -> OllamaError {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        let message = if status == 404 {
            format!(
                "Endpoint not found. Check Ollama version. Response: {}",
                body
            )
        } else if status == 429 {
            "Rate limited by Ollama. Try again later.".to_string()
        } else if status >= 500 {
            format!("Ollama server error: {}", body)
        } else {
            body
        };
        OllamaError::HttpError { status, message }
    }

    // ── Core API Methods ─────────────────────────────────────────

    /// Check if Ollama is available and responding
    pub async fn is_available(&self) -> bool {
        self.client
            .get(format!("{}/api/tags", self.base_url))
            .timeout(self.operation_timeouts.list_models)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    /// List available models
    pub async fn list_models(&self) -> OllamaResult<Vec<ModelInfo>> {
        let response = self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .timeout(self.operation_timeouts.list_models)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(Self::handle_http_error(response).await);
        }

        let models: ModelsResponse = response
            .json()
            .await
            .map_err(|e| OllamaError::ParseError(format!("Failed to parse models: {}", e)))?;

        Ok(models.models)
    }

    /// Probe the Ollama server version (`GET /api/version`).
    ///
    /// Returns the version string on success. Servers older than ~0.4.10 do
    /// not expose this endpoint, so callers should treat the error as
    /// "unknown version" rather than as a connection failure.
    pub async fn get_version(&self) -> OllamaResult<String> {
        let response = self
            .client
            .get(format!("{}/api/version", self.base_url))
            .timeout(self.operation_timeouts.list_models)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(Self::handle_http_error(response).await);
        }

        let v: VersionResponse = response.json().await.map_err(|e| {
            OllamaError::ParseError(format!("Failed to parse version response: {}", e))
        })?;
        Ok(v.version)
    }

    /// List currently running/loaded models (`GET /api/ps`).
    ///
    /// The `size_vram` field on each entry is the authoritative source for
    /// VRAM usage — preferred over any estimation from model size.
    pub async fn list_running(&self) -> OllamaResult<Vec<RunningModel>> {
        let response = self
            .client
            .get(format!("{}/api/ps", self.base_url))
            .timeout(self.operation_timeouts.list_models)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(Self::handle_http_error(response).await);
        }

        let ps: PsResponse = response
            .json()
            .await
            .map_err(|e| OllamaError::ParseError(format!("Failed to parse ps response: {}", e)))?;
        Ok(ps.models)
    }
}
