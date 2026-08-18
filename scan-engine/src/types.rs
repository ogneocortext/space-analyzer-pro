//! Data structures shared by the scanner engine.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// File information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: Option<String>,
    pub file_type: String,
    pub extension: String,
}

/// Scan progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub files_scanned: u64,
    pub directories_scanned: u64,
    pub total_size: u64,
    pub current_file: String,
    pub percentage: f32,
    pub completed: bool,
    pub live_files: Vec<FileInfo>,
    pub file_type_counts: HashMap<String, u64>,
    pub extension_sizes: HashMap<String, u64>,
    pub category_sizes: HashMap<String, u64>,
}

/// Scan result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_files: u64,
    pub total_directories: u64,
    pub total_size: u64,
    pub file_types: HashMap<String, u64>,
    pub extension_sizes: HashMap<String, u64>,
    pub size_distribution: HashMap<String, u64>,
    pub largest_files: Vec<FileInfo>,
    pub empty_directories: Vec<String>,
    pub errors: Vec<String>,
    pub subdirectories: Vec<DirInfo>,
    pub scanned_files: HashMap<String, (u64, i64)>,
    pub category_sizes: HashMap<String, u64>,
}

/// Per-directory aggregate information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirInfo {
    pub path: String,
    pub name: String,
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub largest_file_size: u64,
}

/// Scan options
#[derive(Debug, Clone)]
pub struct ScanOptions {
    pub max_depth: Option<usize>,
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    pub include_hidden: bool,
    pub follow_symlinks: bool,
    pub size_buckets: bool,
    pub gpu_acceleration: bool,
    pub cuda_enabled: bool,
    pub num_threads: usize,
    pub top_n: usize,
    pub file_cache: Option<HashMap<String, (u64, i64)>>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            max_depth: None,
            min_size: None,
            max_size: None,
            include_hidden: false,
            follow_symlinks: false,
            size_buckets: true,
            gpu_acceleration: true,
            cuda_enabled: false,
            num_threads: 0,
            top_n: 100,
            file_cache: None,
        }
    }
}

impl ScanOptions {
    /// Create options for shallow scan (depth 1)
    pub fn shallow() -> Self {
        Self {
            max_depth: Some(1),
            ..Default::default()
        }
    }

    /// Create options for medium scan (depth 5)
    pub fn medium() -> Self {
        Self {
            max_depth: Some(5),
            ..Default::default()
        }
    }

    /// Create options for deep scan (unlimited depth)
    pub fn deep() -> Self {
        Self {
            max_depth: None,
            ..Default::default()
        }
    }

    /// Filter for large files only (>10MB)
    pub fn large_files_only() -> Self {
        Self {
            min_size: Some(10 * 1024 * 1024),
            ..Default::default()
        }
    }

    /// Filter for small files only (<1MB)
    pub fn small_files_only() -> Self {
        Self {
            max_size: Some(1024 * 1024),
            ..Default::default()
        }
    }

    /// Enable or disable GPU acceleration
    pub fn with_gpu(mut self, enabled: bool) -> Self {
        self.gpu_acceleration = enabled;
        self
    }

    /// Enable or disable CUDA-specific kernels
    pub fn with_cuda(mut self, enabled: bool) -> Self {
        self.cuda_enabled = enabled;
        self
    }
}

/// System information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub total_memory: u64,
    pub available_memory: u64,
    pub cpu_cores: usize,
    pub drives: Vec<DriveInfo>,
}

/// Drive information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveInfo {
    pub name: String,
    pub mount_point: String,
    pub file_system: String,
    pub total_space: u64,
    pub available_space: u64,
    pub is_removable: bool,
}
