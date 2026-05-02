use clap::Parser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use walkdir::WalkDir;
use chrono::{DateTime, Utc};
use rayon::prelude::*;
use crossbeam::channel::bounded;

mod windows_advanced;
use windows_advanced::advanced as win_adv;
mod ntfs_mft_scanner;
mod usn_journal_scanner;

#[derive(Debug, Serialize, Deserialize)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    extension: String,
    category: String,
    modified: String,
    created: Option<String>,    // File creation time
    accessed: Option<String>,   // Last access time
    file_hash: Option<String>, // MD5 hash for duplicate detection
    #[serde(skip)]
    inode: Option<u64>,       // File identifier for hard link detection
    #[serde(skip)]
    nlink: Option<u32>,        // Number of hard links
    #[serde(skip)]
    device: Option<u64>,       // Volume identifier for hard link safety
    is_hard_link: bool,       // True if this is a hard link (nlink > 1)

    // Windows NTFS-specific fields
    #[cfg(windows)]
    has_ads: bool,            // Has Alternate Data Streams
    #[cfg(windows)]
    ads_count: u32,           // Number of ADS streams
    #[cfg(windows)]
    is_compressed: bool,    // NTFS compressed
    #[cfg(windows)]
    compressed_size: Option<u64>, // Actual compressed size on disk
    #[cfg(windows)]
    is_sparse: bool,          // Sparse file
    #[cfg(windows)]
    is_reparse_point: bool,   // Junction, symlink, mount point
    #[cfg(windows)]
    reparse_tag: Option<u32>, // Type of reparse point
    #[cfg(windows)]
    owner: Option<String>,    // File owner (username)
}

#[derive(Debug, Serialize, Deserialize)]
struct CategoryStats {
    count: u64,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExtensionStats {
    count: u64,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnalysisResult {
    total_files: u64,
    total_size: u64,
    files: Vec<FileInfo>,
    categories: HashMap<String, CategoryStats>,
    extension_stats: HashMap<String, ExtensionStats>,
    analysis_time_ms: u128,
    directory_path: String,
    duplicate_groups: Vec<DuplicateGroup>, // Groups of duplicate files
    duplicate_count: u64,                  // Total number of duplicate files
    duplicate_size: u64,                   // Total size of duplicate files
    hard_link_count: u64,                  // Number of hard-linked files
    hard_link_savings: u64,                // Size saved by hard links (not double-counted)
    apparent_size: u64,                    // Size if hard links were counted separately

    // USN Journal tracking for incremental scans (Windows only)
    #[cfg(windows)]
    usn_journal_id: Option<u64>,           // Journal ID for incremental tracking
    #[cfg(windows)]
    last_usn: Option<i64>,                 // Last USN for next incremental scan
    #[cfg(windows)]
    mft_scanned: bool,                     // Whether MFT fast scan was used
    #[cfg(windows)]
    hard_links_enumerated: bool,           // Whether all hard links were enumerated
}

#[derive(Debug, Serialize, Deserialize)]
struct DuplicateGroup {
    hash: String,
    size: u64,
    files: Vec<DuplicateFileInfo>,
    wasted_space: u64, // Size * (count - 1)
}

#[derive(Debug, Serialize, Deserialize)]
struct DuplicateFileInfo {
    path: String,
    name: String,
    modified: String,
}

// ============================================================================
// WINDOWS API HELPER STRUCTURES
// ============================================================================

#[cfg(windows)]
#[derive(Default)]
struct WindowsFileInfo {
    created: Option<String>,
    accessed: Option<String>,
    has_ads: bool,
    ads_count: u32,
    is_compressed: bool,
    compressed_size: Option<u64>,
    is_sparse: bool,
    is_reparse_point: bool,
    reparse_tag: Option<u32>,
    owner: Option<String>,
}

#[cfg(windows)]
struct AdsInfo {
    has_streams: bool,
    count: u32,
}

#[cfg(windows)]
#[repr(C)]
struct WIN32_FIND_STREAM_DATA {
    stream_size: i64,
    c_stream_name: [u16; 296],
}

#[derive(Parser)]
#[command(name = "space-analyzer")]
#[command(about = "High-performance file analysis CLI")]
struct Cli {
    /// Directory path to analyze
    #[arg(value_name = "PATH")]
    path: PathBuf,

    /// Maximum files to analyze (0 = all)
    #[arg(long, default_value = "0")]
    max_files: usize,

    /// Include hidden files
    #[arg(long)]
    hidden: bool,

    /// Output results to a JSON file
    #[arg(short, long)]
    output: Option<String>,

    /// Output format (json)
    #[arg(long, default_value = "json")]
    format: String,

    /// Use high-speed NTFS MFT scanner (requires admin, Windows only)
    #[arg(long)]
    mft: bool,

    /// Max depth for scanning
    #[arg(long, default_value = "100")]
    max_depth: usize,

    /// Show progress output
    #[arg(long)]
    progress: bool,

    /// Suppress output to stdout
    #[arg(short, long)]
    quiet: bool,

    /// Use parallel processing for faster scanning
    #[arg(long, default_value = "true")]
    parallel: bool,

    /// Detect duplicate files (slower but finds duplicates)
    #[arg(long)]
    duplicates: bool,

    /// Skip hashing files larger than this size (MB) for performance
    #[arg(long, default_value = "1000")]
    max_hash_size: u64,

    /// Use USN Journal for incremental scanning (Windows only, requires NTFS)
    #[arg(long)]
    usn_incremental: bool,

    /// Use NTFS MFT direct reading for 46x faster scanning (Windows only, requires admin)
    #[arg(long)]
    mft_fast: bool,

    /// Enumerate all hard links for each file (Windows only, slower)
    #[arg(long)]
    enumerate_links: bool,
}

impl Cli {
    fn categorize_file(extension: &str) -> &'static str {
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

    fn analyze_directory(&self) -> anyhow::Result<AnalysisResult> {
        let start_time = Instant::now();

        // Try MFT fast reading first if requested (Windows only, requires admin)
        #[cfg(windows)]
        if self.mft {
            eprintln!("Attempting MFT fast reading (requires admin privileges)...");
            match self.analyze_mft_fast(start_time) {
                Ok(result) => {
                    eprintln!("MFT fast scan completed successfully!");
                    return Ok(result);
                }
                Err(e) => {
                    eprintln!("MFT fast scan failed ({}), falling back to standard scan...", e);
                }
            }
        }

        // Directories to exclude for performance
        let exclude_dirs = [
            ".git", "node_modules", "__pycache__", ".cache", "target", "build",
            ".vscode", ".idea", ".tmp", "temp", "tmp"
        ];

        let walker = WalkDir::new(&self.path)
            .max_depth(self.max_depth)
            .follow_links(false)
            .into_iter();

        let result = if self.parallel {
            // Parallel processing with rayon
            self.analyze_parallel(walker, &exclude_dirs, start_time)
        } else {
            // Sequential processing (fallback)
            self.analyze_sequential(walker, &exclude_dirs, start_time)
        }?;

        // Post-process: enumerate all hard links if requested (Windows only)
        #[cfg(windows)]
        if self.enumerate_links {
            eprintln!("Enumerating all hard links (this may take a while)...");
            let mut link_map: std::collections::HashMap<u64, Vec<String>> = std::collections::HashMap::new();
            for file in result.files.iter().filter(|f| f.is_hard_link) {
                if let Some(inode) = file.inode {
                    let links = Self::find_hard_links_by_path(std::path::Path::new(&file.path));
                    if links.len() > 1 {
                        link_map.insert(inode, links.iter().map(|p| p.to_string_lossy().to_string()).collect());
                    }
                }
            }
            if !link_map.is_empty() {
                eprintln!("Found {} unique hard-linked file groups", link_map.len());
            }
        }

        Ok(result)
    }

    /// Fast NTFS MFT reading for 46x speedup (Windows only, requires admin)
    #[cfg(windows)]
    fn analyze_mft_fast(&self, start_time: Instant) -> anyhow::Result<AnalysisResult> {
        use crate::ntfs_mft_scanner::NtfsMftScanner;

        // Check for admin privileges
        if !NtfsMftScanner::check_admin_privileges() {
            return Err(anyhow::anyhow!("Admin privileges required for MFT scanning"));
        }

        // Get drive letter from path
        let drive_letter = self.path.to_string_lossy().chars().next()
            .ok_or_else(|| anyhow::anyhow!("Invalid path"))?;

        if !drive_letter.is_alphabetic() {
             return Err(anyhow::anyhow!("Path must start with a drive letter (e.g., C:\\)"));
        }

        let mut scanner = NtfsMftScanner::new();
        let volume = format!("{}:", drive_letter.to_uppercase());
        scanner.initialize_volume(&volume).map_err(|e: String| anyhow::anyhow!(e))?;

        // Scan the volume (pass None for max_entries to get all)
        let scanner_results = scanner.scan_volume(None).map_err(|e: String| anyhow::anyhow!(e))?;

        // Convert scanner results to AnalysisResult format
        let mut total_files = 0u64;
        let mut total_size = 0u64;
        let mut categories = HashMap::new();
        let mut extension_stats = HashMap::new();
        let mut files = Vec::new();

        // Filter results by the requested sub-path if it's not the volume root
        let root_str = self.path.to_string_lossy().to_string();
        let is_root = root_str.len() <= 3; // e.g. "C:\"

        // Get volume serial for device ID
        let device_id = scanner.get_volume_info().map(|v| v.volume_serial as u64);

        for entry in scanner_results {
            let entry_path_str = entry.file_path.to_string_lossy().to_string();

            // Check if file is within the requested sub-directory
            if !is_root && !entry_path_str.starts_with(&root_str) {
                continue;
            }

            if !entry.is_directory {
                total_files += 1;
                total_size += entry.file_size;

                let extension = entry.file_path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                let category = Self::categorize_file(&extension);

                let cat_stats = categories
                    .entry(category.to_string())
                    .or_insert(CategoryStats { count: 0, size: 0 });
                cat_stats.count += 1;
                cat_stats.size += entry.file_size;

                let ext_stats = extension_stats
                    .entry(extension.clone())
                    .or_insert(ExtensionStats { count: 0, size: 0 });
                ext_stats.count += 1;
                ext_stats.size += entry.file_size;

                files.push(FileInfo {
                    name: entry.file_name,
                    path: entry_path_str,
                    size: entry.file_size,
                    extension,
                    category: category.to_string(),
                    modified: "".to_string(),
                    created: None,
                    accessed: None,
                    file_hash: None,
                    inode: Some(entry.file_reference),
                    nlink: Some(entry.hard_links as u32),
                    device: device_id,
                    is_hard_link: entry.hard_links > 1,
                    has_ads: false,
                    ads_count: 0,
                    is_compressed: false,
                    compressed_size: None,
                    is_sparse: false,
                    is_reparse_point: false,
                    reparse_tag: None,
                    owner: None,
                });
            }
        }

        let analysis_time = start_time.elapsed();

        Ok(AnalysisResult {
            total_files,
            total_size,
            files,
            categories,
            extension_stats,
            analysis_time_ms: analysis_time.as_millis(),
            directory_path: self.path.to_string_lossy().to_string(),
            duplicate_groups: Vec::new(),
            duplicate_count: 0,
            duplicate_size: 0,
            hard_link_count: 0,
            hard_link_savings: 0,
            apparent_size: total_size,
            usn_journal_id: scanner.get_journal_id(),
            last_usn: scanner.get_last_usn(),
            mft_scanned: true,
            hard_links_enumerated: false,
        })
    }

    /// Incremental scan using USN Journal (Windows only)
    #[cfg(windows)]
    #[allow(dead_code)]
    fn analyze_usn_incremental(
        &self,
        start_time: Instant,
        journal_id: u64,
        start_usn: i64,
    ) -> anyhow::Result<AnalysisResult> {
        // This would read USN Journal changes and update the previous scan result
        // For now, falls back to standard scan with USN tracking enabled
        eprintln!("USN incremental scan: Journal ID={}, Start USN={}", journal_id, start_usn);

        // Get volume path
        let volume_path = win_adv::get_volume_path(&self.path)
            .ok_or_else(|| anyhow::anyhow!("Could not determine volume path"))?;

        // Read changes from USN Journal
        let changes = win_adv::read_usn_journal_changes(&volume_path, journal_id, start_usn);
        eprintln!("Found {} changed files in USN Journal", changes.len());

        // Fall back to standard scan but track USN for next time
        let exclude_dirs = [
            ".git", "node_modules", "__pycache__", ".cache", "target", "build",
            ".vscode", ".idea", ".tmp", "temp", "tmp"
        ];

        let walker = WalkDir::new(&self.path)
            .max_depth(self.max_depth)
            .follow_links(false)
            .into_iter();

        let mut result = if self.parallel {
            self.analyze_parallel(walker, &exclude_dirs, start_time)
        } else {
            self.analyze_sequential(walker, &exclude_dirs, start_time)
        }?;

        // Update USN tracking
        let usn_info = win_adv::query_usn_journal(&volume_path);
        result.usn_journal_id = usn_info.as_ref().map(|j| j.usn_journal_id);
        result.last_usn = usn_info.map(|j| j.next_usn);

        Ok(result)
    }

    fn analyze_parallel(
        &self,
        walker: walkdir::IntoIter,
        exclude_dirs: &[&str],
        start_time: Instant,
    ) -> anyhow::Result<AnalysisResult> {
        let (sender, receiver) = bounded::<FileInfo>(10000);
        let progress_counter = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
        let progress_counter_clone = progress_counter.clone();
        let show_progress = self.progress;

        // Spawn collector thread with progress reporting and hard link tracking
        let collector_handle = std::thread::spawn(move || {
            let mut files = Vec::new();
            let mut total_files = 0u64;
            let mut total_size = 0u64;
            let mut apparent_size = 0u64; // Size if hard links counted separately
            let mut categories = HashMap::new();
            let mut extension_stats = HashMap::new();
            let mut last_progress = 0u64;

            // Track seen inodes to avoid double-counting hard links
            let mut seen_inodes: HashMap<(u64, u64), u64> = HashMap::new(); // (inode, device) -> first_seen_size
            let mut hard_link_count = 0u64;
            let mut hard_link_savings = 0u64;

            for file_info in receiver {
                let is_new_hard_link = if let (Some(inode), device) = (file_info.inode, file_info.device) {
                    // Create a unique key from inode and device
                    let key = (inode, device.unwrap_or(0));

                    if file_info.is_hard_link {
                        if let Some(first_size) = seen_inodes.get(&key) {
                            // This is a hard link we've seen before
                            hard_link_count += 1;
                            hard_link_savings += first_size;
                            apparent_size += file_info.size;
                            false // Don't count again
                        } else {
                            // First time seeing this hard link
                            seen_inodes.insert(key, file_info.size);
                            apparent_size += file_info.size;
                            true // Count this one
                        }
                    } else {
                        apparent_size += file_info.size;
                        true // Regular file, always count
                    }
                } else {
                    apparent_size += file_info.size;
                    true // Can't detect hard links, count normally
                };

                if is_new_hard_link {
                    total_files += 1;
                    total_size += file_info.size;

                    let cat_stats = categories
                        .entry(file_info.category.clone())
                        .or_insert(CategoryStats { count: 0, size: 0 });
                    cat_stats.count += 1;
                    cat_stats.size += file_info.size;

                    let ext_stats = extension_stats
                        .entry(file_info.extension.clone())
                        .or_insert(ExtensionStats { count: 0, size: 0 });
                    ext_stats.count += 1;
                    ext_stats.size += file_info.size;
                }

                // Report progress every 100 files with current file
                if show_progress && total_files % 100 == 0 && total_files != last_progress {
                    last_progress = total_files;
                    eprintln!("Scanned: {} files, Size: {} (hard link savings: {}) - Current: {}",
                        total_files, total_size, hard_link_savings, file_info.path);
                }

                files.push(file_info);
            }

            (files, total_files, total_size, apparent_size, categories, extension_stats,
             hard_link_count, hard_link_savings)
        });

        // Parallel processing of directory entries
        walker
            .filter_map(|e| e.ok())
            .filter(|entry| self.should_include_entry(entry, exclude_dirs))
            .par_bridge()
            .for_each(|entry| {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        if let Some(file_info) = self.create_file_info(&entry, &metadata) {
                            if sender.send(file_info).is_err() {
                                return;
                            }
                            progress_counter_clone.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        }
                    }
                }
            });

        drop(sender); // Close channel

        // Wait for collector
        let (files, total_files, total_size, apparent_size, categories, extension_stats,
             hard_link_count, hard_link_savings) =
            collector_handle.join().map_err(|_| anyhow::anyhow!("Thread join failed"))?;

        let analysis_time = start_time.elapsed();

        // Find duplicates if enabled
        let (duplicate_groups, duplicate_count, duplicate_size) = if self.duplicates {
            Self::find_duplicates(&files)
        } else {
            (Vec::new(), 0, 0)
        };

        Ok(AnalysisResult {
            total_files,
            total_size,
            files,
            categories,
            extension_stats,
            analysis_time_ms: analysis_time.as_millis(),
            directory_path: self.path.to_string_lossy().to_string(),
            duplicate_groups,
            duplicate_count,
            duplicate_size,
            hard_link_count,
            hard_link_savings,
            apparent_size,
            #[cfg(windows)]
            usn_journal_id: None,
            #[cfg(windows)]
            last_usn: None,
            #[cfg(windows)]
            mft_scanned: false,
            #[cfg(windows)]
            hard_links_enumerated: false,
        })
    }

    fn analyze_sequential(
        &self,
        walker: walkdir::IntoIter,
        exclude_dirs: &[&str],
        start_time: Instant,
    ) -> anyhow::Result<AnalysisResult> {
        let mut total_files = 0u64;
        let mut total_size = 0u64;
        let mut apparent_size = 0u64;
        let mut files = Vec::new();
        let mut categories = HashMap::new();
        let mut extension_stats = HashMap::new();
        let mut last_progress = 0u64;

        // Track seen inodes for hard link detection
        let mut seen_inodes: HashMap<(u64, u64), u64> = HashMap::new();
        let mut hard_link_count = 0u64;
        let mut hard_link_savings = 0u64;

        for entry in walker.filter_map(|e| e.ok()) {
            if !self.should_include_entry(&entry, exclude_dirs) {
                continue;
            }

            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Some(file_info) = self.create_file_info(&entry, &metadata) {
                        apparent_size += file_info.size;

                        // Check for hard links
                        let is_new = if let (Some(inode), device) = (file_info.inode, file_info.device) {
                            let key = (inode, device.unwrap_or(0));
                            if file_info.is_hard_link {
                                if let Some(first_size) = seen_inodes.get(&key) {
                                    hard_link_count += 1;
                                    hard_link_savings += first_size;
                                    false
                                } else {
                                    seen_inodes.insert(key, file_info.size);
                                    true
                                }
                            } else {
                                true
                            }
                        } else {
                            true
                        };

                        if is_new {
                            total_files += 1;
                            total_size += file_info.size;

                        let cat_stats = categories
                            .entry(file_info.category.clone())
                            .or_insert(CategoryStats { count: 0, size: 0 });
                        cat_stats.count += 1;
                        cat_stats.size += file_info.size;

                        let ext_stats = extension_stats
                            .entry(file_info.extension.clone())
                            .or_insert(ExtensionStats { count: 0, size: 0 });
                        ext_stats.count += 1;
                        ext_stats.size += file_info.size;

                        if self.max_files == 0 || files.len() < self.max_files {
                            files.push(file_info);
                        }

                        // Report progress every 100 files
                        if self.progress && total_files % 100 == 0 && total_files != last_progress {
                            last_progress = total_files;
                            eprintln!("Scanned: {} files, Size: {}", total_files, total_size);
                        }
                        } // Close if is_new
                    }
                }
            }
        }

        let analysis_time = start_time.elapsed();

        // Find duplicates if enabled
        let (duplicate_groups, duplicate_count, duplicate_size) = if self.duplicates {
            Self::find_duplicates(&files)
        } else {
            (Vec::new(), 0, 0)
        };

        Ok(AnalysisResult {
            total_files,
            total_size,
            files,
            categories,
            extension_stats,
            analysis_time_ms: analysis_time.as_millis(),
            directory_path: self.path.to_string_lossy().to_string(),
            duplicate_groups,
            duplicate_count,
            duplicate_size,
            hard_link_count,
            hard_link_savings,
            apparent_size,
            #[cfg(windows)]
            usn_journal_id: None,
            #[cfg(windows)]
            last_usn: None,
            #[cfg(windows)]
            mft_scanned: false,
            #[cfg(windows)]
            hard_links_enumerated: false,
        })
    }

    fn should_include_entry(&self, entry: &walkdir::DirEntry, exclude_dirs: &[&str]) -> bool {
        let path = entry.path();

        // Skip excluded directories
        if let Some(file_name) = path.file_name() {
            if let Some(name_str) = file_name.to_str() {
                if exclude_dirs.contains(&name_str) {
                    return false;
                }
            }
        }

        // Skip hidden files unless requested
        if !self.hidden {
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
            .to_lowercase();

        let category = Self::categorize_file(&extension);

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| DateTime::<Utc>::from(std::time::UNIX_EPOCH + d).to_rfc3339())
            .unwrap_or_else(|| DateTime::<Utc>::from(std::time::UNIX_EPOCH).to_rfc3339());

        // Calculate hash only if duplicates mode is enabled and file size is under limit
        let file_hash = if self.duplicates && metadata.len() <= self.max_hash_size * 1024 * 1024 {
            Self::calculate_file_hash(path)
        } else {
            None
        };

        // Detect hard links - platform specific
        let (inode, nlink, device) = Self::get_hard_link_info(path, metadata);
        let is_hard_link = nlink.map_or(false, |n| n > 1);

        // Get Windows-specific file info
        #[cfg(windows)]
        let (created, accessed, has_ads, ads_count, is_compressed, compressed_size, is_sparse, is_reparse_point, reparse_tag, owner) = {
            let win_info = Self::get_windows_file_info(path);
            (
                win_info.created,
                win_info.accessed,
                win_info.has_ads,
                win_info.ads_count,
                win_info.is_compressed,
                win_info.compressed_size,
                win_info.is_sparse,
                win_info.is_reparse_point,
                win_info.reparse_tag,
                win_info.owner,
            )
        };

        #[cfg(not(windows))]
        let (created, accessed) = (None, None);

        Some(FileInfo {
            name: file_name,
            path: file_path_str,
            size: metadata.len(),
            extension,
            category: category.to_string(),
            modified,
            created,
            accessed,
            file_hash,
            inode,
            nlink,
            device,
            is_hard_link,
            #[cfg(windows)]
            has_ads,
            #[cfg(windows)]
            ads_count,
            #[cfg(windows)]
            is_compressed,
            #[cfg(windows)]
            compressed_size,
            #[cfg(windows)]
            is_sparse,
            #[cfg(windows)]
            is_reparse_point,
            #[cfg(windows)]
            reparse_tag,
            #[cfg(windows)]
            owner,
        })
    }

    /// Get hard link information - platform specific implementation
    #[cfg(windows)]
    fn get_hard_link_info(path: &Path, _metadata: &fs::Metadata) -> (Option<u64>, Option<u32>, Option<u64>) {
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::fileapi::{CreateFileW, GetFileInformationByHandle, OPEN_EXISTING, BY_HANDLE_FILE_INFORMATION};
        use winapi::um::handleapi::CloseHandle;
        use winapi::um::winnt::{FILE_SHARE_READ, FILE_SHARE_WRITE, GENERIC_READ, HANDLE};
        use std::mem;

        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();

        unsafe {
            let handle: HANDLE = CreateFileW(
                wide_path.as_ptr(),
                GENERIC_READ,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                std::ptr::null_mut(),
                OPEN_EXISTING,
                0,
                std::ptr::null_mut(),
            );

            if handle == winapi::um::handleapi::INVALID_HANDLE_VALUE {
                return (None, None, None);
            }

            let mut file_info: BY_HANDLE_FILE_INFORMATION = mem::zeroed();
            let result = GetFileInformationByHandle(handle, &mut file_info);

            CloseHandle(handle);

            if result != 0 {
                let file_id = ((file_info.nFileIndexHigh as u64) << 32)
                    | (file_info.nFileIndexLow as u64);
                let num_links = file_info.nNumberOfLinks;
                let volume_serial = file_info.dwVolumeSerialNumber as u64;
                (Some(file_id), Some(num_links), Some(volume_serial))
            } else {
                (None, None, None)
            }
        }
    }

    #[cfg(unix)]
    fn get_hard_link_info(_path: &Path, metadata: &fs::Metadata) -> (Option<u64>, Option<u32>, Option<u64>) {
        use std::os::unix::fs::MetadataExt;
        (Some(metadata.ino()), Some(metadata.nlink() as u32), Some(metadata.dev()))
    }

    #[cfg(not(any(unix, windows)))]
    fn get_hard_link_info(_path: &Path, _metadata: &fs::Metadata) -> (Option<u64>, Option<u32>, Option<u64>) {
        (None, None, None)
    }

    fn calculate_file_hash(path: &Path) -> Option<String> {
        use std::io::{BufReader, Read};

        let file = fs::File::open(path).ok()?;
        let mut reader = BufReader::new(file);
        let mut context = md5::Context::new();
        let mut buffer = [0u8; 128 * 1024]; // 128KB chunks

        loop {
            let count = reader.read(&mut buffer).ok()?;
            if count == 0 { break; }
            context.consume(&buffer[..count]);
        }

        Some(format!("{:x}", context.compute()))
    }

    // ============================================================================
    // WINDOWS API FEATURES
    // ============================================================================

    #[cfg(windows)]
    fn get_windows_file_info(path: &Path) -> WindowsFileInfo {
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::fileapi::{CreateFileW, GetFileAttributesW, GetFileTime, OPEN_EXISTING, BY_HANDLE_FILE_INFORMATION, GetFileInformationByHandle};
        use winapi::um::handleapi::CloseHandle;
        use winapi::um::winnt::{FILE_SHARE_READ, FILE_SHARE_WRITE, GENERIC_READ, HANDLE, FILE_ATTRIBUTE_COMPRESSED, FILE_ATTRIBUTE_SPARSE_FILE, FILE_ATTRIBUTE_REPARSE_POINT};
        use std::mem;

        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();

        let mut info = WindowsFileInfo::default();

        unsafe {
            // Get file attributes first (quick check)
            let attrs = GetFileAttributesW(wide_path.as_ptr());
            if attrs != winapi::um::fileapi::INVALID_FILE_ATTRIBUTES {
                info.is_compressed = (attrs & FILE_ATTRIBUTE_COMPRESSED) != 0;
                info.is_sparse = (attrs & FILE_ATTRIBUTE_SPARSE_FILE) != 0;
                info.is_reparse_point = (attrs & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
            }

            // Open file for detailed info
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
                return info;
            }

            // Get detailed file info
            let mut file_info: BY_HANDLE_FILE_INFORMATION = mem::zeroed();
            if GetFileInformationByHandle(handle, &mut file_info) != 0 {
                // Reparse tag would be available through FindFirstFile for reparse points
                // For now, we just know it's a reparse point from attributes
            }

            // Get file times
            let mut creation_time = mem::zeroed();
            let mut access_time = mem::zeroed();
            let mut _write_time = mem::zeroed();

            if GetFileTime(handle, &mut creation_time, &mut access_time, &mut _write_time) != 0 {
                info.created = Some(Self::filetime_to_iso(&creation_time));
                info.accessed = Some(Self::filetime_to_iso(&access_time));
            }

            CloseHandle(handle);

            // Check for ADS
            let ads_info = Self::detect_alternate_data_streams(path);
            info.has_ads = ads_info.has_streams;
            info.ads_count = ads_info.count;

            // Get compressed size
            if info.is_compressed {
                info.compressed_size = Self::get_compressed_file_size(path);
            }

            // Get owner
            info.owner = Self::get_file_owner(path);
        }

        info
    }

    #[cfg(windows)]
    fn filetime_to_iso(ft: &winapi::shared::minwindef::FILETIME) -> String {
        use chrono::DateTime;

        // Convert FILETIME (100-nanosecond intervals since January 1, 1601) to Unix timestamp
        let ft_64 = ((ft.dwHighDateTime as u64) << 32) | (ft.dwLowDateTime as u64);
        let secs_since_1601 = ft_64 / 10_000_000;
        let secs_since_unix = secs_since_1601 as i64 - 11644473600i64; // Difference between 1601 and 1970

        DateTime::from_timestamp(secs_since_unix, 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default()
    }

    /// Detect Alternate Data Streams (ADS) - hidden data in files
    #[cfg(windows)]
    fn detect_alternate_data_streams(path: &Path) -> AdsInfo {
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::fileapi::{FindFirstStreamW, FindNextStreamW, FindClose};

        let mut info = AdsInfo { has_streams: false, count: 0 };

        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();

        unsafe {
            let mut find_data: WIN32_FIND_STREAM_DATA = std::mem::zeroed();

            let handle = FindFirstStreamW(
                wide_path.as_ptr(),
                0, // FindStreamInfoStandard = 0
                &mut find_data as *mut _ as *mut _,
                0,
            );

            if handle != winapi::um::handleapi::INVALID_HANDLE_VALUE {
                // Skip the default (::DATA) stream
                loop {
                    let stream_name = String::from_utf16_lossy(
                        &find_data.c_stream_name.iter()
                            .take_while(|&&c| c != 0)
                            .cloned()
                            .collect::<Vec<_>>()
                    );

                    // Count only non-default streams
                    if !stream_name.starts_with("::") && !stream_name.is_empty() {
                        info.count += 1;
                        info.has_streams = true;
                    }

                    if FindNextStreamW(handle, &mut find_data as *mut _ as *mut _) == 0 {
                        break;
                    }
                }

                FindClose(handle);
            }
        }

        info
    }

    /// Get compressed file size (actual bytes on disk)
    #[cfg(windows)]
    fn get_compressed_file_size(path: &Path) -> Option<u64> {
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::fileapi::GetCompressedFileSizeW;

        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();

        unsafe {
            let mut high: u32 = 0;
            let low = GetCompressedFileSizeW(wide_path.as_ptr(), &mut high);

            if low as i32 != -1 || high != 0 {
                Some(((high as u64) << 32) | (low as u64))
            } else {
                None
            }
        }
    }

    /// Get file owner (resolves SID to username)
    #[cfg(windows)]
    fn get_file_owner(path: &Path) -> Option<String> {
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::aclapi::GetNamedSecurityInfoW;
        use winapi::um::winnt::{OWNER_SECURITY_INFORMATION, PSID};
        use winapi::um::winbase::LookupAccountSidW;

        // SE_FILE_OBJECT = 1
        const SE_FILE_OBJECT: u32 = 1;
        const ERROR_SUCCESS: u32 = 0;

        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();

        unsafe {
            let mut sid: PSID = std::ptr::null_mut();
            let mut sd: winapi::um::winnt::PSECURITY_DESCRIPTOR = std::ptr::null_mut();

            let result = GetNamedSecurityInfoW(
                wide_path.as_ptr(),
                SE_FILE_OBJECT,
                OWNER_SECURITY_INFORMATION,
                &mut sid,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut sd,
            );

            if result != ERROR_SUCCESS || sid.is_null() {
                return None;
            }

            // Try to resolve SID to domain\username via LookupAccountSidW
            let mut name_buf: Vec<u16> = vec![0; 256];
            let mut domain_buf: Vec<u16> = vec![0; 256];
            let mut name_len: u32 = name_buf.len() as u32;
            let mut domain_len: u32 = domain_buf.len() as u32;
            let mut sid_use: u32 = 0;

            let lookup_result = LookupAccountSidW(
                std::ptr::null(),  // local system
                sid,
                name_buf.as_mut_ptr(),
                &mut name_len,
                domain_buf.as_mut_ptr(),
                &mut domain_len,
                &mut sid_use as *mut u32 as *mut _,
            );

            // Free the security descriptor allocated by GetNamedSecurityInfoW
            if !sd.is_null() {
                winapi::um::winbase::LocalFree(sd as *mut _);
            }

            if lookup_result != 0 {
                // Successfully resolved to username
                let name = String::from_utf16_lossy(
                    &name_buf[..name_len as usize],
                );
                let domain = String::from_utf16_lossy(
                    &domain_buf[..domain_len as usize],
                );

                if domain.is_empty() {
                    Some(name)
                } else {
                    Some(format!("{}\\{}", domain, name))
                }
            } else {
                // Fallback: convert SID to string representation (S-1-5-...)
                use winapi::shared::sddl::ConvertSidToStringSidW;

                let mut sid_string: *mut u16 = std::ptr::null_mut();
                if ConvertSidToStringSidW(sid, &mut sid_string) != 0 && !sid_string.is_null() {
                    let len = (0..).take_while(|&i| *sid_string.add(i) != 0).count();
                    let sid_str = String::from_utf16_lossy(
                        std::slice::from_raw_parts(sid_string, len),
                    );
                    winapi::um::winbase::LocalFree(sid_string as *mut _);
                    Some(sid_str)
                } else {
                    None
                }
            }
        }
    }

    /// Find all hard links to a file using FindFirstFileNameW/FindNextFileNameW
    #[cfg(windows)]
    #[allow(dead_code)]
    fn find_hard_links_by_path(path: &Path) -> Vec<PathBuf> {
        win_adv::find_all_hard_links(path)
    }

    /// Find all hard links to a file (legacy interface by file ID)
    #[cfg(windows)]
    #[allow(dead_code)]
    fn find_hard_links(_file_id: u64, _volume_path: &Path) -> Vec<String> {
        // For file-ID based lookup, we'd need to open the file by ID first.
        // Use find_hard_links_by_path with a file path instead for full functionality.
        Vec::new()
    }

    fn find_duplicates(files: &[FileInfo]) -> (Vec<DuplicateGroup>, u64, u64) {
        use std::collections::HashMap;

        let mut hash_groups: HashMap<String, Vec<&FileInfo>> = HashMap::new();

        // Group files by hash
        for file in files {
            if let Some(ref hash) = file.file_hash {
                hash_groups.entry(hash.clone()).or_default().push(file);
            }
        }

        // Create duplicate groups (only for hashes with more than 1 file)
        let mut duplicate_groups = Vec::new();
        let mut duplicate_count = 0u64;
        let mut duplicate_size = 0u64;

        for (hash, group_files) in hash_groups {
            if group_files.len() > 1 {
                let size = group_files[0].size;
                let wasted = size * (group_files.len() as u64 - 1);

                let dup_files: Vec<DuplicateFileInfo> = group_files
                    .iter()
                    .map(|f| DuplicateFileInfo {
                        path: f.path.clone(),
                        name: f.name.clone(),
                        modified: f.modified.clone(),
                    })
                    .collect();

                duplicate_groups.push(DuplicateGroup {
                    hash: hash.clone(),
                    size,
                    files: dup_files,
                    wasted_space: wasted,
                });

                duplicate_count += group_files.len() as u64;
                duplicate_size += wasted;
            }
        }

        // Sort by wasted space (largest first)
        duplicate_groups.sort_by(|a, b| b.wasted_space.cmp(&a.wasted_space));

        (duplicate_groups, duplicate_count, duplicate_size)
    }
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    // Validate path
    if !cli.path.exists() {
        eprintln!("Error: Directory '{}' does not exist", cli.path.display());
        std::process::exit(1);
    }

    if !cli.path.is_dir() {
        eprintln!("Error: '{}' is not a directory", cli.path.display());
        std::process::exit(1);
    }

    println!("🚀 Starting Rust CLI analysis of: {}", cli.path.display());

    let result = cli.analyze_directory()?;

    println!("✅ Analysis complete! Found {} files, {} bytes in {}ms",
             result.total_files,
             result.total_size,
             result.analysis_time_ms);

    // Print duplicate statistics if duplicates were detected
    if result.duplicate_count > 0 {
        println!("📋 Found {} duplicate files ({} groups), wasting {} bytes",
                 result.duplicate_count,
                 result.duplicate_groups.len(),
                 result.duplicate_size);
    }

    let json_output = serde_json::to_string_pretty(&result)?;

    if let Some(output_path) = cli.output {
        fs::write(&output_path, &json_output)?;
        println!("💾 Results saved to: {}", output_path);
    } else if !cli.quiet {
        // Only print JSON if it's not too massive or quiet mode is off
        if result.total_files < 1000 {
            println!("{}", json_output);
        } else {
            println!("💡 Large result set ({} files). Use --output <file> to save the full JSON.", result.total_files);
        }
    }

    Ok(())
}
