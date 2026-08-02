use space_analyzer_pro_desktop::gui_common;
pub use gui_common::{DirEntry, ScanResult};

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
