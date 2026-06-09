#[derive(Debug, Clone)]
pub struct ModelFallbackConfig {
    pub enabled: bool,
    pub fallback_models: Vec<String>,
    pub log_fallbacks: bool,
}

impl Default for ModelFallbackConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            fallback_models: vec![],
            log_fallbacks: true,
        }
    }
}

impl ModelFallbackConfig {
    pub fn with_common_fallbacks(primary_model: &str) -> Self {
        let mut fallbacks = vec![];
        let primary_lower = primary_model.to_lowercase();
        if primary_lower.contains("llama")
            || primary_lower.contains("mistral")
            || primary_lower.contains("phi")
        {
            fallbacks.push("llama3.2:3b".to_string());
            fallbacks.push("phi4-mini".to_string());
            fallbacks.push("tinyllama".to_string());
            fallbacks.push("llama3.2:1b".to_string());
        } else {
            fallbacks.push("llama3.2:3b".to_string());
            fallbacks.push("phi4-mini".to_string());
            fallbacks.push("tinyllama".to_string());
        }
        Self {
            enabled: true,
            fallback_models: fallbacks,
            log_fallbacks: true,
        }
    }
}
