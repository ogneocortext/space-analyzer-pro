use crate::{FileInfo, ScanProgress};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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

        let _start_time = Instant::now();

        // Collect WalkDir entries including errors
        let entries: Vec<_> = WalkDir::new(path).into_iter().collect();

        for entry_result in entries {
            let entry = match entry_result {
                Ok(e) => e,
                Err(e) => {
                    // Categorize the error
                    let error_msg = if e.io_error().map(|io| io.kind() == std::io::ErrorKind::PermissionDenied).unwrap_or(false) {
                        format!("Permission denied: {}", e)
                    } else if e.io_error().map(|io| io.kind() == std::io::ErrorKind::NotFound).unwrap_or(false) {
                        format!("Path not found: {}", e)
                    } else {
                        format!("Access error: {}", e)
                    };
                    result.errors.push(error_msg);
                    continue;
                }
            };
            let path = entry.path();
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(e) => {
                    // Log metadata errors with context
                    let path_str = path.to_string_lossy().to_string();
                    let error_msg = if e.kind() == std::io::ErrorKind::PermissionDenied {
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
                    .unwrap_or("no_extension")
                    .to_lowercase();
                *result.file_types.entry(ext.clone()).or_insert(0) += 1;

                if result.largest_files.len() < 100 {
                    let file_info = FileInfo {
                        path: path.to_string_lossy().to_string(),
                        name: path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string(),
                        size,
                        modified: metadata
                            .modified()
                            .ok()
                            .and_then(|t| {
                                let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                                let datetime =
                                    chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)?;
                                Some(datetime.format("%Y-%m-%d %H:%M:%S").to_string())
                            }),
                        file_type: ext.clone(),
                        extension: ext,
                    };
                    result.largest_files.push(file_info);
                }
            } else if metadata.is_dir() {
                result.total_directories += 1;

                let is_empty = std::fs::read_dir(path)
                    .map(|mut iter| iter.next().is_none())
                    .unwrap_or(false);

                if is_empty {
                    result.empty_directories.push(path.to_string_lossy().to_string());
                }
            }
        }

        result.largest_files.sort_by(|a, b| b.size.cmp(&a.size));
        result.largest_files.truncate(50);

        Ok(result)
    }

    pub async fn scan_directory_with_progress<F>(
        &self,
        path: &str,
        progress_callback: F,
        cancel_flag: &AtomicBool,
    ) -> anyhow::Result<ScanResult>
    where
        F: Fn(ScanProgress) + Send + Sync + 'static,
    {
        let total_files = Arc::new(AtomicU64::new(0));
        let total_dirs = Arc::new(AtomicU64::new(0));
        let total_size = Arc::new(AtomicU64::new(0));
        let file_types = Arc::new(Mutex::new(HashMap::<String, u64>::new()));
        let largest_files = Arc::new(Mutex::new(Vec::<FileInfo>::new()));
        let empty_dirs = Arc::new(Mutex::new(Vec::<String>::new()));
        let errors = Arc::new(Mutex::new(Vec::<String>::new()));

        // Collect WalkDir entries including errors for proper error tracking
        let entries: Vec<_> = WalkDir::new(path).into_iter().collect();

        let total_entries = entries.len();

        // Adaptive batching: update every 1% of entries, max 100 updates, min 50ms apart
        let update_interval = (total_entries / 100).max(1).min(1000);
        let min_update_interval = Duration::from_millis(50);
        let mut last_update = Instant::now();
        let mut files_since_update = 0u64;

        let progress_callback = Arc::new(progress_callback);

        for (idx, entry_result) in entries.into_iter().enumerate() {
            // Handle WalkDir errors
            let entry = match entry_result {
                Ok(e) => e,
                Err(e) => {
                    let error_msg = if e.io_error().map(|io| io.kind() == std::io::ErrorKind::PermissionDenied).unwrap_or(false) {
                        format!("Permission denied: {}", e)
                    } else if e.io_error().map(|io| io.kind() == std::io::ErrorKind::NotFound).unwrap_or(false) {
                        format!("Path not found: {}", e)
                    } else {
                        format!("Access error: {}", e)
                    };
                    errors.lock().unwrap().push(error_msg);
                    continue;
                }
            };
            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let path = entry.path();
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(e) => {
                    errors
                        .lock()
                        .unwrap()
                        .push(format!("{}: {}", path.display(), e));
                    continue;
                }
            };

            // Update counters FIRST, then report progress
            if metadata.is_file() {
                total_files.fetch_add(1, Ordering::Relaxed);
                let size = metadata.len();
                total_size.fetch_add(size, Ordering::Relaxed);

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("no_extension")
                    .to_lowercase();

                {
                    let mut types = file_types.lock().unwrap();
                    *types.entry(ext.clone()).or_insert(0) += 1;
                }

                {
                    let mut files = largest_files.lock().unwrap();
                    if files.len() < 100 {
                        let file_info = FileInfo {
                            path: path.to_string_lossy().to_string(),
                            name: path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_string(),
                            size,
                            modified: metadata
                                .modified()
                                .ok()
                                .and_then(|t| {
                                    let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                                    let datetime =
                                        chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)?;
                                    Some(datetime.format("%Y-%m-%d %H:%M:%S").to_string())
                                }),
                            file_type: ext.clone(),
                            extension: ext,
                        };
                        files.push(file_info);
                    }
                }
            } else if metadata.is_dir() {
                total_dirs.fetch_add(1, Ordering::Relaxed);

                let is_empty = match std::fs::read_dir(path) {
                    Ok(mut iter) => iter.next().is_none(),
                    Err(_) => false,
                };

                if is_empty {
                    empty_dirs
                        .lock()
                        .unwrap()
                        .push(path.to_string_lossy().to_string());
                }
            }

            // Adaptive progress emission
            files_since_update += 1;
            let should_emit = files_since_update >= update_interval as u64
                || last_update.elapsed() >= min_update_interval
                || idx == total_entries.saturating_sub(1);

            if should_emit {
                let percentage = (((idx + 1) as f32 / total_entries as f32) * 100.0).min(100.0);
                let progress = ScanProgress {
                    files_scanned: total_files.load(Ordering::Relaxed),
                    directories_scanned: total_dirs.load(Ordering::Relaxed),
                    total_size: total_size.load(Ordering::Relaxed),
                    current_file: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                    percentage,
                    completed: false,
                };
                progress_callback(progress);
                files_since_update = 0;
                last_update = Instant::now();
            }
        }

        let final_progress = ScanProgress {
            files_scanned: total_files.load(Ordering::Relaxed),
            directories_scanned: total_dirs.load(Ordering::Relaxed),
            total_size: total_size.load(Ordering::Relaxed),
            current_file: "Analysis complete".to_string(),
            percentage: 100.0,
            completed: true,
        };
        progress_callback(final_progress);

        let mut files = largest_files.lock().unwrap();
        files.sort_by(|a, b| b.size.cmp(&a.size));
        files.truncate(50);
        let largest_files_vec = files.clone();
        drop(files);

        let file_types_map = file_types.lock().unwrap().clone();
        let empty_dirs_vec = empty_dirs.lock().unwrap().clone();
        let errors_vec = errors.lock().unwrap().clone();

        Ok(ScanResult {
            total_files: total_files.load(Ordering::Relaxed),
            total_directories: total_dirs.load(Ordering::Relaxed),
            total_size: total_size.load(Ordering::Relaxed),
            file_types: file_types_map,
            largest_files: largest_files_vec,
            empty_directories: empty_dirs_vec,
            errors: errors_vec,
        })
    }
}

impl Default for FileScanner {
    fn default() -> Self {
        Self::new()
    }
}
