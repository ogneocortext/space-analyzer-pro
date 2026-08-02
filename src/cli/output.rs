use crate::cli::render::{self, pct_of};
use crate::cli::types::ScanResult;
use crate::animation;
use shared_scanner::format_bytes;

pub fn print_text_results(
    result: &ScanResult,
    top_n: usize,
    verbose: bool,
    no_animation: bool,
    depth_label: &str,
) {
    println!();
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           Space Analyzer Pro — Disk Space Report            ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();

    if let Some(disk) = crate::cli::helpers::get_disk_info(&result.path) {
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
    println!("   Depth:    {}", depth_label);
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
            println!(
                "   {:<8} {:<8} {:>10} ({:5.1}%)  {}",
                dir.file_count,
                dir.dir_count,
                format_bytes(dir.total_size),
                pct_of(dir.total_size, result.total_size_bytes),
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
            let ext_display = if ext.is_empty() { "(no ext)" } else { ext };
            println!(
                "   .{:<11} {:>8} {:>10}  {:>5.1}%",
                ext_display,
                count,
                format_bytes(**size),
                pct_of(**size, result.total_size_bytes)
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
                pct_of(size, result.total_size_bytes)
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
        for (i, file) in result.largest_files.iter().take(top_n).enumerate() {
            println!(
                "   {:>3}. {:>10} ({:5.1}%)  {}",
                i + 1,
                format_bytes(file.size),
                pct_of(file.size, result.total_size_bytes),
                file.path
            );
        }
        println!();
    }

    print_installer_inventory(result, no_animation);
    render::render_recommendations_text(&render::build_recommendations(result));

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
    println!("{}", render::build_csv(result));
}

fn print_installer_inventory(result: &ScanResult, no_animation: bool) {
    let groups = render::categorize_installers(result);
    if groups.is_empty() {
        return;
    }
    animation::print_section_header_animated("📦", "INSTALLER & EXECUTABLE INVENTORY", no_animation);
    println!("   These are likely safe to delete after installation. Sort by size and remove oldest/unneeded.");
    println!();
    render::render_installers_text(&groups);
}
