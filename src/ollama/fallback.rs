#[derive(Debug, Clone)]
pub struct ModelFallbackConfig {
    pub enabled: bool,
    /// Fallback model names tried in order when the primary model fails.
    /// For local-only deployments these should be drawn from the locally
    /// installed model set (`/api/tags`), not hardcoded remote names.
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
    /// Build a fallback chain from *local* discovered models only.
    /// `primary_model` is excluded from the fallback list.
    /// Models are ordered heuristically: smaller/faster models first.
    pub fn from_local_models(primary_model: &str, local_models: &[String]) -> Self {
        let primary_lower = primary_model.to_lowercase();
        let mut fallbacks: Vec<String> = local_models
            .iter()
            .filter(|m| m.to_lowercase() != primary_lower)
            .cloned()
            .collect();

        fallbacks.sort_by_cached_key(|m| {
            let name = m.to_lowercase();
            let size_score = if name.contains(":1b") || name.contains("tiny") {
                0
            } else if name.contains(":3b") || name.contains(":4b") {
                1
            } else if name.contains(":7b") || name.contains(":8b") {
                2
            } else {
                3
            };
            (size_score, m.len())
        });

        Self {
            enabled: true,
            fallback_models: fallbacks,
            log_fallbacks: true,
        }
    }
}
