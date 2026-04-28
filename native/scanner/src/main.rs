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

#[derive(Debug, Serialize, Deserialize)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    extension: String,
    category: String,
    modified: String,
    file_hash: Option<String>, // MD5 hash for duplicate detection
    #[serde(skip)]
    inode: Option<u64>,       // File identifier for hard link detection
    #[serde(skip)]
    nlink: Option<u32>,        // Number of hard links
    is_hard_link: bool,       // True if this is a hard link (nlink > 1)
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

    /// Maximum directory depth
    #[arg(long, default_value = "10")]
    max_depth: usize,

    /// Output file path
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Output format (json)
    #[arg(long, default_value = "json")]
    format: String,

    /// Show progress output
    #[arg(long)]
    progress: bool,

    /// Use parallel processing for faster scanning
    #[arg(long, default_value = "true")]
    parallel: bool,

    /// Detect duplicate files (slower but finds duplicates)
    #[arg(long)]
    duplicates: bool,

    /// Skip hashing files larger than this size (MB) for performance
    #[arg(long, default_value = "1000")]
    max_hash_size: u64,
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

        // Directories to exclude for performance
        let exclude_dirs = [
            ".git", "node_modules", "__pycache__", ".cache", "target", "build",
            ".vscode", ".idea", ".tmp", "temp", "tmp"
        ];

        let walker = WalkDir::new(&self.path)
            .max_depth(self.max_depth)
            .follow_links(false)
            .into_iter();

        if self.parallel {
            // Parallel processing with rayon
            self.analyze_parallel(walker, &exclude_dirs, start_time)
        } else {
            // Sequential processing (fallback)
            self.analyze_sequential(walker, &exclude_dirs, start_time)
        }
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
                let is_new_hard_link = if let (Some(inode), _) = (file_info.inode, file_info.nlink) {
                    // Create a unique key from inode and device (to handle cross-device)
                    let key = (inode, 0u64); // device not available without extra syscall

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

                files.push(file_info);

                // Report progress every 100 files
                if show_progress && total_files % 100 == 0 && total_files != last_progress {
                    last_progress = total_files;
                    eprintln!("Scanned: {} files, Size: {} (hard link savings: {})",
                        total_files, total_size, hard_link_savings);
                }
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
                        let is_new = if let (Some(inode), _) = (file_info.inode, file_info.nlink) {
                            let key = (inode, 0u64);
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
        let (inode, nlink) = Self::get_hard_link_info(path, metadata);
        let is_hard_link = nlink.map_or(false, |n| n > 1);

        Some(FileInfo {
            name: file_name,
            path: file_path_str,
            size: metadata.len(),
            extension,
            category: category.to_string(),
            modified,
            file_hash,
            inode,
            nlink,
            is_hard_link,
        })
    }

    /// Get hard link information - platform specific implementation
    #[cfg(unix)]
    fn get_hard_link_info(_path: &Path, metadata: &fs::Metadata) -> (Option<u64>, Option<u32>) {
        use std::os::unix::fs::MetadataExt;
        (Some(metadata.ino()), Some(metadata.nlink() as u32))
    }

    #[cfg(windows)]
    fn get_hard_link_info(path: &Path, _metadata: &fs::Metadata) -> (Option<u64>, Option<u32>) {
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::fileapi::{CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, OPEN_EXISTING};
        use winapi::um::handleapi::CloseHandle;
        use winapi::um::winnt::{FILE_SHARE_READ, FILE_SHARE_WRITE, GENERIC_READ, HANDLE};
        use std::mem;

        // Convert path to wide string
        let wide_path: Vec<u16> = path
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();

        unsafe {
            // Open file to get handle
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
                return (None, None);
            }

            // Get file information using BY_HANDLE_FILE_INFORMATION
            // This gives us the file ID (nFileIndex, similar to inode) and number of links
            let mut file_info: BY_HANDLE_FILE_INFORMATION = mem::zeroed();
            let result = GetFileInformationByHandle(handle, &mut file_info);

            CloseHandle(handle);

            if result != 0 {
                // Combine nFileIndexHigh and nFileIndexLow for 64-bit file ID
                let file_id = ((file_info.nFileIndexHigh as u64) << 32)
                    | (file_info.nFileIndexLow as u64);
                let num_links = file_info.nNumberOfLinks;
                (Some(file_id), Some(num_links))
            } else {
                (None, None)
            }
        }
    }

    #[cfg(not(any(unix, windows)))]
    fn get_hard_link_info(_path: &Path, _metadata: &fs::Metadata) -> (Option<u64>, Option<u32>) {
        (None, None)
    }

    fn calculate_file_hash(path: &Path) -> Option<String> {
        use std::io::Read;

        let mut file = fs::File::open(path).ok()?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).ok()?;

        let hash = md5::compute(&buffer);
        Some(format!("{:x}", hash))
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
        println!("💾 Results saved to: {}", output_path.display());
    } else {
        println!("{}", json_output);
    }

    Ok(())
}
