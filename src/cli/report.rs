use std::fs;
use std::path::Path;

use crate::cli::args::OutputFormat;
use crate::cli::helpers;
use crate::cli::origins;
use crate::cli::render::{self, format_extension};
use crate::cli::types::ScanResult;
use shared_scanner::format_bytes;
use space_analyzer_pro_desktop::error::{AppError, AppResult};

/// Write the scan results to `export_path`, creating parent directories.
///
/// Returns an error instead of only printing one, so the caller can set a
/// non-zero exit code when an export silently fails.
pub fn export_results(
    result: &ScanResult,
    export_path: &str,
    format: OutputFormat,
    top_n: usize,
) -> AppResult<()> {
    let content = match format {
        OutputFormat::Json => serde_json::to_string_pretty(result)?,
        OutputFormat::Jsonl => generate_jsonl(result)?,
        OutputFormat::Csv => render::build_csv(result),
        OutputFormat::Md | OutputFormat::Text => generate_report(result, &result.path, top_n),
    };

    let target = Path::new(export_path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| {
                AppError::Validation(format!(
                    "Could not create export directory '{}': {}",
                    parent.display(),
                    e
                ))
            })?;
        }
    }

    fs::write(target, &content).map_err(|e| {
        AppError::Validation(format!(
            "Could not write export file '{}': {}",
            target.display(),
            e
        ))
    })
}

/// Render the scan as genuine JSON Lines: one self-describing JSON object per
/// line. The previous implementation serialized the whole `ScanResult` as a
/// single object, which was identical to `--format json` and not line
/// delimited at all.
pub fn generate_jsonl(result: &ScanResult) -> AppResult<String> {
    let mut lines: Vec<String> = Vec::new();

    lines.push(serde_json::to_string(&serde_json::json!({
        "record": "summary",
        "path": result.path,
        "total_files": result.total_files,
        "total_dirs": result.total_dirs,
        "total_size_bytes": result.total_size_bytes,
        "total_size_mb": result.total_size_mb,
        "duration_secs": result.duration_secs,
        "potential_cleanup_bytes": result.potential_cleanup_bytes,
        "timestamp": result.timestamp,
        "error_count": result.errors.len(),
    }))?);

    let mut extensions: Vec<(&String, &u64)> = result.extension_sizes.iter().collect();
    extensions.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
    for (ext, size) in extensions {
        lines.push(serde_json::to_string(&serde_json::json!({
            "record": "extension",
            "extension": ext,
            "display": format_extension(ext),
            "size_bytes": size,
            "file_count": result.file_types.get(ext).copied().unwrap_or(0),
        }))?);
    }

    for dir in &result.top_directories {
        lines.push(serde_json::to_string(&serde_json::json!({
            "record": "directory",
            "path": dir.path,
            "name": dir.name,
            "size_bytes": dir.total_size,
            "file_count": dir.file_count,
            "dir_count": dir.dir_count,
        }))?);
    }

    for file in &result.largest_files {
        lines.push(serde_json::to_string(&serde_json::json!({
            "record": "file",
            "path": file.path,
            "size_bytes": file.size,
        }))?);
    }

    for error in &result.errors {
        lines.push(serde_json::to_string(&serde_json::json!({
            "record": "error",
            "message": error,
        }))?);
    }

    Ok(lines.join("\n"))
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
        ext_sizes.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
        for (ext, size) in ext_sizes.iter().take(top_n) {
            let count = result.file_types.get(*ext).unwrap_or(&0);
            let pct = render::pct_of(**size, result.total_size_bytes);
            report.push_str(&format!(
                "| `{}` | {} | {} | {:.1}% |\n",
                format_extension(ext),
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

#[cfg(test)]
mod tests {
    use super::*;
    use space_analyzer_pro_desktop::gui_common::LargestFileEntry;

    fn sample() -> ScanResult {
        let mut r = ScanResult::new();
        r.path = "C:/tmp".into();
        r.total_files = 2;
        r.total_size_bytes = 30;
        r.extension_sizes.insert("rs".into(), 20);
        r.file_types.insert("rs".into(), 1);
        r.extension_sizes.insert(String::new(), 10);
        r.file_types.insert(String::new(), 1);
        r.largest_files.push(LargestFileEntry {
            path: "C:/tmp/a.rs".into(),
            size: 20,
        });
        r
    }

    #[test]
    fn jsonl_emits_one_valid_json_object_per_line() {
        let out = generate_jsonl(&sample()).unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert!(
            lines.len() >= 4,
            "expected a summary plus per-record lines, got {} line(s)",
            lines.len()
        );
        for line in &lines {
            let value: serde_json::Value =
                serde_json::from_str(line).expect("every line must be standalone JSON");
            assert!(value.get("record").is_some(), "each line needs a record tag");
        }
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(lines[0]).unwrap()["record"],
            "summary"
        );
    }

    #[test]
    fn jsonl_is_not_just_the_json_document() {
        let jsonl = generate_jsonl(&sample()).unwrap();
        let json = serde_json::to_string(&sample()).unwrap();
        assert_ne!(jsonl, json);
        assert!(jsonl.lines().count() > 1);
    }

    #[test]
    fn export_creates_missing_parent_directories() {
        let base = std::env::temp_dir().join("space-analyzer-export-test");
        let _ = std::fs::remove_dir_all(&base);
        let target = base.join("nested").join("deep").join("out.json");
        export_results(
            &sample(),
            target.to_str().unwrap(),
            OutputFormat::Json,
            20,
        )
        .expect("export must create parent directories");
        assert!(target.exists(), "export file should exist at {target:?}");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn markdown_has_no_stray_dot_for_extensionless_files() {
        let md = generate_report(&sample(), "C:/tmp", 20);
        assert!(md.contains("`(no ext)`"), "got:\n{md}");
        assert!(!md.contains("`.(no ext)`"));
    }
}
