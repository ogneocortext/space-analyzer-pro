//! Shared file scanner library for Space Analyzer Pro
//!
//! This crate provides a unified, high-performance file scanner
//! that replaces the duplicate implementations across the project.

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

/// Map a file to a high-level storage category.
///
/// This mirrors the `FILE_CATEGORIES` mapping in
/// `space_analyzer_pro_desktop::category` but is kept here so shared-scanner can
/// compute categories without depending on the main crate. Unlike the main-crate
/// copy, this version also accepts the file path so it can apply path-based
/// overrides.
///
/// The main-crate `FILE_CATEGORIES` enumerates several *directory* names
/// (`node_modules`, `venv`, `dist`, `build`, …) under "Development". Those can
/// never match a file *extension*, so without path awareness a `node_modules`
/// tree was silently bucketed as "Code"/"Other" instead of "Development". We
/// resolve that here by classifying well-known development folders from the path
/// first, then falling back to the extension map.
/// Map a file *extension* (no path context) to a high-level storage category.
///
/// This is the extension-only half of [`extension_to_category`]. It is exposed
/// publicly so callers that only have an extension (e.g. a cached
/// `extension_sizes` map with no per-file paths) can classify files the same way
/// a live scan does. Path-derived categories (Development, Build Output, VCS)
/// cannot be recovered from an extension alone — for those, prefer a fresh scan.
pub fn category_for_extension(ext: &str) -> &'static str {
    match ext {
        "txt" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods"
        | "odp" | "rtf" | "md" | "csv" | "log" | "epub" | "mobi" | "azw" | "tex" => "Documents",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "ico" | "tiff" | "tif"
        | "heic" | "heif" | "raw" | "cr2" | "nef" | "arw" | "dng" | "psd" => "Images",
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpeg" | "mpg"
        | "3gp" | "vob" | "ogv" | "m2ts" | "mts" => "Videos",
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "aiff" | "opus" => "Audio",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "cab" | "zst" | "jar"
        | "nupkg" | "asar" | "tgz" | "war" | "ear" | "lz4" | "lz" | "z" | "msix" | "appx" => {
            "Archives"
        }
        "js" | "ts" | "tsx" | "jsx" | "py" | "java" | "c" | "cpp" | "h" | "hpp" | "cs" | "go"
        | "rs" | "php" | "rb" | "swift" | "kt" | "scala" | "html" | "css" | "scss" | "sass"
        | "less" | "json" | "xml" | "yaml" | "yml" | "toml" | "ini" | "cfg" | "lock" | "proto"
        | "graphql" | "vue" | "pl" | "lua" | "r" | "dart" | "hs" | "clj" | "groovy" | "ex"
        | "exs" => "Code",
        "db" | "sqlite" | "sql" | "mdb" | "accdb" | "db3" | "sqlite3" | "duckdb" => "Databases",
        "exe" | "msi" | "bat" | "cmd" | "sh" | "ps1" | "app" | "dmg" | "deb" | "rpm" | "scr"
        | "com" | "apk" => "Executables",
        // System binaries only — fonts are their own category below.
        "dll" | "sys" | "drv" | "cat" | "mui" => "System",
        // Fonts were previously lumped into "System"; they are a distinct media
        // type and are now reported separately.
        "ttf" | "otf" | "fon" | "woff" | "woff2" | "eot" | "ttc" => "Fonts",
        // Compiled/linker artifacts: static & import libraries, object files, debug
        // symbols, and native shared objects. These dominate build trees
        // (cargo/mingw/MSVC) and were previously dumped into "Other".
        "lib" | "a" | "pdb" | "so" | "dylib" | "rlib" | "rmeta" | "o" | "obj" | "exp" | "ilk"
        | "wasm" | "pyc" | "pyd" => "Build Output",
        // Game/engine asset packages.
        "sav" | "save" | "game" | "pak" | "wad" | "mpq" | "unity3d" | "vpk" | "bsa" | "esm"
        | "uasset" | "forge" | "bundle" | "asset" => "Games",
        // Disk / virtual-machine images. Classified by extension because the same
        // files appear under many different parent folders.
        "qcow2" | "vhd" | "vhdx" | "vmdk" | "vdi" | "img" | "wim" | "esd" => "Virtual",
        // Local AI model weights.
        "gguf" | "safetensors" | "onnx" => "AI Models",
        "tmp" => "Temporary",
        "" => "Other",
        _ => "Other",
    }
}

/// Return the lowercased directory-component names of a path (excluding the
/// root/prefix and the file name itself). Used so path-based category overrides
/// match whole directory names instead of arbitrary substrings.
fn path_dir_names(path: &str) -> Vec<String> {
    Path::new(path)
        .components()
        .filter_map(|c| match c {
            std::path::Component::Normal(s) => s.to_str().map(|s| s.to_lowercase()),
            _ => None,
        })
        .collect()
}

fn extension_to_category(ext: &str, path: &str) -> &'static str {
    // Path-based overrides take precedence so directory-shaped categories (which
    // have no file extension of their own) are classified correctly. Match on
    // whole path *components* (directory names), never on raw substrings — the
    // previous `contains("unity")` rule wrongly bucketed any path containing
    // "community"/"opportunity", and `contains(".android")` matched unrelated
    // substrings.
    let dirs = path_dir_names(path);
    let lower = path.to_lowercase();

    // Local AI model weights: usually extensionless blobs under a model cache, or
    // explicit model formats. Path context wins over the extension fallback so a
    // `.bin` weight under a model directory is not mis-bucketed as build output.
    if lower.contains(".ollama")
        || lower.contains("ollama/")
        || lower.contains("ollama\\")
        || lower.contains(".gemini")
        || lower.contains("huggingface")
        || lower.contains("models/blobs")
        || lower.contains("models\\blobs")
        || lower.contains("weights.bin")
        || lower.contains("antigravity")
    {
        return "AI Models";
    }

    // Disk / VM images are classified by extension so an emulator's `.img`/`.qcow2`
    // under `.android` is not swallowed by the "Development" rule below.
    match ext {
        "qcow2" | "vhd" | "vhdx" | "vmdk" | "vdi" | "img" | "wim" | "esd" => return "Virtual",
        _ => {}
    }

    let mut saw_target = false;
    for (i, d) in dirs.iter().enumerate() {
        if d == "target" {
            saw_target = true;
            if let Some(next) = dirs.get(i + 1) {
                if next == "debug" || next == "release" {
                    return "Build Output";
                }
            }
        }
    }
    if saw_target {
        return "Development";
    }

    if dirs.iter().any(|d| {
        matches!(
            d.as_str(),
            "node_modules" | "venv" | ".venv" | "site-packages" | ".cargo" | ".rustup"
                | ".android" | "unity" | "gradle"
        )
    }) {
        return "Development";
    }

    if dirs.iter().any(|d| d == ".git") {
        return "VCS";
    }

    // Registry hives are extensionless and live under System32\config; they are
    // large and belong under "System", not "Other".
    if ext.is_empty() && (lower.contains("system32\\config") || lower.contains("system32/config")) {
        return "System";
    }

    category_for_extension(ext)
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
    /// Max number of largest files (and top items) to retain during
    /// post-processing. Threaded into the GPU/CPU post-processor so `--top`
    /// is honored for the largest-files list, not just the rendered output.
    pub top_n: usize,
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
            top_n: 100,
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

/// Returns the on-disk *allocated* size of a file — the bytes it actually
/// occupies on the volume — rather than its logical length. Disk-usage totals
/// should reflect allocated size so sparse/compressed files (Android AVD
/// images, VHDX, page/hibernation files) do not inflate the result far past
/// the volume's real used space.
///
/// Directories return their logical length (0 on Windows, the directory entry
/// size elsewhere); the scanner only sums file sizes, so this keeps directory
/// accounting identical to the previous `metadata.len()` behaviour.
fn allocated_size(metadata: &std::fs::Metadata, path: &Path) -> u64 {
    if metadata.is_dir() {
        return metadata.len();
    }
    allocated_size_of_file(metadata, path)
}

#[cfg(windows)]
extern "system" {
    fn GetCompressedFileSizeW(lpFileName: *const u16, lpFileSizeHigh: *mut u32) -> u32;
}

#[cfg(windows)]
fn allocated_size_of_file(metadata: &std::fs::Metadata, path: &Path) -> u64 {
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0u16))
        .collect();
    let mut high: u32 = 0;
    let low = unsafe { GetCompressedFileSizeW(wide.as_ptr(), &mut high) };
    if low != 0xFFFF_FFFF || std::io::Error::last_os_error().raw_os_error() == Some(0) {
        // A low value of 0xFFFFFFFF is legitimate when GetLastError() == 0.
        ((high as u64) << 32) | (low as u64)
    } else {
        // Fall back to logical length if the query fails.
        metadata.len()
    }
}

#[cfg(unix)]
fn allocated_size_of_file(metadata: &std::fs::Metadata, _path: &Path) -> u64 {
    use std::os::unix::fs::MetadataExt;
    // st_blocks counts 512-byte blocks actually allocated on disk.
    (metadata.st_blocks() as u64) * 512
}

#[cfg(not(any(unix, windows)))]
fn allocated_size_of_file(metadata: &std::fs::Metadata, _path: &Path) -> u64 {
    metadata.len()
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

    fn should_include_file(
        &self,
        metadata: &std::fs::Metadata,
        path: &Path,
        options: &ScanOptions,
    ) -> bool {
        // Exclude OS-hidden entries (Windows FILE_ATTRIBUTE_HIDDEN or a leading-dot
        // name) when the caller did not ask to include them. This must cover the
        // attribute case, not just dotfiles, so hidden files are filtered the same
        // way hidden directories already are during traversal.
        if !options.include_hidden && Self::is_hidden(path, metadata) {
            return false;
        }

        let size = allocated_size(metadata, path);

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

    /// Whether a directory entry should be treated as hidden for directory
    /// pruning, using OS-correct rules. On Windows this is the
    /// FILE_ATTRIBUTE_HIDDEN bit (not the Unix leading-dot convention); on Unix
    /// it is a leading-dot name. Traversal errors count as not hidden so a single
    /// unreadable entry never prunes a whole subtree.
    fn dir_entry_is_hidden(entry: &walkdir::DirEntry) -> bool {
        match entry.metadata() {
            Ok(m) => {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
                    m.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
                }
                #[cfg(not(windows))]
                {
                    entry
                        .file_name()
                        .and_then(|n| n.to_str())
                        .is_some_and(|n| n.starts_with('.'))
                }
            }
            Err(_) => false,
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
        for entry in walker.into_iter().filter_entry(|e| {
            if options.include_hidden || e.depth() == 0 {
                return true;
            }
            if !e.file_type().is_dir() {
                return true;
            }
            !Self::dir_entry_is_hidden(e)
        }) {
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
            let size = allocated_size(&metadata, entry_path);
            let mtime = Self::get_mtime_unix(&metadata);

            // Apply filters during I/O phase (early rejection saves GPU transfer).
            // This MUST run before the cache fast-path below, otherwise a cached
            // entry would bypass the current size/hidden filters.
            if !is_dir && !self.should_include_file(&metadata, entry_path, &options) {
                continue;
            }

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
            .with_top_n(options.top_n);

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

        // Derive category sizes from the raw entries so `scan_directory_sync`
        // (which does not run the live accumulator) reports the same breakdown
        // as `scan_with_progress_sync`. Mirror the extension/category mapping
        // used there.
        let mut category_sizes_acc: HashMap<String, u64> = HashMap::new();
        for entry in raw_entries {
            if entry.is_dir {
                continue;
            }
            let ext = Path::new(&entry.path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let cat = extension_to_category(&ext, &entry.path);
            *category_sizes_acc.entry(cat.to_string()).or_insert(0) += entry.size;
        }
        result.category_sizes = category_sizes_acc;
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
        let mut entries_processed: u64 = 0;

        // Honor `--threads`: the post-processing below (and the GPU processor's
        // parallel extension extraction) run on rayon's global pool, so sizing
        // it here gives the flag a real effect. A second call with a different
        // size is ignored by rayon, which is acceptable.
        if options.num_threads > 0 {
            let _ = rayon::ThreadPoolBuilder::new()
                .num_threads(options.num_threads)
                .build_global();
        }

        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }
        // Skip hidden directories (and their subtrees) up front when the caller
        // asked to exclude them, so neither the walk nor the post-processing
        // ever sees the pruned entries.
        let walk_entries: Vec<walkdir::DirEntry> = walker
            .into_iter()
            .filter_entry(|e| {
                if options.include_hidden || e.depth() == 0 {
                    return true;
                }
                if !e.file_type().is_dir() {
                    return true;
                }
                !Self::dir_entry_is_hidden(e)
            })
            .filter_map(|e| e.ok())
            .collect();
        let total_estimate = (walk_entries.len() as u64).max(1);
        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        for entry_result in walk_entries {
            if cancel_flag.load(Ordering::Relaxed) {
                let use_gpu =
                    options.gpu_acceleration && gpu_compute::device::GpuInfo::is_available();
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

                result.total_directories = raw_entries.iter().filter(|e| e.is_dir).count() as u64;
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
            let size = allocated_size(&metadata, entry_path);
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
                                let cat = extension_to_category(&ext, &path_str);
                                *category_sizes_acc.entry(cat.to_string()).or_insert(0) +=
                                    cached_size;

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
                let cat = extension_to_category(&ext, &path_str);
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
                scanned_files.insert(path_str.clone(), (size, mtime));
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
            .with_top_n(options.top_n);

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
            let size = allocated_size(&metadata, path);
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

    /// Create a fresh, unique temporary directory for a scan test.
    fn temp_scan_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("sa_scan_test_{}_{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Write `content` to `rel` (relative to `dir`), creating parent dirs.
    fn write_file(dir: &std::path::Path, rel: &str, content: &[u8]) {
        let p = dir.join(rel);
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, content).unwrap();
    }

    #[test]
    fn scan_sums_are_consistent_and_categories_correct() {
        let dir = temp_scan_dir("sums");
        write_file(&dir, "a.txt", b"hello"); // 5 bytes
        write_file(&dir, "sub/b.pdf", b"world!!"); // 7 bytes
        write_file(&dir, "sub/node_modules/lib.js", b"x"); // 1 byte -> Development

        let scanner = FileScanner::new();
        let result = scanner
            .scan_directory_sync(dir.to_str().unwrap(), ScanOptions::default())
            .unwrap();

        let sum_ext: u64 = result.extension_sizes.values().copied().sum();
        let sum_cat: u64 = result.category_sizes.values().copied().sum();
        assert_eq!(sum_ext, result.total_size, "Σ extension_sizes must equal total_size");
        assert_eq!(sum_cat, result.total_size, "Σ category_sizes must equal total_size");
        assert_eq!(result.total_size, 5 + 7 + 1);

        // A file under node_modules must be bucketed as Development (path override),
        // not Code (which its .js extension would otherwise imply).
        let dev = result.category_sizes.get("Development").copied().unwrap_or(0);
        assert_eq!(dev, 1, "node_modules file must be classified as Development");
    }

    #[test]
    fn hidden_files_excluded_by_default() {
        let dir = temp_scan_dir("hidden");
        write_file(&dir, "visible.txt", b"data");
        write_file(&dir, ".hidden", b"secret");

        let scanner = FileScanner::new();

        let excluded = scanner
            .scan_directory_sync(dir.to_str().unwrap(), ScanOptions::default())
            .unwrap();
        assert_eq!(excluded.total_files, 1, "leading-dot file must be excluded by default");

        let included = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    include_hidden: true,
                    ..ScanOptions::default()
                },
            )
            .unwrap();
        assert_eq!(included.total_files, 2, "hidden file must be included when requested");
    }

    #[test]
    fn cache_does_not_bypass_size_filter() {
        let dir = temp_scan_dir("cache");
        write_file(&dir, "small.txt", b"tiny"); // 4 bytes
        write_file(&dir, "big.dat", b"muchlongercontent"); // 17 bytes

        let scanner = FileScanner::new();
        let full = scanner
            .scan_directory_sync(dir.to_str().unwrap(), ScanOptions::default())
            .unwrap();

        let min_size = 10u64;
        let with_cache = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    min_size: Some(min_size),
                    file_cache: Some(full.scanned_files.clone()),
                    ..ScanOptions::default()
                },
            )
            .unwrap();
        let without_cache = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    min_size: Some(min_size),
                    ..ScanOptions::default()
                },
            )
            .unwrap();

        // The cache fast-path must still honor --min-size; it must not re-admit the
        // 4-byte file that the size filter excludes.
        assert_eq!(with_cache.total_files, without_cache.total_files);
        assert_eq!(with_cache.total_size, without_cache.total_size);
        assert_eq!(without_cache.total_files, 1, "only the >= 10 byte file passes");
        assert_eq!(without_cache.total_size, 17);
    }

    #[test]
    fn top_n_caps_largest_files() {
        let dir = temp_scan_dir("topn");
        for i in 0..5u32 {
            write_file(&dir, &format!("f{}.bin", i), &vec![0u8; (i as usize) + 1]);
        }

        let scanner = FileScanner::new();
        let result = scanner
            .scan_directory_sync(
                dir.to_str().unwrap(),
                ScanOptions {
                    top_n: 2,
                    ..ScanOptions::default()
                },
            )
            .unwrap();

        assert!(result.largest_files.len() <= 2, "largest_files must be capped by top_n");
        assert_eq!(result.largest_files.len(), 2, "top_n should cap the list to 2");
    }

    #[test]
    fn extension_classification_covers_common_build_assets() {
        // Previously "Other"-dominated extensions now land in concrete categories.
        assert_eq!(category_for_extension("lib"), "Build Output");
        assert_eq!(category_for_extension("a"), "Build Output");
        assert_eq!(category_for_extension("pdb"), "Build Output");
        assert_eq!(category_for_extension("so"), "Build Output");
        assert_eq!(category_for_extension("dylib"), "Build Output");
        assert_eq!(category_for_extension("rlib"), "Build Output");
        assert_eq!(category_for_extension("rmeta"), "Build Output");
        assert_eq!(category_for_extension("o"), "Build Output");
        assert_eq!(category_for_extension("obj"), "Build Output");
        assert_eq!(category_for_extension("wasm"), "Build Output");
        assert_eq!(category_for_extension("pyc"), "Build Output");
        assert_eq!(category_for_extension("pyd"), "Build Output");

        assert_eq!(category_for_extension("jar"), "Archives");
        assert_eq!(category_for_extension("nupkg"), "Archives");
        assert_eq!(category_for_extension("asar"), "Archives");
        assert_eq!(category_for_extension("tgz"), "Archives");
        assert_eq!(category_for_extension("msix"), "Archives");
        assert_eq!(category_for_extension("appx"), "Archives");

        assert_eq!(category_for_extension("pak"), "Games");
        assert_eq!(category_for_extension("wad"), "Games");
        assert_eq!(category_for_extension("mpq"), "Games");

        assert_eq!(category_for_extension("qcow2"), "Virtual");
        assert_eq!(category_for_extension("vhd"), "Virtual");
        assert_eq!(category_for_extension("vhdx"), "Virtual");
        assert_eq!(category_for_extension("vmdk"), "Virtual");
        assert_eq!(category_for_extension("vdi"), "Virtual");
        assert_eq!(category_for_extension("img"), "Virtual");
        assert_eq!(category_for_extension("wim"), "Virtual");
        assert_eq!(category_for_extension("esd"), "Virtual");

        assert_eq!(category_for_extension("gguf"), "AI Models");
        assert_eq!(category_for_extension("safetensors"), "AI Models");
        assert_eq!(category_for_extension("onnx"), "AI Models");

        assert_eq!(category_for_extension("scr"), "Executables");
        assert_eq!(category_for_extension("com"), "Executables");
        assert_eq!(category_for_extension("apk"), "Executables");

        assert_eq!(category_for_extension("cat"), "System");
        assert_eq!(category_for_extension("mui"), "System");

        assert_eq!(category_for_extension("eot"), "Fonts");
        assert_eq!(category_for_extension("ttc"), "Fonts");

        assert_eq!(category_for_extension("epub"), "Documents");
        assert_eq!(category_for_extension("heic"), "Images");
        assert_eq!(category_for_extension("opus"), "Audio");
        assert_eq!(category_for_extension("3gp"), "Videos");
        assert_eq!(category_for_extension("duckdb"), "Databases");
    }

    #[test]
    fn path_overrides_classify_extensionless_and_disk_images() {
        // Extensionless Ollama blobs are AI model weights, not "Other".
        assert_eq!(
            extension_to_category("", "C:\\Users\\me\\.ollama\\models\\blobs\\sha256-abc"),
            "AI Models"
        );
        // A `.bin` weight under a model path is an AI model, not build output.
        assert_eq!(
            extension_to_category("bin", "C:\\Users\\me\\.gemini\\x\\weights.bin"),
            "AI Models"
        );
        // A `.bin` with no model context stays in "Other" (too ambiguous to claim).
        assert_eq!(
            extension_to_category("bin", "C:\\build\\module.bin"),
            "Other"
        );
        // Emulator disk images under .android must be Virtual, not Development.
        assert_eq!(
            extension_to_category("img", "C:\\Users\\me\\.android\\avd\\x.avd\\userdata-qemu.img"),
            "Virtual"
        );
        assert_eq!(
            extension_to_category("qcow2", "C:\\Users\\me\\.android\\avd\\x.avd\\disk.qcow2"),
            "Virtual"
        );
        // Extensionless registry hives are System.
        assert_eq!(
            extension_to_category("", "C:\\Windows\\System32\\config\\SYSTEM"),
            "System"
        );
        // node_modules still overrides extension.
        assert_eq!(
            extension_to_category("js", "C:\\proj\\node_modules\\x\\lib.js"),
            "Development"
        );
    }
}
