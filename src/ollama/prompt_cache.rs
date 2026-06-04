//! Prompt caching system for token limit management and throughput optimization
//!
//! Implements an LRU cache with token counting, per-model budget tracking,
//! and automatic cache invalidation based on TTL and memory pressure.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

/// Cache entry with metadata
#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub key: String,
    pub system_prompt: String,
    pub user_prompt: String,
    pub response: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub created_at: Instant,
    pub last_accessed: Instant,
    pub access_count: u32,
    pub model: String,
}

impl CacheEntry {
    pub fn total_tokens(&self) -> u32 {
        self.prompt_tokens + self.completion_tokens
    }

    pub fn is_stale(&self, ttl: Duration) -> bool {
        self.created_at.elapsed() > ttl
    }
}

/// Token budget tracking per model
#[derive(Debug, Clone)]
pub struct ModelTokenBudget {
    pub model_name: String,
    pub max_tokens_per_request: u32,
    pub max_tokens_per_minute: u32,
    pub tokens_used_this_minute: u32,
    pub requests_this_minute: u32,
    pub last_reset: Instant,
    pub total_cached_hits: u32,
    pub total_cache_misses: u32,
}

impl ModelTokenBudget {
    pub fn new(model_name: &str, max_tokens_per_request: u32, max_tokens_per_minute: u32) -> Self {
        Self {
            model_name: model_name.to_string(),
            max_tokens_per_request,
            max_tokens_per_minute,
            tokens_used_this_minute: 0,
            requests_this_minute: 0,
            last_reset: Instant::now(),
            total_cached_hits: 0,
            total_cache_misses: 0,
        }
    }

    pub fn reset_if_needed(&mut self) {
        if self.last_reset.elapsed() >= Duration::from_secs(60) {
            self.tokens_used_this_minute = 0;
            self.requests_this_minute = 0;
            self.last_reset = Instant::now();
        }
    }

    pub fn can_make_request(&self, estimated_tokens: u32) -> bool {
        self.tokens_used_this_minute + estimated_tokens <= self.max_tokens_per_minute
            && estimated_tokens <= self.max_tokens_per_request
    }

    pub fn record_request(&mut self, tokens: u32) {
        self.reset_if_needed();
        self.tokens_used_this_minute += tokens;
        self.requests_this_minute += 1;
    }

    pub fn record_cache_hit(&mut self) {
        self.total_cached_hits += 1;
    }

    pub fn record_cache_miss(&mut self) {
        self.total_cache_misses += 1;
    }

    pub fn cache_hit_rate(&self) -> f64 {
        let total = self.total_cached_hits + self.total_cache_misses;
        if total == 0 {
            0.0
        } else {
            self.total_cached_hits as f64 / total as f64
        }
    }

    pub fn remaining_tokens_this_minute(&self) -> u32 {
        self.max_tokens_per_minute
            .saturating_sub(self.tokens_used_this_minute)
    }
}

/// Prompt cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptCacheConfig {
    pub enabled: bool,
    pub max_entries: usize,
    pub ttl_seconds: u64,
    pub max_memory_mb: usize,
    pub estimate_tokens_per_char: f64,
}

impl Default for PromptCacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_entries: 100,
            ttl_seconds: 300, // 5 minutes
            max_memory_mb: 64,
            estimate_tokens_per_char: 0.25, // ~4 chars per token (English average)
        }
    }
}

/// LRU prompt cache with token budget tracking
pub struct PromptCache {
    entries: HashMap<String, CacheEntry>,
    access_order: Vec<String>, // LRU ordering (front = least recently used)
    config: PromptCacheConfig,
    model_budgets: HashMap<String, ModelTokenBudget>,
    total_prompt_tokens_cached: u32,
    total_completion_tokens_cached: u32,
    total_cache_hits: u32,
    total_cache_misses: u32,
}

impl PromptCache {
    pub fn new(config: PromptCacheConfig) -> Self {
        Self {
            entries: HashMap::new(),
            access_order: Vec::new(),
            config,
            model_budgets: HashMap::new(),
            total_prompt_tokens_cached: 0,
            total_completion_tokens_cached: 0,
            total_cache_hits: 0,
            total_cache_misses: 0,
        }
    }

    /// Generate cache key from model, system prompt, and user prompt
    pub fn generate_key(model: &str, system_prompt: &str, user_prompt: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        model.hash(&mut hasher);
        system_prompt.hash(&mut hasher);
        user_prompt.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Estimate token count from text length
    pub fn estimate_tokens(&self, text: &str) -> u32 {
        (text.len() as f64 * self.config.estimate_tokens_per_char).ceil() as u32
    }

    /// Look up cached response
    pub fn lookup(&mut self, key: &str, model: &str) -> Option<CacheEntry> {
        if !self.config.enabled {
            return None;
        }

        self.clean_stale();
        if let Some(entry) = self.entries.get_mut(key) {
            entry.last_accessed = Instant::now();
            entry.access_count += 1;

            // Move to end of access order (most recently used)
            self.access_order.retain(|k| k != key);
            self.access_order.push(key.to_string());

            // Record cache hit
            self.total_cache_hits += 1;
            if let Some(budget) = self.model_budgets.get_mut(model) {
                budget.record_cache_hit();
            }

            Some(entry.clone())
        } else {
            self.total_cache_misses += 1;
            if let Some(budget) = self.model_budgets.get_mut(model) {
                budget.record_cache_miss();
            }
            None
        }
    }

    /// Store response in cache
    #[allow(clippy::too_many_arguments)]
    pub fn store(
        &mut self,
        key: String,
        system_prompt: String,
        user_prompt: String,
        response: String,
        prompt_tokens: u32,
        completion_tokens: u32,
        model: String,
    ) {
        if !self.config.enabled {
            return;
        }

        // Evict if at capacity
        while self.entries.len() >= self.config.max_entries {
            self.evict_lru();
        }

        // Evict if over memory limit
        while self.estimated_memory_mb() > self.config.max_memory_mb {
            self.evict_lru();
        }

        let now = Instant::now();
        let entry = CacheEntry {
            key: key.clone(),
            system_prompt,
            user_prompt,
            response,
            prompt_tokens,
            completion_tokens,
            created_at: now,
            last_accessed: now,
            access_count: 1,
            model,
        };

        // Remove any stale entry for the same key to keep access_order consistent
        self.access_order.retain(|k| k != &key);
        self.entries.insert(key.clone(), entry);
        self.access_order.push(key);

        self.total_prompt_tokens_cached += prompt_tokens;
        self.total_completion_tokens_cached += completion_tokens;
    }

    /// Get or create model budget tracker
    pub fn get_or_create_budget(
        &mut self,
        model: &str,
        max_tokens_per_request: u32,
        max_tokens_per_minute: u32,
    ) -> &mut ModelTokenBudget {
        self.model_budgets
            .entry(model.to_string())
            .or_insert_with(|| {
                ModelTokenBudget::new(model, max_tokens_per_request, max_tokens_per_minute)
            })
    }

    /// Check if model can make a request within budget
    pub fn can_request(&mut self, model: &str, estimated_tokens: u32) -> bool {
        if let Some(budget) = self.model_budgets.get_mut(model) {
            budget.reset_if_needed();
            budget.can_make_request(estimated_tokens)
        } else {
            true // No budget set, allow
        }
    }

    /// Record token usage for a model
    pub fn record_usage(&mut self, model: &str, tokens: u32) {
        if let Some(budget) = self.model_budgets.get_mut(model) {
            budget.record_request(tokens);
        }
    }

    /// Clear all cached entries
    pub fn clear(&mut self) {
        self.entries.clear();
        self.access_order.clear();
        self.total_prompt_tokens_cached = 0;
        self.total_completion_tokens_cached = 0;
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let ttl = Duration::from_secs(self.config.ttl_seconds);
        let stale_count = self.entries.values().filter(|e| e.is_stale(ttl)).count();

        CacheStats {
            enabled: self.config.enabled,
            total_entries: self.entries.len(),
            stale_entries: stale_count,
            max_entries: self.config.max_entries,
            ttl_seconds: self.config.ttl_seconds,
            estimated_memory_mb: self.estimated_memory_mb(),
            max_memory_mb: self.config.max_memory_mb,
            total_prompt_tokens_cached: self.total_prompt_tokens_cached,
            total_completion_tokens_cached: self.total_completion_tokens_cached,
            total_cache_hits: self.total_cache_hits,
            total_cache_misses: self.total_cache_misses,
            overall_hit_rate: self.overall_hit_rate(),
            model_budgets: self.model_budgets.values().cloned().collect(),
        }
    }

    /// Update cache configuration
    pub fn update_config(&mut self, config: PromptCacheConfig) {
        self.config = config;
        // Evict if new config is more restrictive on entry count
        while self.entries.len() > self.config.max_entries {
            self.evict_lru();
        }
        // Evict if new config is more restrictive on memory
        while self.estimated_memory_mb() > self.config.max_memory_mb {
            self.evict_lru();
            if self.entries.is_empty() {
                break;
            }
        }
    }

    /// Get current config
    pub fn config(&self) -> &PromptCacheConfig {
        &self.config
    }

    // ── Private Methods ───────────────────────────────────────────

    fn clean_stale(&mut self) {
        let ttl = Duration::from_secs(self.config.ttl_seconds);
        let stale_keys: Vec<String> = self
            .entries
            .iter()
            .filter(|(_, entry)| entry.is_stale(ttl))
            .map(|(key, _)| key.clone())
            .collect();

        for key in stale_keys {
            self.entries.remove(&key);
            self.access_order.retain(|k| k != &key);
        }
    }

    fn evict_lru(&mut self) {
        if let Some(lru_key) = self.access_order.first().cloned() {
            if let Some(entry) = self.entries.remove(&lru_key) {
                self.total_prompt_tokens_cached = self
                    .total_prompt_tokens_cached
                    .saturating_sub(entry.prompt_tokens);
                self.total_completion_tokens_cached = self
                    .total_completion_tokens_cached
                    .saturating_sub(entry.completion_tokens);
            }
            self.access_order.remove(0);
        }
    }

    fn estimated_memory_mb(&self) -> usize {
        let total_bytes: usize = self
            .entries
            .values()
            .map(|e| {
                e.key.len()
                    + e.system_prompt.len()
                    + e.user_prompt.len()
                    + e.response.len()
                    + std::mem::size_of::<CacheEntry>()
            })
            .sum();
        total_bytes / (1024 * 1024)
    }

    fn overall_hit_rate(&self) -> f64 {
        let total = self.total_cache_hits + self.total_cache_misses;
        if total == 0 {
            0.0
        } else {
            self.total_cache_hits as f64 / total as f64
        }
    }
}

/// Cache statistics for UI display
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub enabled: bool,
    pub total_entries: usize,
    pub stale_entries: usize,
    pub max_entries: usize,
    pub ttl_seconds: u64,
    pub estimated_memory_mb: usize,
    pub max_memory_mb: usize,
    pub total_prompt_tokens_cached: u32,
    pub total_completion_tokens_cached: u32,
    pub total_cache_hits: u32,
    pub total_cache_misses: u32,
    pub overall_hit_rate: f64,
    pub model_budgets: Vec<ModelTokenBudget>,
}
