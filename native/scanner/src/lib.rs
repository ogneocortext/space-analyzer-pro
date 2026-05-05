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

// Include the new scanner modules
#[cfg(windows)]
pub mod windows_errors;

#[cfg(windows)]
pub mod windows_advanced;

#[cfg(windows)]
pub mod ntfs_mft_scanner;

#[cfg(windows)]
pub mod usn_journal_scanner;

// Re-use existing structures from main.rs
#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: FileSize,
    pub extension: String,
    pub category: String,
    pub timestamps: FileTimestamps,
    pub is_hidden: bool,
    pub is_directory: bool,
    pub is_hard_link: bool,
    pub hard_link_count: Option<i32>,
    pub attributes: FileAttributes,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct FileSize {
    pub bytes: i64,
    pub formatted: String,
    pub on_disk: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct FileTimestamps {
    pub created: Option<String>,
    pub modified: String,
    pub accessed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct FileAttributes {
    pub is_readonly: bool,
    pub is_hidden: bool,
    pub is_system: bool,
    // Windows API fields
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
                collected_size += file_info.size.bytes;

                let cat_info = collected_categories
                    .entry(file_info.category.clone())
                    .or_insert(CategoryStats { count: 0, size: 0 });
                cat_info.count += 1;
                cat_info.size += file_info.size.bytes;

                let ext_info = collected_extensions
                    .entry(file_info.extension.clone())
                    .or_insert(ExtensionStats { count: 0, size: 0 });
                ext_info.count += 1;
                ext_info.size += file_info.size.bytes;

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

    // Helper function to format file size
    fn format_size(&self, bytes: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];
        let mut size = bytes as f64;
        let mut unit_index = 0;

        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }

        if unit_index == 0 {
            format!("{} {}", bytes, UNITS[unit_index])
        } else {
            format!("{:.1} {}", size, UNITS[unit_index])
        }
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
            use std::os::windows::ffi::OsStrExt;
            use std::os::windows::fs::MetadataExt;
            use winapi::um::fileapi::{CreateFileW, OPEN_EXISTING, BY_HANDLE_FILE_INFORMATION, GetFileInformationByHandle};
            use winapi::um::handleapi::CloseHandle;
            use winapi::um::winnt::{FILE_SHARE_READ, FILE_SHARE_WRITE, GENERIC_READ, HANDLE,
                                     FILE_ATTRIBUTE_COMPRESSED, FILE_ATTRIBUTE_SPARSE_FILE, FILE_ATTRIBUTE_REPARSE_POINT};

            let attrs = metadata.file_attributes();
            let is_compressed = (attrs & FILE_ATTRIBUTE_COMPRESSED) != 0;
            let is_sparse = (attrs & FILE_ATTRIBUTE_SPARSE_FILE) != 0;
            let is_reparse_point = (attrs & FILE_ATTRIBUTE_REPARSE_POINT) != 0;

            // Get hard link count via GetFileInformationByHandle
            let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
            let (nlinks, created_time, accessed_time) = unsafe {
                let handle: HANDLE = CreateFileW(
                    wide_path.as_ptr(),
                    GENERIC_READ,
                    FILE_SHARE_READ | FILE_SHARE_WRITE,
                    std::ptr::null_mut(),
                    OPEN_EXISTING,
                    0,
                    std::ptr::null_mut(),
                );

                if handle.is_null() || handle == winapi::um::handleapi::INVALID_HANDLE_VALUE {
                    (1u32, None, None)
                } else {
                    let mut file_info: BY_HANDLE_FILE_INFORMATION = std::mem::zeroed();
                    let result = GetFileInformationByHandle(handle, &mut file_info);
                    CloseHandle(handle);

                    if result != 0 {
                        // Convert FILETIME to seconds string for created/accessed
                        let ft_to_secs = |ft: winapi::shared::minwindef::FILETIME| -> Option<String> {
                            let ft_64 = ((ft.dwHighDateTime as u64) << 32) | (ft.dwLowDateTime as u64);
                            if ft_64 == 0 { return None; }
                            let secs_since_1601 = ft_64 / 10_000_000;
                            let secs_since_unix = secs_since_1601 as i64 - 11_644_473_600i64;
                            Some(secs_since_unix.to_string())
                        };

                        (
                            file_info.nNumberOfLinks,
                            ft_to_secs(file_info.ftCreationTime),
                            ft_to_secs(file_info.ftLastAccessTime),
                        )
                    } else {
                        (1u32, None, None)
                    }
                }
            };

            let is_hard_link = nlinks > 1;
            let hard_link_count = if is_hard_link { Some(nlinks as i32) } else { None };

            (created_time, accessed_time, is_hard_link, hard_link_count, false, None::<i32>, is_compressed, None::<i64>, is_sparse, is_reparse_point, None::<String>, None::<String>)
        };

        #[cfg(not(windows))]
        let (created, accessed, is_hard_link, hard_link_count, has_ads, ads_count, is_compressed, compressed_size, is_sparse, is_reparse_point, reparse_tag, owner) = {
            (None::<String>, None::<String>, false, None::<i32>, false, None::<i32>, false, None::<i64>, false, false, None::<String>, None::<String>)
        };

        Some(FileInfo {
            name: file_name,
            path: file_path_str,
            size: FileSize {
                bytes: metadata.len() as i64,
                formatted: self.format_size(metadata.len() as u64),
                on_disk: compressed_size,
            },
            extension,
            category,
            timestamps: FileTimestamps {
                created,
                modified,
                accessed,
            },
            is_hidden: entry.file_name().to_string_lossy().starts_with('.'),
            is_directory: metadata.is_dir(),
            is_hard_link,
            hard_link_count,
            attributes: FileAttributes {
                is_readonly: metadata.permissions().readonly(),
                is_hidden: entry.file_name().to_string_lossy().starts_with('.'),
                is_system: false,
                has_ads,
                ads_count,
                is_compressed,
                compressed_size,
                is_sparse,
                is_reparse_point,
                reparse_tag,
                owner,
            },
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
