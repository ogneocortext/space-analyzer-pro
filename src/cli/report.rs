use std::fs;

use crate::cli::helpers;
use crate::cli::origins;
use crate::cli::render;
use crate::cli::types::ScanResult;
use shared_scanner::format_bytes;

pub fn export_results(result: &ScanResult, export_path: &str, format: &str) {
    let content = match format {
        "json" => serde_json::to_string_pretty(result).unwrap_or_default(),
        "jsonl" => generate_jsonl(result),
        "csv" => render::build_csv(result),
        "md" | "markdown" => generate_report(result, &result.path, 20),
        _ => generate_report(result, &result.path, 20),
    };

    match fs::write(export_path, &content) {
        Ok(()) => println!("✅ Results exported to: {}", export_path),
        Err(e) => eprintln!("❌ Failed to export: {}", e),
    }
}

pub fn generate_jsonl(result: &ScanResult) -> String {
    let mut buf = Vec::new();
    let _ = serde_json::to_writer(&mut buf, result);
    String::from_utf8_lossy(&buf).into_owned()
}

pub fn generate_report(result: &ScanResult, path: &str, top_n: usize) -> String {
    let mut report = String::new();
    report.push_str("# Space Analyzer Pro — Disk Space Report\n\n");
    report.push_str(&format!(
        "**Generated:** {}\n",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    ));
    report.push_str(&format!("**Target:** `{}`\n\n", path));

    if let Some(disk) = helpers::get_disk_info(path) {
        report.push_str("## 💾 Disk Overview\n\n");
        report.push_str("| Metric | Value |\n|--------|-------|\n");
        report.push_str(&format!("| Drive | `{}` |\n", disk.mount_point));
        report.push_str(&format!("| Total | {} |\n", format_bytes(disk.total_bytes)));
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

    if !result.top_directories.is_empty() {
        report.push_str(&format!(
            "## 📁 Top {} Directories by Size\n\n",
            top_n.min(result.top_directories.len())
        ));
        report.push_str("| # | Size | % | Files | Path |\n");
        report.push_str("|---|------|---|-------|------|\n");
        for (i, dir) in result.top_directories.iter().take(top_n).enumerate() {
            let pct = render::pct_of(dir.total_size, result.total_size_bytes);
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

    if !result.extension_sizes.is_empty() {
        report.push_str("## 📄 File Types by Size\n\n");
        report.push_str("| Extension | Size | Count | % of Total |\n");
        report.push_str("|-----------|------|-------|------------|\n");
        let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
        ext_sizes.sort_by(|a, b| b.1.cmp(a.1));
        for (ext, size) in ext_sizes.iter().take(top_n) {
            let count = result.file_types.get(*ext).unwrap_or(&0);
            let pct = render::pct_of(**size, result.total_size_bytes);
            let ext_display = if ext.is_empty() { "(no ext)" } else { ext };
            report.push_str(&format!(
                "| `.{}` | {} | {} | {:.1}% |\n",
                ext_display,
                format_bytes(**size),
                count,
                pct
            ));
        }
        report.push('\n');
    }

    if !result.largest_files.is_empty() {
        report.push_str(&format!(
            "## 🏆 Largest Files (Top {})\n\n",
            top_n.min(result.largest_files.len())
        ));
        report.push_str("| # | Size | % | Path |\n");
        report.push_str("|---|------|---|------|\n");
        for (i, file) in result.largest_files.iter().take(top_n).enumerate() {
            let pct = render::pct_of(file.size, result.total_size_bytes);
            report.push_str(&format!(
                "| {} | {} | {:.1}% | `{}` |\n",
                i + 1,
                format_bytes(file.size),
                pct,
                file.path
            ));
        }
        report.push('\n');
    }

    let installer_md = render::render_installers_markdown(&render::categorize_installers(result));
    if !installer_md.is_empty() {
        report.push_str(&installer_md);
    }

    let recs = render::build_recommendations(result);
    let rec_md = render::render_recommendations_markdown(&recs);
    if !rec_md.is_empty() {
        report.push_str(&rec_md);
    }

    let origin_report = space_analyzer_pro_desktop::origin_tracer::build_report(
        result,
        top_n.max(60),
        top_n.max(40),
    );
    report.push_str(&origins::origin_markdown(&origin_report));

    report
}
