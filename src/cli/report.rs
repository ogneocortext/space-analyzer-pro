use shared_scanner::format_bytes;
use std::fs;

use super::helpers;
use super::origins;
use super::types::ScanResult;

pub fn export_results(result: &ScanResult, export_path: &str, format: &str) {
    let content = match format {
        "json" => serde_json::to_string_pretty(result).unwrap_or_default(),
        "jsonl" => generate_jsonl(result),
        "csv" => {
            let mut csv = String::new();
            csv.push_str("section,key,value\n");
            csv.push_str(&format!("summary,total_files,{}\n", result.total_files));
            csv.push_str(&format!(
                "summary,total_size_bytes,{}\n",
                result.total_size_bytes
            ));
            csv.push_str(&format!(
                "summary,duration_secs,{:.3}\n",
                result.duration_secs
            ));
            csv.push('\n');

            csv.push_str("extension,size_bytes,file_count\n");
            let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
            ext_sizes.sort_by(|a, b| b.1.cmp(a.1));
            for (ext, size) in &ext_sizes {
                let count = result.file_types.get(*ext).unwrap_or(&0);
                csv.push_str(&format!(".{},{},{}\n", ext, size, count));
            }
            csv.push('\n');

            csv.push_str("directory,size_bytes,file_count,dir_count\n");
            for dir in &result.top_directories {
                csv.push_str(&format!(
                    "\"{}\",{},{},{}\n",
                    dir.path.replace('"', "\"\""),
                    dir.total_size,
                    dir.file_count,
                    dir.dir_count
                ));
            }
            csv.push('\n');

            csv.push_str("file_path,size_bytes\n");
            for (path, size) in &result.largest_files {
                csv.push_str(&format!("\"{}\",{}\n", path.replace('"', "\"\""), size));
            }
            csv
        }
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
            let pct = if result.total_size_bytes > 0 {
                (dir.total_size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
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
            let pct = if result.total_size_bytes > 0 {
                (**size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
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
        for (i, (path, size)) in result.largest_files.iter().take(top_n).enumerate() {
            let pct = if result.total_size_bytes > 0 {
                (*size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            report.push_str(&format!(
                "| {} | {} | {:.1}% | `{}` |\n",
                i + 1,
                format_bytes(*size),
                pct,
                path
            ));
        }
        report.push('\n');
    }

    let mut installers: Vec<(&str, u64)> = result
        .largest_files
        .iter()
        .filter(|(p, _)| {
            let lower = p.to_lowercase();
            lower.ends_with(".exe")
                || lower.ends_with(".msi")
                || lower.ends_with(".rar")
                || lower.ends_with(".zip")
                || lower.ends_with(".dmg")
                || lower.ends_with(".deb")
                || lower.ends_with(".rpm")
                || lower.ends_with(".pkg")
        })
        .map(|(p, s)| (p.as_str(), *s))
        .collect();
    installers.sort_by_key(|b| std::cmp::Reverse(b.1));

    if !installers.is_empty() {
        let total_inst_size: u64 = installers.iter().map(|(_, s)| *s).sum();
        report.push_str("## 📦 Installer & Executable Inventory\n\n");
        report.push_str(&format!(
            "**Total:** {} across {} files\n\n",
            format_bytes(total_inst_size),
            installers.len()
        ));
        report.push_str("These files are likely safe to delete after installation.\n\n");

        let mut gpu_cuda = Vec::new();
        let mut drivers = Vec::new();
        let mut apps = Vec::new();
        let mut other = Vec::new();

        for &(path, size) in &installers {
            let lower = path.to_lowercase();
            if lower.contains("driver") || lower.contains("realtek") || lower.contains("mb_driver")
            {
                drivers.push((path, size));
            } else if lower.contains("cuda")
                || lower.contains("nvidia")
                || lower.contains("596.21-desktop")
                || lower.contains("amd_ryzen")
            {
                gpu_cuda.push((path, size));
            } else if lower.contains("setup")
                || lower.contains("installer")
                || lower.contains("user")
                || lower.ends_with(".msi")
                || lower.contains("desktop")
            {
                apps.push((path, size));
            } else {
                other.push((path, size));
            }
        }

        for (label, group) in [
            ("🖥️ GPU/Drivers/Chipset", &gpu_cuda),
            ("🔧 Drivers", &drivers),
            ("📱 Application Installers", &apps),
            ("📄 Archives/Other", &other),
        ] {
            if !group.is_empty() {
                let group_size: u64 = group.iter().map(|(_, s)| *s).sum();
                report.push_str(&format!("### {} ({})\n\n", label, format_bytes(group_size)));
                report.push_str("| Size | File |\n|------|------|\n");
                for (path, size) in group.iter().take(15) {
                    report.push_str(&format!("| {} | `{}` |\n", format_bytes(*size), path));
                }
                report.push('\n');
            }
        }

        report.push_str("> **Tip:** Delete old installer/run files after installation. Driver/GPU installers are safe to remove if already installed.\n\n");
    }

    // Recommendations section
    let mut recommendations: Vec<(u32, String)> = Vec::new();
    let mut potential_savings: u64 = 0;

    if let Some(disk) = helpers::get_disk_info(path) {
        if disk.usage_percent > 90.0 {
            recommendations.push((3, format!(
                "**CRITICAL:** Drive {} is {:.0}% full! Only {} free. Immediate cleanup recommended.",
                disk.mount_point, disk.usage_percent, format_bytes(disk.available_bytes)
            )));
        } else if disk.usage_percent > 80.0 {
            recommendations.push((
                2,
                format!(
                    "**WARNING:** Drive {} is {:.0}% full. {} free. Consider cleanup soon.",
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
        .filter(|(p, _)| p.contains(".ollama") || p.contains("ollama"))
        .map(|(_, s)| s)
        .sum();
    if ollama_size > 1024 * 1024 * 1024 {
        recommendations.push((
            2,
            format!(
                "Ollama models are using {}. Run `ollama rm <model>` to free space.",
                format_bytes(ollama_size)
            ),
        ));
        potential_savings = potential_savings.saturating_add(ollama_size);
    }

    let log_size: u64 = result.extension_sizes.get("log").copied().unwrap_or(0);
    if log_size > 100 * 1024 * 1024 {
        recommendations.push((
            1,
            format!(
                "Log files are using {}. Consider clearing old logs.",
                format_bytes(log_size)
            ),
        ));
        potential_savings = potential_savings.saturating_add(log_size);
    }

    let exe_size: u64 = result.extension_sizes.get("exe").copied().unwrap_or(0);
    if exe_size > 500 * 1024 * 1024 {
        recommendations.push((
            1,
            format!(
                "Installer/executable files are using {}. Check Downloads for old installers.",
                format_bytes(exe_size)
            ),
        ));
        potential_savings = potential_savings.saturating_add(exe_size);
    }

    let node_modules_size: u64 = result
        .top_directories
        .iter()
        .filter(|d| d.name == "node_modules")
        .map(|d| d.total_size)
        .sum();
    if node_modules_size > 0 {
        recommendations.push((1, format!(
            "node_modules directories are using {}. Run `npm prune` or delete unused project dependencies.",
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
        })
        .map(|d| d.total_size)
        .sum();
    if cache_size > 500 * 1024 * 1024 {
        recommendations.push((
            1,
            format!(
                "Cache/temp directories are using {}. Consider clearing application caches.",
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
                "Recycle Bin contains {} of deleted files. Empty it to reclaim space.",
                format_bytes(recycle_bin_size)
            ),
        ));
        potential_savings = potential_savings.saturating_add(recycle_bin_size);
    }

    recommendations.sort_by_key(|b| std::cmp::Reverse(b.0));

    if !recommendations.is_empty() {
        report.push_str("## Recommendations\n\n");
        for (_, msg) in &recommendations {
            report.push_str(&format!("- {}\n", msg));
        }
        report.push('\n');
    }

    if potential_savings > 0 {
        report.push_str(&format!(
            "**Potential space savings:** {} if you act on all recommendations above.\n\n",
            format_bytes(potential_savings)
        ));
    }

    // Origin-tracing + deletion-safety section.
    let origin_report = space_analyzer_pro_desktop::origin_tracer::build_report(
        result,
        top_n.max(60),
        top_n.max(40),
    );
    report.push_str(&origins::origin_markdown(&origin_report));

    report
}
