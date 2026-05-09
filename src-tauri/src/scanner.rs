use crate::{FileInfo, ScanProgress};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
// No unused imports - Instant removed as it's unused
use walkdir::WalkDir;

pub struct FileScanner;

#[derive(Debug, Clone)]
pub struct ScanResult {
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub file_types: HashMap<String, u64>,
    pub largest_files: Vec<FileInfo>,
    pub empty_directories: Vec<String>,
    pub errors: Vec<String>,
}

impl FileScanner {
    pub fn new() -> Self {
        Self
    }

    pub fn scan_directory_sync(&self, path: &str) -> anyhow::Result<ScanResult> {
        let mut result = ScanResult {
            total_files: 0,
            total_directories: 0,
            total_size: 0,
            file_types: HashMap::new(),
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
        };

        // Track directories that might be empty
        let mut dir_entries_count: HashMap<String, u64> = HashMap::new();

        // Process walkdir entries lazily instead of collecting all into memory
        for entry_result in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            let path = entry_result.path();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let path_str = path.to_string_lossy().to_string();
                    let error_msg = if e.io_error().map(|io_err| io_err.kind()) == Some(std::io::ErrorKind::PermissionDenied) {
                        format!("Permission denied accessing metadata: {}", path_str)
                    } else {
                        format!("Failed to get metadata for {}: {}", path_str, e)
                    };
                    result.errors.push(error_msg);
                    continue;
                }
            };

            if metadata.is_file() {
                result.total_files += 1;
                let size = metadata.len();
                result.total_size += size;

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                *result.file_types.entry(ext.clone()).or_insert(0) += 1;

                // Track largest files (keep top 100 largest)
                if result.largest_files.len() < 100 || size > result.largest_files.last().map(|f| f.size).unwrap_or(0) {
                    let file_info = FileInfo {
                        path: path.to_string_lossy().to_string(),
                        name: path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string(),
                        size,
                        modified: metadata.modified().ok().map(|t| {
                            let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                            chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)
                                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                .unwrap_or_default()
                        }),
                        file_type: "file".to_string(),
                        extension: ext.clone(),
                    };
                    result.largest_files.push(file_info);
                    // Sort by size descending and keep top 100
                    result.largest_files.sort_by(|a, b| b.size.cmp(&a.size));
                    result.largest_files.truncate(100);
                }
            } else if metadata.is_dir() {
                result.total_directories += 1;
                // Track parent directory entries to detect empty directories
                if let Some(parent) = path.parent() {
                    let parent_str = parent.to_string_lossy().to_string();
                    *dir_entries_count.entry(parent_str).or_insert(0) += 1;
                }
            }
        }

        // Detect empty directories (directories with no file children)
        // WalkDir includes the root directory itself, skip it
        for entry_result in WalkDir::new(path)
            .min_depth(1)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry_result.path();
            if path.is_dir() {
                let path_str = path.to_string_lossy().to_string();
                // Check if directory has any entries tracked
                let has_entries = dir_entries_count.get(&path_str).copied().unwrap_or(0);
                // Recount by checking if directory is actually empty
                if has_entries == 0 {
                    if std::fs::read_dir(path).map(|mut d| d.next().is_none()).unwrap_or(false) {
                        result.empty_directories.push(path_str);
                    }
                }
            }
        }

        Ok(result)
    }

    pub async fn scan_directory_with_progress<F>(
        &self,
        path: &str,
        progress_callback: F,
        cancel_flag: &AtomicBool,
    ) -> anyhow::Result<ScanResult>
    where
        F: Fn(ScanProgress) + Send + 'static,
    {
        let result = Arc::new(Mutex::new(ScanResult {
            total_files: 0,
            total_directories: 0,
            total_size: 0,
            file_types: HashMap::new(),
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
        }));

        let result_clone = result.clone();
        let progress_callback = Arc::new(progress_callback);
        let callback = progress_callback.clone();
        let cancel = cancel_flag.clone();

        let total_entries = Arc::new(AtomicU64::new(0));
        let processed_entries = Arc::new(AtomicU64::new(0));
        let total_entries_clone = total_entries.clone();

        // First pass: count total entries for progress percentage
        for _entry_result in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if cancel.load(Ordering::Relaxed) {
                return Err(anyhow::anyhow!("Scan cancelled"));
            }
            total_entries.fetch_add(1, Ordering::Relaxed);
        }

        // Second pass: process entries lazily
        for entry_result in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if cancel.load(Ordering::Relaxed) {
                return Err(anyhow::anyhow!("Scan cancelled"));
            }

            let path = entry_result.path();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let mut r = result_clone.lock().unwrap();
                    r.errors.push(format!("Failed to get metadata for {}: {}", path.to_string_lossy(), e));
                    continue;
                }
            };

            if metadata.is_file() {
                let mut r = result_clone.lock().unwrap();
                r.total_files += 1;
                let size = metadata.len();
                r.total_size += size;

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                *r.file_types.entry(ext.clone()).or_insert(0) += 1;

                // Track largest files
                if r.largest_files.len() < 100 || size > r.largest_files.last().map(|f| f.size).unwrap_or(0) {
                    let file_info = FileInfo {
                        path: path.to_string_lossy().to_string(),
                        name: path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string(),
                        size,
                        modified: metadata.modified().ok().map(|t| {
                            let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                            chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)
                                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                .unwrap_or_default()
                        }),
                        file_type: "file".to_string(),
                        extension: ext.clone(),
                    };
                    r.largest_files.push(file_info);
                    r.largest_files.sort_by(|a, b| b.size.cmp(&a.size));
                    r.largest_files.truncate(100);
                }
            } else if metadata.is_dir() {
                let mut r = result_clone.lock().unwrap();
                r.total_directories += 1;
            }

            let processed = processed_entries.fetch_add(1, Ordering::Relaxed) + 1;
            let total = total_entries_clone.load(Ordering::Relaxed);

            let progress = ScanProgress {
                files_scanned: processed,
                directories_scanned: 0,
                total_size: 0,
                current_file: path.to_string_lossy().to_string(),
                percentage: if total > 0 {
                    (processed as f32 / total as f32) * 100.0
                } else {
                    0.0
                },
                completed: false,
            };

            callback(progress);
        }

        // Final progress update
        {
            let r = result.lock().unwrap();
            callback(ScanProgress {
                files_scanned: r.total_files,
                directories_scanned: r.total_directories,
                total_size: r.total_size,
                current_file: "Complete".to_string(),
                percentage: 100.0,
                completed: true,
            });
        } // Drop the lock before unwrapping

        let r = Arc::try_unwrap(result).unwrap().into_inner().unwrap();
        Ok(r)
    }
}