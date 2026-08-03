use space_analyzer_pro_desktop::gui_common;
pub use gui_common::{DirEntry, ScanResult};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A single file info entry for streaming.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfoStreaming {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub extension: String,
}

/// Event emitted on stdout when --stream is active.
///
/// - "progress" lines carry cumulative scan stats and a batch of live files.
/// - "complete" lines carry the final [ScanResult] fields (minus scanned_files
///   which are not needed on the frontend).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum StreamEvent {
    Progress {
        files_scanned: u64,
        directories_scanned: u64,
        total_size: u64,
        percentage: f32,
        current_file: String,
        live_files: Vec<FileInfoStreaming>,
        /// Cumulative file-type counts (extension -> file count), updated in real time
        file_types: HashMap<String, u64>,
        /// Cumulative extension sizes (extension -> total bytes), updated in real time
        extension_sizes: HashMap<String, u64>,
        /// Cumulative category sizes (category name -> total bytes), updated in real time
        category_sizes: HashMap<String, u64>,
    },
    Complete {
        total_files: usize,
        total_size_bytes: u64,
        total_size_mb: f64,
        duration_secs: f64,
        file_types: std::collections::HashMap<String, usize>,
        extension_sizes: std::collections::HashMap<String, u64>,
        largest_files: Vec<gui_common::LargestFileEntry>,
        errors: Vec<String>,
        path: String,
        total_dirs: u64,
        top_directories: Vec<DirEntry>,
        empty_dirs: Vec<String>,
        /// Storage usage by high-level category (name -> total bytes)
        category_sizes: std::collections::HashMap<String, u64>,
        /// Estimated reclaimable bytes (caches, temp, setup archives)
        potential_cleanup_bytes: u64,
        /// ISO-8601 timestamp of when the scan completed
        timestamp: String,
    },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiskInfo {
    pub mount_point: String,
    pub label: String,
    pub file_system: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
}

#[derive(Debug, Clone)]
pub struct Recommendation {
    pub priority: u32,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum InstallerCategory {
    GpuCuda,
    Driver,
    Application,
    Other,
}

impl InstallerCategory {
    pub fn from_path(path: &str) -> Self {
        let lower = path.to_lowercase();
        if lower.contains("driver")
            || lower.contains("realtek")
            || lower.contains("mb_driver")
        {
            InstallerCategory::Driver
        } else if lower.contains("cuda")
            || lower.contains("nvidia")
            || lower.contains("596.21-desktop")
            || lower.contains("amd_ryzen")
        {
            InstallerCategory::GpuCuda
        } else if lower.contains("setup")
            || lower.contains("installer")
            || lower.contains("user")
            || lower.ends_with(".msi")
            || lower.contains("desktop")
        {
            InstallerCategory::Application
        } else {
            InstallerCategory::Other
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            InstallerCategory::GpuCuda => "GPU/Drivers/Chipset",
            InstallerCategory::Driver => "Drivers",
            InstallerCategory::Application => "Application Installers",
            InstallerCategory::Other => "Archives/Other",
        }
    }

    pub fn emoji(&self) -> &'static str {
        match self {
            InstallerCategory::GpuCuda => "🖥️",
            InstallerCategory::Driver => "🔧",
            InstallerCategory::Application => "📱",
            InstallerCategory::Other => "📄",
        }
    }
}

#[derive(Debug, Clone)]
pub struct InstallerGroup {
    pub category: InstallerCategory,
    pub entries: Vec<(String, u64)>,
}
