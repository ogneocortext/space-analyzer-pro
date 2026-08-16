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

use std::io::Write;
use std::sync::Mutex;
use std::time::{Duration, Instant};

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
        let rate_str = if elapsed.as_secs_f64() >= 1.0 {
            format!(
                "{}/s",
                scan_engine::format_bytes((p.total_size as f64 / elapsed.as_secs_f64()) as u64)
            )
        } else {
            "—".to_string()
        };

        let mut frame = String::new();

        frame.push_str(&format!(
            "\x1b[1mScanning\x1b[0m {}  \x1b[36m{}\x1b[0m files · \x1b[36m{}\x1b[0m · \x1b[33m{}\x1b[0m · {}\n",
            truncate(&p.current_file, 58),
            p.files_scanned,
            scan_engine::format_bytes(p.total_size),
            rate_str,
            fmt_dur(elapsed),
        ));

        let mut cats: Vec<(&String, &u64)> = p.category_sizes.iter().collect();
        cats.sort_by_key(|(_, v)| std::cmp::Reverse(**v));
        if !cats.is_empty() {
            frame.push_str(&format!("\x1b[2m  Top categories ({}):\x1b[0m\n", cats.len()));
            for (k, v) in cats.iter().take(6) {
                frame.push_str(&format!(
                    "    \x1b[32m{:>11}\x1b[0m {}\n",
                    scan_engine::format_bytes(**v),
                    k
                ));
            }
        }

        let mut files: Vec<_> = p.live_files.iter().collect();
        files.sort_by_key(|f| std::cmp::Reverse(f.size));
        if !files.is_empty() {
            frame.push_str(&format!("\x1b[2m  Largest so far ({}):\x1b[0m\n", files.len()));
            for f in files.iter().take(5) {
                frame.push_str(&format!(
                    "    \x1b[35m{:>11}\x1b[0m {}\n",
                    scan_engine::format_bytes(f.size),
                    truncate(&f.path, 64),
                ));
            }
        }

        self.paint(&frame);
    }

    /// Erase the live frame so the final report starts on a clean line.
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

fn truncate(s: &str, max: usize) -> String {
    let n = s.chars().count();
    if n <= max {
        return s.to_string();
    }
    let skip = n - max + 1;
    format!("…{}", s.chars().skip(skip).collect::<String>())
}
