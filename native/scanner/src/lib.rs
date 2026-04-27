use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;
use serde::{Serialize, Deserialize};
use rayon::prelude::*;
use crossbeam::channel::bounded;
use num_cpus;

// Re-use existing structures from main.rs
#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: String,
    pub category: String,
    pub modified: String,
    pub is_hidden: bool,
    pub is_directory: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryStats {
    pub count: u64,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtensionStats {
    pub count: u64,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub total_files: u64,
    pub total_size: u64,
    pub files: Vec<FileInfo>,
    pub categories: HashMap<String, CategoryStats>,
    pub extension_stats: HashMap<String, ExtensionStats>,
    pub analysis_time_ms: u128,
    pub directory_path: String,
}

// Enhanced analyzer with NAPI bindings
pub struct SpaceAnalyzer {
    exclude_dirs: Vec<String>,
}

impl SpaceAnalyzer {
    pub fn new() -> Self {
        Self {
            exclude_dirs: vec![
                ".git".to_string(),
                "node_modules".to_string(),
                "__pycache__".to_string(),
                ".cache".to_string(),
                "target".to_string(),
                "build".to_string(),
                ".vscode".to_string(),
                ".idea".to_string(),
                ".tmp".to_string(),
                "temp".to_string(),
                "tmp".to_string(),
            ],
        }
    }

    pub fn categorize_file(&self, extension: &str) -> &'static str {
        match extension.to_lowercase().as_str() {
            // Documents
            "pdf" | "doc" | "docx" | "txt" | "rtf" | "md" | "tex" => "Documents",
            // Spreadsheets
            "xls" | "xlsx" | "csv" | "ods" => "Spreadsheets",
            // Presentations
            "ppt" | "pptx" | "odp" => "Presentations",
            // Images
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" => "Images",
            // Videos
            "mp4" | "avi" | "mov" | "wmv" | "flv" | "mkv" => "Videos",
            // Audio
            "mp3" | "wav" | "flac" | "aac" | "ogg" => "Audio",
            // Code
            "js" | "jsx" | "ts" | "tsx" | "py" | "java" | "cpp" | "c" | "h" | "hpp" |
            "cs" | "php" | "rb" | "go" | "rs" | "swift" | "kt" => "Code",
            // Web
            "html" | "htm" | "css" | "scss" | "less" | "xml" => "Web",
            // Config
            "json" | "yaml" | "yml" | "toml" | "ini" | "cfg" => "Config",
            // Archives
            "zip" | "rar" | "7z" | "tar" | "gz" => "Archives",
            // Executables
            "exe" | "msi" | "deb" | "rpm" | "dmg" => "Executables",
            // Databases
            "db" | "sqlite" | "mdb" => "Databases",
            // Fonts
            "ttf" | "otf" | "woff" | "woff2" => "Fonts",
            // System
            "dll" | "so" | "sys" | "tmp" | "log" => "System",
            _ => "Other",
        }
    }

    pub fn analyze_directory_optimized(
        &self,
        directory_path: String,
        max_depth: Option<usize>,
        include_hidden: Option<bool>,
        parallel: Option<bool>,
    ) -> anyhow::Result<AnalysisResult> {
        let start_time = SystemTime::now();
        let max_depth = max_depth.unwrap_or(10);
        let include_hidden = include_hidden.unwrap_or(false);
        let use_parallel = parallel.unwrap_or(true);

        let path = Path::new(&directory_path);
        if !path.exists() || !path.is_dir() {
            return Err(anyhow::anyhow!("Directory does not exist or is not a directory"));
        }

        let mut total_files = 0u64;
        let mut total_size = 0u64;
        let mut files = Vec::new();
        let mut categories = HashMap::new();
        let mut extension_stats = HashMap::new();

        let (sender, receiver) = bounded(10000);
        let walker = WalkDir::new(&directory_path)
            .max_depth(max_depth)
            .follow_links(false)
            .into_iter();

        // Spawn collector thread
        let collector_handle = std::thread::spawn(move || {
            let mut collected_files = Vec::new();
            let mut collected_total = 0u64;
            let mut collected_size = 0u64;
            let mut collected_categories = HashMap::new();
            let mut collected_extensions = HashMap::new();

            for file_info in receiver {
                collected_total += 1;
                collected_size += file_info.size;

                let cat_info = collected_categories
                    .entry(file_info.category.clone())
                    .or_insert(CategoryStats { count: 0, size: 0 });
                cat_info.count += 1;
                cat_info.size += file_info.size;

                let ext_info = collected_extensions
                    .entry(file_info.extension.clone())
                    .or_insert(ExtensionStats { count: 0, size: 0 });
                ext_info.count += 1;
                ext_info.size += file_info.size;

                collected_files.push(file_info);
            }

            (collected_files, collected_total, collected_size, collected_categories, collected_extensions)
        });

        // Process directory entries
        if use_parallel {
            // Parallel processing
            let entry_iter = walker
                .filter_map(|e| e.ok())
                .filter(|entry| self.should_include_entry(entry, include_hidden))
                .par_bridge();

            for entry in entry_iter {
                if let Ok(metadata) = entry.metadata() {
                    if let Some(file_info) = self.create_file_info(entry, &metadata) {
                        if sender.send(file_info).is_err() {
                            break;
                        }
                    }
                }
            }
        } else {
            // Sequential processing
            for entry in walker.filter_map(|e| e.ok()).filter(|entry| self.should_include_entry(entry, include_hidden)) {
                if let Ok(metadata) = entry.metadata() {
                    if let Some(file_info) = self.create_file_info(entry, &metadata) {
                        if sender.send(file_info).is_err() {
                            break;
                        }
                    }
                }
            }
        }

        drop(sender); // Close channel

        // Wait for collector
        let (collected_files, collected_total, collected_size, collected_categories, collected_extensions) =
            collector_handle.join().map_err(|_| anyhow::anyhow!("Thread join failed"))?;

        let analysis_time = start_time
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        Ok(AnalysisResult {
            total_files: collected_total,
            total_size: collected_size,
            files: collected_files,
            categories: collected_categories,
            extension_stats: collected_extensions,
            analysis_time_ms: analysis_time,
            directory_path,
        })
    }

    fn should_include_entry(&self, entry: &walkdir::DirEntry, include_hidden: bool) -> bool {
        let path = entry.path();

        // Skip excluded directories
        if let Some(file_name) = path.file_name() {
            if let Some(name_str) = file_name.to_str() {
                if self.exclude_dirs.contains(&name_str.to_string()) {
                    return false;
                }
            }
        }

        // Skip hidden files unless requested
        if !include_hidden {
            if let Some(file_name) = path.file_name() {
                if let Some(name_str) = file_name.to_str() {
                    if name_str.starts_with('.') {
                        return false;
                    }
                }
            }
        }

        true
    }

    fn create_file_info(&self, entry: &walkdir::DirEntry, metadata: &fs::Metadata) -> Option<FileInfo> {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path_str = path.to_string_lossy().to_string();

        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_string();

        let category = if metadata.is_dir() {
            "Directory".to_string()
        } else {
            self.categorize_file(&extension).to_string()
        };

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs().to_string())
            .unwrap_or_else(|| "0".to_string());

        Some(FileInfo {
            name: file_name,
            path: file_path_str,
            size: metadata.len(),
            extension,
            category,
            modified,
            is_hidden: entry.file_name().to_string_lossy().starts_with('.'),
            is_directory: metadata.is_dir(),
        })
    }
}

// NAPI bindings
#[napi]
pub fn create_analyzer() -> SpaceAnalyzer {
    SpaceAnalyzer::new()
}

#[napi]
pub async fn analyze_directory_optimized(
    analyzer: &SpaceAnalyzer,
    directory_path: String,
    max_depth: Option<u32>,
    include_hidden: Option<bool>,
    parallel: Option<bool>,
) -> Result<AnalysisResult> {
    let result = analyzer.analyze_directory_optimized(
        directory_path,
        max_depth.map(|d| d as usize),
        include_hidden,
        parallel,
    )?;

    Ok(result)
}

#[napi]
pub fn categorize_file(analyzer: &SpaceAnalyzer, filename: String) -> String {
    let extension = Path::new(&filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");

    analyzer.categorize_file(extension).to_string()
}

#[napi]
pub fn get_system_info() -> Result<serde_json::Value> {
    let info = serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "target": std::env::consts::TARGET,
        "rust_version": env!("RUSTC_VERSION"),
        "num_cpus": num_cpus::get(),
    });

    Ok(info)
}
