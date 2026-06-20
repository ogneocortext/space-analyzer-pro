use space_analyzer_pro_desktop::gui_common;

pub use gui_common::{DirEntry, ScanResult};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DiskInfo {
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
}
