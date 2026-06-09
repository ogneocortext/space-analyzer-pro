use chrono::Utc;
use clap::Parser;
use std::path::PathBuf;

use super::{FileSize, Issue, Warning};

#[derive(Parser)]
#[command(name = "space-analyzer")]
#[command(about = "High-performance file analysis CLI")]
pub struct Cli {
    /// Directory path to analyze
    #[arg(value_name = "PATH")]
    pub path: PathBuf,

    /// Maximum files to analyze (0 = all)
    #[arg(long, default_value = "0")]
    pub max_files: usize,

    /// Include hidden files
    #[arg(long)]
    pub hidden: bool,

    /// Output results to a JSON file
    #[arg(short, long)]
    pub output: Option<String>,

    /// Output format (json)
    #[arg(long, default_value = "json")]
    pub format: String,

    /// Use high-speed NTFS MFT scanner (requires admin, Windows only)
    #[arg(long)]
    pub mft: bool,

    /// Max depth for scanning
    #[arg(long, default_value = "100")]
    pub max_depth: usize,

    /// Show progress output
    #[arg(long)]
    pub progress: bool,

    /// Output progress as JSON lines for machine parsing
    #[arg(long)]
    pub json_progress: bool,

    /// Suppress output to stdout
    #[arg(short, long)]
    pub quiet: bool,

    /// Use parallel processing for faster scanning
    #[arg(long, default_value = "true")]
    pub parallel: bool,

    /// Detect duplicate files (slower but finds duplicates)
    #[arg(long)]
    pub duplicates: bool,

    /// Skip hashing files larger than this size (MB) for performance
    #[arg(long, default_value = "1000")]
    pub max_hash_size: u64,

    /// Use USN Journal for incremental scanning (Windows only, requires NTFS)
    #[arg(long)]
    pub usn_incremental: bool,

    /// Use NTFS MFT direct reading for 46x faster scanning (Windows only, requires admin)
    #[arg(long)]
    pub mft_fast: bool,

    /// Enumerate all hard links for each file (Windows only, slower)
    #[arg(long)]
    pub enumerate_links: bool,

    /// Skip hidden files and directories (those starting with .)
    #[arg(long, default_value = "true")]
    pub skip_hidden: bool,

    /// Additional ignore patterns (comma-separated, supports wildcards)
    #[arg(long, value_delimiter = ',')]
    pub ignore_patterns: Vec<String>,
}

/// Categorizes a file based on its extension into broad categories like Documents, Images, Code, etc.
pub fn categorize_file(extension: &str) -> &'static str {
    match extension.to_lowercase().as_str() {
        "pdf" | "doc" | "docx" | "txt" | "rtf" | "md" | "tex" => "Documents",
        "xls" | "xlsx" | "csv" | "ods" => "Spreadsheets",
        "ppt" | "pptx" | "odp" => "Presentations",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" => "Images",
        "mp4" | "avi" | "mov" | "wmv" | "flv" | "mkv" => "Videos",
        "mp3" | "wav" | "flac" | "aac" | "ogg" => "Audio",
        "js" | "jsx" | "ts" | "tsx" | "py" | "java" | "cpp" | "c" | "h" | "hpp" | "cs" | "php"
        | "rb" | "go" | "rs" | "swift" | "kt" => "Code",
        "html" | "htm" | "css" | "scss" | "less" | "xml" => "Web",
        "json" | "yaml" | "yml" | "toml" | "ini" | "cfg" => "Config",
        "zip" | "rar" | "7z" | "tar" | "gz" => "Archives",
        "exe" | "msi" | "deb" | "rpm" | "dmg" => "Executables",
        "db" | "sqlite" | "mdb" => "Databases",
        "ttf" | "otf" | "woff" | "woff2" => "Fonts",
        "dll" | "so" | "sys" | "tmp" | "log" => "System",
        "lock" | "package.json" | "package-lock.json" | "yarn.lock" | "pom.xml"
        | "build.gradle" | "requirements.txt" => "Development",
        "chm" | "hlp" | "info" => "Documentation",
        "sh" | "bat" | "cmd" | "ps1" => "Scripts",
        "epub" | "mobi" | "azw" | "azw3" => "E-books",
        "psd" | "ai" | "sketch" | "fig" => "Design",
        "obj" | "fbx" | "dae" | "blend" => "3D Models",
        _ => "Other",
    }
}

/// Generates a JSON event describing the current progress of file scanning.
pub fn emit_progress_event(
    json_progress: bool,
    files: u64,
    size: u64,
    current_file: &str,
    hard_link_savings: u64,
) {
    if json_progress {
        let progress = serde_json::json!({
            "event": "progress",
            "files": files,
            "size": size,
            "current_file": current_file,
            "hard_link_savings": hard_link_savings,
            "timestamp": Utc::now().to_rfc3339()
        });
        eprintln!("{}", progress);
    }
}

/// Determines whether a progress event should be emitted based on file count thresholds.
pub fn should_emit_progress(files: u64, last_progress: u64) -> bool {
    // Emit on the first 10 files processed or every 100 files thereafter to prevent spam.
    files != last_progress && (files <= 10 || files % 100 == 0)
}

/// Formats a raw number of bytes into a human-readable string with appropriate unit suffixes.
pub fn format_size(bytes: u64) -> String {
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
        format!("{:.1} {} ", size, UNITS[unit_index].trim())
    }
}

/// Creates a FileSize object from raw byte count and optional on-disk size.
pub fn create_file_size(bytes: u64, on_disk: Option<u64>) -> FileSize {
    FileSize {
        bytes,
        formatted: format_size(bytes),
        on_disk,
    }
}

/// Initializes and returns empty error and warning vectors for collecting scan results.
pub fn create_error_collector() -> (Vec<Issue>, Vec<Warning>) {
    (Vec::new(), Vec::new())
}

/// Records a new error issue found during the scan and adds it to the provided vector.
pub fn record_error(errors: &mut Vec<Issue>, error_type: &str, path: &str, message: &str) {
    errors.push(Issue {
        type_: error_type.to_string(),
        path: path.to_string(),
        message: message.to_string(),
        count: 1,
    });
}

/// Records a new warning during the scan and adds it to the provided vector.
pub fn record_warning(
    warnings: &mut Vec<Warning>,
    warning_type: &str,
    path: &str,
    message: &str,
    size: Option<u64>,
) {
    warnings.push(Warning {
        type_: warning_type.to_string(),
        path: path.to_string(),
        message: message.to_string(),
        size,
    });
}
