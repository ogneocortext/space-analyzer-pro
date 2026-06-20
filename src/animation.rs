use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use std::io::{self, Write};
use std::time::Duration;

/// Animated typewriter banner that prints the Space Analyzer Pro header.
pub fn print_animated_banner() {
    let version = env!("CARGO_PKG_VERSION");
    let title = format!("Space Analyzer Pro v{}", version);
    let prefix = "=> ";

    // Typewriter effect for the title line
    eprint!("{}", prefix.cyan().bold());
    let _ = io::stderr().flush();
    for ch in title.chars() {
        eprint!("{}", ch.to_string().white().bold());
        let _ = io::stderr().flush();
        std::thread::sleep(Duration::from_millis(12));
    }
    eprintln!();
    std::thread::sleep(Duration::from_millis(80));

    // Animated underline
    let line_len = title.len() + prefix.len();
    let chunk = 6;
    eprint!("  ");
    let _ = io::stderr().flush();
    for i in (0..line_len).step_by(chunk) {
        let end = (i + chunk).min(line_len);
        let segment: String = "─".repeat(end - i);
        eprint!("{}", segment.cyan());
        let _ = io::stderr().flush();
        std::thread::sleep(Duration::from_millis(15));
    }
    eprintln!();
    eprintln!();
}

/// Create a styled spinner for scanning progress.
pub fn create_scan_spinner(path: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap()
            .tick_chars("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"),
    );
    pb.set_message(format!("Scanning {}", path));
    pb.enable_steady_tick(Duration::from_millis(80));
    pb
}

/// Update the scan spinner with current progress stats.
pub fn update_scan_spinner(pb: &ProgressBar, file_count: usize, bytes_scanned: u64) {
    let size_str = shared_scanner::format_bytes(bytes_scanned);
    pb.set_message(format!(
        "Scanning... {} files | {}",
        format_with_commas(file_count),
        size_str
    ));
}

/// Finish the spinner with a completion message.
pub fn finish_scan_spinner(pb: &ProgressBar, file_count: u64, duration_secs: f64) {
    pb.finish_with_message(format!(
        "Scan complete! {} files in {:.2}s",
        format_with_commas(file_count as usize),
        duration_secs
    ));
}

/// Print a section header, optionally animated.
pub fn print_section_header_animated(icon: &str, title: &str, no_animation: bool) {
    let title_part = format!(" {} {} ", icon, title);
    let total_width: usize = 46;
    let line_width = (total_width.saturating_sub(title_part.len())) / 2;
    let line_right = total_width.saturating_sub(line_width + title_part.len());

    if no_animation {
        // Instant output — no delays
        let left_line = "═".repeat(line_width);
        let right_line = "═".repeat(line_right);
        println!("  {}{}{}", left_line.dimmed(), title_part.white().bold(), right_line.dimmed());
        return;
    }

    // Print left line in chunks
    let chunk = 10;
    eprint!("  ");
    for i in (0..line_width).step_by(chunk) {
        let end = (i + chunk).min(line_width);
        let segment: String = "═".repeat(end - i);
        print!("{}", segment.dimmed());
        let _ = io::stdout().flush();
        std::thread::sleep(Duration::from_millis(15));
    }

    // Print title
    for ch in title_part.chars() {
        print!("{}", ch.to_string().white().bold());
        let _ = io::stdout().flush();
        std::thread::sleep(Duration::from_millis(10));
    }

    // Print right line in chunks
    for i in (0..line_right).step_by(chunk) {
        let end = (i + chunk).min(line_right);
        let segment: String = "═".repeat(end - i);
        print!("{}", segment.dimmed());
        let _ = io::stdout().flush();
        std::thread::sleep(Duration::from_millis(15));
    }
    println!();
}

/// Print a disk usage bar, optionally animated.
pub fn print_animated_bar_mode(label: &str, percent: f32, total_str: &str, width: usize, no_animation: bool) {
    let target_filled = (percent / 100.0 * width as f32).round() as usize;

    if no_animation {
        // Instant output
        let filled = "█".repeat(target_filled);
        let empty = "░".repeat(width.saturating_sub(target_filled));
        println!("  {} [{}{} ] {:.1}%", label.bold(), filled.green(), empty.dimmed(), percent);
        if !total_str.is_empty() {
            println!("    {}", total_str.dimmed());
        }
        return;
    }

    // Print label and opening bracket
    print!("  {} [", label.bold());
    let _ = io::stdout().flush();

    // Fill the bar character by character — append only, no \r
    let step_ms = if target_filled > 25 { 6 } else { 12 };
    let mut current: usize = 0;
    loop {
        if current >= target_filled {
            break;
        }
        let advance = ((target_filled - current) / 3).max(1).min(target_filled - current);
        let prev = current;
        current += advance;
        if current > target_filled {
            current = target_filled;
        }

        // Only print the NEW characters (advance), not the full bar
        let new_filled = "█".repeat(current - prev);
        print!("{}", new_filled.green());
        let _ = io::stdout().flush();
        std::thread::sleep(Duration::from_millis(step_ms));
    }

    // Print remaining empty portion and close
    let empty = "░".repeat(width.saturating_sub(target_filled));
    println!("{} ] {:.1}%", empty.dimmed(), percent);

    if !total_str.is_empty() {
        println!("    {}", total_str.dimmed());
    }
}

/// Print a completion message with a brief visual indicator.
pub fn print_completion_animation(duration_secs: f64) {
    eprintln!(
        "  {} Results ready! ({:.2}s)",
        "✓".green().bold(),
        duration_secs
    );
    eprintln!();
}

/// Format a number with commas for display.
fn format_with_commas(n: usize) -> String {
    let s = n.to_string();
    let mut result = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(ch);
    }
    result.chars().rev().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_with_commas() {
        assert_eq!(format_with_commas(0), "0");
        assert_eq!(format_with_commas(999), "999");
        assert_eq!(format_with_commas(1000), "1,000");
        assert_eq!(format_with_commas(1234567), "1,234,567");
    }
}
