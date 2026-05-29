//! Session logging for Space Analyzer Pro
//!
//! Provides structured JSON logging for the main application's runtime events.
//! Supports log rotation, buffered writes, and configurable log levels.
//! Respects the user's `log_session_to_file` and `log_file_path` settings.

use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Log severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warning => write!(f, "WARNING"),
            LogLevel::Error => write!(f, "ERROR"),
            LogLevel::Critical => write!(f, "CRITICAL"),
        }
    }
}

/// A single session log entry
#[derive(Debug, Clone, Serialize)]
pub struct SessionLogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub component: String,
    pub event: String,
    pub details: Option<String>,
    pub duration_ms: Option<u64>,
    pub data: Option<serde_json::Value>,
}

/// Configuration for the session logger
#[derive(Debug, Clone)]
pub struct SessionLoggerConfig {
    pub log_path: PathBuf,
    pub max_file_size_bytes: u64,
    pub max_buffer_size: usize,
    pub enabled: bool,
}

impl Default for SessionLoggerConfig {
    fn default() -> Self {
        Self {
            log_path: PathBuf::from("space-analyzer-session.log"),
            max_file_size_bytes: 10 * 1024 * 1024, // 10 MB
            max_buffer_size: 20,
            enabled: false,
        }
    }
}

/// Session logger for the main application runtime.
///
/// Writes structured JSON events to a log file with automatic rotation
/// when the file exceeds the configured maximum size.
pub struct SessionLogger {
    config: SessionLoggerConfig,
    buffer: Vec<String>,
    current_file_size: u64,
    rotation_count: u32,
    error_count: u32,
    last_error_logged: Option<String>,
}

impl SessionLogger {
    /// Create a new session logger with the given configuration.
    pub fn new(config: SessionLoggerConfig) -> Self {
        let (current_size, rotation_count) = if config.enabled {
            let path = &config.log_path;
            let size = if path.exists() {
                fs::metadata(path).map(|m| m.len()).unwrap_or(0)
            } else {
                0
            };
            let rotation = estimate_rotation_count(path, config.max_file_size_bytes);
            (size, rotation)
        } else {
            (0, 0)
        };

        Self {
            config,
            buffer: Vec::new(),
            current_file_size: current_size,
            rotation_count,
            error_count: 0,
            last_error_logged: None,
        }
    }

    /// Log an event with a specific level
    pub fn log(&mut self, level: LogLevel, component: &str, event: &str) {
        if !self.config.enabled {
            return;
        }
        let entry = SessionLogEntry {
            timestamp: current_timestamp(),
            level,
            component: component.to_string(),
            event: event.to_string(),
            details: None,
            duration_ms: None,
            data: None,
        };
        self.push_entry(&entry);
    }

    /// Convenience methods for common log levels
    pub fn info(&mut self, component: &str, event: &str) {
        self.log(LogLevel::Info, component, event);
    }

    pub fn warn(&mut self, component: &str, event: &str) {
        self.log(LogLevel::Warning, component, event);
    }

    pub fn error(&mut self, component: &str, event: &str) {
        self.log(LogLevel::Error, component, event);
    }

    pub fn debug(&mut self, component: &str, event: &str) {
        self.log(LogLevel::Debug, component, event);
    }

    pub fn critical(&mut self, component: &str, event: &str) {
        self.log(LogLevel::Critical, component, event);
    }

    /// Internal: serialize and buffer an entry
    fn push_entry(&mut self, entry: &SessionLogEntry) {
        let json = match serde_json::to_string(entry) {
            Ok(s) => s,
            Err(e) => {
                // Don't panic, just track the error
                self.error_count += 1;
                if self.last_error_logged.as_deref() != Some("serialization_failure") {
                    eprintln!("[SESSION LOGGER] Failed to serialize log entry: {}", e);
                    self.last_error_logged = Some("serialization_failure".to_string());
                }
                return;
            }
        };

        self.buffer.push(json);

        if self.buffer.len() >= self.config.max_buffer_size {
            self.flush();
        }
    }

    /// Flush buffered entries to disk
    pub fn flush(&mut self) {
        if !self.config.enabled || self.buffer.is_empty() {
            return;
        }

        // Check if rotation is needed
        if self.current_file_size >= self.config.max_file_size_bytes {
            self.rotate_log();
        }

        let path = &self.config.log_path;
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let mut file = match OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[SESSION LOGGER] Failed to open log file {}: {}", path.display(), e);
                self.error_count += 1;
                // Re-queue the buffer instead of losing data
                // but only if we haven't errored too many times
                if self.error_count > 5 {
                    eprintln!("[SESSION LOGGER] Too many errors, clearing buffer of {} entries", self.buffer.len());
                    self.buffer.clear();
                }
                return;
            }
        };

        let mut bytes_written = 0u64;
        for entry_json in &self.buffer {
            if writeln!(file, "{}", entry_json).is_ok() {
                bytes_written += entry_json.len() as u64 + 1; // +1 for newline
            } else {
                eprintln!("[SESSION LOGGER] Failed to write log entry");
                self.error_count += 1;
            }
        }

        if let Err(e) = file.flush() {
            eprintln!("[SESSION LOGGER] Failed to flush log file: {}", e);
            self.error_count += 1;
        }

        self.current_file_size += bytes_written;
        self.buffer.clear();
    }

    /// Rotate the log file by renaming it with a timestamp suffix
    fn rotate_log(&mut self) {
        let path = &self.config.log_path;
        if !path.exists() {
            self.current_file_size = 0;
            return;
        }

        self.rotation_count += 1;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let rotated_name = format!(
            "{}.{}.rotated{}",
            path.file_name()
                .map(|n| n.to_string_lossy())
                .unwrap_or_else(|| std::borrow::Cow::Borrowed("session.log")),
            timestamp,
            self.rotation_count
        );

        let rotated_path = if let Some(parent) = path.parent() {
            parent.join(&rotated_name)
        } else {
            PathBuf::from(&rotated_name)
        };

        match fs::rename(path, &rotated_path) {
            Ok(_) => {
                eprintln!(
                    "[SESSION LOGGER] Rotated log: {} -> {}",
                    path.display(),
                    rotated_path.display()
                );
                self.current_file_size = 0;
            }
            Err(e) => {
                eprintln!(
                    "[SESSION LOGGER] Failed to rotate log {}: {}",
                    path.display(),
                    e
                );
                self.error_count += 1;
                // If rotation fails, reset size so we don't try again immediately
                self.current_file_size = 0;
            }
        }
    }

    /// Get the number of errors encountered by the logger itself
    pub fn error_count(&self) -> u32 {
        self.error_count
    }

    /// Enable or disable the logger at runtime
    pub fn set_enabled(&mut self, enabled: bool) {
        if enabled && !self.config.enabled {
            // Just starting: log a session start marker
            self.config.enabled = true;
            self.info("session_logger", "Session logging started");
        } else if !enabled && self.config.enabled {
            // Stopping: flush and log session end
            self.config.enabled = true; // Temporarily keep enabled to write the stop message
            self.info("session_logger", "Session logging stopped");
            self.flush();
            self.config.enabled = false;
        } else {
            self.config.enabled = enabled;
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }
}

impl Drop for SessionLogger {
    fn drop(&mut self) {
        if self.config.enabled && !self.buffer.is_empty() {
            self.info("session_logger", "Session ended");
            self.flush();
        }
    }
}

/// Generate an ISO 8601 timestamp string
fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| {
            let secs = d.as_secs();
            // Simple RFC3339-like format without chrono dependency
            let ms = d.subsec_millis();
            format!("{}Z", format_unix_timestamp(secs, ms))
        })
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

/// Format a Unix timestamp as a basic ISO8601 string
fn format_unix_timestamp(secs: u64, millis: u32) -> String {
    // Calculate date components using a simple algorithm
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Simple date calculation from days since epoch
    let mut y = 1970i64;
    let mut remaining_days = days as i64;

    loop {
        let days_in_year = if is_leap_year(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }

    let month_days = if is_leap_year(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1;
    for &md in month_days.iter() {
        if remaining_days < md {
            break;
        }
        remaining_days -= md;
        month += 1;
    }
    let day = remaining_days + 1;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}",
        y, month, day, hours, minutes, seconds, millis
    )
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// Estimate the number of rotated log files that exist
fn estimate_rotation_count(path: &Path, _max_size: u64) -> u32 {
    if !path.exists() {
        return 0;
    }
    let parent = path.parent().unwrap_or(Path::new("."));
    let stem = path.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();

    let mut count = 0u32;
    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&*stem) && name.contains(".rotated") {
                count += 1;
            }
        }
    }
    count
}