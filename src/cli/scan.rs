use shared_scanner::{FileScanner, ScanOptions};
use space_analyzer_pro_desktop::error::AppResult;
use std::path::Path;
use std::time::Instant;

use super::types::{DirEntry, ScanResult};
use crate::animation;

#[allow(clippy::too_many_arguments)]
pub fn scan_directory(
    path: &Path,
    verbose: bool,
    max_depth: Option<usize>,
    deep: bool,
    min_size: Option<u64>,
    max_size: Option<u64>,
    include_hidden: bool,
    _no_animation: bool,
) -> AppResult<ScanResult> {
    let spinner = if verbose {
        let pb = animation::create_scan_spinner(&path.display().to_string());
        if deep {
            pb.set_message(format!("Scanning {} (deep mode)", path.display()));
        }
        if let Some(ms) = min_size {
            pb.set_message(format!(
                "Scanning {} (min: {})",
                path.display(),
                shared_scanner::format_bytes(ms)
            ));
        }
        Some(pb)
    } else {
        None
    };

    let start_time = Instant::now();
    let scanner = FileScanner::new();
    let depth_mode = if deep {
        ScanOptions::deep()
    } else if let Some(d) = max_depth {
        ScanOptions {
            max_depth: Some(d),
            ..ScanOptions::default()
        }
    } else {
        ScanOptions {
            max_depth: Some(5),
            ..ScanOptions::default()
        }
    };
    let options = ScanOptions {
        min_size,
        max_size,
        include_hidden,
        ..depth_mode
    };

    let shared_result = scanner.scan_directory_sync(path.to_str().unwrap_or("."), options)?;

    let duration = start_time.elapsed().as_secs_f64();
    if let Some(ref pb) = spinner {
        animation::finish_scan_spinner(pb, shared_result.total_files, duration);
    }

    let mut result = ScanResult::new();
    result.total_files = shared_result.total_files as usize;
    result.total_dirs = shared_result.total_directories;
    result.total_size_bytes = shared_result.total_size;
    result.total_size_mb = shared_result.total_size as f64 / (1024.0 * 1024.0);
    result.duration_secs = duration;
    result.path = path.to_string_lossy().to_string();
    result.errors = shared_result.errors;

    for (ext, count) in shared_result.file_types {
        result.file_types.insert(ext, count as usize);
    }

    result.extension_sizes = shared_result.extension_sizes;

    let scan_path_str = path.to_string_lossy().to_string();
    let mut top_dirs: Vec<DirEntry> = shared_result
        .subdirectories
        .into_iter()
        .filter(|d| d.total_size > 0 && d.path != scan_path_str)
        .map(|d| DirEntry {
            path: d.path,
            name: d.name,
            total_size: d.total_size,
            file_count: d.file_count,
            dir_count: d.dir_count,
        })
        .collect();
    top_dirs.sort_by_key(|b| std::cmp::Reverse(b.total_size));
    result.top_directories = top_dirs;

    for file in shared_result.largest_files.into_iter().take(50) {
        result.largest_files.push((file.path, file.size));
    }

    result.empty_dirs = shared_result.empty_directories;

    Ok(result)
}
