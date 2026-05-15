use clap::Parser;
use std::fs;
use std::path::Path;
use std::time::Instant;

#[derive(Parser)]
#[command(author, version, about = "Space Analyzer Pro - Desktop Application")]
struct Cli {
    /// Directory to analyze (default: current directory)
    #[arg(short, long, default_value = ".")]
    path: String,

    /// Show detailed progress
    #[arg(short, long)]
    verbose: bool,

    /// Output format (text, json, csv)
    #[arg(short, long, default_value = "text")]
    format: String,

    /// Enable ML categorization
    #[arg(short, long)]
    ml: bool,

    /// Deep scan mode
    #[arg(short, long)]
    deep: bool,

    /// Export results to file
    #[arg(short, long)]
    export: Option<String>,

    /// Generate report only
    #[arg(short, long)]
    report: bool,

    /// Clean duplicates
    #[arg(short, long)]
    clean: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct ScanResult {
    total_files: usize,
    total_size_bytes: u64,
    total_size_mb: f64,
    duration_secs: f64,
    file_types: std::collections::HashMap<String, usize>,
    largest_files: Vec<(String, u64)>,
}

impl ScanResult {
    fn new() -> Self {
        Self {
            total_files: 0,
            total_size_bytes: 0,
            total_size_mb: 0.0,
            duration_secs: 0.0,
            file_types: std::collections::HashMap::new(),
            largest_files: Vec::new(),
        }
    }
}

fn validate_input(path: &str, format: &str) -> Result<(), String> {
    // Validate path
    if path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    // Check for path traversal vulnerabilities
    if path.contains("..") || path.contains('\0') {
        return Err("Path contains potentially dangerous characters or traversal patterns".to_string());
    }

    let scan_path = Path::new(path);
    
    // Normalize path to absolute
    let canonical_path = match std::fs::canonicalize(scan_path) {
        Ok(p) => p,
        Err(e) => return Err(format!("Invalid path or cannot resolve path: {}", e)),
    };

    if !canonical_path.exists() {
        return Err(format!("Path does not exist: {}", canonical_path.display()));
    }

    if !canonical_path.is_dir() {
        return Err(format!("Path is not a directory: {}", canonical_path.display()));
    }

    // Validate format
    let valid_formats = ["text", "json", "csv"];
    if !valid_formats.contains(&format) {
        return Err(format!("Invalid format '{}'. Valid formats: {}", format, valid_formats.join(", ")));
    }

    Ok(())
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    const THRESHOLD: u64 = 1024;

    if bytes == 0 {
        return "0B".to_string();
    }

    let mut size = bytes;
    let mut unit_index = 0;

    while size >= THRESHOLD && unit_index < UNITS.len() - 1 {
        size /= THRESHOLD;
        unit_index += 1;
    }

    format!("{:.2}{}", size, UNITS[unit_index])
}

fn scan_directory(path: &Path, verbose: bool, deep: bool) -> std::io::Result<ScanResult> {
    if verbose {
        println!("[SCAN] Scanning: {}", path.display());
    }

    let start_time = Instant::now();
    let scanner = app_lib::scanner::FileScanner::new();
    let options = if deep {
        app_lib::scanner::ScanOptions::deep()
    } else {
        app_lib::scanner::ScanOptions::medium()
    };

    let app_result = scanner.scan_directory_sync(path.to_str().unwrap_or("."), options)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;

    let mut result = ScanResult::new();
    result.total_files = app_result.total_files as usize;
    result.total_size_bytes = app_result.total_size;
    result.total_size_mb = app_result.total_size as f64 / (1024.0 * 1024.0);
    result.duration_secs = start_time.elapsed().as_secs_f64();
    
    for (ext, count) in app_result.file_types {
        result.file_types.insert(ext, count as usize);
    }
    
    for file in app_result.largest_files.into_iter().take(10) {
        result.largest_files.push((file.path, file.size));
    }

    Ok(result)
}

fn print_results(result: &ScanResult, format: &str) {
    match format {
        "text" => {
            println!("\n[RESULTS] SPACE ANALYSIS RESULTS");
            println!("{}", "=".repeat(50));
            println!("[FILES] Total Files: {}", result.total_files);
            println!("[SIZE] Total Size: {} ({:.2} MB)", format_bytes(result.total_size_bytes), result.total_size_mb);
            println!("[TIME] Scan Time: {:.2} seconds", result.duration_secs);

            if !result.file_types.is_empty() {
                println!("\n[TYPES] File Types:");
                let mut sorted_types: Vec<_> = result.file_types.iter().collect();
                sorted_types.sort_by(|a, b| b.1.cmp(a.1));

                for (ext, count) in sorted_types.iter().take(10) {
                    println!("  .{}: {} files", ext, count);
                }
            }

            if !result.largest_files.is_empty() {
                println!("\n[LARGEST] Largest Files:");
                for (path, size) in &result.largest_files {
                    println!("  {} ({})", path, format_bytes(*size));
                }
            }
        }
        "json" => {
            let json_output = serde_json::json!({
                "total_files": result.total_files,
                "total_size_bytes": result.total_size_bytes,
                "total_size_mb": result.total_size_mb,
                "duration_secs": result.duration_secs,
                "file_types": result.file_types,
                "largest_files": result.largest_files
            });
            println!("{}", json_output);
        }
        "csv" => {
            println!("files,size_mb");
            for (path, size) in &result.largest_files {
                println!("{},{}", path, *size as f64 / (1024.0 * 1024.0));
            }
        }
        _ => println!("Unknown format: {}", format),
    }
}

fn main() -> std::io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let is_interactive = args.len() == 1;

    let cli = Cli::parse();

    // Validate inputs
    if let Err(error) = validate_input(&cli.path, &cli.format) {
        eprintln!("[ERROR] {}", error);
        std::process::exit(1);
    }

    // Only show header for non-JSON formats
    if cli.format != "json" {
        println!("=> Space Analyzer Pro - Desktop Application v{}", env!("CARGO_PKG_VERSION"));
        println!("");
    }

    let scan_path = Path::new(&cli.path);
    let result = scan_directory(&scan_path, cli.verbose && cli.format != "json", cli.deep)?;

    print_results(&result, &cli.format);

    if let Some(export_path) = &cli.export {
        let content = match cli.format.as_str() {
            "json" => serde_json::to_string_pretty(&result).unwrap_or_default(),
            _ => format!("Scan completed: {} files, {:.2} MB", result.total_files, result.total_size_mb),
        };

        fs::write(export_path, content)?;
        println!("[EXPORT] Results exported to: {}", export_path);
    }

    if cli.report {
        println!("\n[REPORT] Generating detailed report...");
        // TODO: Implement detailed report generation
    }

    if cli.clean {
        println!("[CLEAN] Cleaning duplicates...");
        // TODO: Implement duplicate cleaning
    }

    if is_interactive {
        println!("\n[DONE] Scan complete. Press Enter to exit...");
        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;
    }

    Ok(())
}
