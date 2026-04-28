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

        // Spawn collector thread with progress reporting
        let collector_handle = std::thread::spawn(move || {
            let mut files = Vec::new();
            let mut total_files = 0u64;
            let mut total_size = 0u64;
            let mut categories = HashMap::new();
            let mut extension_stats = HashMap::new();
            let mut last_progress = 0u64;

            for file_info in receiver {
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

                files.push(file_info);

                // Report progress every 100 files
                if show_progress && total_files % 100 == 0 && total_files != last_progress {
                    last_progress = total_files;
                    eprintln!("Scanned: {} files, Size: {}", total_files, total_size);
                }
            }

            (files, total_files, total_size, categories, extension_stats)
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
        let (files, total_files, total_size, categories, extension_stats) =
            collector_handle.join().map_err(|_| anyhow::anyhow!("Thread join failed"))?;

        let analysis_time = start_time.elapsed();

        Ok(AnalysisResult {
            total_files,
            total_size,
            files,
            categories,
            extension_stats,
            analysis_time_ms: analysis_time.as_millis(),
            directory_path: self.path.to_string_lossy().to_string(),
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
        let mut files = Vec::new();
        let mut categories = HashMap::new();
        let mut extension_stats = HashMap::new();
        let mut last_progress = 0u64;

        for entry in walker.filter_map(|e| e.ok()) {
            if !self.should_include_entry(&entry, exclude_dirs) {
                continue;
            }

            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Some(file_info) = self.create_file_info(&entry, &metadata) {
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
                    }
                }
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

        Some(FileInfo {
            name: file_name,
            path: file_path_str,
            size: metadata.len(),
            extension,
            category: category.to_string(),
            modified,
        })
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

    let json_output = serde_json::to_string_pretty(&result)?;

    if let Some(output_path) = cli.output {
        fs::write(&output_path, &json_output)?;
        println!("💾 Results saved to: {}", output_path.display());
    } else {
        println!("{}", json_output);
    }

    Ok(())
}
