use space_analyzer_pro_desktop::error::{AppError, AppResult};
use std::path::{Path, PathBuf};

use scan_engine::format_bytes;
use super::types::DiskInfo;

/// Parse a human-written size such as `512`, `500K`, `1MB` or `2.5 GB`.
///
/// The whole alphabetic suffix is consumed (not just the last character), so
/// both the short (`M`) and long (`MB`) spellings documented in `--help`
/// actually work. Negative and non-finite values are rejected instead of
/// silently saturating to `0` through an `as u64` cast.
pub fn parse_size(s: &str) -> Result<u64, AppError> {
    let normalized = s.trim().to_uppercase();
    if normalized.is_empty() {
        return Err(AppError::InvalidMinSize("Empty size string".to_string()));
    }

    // Split on the boundary between the numeric part and the unit suffix so
    // multi-character units ("KB", "MB", "GB", "TB") parse correctly.
    let split_at = normalized
        .find(|c: char| c.is_ascii_alphabetic())
        .unwrap_or(normalized.len());
    let (num_str, unit) = normalized.split_at(split_at);
    let num_str = num_str.trim();
    let unit = unit.trim();

    if num_str.is_empty() {
        return Err(AppError::InvalidMinSize(format!(
            "Missing number in '{}'. Try a value like 500K, 10MB or 2G",
            s.trim()
        )));
    }

    let num: f64 = num_str
        .parse()
        .map_err(|e| AppError::InvalidMinSize(format!("Invalid number '{}': {}", num_str, e)))?;

    if !num.is_finite() || num < 0.0 {
        return Err(AppError::InvalidMinSize(format!(
            "Size must be a non-negative, finite number (got '{}')",
            num_str
        )));
    }

    let multiplier: f64 = match unit {
        "" | "B" => 1.0,
        "K" | "KB" => 1024.0,
        "M" | "MB" => 1024.0 * 1024.0,
        "G" | "GB" => 1024.0 * 1024.0 * 1024.0,
        "T" | "TB" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        other => {
            return Err(AppError::InvalidMinSize(format!(
                "Unknown unit '{}'. Use B, K(KB), M(MB), G(GB), or T(TB)",
                other
            )))
        }
    };

    let bytes = num * multiplier;
    if bytes > u64::MAX as f64 {
        return Err(AppError::InvalidMinSize(format!(
            "Size '{}' is too large to represent in bytes",
            s.trim()
        )));
    }
    Ok(bytes as u64)
}

/// Resolve and validate the directory a scan/dedup run should target.
///
/// Returns the canonical path so callers scan, report and persist exactly one
/// unambiguous location instead of a relative string like `.`.
pub fn resolve_scan_path(path: &str) -> AppResult<PathBuf> {
    if path.trim().is_empty() {
        return Err(AppError::Validation("Path cannot be empty".to_string()));
    }

    let requested = Path::new(path);
    let canonical = std::fs::canonicalize(requested).map_err(|e| {
        AppError::Validation(format!(
            "Cannot open path '{}': {}",
            requested.display(),
            e
        ))
    })?;

    if !canonical.is_dir() {
        return Err(AppError::Validation(format!(
            "Path is not a directory: {}",
            display_path(&canonical)
        )));
    }

    Ok(canonical)
}

/// Strip the Windows extended-length prefix (`\\?\`) that `canonicalize`
/// adds, so paths shown to users and stored in history stay readable.
pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy().to_string();
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}

/// Reject an empty size window such as `--min-size 1G --max-size 1M`.
pub fn validate_size_window(min_size: Option<u64>, max_size: Option<u64>) -> AppResult<()> {
    if let (Some(min), Some(max)) = (min_size, max_size) {
        if min > max {
            return Err(AppError::Validation(format!(
                "--min-size ({} bytes) is greater than --max-size ({} bytes); no file can match",
                min, max
            )));
        }
    }
    Ok(())
}

/// Find the volume that actually contains `path`.
///
/// Uses a longest-prefix match so nested mount points (for example `C:\` and
/// `C:\mnt\data`) resolve to the most specific volume rather than whichever
/// one the OS happened to enumerate first, and preserves the mount point's
/// original casing so `scan` and `disk-info` agree.
pub fn get_disk_info(path: &str) -> Option<DiskInfo> {
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let resolved = std::fs::canonicalize(path)
        .map(|p| display_path(&p))
        .unwrap_or_else(|_| path.to_string());
    let needle = resolved.to_uppercase();

    let mut best: Option<(usize, &sysinfo::Disk)> = None;
    for disk in &disks {
        let mount = disk.mount_point().to_string_lossy().to_string();
        if needle.starts_with(&mount.to_uppercase()) {
            let len = mount.len();
            if best.map(|(best_len, _)| len > best_len).unwrap_or(true) {
                best = Some((len, disk));
            }
        }
    }

    best.map(|(_, disk)| disk_info_from(disk))
}

fn disk_info_from(disk: &sysinfo::Disk) -> DiskInfo {
    let total = disk.total_space();
    let available = disk.available_space();
    let used = total.saturating_sub(available);
    let usage = if total > 0 {
        (used as f32 / total as f32) * 100.0
    } else {
        0.0
    };
    DiskInfo {
        mount_point: disk.mount_point().to_string_lossy().to_string(),
        label: disk.name().to_string_lossy().to_string(),
        file_system: disk.file_system().to_string_lossy().to_string(),
        total_bytes: total,
        used_bytes: used,
        available_bytes: available,
        usage_percent: usage,
        total_human: Some(format_bytes(total)),
        used_human: Some(format_bytes(used)),
        available_human: Some(format_bytes(available)),
    }
}

/// Return disk-space info for every mounted volume, sorted by mount point.
///
/// Used by the `disk-info` CLI subcommand so the WinUI 3 frontend can
/// deserialize a `List<DiskVolume>` directly. Always emits a JSON array
/// (empty `[]` when no volumes are present), matching the plural semantics
/// of the frontend's `GetDiskVolumesAsync` call.
pub fn get_all_disks() -> Vec<DiskInfo> {
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut infos: Vec<DiskInfo> = disks.iter().map(disk_info_from).collect();
    infos.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    infos
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_plain_byte_counts() {
        assert_eq!(parse_size("0").unwrap(), 0);
        assert_eq!(parse_size("512").unwrap(), 512);
        assert_eq!(parse_size("512B").unwrap(), 512);
    }

    #[test]
    fn parses_single_and_double_letter_units() {
        assert_eq!(parse_size("1K").unwrap(), 1024);
        assert_eq!(parse_size("1KB").unwrap(), 1024);
        assert_eq!(parse_size("1M").unwrap(), 1024 * 1024);
        assert_eq!(parse_size("1MB").unwrap(), 1024 * 1024);
        assert_eq!(parse_size("1G").unwrap(), 1024 * 1024 * 1024);
        assert_eq!(parse_size("1GB").unwrap(), 1024 * 1024 * 1024);
        assert_eq!(parse_size("1T").unwrap(), 1024u64.pow(4));
        assert_eq!(parse_size("1TB").unwrap(), 1024u64.pow(4));
    }

    #[test]
    fn is_case_and_whitespace_insensitive() {
        assert_eq!(parse_size(" 2.5 gb ").unwrap(), (2.5 * 1024.0 * 1024.0 * 1024.0) as u64);
        assert_eq!(parse_size("10mb").unwrap(), 10 * 1024 * 1024);
    }

    #[test]
    fn rejects_negative_empty_and_unknown_units() {
        assert!(parse_size("-5M").is_err());
        assert!(parse_size("").is_err());
        assert!(parse_size("   ").is_err());
        assert!(parse_size("MB").is_err());
        assert!(parse_size("10XB").is_err());
    }

    #[test]
    fn rejects_inverted_size_window() {
        assert!(validate_size_window(Some(10), Some(5)).is_err());
        assert!(validate_size_window(Some(5), Some(10)).is_ok());
        assert!(validate_size_window(None, Some(10)).is_ok());
        assert!(validate_size_window(Some(5), None).is_ok());
    }

    #[test]
    fn resolve_scan_path_rejects_missing_and_non_directories() {
        let err = resolve_scan_path(r"C:\__space_analyzer_definitely_missing__")
            .expect_err("missing path must be rejected");
        assert!(
            err.to_string().contains("__space_analyzer_definitely_missing__"),
            "the error must name the offending path, got: {err}"
        );

        let tmp = std::env::temp_dir().join("space-analyzer-helpers-test.txt");
        std::fs::write(&tmp, b"x").unwrap();
        let err = resolve_scan_path(tmp.to_str().unwrap())
            .expect_err("a file is not a scannable directory");
        assert!(err.to_string().contains("not a directory"));
        let _ = std::fs::remove_file(&tmp);
    }

    #[test]
    fn display_path_strips_windows_extended_prefix() {
        assert_eq!(display_path(Path::new(r"\\?\C:\Temp")), r"C:\Temp");
        assert_eq!(display_path(Path::new(r"C:\Temp")), r"C:\Temp");
    }
}
