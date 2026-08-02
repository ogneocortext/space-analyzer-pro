use crate::cli::helpers;
use crate::cli::types::{InstallerCategory, InstallerGroup, Recommendation, ScanResult};
use shared_scanner::format_bytes;

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

pub fn build_csv(result: &ScanResult) -> String {
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
    ext_sizes.sort_by(|a, b| b.1.cmp(a.1));
    for (ext, size) in &ext_sizes {
        let count = result.file_types.get(*ext).unwrap_or(&0);
        out.push_str(&format!(".{},{},{}\n", ext, size, count));
    }
    out.push('\n');

    out.push_str("directory,size_bytes,file_count,dir_count\n");
    for dir in &result.top_directories {
        out.push_str(&format!(
            "\"{}\",{},{},{}\n",
            dir.path.replace('"', "\"\""),
            dir.total_size,
            dir.file_count,
            dir.dir_count
        ));
    }
    out.push('\n');

    out.push_str("file_path,size_bytes\n");
    for file in &result.largest_files {
        out.push_str(&format!(
            "\"{}\",{}\n",
            file.path.replace('"', "\"\""),
            file.size
        ));
    }
    out
}

pub fn categorize_installers(result: &ScanResult) -> Vec<InstallerGroup> {
    let mut groups: std::collections::HashMap<InstallerCategory, Vec<(String, u64)>> =
        std::collections::HashMap::new();

    for file in &result.largest_files {
        if !is_installer(&file.path) {
            continue;
        }
        let cat = InstallerCategory::from_path(&file.path);
        groups.entry(cat).or_default().push((file.path.clone(), file.size));
    }

    let mut ordered = Vec::new();
    for cat in [
        InstallerCategory::GpuCuda,
        InstallerCategory::Driver,
        InstallerCategory::Application,
        InstallerCategory::Other,
    ] {
        if let Some(entries) = groups.remove(&cat) {
            ordered.push(InstallerGroup {
                category: cat,
                entries,
            });
        }
    }
    ordered
}

pub fn build_recommendations(result: &ScanResult) -> Vec<Recommendation> {
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
        .filter(|file| file.path.contains(".ollama") || file.path.contains("ollama"))
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

    for file in &result.largest_files {
        let path = &file.path;
        let size = file.size;
        if (path.contains(".vhdx") || path.contains("ext4.vhdx") || path.contains("WSL"))
            && size > 1024 * 1024 * 1024
        {
            recs.push((
                2,
                format!(
                    "WSL/VM disk image found: {} ({}) — Consider compacting or removing unused distributions.",
                    std::path::Path::new(path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy(),
                    format_bytes(size)
                ),
            ));
        }
    }

    let node_modules_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.path.to_lowercase().contains("node_modules"))
        .map(|d| d.total_size)
        .sum();
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

    recs.into_iter()
        .map(|(priority, message)| Recommendation { priority, message })
        .collect()
}

pub fn render_recommendations_text(recs: &[Recommendation]) {
    if recs.is_empty() {
        return;
    }
    println!("💡 RECOMMENDATIONS");
    let mut sorted = recs.to_vec();
    sorted.sort_by_key(|r| std::cmp::Reverse(r.priority));
    for rec in &sorted {
        println!("   {}", rec.message);
    }
    println!();
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

pub fn render_installers_text(groups: &[InstallerGroup]) {
    if groups.is_empty() {
        return;
    }

    let total_size: u64 = groups
        .iter()
        .flat_map(|g| &g.entries)
        .map(|(_, s)| *s)
        .sum();
    println!(
        "   📦 INSTALLER & EXECUTABLE INVENTORY ({}, {} files)",
        format_bytes(total_size),
        groups.iter().map(|g| g.entries.len()).sum::<usize>()
    );
    println!(
        "   These are likely safe to delete after installation. Sort by size and remove oldest/unneeded."
    );
    println!();

    for group in groups {
        let size: u64 = group.entries.iter().map(|(_, s)| *s).sum();
        let padding = (38 - group.category.label().len()).max(3);
        println!(
            "   ┌─ {} {}: {} total {}┐",
            group.category.emoji(),
            group.category.label(),
            format_bytes(size),
            "─".repeat(padding)
        );
        for (path, size) in group.entries.iter().take(10) {
            let name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        if group.entries.len() > 10 {
            println!(
                "   │  ... and {} more ({})  ",
                group.entries.len() - 10,
                format_bytes(group.entries[10..].iter().map(|(_, s)| *s).sum::<u64>())
            );
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    println!("   💡 To safely reclaim space: sort by size, delete old installers that are no longer needed.");
    println!("      Driver/GPU installers (CUDA, NVIDIA) are safe to remove if already installed.");
    println!();
}

pub fn render_installers_markdown(groups: &[InstallerGroup]) -> String {
    if groups.is_empty() {
        return String::new();
    }
    let total_inst_size: u64 = groups
        .iter()
        .flat_map(|g| &g.entries)
        .map(|(_, s)| *s)
        .sum();
    let mut md = String::new();
    md.push_str("## 📦 Installer & Executable Inventory\n\n");
    md.push_str(&format!(
        "**Total:** {} across {} files\n\n",
        format_bytes(total_inst_size),
        groups.iter().map(|g| g.entries.len()).sum::<usize>()
    ));
    md.push_str("These files are likely safe to delete after installation.\n\n");

    for group in groups {
        let _group_size: u64 = group.entries.iter().map(|(_, s)| *s).sum();
        md.push_str(&format!(
            "### {} {}\n\n",
            group.category.emoji(),
            group.category.label()
        ));
        md.push_str("| Size | File |\n|------|------|\n");
        for (path, size) in group.entries.iter().take(15) {
            md.push_str(&format!("| {} | `{}` |\n", format_bytes(*size), path));
        }
        md.push('\n');
    }

    md.push_str("> **Tip:** Delete old installer/run files after installation. Driver/GPU installers are safe to remove if already installed.\n\n");
    md
}
