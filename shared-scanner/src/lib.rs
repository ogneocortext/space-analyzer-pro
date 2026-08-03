//! Shared file scanner library for Space Analyzer Pro
//!
//! This crate provides a unified, high-performance file scanner
//! that replaces the duplicate implementations across the project.

use rayon::prelude::*;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

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
    /// Live list of files found so far (updated during scan for real-time visibility)
    pub live_files: Vec<FileInfo>,
    /// Cumulative file-type counts discovered so far (extension -> file count)
    pub file_type_counts: HashMap<String, u64>,
    /// Cumulative extension sizes discovered so far (extension -> total bytes)
    pub extension_sizes: HashMap<String, u64>,
    /// Cumulative category sizes discovered so far (category name -> total bytes)
    pub category_sizes: HashMap<String, u64>,
}

/// Map a file extension to a high-level storage category.
/// This mirrors the FILE_CATEGORIES mapping in space_analyzer_pro_desktop::category
/// but is kept here so shared-scanner can compute categories without depending
/// on the main crate.
fn extension_to_category(ext: &str) -> &'static str {
    match ext {
        "txt" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods"
        | "odp" | "rtf" | "md" | "csv" => "Documents",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "ico" | "tiff" | "tif" => {
            "Images"
        }
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpeg" | "mpg" => {
            "Videos"
        }
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" => "Audio",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "cab" => "Archives",
        "js" | "ts" | "py" | "java" | "c" | "cpp" | "h" | "hpp" | "cs" | "go" | "rs" | "php" | "rb"
        | "swift" | "kt" | "scala" | "html" | "css" | "scss" | "sass" | "less" | "json" | "xml"
        | "yaml" | "yml" => "Code",
        "db" | "sqlite" | "sql" | "mdb" | "accdb" => "Databases",
        "exe" | "msi" | "bat" | "cmd" | "sh" | "ps1" | "app" | "dmg" | "deb" | "rpm" => {
            "Executables"
        }
        "dll" | "sys" | "drv" | "fon" | "ttf" | "otf" | "log" | "tmp" => "System",
        "gradle" | "maven" | "node_modules" | "venv" | "env" | "dist" | "build" => "Development",
        "sav" | "save" | "game" => "Games",
        "" => "Other",
        _ => "Other",
    }
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
    /// Map of scanned file paths to (size, mtime_unix) for incremental caching
    pub scanned_files: HashMap<String, (u64, i64)>,
    /// Storage usage by high-level category (populated alongside file_types during scan)
    #[serde(default)]
    pub category_sizes: HashMap<String, u64>,
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
    /// Enable GPU-accelerated post-processing (histograms, sorting)
    pub gpu_acceleration: bool,
    /// Enable CUDA-specific kernels (requires cudarc at compile time)
    pub cuda_enabled: bool,
    /// Number of threads for parallel post-processing (0 = auto-detect)
    pub num_threads: usize,
    /// Optional file cache (path -> (size, mtime_unix)) for skipping unchanged files
    pub file_cache: Option<HashMap<String, (u64, i64)>>,
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
            gpu_acceleration: true,
            cuda_enabled: false,
            num_threads: 0,
            file_cache: None,
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
            max_size: Some(1024 * 1024),
            ..Default::default()
        }
    }

    /// Enable or disable GPU acceleration
    pub fn with_gpu(mut self, enabled: bool) -> Self {
        self.gpu_acceleration = enabled;
        self
    }

    /// Enable or disable CUDA-specific kernels
    pub fn with_cuda(mut self, enabled: bool) -> Self {
        self.cuda_enabled = enabled;
        self
    }
}

/// Size bucket categorization
fn size_bucket(size: u64) -> &'static str {
    if size == 0 {
        "0 B"
    } else if size < 1024 {
        "< 1 KB"
    } else if size < 10 * 1024 {
        "1-10 KB"
    } else if size < 100 * 1024 {
        "10-100 KB"
    } else if size < 1024 * 1024 {
        "100 KB-1 MB"
    } else if size < 10 * 1024 * 1024 {
        "1-10 MB"
    } else if size < 100 * 1024 * 1024 {
        "10-100 MB"
    } else if size < 1024 * 1024 * 1024 {
        "100 MB-1 GB"
    } else {
        "> 1 GB"
    }
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

impl Default for FileScanner {
    fn default() -> Self {
        Self::new()
    }
}

impl FileScanner {
    pub fn new() -> Self {
        Self
    }

    /// Parallel SSD-optimized scan using Rayon thread pool.
    /// On SATA SSDs: ~2-3x faster (13k → 30k+ files/sec).
    /// On NVMe SSDs: ~3-5x faster (13k → 50k+ files/sec).
    pub fn scan_directory_parallel(
        &self,
        path: &str,
        options: ScanOptions,
    ) -> anyhow::Result<ScanResult> {
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
            scanned_files: HashMap::new(),
            category_sizes: HashMap::new(),
        };

        // Use physical cores for I/O-bound parallelism (hyperthreads add overhead).
        // Respect options.num_threads if explicitly set.
        let num_threads = if options.num_threads > 0 {
            options.num_threads
        } else {
            num_cpus::get_physical().max(2)
        };
        let thread_pool = rayon::ThreadPoolBuilder::new()
            .num_threads(num_threads)
            .build()
            .unwrap();

        let walk_entries: Vec<walkdir::DirEntry> = WalkDir::new(path)
            .max_depth(options.max_depth.unwrap_or(usize::MAX))
            .into_iter()
            .filter_map(|e| e.ok())
            .collect();

        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        type RawEntry = (String, u64, bool, Option<(u64, i64)>);
        let raw_entries_data: Vec<RawEntry> = thread_pool.install(|| {
            walk_entries
                .into_par_iter()
                .filter_map(|entry| {
                    let entry_path = entry.path();
                    let path_str = entry_path.to_string_lossy().to_string();
                    let metadata = match entry.metadata() {
                        Ok(m) => m,
                        Err(_) => return None,
                    };
                    let is_dir = metadata.is_dir();
                    let size = metadata.len();
                    let mtime = Self::get_mtime_unix(&metadata);

                    if !is_dir {
                        if let Some(cache_map) = options.file_cache.as_ref() {
                            if let Some(&(cached_size, cached_mtime)) = cache_map.get(&path_str) {
                                if cached_size == size && cached_mtime == mtime {
                                    return Some((
                                        path_str,
                                        cached_size,
                                        is_dir,
                                        Some((cached_size, cached_mtime)),
                                    ));
                                }
                            }
                        }
                    }

                    if !is_dir && !self.should_include_file(&metadata, entry_path, &options) {
                        return None;
                    }

                    Some((path_str, size, is_dir, Some((size, mtime))))
                })
                .collect()
        });

        let mut scanned_files = HashMap::new();
        let raw_entries: Vec<gpu_compute::scan::RawFileEntry> = raw_entries_data
            .into_iter()
            .map(|(path_str, size, is_dir, cache_info)| {
                if let Some((size, mtime)) = cache_info {
                    scanned_files.insert(path_str.clone(), (size, mtime));
                }
                gpu_compute::scan::RawFileEntry {
                    path: path_str,
                    size,
                    is_dir,
                }
            })
            .collect();

        let use_gpu = options.gpu_acceleration && gpu_compute::device::GpuInfo::is_available();
        let processor = gpu_compute::scan::GpuScanProcessor::new()
            .with_gpu(use_gpu)
            .with_scan_root(path)
            .with_top_n(100);

        let gpu_result = processor.process(&raw_entries);

        result.total_files = gpu_result.total_files;
        result.total_size = gpu_result.total_size;
        result.file_types = gpu_result.file_types;
        result.extension_sizes = gpu_result.extension_sizes;
        result.size_distribution = gpu_result.size_distribution;
        result.empty_directories = true_empty_dirs;
        result.subdirectories = gpu_result
            .subdirectories
            .into_iter()
            .map(|d| DirInfo {
                path: d.path,
                name: d.name,
                total_size: d.total_size,
                file_count: d.file_count,
                dir_count: d.dir_count,
                largest_file_size: d.largest_file_size,
            })
            .collect();

        result.total_directories = raw_entries.iter().filter(|e| e.is_dir).count() as u64;

        result.scanned_files = scanned_files;

        Ok(result)
    }

    fn should_include_file(
        &self,
        metadata: &std::fs::Metadata,
        path: &Path,
        options: &ScanOptions,
    ) -> bool {
        // Check hidden files
        if !options.include_hidden && Self::is_hidden(path, metadata) {
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

    fn is_hidden(path: &Path, metadata: &std::fs::Metadata) -> bool {
        if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.'))
        {
            return true;
        }

        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
        }

        #[cfg(not(windows))]
        {
            let _ = metadata;
            false
        }
    }

    fn compute_true_empty_dirs(walk_entries: &[walkdir::DirEntry]) -> Vec<String> {
        use std::collections::{HashMap, HashSet};

        let mut all_dirs: HashSet<String> = HashSet::new();
        let mut child_counts: HashMap<String, usize> = HashMap::new();

        for entry in walk_entries {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            if entry.metadata().map(|m| m.is_dir()).unwrap_or(false) {
                all_dirs.insert(path_str);
            }

            if let Some(parent) = path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                *child_counts.entry(parent_str).or_insert(0) += 1;
            }
        }

        all_dirs
            .into_iter()
            .filter(|dir| *child_counts.get(dir).unwrap_or(&0) == 0)
            .collect()
    }

    fn format_timestamp(time: std::time::SystemTime) -> Option<String> {
        time.duration_since(std::time::UNIX_EPOCH)
            .ok()
            .and_then(|d| DateTime::from_timestamp(d.as_secs() as i64, 0))
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
    }

    fn get_mtime_unix(metadata: &std::fs::Metadata) -> i64 {
        metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    }

    /// Synchronous directory scan with GPU-accelerated post-processing
    ///
    /// Phase 1 (CPU): I/O-bound directory traversal and metadata collection
    /// Phase 2 (GPU/CPU): Compute-heavy post-processing (extension extraction, histograms, sorting)
    pub fn scan_directory_sync(
        &self,
        path: &str,
        options: ScanOptions,
    ) -> anyhow::Result<ScanResult> {
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
            scanned_files: HashMap::new(),
            category_sizes: HashMap::new(),
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

        let mut walk_entries = Vec::new();
        for entry in walker {
            match entry {
                Ok(entry) => walk_entries.push(entry),
                Err(error) => result.errors.push(format!("Traversal error: {error}")),
            }
        }
        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        let mut scanned_files = HashMap::new();
        for entry_result in walk_entries {
            let entry_path = entry_result.path();
            let path_str = entry_path.to_string_lossy().to_string();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let error_msg = if e.io_error().map(|io_err| io_err.kind())
                        == Some(std::io::ErrorKind::PermissionDenied)
                    {
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
            let mtime = Self::get_mtime_unix(&metadata);

            if !is_dir {
                if let Some(cache_map) = options.file_cache.as_ref() {
                    if let Some(&(cached_size, cached_mtime)) = cache_map.get(&path_str) {
                        if cached_size == size && cached_mtime == mtime {
                            scanned_files.insert(path_str.clone(), (cached_size, cached_mtime));
                            raw_entries.push(gpu_compute::scan::RawFileEntry {
                                path: path_str,
                                size: cached_size,
                                is_dir,
                            });
                            continue;
                        }
                    }
                }
            }

            // Apply filters during I/O phase (early rejection saves GPU transfer)
            if !is_dir && !self.should_include_file(&metadata, entry_path, &options) {
                continue;
            }

            scanned_files.insert(path_str.clone(), (size, mtime));
            raw_entries.push(gpu_compute::scan::RawFileEntry {
                path: path_str,
                size,
                is_dir,
            });
        }

        // ── Phase 2: GPU-accelerated post-processing ──
        let use_gpu = options.gpu_acceleration && gpu_compute::device::GpuInfo::is_available();
        let processor = gpu_compute::scan::GpuScanProcessor::new()
            .with_gpu(use_gpu)
            .with_scan_root(path)
            .with_top_n(100);

        let gpu_result = processor.process(&raw_entries);

        Self::apply_gpu_result(
            &mut result,
            gpu_result,
            &raw_entries,
            true_empty_dirs,
            scanned_files,
        );

        Ok(result)
    }

    /// Merge GPU post-processing results into a ScanResult.
    ///
    /// This is shared between `scan_directory_sync` and `scan_with_progress_sync`
    /// to avoid duplicating the categorization / top-N / subdirectory logic.
    fn apply_gpu_result(
        result: &mut ScanResult,
        gpu_result: gpu_compute::scan::GpuScanResult,
        raw_entries: &[gpu_compute::scan::RawFileEntry],
        true_empty_dirs: Vec<String>,
        scanned_files: HashMap<String, (u64, i64)>,
    ) {
        result.total_files = gpu_result.total_files;
        result.total_size = gpu_result.total_size;
        result.file_types = gpu_result.file_types;
        result.extension_sizes = gpu_result.extension_sizes;
        result.size_distribution = gpu_result.size_distribution;
        result.empty_directories = true_empty_dirs;
        result.subdirectories = gpu_result
            .subdirectories
            .into_iter()
            .map(|d| DirInfo {
                path: d.path,
                name: d.name,
                total_size: d.total_size,
                file_count: d.file_count,
                dir_count: d.dir_count,
                largest_file_size: d.largest_file_size,
            })
            .collect();

        for info in gpu_result.largest_files {
            let modified = std::fs::metadata(&info.path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(Self::format_timestamp);

            result.largest_files.push(FileInfo {
                path: info.path,
                name: info.name,
                size: info.size,
                modified,
                file_type: "file".to_string(),
                extension: info.extension,
            });
        }

        result.total_directories = raw_entries.iter().filter(|e| e.is_dir).count() as u64;
        result.scanned_files = scanned_files;
    }

    /// Synchronous scan with progress callbacks and cancellation support.
    /// Returns partial results on cancellation instead of an error.
    pub fn scan_with_progress_sync<F>(
        &self,
        path: &str,
        options: ScanOptions,
        progress_callback: F,
        cancel_flag: &AtomicBool,
    ) -> anyhow::Result<ScanResult>
    where
        F: Fn(ScanProgress) + Send + 'static + Clone,
    {
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
            scanned_files: HashMap::new(),
            category_sizes: HashMap::new(),
        };

        let mut raw_entries: Vec<gpu_compute::scan::RawFileEntry> = Vec::new();
        let mut live_files: Vec<FileInfo> = Vec::new();
        let mut files_scanned: u64 = 0;
        let mut dirs_scanned: u64 = 0;
        let mut current_size: u64 = 0;
        let mut scanned_files = HashMap::new();
        let mut file_type_counts: HashMap<String, u64> = HashMap::new();
        let mut extension_sizes_acc: HashMap<String, u64> = HashMap::new();
        let mut category_sizes_acc: HashMap<String, u64> = HashMap::new();

        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        // Avoid a second full directory walk just to estimate progress. The
        // estimate is deliberately conservative and grows as entries arrive.
        let total_estimate = 1000u64;

        let mut entries_processed: u64 = 0;

        let walk_entries: Vec<walkdir::DirEntry> =
            walker.into_iter().filter_map(|e| e.ok()).collect();
        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        for entry_result in walk_entries {
            if cancel_flag.load(Ordering::Relaxed) {
                let use_gpu = options.gpu_acceleration && gpu_compute::device::GpuInfo::is_available();
                let processor = gpu_compute::scan::GpuScanProcessor::new()
                    .with_gpu(use_gpu)
                    .with_scan_root(path)
                    .with_top_n(100);

                let gpu_result = processor.process(&raw_entries);

                result.total_files = gpu_result.total_files;
                result.total_size = gpu_result.total_size;
                result.file_types = gpu_result.file_types;
                result.extension_sizes = gpu_result.extension_sizes;
                result.size_distribution = gpu_result.size_distribution;
                result.empty_directories = true_empty_dirs;
                result.subdirectories = gpu_result
                    .subdirectories
                    .into_iter()
                    .map(|d| DirInfo {
                        path: d.path,
                        name: d.name,
                        total_size: d.total_size,
                        file_count: d.file_count,
                        dir_count: d.dir_count,
                        largest_file_size: d.largest_file_size,
                    })
                    .collect();

                for info in gpu_result.largest_files {
                    let modified = std::fs::metadata(&info.path)
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(Self::format_timestamp);

                    result.largest_files.push(FileInfo {
                        path: info.path,
                        name: info.name,
                        size: info.size,
                        modified,
                        file_type: "file".to_string(),
                        extension: info.extension,
                    });
                }

                result.total_directories =
                    raw_entries.iter().filter(|e| e.is_dir).count() as u64;
                result.scanned_files = scanned_files;
                result.category_sizes = category_sizes_acc.clone();

                let pct = if total_estimate > 0 {
                    ((entries_processed as f32 / total_estimate as f32) * 100.0).min(99.0)
                } else {
                    0.0
                };
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    progress_callback(ScanProgress {
                        files_scanned: result.total_files,
                        directories_scanned: result.total_directories,
                        total_size: result.total_size,
                        current_file: "Cancelled".to_string(),
                        percentage: pct,
                        completed: true,
                        live_files: live_files.clone(),
                        file_type_counts: file_type_counts.clone(),
                        extension_sizes: extension_sizes_acc.clone(),
                        category_sizes: category_sizes_acc.clone(),
                    });
                }));

                return Ok(result);
            }

            let entry_path = entry_result.path();
            let path_str = entry_path.to_string_lossy().to_string();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let error_msg = if e.io_error().map(|io_err| io_err.kind())
                        == Some(std::io::ErrorKind::PermissionDenied)
                    {
                        format!("Permission denied: {}", path_str)
                    } else {
                        format!("Metadata error: {}: {}", path_str, e)
                    };
                    result.errors.push(error_msg);
                    entries_processed += 1;
                    continue;
                }
            };

            let is_dir = metadata.is_dir();
            let size = metadata.len();
            let mtime = Self::get_mtime_unix(&metadata);

            if !is_dir {
                if let Some(cache_map) = options.file_cache.as_ref() {
                    if let Some(&(cached_size, cached_mtime)) = cache_map.get(&path_str) {
                        if cached_size == size && cached_mtime == mtime {
                            scanned_files.insert(path_str.clone(), (cached_size, cached_mtime));
                            raw_entries.push(gpu_compute::scan::RawFileEntry {
                                path: path_str.clone(),
                                size: cached_size,
                                is_dir,
                            });
                        if is_dir {
                            dirs_scanned += 1;
                        } else {
                            files_scanned += 1;
                            current_size += cached_size;

                            let p = Path::new(&path_str);
                            let ext = p
                                .extension()
                                .and_then(|e| e.to_str())
                                .unwrap_or("")
                                .to_lowercase();

                            *file_type_counts.entry(ext.clone()).or_insert(0) += 1;
                            *extension_sizes_acc.entry(ext.clone()).or_insert(0) += cached_size;
                            let cat = extension_to_category(&ext);
                            *category_sizes_acc.entry(cat.to_string()).or_insert(0) += cached_size;

                            let file_info = FileInfo {
                                path: path_str.clone(),
                                name: p
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("")
                                    .to_string(),
                                size: cached_size,
                                modified: Self::format_timestamp(
                                    metadata
                                        .modified()
                                        .ok()
                                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                                ),
                                file_type: "file".to_string(),
                                extension: ext.clone(),
                            };
                            live_files.push(file_info.clone());

                            if live_files.len() > 200 {
                                live_files.sort_by_key(|b| std::cmp::Reverse(b.size));
                                live_files.truncate(100);
                            }
                        }
                        entries_processed += 1;

                        if entries_processed.is_multiple_of(200) {
                            let pct = if total_estimate > 0 {
                                ((entries_processed as f32 / total_estimate as f32) * 100.0)
                                    .min(99.0)
                            } else {
                                0.0
                            };
                            let _ =
                                std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                    progress_callback(ScanProgress {
                                        files_scanned,
                                        directories_scanned: dirs_scanned,
                                        total_size: current_size,
                                        current_file: path_str.clone(),
                                        percentage: pct,
                                        completed: false,
                                        live_files: live_files.clone(),
                                        file_type_counts: file_type_counts.clone(),
                                        extension_sizes: extension_sizes_acc.clone(),
                                        category_sizes: category_sizes_acc.clone(),
                                    });
                                }));
                        }

                        continue;
                        }
                    }
                }
            }

            if !is_dir && !self.should_include_file(&metadata, entry_path, &options) {
                entries_processed += 1;
                continue;
            }

            if is_dir {
                dirs_scanned += 1;
            }

            raw_entries.push(gpu_compute::scan::RawFileEntry {
                path: path_str.clone(),
                size,
                is_dir,
            });

            // Live file updates for real-time visibility
            if !is_dir {
                let ext = entry_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                *file_type_counts.entry(ext.clone()).or_insert(0) += 1;
                *extension_sizes_acc.entry(ext.clone()).or_insert(0) += size;
                let cat = extension_to_category(&ext);
                *category_sizes_acc.entry(cat.to_string()).or_insert(0) += size;

                let file_info = FileInfo {
                    path: path_str.clone(),
                    name: entry_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string(),
                    size,
                    modified: Self::format_timestamp(
                        metadata
                            .modified()
                            .ok()
                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                    ),
                    file_type: "file".to_string(),
                    extension: ext,
                };
                live_files.push(file_info.clone());

                // Keep only top 100 largest for progress updates (avoid excessive cloning)
                if live_files.len() > 200 {
                    live_files.sort_by_key(|b| std::cmp::Reverse(b.size));
                    live_files.truncate(100);
                }

                files_scanned += 1;
                current_size += size;
            }

            entries_processed += 1;

            // Progress update every 200 entries
            if entries_processed.is_multiple_of(200) {
                let pct = if total_estimate > 0 {
                    ((entries_processed as f32 / total_estimate as f32) * 100.0).min(99.0)
                } else {
                    0.0
                };
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    progress_callback(ScanProgress {
                        files_scanned,
                        directories_scanned: dirs_scanned,
                        total_size: current_size,
                        current_file: path_str.clone(),
                        percentage: pct,
                        completed: false,
                        live_files: live_files.clone(),
                        file_type_counts: file_type_counts.clone(),
                        extension_sizes: extension_sizes_acc.clone(),
                        category_sizes: category_sizes_acc.clone(),
                    });
                }));
            }
        }

        // Phase 2: GPU-accelerated post-processing
        let use_gpu = options.gpu_acceleration && gpu_compute::device::GpuInfo::is_available();
        let processor = gpu_compute::scan::GpuScanProcessor::new()
            .with_gpu(use_gpu)
            .with_scan_root(path)
            .with_top_n(100);

        let gpu_result = processor.process(&raw_entries);

        Self::apply_gpu_result(
            &mut result,
            gpu_result,
            &raw_entries,
            true_empty_dirs,
            scanned_files,
        );

        // Copy CPU accumulators into the result so callers (e.g. the CLI
        // --stream path) can serialize category_sizes in the complete event.
        result.category_sizes = category_sizes_acc.clone();

        // Final progress update
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            progress_callback(ScanProgress {
                files_scanned: result.total_files,
                directories_scanned: result.total_directories,
                total_size: result.total_size,
                current_file: "Complete".to_string(),
                percentage: 100.0,
                completed: true,
                live_files,
                file_type_counts,
                extension_sizes: extension_sizes_acc,
                category_sizes: category_sizes_acc,
            });
        }));

        Ok(result)
    }

    #[deprecated(
        note = "scan_with_progress has duplicated categorization work and is unused; use scan_with_progress_sync instead"
    )]
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
            scanned_files: HashMap::new(),
            category_sizes: HashMap::new(),
        };

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

        let mut scanned_files = HashMap::new();

        // Do not pre-walk the directory tree for progress estimation. That
        // doubled startup I/O on large profiles; grow the estimate online.
        let total_estimate = Arc::new(AtomicU64::new(1000));
        let total_estimate_clone = total_estimate.clone();

        // Main scan loop
        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        let walk_entries: Vec<walkdir::DirEntry> =
            walker.into_iter().filter_map(|e| e.ok()).collect();
        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        for entry_result in walk_entries {
            if cancel.load(Ordering::Relaxed) {
                return Err(anyhow::anyhow!("Scan cancelled"));
            }

            let path = entry_result.path();
            let path_str = path.to_string_lossy().to_string();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    result
                        .errors
                        .push(format!("Metadata error: {}: {}", path_str, e));
                    continue;
                }
            };

            let is_file = metadata.is_file();
            let is_dir = metadata.is_dir();
            let size = metadata.len();
            let mtime = Self::get_mtime_unix(&metadata);

            if !is_dir {
                if let Some(cache_map) = options.file_cache.as_ref() {
                    if let Some(&(cached_size, cached_mtime)) = cache_map.get(&path_str) {
                        if cached_size == size && cached_mtime == mtime {
                            scanned_files.insert(path_str.clone(), (cached_size, cached_mtime));
                            let files_count =
                                current_files_clone.fetch_add(1, Ordering::Relaxed) + 1;
                            let size_count = current_size_clone
                                .fetch_add(cached_size, Ordering::Relaxed)
                                + cached_size;

                            result.total_files = files_count;
                            result.total_size = size_count;

                            let ext = path_str
                                .rsplit('.')
                                .next()
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_lowercase())
                                .unwrap_or_default();
                            *result.file_types.entry(ext.clone()).or_insert(0) += 1;

                            if options.size_buckets {
                                let bucket = size_bucket(cached_size);
                                *result
                                    .size_distribution
                                    .entry(bucket.to_string())
                                    .or_insert(0) += 1;
                            }

                            if result.largest_files.len() < 100
                                || cached_size
                                    > result.largest_files.last().map(|f| f.size).unwrap_or(0)
                            {
                                let file_info = FileInfo {
                                    path: path_str.clone(),
                                    name: path_str
                                        .rsplit(std::path::MAIN_SEPARATOR)
                                        .next()
                                        .unwrap_or("")
                                        .to_string(),
                                    size: cached_size,
                                    modified: std::fs::metadata(&path_str)
                                        .ok()
                                        .and_then(|m| m.modified().ok())
                                        .and_then(Self::format_timestamp),
                                    file_type: "file".to_string(),
                                    extension: ext,
                                };
                                result.largest_files.push(file_info);
                                result
                                    .largest_files
                                    .sort_by_key(|b| std::cmp::Reverse(b.size));
                                result.largest_files.truncate(100);
                            }

                            let processed =
                                processed_entries_clone.fetch_add(1, Ordering::Relaxed) + 1;
                            let total = total_estimate_clone.load(Ordering::Relaxed);
                            if processed > total {
                                total_estimate_clone.store(processed + 1000, Ordering::Relaxed);
                            }

                            let files_scanned = current_files_clone.load(Ordering::Relaxed);
                            let directories_scanned =
                                current_directories_clone.load(Ordering::Relaxed);
                            let total_size = current_size_clone.load(Ordering::Relaxed);
                            let current_total = total_estimate_clone.load(Ordering::Relaxed);

            let progress = ScanProgress {
                files_scanned,
                directories_scanned,
                total_size,
                current_file: path_str.clone(),
                percentage: if current_total > 0 {
                    ((processed as f32 / current_total as f32) * 100.0).min(99.0)
                } else {
                    0.0
                },
                completed: false,
                live_files: Vec::new(),
                file_type_counts: HashMap::new(),
                extension_sizes: HashMap::new(),
                category_sizes: HashMap::new(),
            };

                            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                callback(progress);
                            }));
                            continue;
                        }
                    }
                }
            }

            let should_process = if is_file {
                self.should_include_file(&metadata, path, &options)
            } else {
                true
            };

            if should_process {
                if is_file {
                    let files_count = current_files_clone.fetch_add(1, Ordering::Relaxed) + 1;
                    let size_count = current_size_clone.fetch_add(size, Ordering::Relaxed) + size;

                    result.total_files = files_count;
                    result.total_size = size_count;

                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    *result.file_types.entry(ext.clone()).or_insert(0) += 1;

                    if options.size_buckets {
                        let bucket = size_bucket(size);
                        *result
                            .size_distribution
                            .entry(bucket.to_string())
                            .or_insert(0) += 1;
                    }

                    if result.largest_files.len() < 100
                        || size > result.largest_files.last().map(|f| f.size).unwrap_or(0)
                    {
                        let file_info = FileInfo {
                            path: path_str.clone(),
                            name: path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_string(),
                            size,
                            modified: Self::format_timestamp(
                                metadata
                                    .modified()
                                    .ok()
                                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                            ),
                            file_type: "file".to_string(),
                            extension: ext,
                        };
                        result.largest_files.push(file_info);
                        result
                            .largest_files
                            .sort_by_key(|b| std::cmp::Reverse(b.size));
                        result.largest_files.truncate(100);
                    }
                } else if is_dir {
                    let dirs_count = current_directories_clone.fetch_add(1, Ordering::Relaxed) + 1;
                    result.total_directories = dirs_count;
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
                current_file: if should_process {
                    path_str
                } else {
                    "Skipping".to_string()
                },
                percentage: if current_total > 0 {
                    ((processed as f32 / current_total as f32) * 100.0).min(99.0)
                } else {
                    0.0
                },
                completed: false,
                live_files: Vec::new(),
                file_type_counts: HashMap::new(),
                extension_sizes: HashMap::new(),
                category_sizes: HashMap::new(),
            };

            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                callback(progress);
            }));
        }

        // Final progress update
        {
            let final_progress = ScanProgress {
                files_scanned: result.total_files,
                directories_scanned: result.total_directories,
                total_size: result.total_size,
                current_file: "Complete".to_string(),
                percentage: 100.0,
                completed: true,
                live_files: Vec::new(),
                file_type_counts: HashMap::new(),
                extension_sizes: HashMap::new(),
                category_sizes: HashMap::new(),
            };

            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                callback(final_progress);
            }));
        }

        result.empty_directories = true_empty_dirs;
        result.scanned_files = scanned_files;

        Ok(result)
    }
}

/// Get system information
pub fn get_system_info() -> SystemInfo {
    use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};

    let mut system = System::new_with_specifics(
        RefreshKind::nothing()
            .with_memory(MemoryRefreshKind::everything())
            .with_cpu(CpuRefreshKind::everything()),
    );
    system.refresh_memory();
    system.refresh_cpu_all();

    let disks = Disks::new_with_refreshed_list();
    let drives = disks
        .iter()
        .map(|disk| DriveInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            file_system: disk.file_system().to_string_lossy().to_string(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            is_removable: false,
        })
        .collect();

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
        assert_eq!(size_bucket(1024 * 1024), "1-10 MB");
        assert_eq!(size_bucket(100 * 1024 * 1024), "100 MB-1 GB");
        assert_eq!(size_bucket(1024 * 1024 * 1024), "> 1 GB");
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
