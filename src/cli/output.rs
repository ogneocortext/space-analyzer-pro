use shared_scanner::format_bytes;

use super::helpers;
use super::recommendations;
use super::types::ScanResult;
use crate::animation;

pub fn print_text_results(result: &ScanResult, top_n: usize, verbose: bool, no_animation: bool) {
    println!();
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           Space Analyzer Pro — Disk Space Report            ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();

    if let Some(disk) = helpers::get_disk_info(&result.path) {
        let bar_width = 24;
        let total_info = format!(
            "Total: {} | Used: {} | Free: {}",
            format_bytes(disk.total_bytes),
            format_bytes(disk.used_bytes),
            format_bytes(disk.available_bytes)
        );
        animation::print_animated_bar_mode(
            &format!("💾 DISK OVERVIEW ({})", disk.mount_point),
            disk.usage_percent,
            &total_info,
            bar_width,
            no_animation,
        );
        println!();
    }

    animation::print_section_header_animated("📊", "SCAN SUMMARY", no_animation);
    println!("   Path:     {}", result.path);
    println!(
        "   Files:    {} files in {} directories",
        result.total_files, result.total_dirs
    );
    println!(
        "   Total:    {} ({:.2} MB)",
        format_bytes(result.total_size_bytes),
        result.total_size_mb
    );
    println!("   Duration: {:.2} seconds", result.duration_secs);
    if !result.errors.is_empty() {
        println!("   Errors:   {} (access denied, etc.)", result.errors.len());
        for error in result.errors.iter().take(10) {
            println!("   - {}", error);
        }
        if result.errors.len() > 10 {
            println!("   ... and {} more", result.errors.len() - 10);
        }
    }
    println!();

    if !result.top_directories.is_empty() {
        animation::print_section_header_animated(
            "📁",
            &format!(
                "TOP DIRECTORIES BY SIZE (showing {} of {})",
                top_n.min(result.top_directories.len()),
                result.top_directories.len()
            ),
            no_animation,
        );
        println!("   {:<8} {:<8} {:>10}  Path", "Files", "Dirs", "Size");
        println!(
            "   {}─{:<8}─{}─{:>10}─{}",
            "─".repeat(3),
            "─".repeat(8),
            "─".repeat(3),
            "─".repeat(10),
            "─".repeat(30)
        );

        for dir in result.top_directories.iter().take(top_n) {
            let pct = if result.total_size_bytes > 0 {
                (dir.total_size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            println!(
                "   {:<8} {:<8} {:>10} ({:5.1}%)  {}",
                dir.file_count,
                dir.dir_count,
                format_bytes(dir.total_size),
                pct,
                dir.path
            );
        }
        if result.top_directories.len() > top_n {
            let remaining: u64 = result.top_directories[top_n..]
                .iter()
                .map(|d| d.total_size)
                .sum();
            println!(
                "   ... and {} more directories ({})",
                result.top_directories.len() - top_n,
                format_bytes(remaining)
            );
        }
        println!();
    }

    if verbose {
        let scan_speed = if result.duration_secs > 0.0 {
            result.total_files as f64 / result.duration_secs
        } else {
            0.0
        };
        println!();
        animation::print_section_header_animated("⚡", "SCAN PERFORMANCE", no_animation);
        println!(
            "   Scanned {} files in {:.2}s ({:.0} files/sec)",
            result.total_files, result.duration_secs, scan_speed
        );
        println!();
    }

    if !result.extension_sizes.is_empty() {
        let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
        ext_sizes.sort_by(|a, b| b.1.cmp(a.1));

        animation::print_section_header_animated(
            "📄",
            &format!(
                "FILE TYPES BY SIZE (showing {} of {})",
                top_n.min(ext_sizes.len()),
                ext_sizes.len()
            ),
            no_animation,
        );
        println!(
            "   {:<12} {:>8} {:>10}  % of Total",
            "Extension", "Count", "Size"
        );
        println!(
            "   {}─{:<12}─{}─{:>10}─{}",
            "─".repeat(3),
            "─".repeat(12),
            "─".repeat(8),
            "─".repeat(10),
            "─".repeat(12)
        );

        for (ext, size) in ext_sizes.iter().take(top_n) {
            let count = result.file_types.get(*ext).unwrap_or(&0);
            let pct = if result.total_size_bytes > 0 {
                (**size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            let ext_display = if ext.is_empty() { "(no ext)" } else { ext };
            println!(
                "   .{:<11} {:>8} {:>10}  {:>5.1}%",
                ext_display,
                count,
                format_bytes(**size),
                pct
            );
        }
        println!();
    }

    if !result.top_directories.is_empty() {
        use space_analyzer_pro_desktop::category::path_based_category;
        let mut cats: std::collections::HashMap<&str, u64> = std::collections::HashMap::new();
        for d in &result.top_directories {
            let cat = path_based_category(&d.path);
            *cats.entry(cat).or_default() += d.total_size;
        }
        let mut sorted: Vec<_> = cats.iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(a.1));
        animation::print_section_header_animated(
            "📂",
            &format!(
                "SPACE BY CATEGORY (showing {} of {})",
                top_n.min(sorted.len()),
                sorted.len()
            ),
            no_animation,
        );
        println!("   {:<16} {:>10}  {:>6}", "Category", "Size", "% Total");
        println!(
            "   {}─{:<16}─{}─{}",
            "─".repeat(3),
            "─".repeat(16),
            "─".repeat(10),
            "─".repeat(6)
        );
        for (&cat, &size) in sorted.iter().take(top_n) {
            let pct = if result.total_size_bytes > 0 {
                (size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            let emoji = match cat {
                "Windows" => "🖥️",
                "Program Files" => "⚙️",
                "Temp/Cache" => "🗑️",
                "Development" => "🛠️",
                "AI Models" => "🤖",
                "Videos" => "🎬",
                "System" => "🔧",
                "Build Output" => "🔨",
                "VCS" => "📚",
                "Cache" => "💰",
                "Test Fixtures" => "🧪",
                _ => "📁",
            };
            println!(
                "   {} {:<14} {:>10}  {:>5.1}%",
                emoji,
                cat,
                format_bytes(size),
                pct
            );
        }
        println!();
    }

    if !result.largest_files.is_empty() {
        animation::print_section_header_animated(
            "🏆",
            &format!(
                "LARGEST FILES (top {})",
                top_n.min(result.largest_files.len())
            ),
            no_animation,
        );
        for (i, (path, size)) in result.largest_files.iter().take(top_n).enumerate() {
            let pct = if result.total_size_bytes > 0 {
                (*size as f64 / result.total_size_bytes as f64) * 100.0
            } else {
                0.0
            };
            println!(
                "   {:>3}. {:>10} ({:5.1}%)  {}",
                i + 1,
                format_bytes(*size),
                pct,
                path
            );
        }
        println!();
    }

    print_installer_inventory(result, no_animation);
    recommendations::print_recommendations(result);

    if verbose && !result.empty_dirs.is_empty() {
        animation::print_section_header_animated(
            "📂",
            &format!("EMPTY DIRECTORIES ({} found)", result.empty_dirs.len()),
            no_animation,
        );
        for dir in result.empty_dirs.iter().take(20) {
            println!("   {}", dir);
        }
        if result.empty_dirs.len() > 20 {
            println!("   ... and {} more", result.empty_dirs.len() - 20);
        }
        println!();
    }
}

pub fn print_csv(result: &ScanResult) {
    println!("section,key,value");
    println!("summary,total_files,{}", result.total_files);
    println!("summary,total_size_bytes,{}", result.total_size_bytes);
    println!("summary,duration_secs,{:.3}", result.duration_secs);
    println!();
    println!("extension,size_bytes,file_count");
    let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
    ext_sizes.sort_by(|a, b| b.1.cmp(a.1));
    for (ext, size) in &ext_sizes {
        let count = result.file_types.get(*ext).unwrap_or(&0);
        println!(".{},{},{}", ext, size, count);
    }
    println!();
    println!("directory,size_bytes,file_count,dir_count");
    for dir in &result.top_directories {
        println!(
            "\"{}\",{},{},{}",
            dir.path.replace('"', "\"\""),
            dir.total_size,
            dir.file_count,
            dir.dir_count
        );
    }
    println!();
    println!("file_path,size_bytes");
    for (path, size) in &result.largest_files {
        println!("\"{}\",{}", path.replace('"', "\"\""), size);
    }
}

fn print_installer_inventory(result: &ScanResult, no_animation: bool) {
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

    if installers.is_empty() {
        return;
    }

    let total_size: u64 = installers.iter().map(|(_, s)| *s).sum();
    animation::print_section_header_animated(
        "📦",
        &format!(
            "INSTALLER & EXECUTABLE INVENTORY ({}, {} files)",
            format_bytes(total_size),
            installers.len()
        ),
        no_animation,
    );
    println!("   These are likely safe to delete after installation. Sort by size and remove oldest/unneeded.");
    println!();

    let mut driver_installers = Vec::new();
    let mut gpu_cuda_installers = Vec::new();
    let mut app_installers = Vec::new();
    let mut other_installers = Vec::new();

    for &(path, size) in &installers {
        let lower = path.to_lowercase();
        if lower.contains("driver") || lower.contains("realtek") || lower.contains("mb_driver") {
            driver_installers.push((path, size));
        } else if lower.contains("cuda")
            || lower.contains("nvidia")
            || lower.contains("596.21-desktop")
            || lower.contains("amd_ryzen")
        {
            gpu_cuda_installers.push((path, size));
        } else {
            if lower.contains("setup")
                || lower.contains("installer")
                || lower.contains("user")
                || lower.ends_with(".msi")
                || lower.contains("desktop")
            {
                app_installers.push((path, size));
            } else {
                other_installers.push((path, size));
            }
        }
    }

    if !gpu_cuda_installers.is_empty() {
        let size: u64 = gpu_cuda_installers.iter().map(|(_, s)| *s).sum();
        println!(
            "   ┌─ 🖥️  GPU/Drivers/Chipset: {} total ──────────────┐",
            format_bytes(size)
        );
        for (path, size) in gpu_cuda_installers.iter().take(10) {
            let name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    if !driver_installers.is_empty() {
        let size: u64 = driver_installers.iter().map(|(_, s)| *s).sum();
        println!(
            "   ┌─ 🔧 Drivers: {} total ──────────────────────────┐",
            format_bytes(size)
        );
        for (path, size) in driver_installers.iter().take(10) {
            let name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    if !app_installers.is_empty() {
        let size: u64 = app_installers.iter().map(|(_, s)| *s).sum();
        println!(
            "   ┌─ 📱 Application Installers: {} total ──────────┐",
            format_bytes(size)
        );
        for (path, size) in app_installers.iter().take(10) {
            let name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        if app_installers.len() > 10 {
            println!(
                "   │  ... and {} more ({})  ",
                app_installers.len() - 10,
                format_bytes(app_installers[10..].iter().map(|(_, s)| *s).sum::<u64>())
            );
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    if !other_installers.is_empty() {
        let size: u64 = other_installers.iter().map(|(_, s)| *s).sum();
        println!(
            "   ┌─ 📄 Archives/Other: {} total ─────────────────┐",
            format_bytes(size)
        );
        for (path, size) in other_installers.iter().take(10) {
            let name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            println!("   │  {:>10}  {} ", format_bytes(*size), name);
        }
        if other_installers.len() > 10 {
            println!(
                "   │  ... and {} more ({})  ",
                other_installers.len() - 10,
                format_bytes(other_installers[10..].iter().map(|(_, s)| *s).sum::<u64>())
            );
        }
        println!("   └────────────────────────────────────────────────────┘");
        println!();
    }

    println!("   💡 To safely reclaim space: sort by size, delete old installers that are no longer needed.");
    println!("      Driver/GPU installers (CUDA, NVIDIA) are safe to remove if already installed.");
    println!();
}
