use shared_scanner::format_bytes;
use std::path::Path;

use super::helpers;
use super::types::ScanResult;

pub fn print_recommendations(result: &ScanResult) {
    let mut recommendations: Vec<(u32, String)> = Vec::new();
    let mut potential_savings: u64 = 0;

    if let Some(disk) = helpers::get_disk_info(&result.path) {
        if disk.usage_percent > 90.0 {
            recommendations.push((3, format!(
                "🔴 CRITICAL: Drive {} is {:.0}% full! Only {} free. Immediate cleanup recommended.",
                disk.mount_point, disk.usage_percent, format_bytes(disk.available_bytes)
            )));
        } else if disk.usage_percent > 80.0 {
            recommendations.push((
                2,
                format!(
                    "🟡 WARNING: Drive {} is {:.0}% full. {} free. Consider cleanup soon.",
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
        recommendations.push((2, format!(
            "🤖 Ollama models are using {}. If you don't use all models, run `ollama rm <model>` to free space.",
            format_bytes(ollama_size)
        )));
        potential_savings = potential_savings.saturating_add(ollama_size);
    }

    let log_size: u64 = result.extension_sizes.get("log").copied().unwrap_or(0);
    if log_size > 100 * 1024 * 1024 {
        recommendations.push((
            1,
            format!(
                "📝 Log files are using {} of disk space. Consider clearing old logs.",
                format_bytes(log_size)
            ),
        ));
        potential_savings = potential_savings.saturating_add(log_size);
    }

    let exe_size: u64 = result.extension_sizes.get("exe").copied().unwrap_or(0);
    if exe_size > 500 * 1024 * 1024 {
        recommendations.push((1, format!(
            "📦 Installer/executable files are using {}. Check Downloads for old installers you no longer need.",
            format_bytes(exe_size)
        )));
        potential_savings = potential_savings.saturating_add(exe_size);
    }

    for file in &result.largest_files {
        let path = &file.path;
        let size = file.size;
        if (path.contains(".vhdx") || path.contains("ext4.vhdx") || path.contains("WSL"))
            && size > 1024 * 1024 * 1024
        {
            recommendations.push((2, format!(
                "🖥️  WSL/VM disk image found: {} ({}) — Consider compacting or removing unused distributions.",
                Path::new(path).file_name().unwrap_or_default().to_string_lossy(),
                format_bytes(size)
            )));
            potential_savings = potential_savings.saturating_add(size);
        }
    }

    let node_modules_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.name == "node_modules")
        .map(|d| d.total_size)
        .sum();
    if node_modules_size > 0 {
        recommendations.push((1, format!(
            "📦 node_modules directories are using {}. Run `npm prune` or delete unused project dependencies.",
            format_bytes(node_modules_size)
        )));
        potential_savings = potential_savings.saturating_add(node_modules_size);
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
        recommendations.push((
            1,
            format!(
                "🗑️  Cache/temp directories are using {}. Consider clearing application caches.",
                format_bytes(cache_size)
            ),
        ));
        potential_savings = potential_savings.saturating_add(cache_size);
    }

    let recycle_bin_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.path.to_lowercase().contains("$recycle.bin"))
        .map(|d| d.total_size)
        .sum();
    if recycle_bin_size > 0 {
        recommendations.push((
            2,
            format!(
                "🗑️  Recycle Bin contains {} of deleted files. Empty it to reclaim space.",
                format_bytes(recycle_bin_size)
            ),
        ));
        potential_savings = potential_savings.saturating_add(recycle_bin_size);
    }

    let downloads_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| {
            d.path.to_lowercase().contains("\\downloads")
                || d.path.to_lowercase().contains("/downloads")
        })
        .map(|d| d.total_size)
        .sum();
    if downloads_size > 1024 * 1024 * 1024 {
        recommendations.push((1, format!(
            "📥 Downloads folder is using {}. Look for old installers (CUDA, drivers, apps) you can delete.",
            format_bytes(downloads_size)
        )));
        potential_savings = potential_savings.saturating_add(downloads_size);
    }

    let installer_cache: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.path.to_lowercase().contains("windows\\installer"))
        .map(|d| d.total_size)
        .sum();
    if installer_cache > 500 * 1024 * 1024 {
        recommendations.push((1, format!(
            "📦 Windows Installer cache is using {}. Use Disk Cleanup (cleanmgr) or PatchCleaner to remove orphaned .msi/.msp files.",
            format_bytes(installer_cache)
        )));
        potential_savings = potential_savings.saturating_add(installer_cache);
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
        recommendations.push((1, format!(
            "🌐 Browser updater cache (Google, Edge) is using {}. Safe to clear — browsers will re-download on update.",
            format_bytes(browser_cache)
        )));
        potential_savings = potential_savings.saturating_add(browser_cache);
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
        recommendations.push((1, format!(
            "📝 User debug/cache files are using {}. Check Downloads, Documents, and AppData for old logs and artifacts.",
            format_bytes(user_debug)
        )));
        potential_savings = potential_savings.saturating_add(user_debug);
    }

    if result.total_files > 1000 {
        recommendations.push((0, "💡 Run with `--clean` to find duplicate files that can be deduplicated using hard links.".to_string()));
    }

    recommendations.sort_by_key(|b| std::cmp::Reverse(b.0));

    if !recommendations.is_empty() {
        println!("💡 RECOMMENDATIONS");
        for (_, msg) in &recommendations {
            println!("   {}", msg);
        }
        println!();
    }

    if potential_savings > 0 {
        println!(
            "💾 Potential space savings: {} if you act on all recommendations above",
            format_bytes(potential_savings)
        );
        println!();
    }
}

pub fn print_cleanup_recommendations(result: &ScanResult) {
    println!("\n🧹 CLEANUP RECOMMENDATIONS");
    println!("   Actionable steps to reclaim disk space:\n");

    let mut actions: Vec<(u32, String)> = Vec::new();

    for dir in &result.top_directories {
        let lower = dir.path.to_lowercase();
        if lower.contains("cache") || lower.contains("temp") || lower.contains("tmp") {
            actions.push((
                3,
                format!(
                "🗑️  Cache/temp: `{}` ({} files) — Safe to clear via disk cleanup or app settings",
                dir.path,
                dir.file_count
            ),
            ));
        }
    }

    let installer_size: u64 = result
        .largest_files
        .iter()
        .filter(|file| {
            let lower = file.path.to_lowercase();
            lower.ends_with(".exe") || lower.ends_with(".msi") || lower.ends_with(".zip")
        })
        .map(|file| file.size)
        .sum();
    if installer_size > 100 * 1024 * 1024 {
        actions.push((3, format!(
            "📦 Installers: {} in installer files — Remove old installers after confirming apps work",
            format_bytes(installer_size)
        )));
    }

    for file in &result.largest_files {
        let path = &file.path;
        let size = file.size;
        let lower = path.to_lowercase();
        if size > 100 * 1024 * 1024 {
            if lower.contains("ollama") || lower.contains("models") || lower.contains("blobs") {
                actions.push((
                    2,
                    format!(
                        "🤖 AI Model: `{}` ({}) — Consider `ollama prune` or removing unused models",
                        path, format_bytes(size)
                    ),
                ));
            } else if lower.contains(".cache") || lower.contains("pip") {
                actions.push((
                    2,
                    format!(
                        "🐍 Cache: `{}` ({}) — Consider `pip cache purge` or manual cleanup",
                        path,
                        format_bytes(size)
                    ),
                ));
            }
        }
    }

    let node_modules_size: u64 = result
        .largest_files
        .iter()
        .filter(|file| {
            let lower = file.path.to_lowercase();
            lower.contains("node_modules")
        })
        .map(|file| file.size)
        .sum();
    if node_modules_size > 100 * 1024 * 1024 {
        actions.push((
            1,
            format!(
                "📦 Node modules: {} across projects — Run `npm prune` or delete in build folders",
                format_bytes(node_modules_size)
            ),
        ));
    }

    actions.sort_by_key(|a| std::cmp::Reverse(a.0));
    for (_, action) in &actions {
        println!("   {}", action);
    }

    if actions.is_empty() {
        println!("   ✅ No major cleanup opportunities found.");
    }

    println!("\n💡 Pro tip: Use `--report` to save a detailed markdown report");
}
