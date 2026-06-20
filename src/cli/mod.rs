pub mod args;
pub mod dedup;
pub mod helpers;
pub mod output;
pub mod recommendations;
pub mod report;
pub mod scan;
pub mod types;

use args::Cli;
use clap::Parser;
use space_analyzer_pro_desktop::error::AppResult;
use std::fs;
use std::path::Path;

use crate::animation;

pub fn main() -> AppResult<()> {
    let cli = Cli::parse();

    helpers::validate_input(&cli.path, &cli.format)?;

    let min_size = cli
        .min_size
        .as_ref()
        .map(|size| helpers::parse_size(size))
        .transpose()?;

    let max_size = cli
        .max_size
        .as_ref()
        .map(|size| helpers::parse_size(size))
        .transpose()?;

    if cli.format == "text" && !cli.no_animation {
        animation::print_animated_banner();
    }

    let scan_path = Path::new(&cli.path);
    let result = scan::scan_directory(
        scan_path,
        cli.verbose && cli.format != "json" && !cli.no_animation,
        cli.max_depth,
        cli.deep,
        min_size,
        max_size,
        cli.include_hidden,
        cli.no_animation,
    )?;

    if cli.format == "text" && !cli.no_animation {
        animation::print_completion_animation(result.duration_secs);
    }
    match cli.format.as_str() {
        "text" => output::print_text_results(&result, cli.top, cli.verbose, cli.no_animation),
        "json" => {
            let json_output = serde_json::to_string_pretty(&result).unwrap_or_default();
            println!("{}", json_output);
        }
        "csv" => output::print_csv(&result),
        _ => unreachable!(),
    }

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

    if let Some(export_path) = &cli.export {
        report::export_results(&result, export_path, &cli.format);
    }

    if cli.report {
        let report_content = report::generate_report(&result, &cli.path, cli.top);
        let reports_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("reports");
        let _ = fs::create_dir_all(&reports_dir);
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let sanitized_path: String = cli
            .path
            .chars()
            .filter(|c| !['\\', '/', ':'].contains(c))
            .collect();
        let path_hash = {
            let mut h: u32 = 0;
            for b in sanitized_path.bytes() {
                h = h.wrapping_mul(31).wrapping_add(b as u32);
            }
            format!("{:08x}", h)
        };
        let report_filename = format!("{}_{}_{}.md", sanitized_path, timestamp, path_hash);
        let report_path = reports_dir.join(&report_filename);
        match fs::write(&report_path, &report_content) {
            Ok(()) => eprintln!("✅ Report written to: {}", report_path.display()),
            Err(e) => eprintln!("❌ Failed to write report: {}", e),
        }
    }

    if let Ok(db) = space_analyzer_pro_desktop::database::Database::default_open() {
        let _ = db.save_scan(&result, cli.deep || cli.verbose);
    }

    if cli.clean {
        dedup::run_clean_analysis(&cli.path);
    }

    if cli.cleanup_recommendations {
        recommendations::print_cleanup_recommendations(&result);
    }

    Ok(())
}
