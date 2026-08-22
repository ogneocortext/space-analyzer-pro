use crate::animation::{display_width, SECTION_WIDTH};
use crate::cli::types::{InstallerCategory, InstallerGroup, ScanReport};
use crate::hprintln;
use space_analyzer_pro_desktop::recommendations::{is_installer, Recommendation};
use scan_engine::format_bytes;

pub fn pct_of(part: u64, total: u64) -> f64 {
    if total > 0 {
        (part as f64 / total as f64) * 100.0
    } else {
        0.0
    }
}

/// Render an extension for display. Empty extensions become `(no ext)`
/// without a stray leading dot.
pub fn format_extension(ext: &str) -> String {
    if ext.is_empty() {
        "(no ext)".to_string()
    } else {
        format!(".{ext}")
    }
}

pub fn build_csv(result: &ScanReport) -> String {
    let mut out = String::new();
    out.push_str("section,key,value\n");
    out.push_str(&format!("summary,total_files,{}\n", result.total_files));
    out.push_str(&format!(
        "summary,total_size_bytes,{}\n",
        result.total_size_bytes
    ));
    out.push_str(&format!(
        "summary,duration_secs,{:.3}\n",
        result.duration_secs
    ));
    out.push('\n');

    out.push_str("extension,size_bytes,file_count\n");
    let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
    ext_sizes.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
    for (ext, size) in &ext_sizes {
        let count = result.file_types.get(*ext).unwrap_or(&0);
        out.push_str(&format!(
            "{},{},{}\n",
            csv_escape(&format_extension(ext)),
            size,
            count
        ));
    }
    out.push('\n');

    out.push_str("directory,size_bytes,file_count,dir_count\n");
    for dir in &result.top_directories {
        out.push_str(&format!(
            "{},{},{},{}\n",
            csv_escape(&dir.path),
            dir.total_size,
            dir.file_count,
            dir.dir_count
        ));
    }
    out.push('\n');

    out.push_str("file_path,size_bytes\n");
    for file in &result.largest_files {
        out.push_str(&format!("{},{}\n", csv_escape(&file.path), file.size));
    }
    out
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

pub fn categorize_installers(result: &ScanReport) -> Vec<InstallerGroup> {
    let mut groups: std::collections::HashMap<InstallerCategory, Vec<(String, u64)>> =
        std::collections::HashMap::new();

    for file in &result.largest_files {
        if !is_installer(&file.path) {
            continue;
        }
        let cat = InstallerCategory::from_path(&file.path);
        groups
            .entry(cat)
            .or_default()
            .push((file.path.clone(), file.size));
    }

    let mut ordered = Vec::new();
    for cat in [
        InstallerCategory::GpuCuda,
        InstallerCategory::Driver,
        InstallerCategory::Application,
        InstallerCategory::Other,
    ] {
        if let Some(mut entries) = groups.remove(&cat) {
            entries.sort_by_key(|e| std::cmp::Reverse(e.1));
            ordered.push(InstallerGroup {
                category: cat,
                entries,
            });
        }
    }
    ordered
}

pub fn build_recommendations(result: &ScanReport) -> Vec<Recommendation> {
    space_analyzer_pro_desktop::recommendations::build_recommendations(result)
}

pub fn render_recommendations_text(recs: &[Recommendation]) {
    if recs.is_empty() {
        return;
    }
    hprintln!("💡 RECOMMENDATIONS");
    for rec in recs {
        hprintln!("   {}", rec.message);
    }
    hprintln!();
}

pub fn render_recommendations_markdown(recs: &[Recommendation]) -> String {
    if recs.is_empty() {
        return String::new();
    }
    let mut md = String::new();
    md.push_str("## Recommendations\n\n");
    for rec in recs {
        md.push_str(&format!("- {}\n", rec.message));
    }
    md.push('\n');
    md
}

/// Total bytes and file count across every installer group.
pub fn installer_totals(groups: &[InstallerGroup]) -> (u64, usize) {
    (
        groups
            .iter()
            .flat_map(|g| &g.entries)
            .map(|(_, s)| *s)
            .sum(),
        groups.iter().map(|g| g.entries.len()).sum(),
    )
}

pub fn render_installers_text(groups: &[InstallerGroup]) {
    if groups.is_empty() {
        return;
    }

    for group in groups {
        let size: u64 = group.entries.iter().map(|(_, s)| *s).sum();
        // Both borders are derived from one width constant so the box always
        // closes squarely, and saturating_sub keeps a long label from
        // underflow-panicking.
        let heading = format!(
            "─ {} {}: {} total ",
            group.category.emoji(),
            group.category.label(),
            format_bytes(size)
        );
        let inner = SECTION_WIDTH.saturating_sub(2);
        let padding = inner.saturating_sub(display_width(&heading));
        hprintln!("   ┌{}{}┐", heading, "─".repeat(padding));
        for (path, size) in group.entries.iter().take(10) {
            let name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            hprintln!("   │ {:>10}  {}", format_bytes(*size), name);
        }
        if group.entries.len() > 10 {
            hprintln!(
                "   │ ... and {} more ({})",
                group.entries.len() - 10,
                format_bytes(group.entries[10..].iter().map(|(_, s)| *s).sum::<u64>())
            );
        }
        hprintln!("   │ {}", group.category.advice());
        hprintln!("   └{}┘", "─".repeat(inner));
        hprintln!();
    }
}

pub fn render_installers_markdown(groups: &[InstallerGroup]) -> String {
    if groups.is_empty() {
        return String::new();
    }
    let (total_inst_size, total_files) = installer_totals(groups);
    let mut md = String::new();
    md.push_str("## 📦 Installer & Executable Inventory\n\n");
    md.push_str(&format!(
        "**Total:** {} across {} files\n\n",
        format_bytes(total_inst_size),
        total_files
    ));

    for group in groups {
        md.push_str(&format!(
            "### {} {}\n\n",
            group.category.emoji(),
            group.category.label()
        ));
        md.push_str(&format!("{}\n\n", group.category.advice()));
        md.push_str("| Size | File |\n|------|------|\n");
        for (path, size) in group.entries.iter().take(15) {
            md.push_str(&format!("| {} | `{}` |\n", format_bytes(*size), path));
        }
        md.push('\n');
    }

    md
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::types::ScanReport;

    #[test]
    fn extension_display_has_no_stray_dot() {
        assert_eq!(format_extension(""), "(no ext)");
        assert_eq!(format_extension("rs"), ".rs");
    }

    #[test]
    fn csv_never_emits_a_bare_dot_row_and_escapes_separators() {
        let mut result = ScanReport::new();
        result.extension_sizes.insert(String::new(), 10);
        result.file_types.insert(String::new(), 1);
        let csv = build_csv(&result);
        assert!(csv.contains("(no ext),10,1"), "got:\n{csv}");
        assert!(!csv.contains("\n.,"), "bare '.' row must be gone:\n{csv}");
        assert_eq!(csv_escape("a,b"), "\"a,b\"");
        assert_eq!(csv_escape("say \"hi\""), "\"say \"\"hi\"\"\"");
    }

    #[test]
    fn recommendations_are_sorted_by_descending_priority() {
        let recs = vec![
            Recommendation {
                priority: 0,
                message: "low".into(),
                tier: "safe".into(),
            },
            Recommendation {
                priority: 3,
                message: "high".into(),
                tier: "caution".into(),
            },
        ];
        let mut sorted = recs.clone();
        sorted.sort_by_key(|r| std::cmp::Reverse(r.priority));
        let md = render_recommendations_markdown(&sorted);
        let high_at = md.find("high").unwrap();
        let low_at = md.find("low").unwrap();
        assert!(high_at < low_at, "markdown must follow priority order");
    }

    #[test]
    fn node_modules_total_is_computed_once_from_directories() {
        let mut result = ScanReport::new();
        result.top_directories.push(crate::cli::types::DirEntry {
            path: r"C:\proj\node_modules".into(),
            name: "node_modules".into(),
            total_size: 500,
            file_count: 10,
            dir_count: 2,
        });
        result
            .largest_files
            .push(space_analyzer_pro_desktop::gui_common::LargestFileEntry {
                path: r"C:\proj\node_modules\big.js".into(),
                size: 100,
                size_human: "100 B".to_string(),
            });
        // Directory totals win; the file list is only a fallback, so the two
        // renderers can never disagree.
        assert_eq!(space_analyzer_pro_desktop::recommendations::node_modules_bytes(&result), 500);
    }
}
