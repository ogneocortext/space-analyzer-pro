//! Dynamic Model Selection Ollama Integration for Space Analyzer
//!
//! Features:
//! - Auto-discovers available models from Ollama
//! - Profiles each model's throughput, latency, and memory usage
//! - Classifies tasks by complexity and requirements
//! - Selects optimal model per-request based on:
//!   - Task type (summary, analysis, code, categorization, chat, vision)
//!   - Prompt complexity (word count, technical depth)
//!   - Available VRAM / system memory
//!   - Historical performance (tokens/sec, latency)
//!   - Model capabilities (context window, coding ability, reasoning)
//! - Adapts selection over time based on actual performance

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

// ── Model Discovery ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelInfo {
    pub name: String,
    pub size_bytes: u64,
    pub digest: String,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProfile {
    pub name: String,
    pub size_mb: f64,
    /// Average tokens/sec from recent runs (exponential moving average)
    pub avg_tps: f64,
    /// Average latency in ms (exponential moving average)
    pub avg_latency_ms: f64,
    /// Number of successful runs (confidence metric)
    pub run_count: u32,
    /// Last used timestamp
    pub last_used: Option<String>,
    /// Model capabilities detected from name/patterns
    pub capabilities: ModelCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelCapabilities {
    pub is_coding_model: bool,
    pub is_vision_model: bool,
    pub is_reasoning_model: bool,
    pub is_small_fast: bool,
    pub max_context: i32,
    pub estimated_params_b: f32,
}

// ── Task Classification ─────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum TaskType {
    QuickReply,       // Short answer, < 50 word prompt
    Summary,          // Summarize data or text
    Analysis,         // Deep analysis of file system data
    CodeGeneration,   // Write or modify code
    CodeReview,       // Analyze existing code
    Categorization,   // Classify files into categories
    Chat,             // General conversation
    Organization,     // File organization recommendations
    Cleanup,          // Cleanup recommendations
}

#[derive(Debug, Clone)]
pub struct TaskProfile {
    pub task_type: TaskType,
    pub complexity: TaskComplexity,
    pub estimated_output_tokens: i32,
    pub requires_coding: bool,
    pub requires_reasoning: bool,
    pub requires_large_context: bool,
}

#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub enum TaskComplexity {
    Trivial,    // < 20 words, simple question
    Low,        // 20-50 words, straightforward
    Medium,     // 50-200 words, some analysis
    High,       // 200-500 words, deep analysis
    VeryHigh,   // > 500 words, complex multi-step
}

// ── Configuration ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CudaOllamaConfig {
    pub host: String,
    pub default_model: String,
    pub num_gpu: i32,
    pub num_thread: i32,
    pub temperature: f32,
    pub keep_alive: i64,
    pub max_retries: u32,
    /// Prefer smaller models when quality is sufficient (saves VRAM)
    pub prefer_efficient: bool,
    /// Minimum run count before trusting performance data
    pub min_profile_runs: u32,
}

impl Default for CudaOllamaConfig {
    fn default() -> Self {
        Self {
            host: "http://localhost:11434".to_string(),
            default_model: "qwen2.5-coder:7b-instruct".to_string(),
            num_gpu: -1,
            num_thread: 8,
            temperature: 0.2,
            keep_alive: 600,
            max_retries: 2,
            prefer_efficient: true,
            min_profile_runs: 3,
        }
    }
}

impl CudaOllamaConfig {
    pub fn cuda_optimized() -> Self { Self::default() }
    pub fn non_cuda() -> Self { Self { num_gpu: 0, num_thread: 4, ..Default::default() } }

    pub fn is_cuda_available() -> bool {
        std::env::var("CUDA_VISIBLE_DEVICES").is_ok()
            || std::env::var("CUDA_HOME").is_ok()
            || std::env::var("NVIDIA_VISIBLE_DEVICES").is_ok()
    }

    pub fn auto_detect() -> Self {
        if Self::is_cuda_available() { Self::cuda_optimized() } else { Self::non_cuda() }
    }
}

// ── Response ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaResponse {
    pub model: String,
    pub response: String,
    pub success: bool,
    pub error: Option<String>,
    pub tokens_per_second: f64,
    pub latency_ms: f64,
    /// Which model was selected and why
    pub selection_reason: Option<String>,
}

// ── Typed Request/Response ──────────────────────────────────────

#[derive(Serialize)]
struct GenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
    keep_alive: String,
    options: GenerateOptions,
}

#[derive(Serialize)]
struct GenerateOptions {
    temperature: f32,
    num_predict: i32,
    num_gpu: i32,
    num_ctx: i32,
    num_thread: i32,
}

#[derive(Deserialize)]
struct GenerateResponse {
    model: String,
    response: String,
    eval_count: Option<u64>,
    eval_duration: Option<u64>,
}

#[derive(Deserialize)]
struct TagsResponse {
    models: Vec<TagModel>,
}

#[derive(Deserialize)]
struct TagModel {
    name: String,
    size: u64,
    digest: String,
    modified_at: String,
}

#[derive(Deserialize)]
struct ShowModelResponse {
    parameters: Option<String>,
    template: Option<String>,
}

// ── LRU Cache ───────────────────────────────────────────────────

struct ResponseCache {
    entries: HashMap<u64, OllamaResponse>,
    order: Vec<u64>,
    max_size: usize,
}

impl ResponseCache {
    fn new(max_size: usize) -> Self {
        Self { entries: HashMap::with_capacity(max_size), order: Vec::with_capacity(max_size), max_size }
    }
    fn get(&self, prompt: &str) -> Option<&OllamaResponse> {
        self.entries.get(&fast_hash(prompt))
    }
    fn insert(&mut self, prompt: &str, response: OllamaResponse) {
        let hash = fast_hash(prompt);
        if self.entries.len() >= self.max_size {
            if let Some(old) = self.order.first() { self.entries.remove(old); }
            self.order.remove(0);
        }
        self.entries.insert(hash, response.clone());
        self.order.push(hash);
    }
    fn clear(&mut self) { self.entries.clear(); self.order.clear(); }
}

fn fast_hash(s: &str) -> u64 {
    let mut h: u64 = 0x517cc1b727220a95;
    for b in s.bytes() { h ^= b as u64; h = h.wrapping_mul(0x5bd1e9955bd1e995); h ^= h >> 47; }
    h
}

// ── Task Classifier ─────────────────────────────────────────────

fn classify_task(prompt: &str) -> TaskProfile {
    let words = prompt.split_whitespace().count();
    let lower = prompt.to_lowercase();

    let task_type = if words < 15 {
        TaskType::QuickReply
    } else if lower.contains("summar") || lower.contains("overview") || lower.contains("brief") {
        TaskType::Summary
    } else if lower.contains("analy") || lower.contains("inspect") || lower.contains("examine") {
        TaskType::Analysis
    } else if lower.contains("write code") || lower.contains("generate code") || lower.contains("create function") || lower.contains("implement") {
        TaskType::CodeGeneration
    } else if lower.contains("review") && (lower.contains("code") || lower.contains("script") || lower.contains("```")) {
        TaskType::CodeReview
    } else if lower.contains("categor") || lower.contains("classify") || lower.contains("group") {
        TaskType::Categorization
    } else if lower.contains("organiz") || lower.contains("arrange") || lower.contains("structure") {
        TaskType::Organization
    } else if lower.contains("cleanup") || lower.contains("delete") || lower.contains("remove") || lower.contains("recommend") {
        TaskType::Cleanup
    } else {
        TaskType::Chat
    };

    let complexity = if words < 20 { TaskComplexity::Trivial }
        else if words < 50 { TaskComplexity::Low }
        else if words < 200 { TaskComplexity::Medium }
        else if words < 500 { TaskComplexity::High }
        else { TaskComplexity::VeryHigh };

    let requires_coding = matches!(task_type, TaskType::CodeGeneration | TaskType::CodeReview);
    let requires_reasoning = matches!(task_type, TaskType::Analysis | TaskType::Cleanup | TaskType::Organization);
    let requires_large_context = words > 200 || complexity >= TaskComplexity::High;

    let estimated_output = match &task_type {
        TaskType::QuickReply => 64,
        TaskType::Summary => 256,
        TaskType::Analysis => 512,
        TaskType::CodeGeneration => 384,
        TaskType::CodeReview => 384,
        TaskType::Categorization => 256,
        TaskType::Chat => 256,
        TaskType::Organization => 384,
        TaskType::Cleanup => 256,
    };

    TaskProfile { task_type, complexity, estimated_output_tokens: estimated_output, requires_coding, requires_reasoning, requires_large_context }
}

// ── Model Capability Detection ──────────────────────────────────

pub fn detect_capabilities(name: &str, size_bytes: u64) -> ModelCapabilities {
    let lower = name.to_lowercase();
    let params_b = estimate_params(name, size_bytes);

    // Coding models
    let is_coding = lower.contains("coder") || lower.contains("code")
        || lower.contains("deepseek-coder") || lower.contains("starcoder")
        || lower.contains("codellama") || lower.contains("wizardcoder")
        || lower.contains("magicoder") || lower.contains("codeqwen")
        || lower.contains("phi-3") && lower.contains("mini") // phi3-mini is decent at code
        || lower.contains("qwen2.5") && lower.contains("coder");

    // Vision models
    let is_vision = lower.contains("llava") || lower.contains("bakllava")
        || lower.contains("moondream") || lower.contains("vision")
        || lower.contains("llama3.2-vision") || lower.contains("llama3.2") && lower.contains("11b")
        || lower.contains("qwen2-vl") || lower.contains("minicpm-v");

    // Reasoning models
    let is_reasoning = lower.contains("qwq") || lower.contains("deepseek-r1")
        || lower.contains("deepseek-reasoner") || lower.contains("o1")
        || lower.contains("o3") || lower.contains("reason");

    // Small/fast models (< 4B params)
    let is_small = params_b < 4.0;

    // Context window detection from name
    let max_ctx = if lower.contains("128k") { 131072 }
        else if lower.contains("64k") { 65536 }
        else if lower.contains("32k") || lower.contains("long") { 32768 }
        else if lower.contains("16k") { 16384 }
        else if lower.contains("8k") { 8192 }
        else { 4096 };

    ModelCapabilities {
        is_coding_model: is_coding,
        is_vision_model: is_vision,
        is_reasoning_model: is_reasoning,
        is_small_fast: is_small,
        max_context: max_ctx,
        estimated_params_b: params_b,
    }
}

/// Estimate model params from name tag or size on disk
fn estimate_params(name: &str, size_bytes: u64) -> f32 {
    let lower = name.to_lowercase();

    // Try to extract param count from name first (e.g., "7b", "70b", "3.8b")
    if let Some(caps) = regex_match_param(&lower) {
        return caps;
    }

    // Fallback: estimate from file size
    // GGUF files are roughly 0.5-1.0 bytes per param depending on quantization
    // Q4_K_M ≈ 0.5-0.6 GB per billion params
    let size_gb = size_bytes as f32 / 1_000_000_000.0;
    if size_gb < 0.5 { 0.5 }           // tiny model
    else if size_gb < 1.0 { 1.0 }      // ~1B
    else if size_gb < 2.0 { 1.5 }      // ~1.5B
    else if size_gb < 3.0 { 3.0 }      // ~3B
    else if size_gb < 4.0 { 3.8 }      // phi3-mini
    else if size_gb < 5.0 { 4.0 }      // ~4B
    else if size_gb < 6.0 { 5.0 }      // ~5B
    else if size_gb < 7.0 { 6.0 }      // ~6B
    else if size_gb < 9.0 { 7.0 }      // ~7B
    else if size_gb < 12.0 { 8.0 }     // ~8B
    else if size_gb < 15.0 { 9.0 }     // ~9B
    else if size_gb < 20.0 { 14.0 }    // ~14B
    else if size_gb < 25.0 { 16.0 }    // ~16B
    else if size_gb < 35.0 { 20.0 }    // ~20B
    else if size_gb < 50.0 { 32.0 }    // ~32B
    else if size_gb < 80.0 { 70.0 }    // ~70B
    else { 70.0 + (size_gb - 80.0) / 2.0 } // extrapolate
}

fn regex_match_param(lower: &str) -> Option<f32> {
    // Match patterns like "7b", "70b", "3.8b", "1.5b", "14b"
    for suffix in &["b", "B"] {
        for prefix in &["", ":", "-", "_"] {
            let search = format!("{}{}", prefix, suffix);
            if let Some(pos) = lower.rfind(&search) {
                // Extract number before the suffix
                let before = &lower[..pos];
                // Find the start of the number
                let num_start = before.rfind(|c: char| !c.is_ascii_digit() && c != '.').map(|p| p + 1).unwrap_or(0);
                let num_str = &before[num_start..];
                if let Ok(val) = num_str.parse::<f32>() {
                    if val > 0.1 && val < 500.0 {
                        return Some(val);
                    }
                }
            }
        }
    }
    None
}

// ── Model Selector ──────────────────────────────────────────────

fn select_best_model(
    task: &TaskProfile,
    available: &[ModelProfile],
    config: &CudaOllamaConfig,
) -> Option<(String, String)> {
    if available.is_empty() { return None; }

    let mut scored: Vec<(f64, &ModelProfile, String)> = Vec::new();

    for model in available {
        let mut score = 0.0;
        let mut reasons = Vec::new();

        // ── Capability matching ──
        if task.requires_coding && model.capabilities.is_coding_model {
            score += 30.0;
            reasons.push("coding-optimized");
        }
        if task.requires_reasoning && model.capabilities.is_reasoning_model {
            score += 25.0;
            reasons.push("reasoning-optimized");
        }
        if task.requires_large_context && model.capabilities.max_context >= 16384 {
            score += 15.0;
            reasons.push("large-context");
        }

        // ── Performance (tokens/sec) ──
        if model.run_count >= config.min_profile_runs {
            let tps_score = (model.avg_tps / 50.0).min(1.0) * 20.0;
            score += tps_score;
            reasons.push(&format!("{} tps", model.avg_tps as u32));
        } else {
            score += 5.0;
        }

        // ── Size-based heuristic for unknown models ──
        // Larger models generally more capable, smaller ones faster
        let params = model.capabilities.estimated_params_b;
        if model.run_count < config.min_profile_runs {
            match task.complexity {
                TaskComplexity::Trivial | TaskComplexity::Low => {
                    // Prefer smaller models for simple tasks
                    if params < 4.0 { score += 15.0; reasons.push("small-fast"); }
                    else if params > 20.0 { score -= 10.0; } // Penalize huge models
                }
                TaskComplexity::Medium => {
                    if params >= 3.0 && params <= 14.0 { score += 10.0; reasons.push("balanced"); }
                }
                TaskComplexity::High | TaskComplexity::VeryHigh => {
                    // Prefer larger models for complex tasks
                    if params >= 7.0 { score += 15.0; reasons.push("large-model"); }
                    else if params < 3.0 { score -= 5.0; } // Penalize tiny models
                }
            }
        }

        // ── Efficiency (prefer smaller models when quality is sufficient) ──
        if config.prefer_efficient {
            match task.complexity {
                TaskComplexity::Trivial | TaskComplexity::Low => {
                    if model.capabilities.is_small_fast {
                        score += 20.0;
                        reasons.push("efficient");
                    } else if params > 10.0 {
                        score -= 10.0;
                    }
                }
                TaskComplexity::Medium => {
                    if params <= 8.0 { score += 10.0; }
                }
                TaskComplexity::High | TaskComplexity::VeryHigh => {
                    if params >= 7.0 {
                        score += 15.0;
                        reasons.push("large-for-complex");
                    }
                }
            }
        }

        // ── Recent usage bonus (model likely still loaded in VRAM) ──
        if model.last_used.is_some() {
            score += 5.0;
            reasons.push("warm");
        }

        scored.push((score, model, reasons.join(", ")));
    }

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let (best_score, best_model, reason) = &scored[0];
    Some((best_model.name.clone(), format!("score={:.0} ({})", best_score, reason)))
}

// ── Client ──────────────────────────────────────────────────────

pub struct CudaOllamaClient {
    config: CudaOllamaConfig,
    agent: ureq::Agent,
    cache: Mutex<ResponseCache>,
    profiles: Mutex<HashMap<String, ModelProfile>>,
    available_models: Mutex<Vec<OllamaModelInfo>>,
}

impl CudaOllamaClient {
    pub fn new(config: CudaOllamaConfig) -> Self {
        let client = Self {
            agent: ureq::AgentBuilder::new()
                .timeout_connect(std::time::Duration::from_secs(10))
                .build(),
            cache: Mutex::new(ResponseCache::new(64)),
            profiles: Mutex::new(HashMap::new()),
            available_models: Mutex::new(Vec::new()),
            config,
        };

        // Auto-discover models from your system at startup
        if let Ok(models) = client.refresh_models() {
            eprintln!("🧠 Discovered {} model(s) from Ollama:", models.len());
            for m in &models {
                let size_mb = m.size_bytes as f64 / 1_048_576.0;
                let caps = detect_capabilities(&m.name, m.size_bytes);
                let tags: Vec<&str> = [
                    if caps.is_coding_model { Some("code") } else { None },
                    if caps.is_vision_model { Some("vision") } else { None },
                    if caps.is_reasoning_model { Some("reason") } else { None },
                    if caps.is_small_fast { Some("fast") } else { None },
                ].into_iter().flatten().collect();
                let tag_str = if tags.is_empty() { "general" } else { &tags.join(", ") };
                eprintln!("   {} ({:.0} MB) [{}]", m.name, size_mb, tag_str);
            }
        } else {
            eprintln!("⚠️  Could not connect to Ollama at {}. Models will be discovered on first use.", client.config.host);
        }

        client
    }

    pub fn auto() -> Self { Self::new(CudaOllamaConfig::auto_detect()) }

    /// Discover available models from Ollama
    pub fn refresh_models(&self) -> Result<Vec<OllamaModelInfo>, String> {
        let url = format!("{}/api/tags", self.config.host);
        let resp = self.agent.get(&url)
            .timeout(std::time::Duration::from_secs(5))
            .call()
            .map_err(|e| format!("Failed to list models: {}", e))?;

        let text = resp.into_string().map_err(|e| format!("Read error: {}", e))?;
        let tags: TagsResponse = serde_json::from_str(&text)
            .map_err(|e| format!("JSON decode: {}", e))?;

        let models: Vec<OllamaModelInfo> = tags.models.iter().map(|m| OllamaModelInfo {
            name: m.name.clone(),
            size_bytes: m.size,
            digest: m.digest.clone(),
            modified_at: m.modified_at.clone(),
        }).collect();

        // Initialize profiles for new models
        {
            let mut profiles = self.profiles.lock().unwrap();
            for m in &models {
                if !profiles.contains_key(&m.name) {
                    profiles.insert(m.name.clone(), ModelProfile {
                        name: m.name.clone(),
                        size_mb: m.size_bytes as f64 / 1_048_576.0,
                        avg_tps: 0.0,
                        avg_latency_ms: 0.0,
                        run_count: 0,
                        last_used: None,
                        capabilities: detect_capabilities(&m.name, m.size_bytes),
                    });
                }
            }
        }

        *self.available_models.lock().unwrap() = models.clone();
        Ok(models)
    }

    /// Get available models (refreshes if empty)
    pub fn get_available_models(&self) -> Vec<OllamaModelInfo> {
        let models = self.available_models.lock().unwrap();
        if models.is_empty() {
            drop(models);
            self.refresh_models().unwrap_or_default();
            self.available_models.lock().unwrap().clone()
        } else {
            models.clone()
        }
    }

    /// Get model performance profiles
    pub fn get_profiles(&self) -> Vec<ModelProfile> {
        self.profiles.lock().unwrap().values().cloned().collect()
    }

    /// Update performance profile after a generation
    fn update_profile(&self, model_name: &str, tps: f64, latency_ms: f64) {
        let mut profiles = self.profiles.lock().unwrap();
        if let Some(profile) = profiles.get_mut(model_name) {
            let alpha = 0.3; // EMA smoothing factor
            if profile.run_count == 0 {
                profile.avg_tps = tps;
                profile.avg_latency_ms = latency_ms;
            } else {
                profile.avg_tps = profile.avg_tps * (1.0 - alpha) + tps * alpha;
                profile.avg_latency_ms = profile.avg_latency_ms * (1.0 - alpha) + latency_ms * alpha;
            }
            profile.run_count += 1;
            profile.last_used = Some(chrono::Local::now().to_rfc3339());
        }
    }

    /// Generate text with dynamic model selection
    pub fn generate(&self, prompt: &str) -> Result<OllamaResponse, String> {
        // Check cache
        {
            let cache = self.cache.lock().unwrap();
            if let Some(cached) = cache.get(prompt) {
                return Ok(cached.clone());
            }
        }

        // Ensure we have model list
        let models = self.get_available_models();
        if models.is_empty() {
            return Err("No models available. Is Ollama running?".to_string());
        }

        // Classify the task
        let task = classify_task(prompt);

        // Get profiles and select best model
        let profiles = {
            let p = self.profiles.lock().unwrap();
            models.iter()
                .filter_map(|m| p.get(&m.name).cloned())
                .collect::<Vec<_>>()
        };

        let (selected_model, selection_reason) = select_best_model(&task, &profiles, &self.config)
            .unwrap_or_else(|| {
                // Fallback: pick the first available model (smallest for efficiency)
                let mut sorted: Vec<_> = models.iter().collect();
                sorted.sort_by_key(|m| m.size_bytes);
                let fallback = sorted.first().map(|m| m.name.clone()).unwrap_or_else(|| self.config.default_model.clone());
                (fallback, "fallback to first available model".to_string())
            });

        // Adaptive num_predict
        let num_predict = if self.config.default_model == selected_model {
            // Use config's adaptive logic
            let words = prompt.split_whitespace().count();
            if words < 20 { 256 } else if words < 100 { 512 } else if words < 500 { 1024 } else { 2048 }
        } else {
            task.estimated_output_tokens
        };

        let timeout_secs = (num_predict as f64 / 10.0).ceil() as u64 + 10;
        let timeout = std::time::Duration::from_secs(timeout_secs.min(300));

        let url = format!("{}/api/generate", self.config.host);
        let req = GenerateRequest {
            model: selected_model.clone(),
            prompt: prompt.to_string(),
            stream: false,
            keep_alive: format!("{}s", self.config.keep_alive),
            options: GenerateOptions {
                temperature: self.config.temperature,
                num_predict,
                num_gpu: self.config.num_gpu,
                num_ctx: task.requires_large_context.then(|| 8192).unwrap_or(4096),
                num_thread: self.config.num_thread,
            },
        };

        let body = serde_json::to_string(&req).map_err(|e| format!("JSON encode: {}", e))?;

        let start = std::time::Instant::now();
        let mut last_error = String::new();

        for attempt in 0..=self.config.max_retries {
            if attempt > 0 {
                std::thread::sleep(std::time::Duration::from_millis(200 * 2u64.pow(attempt as u32)));
            }

            match self.agent.post(&url)
                .set("Content-Type", "application/json")
                .timeout(timeout)
                .send_string(&body)
            {
                Ok(resp) => {
                    let text = resp.into_string().map_err(|e| format!("Read error: {}", e))?;
                    let parsed: GenerateResponse = serde_json::from_str(&text)
                        .map_err(|e| format!("JSON decode: {}", e))?;

                    let latency_ms = start.elapsed().as_millis() as f64;
                    let eval_count = parsed.eval_count.unwrap_or(0) as f64;
                    let eval_duration_ns = parsed.eval_duration.unwrap_or(1);
                    let tps = if eval_duration_ns > 0 { eval_count / (eval_duration_ns as f64 / 1_000_000_000.0) } else { 0.0 };

                    // Update performance profile
                    self.update_profile(&selected_model, tps, latency_ms);

                    let response = OllamaResponse {
                        model: parsed.model.clone(),
                        response: parsed.response,
                        success: true,
                        error: None,
                        tokens_per_second: tps,
                        latency_ms,
                        selection_reason: Some(selection_reason.clone()),
                    };

                    // Cache
                    { let mut cache = self.cache.lock().unwrap(); cache.insert(prompt, response.clone()); }

                    return Ok(response);
                }
                Err(e) => { last_error = format!("HTTP error: {}", e); }
            }
        }

        Err(last_error)
    }

    pub fn generate_with_model(&self, prompt: &str, model: &str) -> Result<OllamaResponse, String> {
        // Override: force specific model, skip selection
        let num_predict = {
            let words = prompt.split_whitespace().count();
            if words < 20 { 256 } else if words < 100 { 512 } else if words < 500 { 1024 } else { 2048 }
        };

        let timeout = std::time::Duration::from_secs((num_predict as f64 / 10.0).ceil() as u64 + 10);
        let url = format!("{}/api/generate", self.config.host);
        let req = GenerateRequest {
            model: model.to_string(),
            prompt: prompt.to_string(),
            stream: false,
            keep_alive: format!("{}s", self.config.keep_alive),
            options: GenerateOptions {
                temperature: self.config.temperature,
                num_predict,
                num_gpu: self.config.num_gpu,
                num_ctx: 4096,
                num_thread: self.config.num_thread,
            },
        };

        let body = serde_json::to_string(&req).map_err(|e| format!("JSON encode: {}", e))?;
        let start = std::time::Instant::now();

        let resp = self.agent.post(&url)
            .set("Content-Type", "application/json")
            .timeout(timeout)
            .send_string(&body)
            .map_err(|e| format!("HTTP error: {}", e))?;

        let text = resp.into_string().map_err(|e| format!("Read error: {}", e))?;
        let parsed: GenerateResponse = serde_json::from_str(&text).map_err(|e| format!("JSON decode: {}", e))?;

        let latency_ms = start.elapsed().as_millis() as f64;
        let eval_count = parsed.eval_count.unwrap_or(0) as f64;
        let eval_duration_ns = parsed.eval_duration.unwrap_or(1);
        let tps = if eval_duration_ns > 0 { eval_count / (eval_duration_ns as f64 / 1_000_000_000.0) } else { 0.0 };

        self.update_profile(model, tps, latency_ms);

        Ok(OllamaResponse {
            model: parsed.model.clone(),
            response: parsed.response,
            success: true,
            error: None,
            tokens_per_second: tps,
            latency_ms,
            selection_reason: Some(format!("user-selected: {}", model)),
        })
    }

    pub fn clear_cache(&self) { self.cache.lock().unwrap().clear(); }

    pub fn reset_profiles(&self) { self.profiles.lock().unwrap().clear(); }

    pub fn generate_code(&self, prompt: &str) -> Result<OllamaResponse, String> {
        self.generate(&format!("Write code for the following task. Provide only the code with brief comments:\n\n{}", prompt))
    }

    pub fn analyze_code(&self, code: &str) -> Result<OllamaResponse, String> {
        self.generate(&format!("Analyze this code and provide suggestions for improvement:\n\n```\n{}\n```", code))
    }

    pub fn explain_code(&self, code: &str) -> Result<OllamaResponse, String> {
        self.generate(&format!("Explain what this code does in simple terms:\n\n```\n{}\n```", code))
    }
}

// ── MlTools ─────────────────────────────────────────────────────

pub struct MlTools {
    client: std::sync::Arc<CudaOllamaClient>,
}

impl MlTools {
    pub fn new() -> Self { Self { client: std::sync::Arc::new(CudaOllamaClient::auto()) } }
    pub fn client(&self) -> &std::sync::Arc<CudaOllamaClient> { &self.client }

    /// List all models discovered from the user's system
    pub fn list_models(&self) -> Vec<OllamaModelInfo> {
        self.client.get_available_models()
    }

    /// Get performance profiles for all discovered models
    pub fn get_profiles(&self) -> Vec<ModelProfile> {
        self.client.get_profiles()
    }

    /// Force a specific model (bypass auto-selection)
    pub fn generate_with_model(&self, prompt: &str, model: &str) -> Result<String, String> {
        self.client.generate_with_model(prompt, model).map(|r| r.response)
    }

    pub fn analyze_file_organization(&self, file_list: &[String]) -> Result<String, String> {
        self.client.generate(&format!("Analyze this file list and suggest organization improvements:\n\n{}", file_list.join("\n")))
            .map(|r| r.response)
    }

    pub fn generate_cleanup_recommendations(&self, files: &[String]) -> Result<String, String> {
        self.client.generate(&format!("Review these files and suggest which ones can be safely deleted:\n\n{}", files.join("\n")))
            .map(|r| r.response)
    }

    pub fn categorize_files(&self, files: &[String]) -> Result<String, String> {
        self.client.generate(&format!("Categorize these files into logical groups:\n\n{}", files.join("\n")))
            .map(|r| r.response)
    }

    pub fn generate_summary(&self, analysis_data: &str) -> Result<String, String> {
        self.client.generate(&format!("Generate a human-readable summary of this file analysis:\n\n{}", analysis_data))
            .map(|r| r.response)
    }

    pub fn suggest_renames(&self, files: &[String]) -> Result<String, String> {
        self.client.generate(&format!("Suggest better names for these files to improve organization:\n\n{}", files.join("\n")))
            .map(|r| r.response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cuda_detection() {
        println!("CUDA available: {}", CudaOllamaConfig::is_cuda_available());
    }

    #[test]
    fn test_task_classification() {
        let t = classify_task("hi");
        assert_eq!(t.task_type, TaskType::QuickReply);
        assert_eq!(t.complexity, TaskComplexity::Trivial);

        let t = classify_task("Summarize the disk usage report for the home directory");
        assert_eq!(t.task_type, TaskType::Summary);

        let t = classify_task("Write code for a function that recursively calculates directory sizes");
        assert_eq!(t.task_type, TaskType::CodeGeneration);
        assert!(t.requires_coding);

        let t = classify_task("Analyze the following file system data and provide recommendations for cleanup and optimization...");
        assert_eq!(t.task_type, TaskType::Analysis);
        assert!(t.requires_reasoning);
    }

    #[test]
    fn test_model_selection() {
        let profiles = vec![
            ModelProfile {
                name: "phi3:mini".into(), size_mb: 2300.0, avg_tps: 80.0, avg_latency_ms: 50.0,
                run_count: 10, last_used: Some("now".into()),
                capabilities: ModelCapabilities { is_small_fast: true, estimated_params_b: 3.8, ..Default::default() },
            },
            ModelProfile {
                name: "qwen2.5-coder:7b".into(), size_mb: 4500.0, avg_tps: 45.0, avg_latency_ms: 120.0,
                run_count: 10, last_used: Some("now".into()),
                capabilities: ModelCapabilities { is_coding_model: true, estimated_params_b: 7.0, ..Default::default() },
            },
            ModelProfile {
                name: "llama3.1:70b".into(), size_mb: 40000.0, avg_tps: 8.0, avg_latency_ms: 500.0,
                run_count: 5, last_used: None,
                capabilities: ModelCapabilities { is_reasoning_model: true, estimated_params_b: 70.0, ..Default::default() },
            },
        ];

        let config = CudaOllamaConfig::default();

        // Simple task should pick small fast model
        let task = classify_task("What is 2+2?");
        let (model, reason) = select_best_model(&task, &profiles, &config).unwrap();
        assert_eq!(model, "phi3:mini");

        // Coding task should pick coding model
        let task = classify_task("Write code for a binary search tree");
        let (model, reason) = select_best_model(&task, &profiles, &config).unwrap();
        assert_eq!(model, "qwen2.5-coder:7b");

        // Complex analysis should pick larger model
        let task = classify_task(&"Analyze this data ".repeat(100));
        let (model, reason) = select_best_model(&task, &profiles, &config).unwrap();
        assert!(model == "llama3.1:70b" || model == "qwen2.5-coder:7b");
    }

    #[test]
    fn test_capability_detection() {
        let c = detect_capabilities("qwen2.5-coder:7b-instruct", 4_500_000_000);
        assert!(c.is_coding_model);

        let c = detect_capabilities("llava:7b", 4_000_000_000);
        assert!(c.is_vision_model);

        let c = detect_capabilities("phi3:mini", 2_300_000_000);
        assert!(c.is_small_fast);
    }
}
