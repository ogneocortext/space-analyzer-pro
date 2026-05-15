//! Shared file scanner library for Space Analyzer Pro
//! 
//! This crate provides a unified, high-performance file scanner
//! that replaces the duplicate implementations across the project.

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

/// File information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: Option<String>,
    pub file_type: String,
    pub extension: String,
}

/// Scan progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub files_scanned: u64,
    pub directories_scanned: u64,
    pub total_size: u64,
    pub current_file: String,
    pub percentage: f32,
    pub completed: bool,
}

/// Scan result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub file_types: HashMap<String, u64>,
    pub extension_sizes: HashMap<String, u64>,
    pub size_distribution: HashMap<String, u64>,
    pub largest_files: Vec<FileInfo>,
    pub empty_directories: Vec<String>,
    pub errors: Vec<String>,
    pub subdirectories: Vec<DirInfo>,
}

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

/// Scan options
#[derive(Debug, Clone)]
pub struct ScanOptions {
    pub max_depth: Option<usize>,
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    pub include_hidden: bool,
    pub follow_symlinks: bool,
    pub size_buckets: bool,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            max_depth: None,
            min_size: None,
            max_size: None,
            include_hidden: false,
            follow_symlinks: false,
            size_buckets: true,
        }
    }
}

impl ScanOptions {
    /// Create options for shallow scan (depth 1)
    pub fn shallow() -> Self {
        Self {
            max_depth: Some(1),
            ..Default::default()
        }
    }

    /// Create options for medium scan (depth 5)
    pub fn medium() -> Self {
        Self {
            max_depth: Some(5),
            ..Default::default()
        }
    }

    /// Create options for deep scan (unlimited depth)
    pub fn deep() -> Self {
        Self {
            max_depth: None,
            ..Default::default()
        }
    }

    /// Filter for large files only (>10MB)
    pub fn large_files_only() -> Self {
        Self {
            min_size: Some(10 * 1024 * 1024),
            ..Default::default()
        }
    }

    /// Filter for small files only (<1MB)
    pub fn small_files_only() -> Self {
        Self {
            max_size: Some(1 * 1024 * 1024),
            ..Default::default()
        }
    }
}

/// Size bucket categorization
fn size_bucket(size: u64) -> &'static str {
    if size == 0 { "0 B" }
    else if size < 1024 { "< 1 KB" }
    else if size < 10 * 1024 { "1-10 KB" }
    else if size < 100 * 1024 { "10-100 KB" }
    else if size < 1024 * 1024 { "100 KB-1 MB" }
    else if size < 10 * 1024 * 1024 { "1-10 MB" }
    else if size < 100 * 1024 * 1024 { "10-100 MB" }
    else if size < 1024 * 1024 * 1024 { "100 MB-1 GB" }
    else { "> 1 GB" }
}

/// Format bytes to human-readable string
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

/// Format duration to human-readable string
pub fn format_duration(seconds: f64) -> String {
    if seconds < 60.0 {
        format!("{:.1}s", seconds)
    } else if seconds < 3600.0 {
        format!("{:.1}m", seconds / 60.0)
    } else {
        format!("{:.1}h", seconds / 3600.0)
    }
}

/// File scanner implementation
pub struct FileScanner;

impl FileScanner {
    pub fn new() -> Self {
        Self
    }

    fn should_include_file(&self, metadata: &std::fs::Metadata, path: &Path, options: &ScanOptions) -> bool {
        // Check hidden files
        if !options.include_hidden {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') {
                    return false;
                }
            }
        }

        let size = metadata.len();

        // Check min size filter
        if let Some(min) = options.min_size {
            if size < min {
                return false;
            }
        }

        // Check max size filter
        if let Some(max) = options.max_size {
            if size > max {
                return false;
            }
        }

        true
    }

    fn format_timestamp(time: std::time::SystemTime) -> Option<String> {
        time.duration_since(std::time::UNIX_EPOCH)
            .ok()
            .and_then(|d| DateTime::from_timestamp(d.as_secs() as i64, 0))
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
    }

    /// Synchronous directory scan with GPU-accelerated post-processing
    /// 
    /// Phase 1 (CPU): I/O-bound directory traversal and metadata collection
    /// Phase 2 (GPU/CPU): Compute-heavy post-processing (extension extraction, histograms, sorting)
    pub fn scan_directory_sync(&self, path: &str, options: ScanOptions) -> anyhow::Result<ScanResult> {
        let mut result = ScanResult {
            total_files: 0,
            total_directories: 0,
            total_size: 0,
            file_types: HashMap::new(),
            extension_sizes: HashMap::new(),
            size_distribution: HashMap::new(),
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
            subdirectories: Vec::new(),
        };

        // ── Phase 1: I/O-bound directory traversal (CPU only) ──
        let mut raw_entries = Vec::new();

        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        for entry_result in walker.into_iter().filter_map(|e| e.ok()) {
            let entry_path = entry_result.path();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let path_str = entry_path.to_string_lossy().to_string();
                    let error_msg = if e.io_error().map(|io_err| io_err.kind()) == Some(std::io::ErrorKind::PermissionDenied) {
                        format!("Permission denied: {}", path_str)
                    } else {
                        format!("Metadata error: {}: {}", path_str, e)
                    };
                    result.errors.push(error_msg);
                    continue;
                }
            };

            let is_dir = metadata.is_dir();
            let size = metadata.len();

            // Apply filters during I/O phase (early rejection saves GPU transfer)
            if !is_dir && !self.should_include_file(&metadata, entry_path, &options) {
                continue;
            }

            raw_entries.push(gpu_compute::scan::RawFileEntry {
                path: entry_path.to_string_lossy().to_string(),
                size,
                is_dir,
            });
        }

        // ── Phase 2: GPU-accelerated post-processing ──
        let gpu_info = gpu_compute::device::GpuInfo::detect();
        let processor = gpu_compute::scan::GpuScanProcessor::new()
            .with_gpu(gpu_info.available)
            .with_top_n(100);

        let gpu_result = processor.process(&raw_entries);

        // Merge GPU results into ScanResult
        result.total_files = gpu_result.total_files;
        result.total_size = gpu_result.total_size;
        result.file_types = gpu_result.file_types;
        result.extension_sizes = gpu_result.extension_sizes;
        result.size_distribution = gpu_result.size_distribution;
        result.empty_directories = gpu_result.empty_dirs;
        result.subdirectories = gpu_result.subdirectories.into_iter()
            .map(|d| DirInfo {
                path: d.path,
                name: d.name,
                total_size: d.total_size,
                file_count: d.file_count,
                dir_count: d.dir_count,
                largest_file_size: d.largest_file_size,
            })
            .collect();

        // Convert GPU file info to FileInfo (add timestamp from metadata lookup)
        for info in gpu_result.largest_files {
            let modified = std::fs::metadata(&info.path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| Self::format_timestamp(t));

            result.largest_files.push(FileInfo {
                path: info.path,
                name: info.name,
                size: info.size,
                modified,
                file_type: "file".to_string(),
                extension: info.extension,
            });
        }

        // Count directories from raw entries
        result.total_directories = raw_entries.iter().filter(|e| e.is_dir).count() as u64;

        Ok(result)
    }

    /// Async scan with progress callbacks
    pub async fn scan_with_progress<F>(
        &self,
        path: &str,
        options: ScanOptions,
        progress_callback: F,
        cancel_flag: &AtomicBool,
    ) -> anyhow::Result<ScanResult>
    where
        F: Fn(ScanProgress) + Send + 'static + Clone,
    {
        let result = Arc::new(Mutex::new(ScanResult {
            total_files: 0,
            total_directories: 0,
            total_size: 0,
            file_types: HashMap::new(),
            extension_sizes: HashMap::new(),
            size_distribution: HashMap::new(),
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
            subdirectories: Vec::new(),
        }));

        let result_clone = result.clone();
        let callback = progress_callback.clone();
        let cancel = cancel_flag;

        let processed_entries = Arc::new(AtomicU64::new(0));
        let processed_entries_clone = processed_entries.clone();

        let current_files = Arc::new(AtomicU64::new(0));
        let current_directories = Arc::new(AtomicU64::new(0));
        let current_size = Arc::new(AtomicU64::new(0));

        let current_files_clone = current_files.clone();
        let current_directories_clone = current_directories.clone();
        let current_size_clone = current_size.clone();

        // Estimate total entries for progress calculation
        let mut total_entries_estimate = 0u64;
        let mut estimate_walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            estimate_walker = estimate_walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            estimate_walker = estimate_walker.follow_links(false);
        }
        for _ in estimate_walker.into_iter().filter_map(|e| e.ok()) {
            if cancel.load(Ordering::Relaxed) {
                return Err(anyhow::anyhow!("Scan cancelled"));
            }
            total_entries_estimate += 1;
            if total_entries_estimate > 10000 {
                break;
            }
        }

        let total_estimate = Arc::new(AtomicU64::new(total_entries_estimate));
        let total_estimate_clone = total_estimate.clone();

        // Main scan loop
        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        for entry_result in walker.into_iter().filter_map(|e| e.ok()) {
            if cancel.load(Ordering::Relaxed) {
                return Err(anyhow::anyhow!("Scan cancelled"));
            }

            let path = entry_result.path();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let mut r = result_clone.lock().unwrap();
                    r.errors.push(format!("Metadata error: {}: {}", path.to_string_lossy(), e));
                    continue;
                }
            };

            let current_file_path = path.to_string_lossy().to_string();
            let is_file = metadata.is_file();
            let is_dir = metadata.is_dir();
            let size = metadata.len();

            let should_process = if is_file {
                self.should_include_file(&metadata, path, &options)
            } else {
                true
            };

            if should_process {
                if is_file {
                    let files_count = current_files_clone.fetch_add(1, Ordering::Relaxed) + 1;
                    let size_count = current_size_clone.fetch_add(size, Ordering::Relaxed) + size;

                    let mut r = result_clone.lock().unwrap();
                    r.total_files = files_count;
                    r.total_size = size_count;

                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    *r.file_types.entry(ext.clone()).or_insert(0) += 1;

                    if options.size_buckets {
                        let bucket = size_bucket(size);
                        *r.size_distribution.entry(bucket.to_string()).or_insert(0) += 1;
                    }

                    if r.largest_files.len() < 100 || size > r.largest_files.last().map(|f| f.size).unwrap_or(0) {
                        let file_info = FileInfo {
                            path: current_file_path.clone(),
                            name: path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
                            size,
                            modified: Self::format_timestamp(metadata.modified().ok().unwrap_or(std::time::SystemTime::UNIX_EPOCH)),
                            file_type: "file".to_string(),
                            extension: ext,
                        };
                        r.largest_files.push(file_info);
                        r.largest_files.sort_by(|a, b| b.size.cmp(&a.size));
                        r.largest_files.truncate(100);
                    }
                } else if is_dir {
                    let dirs_count = current_directories_clone.fetch_add(1, Ordering::Relaxed) + 1;
                    let mut r = result_clone.lock().unwrap();
                    r.total_directories = dirs_count;
                }
            }

            let processed = processed_entries_clone.fetch_add(1, Ordering::Relaxed) + 1;
            let total = total_estimate_clone.load(Ordering::Relaxed);

            if processed > total {
                total_estimate_clone.store(processed + 1000, Ordering::Relaxed);
            }

            let files_scanned = current_files_clone.load(Ordering::Relaxed);
            let directories_scanned = current_directories_clone.load(Ordering::Relaxed);
            let total_size = current_size_clone.load(Ordering::Relaxed);
            let current_total = total_estimate_clone.load(Ordering::Relaxed);

            let progress = ScanProgress {
                files_scanned,
                directories_scanned,
                total_size,
                current_file: if should_process { current_file_path } else { "Skipping".to_string() },
                percentage: if current_total > 0 {
                    ((processed as f32 / current_total as f32) * 100.0).min(99.0)
                } else {
                    0.0
                },
                completed: false,
            };

            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                callback(progress);
            }));
        }

        // Final progress update
        {
            let r = result.lock().unwrap();
            let final_progress = ScanProgress {
                files_scanned: r.total_files,
                directories_scanned: r.total_directories,
                total_size: r.total_size,
                current_file: "Complete".to_string(),
                percentage: 100.0,
                completed: true,
            };

            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                callback(final_progress);
            }));
        }

        let r = Arc::try_unwrap(result).unwrap().into_inner().unwrap();
        Ok(r)
    }
}

/// Get system information
pub fn get_system_info() -> SystemInfo {
    use sysinfo::{System, Disks, RefreshKind, MemoryRefreshKind, CpuRefreshKind};

    let mut system = System::new_with_specifics(
        RefreshKind::nothing()
            .with_memory(MemoryRefreshKind::everything())
            .with_cpu(CpuRefreshKind::everything()),
    );
    system.refresh_memory();
    system.refresh_cpu_all();

    let disks = Disks::new_with_refreshed_list();
    let drives = disks.iter().map(|disk| DriveInfo {
        name: disk.name().to_string_lossy().to_string(),
        mount_point: disk.mount_point().to_string_lossy().to_string(),
        file_system: disk.file_system().to_string_lossy().to_string(),
        total_space: disk.total_space(),
        available_space: disk.available_space(),
        is_removable: false,
    }).collect();

    SystemInfo {
        os: System::long_os_version().unwrap_or_else(|| "Unknown".to_string()),
        arch: std::env::consts::ARCH.to_string(),
        total_memory: system.total_memory(),
        available_memory: system.available_memory(),
        cpu_cores: system.cpus().len(),
        drives,
    }
}

/// System information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub total_memory: u64,
    pub available_memory: u64,
    pub cpu_cores: usize,
    pub drives: Vec<DriveInfo>,
}

/// Drive information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveInfo {
    pub name: String,
    pub mount_point: String,
    pub file_system: String,
    pub total_space: u64,
    pub available_space: u64,
    pub is_removable: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1048576), "1.00 MB");
        assert_eq!(format_bytes(1073741824), "1.00 GB");
    }

    #[test]
    fn test_size_bucket() {
        assert_eq!(size_bucket(0), "0 B");
        assert_eq!(size_bucket(512), "< 1 KB");
        assert_eq!(size_bucket(1024 * 1024), "100 KB-1 MB");
        assert_eq!(size_bucket(1024 * 1024 * 1024), "100 MB-1 GB");
    }

    #[test]
    fn test_scan_options_defaults() {
        let opts = ScanOptions::default();
        assert!(opts.max_depth.is_none());
        assert!(!opts.include_hidden);
        assert!(!opts.follow_symlinks);
    }

    #[test]
    fn test_scan_options_presets() {
        let shallow = ScanOptions::shallow();
        assert_eq!(shallow.max_depth, Some(1));

        let medium = ScanOptions::medium();
        assert_eq!(medium.max_depth, Some(5));

        let deep = ScanOptions::deep();
        assert!(deep.max_depth.is_none());
    }
}
