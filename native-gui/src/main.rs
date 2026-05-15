mod app;
mod types;
mod scanner;
mod charts;
mod theme;
mod ollama_cuda;

use app::{SpaceAnalyzerApp, categorize_ext};
use std::path::Path;

fn print_usage() {
    eprintln!("Usage:");
    eprintln!("  space-analyzer                    Launch GUI");
    eprintln!("  space-analyzer --scan <path>      Headless scan, print JSON summary to stdout");
}

fn run_headless_scan(path: &str) -> Result<(), String> {
    let scanner = scanner::FileScanner::new();
    let start = std::time::Instant::now();

    eprintln!("Scanning: {}", path);

    let result = scanner.scan_directory_sync(path, shared_scanner::ScanOptions::default())
        .map_err(|e| format!("Scan failed: {}", e))?;

    let elapsed_ms = start.elapsed().as_millis() as u64;

    let ts = chrono::Local::now();

    let mut categories: std::collections::HashMap<String, serde_json::Value> = std::collections::HashMap::new();
    let mut ext_stats: std::collections::HashMap<String, serde_json::Value> = std::collections::HashMap::new();
    for (ext, count) in &result.file_types {
        let cat = categorize_ext(ext);
        let entry = categories.entry(cat.to_string()).or_insert_with(|| serde_json::json!({"count": 0, "size": 0}));
        entry["count"] = serde_json::json!(entry["count"].as_u64().unwrap_or(0) + count);
        ext_stats.insert(ext.to_string(), serde_json::json!({"count": count, "size": 0}));
    }

    let files: Vec<serde_json::Value> = result.largest_files.iter().map(|f| {
        serde_json::json!({
            "name": f.name, "path": f.path,
            "size": {"bytes": f.size, "formatted": shared_scanner::format_bytes(f.size), "on_disk": null},
            "extension": f.extension, "category": categorize_ext(&f.extension),
            "timestamps": {"created": null, "modified": f.modified, "accessed": null},
            "file_hash": null, "is_hard_link": false,
            "attributes": {"is_readonly": false, "is_hidden": false, "is_system": false, "has_ads": false,
                "ads_count": 0, "is_compressed": false, "compressed_size": null, "is_sparse": false,
                "is_reparse_point": false, "reparse_tag": null, "owner": null}
        })
    }).collect();

    let output = serde_json::json!({
        "schema_version": "2.0",
        "generated_at": ts.to_rfc3339(),
        "scanner_version": "space-analyzer-native/headless-1.0",
        "scan_config": {"path": path, "max_files": 0, "include_hidden": false, "follow_symlinks": false, "json_progress": false},
        "summary": {"total_files": result.total_files, "total_size": result.total_size,
            "scan_duration_ms": elapsed_ms, "files_scanned_per_second": 0, "bytes_scanned_per_second": 0},
        "file_analysis": {"files": files, "categories": categories, "extension_stats": ext_stats,
            "duplicate_groups": [], "duplicate_count": 0, "duplicate_size": 0,
            "hard_link_count": 0, "hard_link_savings": 0, "apparent_size": result.total_size},
        "performance": {"scan_duration_ms": elapsed_ms, "files_per_second": 0, "bytes_per_second": 0,
            "memory_peak_mb": null, "memory_current_mb": null, "disk_reads": null, "disk_bytes_read": null,
            "cache_hits": null, "cache_misses": null, "cpu_usage_percent": null, "thread_count": null,
            "io_wait_time_ms": null, "system_load_average": null},
        "issues": {"errors": result.errors, "warnings": []}
    });

    println!("{}", serde_json::to_string_pretty(&output).unwrap());

    let dir = Path::new("scan_results");
    let _ = std::fs::create_dir_all(dir);
    let slug: String = Path::new(path).file_name()
        .map(|n| n.to_string_lossy())
        .unwrap_or(std::borrow::Cow::Borrowed("root"))
        .chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let fname = format!("scan_{}_{}.json", ts.format("%Y-%m-%d_%H-%M-%S"), slug);
    let save_path = dir.join(&fname);
    if let Ok(json) = serde_json::to_string_pretty(&output) {
        let _ = std::fs::write(&save_path, &json);
    }
    eprintln!("Saved: {}", save_path.display());
    eprintln!("Summary: {} files, {} dirs, {} — {} ms",
        result.total_files, result.total_directories, shared_scanner::format_bytes(result.total_size), elapsed_ms);

    Ok(())
}

fn categorize_ext(ext: &str) -> &'static str {
    match ext {
        "md" | "txt" | "doc" | "docx" | "pdf" | "rtf" => "Documents",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "ico" | "webp" => "Images",
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" => "Video",
        "mp3" | "wav" | "flac" | "ogg" | "aac" | "wma" => "Audio",
        "zip" | "tar" | "gz" | "7z" | "rar" | "bz2" | "xz" => "Archives",
        "rs" | "py" | "js" | "ts" | "java" | "c" | "cpp" | "h" | "go" | "rb" => "Code",
        "html" | "css" | "scss" | "less" | "jsx" | "tsx" | "vue" => "Web",
        "json" | "xml" | "yaml" | "yml" | "toml" | "ini" | "cfg" => "Config",
        "exe" | "dll" | "so" | "dylib" | "bin" => "Binary",
        _ => "Other",
    }
}

fn main() -> Result<(), eframe::Error> {
    let args: Vec<String> = std::env::args().collect();

    // Headless mode
    if args.len() >= 3 && args[1] == "--scan" {
        let path = &args[2];
        match run_headless_scan(path) {
            Ok(()) => std::process::exit(0),
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
    }

    if args.len() > 1 && args[1] != "--scan" {
        print_usage();
        std::process::exit(1);
    }

    // GUI mode
    env_logger::init();

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1200.0, 800.0])
            .with_min_inner_size([800.0, 600.0])
            .with_title("Space Analyzer - Native Edition"),
        ..Default::default()
    };

    eframe::run_native(
        "Space Analyzer",
        options,
        Box::new(|cc| {
            theme::install(cc);
            Ok(Box::new(SpaceAnalyzerApp::new()))
        }),
    )
}
