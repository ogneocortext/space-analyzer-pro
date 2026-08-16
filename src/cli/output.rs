use crate::animation::{self, display_width, SECTION_WIDTH};
use crate::cli::render::{self, format_extension, pct_of};
use crate::cli::types::ScanReport;
use crate::hprintln;
use scan_engine::format_bytes;

/// Draw the report banner with both rules derived from one width constant so
/// the box always closes squarely (the title row used to be one cell short).
fn print_banner() {
    let title = "Space Analyzer Pro — Disk Space Report";
    let inner = SECTION_WIDTH;
    let title_width = display_width(title);
    let left = inner.saturating_sub(title_width) / 2;
    let right = inner.saturating_sub(left + title_width);
    hprintln!("╔{}╗", "═".repeat(inner));
    hprintln!(
        "║{}{}{}║",
        " ".repeat(left),
        title,
        " ".repeat(right)
    );
    hprintln!("╚{}╝", "═".repeat(inner));
}

pub fn print_text_results(
    result: &ScanReport,
    top_n: usize,
    verbose: bool,
    no_animation: bool,
    depth_label: &str,
) {
    hprintln!();
    print_banner();
    hprintln!();

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
        hprintln!();
    }

    animation::print_section_header_animated("📊", "SCAN SUMMARY", no_animation);
    hprintln!("   Path:     {}", result.path);
    hprintln!("   Depth:    {}", depth_label);
    hprintln!(
        "   Files:    {} files in {} directories",
        result.total_files,
        result.total_dirs
    );
    hprintln!(
        "   Total:    {} ({:.2} MB)",
        format_bytes(result.total_size_bytes),
        result.total_size_mb
    );
    hprintln!("   Duration: {:.2} seconds", result.duration_secs);
    if !result.errors.is_empty() {
        hprintln!("   Errors:   {} (access denied, etc.)", result.errors.len());
        for error in result.errors.iter().take(10) {
            hprintln!("   - {}", error);
        }
        if result.errors.len() > 10 {
            hprintln!("   ... and {} more", result.errors.len() - 10);
        }
    }
    hprintln!();

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
        // Header, rule and rows all share the same column widths, so "Path"
        // finally sits above the paths instead of above the percentages.
        hprintln!(
            "   {:>8} {:>6} {:>11} {:>8}  {}",
            "Files",
            "Dirs",
            "Size",
            "% Total",
            "Path"
        );
        hprintln!(
            "   {} {} {} {}  {}",
            "─".repeat(8),
            "─".repeat(6),
            "─".repeat(11),
            "─".repeat(8),
            "─".repeat(20)
        );

        for dir in result.top_directories.iter().take(top_n) {
            hprintln!(
                "   {:>8} {:>6} {:>11} {:>7.1}%  {}",
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
            hprintln!(
                "   ... and {} more directories ({})",
                result.top_directories.len() - top_n,
                format_bytes(remaining)
            );
        }
        hprintln!();
    }

    if verbose {
        let scan_speed = if result.duration_secs > 0.0 {
            result.total_files as f64 / result.duration_secs
        } else {
            0.0
        };
        animation::print_section_header_animated("⚡", "SCAN PERFORMANCE", no_animation);
        hprintln!(
            "   Scanned {} files in {:.2}s ({:.0} files/sec)",
            result.total_files,
            result.duration_secs,
            scan_speed
        );
        hprintln!(
            "   Directories: {} | Errors: {}",
            result.total_dirs,
            result.errors.len()
        );
        hprintln!();
    }

    if !result.extension_sizes.is_empty() {
        let mut ext_sizes: Vec<_> = result.extension_sizes.iter().collect();
        ext_sizes.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));

        animation::print_section_header_animated(
            "📄",
            &format!(
                "FILE TYPES BY SIZE (showing {} of {})",
                top_n.min(ext_sizes.len()),
                ext_sizes.len()
            ),
            no_animation,
        );
        hprintln!(
            "   {:<12} {:>8} {:>11} {:>8}",
            "Extension",
            "Count",
            "Size",
            "% Total"
        );
        hprintln!(
            "   {} {} {} {}",
            "─".repeat(12),
            "─".repeat(8),
            "─".repeat(11),
            "─".repeat(8)
        );

        for (ext, size) in ext_sizes.iter().take(top_n) {
            let count = result.file_types.get(*ext).unwrap_or(&0);
            hprintln!(
                "   {:<12} {:>8} {:>11} {:>7.1}%",
                format_extension(ext),
                count,
                format_bytes(**size),
                pct_of(**size, result.total_size_bytes)
            );
        }
        hprintln!();
    }

    if !result.top_directories.is_empty() {
        use space_analyzer_pro_desktop::category::path_based_category;
        let mut cats: std::collections::HashMap<&str, u64> = std::collections::HashMap::new();
        for d in &result.top_directories {
            let cat = path_based_category(&d.path);
            *cats.entry(cat).or_default() += d.total_size;
        }
        let mut sorted: Vec<_> = cats.iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
        animation::print_section_header_animated(
            "📂",
            &format!(
                "SPACE BY CATEGORY (showing {} of {})",
                top_n.min(sorted.len()),
                sorted.len()
            ),
            no_animation,
        );
        hprintln!("   {:<18} {:>11} {:>8}", "Category", "Size", "% Total");
        hprintln!("   {} {} {}", "─".repeat(18), "─".repeat(11), "─".repeat(8));
        for (&cat, &size) in sorted.iter().take(top_n) {
            let emoji = match cat {
                "Windows" => "🖥️",
                "Program Files" => "⚙️",
                "Temp/Cache" => "🗑️",
                "Development" => "🛠️",
                "AI Models" => "🤖",
                "Virtual" => "💿",
                "Games" => "🎮",
                "Videos" => "🎬",
                "System" => "🔧",
                "Build Output" => "🔨",
                "VCS" => "📚",
                "Cache" => "💰",
                "Test Fixtures" => "🧪",
                "Archives" => "🗜️",
                "Documents" => "📄",
                "Images" => "🖼️",
                "Audio" => "🎵",
                "Databases" => "🗄️",
                "Executables" => "⚙️",
                "Fonts" => "🔤",
                "Other" => "❓",
                _ => "📁",
            };
            hprintln!(
                "   {} {:<15} {:>11} {:>7.1}%",
                emoji,
                cat,
                format_bytes(size),
                pct_of(size, result.total_size_bytes)
            );
        }
        hprintln!();
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
            hprintln!(
                "   {:>3}. {:>11} {:>7.1}%  {}",
                i + 1,
                format_bytes(file.size),
                pct_of(file.size, result.total_size_bytes),
                file.path
            );
        }
        hprintln!();
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
            hprintln!("   {}", dir);
        }
        if result.empty_dirs.len() > 20 {
            hprintln!("   ... and {} more", result.empty_dirs.len() - 20);
        }
        hprintln!();
    }
}

pub fn print_csv(result: &ScanReport) {
    println!("{}", render::build_csv(result));
}

fn print_installer_inventory(result: &ScanReport, no_animation: bool) {
    let groups = render::categorize_installers(result);
    if groups.is_empty() {
        return;
    }
    // The section header, totals and advisory line live here only; the group
    // renderer no longer repeats them (it used to print an identical header
    // and advisory line immediately below this one).
    let (total_size, total_files) = render::installer_totals(&groups);
    animation::print_section_header_animated(
        "📦",
        &format!(
            "INSTALLER & EXECUTABLE INVENTORY ({}, {} files)",
            format_bytes(total_size),
            total_files
        ),
        no_animation,
    );
    hprintln!("   Grouped by type; each group states whether it is safe to delete.");
    hprintln!();
    render::render_installers_text(&groups);
}
