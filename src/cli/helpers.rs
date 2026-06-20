use space_analyzer_pro_desktop::error::{AppError, AppResult};
use std::path::Path;

use super::types::DiskInfo;

pub fn parse_size(s: &str) -> Result<u64, AppError> {
    let s = s.trim().to_uppercase();
    let (num_str, unit) = if let Some(last) = s.chars().last() {
        if last.is_alphabetic() {
            let (n, u) = s.split_at(s.len() - 1);
            (n, u)
        } else {
            (s.as_str(), "")
        }
    } else {
        return Err(AppError::InvalidMinSize("Empty size string".to_string()));
    };

    let num: f64 = num_str
        .parse()
        .map_err(|e| AppError::InvalidMinSize(format!("Invalid number '{}': {}", num_str, e)))?;

    match unit {
        "" | "B" => Ok(num as u64),
        "K" | "KB" => Ok((num * 1024.0) as u64),
        "M" | "MB" => Ok((num * 1024.0 * 1024.0) as u64),
        "G" | "GB" => Ok((num * 1024.0 * 1024.0 * 1024.0) as u64),
        "T" | "TB" => Ok((num * 1024.0 * 1024.0 * 1024.0 * 1024.0) as u64),
        _ => Err(AppError::InvalidMinSize(format!(
            "Unknown unit '{}'. Use B, K(KB), M(MB), G(GB), or T(TB)",
            unit
        ))),
    }
}

pub fn validate_input(path: &str, format: &str) -> AppResult<()> {
    if path.is_empty() {
        return Err(AppError::Validation("Path cannot be empty".to_string()));
    }

    let scan_path = Path::new(path);
    let canonical_path = match std::fs::canonicalize(scan_path) {
        Ok(p) => p,
        Err(e) => return Err(AppError::Io(e)),
    };

    if !canonical_path.exists() {
        return Err(AppError::Validation(format!(
            "Path does not exist: {}",
            canonical_path.display()
        )));
    }

    if !canonical_path.is_dir() {
        return Err(AppError::Validation(format!(
            "Path is not a directory: {}",
            canonical_path.display()
        )));
    }

    let valid_formats = ["text", "json", "csv"];
    if !valid_formats.contains(&format) {
        return Err(AppError::Validation(format!(
            "Invalid format '{}'. Valid formats: {}",
            format,
            valid_formats.join(", ")
        )));
    }

    Ok(())
}

pub fn get_disk_info(path: &str) -> Option<DiskInfo> {
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let display = if let Ok(canonical) = std::fs::canonicalize(path) {
        let s = canonical.to_string_lossy().to_uppercase();
        if let Some(stripped) = s.strip_prefix("\\\\?\\") {
            stripped.to_string()
        } else {
            s
        }
    } else {
        path.to_uppercase()
    };

    for disk in &disks {
        let mount = disk.mount_point().to_string_lossy().to_uppercase();
        if display.starts_with(&mount) {
            let total = disk.total_space();
            let available = disk.available_space();
            let used = total.saturating_sub(available);
            let usage = if total > 0 {
                (used as f32 / total as f32) * 100.0
            } else {
                0.0
            };
            return Some(DiskInfo {
                mount_point: mount,
                total_bytes: total,
                used_bytes: used,
                available_bytes: available,
                usage_percent: usage,
            });
        }
    }
    None
}
