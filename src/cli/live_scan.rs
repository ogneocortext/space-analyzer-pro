//! Live, human-readable progress display for interactive CLI scans.
//!
//! While a scan runs, `ScanProgress` already carries cumulative breakdowns
//! (category sizes, extension sizes, and the top-100 largest files seen so far).
//! This module turns that into an in-place, throttled terminal view so a user
//! watching a long scan (e.g. a whole drive) sees the results as they form
//! instead of waiting for the final summary.
//!
//! It only paints when stderr is an actual terminal — when stderr is redirected
//! to a file or the caller asked for machine output (`--stream` / `--progress-json`
//! / `--no-animation`) the view stays silent so logs and piped data are clean.
//!
//! Presentation follows CLI UX best practices:
//!   - X of Y pattern for determinate progress (files scanned / size)
//!   - Spinner + status line for indeterminate phases (enumerating, finalizing)
//!   - ETA estimation when rate can be computed
//!   - Clean ANSI color codes via the `colored` crate (no raw escapes)
//!   - `\\?\` verbatim prefix stripped so paths stay readable
//!   - stdout stays pure data; everything human-facing goes to stderr

use std::io::Write;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use colored::Colorize;
use scan_engine::ScanProgress;

pub struct LiveProgress {
    started: Instant,
    last_render: Mutex<Instant>,
    last_lines: Mutex<usize>,
    enabled: bool,
}

impl LiveProgress {
    pub fn new(enabled: bool) -> Self {
        let now = Instant::now();
        Self {
            started: now,
            last_render: Mutex::new(now),
            last_lines: Mutex::new(0),
            enabled,
        }
    }

    /// Paint the current live state. Throttled to ~5 fps so a fast scanner does
    /// not flood the terminal; safe to call from multiple scanner threads
    /// (rendering is serialized through the internal mutexes).
    pub fn render(&self, p: &ScanProgress) {
        if !self.enabled {
            return;
        }
        let mut last = self.last_render.lock().unwrap();
        let now = Instant::now();
        if now.duration_since(*last) < Duration::from_millis(200) {
            return;
        }
        *last = now;
        drop(last);

        let elapsed = self.started.elapsed();
        let elapsed_secs = elapsed.as_secs_f64();

        let mut frame = String::new();

        match p.phase.as_str() {
            "enumerating" => {
                // Indeterminate phase — we don't know the total yet.
                // Show a spinner-style status line with what's been found so far.
                let rate = if elapsed_secs > 0.0 {
                    format!("{}/s", p.entries_discovered as f64 / elapsed_secs)
                } else {
                    "—".to_string()
                };
                frame.push_str(&format!(
                    "{} {}\n",
                    "🔍".cyan().bold(),
                    format_discovery(p.entries_discovered, rate.as_str(), elapsed)
                ));
            }
            "scanning" => {
                // Determinate phase — X of Y pattern.
                // percentage is meaningful here because the scanner updates it
                // as files_scanned / total_estimate.
                let bar = progress_bar(p.percentage, 24);
                let eta = if p.percentage > 0.0 && elapsed_secs > 0.0 {
                    let remaining = (100.0 - p.percentage as f64) / p.percentage as f64 * elapsed_secs;
                    fmt_dur(Duration::from_secs_f64(remaining))
                } else {
                    "—".to_string()
                };
                let rate = if elapsed_secs > 0.0 {
                    format!(
                        "{}/s",
                        scan_engine::format_bytes((p.total_size as f64 / elapsed_secs) as u64)
                    )
                } else {
                    "—".to_string()
                };
                frame.push_str(&format!(
                    "{} [{}] {:>5.1}%  {} files · {} · {} · ETA {}\n",
                    "📂".green().bold(),
                    bar,
                    p.percentage,
                    p.files_scanned.to_string().bold(),
                    scan_engine::format_bytes(p.total_size).bold(),
                    rate.bold(),
                    eta.bold()
                ));
                if !p.current_file.is_empty() {
                    frame.push_str(&format!(
                        "  {} {}\n",
                        "▸".dimmed(),
                        truncate(&strip_verbatim(&p.current_file), 60).dimmed()
                    ));
                }
            }
            "processing" => {
                // Transition phase — wrapping up.
                frame.push_str(&format!(
                    "{} {} ({:.0}%) · {} files · {}\n",
                    "⚙️".yellow().bold(),
                    p.current_file.bold(),
                    p.percentage,
                    p.files_scanned.to_string().bold(),
                    fmt_dur(elapsed).dimmed()
                ));
            }
            "finalizing" => {
                // Final compute phase — all files found, just aggregating.
                frame.push_str(&format!(
                    "{} {} · {} files · {} — almost done\n",
                    "✨".magenta().bold(),
                    p.current_file.bold(),
                    p.files_scanned.to_string().bold(),
                    scan_engine::format_bytes(p.total_size).bold(),
                ));
            }
            "complete" => {
                frame.push_str(&format!(
                    "{} {} files · {} · {} total\n",
                    "✓".green().bold(),
                    p.files_scanned.to_string().bold(),
                    scan_engine::format_bytes(p.total_size).bold(),
                    fmt_dur(elapsed).dimmed()
                ));
            }
            _ => {
                frame.push_str(&format!(
                    "{} {} · {}\n",
                    "•".dimmed(),
                    p.current_file.bold(),
                    fmt_dur(elapsed).dimmed()
                ));
            }
        }

        self.paint(&frame);
    }

    /// Erase the live frame so the final report starts on a clean line.
    #[allow(dead_code)]
    pub fn finish(&self) {
        if !self.enabled {
            return;
        }
        let prev = *self.last_lines.lock().unwrap();
        if prev > 0 {
            let clear = format!("\x1b[{}A\x1b[0J", prev);
            let _ = std::io::stderr().write_all(clear.as_bytes());
            let _ = std::io::stderr().flush();
        }
        *self.last_lines.lock().unwrap() = 0;
    }

    fn paint(&self, frame: &str) {
        let prev = *self.last_lines.lock().unwrap();
        let mut out = String::new();
        if prev > 0 {
            out.push_str(&format!("\x1b[{}A\x1b[0J", prev));
        }
        out.push_str(frame);
        let _ = std::io::stderr().write_all(out.as_bytes());
        let _ = std::io::stderr().flush();
        *self.last_lines.lock().unwrap() = frame.matches('\n').count();
    }
}

fn fmt_dur(d: Duration) -> String {
    let s = d.as_secs();
    let m = s / 60;
    let r = s % 60;
    if m > 0 {
        format!("{m}m{r:02}s")
    } else {
        format!("{r}s")
    }
}

/// Render a text progress bar with filled/empty segments.
fn progress_bar(percent: f32, width: usize) -> String {
    let filled = ((percent.clamp(0.0, 100.0) / 100.0) * width as f32).round() as usize;
    let filled = filled.min(width);
    let empty = width.saturating_sub(filled);
    format!(
        "{}{}",
        "█".repeat(filled).green(),
        "░".repeat(empty).dimmed()
    )
}

fn truncate(s: &str, max: usize) -> String {
    let n = s.chars().count();
    if n <= max {
        return s.to_string();
    }
    let skip = n - max;
    format!("…{}", s.chars().skip(skip).collect::<String>())
}

/// Format the discovery-phase status line (no nested format! to avoid clippy
/// format_in_format_args warnings).
fn format_discovery(found: u64, rate: &str, elapsed: Duration) -> String {
    format!(
        "Discovering files · {} found · {} · {}",
        found.to_string().bold(),
        rate.bold(),
        fmt_dur(elapsed).dimmed()
    )
}

/// Strip the Windows extended-length (`\\?\`) verbatim prefix so paths shown
/// in the live progress view stay readable.
fn strip_verbatim(path: &str) -> String {
    path.strip_prefix(r"\\?\").unwrap_or(path).to_string()
}
