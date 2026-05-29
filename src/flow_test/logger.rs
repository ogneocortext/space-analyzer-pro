//! Structured JSON logging for flow test events

use crate::flow_test::FlowEvent;
use serde_json;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

/// Flow logger that writes events to a JSON log file
pub struct FlowLogger {
    log_path: PathBuf,
    buffer: Vec<String>,
    max_buffer_size: usize,
}

impl FlowLogger {
    pub fn new(log_path: &PathBuf) -> Self {
        // Initialize log file
        if let Some(parent) = log_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        
        // Clear existing log file
        if log_path.exists() {
            std::fs::write(log_path, "").ok();
        }
        
        Self {
            log_path: log_path.clone(),
            buffer: Vec::new(),
            max_buffer_size: 50,
        }
    }

    /// Log a single event
    pub fn log_event(&mut self, event: &FlowEvent) {
        let json = serde_json::to_string(event).unwrap_or_else(|e| {
            format!("{{\"error\": \"Failed to serialize event: {}\"}}", e)
        });
        
        self.buffer.push(json);
        
        // Flush if buffer is full
        if self.buffer.len() >= self.max_buffer_size {
            self.flush();
        }
    }

    /// Flush buffered events to disk
    pub fn flush(&mut self) {
        if self.buffer.is_empty() {
            return;
        }
        
        // Ensure parent directory exists
        if let Some(parent) = self.log_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        
        let mut file = match OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
        {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[FLOW LOGGER] Failed to open log file {}: {}", self.log_path.display(), e);
                // Keep buffer so data is not lost - will retry on next flush
                return;
            }
        };
        
        let mut write_errors = 0u64;
        for event_json in &self.buffer {
            if writeln!(file, "{}", event_json).is_err() {
                write_errors += 1;
            }
        }
        
        if write_errors > 0 {
            eprintln!("[FLOW LOGGER] Failed to write {} events to log file", write_errors);
        } else {
            self.buffer.clear();
        }
    }

}

impl Drop for FlowLogger {
    fn drop(&mut self) {
        self.flush();
    }
}
