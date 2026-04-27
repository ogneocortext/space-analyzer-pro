use clap::Parser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use walkdir::WalkDir;
use chrono::{DateTime, Utc};

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
        let mut total_files = 0u64;
        let mut total_size = 0u64;
        let mut files = Vec::new();
        let mut categories = HashMap::new();
        let mut extension_stats = HashMap::new();

        let walker = WalkDir::new(&self.path)
            .max_depth(self.max_depth)
            .follow_links(false)
            .into_iter();

        // Directories to exclude for performance
        let exclude_dirs = [
            ".git", "node_modules", "__pycache__", ".cache", "target", "build",
            ".vscode", ".idea", ".tmp", "temp", "tmp"
        ];

        for entry in walker.filter_map(|e| e.ok()) {
            let path = entry.path();

            // Skip excluded directories
            if let Some(file_name) = path.file_name() {
                if let Some(name_str) = file_name.to_str() {
                    if exclude_dirs.contains(&name_str) {
                        continue;
                    }
                }
            }

            // Skip hidden files unless requested
            if !self.hidden {
                if let Some(file_name) = path.file_name() {
                    if let Some(name_str) = file_name.to_str() {
                        if name_str.starts_with('.') {
                            continue;
                        }
                    }
                }
            }

            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let file_size = metadata.len();
                    let file_path_str = path.to_string_lossy().to_string();

                    if let Some(file_name) = path.file_name() {
                        if let Some(name_str) = file_name.to_str() {
                            let extension = path
                                .extension()
                                .and_then(|ext| ext.to_str())
                                .unwrap_or("")
                                .to_lowercase();

                            let category = Self::categorize_file(&extension);
                            let modified = DateTime::<Utc>::from(metadata.modified()?)
                                .to_rfc3339();

                            let file_info = FileInfo {
                                name: name_str.to_string(),
                                path: file_path_str,
                                size: file_size,
                                extension: extension.clone(),
                                category: category.to_string(),
                                modified,
                            };

                            // Update stats
                            let cat_stats = categories.entry(category.to_string()).or_insert(CategoryStats {
                                count: 0,
                                size: 0,
                            });
                            cat_stats.count += 1;
                            cat_stats.size += file_size;

                            let ext_stats = extension_stats.entry(extension).or_insert(ExtensionStats {
                                count: 0,
                                size: 0,
                            });
                            ext_stats.count += 1;
                            ext_stats.size += file_size;

                            total_files += 1;
                            total_size += file_size;

                            // Respect max_files limit
                            if self.max_files == 0 || files.len() < self.max_files {
                                files.push(file_info);
                            }
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