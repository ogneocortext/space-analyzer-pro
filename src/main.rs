use clap::Parser;
use file_deduplicator::{DeduplicationConfig, FileDeduplicator};
use shared_scanner::{FileScanner, ScanOptions};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::Instant;
use walkdir::WalkDir;

mod cli;

use cli::Cli;

// ─── Enhanced scan result that captures everything the scanner provides ─────

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct ScanResult {
    total_files: usize,
    total_dirs: u64,
    total_size_bytes: u64,
    total_size_mb: f64,
    duration_secs: f64,
    file_types: HashMap<String, usize>,
    extension_sizes: HashMap<String, u64>,
    largest_files: Vec<(String, u64)>,
    top_directories: Vec<DirEntry>,
    empty_dirs: Vec<String>,
    errors: Vec<String>,
    path: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct DirEntry {
    path: String,
    name: String,
    total_size: u64,
    file_count: u64,
    dir_count: u64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct DiskInfo {
    mount_point: String,
    total_bytes: u64,
    used_bytes: u64,
    available_bytes: u64,
    usage_percent: f32,
}

impl ScanResult {
    fn new() -> Self {
        Self {
            total_files: 0,
            total_dirs: 0,
            total_size_bytes: 0,
            total_size_mb: 0.0,
            duration_secs: 0.0,
            file_types: HashMap::new(),
            extension_sizes: HashMap::new(),
            largest_files: Vec::new(),
            top_directories: Vec::new(),
            empty_dirs: Vec::new(),
            errors: Vec::new(),
            path: String::new(),
        }
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/// Parse a human-readable size string like "1M", "500K", "2G" into bytes.
fn parse_size(s: &str) -> Result<u64, String> {
    let s = s.trim().to_uppercase();
    let (num_str, unit) = if let Some(last) = s.chars().last() {
        if last.is_alphabetic() {
            let (n, u) = s.split_at(s.len() - 1);
            (n, u)
        } else {
            (s.as_str(), "")
        }
    } else {
        return Err("Empty size string".to_string());
    };

    let num: f64 = num_str
        .parse()
        .map_err(|e| format!("Invalid number '{}': {}", num_str, e))?;

    match unit {
        "" | "B" => Ok(num as u64),
        "K" | "KB" => Ok((num * 1024.0) as u64),
        "M" | "MB" => Ok((num * 1024.0 * 1024.0) as u64),
        "G" | "GB" => Ok((num * 1024.0 * 1024.0 * 1024.0) as u64),
        "T" | "TB" => Ok((num * 1024.0 * 1024.0 * 1024.0 * 1024.0) as u64),
        _ => Err(format!("Unknown unit '{}'. Use B, K(KB), M(MB), G(GB), or T(TB)", unit)),
    }
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

fn validate_input(path: &str, format: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    let scan_path = Path::new(path);
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

// ─── Scanning ──────────────────────────────────────────────────────────────

fn scan_directory(
    path: &Path,
    verbose: bool,
    deep: bool,
    min_size: Option<u64>,
) -> std::io::Result<ScanResult> {
    if verbose {
        eprintln!("[SCAN] Scanning: {}", path.display());
        if deep {
            eprintln!("[SCAN] Mode: deep (unlimited depth)");
        }
        if let Some(ms) = min_size {
            eprintln!("[SCAN] Minimum file size: {}", format_bytes(ms));
        }
    }

    let start_time = Instant::now();
    let scanner = FileScanner::new();
    let options = if deep {
        ScanOptions::deep()
    } else {
        ScanOptions::medium()
    };

    let shared_result = scanner
        .scan_directory_sync(path.to_str().unwrap_or("."), options)
        .map_err(|e| std::io::Error::other(e.to_string()))?;

    let duration = start_time.elapsed().as_secs_f64();
    if verbose {
        eprintln!("[SCAN] Completed in {:.2}s", duration);
    }

    // Walk the directory ourselves for extension sizes, directory sizes at ALL depths,
    // and file size tracking. This gives us much richer data than the scanner's
    // first-level-only subdirectory info.
    let mut extension_sizes: HashMap<String, u64> = HashMap::new();
    let mut dir_sizes: HashMap<String, (u64, u64, u64)> = HashMap::new(); // path -> (size, file_count, dir_count)
    let mut filtered_file_count: usize = 0;
    let mut filtered_total_size: u64 = 0;

    let scan_depth = if deep { usize::MAX } else { 5 };
    let walker = WalkDir::new(path).max_depth(scan_depth).into_iter();

    for entry in walker.filter_map(|e| e.ok()) {
        let entry_path = entry.path();

        if entry.file_type().is_file() {
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let size = metadata.len();
            filtered_total_size += size;
            filtered_file_count += 1;

            // Track extension sizes
            let ext = entry_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            *extension_sizes.entry(ext).or_insert(0) += size;

            // Accumulate size for this file's parent directories (all levels)
            if let Some(parent) = entry_path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                let entry = dir_sizes.entry(parent_str).or_insert((0, 0, 0));
                entry.0 += size;
                entry.1 += 1;
            }
        } else if entry.file_type().is_dir() && entry.depth() > 0 {
            // Count subdirectories for their parents
            if let Some(parent) = entry_path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                let e = dir_sizes.entry(parent_str).or_insert((0, 0, 0));
                e.2 += 1;
            }
        }
    }

    let mut result = ScanResult::new();
    result.total_files = filtered_file_count;
    result.total_dirs = shared_result.total_directories;
    result.total_size_bytes = filtered_total_size;
    result.total_size_mb = filtered_total_size as f64 / (1024.0 * 1024.0);
    result.duration_secs = duration;
    result.path = path.to_string_lossy().to_string();
    result.errors = shared_result.errors;

    for (ext, count) in shared_result.file_types {
        result.file_types.insert(ext, count as usize);
    }

    result.extension_sizes = extension_sizes;

    // Build directory entries from our walk, sorted by size
    let scan_path_str = path.to_string_lossy().to_string();
    let mut top_dirs: Vec<DirEntry> = dir_sizes
        .into_iter()
        .filter(|(p, (sz, _, _))| *sz > 0 && p != &scan_path_str)
        .map(|(p, (size, file_count, dir_count))| {
            let name = Path::new(&p)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());
            DirEntry {
                path: p,
                name,
                total_size: size,
                file_count,
                dir_count,
            }
        })
        .collect();
    top_dirs.sort_by(|a, b| b.total_size.cmp(&a.total_size));
    result.top_directories = top_dirs;

    // Collect largest files
    for file in shared_result.largest_files.into_iter().take(50) {
        result.largest_files.push((file.path, file.size));
    }

    result.empty_dirs = shared_result.empty_directories;

    Ok(result)
}

fn get_disk_info(path: &str) -> Option<DiskInfo> {
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let display = if let Ok(canonical) = std::fs::canonicalize(path) {
        let s = canonical.to_string_lossy().to_uppercase();
        // Strip \\?\ UNC prefix on Windows
        if s.starts_with("\\\\?\\") { s[4..].to_string() } else { s }
    } else {
        path.to_uppercase()
    };

    for disk in &disks {
        let mount = disk.mount_point().to_string_lossy().to_uppercase();
        if display.starts_with(&mount) {
            let total = disk.total_space();
            let available = disk.available_space();
            let used = total.saturating_sub(available);
            let usage = if total > 0 {
                (used as f32 / total as f32) * 100.0
            } else {
                0.0
            };
            return Some(DiskInfo {
                mount_point: mount,
                total_bytes: total,
                used_bytes: used,
                available_bytes: available,
                usage_percent: usage,
            });
        }
    }
    None
}

// ─── Output formatting ─────────────────────────────────────────────────────

fn print_text_results(result: &ScanResult, top_n: usize, verbose: bool) {
    // ── Header ──
    println!();
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           Space Analyzer Pro — Disk Space Report            ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();

    // ── Disk overview ──
    if let Some(disk) = get_disk_info(&result.path) {
        let bar_width = 40;
        let filled = (disk.usage_percent / 100.0 * bar_width as f32) as usize;
        let bar: String = "█".repeat(filled) + &"░".repeat(bar_width - filled);

        println!("💾 DISK OVERVIEW ({})", disk.mount_point);
        println!("   {} {:.1}% used", bar, disk.usage_percent);
        println!(
            "   Total: {} | Used: {} | Free: {}",
            format_bytes(disk.total_bytes),
            format_bytes(disk.used_bytes),
            format_bytes(disk.available_bytes)
        );
        println!();
    }

    // ── Scan summary ──
    println!("📊 SCAN SUMMARY");
    println!("   Path:     {}", result.path);
    println!("   Files:    {} files in {} directories", result.total_files, result.total_dirs);
    println!("   Total:    {} ({:.2} MB)", format_bytes(result.total_size_bytes), result.total_size_mb);
    println!("   Duration: {:.2} seconds", result.duration_secs);
    if !result.errors.is_empty() {
        println!("   Errors:   {} (access denied, etc.)", result.errors.len());
    }
    println!();

    // ── Top directories by size ──
    if !result.top_directories.is_empty() {
        println!("📁 TOP DIRECTORIES BY SIZE (showing {} of {})", top_n.min(result.top_directories.len()), result.top_directories.len());
        println!("   {:<8} {:<8} {:>10}  {}", "Files", "Dirs", "Size", "Path");
        println!("   {}─{:<8}─{}─{:>10}─{}", "─".repeat(3), "─".repeat(8), "─".repeat(3), "─".repeat(10), "─".repeat(30));

        for dir in result.top_directories.iter().take(top_n) {
            let pct = if result.total_size_bytes > 0 {
                (dir.total_size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            println!(
                "   {:<8} {:<8} {:>10} ({:5.1}%)  {}",
                dir.file_count,
                dir.dir_count,
                format_bytes(dir.total_size),
                pct,
                dir.path
            );
        }
        if result.top_directories.len() > top_n {
            let remaining: u64 = result.top_directories[top_n..]
                .iter()
                .map(|d| d.total_size)
                .sum();
            println!(
                "   ... and {} more directories ({})",
                result.top_directories.len() - top_n,
                format_bytes(remaining)
            );
        }
        println!();
    }

    // ── File type breakdown by size ──
    if !result.extension_sizes.is_empty() {
        let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
        ext_sizes.sort_by(|a, b| b.1.cmp(a.1));

        println!("📄 FILE TYPES BY SIZE (showing {} of {})", top_n.min(ext_sizes.len()), ext_sizes.len());
        println!("   {:<12} {:>8} {:>10}  {}", "Extension", "Count", "Size", "% of Total");
        println!("   {}─{:<12}─{}─{:>10}─{}", "─".repeat(3), "─".repeat(12), "─".repeat(8), "─".repeat(10), "─".repeat(12));

        for (ext, size) in ext_sizes.iter().take(top_n) {
            let count = result.file_types.get(*ext).unwrap_or(&0);
            let pct = if result.total_size_bytes > 0 {
                (**size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            let ext_display = if ext.is_empty() { "(no ext)" } else { ext };
            println!(
                "   .{:<11} {:>8} {:>10}  {:>5.1}%",
                ext_display,
                count,
                format_bytes(**size),
                pct
            );
        }
        println!();
    }

    // ── Largest files ──
    if !result.largest_files.is_empty() {
        println!("🏆 LARGEST FILES (top {})", top_n.min(result.largest_files.len()));
        for (i, (path, size)) in result.largest_files.iter().take(top_n).enumerate() {
            let pct = if result.total_size_bytes > 0 {
                (*size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            println!(
                "   {:>3}. {:>10} ({:5.1}%)  {}",
                i + 1,
                format_bytes(*size),
                pct,
                path
            );
        }
        println!();
    }

    // ── Installer & Executable Inventory ──
    print_installer_inventory(result);

    // ── Space-saving recommendations ──
    print_recommendations(result);

    // ── Verbose details ──
    if verbose {
        if !result.empty_dirs.is_empty() {
            println!("📂 EMPTY DIRECTORIES ({} found)", result.empty_dirs.len());
            for dir in result.empty_dirs.iter().take(20) {
                println!("   {}", dir);
            }
            if result.empty_dirs.len() > 20 {
                println!("   ... and {} more", result.empty_dirs.len() - 20);
            }
            println!();
        }
    }
}

fn print_recommendations(result: &ScanResult) {
    let mut recommendations: Vec<(u32, String)> = Vec::new();

    // Check disk usage
    if let Some(disk) = get_disk_info(&result.path) {
        if disk.usage_percent > 90.0 {
            recommendations.push((3, format!(
                "🔴 CRITICAL: Drive {} is {:.0}% full! Only {} free. Immediate cleanup recommended.",
                disk.mount_point, disk.usage_percent, format_bytes(disk.available_bytes)
            )));
        } else if disk.usage_percent > 80.0 {
            recommendations.push((2, format!(
                "🟡 WARNING: Drive {} is {:.0}% full. {} free. Consider cleanup soon.",
                disk.mount_point, disk.usage_percent, format_bytes(disk.available_bytes)
            )));
        }
    }

    // Check for Ollama models
    let ollama_size: u64 = result
        .largest_files
        .iter()
        .filter(|(p, _)| p.contains(".ollama") || p.contains("ollama"))
        .map(|(_, s)| s)
        .sum();
    if ollama_size > 1024 * 1024 * 1024 {
        recommendations.push((2, format!(
            "🤖 Ollama models are using {}. If you don't use all models, run `ollama rm <model>` to free space.",
            format_bytes(ollama_size)
        )));
    }

    // Check for large log files
    let log_size: u64 = result
        .extension_sizes
        .get("log")
        .copied()
        .unwrap_or(0);
    if log_size > 100 * 1024 * 1024 {
        recommendations.push((1, format!(
            "📝 Log files are using {} of disk space. Consider clearing old logs.",
            format_bytes(log_size)
        )));
    }

    // Check for old installer executables
    let exe_size: u64 = result
        .extension_sizes
        .get("exe")
        .copied()
        .unwrap_or(0);
    if exe_size > 500 * 1024 * 1024 {
        recommendations.push((1, format!(
            "📦 Installer/executable files are using {}. Check Downloads for old installers you no longer need.",
            format_bytes(exe_size)
        )));
    }

    // Check for WSL/VM images
    for (path, size) in &result.largest_files {
        if path.contains(".vhdx") || path.contains("ext4.vhdx") || path.contains("WSL") {
            if *size > 1024 * 1024 * 1024 {
                recommendations.push((2, format!(
                    "🖥️  WSL/VM disk image found: {} ({}) — Consider compacting or removing unused distributions.",
                    Path::new(path).file_name().unwrap_or_default().to_string_lossy(),
                    format_bytes(*size)
                )));
            }
        }
    }

    // Check for node_modules
    let has_node_modules = result
        .top_directories
        .iter()
        .any(|d| d.name == "node_modules");
    if has_node_modules {
        recommendations.push((1, "📦 node_modules directories found. Run `npm prune` or delete unused project dependencies.".to_string()));
    }

    // Check for large caches
    let cache_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| {
            d.name == "cache" || d.name == "Cache" || d.name == "temp" || d.name == "Temp"
        })
        .map(|d| d.total_size)
        .sum();
    if cache_size > 500 * 1024 * 1024 {
        recommendations.push((1, format!(
            "🗑️  Cache/temp directories are using {}. Consider clearing application caches.",
            format_bytes(cache_size)
        )));
    }

    // Check for duplicate file potential
    if result.total_files > 1000 {
        recommendations.push((0, "💡 Run with `--clean` to find duplicate files that can be deduplicated using hard links.".to_string()));
    }

    // Sort by priority (highest first)
    recommendations.sort_by(|a, b| b.0.cmp(&a.0));

    if !recommendations.is_empty() {
        println!("💡 RECOMMENDATIONS");
        for (_, msg) in &recommendations {
            println!("   {}", msg);
        }
        println!();
    }
}

// ─── Export and report ─────────────────────────────────────────────────────

fn export_results(result: &ScanResult, export_path: &str, format: &str) {
    let content = match format {
        "json" => serde_json::to_string_pretty(result).unwrap_or_default(),
        "csv" => {
            let mut csv = String::new();
            // Summary
            csv.push_str("section,key,value\n");
            csv.push_str(&format!("summary,total_files,{}\n", result.total_files));
            csv.push_str(&format!("summary,total_size_bytes,{}\n", result.total_size_bytes));
            csv.push_str(&format!("summary,duration_secs,{:.3}\n", result.duration_secs));
            csv.push('\n');

            // Extension sizes
            csv.push_str("extension,size_bytes,file_count\n");
            let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
            ext_sizes.sort_by(|a, b| b.1.cmp(a.1));
            for (ext, size) in &ext_sizes {
                let count = result.file_types.get(*ext).unwrap_or(&0);
                csv.push_str(&format!(".{},{},{}\n", ext, size, count));
            }
            csv.push('\n');

            // Top directories
            csv.push_str("directory,size_bytes,file_count,dir_count\n");
            for dir in &result.top_directories {
                csv.push_str(&format!(
                    "\"{}\",{},{},{}\n",
                    dir.path, dir.total_size, dir.file_count, dir.dir_count
                ));
            }
            csv.push('\n');

            // Largest files
            csv.push_str("file_path,size_bytes\n");
            for (path, size) in &result.largest_files {
                csv.push_str(&format!("\"{}\",{}\n", path, size));
            }
            csv
        }
        _ => format!(
            "Scan completed: {} files, {} total size",
            result.total_files,
            format_bytes(result.total_size_bytes)
        ),
    };

    match fs::write(export_path, &content) {
        Ok(()) => println!("✅ Results exported to: {}", export_path),
        Err(e) => eprintln!("❌ Failed to export: {}", e),
    }
}

fn generate_report(result: &ScanResult, path: &str, top_n: usize) -> String {
    let mut report = String::new();
    report.push_str("# Space Analyzer Pro — Disk Space Report\n\n");
    report.push_str(&format!(
        "**Generated:** {}\n",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    ));
    report.push_str(&format!("**Target:** `{}`\n\n", path));

    // Disk overview
    if let Some(disk) = get_disk_info(path) {
        report.push_str("## 💾 Disk Overview\n\n");
        report.push_str(&format!("| Metric | Value |\n|--------|-------|\n"));
        report.push_str(&format!(
            "| Drive | `{}` |\n",
            disk.mount_point
        ));
        report.push_str(&format!(
            "| Total | {} |\n",
            format_bytes(disk.total_bytes)
        ));
        report.push_str(&format!(
            "| Used | {} ({:.1}%) |\n",
            format_bytes(disk.used_bytes),
            disk.usage_percent
        ));
        report.push_str(&format!(
            "| Free | {} |\n\n",
            format_bytes(disk.available_bytes)
        ));
    }

    // Summary
    report.push_str("## 📊 Scan Summary\n\n");
    report.push_str(&format!("- **Total Files:** {}\n", result.total_files));
    report.push_str(&format!(
        "- **Total Size:** {} ({:.2} MB)\n",
        format_bytes(result.total_size_bytes),
        result.total_size_mb
    ));
    report.push_str(&format!(
        "- **Scan Duration:** {:.3} seconds\n\n",
        result.duration_secs
    ));

    // Top directories
    if !result.top_directories.is_empty() {
        report.push_str(&format!(
            "## 📁 Top {} Directories by Size\n\n",
            top_n.min(result.top_directories.len())
        ));
        report.push_str("| # | Size | % | Files | Path |\n");
        report.push_str("|---|------|---|-------|------|\n");
        for (i, dir) in result.top_directories.iter().take(top_n).enumerate() {
            let pct = if result.total_size_bytes > 0 {
                (dir.total_size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            report.push_str(&format!(
                "| {} | {} | {:.1}% | {} | `{}` |\n",
                i + 1,
                format_bytes(dir.total_size),
                pct,
                dir.file_count,
                dir.path
            ));
        }
        report.push('\n');
    }

    // Extension sizes
    if !result.extension_sizes.is_empty() {
        report.push_str("## 📄 File Types by Size\n\n");
        report.push_str("| Extension | Size | Count | % of Total |\n");
        report.push_str("|-----------|------|-------|------------|\n");
        let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
        ext_sizes.sort_by(|a, b| b.1.cmp(a.1));
        for (ext, size) in ext_sizes.iter().take(top_n) {
            let count = result.file_types.get(*ext).unwrap_or(&0);
            let pct = if result.total_size_bytes > 0 {
                (**size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            let ext_display = if ext.is_empty() { "(no ext)" } else { ext };
            report.push_str(&format!(
                "| `.{}` | {} | {} | {:.1}% |\n",
                ext_display, format_bytes(**size), count, pct
            ));
        }
        report.push('\n');
    }

    // Largest files
    if !result.largest_files.is_empty() {
        report.push_str(&format!(
            "## 🏆 Largest Files (Top {})\n\n",
            top_n.min(result.largest_files.len())
        ));
        report.push_str("| # | Size | % | Path |\n");
        report.push_str("|---|------|---|------|\n");
        for (i, (path, size)) in result.largest_files.iter().take(top_n).enumerate() {
            let pct = if result.total_size_bytes > 0 {
                (*size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            report.push_str(&format!(
                "| {} | {} | {:.1}% | `{}` |\n",
                i + 1,
                format_bytes(*size),
                pct,
                path
            ));
        }
        report.push('\n');
    }

    // Installer inventory
    let mut installers: Vec<(&str, u64)> = result
        .largest_files
        .iter()
        .filter(|(p, _)| {
            let lower = p.to_lowercase();
            lower.ends_with(".exe") || lower.ends_with(".msi") || lower.ends_with(".rar")
                || lower.ends_with(".zip") || lower.ends_with(".dmg") || lower.ends_with(".deb")
                || lower.ends_with(".rpm") || lower.ends_with(".pkg")
        })
        .map(|(p, s)| (p.as_str(), *s))
        .collect();
    installers.sort_by(|a, b| b.1.cmp(&a.1));

    if !installers.is_empty() {
        let total_inst_size: u64 = installers.iter().map(|(_, s)| *s).sum();
        report.push_str(&format!("## 📦 Installer & Executable Inventory\n\n"));
        report.push_str(&format!("**Total:** {} across {} files\n\n", format_bytes(total_inst_size), installers.len()));
        report.push_str("These files are likely safe to delete after installation.\n\n");

        // Categorize
        let mut gpu_cuda = Vec::new();
        let mut drivers = Vec::new();
        let mut apps = Vec::new();
        let mut other = Vec::new();

        for &(path, size) in &installers {
            let lower = path.to_lowercase();
            if lower.contains("driver") || lower.contains("realtek") || lower.contains("mb_driver") {
                drivers.push((path, size));
            } else if lower.contains("cuda") || lower.contains("nvidia")
                || lower.contains("596.21-desktop") || lower.contains("amd_ryzen")
            {
                gpu_cuda.push((path, size));
            } else if lower.contains("setup") || lower.contains("installer") || lower.contains("user")
                || lower.ends_with(".msi") || lower.contains("desktop")
            {
                apps.push((path, size));
            } else {
                other.push((path, size));
            }
        }

        for (label, group) in [("🖥️ GPU/Drivers/Chipset", &gpu_cuda), ("🔧 Drivers", &drivers), ("📱 Application Installers", &apps), ("📄 Archives/Other", &other)] {
            if !group.is_empty() {
                let group_size: u64 = group.iter().map(|(_, s)| *s).sum();
                report.push_str(&format!("### {} ({})\n\n", label, format_bytes(group_size)));
                report.push_str("| Size | File |\n|------|------|\n");
                for (path, size) in group.iter().take(15) {
                    report.push_str(&format!("| {} | `{}` |\n", format_bytes(*size), path));
                }
                report.push('\n');
            }
        }

        report.push_str("> **Tip:** Delete old installer/run files after installation. Driver/GPU installers are safe to remove if already installed.\n\n");
    }

    report
}

// ─── Installer/Executable inventory ────────────────────────────────────────

fn print_installer_inventory(result: &ScanResult) {
    // Find all installer/executable files
    let mut installers: Vec<(&str, u64)> = result
        .largest_files
        .iter()
        .filter(|(p, _)| {
            let lower = p.to_lowercase();
            lower.ends_with(".exe") || lower.ends_with(".msi") || lower.ends_with(".rar")
                || lower.ends_with(".zip") || lower.ends_with(".dmg") || lower.ends_with(".deb")
                || lower.ends_with(".rpm") || lower.ends_with(".pkg")
        })
        .map(|(p, s)| (p.as_str(), *s))
        .collect();
    installers.sort_by(|a, b| b.1.cmp(&a.1));

    if installers.is_empty() {
        return;
    }

    let total_size: u64 = installers.iter().map(|(_, s)| *s).sum();
    println!("📦 INSTALLER & EXECUTABLE INVENTORY ({}, {} files)", format_bytes(total_size), installers.len());
    println!("   These are likely safe to delete after installation. Sort by size and remove oldest/unneeded.");
    println!();

    // Categorize by name patterns
    let mut driver_installers = Vec::new();
    let mut gpu_cuda_installers = Vec::new();
    let mut app_installers = Vec::new();
    let mut other_installers = Vec::new();

    for &(path, size) in &installers {
        let lower = path.to_lowercase();
        if lower.contains("driver") || lower.contains("realtek") || lower.contains("mb_driver") {
            driver_installers.push((path, size));
        } else if lower.contains("cuda") || lower.contains("nvidia")
            || lower.contains("596.21-desktop") || lower.contains("amd_ryzen")
        {
            gpu_cuda_installers.push((path, size));
        } else {
            // Check if it's an app installer
            if lower.contains("setup") || lower.contains("installer") || lower.contains("user")
                || lower.ends_with(".msi") || lower.contains("desktop")
            {
                app_installers.push((path, size));
            } else {
                other_installers.push((path, size));
            }
        }
    }

    if !gpu_cuda_installers.is_empty() {
        let size: u64 = gpu_cuda_installers.iter().map(|(_, s)| *s).sum();
        println!("   ┌─ 🖥️  GPU/Drivers/Chipset: {} total ──────────────┐", format_bytes(size));
        for (path, size) in gpu_cuda_installers.iter().take(10) {
            let name = Path::new(path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    if !driver_installers.is_empty() {
        let size: u64 = driver_installers.iter().map(|(_, s)| *s).sum();
        println!("   ┌─ 🔧 Drivers: {} total ──────────────────────────┐", format_bytes(size));
        for (path, size) in driver_installers.iter().take(10) {
            let name = Path::new(path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    if !app_installers.is_empty() {
        let size: u64 = app_installers.iter().map(|(_, s)| *s).sum();
        println!("   ┌─ 📱 Application Installers: {} total ──────────┐", format_bytes(size));
        for (path, size) in app_installers.iter().take(10) {
            let name = Path::new(path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        if app_installers.len() > 10 {
            println!("   │  ... and {} more ({})  ",
                app_installers.len() - 10,
                format_bytes(app_installers[10..].iter().map(|(_, s)| *s).sum::<u64>())
            );
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    if !other_installers.is_empty() {
        let size: u64 = other_installers.iter().map(|(_, s)| *s).sum();
        println!("   ┌─ 📄 Archives/Other: {} total ─────────────────┐", format_bytes(size));
        for (path, size) in other_installers.iter().take(10) {
            let name = Path::new(path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        if other_installers.len() > 10 {
            println!("   │  ... and {} more ({})  ",
                other_installers.len() - 10,
                format_bytes(other_installers[10..].iter().map(|(_, s)| *s).sum::<u64>())
            );
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    println!("   💡 To safely reclaim space: sort by size, delete old installers that are no longer needed.");
    println!("      Driver/GPU installers (CUDA, NVIDIA) are safe to remove if already installed.");
    println!();
}

// ─── Duplicate analysis ────────────────────────────────────────────────────

fn run_clean_analysis(path: &str) {
    println!("🔗 DUPLICATE FILE ANALYSIS");
    println!("   Scanning for duplicate files (this may take a while)...");
    println!();

    let config = DeduplicationConfig {
        min_file_size: 1024,
        dry_run: true,
        create_hard_links: true,
        ..Default::default()
    };
    let deduplicator = FileDeduplicator::with_config(config);
    match deduplicator.scan_directory(path) {
        Ok(files) => {
            let duplicate_groups = deduplicator.find_duplicates(files);
            if duplicate_groups.is_empty() {
                println!("   ✅ No duplicate files found!");
            } else {
                let total_duplicates: usize =
                    duplicate_groups.iter().map(|g| g.files.len() - 1).sum();
                let potential_savings: u64 = duplicate_groups
                    .iter()
                    .map(|g| g.size * (g.files.len() as u64 - 1))
                    .sum();

                println!(
                    "   Found {} duplicate groups ({} duplicate files)",
                    duplicate_groups.len(),
                    total_duplicates
                );
                println!(
                    "   💾 Potential space savings: {}",
                    format_bytes(potential_savings)
                );
                println!();

                // Sort groups by total waste (size * num_duplicates)
                let mut sorted_groups = duplicate_groups;
                sorted_groups.sort_by(|a, b| {
                    let waste_a = a.size * (a.files.len() as u64 - 1);
                    let waste_b = b.size * (b.files.len() as u64 - 1);
                    waste_b.cmp(&waste_a)
                });

                println!("   Top duplicates by wasted space:");
                for (i, group) in sorted_groups.iter().take(15).enumerate() {
                    let waste = group.size * (group.files.len() as u64 - 1);
                    println!(
                        "   {:>2}. {} × {} copies = {} wasted  [{}]",
                        i + 1,
                        format_bytes(group.size),
                        group.files.len(),
                        format_bytes(waste),
                        &group.hash[..12]
                    );
                    for f in &group.files {
                        println!("       📄 {}", f.path.display());
                    }
                }
                if sorted_groups.len() > 15 {
                    println!(
                        "   ... and {} more groups",
                        sorted_groups.len() - 15
                    );
                }

                println!();
                println!("   ℹ️  Dry run only — no files were modified.");
                println!("   To deduplicate, use the GUI or the file-deduplicator binary with dry_run=false.");
            }
        }
        Err(e) => {
            eprintln!("   ❌ Error scanning for duplicates: {}", e);
        }
    }
}

// ─── Main ──────────────────────────────────────────────────────────────────

fn main() -> std::io::Result<()> {
    let cli = Cli::parse();

    // Validate inputs
    if let Err(error) = validate_input(&cli.path, &cli.format) {
        eprintln!("❌ {}", error);
        std::process::exit(1);
    }

    // Parse min_size
    let min_size = match &cli.min_size {
        Some(s) => match parse_size(s) {
            Ok(size) => Some(size),
            Err(e) => {
                eprintln!("❌ Invalid --min-size: {}", e);
                std::process::exit(1);
            }
        },
        None => None,
    };

    // Only show header for non-JSON formats
    if cli.format == "text" {
        eprintln!(
            "=> Space Analyzer Pro v{}",
            env!("CARGO_PKG_VERSION")
        );
    }

    let scan_path = Path::new(&cli.path);
    let result = scan_directory(scan_path, cli.verbose && cli.format != "json", cli.deep, min_size)?;

    // Print results
    match cli.format.as_str() {
        "text" => print_text_results(&result, cli.top, cli.verbose),
        "json" => {
            let json_output = serde_json::to_string_pretty(&result).unwrap_or_default();
            println!("{}", json_output);
        }
        "csv" => {
            // CSV output
            println!("section,key,value");
            println!(
                "summary,total_files,{}",
                result.total_files
            );
            println!(
                "summary,total_size_bytes,{}",
                result.total_size_bytes
            );
            println!(
                "summary,duration_secs,{:.3}",
                result.duration_secs
            );
            println!();
            println!("extension,size_bytes,file_count");
            let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
            ext_sizes.sort_by(|a, b| b.1.cmp(a.1));
            for (ext, size) in &ext_sizes {
                let count = result.file_types.get(*ext).unwrap_or(&0);
                println!(".{},{},{}", ext, size, count);
            }
            println!();
            println!("directory,size_bytes,file_count,dir_count");
            for dir in &result.top_directories {
                println!(
                    "\"{}\",{},{},{}",
                    dir.path, dir.total_size, dir.file_count, dir.dir_count
                );
            }
            println!();
            println!("file_path,size_bytes");
            for (path, size) in &result.largest_files {
                println!("\"{}\",{}", path, size);
            }
        }
        _ => unreachable!(),
    }

    // Channel output
    if let Some(channel_dir) = &cli.channel {
        let payload = serde_json::json!({
            "path": scan_path.to_string_lossy().to_string(),
            "total_files": result.total_files,
            "total_size_bytes": result.total_size_bytes,
            "total_size_mb": result.total_size_mb,
            "duration_secs": result.duration_secs,
            "file_types": result.file_types,
            "extension_sizes": result.extension_sizes,
            "top_directories": result.top_directories,
            "largest_files": result.largest_files,
        });
        let _ = fs::create_dir_all(channel_dir);
        let target = std::path::Path::new(channel_dir).join("scan-channel.json");
        let _ = fs::write(
            &target,
            serde_json::to_string_pretty(&payload).unwrap_or_default(),
        );
        eprintln!("[CHANNEL] Scan result dropped to: {}", target.display());
    }

    // Export
    if let Some(export_path) = &cli.export {
        export_results(&result, export_path, &cli.format);
    }

    // Report
    if cli.report {
        let report_content = generate_report(&result, &cli.path, cli.top);
        // Write report to the project's reports directory
        let reports_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("reports");
        let _ = fs::create_dir_all(&reports_dir);
        // Use a timestamped filename to avoid overwriting previous reports
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let target_dir_name = Path::new(&cli.path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "scan".to_string());
        let report_filename = format!("{}_{}.md", target_dir_name, timestamp);
        let report_path = reports_dir.join(&report_filename);
        match fs::write(&report_path, &report_content) {
            Ok(()) => eprintln!("✅ Report written to: {}", report_path.display()),
            Err(e) => eprintln!("❌ Failed to write report: {}", e),
        }
    }

    // Duplicate analysis
    if cli.clean {
        run_clean_analysis(&cli.path);
    }

    Ok(())
}