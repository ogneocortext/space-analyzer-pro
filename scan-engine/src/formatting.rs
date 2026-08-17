/// Size bucket categorization
pub fn size_bucket(size: u64) -> &'static str {
    if size == 0 {
        "0 B"
    } else if size < 1024 {
        "< 1 KB"
    } else if size < 10 * 1024 {
        "1-10 KB"
    } else if size < 100 * 1024 {
        "10-100 KB"
    } else if size < 1024 * 1024 {
        "100 KB-1 MB"
    } else if size < 10 * 1024 * 1024 {
        "1-10 MB"
    } else if size < 100 * 1024 * 1024 {
        "10-100 MB"
    } else if size < 1024 * 1024 * 1024 {
        "100 MB-1 GB"
    } else {
        "> 1 GB"
    }
}

/// Format bytes to human-readable string
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

/// Format duration to human-readable string
pub fn format_duration(seconds: f64) -> String {
    if seconds < 60.0 {
        format!("{:.1}s", seconds)
    } else if seconds < 3600.0 {
        format!("{:.1}m", seconds / 60.0)
    } else {
        format!("{:.1}h", seconds / 3600.0)
    }
}

/// Returns the on-disk *allocated* size of a file — the bytes it actually
/// occupies on the volume — rather than its logical length.
pub fn allocated_size(metadata: &std::fs::Metadata, path: &std::path::Path) -> u64 {
    if metadata.is_dir() {
        return metadata.len();
    }
    allocated_size_of_file(metadata, path)
}

#[cfg(windows)]
extern "system" {
    fn GetCompressedFileSizeW(lpFileName: *const u16, lpFileSizeHigh: *mut u32) -> u32;
}

#[cfg(windows)]
fn allocated_size_of_file(metadata: &std::fs::Metadata, path: &std::path::Path) -> u64 {
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0u16))
        .collect();
    let mut high: u32 = 0;
    let low = unsafe { GetCompressedFileSizeW(wide.as_ptr(), &mut high) };
    if low != 0xFFFF_FFFF || std::io::Error::last_os_error().raw_os_error() == Some(0) {
        ((high as u64) << 32) | (low as u64)
    } else {
        metadata.len()
    }
}

#[cfg(unix)]
fn allocated_size_of_file(metadata: &std::fs::Metadata, _path: &std::path::Path) -> u64 {
    use std::os::unix::fs::MetadataExt;
    (metadata.st_blocks() as u64) * 512
}

#[cfg(not(any(unix, windows)))]
fn allocated_size_of_file(metadata: &std::fs::Metadata, _path: &std::path::Path) -> u64 {
    metadata.len()
}
