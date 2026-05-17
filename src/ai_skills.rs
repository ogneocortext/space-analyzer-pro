//! AI Skills for Space Analyzer Pro
//! 
//! Provides intelligent analysis capabilities for disk space management.

use serde::{Deserialize, Serialize};

/// AI Skill trait for different analysis capabilities
pub trait AISkill {
    /// Analyze data and provide insights
    fn analyze(&self, context: &AIContext) -> AIInsight;
    
    /// Get the skill name
    fn name(&self) -> &'static str;
    
    /// Get the skill description
    fn description(&self) -> &'static str;
}

/// Context for AI analysis
#[derive(Debug, Clone)]
pub struct AIContext {
    pub scan_result: Option<crate::gui_common::ScanResult>,
    pub disk_usage: Vec<DiskUsage>,
    pub history: Vec<HistoricalScan>,
}

/// Disk usage information
#[derive(Debug, Clone)]
pub struct DiskUsage {
    pub path: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
}

/// Historical scan data
#[derive(Debug, Clone)]
pub struct HistoricalScan {
    pub timestamp: String,
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub path: String,
}

/// AI-generated insight
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIInsight {
    pub skill: &'static str,
    pub confidence: f32,
    pub summary: String,
    pub details: Vec<String>,
    pub suggestions: Vec<AISuggestion>,
}

/// AI suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISuggestion {
    pub action: SuggestionAction,
    pub title: String,
    pub description: String,
    pub estimated_savings: Option<u64>,
}

/// Suggested action
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SuggestionAction {
    Cleanup,
    Archive,
    Move,
    Delete,
    Optimize,
}

/// Storage prediction skill
pub struct StoragePredictor;

impl StoragePredictor {
    pub fn predict_growth(&self, history: &[HistoricalScan], days_ahead: usize) -> StoragePrediction {
        if history.len() < 2 {
            return StoragePrediction {
                predicted_size: 0,
                growth_rate: 0.0,
                days_until_full: None,
            };
        }

        // Calculate average daily growth
        let mut growth_rates = Vec::new();
        for window in history.windows(2) {
            let size_diff = window[1].total_size_bytes as i64 - window[0].total_size_bytes as i64;
            let days_diff = 7; // Assuming weekly scans
            if days_diff > 0 {
                growth_rates.push(size_diff as f64 / days_diff as f64);
            }
        }

        let avg_growth = if !growth_rates.is_empty() {
            growth_rates.iter().sum::<f64>() / growth_rates.len() as f64
        } else {
            0.0
        };

        let last_size = history.last().map(|h| h.total_size_bytes).unwrap_or(0);
        let predicted_size = (last_size as f64 + avg_growth * days_ahead as f64).max(0.0) as u64;

        StoragePrediction {
            predicted_size,
            growth_rate: avg_growth as f32,
            days_until_full: None,
        }
    }
}

/// Storage prediction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoragePrediction {
    pub predicted_size: u64,
    pub growth_rate: f32,
    pub days_until_full: Option<usize>,
}

/// Duplicate pattern analyzer
pub struct DuplicatePatternAnalyzer;

impl DuplicatePatternAnalyzer {
    pub fn analyze_patterns(&self, scan_result: &crate::gui_common::ScanResult) -> Vec<PatternInsight> {
        let mut insights = Vec::new();
        
        // Analyze file extensions for potential duplicates
        let mut extension_groups: std::collections::HashMap<String, Vec<(String, u64)>> = std::collections::HashMap::new();
        
        for (path, size) in &scan_result.largest_files {
            if let Some(ext) = std::path::Path::new(path).extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                extension_groups.entry(ext_lower).or_default().push((path.clone(), *size));
            }
        }

        for (ext, files) in extension_groups {
            if files.len() > 5 {
                insights.push(PatternInsight {
                    pattern_type: PatternType::RepeatedExtension,
                    description: format!("Found {} files with extension .{}", files.len(), ext),
                    file_count: files.len(),
                    potential_savings: files.iter().map(|(_, s)| *s).sum::<u64>() / 2, // Estimate 50% could be duplicates
                });
            }
        }

        insights
    }
}

/// Pattern insight
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternInsight {
    pub pattern_type: PatternType,
    pub description: String,
    pub file_count: usize,
    pub potential_savings: u64,
}

/// Type of pattern detected
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PatternType {
    RepeatedExtension,
    SimilarSize,
    SameNamingPattern,
    DevelopmentArtifacts,
}

/// File categorization skill
pub struct FileCategorizer;

impl FileCategorizer {
    pub fn categorize_files(&self, scan_result: &crate::gui_common::ScanResult) -> FileCategories {
        let mut categories = FileCategories::default();

        for (ext, count) in &scan_result.file_types {
            let category = self.categorize_extension(ext);
            match category {
                FileCategory::Documents => categories.documents += count,
                FileCategory::Media => categories.media += count,
                FileCategory::Code => categories.code += count,
                FileCategory::Archives => categories.archives += count,
                FileCategory::System => categories.system += count,
                FileCategory::Temp => categories.temp += count,
                FileCategory::Other => categories.other += count,
            }
        }

        categories
    }

    fn categorize_extension(&self, ext: &str) -> FileCategory {
        match ext.to_lowercase().as_str() {
            "txt" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "rtf" => FileCategory::Documents,
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "mp4" | "avi" | "mov" | "mkv" | "mp3" | "wav" | "flac" => FileCategory::Media,
            "rs" | "py" | "js" | "ts" | "java" | "cpp" | "c" | "h" | "go" | "rb" | "php" | "swift" | "kt" => FileCategory::Code,
            "zip" | "tar" | "gz" | "rar" | "7z" | "bz2" => FileCategory::Archives,
            "tmp" | "temp" | "cache" | "log" => FileCategory::Temp,
            "dll" | "exe" | "so" | "dylib" | "sys" => FileCategory::System,
            _ => FileCategory::Other,
        }
    }
}

/// File category
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileCategory {
    Documents,
    Media,
    Code,
    Archives,
    System,
    Temp,
    Other,
}

/// File categories breakdown
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FileCategories {
    pub documents: usize,
    pub media: usize,
    pub code: usize,
    pub archives: usize,
    pub system: usize,
    pub temp: usize,
    pub other: usize,
}

impl FileCategories {
    pub fn total(&self) -> usize {
        self.documents + self.media + self.code + self.archives + self.system + self.temp + self.other
    }
}
