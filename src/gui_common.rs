//! Common GUI types and utilities for Space Analyzer Pro
//! 
//! Uses the shared-scanner crate for all scanning operations.

use clap::Parser;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use shared_scanner::{FileScanner, ScanOptions};

/// Common command-line interface for GUI applications
#[derive(Parser)]
pub struct GuiCli {
    /// Directory to analyze (default: current directory)
    #[arg(short, long, default_value = ".")]
    pub path: String,

    /// Show help instead of launching GUI
    #[arg(long)]
    pub help_only: bool,
}

/// Common scan result structure used across all GUI implementations
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanResult {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub total_size_mb: f64,
    pub duration_secs: f64,
    pub file_types: HashMap<String, usize>,
    pub largest_files: Vec<(String, u64)>,
    pub path: String,
}

impl ScanResult {
    pub fn new() -> Self {
        Self {
            total_files: 0,
            total_size_bytes: 0,
            total_size_mb: 0.0,
            duration_secs: 0.0,
            file_types: HashMap::new(),
            largest_files: Vec::new(),
            path: String::new(),
        }
    }

    /// Convert from shared-scanner ScanResult
    pub fn from_shared(result: &shared_scanner::ScanResult, path: String, duration_secs: f64) -> Self {
        let mut scan_result = Self::new();
        scan_result.total_files = result.total_files as usize;
        scan_result.total_size_bytes = result.total_size;
        scan_result.total_size_mb = result.total_size as f64 / (1024.0 * 1024.0);
        scan_result.duration_secs = duration_secs;
        scan_result.path = path;

        for (ext, count) in &result.file_types {
            scan_result.file_types.insert(ext.clone(), *count as usize);
        }

        for file in &result.largest_files {
            scan_result.largest_files.push((file.path.clone(), file.size));
        }

        scan_result
    }
}

/// Common scanning function used by GUI implementations
#[allow(dead_code)]
pub fn scan_directory(
    path: &std::path::Path,
    deep: bool,
) -> Result<ScanResult, String> {
    let start_time = std::time::Instant::now();

    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    let options = if deep {
        ScanOptions::deep()
    } else {
        ScanOptions::medium()
    };

    let scanner = FileScanner::new();
    let app_result = scanner.scan_directory_sync(
        path.to_str().unwrap_or("."),
        options,
    ).map_err(|e| e.to_string())?;

    let duration = start_time.elapsed().as_secs_f64();
    Ok(ScanResult::from_shared(&app_result, path.to_string_lossy().to_string(), duration))
}

/// Common formatting utilities
pub mod formatting {
    pub use shared_scanner::format_bytes;
}
