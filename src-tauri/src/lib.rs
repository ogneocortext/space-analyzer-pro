use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod commands;
pub mod scanner;

pub use commands::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: Option<String>,
    pub file_type: String,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryAnalysis {
    pub path: String,
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub analysis_time_ms: u64,
    pub file_types: HashMap<String, u64>,
    pub largest_files: Vec<FileInfo>,
    pub empty_directories: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub files_scanned: u64,
    pub directories_scanned: u64,
    pub total_size: u64,
    pub current_file: String,
    pub percentage: f32,
    pub completed: bool,
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
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            analyze_directory,
            analyze_directory_with_progress,
            get_system_info,
            open_file_location,
            cancel_analysis,
            get_file_details,
            delete_files,
            get_drives,
            report_error,
            get_error_logs,
            get_error_stats,
            clear_error_logs,
            delete_error_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
