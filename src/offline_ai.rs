use std::collections::HashMap;
use std::path::Path;

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

        // Installer binaries pattern
        patterns.insert(
            "installers".to_string(),
            PatternRule {
                name: "Installer".to_string(),
                description: "Setup binary — usually safe to delete after install".to_string(),
                patterns: vec![
                    "exe".to_string(),
                    "msi".to_string(),
                    "dmg".to_string(),
                    "appx".to_string(),
                    "iso".to_string(),
                    "bin".to_string(),
                    "pkg".to_string(),
                ],
                size_threshold: Some(10 * 1024 * 1024),
                priority: 70,
            },
        );

        // Placeholder rules used only by `classify_path` (path-based detection).
        // They have no extension patterns, so `classify_file` never matches them.
        patterns.insert(
            "ai_models".to_string(),
            PatternRule {
                name: "AI Model".to_string(),
                description: "Local model weights — remove unused models to reclaim space".to_string(),
                patterns: vec![],
                size_threshold: None,
                priority: 85,
            },
        );

        patterns.insert(
            "dependencies".to_string(),
            PatternRule {
                name: "Dependencies".to_string(),
                description: "Reinstallable build dependencies".to_string(),
                patterns: vec![],
                size_threshold: None,
                priority: 60,
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

    /// Classify a file or directory by its full path (path-aware) and size.
    /// Path-based categories (node_modules, ollama/model weights, cache/temp
    /// directories) take precedence over extension matching so folders that
    /// don't expose a telling extension are still caught. Returns the highest
    /// confidence rule available, or `None` when nothing matches.
    pub fn classify_path(&self, path: &str, size: u64) -> Option<&PatternRule> {
        let lower = path.to_lowercase();

        if lower.contains("node_modules") {
            return self.patterns.get("dependencies");
        }
        if lower.contains("ollama") || lower.contains("models") || lower.contains("blobs") {
            return self.patterns.get("ai_models");
        }
        if lower.contains("cache") || lower.contains("/temp") || lower.contains("tmp") {
            return self.patterns.get("cache_files");
        }

        let ext = Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        self.classify_file(&ext, size)
    }
}

impl Default for FilePatternClassifier {
    fn default() -> Self {
        Self::new()
    }
}
