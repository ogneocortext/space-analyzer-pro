use crate::cli::sink;
use crate::{hprint, hprintln};
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use std::io::{self, Write};
use std::sync::OnceLock;
use std::time::Duration;

/// Whether the destination for human-facing output is an interactive terminal.
///
/// Animations are pure `thread::sleep` time (measured at ~2.4 s for a two-file
/// scan), which is wasted whenever the output is piped to a file, another
/// process or CI. Detect that once and skip the sleeps entirely.
fn output_is_interactive() -> bool {
    static INTERACTIVE: OnceLock<(bool, bool)> = OnceLock::new();
    let (stdout_tty, stderr_tty) = *INTERACTIVE.get_or_init(|| {
        (
            console::Term::stdout().is_term(),
            console::Term::stderr().is_term(),
        )
    });
    if sink::human_goes_to_stderr() {
        stderr_tty
    } else {
        stdout_tty
    }
}

/// Resolve the effective animation setting: explicit `--no-animation` always
/// wins, and non-interactive output implies "no animation" as well.
pub fn animations_enabled(no_animation: bool) -> bool {
    !no_animation && output_is_interactive()
}

/// Animated typewriter banner that prints the Space Analyzer Pro header.
pub fn print_animated_banner() {
    let version = env!("CARGO_PKG_VERSION");
    let title = format!("Space Analyzer Pro v{}", version);
    let prefix = "=> ";

    if !output_is_interactive() {
        eprintln!("{}{}", prefix, title);
        return;
    }

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
    let line_len = title.chars().count() + prefix.len();
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
#[allow(dead_code)]
pub fn update_scan_spinner(pb: &ProgressBar, file_count: usize, bytes_scanned: u64) {
    let size_str = scan_engine::format_bytes(bytes_scanned);
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

/// Width of the decorated section-header rule, shared with the report banner
/// so every framed block lines up.
pub const SECTION_WIDTH: usize = 62;

/// Print a section header, optionally animated.
pub fn print_section_header_animated(icon: &str, title: &str, no_animation: bool) {
    let title_part = format!(" {} {} ", icon, title);
    // Emoji icons render two cells wide in virtually every terminal, so count
    // them as such when centring — otherwise the rules drift by one column.
    let title_width = display_width(&title_part);
    let total_width = SECTION_WIDTH;
    let line_width = total_width.saturating_sub(title_width) / 2;
    let line_right = total_width.saturating_sub(line_width + title_width);

    if !animations_enabled(no_animation) {
        // Instant output — no delays
        let left_line = "═".repeat(line_width);
        let right_line = "═".repeat(line_right);
        hprintln!(
            "  {}{}{}",
            left_line.dimmed(),
            title_part.white().bold(),
            right_line.dimmed()
        );
        return;
    }

    // Print left line in chunks
    let chunk = 10;
    hprint!("  ");
    for i in (0..line_width).step_by(chunk) {
        let end = (i + chunk).min(line_width);
        let segment: String = "═".repeat(end - i);
        hprint!("{}", segment.dimmed());
        sink::flush_human();
        std::thread::sleep(Duration::from_millis(15));
    }

    // Print title
    for ch in title_part.chars() {
        hprint!("{}", ch.to_string().white().bold());
        sink::flush_human();
        std::thread::sleep(Duration::from_millis(10));
    }

    // Print right line in chunks
    for i in (0..line_right).step_by(chunk) {
        let end = (i + chunk).min(line_right);
        let segment: String = "═".repeat(end - i);
        hprint!("{}", segment.dimmed());
        sink::flush_human();
        std::thread::sleep(Duration::from_millis(15));
    }
    hprintln!();
}

/// Approximate terminal cell width of a string, treating emoji and other
/// wide code points as two columns.
pub fn display_width(text: &str) -> usize {
    text.chars()
        .filter(|c| !is_zero_width(*c))
        .map(|c| if is_wide(c) { 2 } else { 1 })
        .sum()
}

fn is_zero_width(c: char) -> bool {
    matches!(c, '\u{200d}' | '\u{fe0e}' | '\u{fe0f}')
}

fn is_wide(c: char) -> bool {
    matches!(c as u32,
        0x1100..=0x115F
        | 0x2E80..=0x303E
        | 0x3041..=0x33FF
        | 0x3400..=0x4DBF
        | 0x4E00..=0x9FFF
        | 0xA000..=0xA4CF
        | 0xAC00..=0xD7A3
        | 0xF900..=0xFAFF
        | 0xFE30..=0xFE6F
        | 0xFF00..=0xFF60
        | 0xFFE0..=0xFFE6
        | 0x1F300..=0x1F64F
        | 0x1F680..=0x1F6FF
        | 0x1F900..=0x1F9FF
        | 0x20000..=0x3FFFD)
}

/// Print a disk usage bar, optionally animated.
pub fn print_animated_bar_mode(
    label: &str,
    percent: f32,
    total_str: &str,
    width: usize,
    no_animation: bool,
) {
    let clamped = percent.clamp(0.0, 100.0);
    let target_filled = ((clamped / 100.0) * width as f32).round() as usize;
    let target_filled = target_filled.min(width);

    if !animations_enabled(no_animation) {
        // Instant output
        let filled = "█".repeat(target_filled);
        let empty = "░".repeat(width.saturating_sub(target_filled));
        hprintln!(
            "  {} [{}{}] {:.1}%",
            label.bold(),
            filled.green(),
            empty.dimmed(),
            percent
        );
        if !total_str.is_empty() {
            hprintln!("    {}", total_str.dimmed());
        }
        return;
    }

    // Print label and opening bracket
    hprint!("  {} [", label.bold());
    sink::flush_human();

    // Fill the bar character by character — append only, no \r
    let step_ms = if target_filled > 25 { 6 } else { 12 };
    let mut current: usize = 0;
    while current < target_filled {
        let advance = ((target_filled - current) / 3)
            .max(1)
            .min(target_filled - current);
        let prev = current;
        current = (current + advance).min(target_filled);

        // Only print the NEW characters (advance), not the full bar
        let new_filled = "█".repeat(current - prev);
        hprint!("{}", new_filled.green());
        sink::flush_human();
        std::thread::sleep(Duration::from_millis(step_ms));
    }

    // Print remaining empty portion and close
    let empty = "░".repeat(width.saturating_sub(target_filled));
    hprintln!("{}] {:.1}%", empty.dimmed(), percent);

    if !total_str.is_empty() {
        hprintln!("    {}", total_str.dimmed());
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

    #[test]
    fn no_animation_flag_always_disables_animation() {
        assert!(!animations_enabled(true));
    }

    #[test]
    fn display_width_counts_emoji_as_two_columns() {
        assert_eq!(display_width("abc"), 3);
        assert_eq!(display_width("📊"), 2);
        assert_eq!(display_width(" 📊 SCAN "), 9);
    }
}
