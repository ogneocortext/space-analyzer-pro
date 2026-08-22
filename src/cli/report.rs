use std::fs;
use std::path::Path;

use crate::cli::args::OutputFormat;
use crate::cli::helpers;
use crate::cli::origins;
use crate::cli::render::{self, format_extension};
use crate::cli::types::ScanReport;
use scan_engine::format_bytes;
use space_analyzer_pro_desktop::error::{AppError, AppResult};

/// Write the scan results to `export_path`, creating parent directories.
///
/// Returns an error instead of only printing one, so the caller can set a
/// non-zero exit code when an export silently fails.
pub fn export_results(
    result: &ScanReport,
    export_path: &str,
    format: OutputFormat,
    top_n: usize,
) -> AppResult<()> {
    let content = match format {
        OutputFormat::Json => generate_json_pretty(result)?,
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

/// Render the scan as a stable, human-friendly JSON document.
///
/// Unlike serializing `ScanReport` directly, this curates the field order,
/// rounds noisy floats (`total_size_mb`, `duration_secs`), adds human-readable
/// size strings, and omits the per-file map unless it actually carries data.
/// The GUI consumes the streaming JSONL event, not this document, so reshaping
/// it cannot break the desktop app.
pub fn generate_json_pretty(result: &ScanReport) -> AppResult<String> {
    // Human-readable companions for the raw-byte category maps so a reader
    // does not have to mentally convert 15386990550 to "15 GB".
    let category_reclaimable: serde_json::Value = serde_json::json!(
        result
            .category_reclaimable
            .iter()
            .map(|(k, v)| (k.clone(), format_bytes(*v)))
            .collect::<std::collections::HashMap<String, String>>()
    );
    let category_sizes: serde_json::Value = serde_json::json!(
        result
            .category_sizes
            .iter()
            .map(|(k, v)| (k.clone(), format_bytes(*v)))
            .collect::<std::collections::HashMap<String, String>>()
    );
    let reclaim_tier_sizes: serde_json::Value = serde_json::json!(
        result
            .reclaim_tier_sizes
            .iter()
            .map(|(k, v)| (k.clone(), format_bytes(*v)))
            .collect::<std::collections::HashMap<String, String>>()
    );

    let top_directories: Vec<serde_json::Value> = result
        .top_directories
        .iter()
        .map(|d| {
            serde_json::json!({
                "path": d.path,
                "name": d.name,
                "total_size": d.total_size,
                "total_size_human": format_bytes(d.total_size),
                "file_count": d.file_count,
                "dir_count": d.dir_count,
            })
        })
        .collect();

    let mut value = serde_json::json!({
        "path": result.path,
        "total_files": result.total_files,
        "total_dirs": result.total_dirs,
        "total_size_bytes": result.total_size_bytes,
        "total_size_human": format_bytes(result.total_size_bytes),
        "total_size_mb": round2(result.total_size_mb),
        "potential_cleanup_bytes": result.potential_cleanup_bytes,
        "potential_cleanup_human": format_bytes(result.potential_cleanup_bytes),
        // Tier split: Safe (no-regret) vs Caution (review-first). Lets consumers
        // show users what is freely deletable vs what they may want to keep.
        "reclaim_safe_bytes": result.reclaim_tier_sizes.get("Safe").copied().unwrap_or(0),
        "reclaim_safe_human": format_bytes(result.reclaim_tier_sizes.get("Safe").copied().unwrap_or(0)),
        "reclaim_caution_bytes": result.reclaim_tier_sizes.get("Caution").copied().unwrap_or(0),
        "reclaim_caution_human": format_bytes(result.reclaim_tier_sizes.get("Caution").copied().unwrap_or(0)),
        "duration_secs": round2(result.duration_secs),
        "errors": result.errors,
        "file_types": result.file_types,
        "extension_sizes": result.extension_sizes,
        "category_sizes": category_sizes,
        "reclaim_tier_sizes": reclaim_tier_sizes,
        "category_reclaimable": category_reclaimable,
        "top_directories": top_directories,
        "largest_files": result
            .largest_files
            .iter()
            .map(|f| {
                serde_json::json!({
                    "path": f.path,
                    "size": f.size,
                    "size_human": format_bytes(f.size),
                })
            })
            .collect::<Vec<_>>(),
        "timestamp": result.timestamp,
    });
    if !result.drill_down.is_empty() {
        let drill_json: serde_json::Value = serde_json::json!(
            result
                .drill_down
                .iter()
                .map(|(path, d)| {
                    (
                        path.clone(),
                        serde_json::json!({
                            "children": d.children.iter().map(|c| serde_json::json!({
                                "path": c.path,
                                "name": c.name,
                                "total_size": c.total_size,
                                "total_size_human": format_bytes(c.total_size),
                                "file_count": c.file_count,
                                "dir_count": c.dir_count,
                            })).collect::<Vec<_>>(),
                            "largest_files": d.largest_files.iter().map(|f| serde_json::json!({
                                "path": f.path,
                                "size": f.size,
                                "size_human": format_bytes(f.size),
                            })).collect::<Vec<_>>(),
                        }),
                    )
                })
                .collect::<std::collections::HashMap<String, serde_json::Value>>()
        );
        value.as_object_mut().unwrap().insert("drill_down".to_string(), drill_json);
    }
    if !result.scanned_files.is_empty() {
        value.as_object_mut().unwrap().insert(
            "scanned_files".to_string(),
            serde_json::to_value(&result.scanned_files)?,
        );
    }
    Ok(serde_json::to_string_pretty(&value)?)
}

/// Round to two decimal places for display, avoiding full f64 precision noise.
fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

/// Render the scan as genuine JSON Lines: one self-describing JSON object per
/// line. The previous implementation serialized the whole `ScanReport` as a
/// single object, which was identical to `--format json` and not line
/// delimited at all.
pub fn generate_jsonl(result: &ScanReport) -> AppResult<String> {
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
            "total_size": dir.total_size,
            "file_count": dir.file_count,
            "dir_count": dir.dir_count,
        }))?);
    }

    for file in &result.largest_files {
        lines.push(serde_json::to_string(&serde_json::json!({
            "record": "file",
            "path": file.path,
            "size": file.size,
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

pub fn generate_report(result: &ScanReport, path: &str, top_n: usize) -> String {
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

    fn sample() -> ScanReport {
        let mut r = ScanReport::new();
        r.path = "C:/tmp".into();
        r.total_files = 2;
        r.total_size_bytes = 30;
        r.extension_sizes.insert("rs".into(), 20);
        r.file_types.insert("rs".into(), 1);
        r.extension_sizes.insert(String::new(), 10);
        r.file_types.insert(String::new(), 1);
        r.largest_files.push(LargestFileEntry::new("C:/tmp/a.rs".into(), 20));
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
            assert!(
                value.get("record").is_some(),
                "each line needs a record tag"
            );
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
        export_results(&sample(), target.to_str().unwrap(), OutputFormat::Json, 20)
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

    #[test]
    fn json_pretty_curates_shape_and_omits_empty_scanned_files() {
        let json = generate_json_pretty(&sample()).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");
        let obj = value.as_object().expect("a JSON object");

        // Always-present, human-readable companions.
        assert!(obj.contains_key("total_size_human"));
        assert!(obj.contains_key("potential_cleanup_human"));

        // The per-file map is omitted when empty (it dwarfs every other field
        // and is only meaningful with `--files`).
        assert!(
            !obj.contains_key("scanned_files"),
            "empty scanned_files must be omitted"
        );

        // Floats are rounded to two decimals, not dumped at full f64 precision.
        let mb = obj["total_size_mb"]
            .as_f64()
            .expect("total_size_mb is a number");
        assert!(
            (mb * 100.0).fract().abs() < f64::EPSILON,
            "total_size_mb should have at most 2 decimal places"
        );
    }

    #[test]
    fn json_pretty_includes_scanned_files_when_populated() {
        let mut r = sample();
        r.scanned_files.insert("C:/tmp/a.rs".to_string(), (20, 0));
        let json = generate_json_pretty(&r).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(
            value.get("scanned_files").is_some(),
            "populated scanned_files must be present"
        );
    }
}
