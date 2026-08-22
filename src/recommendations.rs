//! Non-destructive cleanup-recommendation rule engine.
//!
//! Shared by the CLI human report (`scan --cleanup-recommendations`),
//! the `recommend` subcommand, and the AI `ToolRegistry` so the CLI, the
//! WinUI dashboard, and the agentic assistant never diverge on the advice
//! they surface. Living in the lib crate keeps it usable from `tool_registry`
//! without creating a binary→lib→binary dependency cycle.

use crate::gui_common::ScanReport;
use crate::system_monitor::SystemMonitor;
use scan_engine::format_bytes;
use serde::Serialize;
use std::path::Path;

/// A single prioritized cleanup suggestion.
#[derive(Debug, Clone, Serialize)]
pub struct Recommendation {
    pub priority: u32,
    pub message: String,
}

/// True for file paths that look like installers / redistributable packages.
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

/// Disk-usage percentage for the volume that contains `path`, or `None`
/// when no mounted volume matches (e.g. a network/relative path).
fn usage_percent_for(path: &str) -> Option<f32> {
    let volumes = SystemMonitor::get_disk_volumes();
    let needle = path.to_uppercase();
    let mut best: Option<(usize, f32)> = None;
    for vol in &volumes {
        let mp = vol.mount_point.to_uppercase();
        if needle.starts_with(&mp) {
            let len = mp.len();
            if best.map(|(best_len, _)| len > best_len).unwrap_or(true) {
                let usage = if vol.total_bytes > 0 {
                    (vol.used_bytes as f32 / vol.total_bytes as f32) * 100.0
                } else {
                    0.0
                };
                best = Some((len, usage));
            }
        }
    }
    best.map(|(_, usage)| usage)
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

/// Build prioritized cleanup recommendations for a scan.
///
/// Read-only: it only inspects already-collected scan data (extension sizes,
/// top directories, largest files) plus a live disk-usage lookup — it never
/// touches the filesystem contents.
pub fn build_recommendations(result: &ScanReport) -> Vec<Recommendation> {
    let mut recs: Vec<(u32, String)> = Vec::new();

    if let Some(pct) = usage_percent_for(&result.path) {
        if pct > 90.0 {
            recs.push((
                3,
                format!(
                    "CRITICAL: Drive holding {} is {:.0}% full! Immediate cleanup recommended.",
                    result.path, pct
                ),
            ));
        } else if pct > 80.0 {
            recs.push((
                2,
                format!(
                    "WARNING: Drive holding {} is {:.0}% full. Consider cleanup soon.",
                    result.path, pct
                ),
            ));
        }
    }

    // Use the category aggregate (accurate total) rather than summing the
    // top-N largest_files, which undershoots when the file cap excludes blobs.
    let ollama_size: u64 = result
        .category_sizes
        .get("AI Models")
        .copied()
        .unwrap_or(0);
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
    let vm_images: Vec<&crate::gui_common::LargestFileEntry> = result
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
                Path::new(&f.path)
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
        recs.push((
            1,
            format!(
                "node_modules directories are using {}. Run `npm prune` or delete unused project dependencies.",
                format_bytes(node_modules_size)
            ),
        ));
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
        recs.push((
            1,
            format!(
                "Downloads folder is using {}. Look for old installers (CUDA, drivers, apps) you can delete.",
                format_bytes(downloads_size)
            ),
        ));
    }

    let installer_cache: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.path.to_lowercase().contains("windows\\installer"))
        .map(|d| d.total_size)
        .sum();
    if installer_cache > 500 * 1024 * 1024 {
        recs.push((
            1,
            format!(
                "Windows Installer cache is using {}. Use Disk Cleanup (cleanmgr) or PatchCleaner to remove orphaned .msi/.msp files.",
                format_bytes(installer_cache)
            ),
        ));
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
        recs.push((
            1,
            format!(
                "Browser updater cache (Google, Edge) is using {}. Safe to clear — browsers will re-download on update.",
                format_bytes(browser_cache)
            ),
        ));
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
        recs.push((
            1,
            format!(
                "User debug/cache files are using {}. Check Downloads, Documents, and AppData for old logs and artifacts.",
                format_bytes(user_debug)
            ),
        ));
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
    // Sort once, here, so every consumer (CLI, dashboard, agent) agrees on
    // the order of the same advice.
    recs.sort_by_key(|r| std::cmp::Reverse(r.priority));
    recs
}
