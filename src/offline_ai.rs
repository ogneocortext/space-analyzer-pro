use std::collections::HashMap;

/// Built-in file pattern classifiers
pub struct FilePatternClassifier {
    patterns: HashMap<String, PatternRule>,
}

#[derive(Debug, Clone)]
pub struct PatternRule {
    pub name: String,
    pub description: String,
    pub patterns: Vec<String>,
    pub size_threshold: Option<u64>,
    pub priority: i32,
}

impl FilePatternClassifier {
    pub fn new() -> Self {
        let mut patterns = HashMap::new();

        // Large video files pattern
        patterns.insert(
            "large_videos".to_string(),
            PatternRule {
                name: "Large Video Files".to_string(),
                description: "Video files over 500MB that may benefit from archiving".to_string(),
                patterns: vec![
                    "mp4".to_string(),
                    "avi".to_string(),
                    "mkv".to_string(),
                    "mov".to_string(),
                    "wmv".to_string(),
                ],
                size_threshold: Some(500 * 1024 * 1024),
                priority: 80,
            },
        );

        // Cache files pattern
        patterns.insert(
            "cache_files".to_string(),
            PatternRule {
                name: "Cache Files".to_string(),
                description: "Temporary cache files that can be safely deleted".to_string(),
                patterns: vec![
                    "cache".to_string(),
                    "tmp".to_string(),
                    "temp".to_string(),
                    "log".to_string(),
                ],
                size_threshold: None,
                priority: 90,
            },
        );

        Self { patterns }
    }

    pub fn classify_file(&self, extension: &str, size: u64) -> Option<&PatternRule> {
        self.patterns.values().find(|rule| {
            rule.patterns.contains(&extension.to_lowercase())
                && rule
                    .size_threshold
                    .is_none_or(|threshold| size >= threshold)
        })
    }
}

impl Default for FilePatternClassifier {
    fn default() -> Self {
        Self::new()
    }
}

/// Built-in recommendation engine
pub struct RecommendationEngine {
    _classifier: FilePatternClassifier,
}

impl Default for RecommendationEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl RecommendationEngine {
    pub fn new() -> Self {
        Self {
            _classifier: FilePatternClassifier::new(),
        }
    }

    pub fn analyze(
        &self,
        file_types: &HashMap<String, usize>,
        _total_size: u64,
        total_files: usize,
    ) -> Vec<String> {
        let mut recommendations = Vec::new();

        // High file count warning
        if total_files > 50000 {
            recommendations
                .push("Consider cleaning up temporary files and cache directories".to_string());
        }

        // Large aggregate size for specific types
        for (ext, count) in file_types {
            let ext_lower = ext.to_lowercase();
            match ext_lower.as_str() {
                "log" | "tmp" | "cache" if *count > 100 => {
                    recommendations
                        .push(format!("Found {} {} files - consider cleanup", count, ext));
                }
                "dll" | "sys" => {
                    recommendations.push(
                        "System files detected - avoid modifying unless necessary".to_string(),
                    );
                    break;
                }
                _ => {}
            }
        }

        recommendations
    }
}
