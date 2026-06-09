use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct ClientMetrics {
    pub total_requests: u64,
    pub total_chat_requests: u64,
    pub total_generate_requests: u64,
    pub total_embed_requests: u64,
    pub total_vision_requests: u64,
    pub total_tokens_prompt: u64,
    pub total_tokens_completion: u64,
    pub total_errors: u64,
    pub last_error: Option<String>,
    pub cumulative_duration_ms: u64,
    pub start_time: Instant,
}

impl Default for ClientMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            total_chat_requests: 0,
            total_generate_requests: 0,
            total_embed_requests: 0,
            total_vision_requests: 0,
            total_tokens_prompt: 0,
            total_tokens_completion: 0,
            total_errors: 0,
            last_error: None,
            cumulative_duration_ms: 0,
            start_time: Instant::now(),
        }
    }
}

impl ClientMetrics {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn uptime_seconds(&self) -> f64 {
        self.start_time.elapsed().as_secs_f64()
    }
    pub fn avg_duration_ms(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            self.cumulative_duration_ms as f64 / self.total_requests as f64
        }
    }
    pub fn total_tokens(&self) -> u64 {
        self.total_tokens_prompt + self.total_tokens_completion
    }
    pub fn error_rate(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            self.total_errors as f64 / self.total_requests as f64 * 100.0
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct OperationTimeouts {
    pub connect: Duration,
    pub chat: Duration,
    pub generate: Duration,
    pub embed: Duration,
    pub pull_model: Duration,
    pub model_management: Duration,
    pub list_models: Duration,
    pub vision: Duration,
}

impl Default for OperationTimeouts {
    fn default() -> Self {
        Self {
            connect: Duration::from_secs(5),
            chat: Duration::from_secs(120),
            generate: Duration::from_secs(120),
            embed: Duration::from_secs(60),
            pull_model: Duration::from_secs(600),
            model_management: Duration::from_secs(30),
            list_models: Duration::from_secs(10),
            vision: Duration::from_secs(180),
        }
    }
}
