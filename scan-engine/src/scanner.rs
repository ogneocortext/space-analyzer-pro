use chrono::DateTime;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use walkdir::WalkDir;

use crate::categories::extension_to_category;
use crate::formatting::{allocated_size, size_bucket};
use crate::types::{
    DirInfo, DriveInfo, FileInfo, ScanOptions, ScanProgress, ScanResult, SearchQuery, SearchResult,
    SystemInfo,
};

/// File scanner implementation
pub struct FileScanner;

impl Default for FileScanner {
    fn default() -> Self {
        Self::new()
    }
}

impl FileScanner {
    pub fn new() -> Self {
        Self
    }
}

include!("scanner_sync.rs");
include!("scanner_progress.rs");

/// Get system information
pub fn get_system_info() -> SystemInfo {
    use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};

    let mut system = System::new_with_specifics(
        RefreshKind::nothing()
            .with_memory(MemoryRefreshKind::everything())
            .with_cpu(CpuRefreshKind::everything()),
    );
    system.refresh_memory();
    system.refresh_cpu_all();

    let disks = Disks::new_with_refreshed_list();
    let drives = disks
        .iter()
        .map(|disk| DriveInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            file_system: disk.file_system().to_string_lossy().to_string(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            is_removable: false,
        })
        .collect();

    SystemInfo {
        os: System::long_os_version().unwrap_or_else(|| "Unknown".to_string()),
        arch: std::env::consts::ARCH.to_string(),
        total_memory: system.total_memory(),
        available_memory: system.available_memory(),
        cpu_cores: system.cpus().len(),
        drives,
    }
}
