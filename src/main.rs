use clap::Parser;
use file_deduplicator::{DeduplicationConfig, FileDeduplicator};
use shared_scanner::{FileScanner, ScanOptions};
use std::fs;
use std::path::Path;
use std::time::Instant;

mod cli;

use cli::Cli;

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
        return Err(
            "Path contains potentially dangerous characters or traversal patterns".to_string(),
        );
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
        return Err(format!(
            "Path is not a directory: {}",
            canonical_path.display()
        ));
    }

    // Validate format
    let valid_formats = ["text", "json", "csv"];
    if !valid_formats.contains(&format) {
        return Err(format!(
            "Invalid format '{}'. Valid formats: {}",
            format,
            valid_formats.join(", ")
        ));
    }

    Ok(())
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    const THRESHOLD: f64 = 1024.0;

    if bytes == 0 {
        return "0 B".to_string();
    }

    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= THRESHOLD && unit_index < UNITS.len() - 1 {
        size /= THRESHOLD;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} B", size as u64)
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

fn scan_directory(path: &Path, verbose: bool, deep: bool) -> std::io::Result<ScanResult> {
    if verbose {
        println!("[SCAN] Scanning: {}", path.display());
    }

    let start_time = Instant::now();
    let scanner = FileScanner::new();
    let options = if deep {
        ScanOptions::deep()
    } else {
        ScanOptions::medium()
    };

    let app_result = scanner
        .scan_directory_sync(path.to_str().unwrap_or("."), options)
        .map_err(|e| std::io::Error::other(e.to_string()))?;

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
            println!(
                "[SIZE] Total Size: {} ({:.2} MB)",
                format_bytes(result.total_size_bytes),
                result.total_size_mb
            );
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
            println!("total_files,total_size_bytes,total_size_mb,duration_secs");
            println!(
                "{},{},{:.2},{:.3}",
                result.total_files,
                result.total_size_bytes,
                result.total_size_mb,
                result.duration_secs
            );
            println!("\nfile_type,count");
            let mut sorted_types: Vec<_> = result.file_types.iter().collect();
            sorted_types.sort_by(|a, b| b.1.cmp(a.1));
            for (ext, count) in sorted_types.iter().take(10) {
                println!(".{},{}", ext, count);
            }
            println!("\nfile_path,size_bytes");
            for (path, size) in &result.largest_files {
                println!("\"{}\",{}", path, size);
            }
        }
        _ => println!("Unknown format: {}", format),
    }
}

fn main() -> std::io::Result<()> {
    let cli = Cli::parse();

    // Validate inputs
    if let Err(error) = validate_input(&cli.path, &cli.format) {
        eprintln!("[ERROR] {}", error);
        std::process::exit(1);
    }

    // Only show header for non-JSON formats
    if cli.format != "json" {
        println!(
            "=> Space Analyzer Pro - Desktop Application v{}",
            env!("CARGO_PKG_VERSION")
        );
        println!();
    }

    let scan_path = Path::new(&cli.path);
    let result = scan_directory(scan_path, cli.verbose && cli.format != "json", cli.deep)?;

    print_results(&result, &cli.format);

    if let Some(export_path) = &cli.export {
        let content = match cli.format.as_str() {
            "json" => serde_json::to_string_pretty(&result).unwrap_or_default(),
            "csv" => {
                let mut csv =
                    String::from("total_files,total_size_bytes,total_size_mb,duration_secs\n");
                csv.push_str(&format!(
                    "{},{},{:.2},{:.3}\n",
                    result.total_files,
                    result.total_size_bytes,
                    result.total_size_mb,
                    result.duration_secs
                ));
                csv.push_str("\nfile_type,count\n");
                let mut sorted_types: Vec<_> = result.file_types.iter().collect();
                sorted_types.sort_by(|a, b| b.1.cmp(a.1));
                for (ext, count) in &sorted_types {
                    csv.push_str(&format!(".{},{}\n", ext, count));
                }
                csv.push_str("\nfile_path,size_bytes\n");
                for (path, size) in &result.largest_files {
                    csv.push_str(&format!("\"{}\",{}\n", path, size));
                }
                csv
            }
            _ => format!(
                "Scan completed: {} files, {:.2} MB",
                result.total_files, result.total_size_mb
            ),
        };

        fs::write(export_path, content)?;
        println!("[EXPORT] Results exported to: {}", export_path);
    }

    if cli.report {
        println!("\n[REPORT] Generating detailed report...");
        let mut report_content = String::new();
        report_content.push_str("# Space Analyzer Pro - Detailed Scan Report\n\n");
        report_content.push_str(&format!(
            "Generated on: {}\n",
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
        ));
        report_content.push_str(&format!("Target Directory: `{}`\n\n", cli.path));

        report_content.push_str("## Summary Statistics\n\n");
        report_content.push_str(&format!(
            "- **Total Files Scanned:** {}\n",
            result.total_files
        ));
        report_content.push_str(&format!(
            "- **Total Size:** {}\n",
            format_bytes(result.total_size_bytes)
        ));
        report_content.push_str(&format!(
            "- **Scan Duration:** {:.3} seconds\n\n",
            result.duration_secs
        ));

        report_content.push_str("## Top 10 Largest Files\n\n");
        if result.largest_files.is_empty() {
            report_content.push_str("No files found.\n");
        } else {
            report_content.push_str("| File Path | Size | Percentage of Total |\n");
            report_content.push_str("|-----------|------|---------------------|\n");
            for (path, size) in &result.largest_files {
                let pct = if result.total_size_bytes > 0 {
                    (*size as f64 / result.total_size_bytes as f64) * 100.0
                } else {
                    0.0
                };
                report_content.push_str(&format!(
                    "| `{}` | {} | {:.2}% |\n",
                    path,
                    format_bytes(*size),
                    pct
                ));
            }
        }
        report_content.push('\n');

        report_content.push_str("## File Types Distribution (Top 10)\n\n");
        if result.file_types.is_empty() {
            report_content.push_str("No file types discovered.\n");
        } else {
            report_content.push_str("| Extension | File Count | Percentage |\n");
            report_content.push_str("|-----------|------------|------------|\n");
            let mut sorted_types: Vec<_> = result.file_types.iter().collect();
            sorted_types.sort_by(|a, b| b.1.cmp(a.1));
            for (ext, count) in sorted_types.iter().take(10) {
                let pct = if result.total_files > 0 {
                    (*(*count) as f64 / result.total_files as f64) * 100.0
                } else {
                    0.0
                };
                let ext_display = if ext.is_empty() { "no-extension" } else { ext };
                report_content.push_str(&format!(
                    "| `.{}` | {} | {:.2}% |\n",
                    ext_display, count, pct
                ));
            }
        }
        report_content.push('\n');

        report_content.push_str("## Recommendations\n\n");
        if result.total_size_bytes > 1024 * 1024 * 1024 {
            report_content.push_str("- ⚠️ **Large directory footprint:** Total size exceeds 1 GB. Consider checking for duplicates or stale caches.\n");
        } else {
            report_content.push_str(
                "- ✅ **Healthy directory footprint:** Total size is within moderate limits.\n",
            );
        }

        let has_node_modules = result
            .largest_files
            .iter()
            .any(|(p, _)| p.contains("node_modules"));
        if has_node_modules {
            report_content.push_str("- 📦 **Unused node_modules detected:** Running node modules cleanup could save significant disk space.\n");
        }

        report_content.push_str("- 💡 Run with `--clean` to find and eliminate space wasted by duplicate files using high-performance hard-linking.\n");

        let report_path = std::fs::canonicalize(Path::new(&cli.path))
            .unwrap_or_else(|_| Path::new(".").to_path_buf())
            .join("space-analyzer-report.md");
        if let Err(e) = fs::write(&report_path, report_content) {
            eprintln!("[REPORT] ❌ Failed to write report: {}", e);
        } else {
            println!(
                "[REPORT] Detailed markdown report successfully written to: {}",
                report_path.display()
            );
        }
    }

    if cli.clean {
        println!("[CLEAN] Scanning for duplicate files...");
        let config = DeduplicationConfig {
            min_file_size: 1024,
            dry_run: true,
            create_hard_links: true,
            ..Default::default()
        };
        let deduplicator = FileDeduplicator::with_config(config);
        match deduplicator.scan_directory(&cli.path) {
            Ok(files) => {
                let duplicate_groups = deduplicator.find_duplicates(files);
                if duplicate_groups.is_empty() {
                    println!("[CLEAN] ✅ No duplicate files found!");
                } else {
                    let total_duplicates: usize =
                        duplicate_groups.iter().map(|g| g.files.len() - 1).sum();
                    let potential_savings: u64 = duplicate_groups
                        .iter()
                        .map(|g| g.size * (g.files.len() as u64 - 1))
                        .sum();

                    println!(
                        "[CLEAN] 🔗 Found {} duplicate groups ({} duplicate files).",
                        duplicate_groups.len(),
                        total_duplicates
                    );
                    println!(
                        "[CLEAN] 💾 Potential space savings: {}",
                        format_bytes(potential_savings)
                    );

                    println!("\nDuplicates Breakdown:");
                    for (i, group) in duplicate_groups.iter().enumerate().take(10) {
                        println!(
                            "  Group {}: size: {}, hash: {}",
                            i + 1,
                            format_bytes(group.size),
                            &group.hash[..8]
                        );
                        for f in &group.files {
                            println!("    📄 {}", f.path.display());
                        }
                    }
                    if duplicate_groups.len() > 10 {
                        println!("  ... and {} more groups", duplicate_groups.len() - 10);
                    }

                    println!("\n[CLEAN] (Dry run is active. No files were modified. To perform actual hard-link deduplication, use the desktop GUI app or the dedicated file-deduplicator CLI tool.)");
                }
            }
            Err(e) => {
                eprintln!("[CLEAN] ❌ Error scanning for duplicates: {}", e);
            }
        }
    }

    Ok(())
}
