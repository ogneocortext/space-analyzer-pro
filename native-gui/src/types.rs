use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Re-export shared scanner types
pub use shared_scanner::{FileInfo, ScanProgress, SystemInfo, DriveInfo};

/// Per-directory aggregate information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirInfo {
    pub path: String,
    pub name: String,
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub largest_file_size: u64,
}

/// Sort column for file tables
#[derive(Debug, Clone, PartialEq)]
pub enum SortColumn {
    Name,
    Size,
    Extension,
    Modified,
}

/// Sort direction
#[derive(Debug, Clone, PartialEq)]
pub enum SortDir {
    Ascending,
    Descending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryAnalysis {
    pub path: String,
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub analysis_time_ms: u64,
    pub file_types: HashMap<String, u64>,
    pub extension_sizes: HashMap<String, u64>,
    pub size_distribution: HashMap<String, u64>,
    pub largest_files: Vec<FileInfo>,
    pub empty_directories: Vec<String>,
    pub errors: Vec<String>,
    pub subdirectories: Vec<DirInfo>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AppTheme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: AppTheme,
    pub language: String,
    pub auto_save: bool,
    pub show_hidden_files: bool,
    pub max_file_preview_size: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: AppTheme::System,
            language: "en".to_string(),
            auto_save: true,
            show_hidden_files: false,
            max_file_preview_size: 1024 * 1024,
        }
    }
}

impl Default for DirectoryAnalysis {
    fn default() -> Self {
        Self {
            path: String::new(),
            total_files: 0,
            total_directories: 0,
            total_size: 0,
            analysis_time_ms: 0,
            file_types: HashMap::new(),
            extension_sizes: HashMap::new(),
            size_distribution: HashMap::new(),
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
            subdirectories: Vec::new(),
        }
    }
}
