//! Common GUI types and utilities for Space Analyzer Pro
//!
//! Uses the scan-engine crate for all scanning operations.

use clap::Parser;
use serde::{Deserialize, Serialize};
use scan_engine::{FileScanner, ScanOptions};
use std::collections::HashMap;

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

/// A single entry from the largest-files list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LargestFileEntry {
    pub path: String,
    pub size: u64,
}

/// Common scan report structure used across all GUI implementations
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanReport {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub total_size_mb: f64,
    pub duration_secs: f64,
    pub file_types: HashMap<String, usize>,
    pub extension_sizes: HashMap<String, u64>,
    pub largest_files: Vec<LargestFileEntry>,
    pub errors: Vec<String>,
    pub path: String,
    #[serde(default)]
    pub total_dirs: u64,
    #[serde(default)]
    pub top_directories: Vec<DirEntry>,
    #[serde(default)]
    pub empty_dirs: Vec<String>,
    #[serde(default)]
    pub scanned_files: HashMap<String, (u64, i64)>,
    #[serde(default)]
    pub category_sizes: HashMap<String, u64>,
    #[serde(default)]
    pub potential_cleanup_bytes: u64,
    #[serde(default)]
    pub timestamp: String,
}

/// Directory entry used in scan results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub path: String,
    pub name: String,
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
}

impl Default for ScanReport {
    fn default() -> Self {
        Self::new()
    }
}

impl ScanReport {
    pub fn new() -> Self {
        Self {
            total_files: 0,
            total_size_bytes: 0,
            total_size_mb: 0.0,
            duration_secs: 0.0,
            file_types: HashMap::new(),
            extension_sizes: HashMap::new(),
            largest_files: Vec::new(),
            errors: Vec::new(),
            path: String::new(),
            total_dirs: 0,
            top_directories: Vec::new(),
            empty_dirs: Vec::new(),
            scanned_files: HashMap::new(),
            category_sizes: HashMap::new(),
            potential_cleanup_bytes: 0,
            timestamp: String::new(),
        }
    }

    /// Convert from scan-engine ScanResult
    pub fn from_shared(
        result: &scan_engine::ScanResult,
        path: String,
        duration_secs: f64,
    ) -> Self {
        let mut scan_result = Self::new();
        scan_result.total_files = result.total_files as usize;
        scan_result.total_size_bytes = result.total_size;
        scan_result.total_size_mb = result.total_size as f64 / (1024.0 * 1024.0);
        scan_result.duration_secs = duration_secs;
        scan_result.path = path;

        for (ext, count) in &result.file_types {
            scan_result.file_types.insert(ext.clone(), *count as usize);
        }

        for (ext, size) in &result.extension_sizes {
            scan_result.extension_sizes.insert(ext.clone(), *size);
        }

        for file in &result.largest_files {
            scan_result.largest_files.push(LargestFileEntry {
                path: file.path.clone(),
                size: file.size,
            });
        }
        scan_result.errors = result.errors.clone();
        scan_result.total_dirs = result.total_directories;
        scan_result.empty_dirs = result.empty_directories.clone();
        scan_result.scanned_files = result.scanned_files.clone();
        scan_result.category_sizes = result.category_sizes.clone();

        scan_result
    }

    /// Estimate how many bytes could be reclaimed by cleaning caches,
    /// temp files, and setup/installer archives found in the largest-files list.
    pub fn calculate_potential_cleanup(&self) -> u64 {
        let mut total: u64 = 0;

        for (ext, size) in &self.extension_sizes {
            let lower = ext.to_lowercase();
            if lower == "tmp" || lower == "cache" || lower == "log" {
                total += *size;
            }
        }

        for file in &self.largest_files {
            let lower = file.path.to_lowercase();
            if (lower.ends_with(".exe")
                || lower.ends_with(".msi")
                || lower.ends_with(".zip")
                || lower.ends_with(".rar"))
                && (lower.contains("installer") || lower.contains("setup"))
            {
                total += file.size;
            }
        }

        total
    }
}

/// Common scanning function used by GUI implementations
pub fn scan_directory(path: &std::path::Path, deep: bool) -> Result<ScanReport, String> {
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
    let app_result = scanner
        .scan_directory_sync(path.to_str().unwrap_or("."), options)
        .map_err(|e| e.to_string())?;

    let duration = start_time.elapsed().as_secs_f64();
    Ok(ScanReport::from_shared(
        &app_result,
        path.to_string_lossy().to_string(),
        duration,
    ))
}

/// Common formatting utilities
pub mod formatting {
    pub use scan_engine::format_bytes;
}
