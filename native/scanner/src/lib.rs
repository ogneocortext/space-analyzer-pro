use napi_derive::napi;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use walkdir::WalkDir;
use serde::{Serialize, Deserialize};
use rayon::prelude::*;
use crossbeam::channel::bounded;
use num_cpus;

// Re-use existing structures from main.rs
#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: i64,
    pub extension: String,
    pub category: String,
    pub modified: String,
    pub is_hidden: bool,
    pub is_directory: bool,
    // Windows API fields
    pub created: Option<String>,
    pub accessed: Option<String>,
    pub is_hard_link: bool,
    pub hard_link_count: Option<i32>,
    pub has_ads: bool,
    pub ads_count: Option<i32>,
    pub is_compressed: bool,
    pub compressed_size: Option<i64>,
    pub is_sparse: bool,
    pub is_reparse_point: bool,
    pub reparse_tag: Option<String>,
    pub owner: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct CategoryStats {
    pub count: i64,
    pub size: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct ExtensionStats {
    pub count: i64,
    pub size: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct AnalysisResult {
    pub total_files: i64,
    pub total_size: i64,
    pub files: Vec<FileInfo>,
    pub categories_json: String,
    pub extension_stats_json: String,
    pub analysis_time_ms: i64,
    pub directory_path: String,
}

// Enhanced analyzer with NAPI bindings
#[napi]
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

        let _total_files = 0i64;
        let _total_size = 0i64;
        let _files: Vec<FileInfo> = Vec::new();
        let _categories: HashMap<String, CategoryStats> = HashMap::new();
        let _extension_stats: HashMap<String, ExtensionStats> = HashMap::new();

        let (sender, receiver) = bounded::<FileInfo>(10000);
        let walker = WalkDir::new(&directory_path)
            .max_depth(max_depth)
            .follow_links(false)
            .into_iter();

        // Spawn collector thread
        let collector_handle = std::thread::spawn(move || {
            let mut collected_files = Vec::new();
            let mut collected_total = 0i64;
            let mut collected_size = 0i64;
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
            // Parallel processing - use for_each for rayon parallel iterator
            walker
                .filter_map(|e| e.ok())
                .filter(|entry| self.should_include_entry(entry, include_hidden))
                .par_bridge()
                .for_each(|entry| {
                    if let Ok(metadata) = entry.metadata() {
                        if let Some(file_info) = self.create_file_info(&entry, &metadata) {
                            if sender.send(file_info).is_err() {
                                return;
                            }
                        }
                    }
                });
        } else {
            // Sequential processing
            for entry in walker.filter_map(|e| e.ok()).filter(|entry| self.should_include_entry(entry, include_hidden)) {
                if let Ok(metadata) = entry.metadata() {
                    if let Some(file_info) = self.create_file_info(&entry, &metadata) {
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

        // Serialize HashMaps to JSON strings for NAPI compatibility
        let categories_json = serde_json::to_string(&collected_categories)
            .unwrap_or_else(|_| "{}".to_string());
        let extension_stats_json = serde_json::to_string(&collected_extensions)
            .unwrap_or_else(|_| "{}".to_string());

        Ok(AnalysisResult {
            total_files: collected_total,
            total_size: collected_size,
            files: collected_files,
            categories_json,
            extension_stats_json,
            analysis_time_ms: analysis_time as i64,
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

        // Windows API fields (only populated on Windows)
        #[cfg(windows)]
        let (created, accessed, is_hard_link, hard_link_count, has_ads, ads_count, is_compressed, compressed_size, is_sparse, is_reparse_point, reparse_tag, owner) = {
            use std::os::windows::fs::MetadataExt;

            let nlink = metadata.file_attributes() as u32;
            let is_hard_link = nlink > 1;
            let hard_link_count = if is_hard_link { Some(nlink as i32) } else { None };

            // For now, set other Windows fields to default values
            // Full Windows API integration would require winapi calls
            (None, None, is_hard_link, hard_link_count, false, None, false, None, false, false, None, None)
        };

        #[cfg(not(windows))]
        let (created, accessed, is_hard_link, hard_link_count, has_ads, ads_count, is_compressed, compressed_size, is_sparse, is_reparse_point, reparse_tag, owner) = {
            (None, None, false, None, false, None, false, None, false, false, None, None)
        };

        Some(FileInfo {
            name: file_name,
            path: file_path_str,
            size: metadata.len() as i64,
            extension,
            category,
            modified,
            is_hidden: entry.file_name().to_string_lossy().starts_with('.'),
            is_directory: metadata.is_dir(),
            // Windows API fields
            created,
            accessed,
            is_hard_link,
            hard_link_count,
            has_ads,
            ads_count,
            is_compressed,
            compressed_size,
            is_sparse,
            is_reparse_point,
            reparse_tag,
            owner,
        })
    }
}

// NAPI bindings
#[napi]
impl SpaceAnalyzer {
    #[napi(constructor)]
    pub fn new_napi() -> Self {
        Self::new()
    }

    #[napi]
    pub fn categorize_file_napi(&self, filename: String) -> String {
        let extension = Path::new(&filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");

        self.categorize_file(extension).to_string()
    }
}

#[napi]
pub fn get_system_info() -> String {
    let info = serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "target": std::env::consts::ARCH,
        "num_cpus": num_cpus::get(),
    });

    info.to_string()
}
