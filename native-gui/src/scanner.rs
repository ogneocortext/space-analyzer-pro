//! Native GUI scanner wrapper using shared-scanner crate
//! 
//! This module re-exports the shared scanner types and provides
//! GUI-specific convenience functions.

pub use shared_scanner::{
    FileScanner, ScanOptions, ScanResult, ScanProgress,
    FileInfo, SystemInfo, DriveInfo,
    format_bytes, format_duration, get_system_info,
};

/// Create scan options from GUI settings
pub fn gui_scan_options(deep_scan: bool, show_hidden: bool) -> ScanOptions {
    let mut options = if deep_scan {
        ScanOptions::deep()
    } else {
        ScanOptions::medium()
    };
    options.include_hidden = show_hidden;
    options.size_buckets = true;
    options
}
