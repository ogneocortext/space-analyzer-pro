use crate::animation::{display_width, SECTION_WIDTH};
use crate::cli::helpers;
use crate::cli::types::{InstallerCategory, InstallerGroup, Recommendation, ScanReport};
use crate::hprintln;
use scan_engine::format_bytes;

pub fn pct_of(part: u64, total: u64) -> f64 {
    if total > 0 {
        (part as f64 / total as f64) * 100.0
    } else {
        0.0
    }
}

pub fn is_installer(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".exe")
        || lower.ends_with(".msi")
        || lower.ends_with(".rar")
        || lower.ends_with(".zip")
        || lower.ends_with(".dmg")
        || lower.ends_with(".deb")
        || lower.ends_with(".rpm")
        || lower.ends_with(".pkg")
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

/// Total bytes held by `node_modules` directories.
///
/// Shared by the recommendations block and the `--cleanup-recommendations`
/// block so the two never report different numbers for the same thing.
pub fn node_modules_bytes(result: &ScanReport) -> u64 {
    let from_dirs: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.path.to_lowercase().contains("node_modules"))
        .map(|d| d.total_size)
        .sum();
    if from_dirs > 0 {
        return from_dirs;
    }
    result
        .largest_files
        .iter()
        .filter(|f| f.path.to_lowercase().contains("node_modules"))
        .map(|f| f.size)
        .sum()
}

pub fn build_recommendations(result: &ScanReport) -> Vec<Recommendation> {
    let mut recs = Vec::new();

    if let Some(disk) = helpers::get_disk_info(&result.path) {
        if disk.usage_percent > 90.0 {
            recs.push((
                3,
                format!(
                    "CRITICAL: Drive {} is {:.0}% full! Only {} free. Immediate cleanup recommended.",
                    disk.mount_point, disk.usage_percent, format_bytes(disk.available_bytes)
                ),
            ));
        } else if disk.usage_percent > 80.0 {
            recs.push((
                2,
                format!(
                    "WARNING: Drive {} is {:.0}% full. {} free. Consider cleanup soon.",
                    disk.mount_point,
                    disk.usage_percent,
                    format_bytes(disk.available_bytes)
                ),
            ));
        }
    }

    let ollama_size: u64 = result
        .largest_files
        .iter()
        .filter(|file| file.path.to_lowercase().contains("ollama"))
        .map(|file| file.size)
        .sum();
    if ollama_size > 1024 * 1024 * 1024 {
        recs.push((
            2,
            format!(
                "Ollama models are using {}. Run `ollama rm <model>` to free space.",
                format_bytes(ollama_size)
            ),
        ));
    }

    let log_size: u64 = result.extension_sizes.get("log").copied().unwrap_or(0);
    if log_size > 100 * 1024 * 1024 {
        recs.push((
            1,
            format!(
                "Log files are using {}. Consider clearing old logs.",
                format_bytes(log_size)
            ),
        ));
    }

    let exe_size: u64 = result.extension_sizes.get("exe").copied().unwrap_or(0);
    if exe_size > 500 * 1024 * 1024 {
        recs.push((
            1,
            format!(
                "Installer/executable files are using {}. Check Downloads for old installers.",
                format_bytes(exe_size)
            ),
        ));
    }

    // Collapse VM/WSL disk images into a single line instead of one line per
    // matching file, which used to flood the recommendations block.
    let vm_images: Vec<&space_analyzer_pro_desktop::gui_common::LargestFileEntry> = result
        .largest_files
        .iter()
        .filter(|file| {
            let lower = file.path.to_lowercase();
            (lower.ends_with(".vhdx") || lower.ends_with(".vhd") || lower.contains("\\wsl"))
                && file.size > 1024 * 1024 * 1024
        })
        .collect();
    if !vm_images.is_empty() {
        let total: u64 = vm_images.iter().map(|f| f.size).sum();
        let names: Vec<String> = vm_images
            .iter()
            .take(3)
            .map(|f| {
                std::path::Path::new(&f.path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string()
            })
            .collect();
        let suffix = if vm_images.len() > 3 {
            format!(" and {} more", vm_images.len() - 3)
        } else {
            String::new()
        };
        recs.push((
            2,
            format!(
                "WSL/VM disk images are using {} ({}{}) — consider compacting or removing unused distributions.",
                format_bytes(total),
                names.join(", "),
                suffix
            ),
        ));
    }

    let node_modules_size = node_modules_bytes(result);
    if node_modules_size > 0 {
        recs.push((1, format!(
            "node_modules directories are using {}. Run `npm prune` or delete unused project dependencies.",
            format_bytes(node_modules_size)
        )));
    }

    let cache_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| {
            let l = d.path.to_lowercase();
            l.contains("cache")
                || l.contains("temp")
                || l.contains("tmp")
                || l.contains("dxcache")
                || l.contains("code cache")
                || l.contains("cachedata")
                || l.contains("cachedextensionvsixs")
        })
        .map(|d| d.total_size)
        .sum();
    if cache_size > 500 * 1024 * 1024 {
        recs.push((
            1,
            format!(
                "Cache/temp directories are using {}. Consider clearing application caches.",
                format_bytes(cache_size)
            ),
        ));
    }

    let recycle_bin_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.path.to_lowercase().contains("$recycle.bin"))
        .map(|d| d.total_size)
        .sum();
    if recycle_bin_size > 0 {
        recs.push((
            2,
            format!(
                "Recycle Bin contains {} of deleted files. Empty it to reclaim space.",
                format_bytes(recycle_bin_size)
            ),
        ));
    }

    let downloads_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| {
            let l = d.path.to_lowercase();
            l.contains("\\downloads") || l.contains("/downloads")
        })
        .map(|d| d.total_size)
        .sum();
    if downloads_size > 1024 * 1024 * 1024 {
        recs.push((1, format!(
            "Downloads folder is using {}. Look for old installers (CUDA, drivers, apps) you can delete.",
            format_bytes(downloads_size)
        )));
    }

    let installer_cache: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.path.to_lowercase().contains("windows\\installer"))
        .map(|d| d.total_size)
        .sum();
    if installer_cache > 500 * 1024 * 1024 {
        recs.push((1, format!(
            "Windows Installer cache is using {}. Use Disk Cleanup (cleanmgr) or PatchCleaner to remove orphaned .msi/.msp files.",
            format_bytes(installer_cache)
        )));
    }

    let browser_cache: u64 = result
        .top_directories
        .iter()
        .filter(|d| {
            let l = d.path.to_lowercase();
            l.contains("googleupdater") || l.contains("crx_cache") || l.contains("edgecore")
        })
        .map(|d| d.total_size)
        .sum();
    if browser_cache > 100 * 1024 * 1024 {
        recs.push((1, format!(
            "Browser updater cache (Google, Edge) is using {}. Safe to clear — browsers will re-download on update.",
            format_bytes(browser_cache)
        )));
    }

    let user_debug: u64 = result
        .top_directories
        .iter()
        .filter(|d| {
            let l = d.path.to_lowercase();
            (l.contains("users") && (l.contains(".cache") || l.contains("mypy_cache")))
                || (l.contains("documents") && l.ends_with(".csv"))
        })
        .map(|d| d.total_size)
        .sum();
    if user_debug > 50 * 1024 * 1024 {
        recs.push((1, format!(
            "User debug/cache files are using {}. Check Downloads, Documents, and AppData for old logs and artifacts.",
            format_bytes(user_debug)
        )));
    }

    if result.total_files > 1000 {
        recs.push((
            0,
            "Run with `--clean` to find duplicate files that can be deduplicated using hard links."
                .to_string(),
        ));
    }

    let mut recs: Vec<Recommendation> = recs
        .into_iter()
        .map(|(priority, message)| Recommendation { priority, message })
        .collect();
    // Sort once, here, so the text and markdown renderers can never disagree
    // about the order of the same advice.
    recs.sort_by_key(|r| std::cmp::Reverse(r.priority));
    recs
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
            },
            Recommendation {
                priority: 3,
                message: "high".into(),
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
            });
        // Directory totals win; the file list is only a fallback, so the two
        // renderers can never disagree.
        assert_eq!(node_modules_bytes(&result), 500);
    }
}
