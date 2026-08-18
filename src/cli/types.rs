pub use gui_common::{DirEntry, ScanReport};
use space_analyzer_pro_desktop::gui_common;

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
/// - "complete" lines carry the final [ScanReport] fields (minus scanned_files
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
        file_types: std::collections::HashMap<String, u64>,
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
    /// Human-readable companions, mirroring the curated `scan --format json`
    /// output so a `--format json` consumer gets readable sizes for free.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_human: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used_human: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_human: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
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

/// Lowercase file name plus its immediate parent directory name.
///
/// Classification deliberately ignores the rest of the path: matching bare
/// substrings against the *whole* path meant every file under `C:\Users\...`
/// hit the "user" rule and every file on the Desktop hit the "desktop" rule,
/// so ordinary archives were reported as application installers.
fn name_and_parent(path: &str) -> (String, String) {
    let p = std::path::Path::new(path);
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let parent = p
        .parent()
        .and_then(|d| d.file_name())
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    (name, parent)
}

/// True for names like `596.21-desktop-win10-win11-64bit.exe` — a graphics
/// driver package identified by its `<major>.<minor>-desktop` version stamp
/// rather than by one hardcoded release the developer happened to have.
fn looks_like_gpu_driver_release(name: &str) -> bool {
    let Some(idx) = name.find("-desktop") else {
        return false;
    };
    let version = &name[..idx];
    let mut parts = version.rsplit(|c: char| !(c.is_ascii_digit() || c == '.'));
    let candidate = parts.next().unwrap_or("");
    let mut chunks = candidate.split('.');
    let (Some(major), Some(minor)) = (chunks.next(), chunks.next()) else {
        return false;
    };
    !major.is_empty()
        && !minor.is_empty()
        && major.chars().all(|c| c.is_ascii_digit())
        && minor.chars().all(|c| c.is_ascii_digit())
}

impl InstallerCategory {
    pub fn from_path(path: &str) -> Self {
        let (name, parent) = name_and_parent(path);
        let haystack = format!("{parent}/{name}");

        const DRIVER_MARKERS: [&str; 5] =
            ["driver", "realtek", "chipset", "mb_driver", "audio_driver"];
        const GPU_MARKERS: [&str; 6] =
            ["cuda", "nvidia", "geforce", "radeon", "cudnn", "amd_ryzen"];
        const APP_MARKERS: [&str; 6] = [
            "setup",
            "install",
            "installer",
            "-x64",
            "webinstall",
            "redist",
        ];

        if DRIVER_MARKERS.iter().any(|m| haystack.contains(m)) {
            InstallerCategory::Driver
        } else if GPU_MARKERS.iter().any(|m| haystack.contains(m))
            || looks_like_gpu_driver_release(&name)
        {
            InstallerCategory::GpuCuda
        } else if name.ends_with(".msi")
            || name.ends_with(".msix")
            || APP_MARKERS.iter().any(|m| name.contains(m))
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

    /// Advice shown alongside the group, so archives are not lumped in with
    /// installers under a blanket "safe to delete" claim.
    pub fn advice(&self) -> &'static str {
        match self {
            InstallerCategory::GpuCuda => "Safe to remove once the driver is installed.",
            InstallerCategory::Driver => "Safe to remove once the driver is installed.",
            InstallerCategory::Application => {
                "Safe to remove after confirming the application works."
            }
            InstallerCategory::Other => {
                "Review before deleting — these may be archives you still need."
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct InstallerGroup {
    pub category: InstallerCategory,
    pub entries: Vec<(String, u64)>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_user_archives_are_not_installers() {
        // Previously matched the bare "user" substring in C:\Users\... and the
        // "desktop" substring in the Desktop folder.
        assert_eq!(
            InstallerCategory::from_path(r"C:\Users\alice\Downloads\photos-2024.zip"),
            InstallerCategory::Other
        );
        assert_eq!(
            InstallerCategory::from_path(r"C:\Users\alice\Desktop\backup.rar"),
            InstallerCategory::Other
        );
        assert_eq!(
            InstallerCategory::from_path(r"C:\Users\alice\AppData\Local\Temp\archive.zip"),
            InstallerCategory::Other
        );
    }

    #[test]
    fn real_installers_are_still_detected() {
        assert_eq!(
            InstallerCategory::from_path(r"C:\Users\alice\Downloads\setup_app.exe"),
            InstallerCategory::Application
        );
        assert_eq!(
            InstallerCategory::from_path(r"D:\stuff\SomeApp.msi"),
            InstallerCategory::Application
        );
        assert_eq!(
            InstallerCategory::from_path(r"D:\stuff\VisualStudioInstaller.exe"),
            InstallerCategory::Application
        );
    }

    #[test]
    fn drivers_and_gpu_packages_are_classified() {
        assert_eq!(
            InstallerCategory::from_path(r"D:\dl\Realtek_Audio.exe"),
            InstallerCategory::Driver
        );
        assert_eq!(
            InstallerCategory::from_path(r"D:\dl\cuda_12.4.0_windows.exe"),
            InstallerCategory::GpuCuda
        );
    }

    #[test]
    fn gpu_driver_versions_are_matched_generically_not_hardcoded() {
        // The old code only knew about one specific release ("596.21-desktop").
        assert_eq!(
            InstallerCategory::from_path(r"D:\dl\596.21-desktop-win10-win11-64bit.exe"),
            InstallerCategory::GpuCuda
        );
        assert_eq!(
            InstallerCategory::from_path(r"D:\dl\601.05-desktop-win11-64bit.exe"),
            InstallerCategory::GpuCuda
        );
        // A plain "desktop" in the name is not a driver release.
        assert_eq!(
            InstallerCategory::from_path(r"D:\dl\desktop-photos.zip"),
            InstallerCategory::Other
        );
    }
}
