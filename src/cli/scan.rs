use shared_scanner::{FileScanner, ScanOptions};
use space_analyzer_pro_desktop::error::AppResult;
use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;
use walkdir::WalkDir;

use crate::animation;
use super::types::{DirEntry, ScanResult};

#[allow(clippy::too_many_arguments)]
pub fn scan_directory(
    path: &Path,
    verbose: bool,
    max_depth: Option<usize>,
    deep: bool,
    min_size: Option<u64>,
    max_size: Option<u64>,
    _include_hidden: bool,
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
    let options = depth_mode;

    let shared_result = scanner.scan_directory_sync(path.to_str().unwrap_or("."), options)?;

    let mut extension_sizes: HashMap<String, u64> = HashMap::new();
    let mut dir_sizes: HashMap<String, (u64, u64, u64)> = HashMap::new();
    let mut filtered_file_count: usize = 0;
    let mut filtered_total_size: u64 = 0;
    let mut last_progress_report: usize = 0;
    let progress_interval = 10000;

    let scan_depth = if deep { usize::MAX } else { max_depth.unwrap_or(15) };
    let walker_builder = WalkDir::new(path).max_depth(scan_depth);
    let walker = walker_builder.into_iter();

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                if verbose {
                    if let Some(ref pb) = spinner {
                        pb.set_message(format!("Warning: {}", e));
                    }
                }
                continue;
            }
        };
        let entry_path = entry.path();

        if entry.file_type().is_file() {
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_e) => {
                    if verbose {
                        if let Some(ref pb) = spinner {
                            pb.set_message(format!("Skipping: {}", entry_path.display()));
                        }
                    }
                    continue;
                }
            };
            let size = metadata.len();

            if let Some(min) = min_size {
                if size < min {
                    continue;
                }
            }
            if let Some(max) = max_size {
                if size > max {
                    continue;
                }
            }

            filtered_total_size += size;
            filtered_file_count += 1;

            if verbose && filtered_file_count - last_progress_report >= progress_interval {
                if let Some(ref pb) = spinner {
                    animation::update_scan_spinner(pb, filtered_file_count, filtered_total_size);
                }
                last_progress_report = filtered_file_count;
            }

            let ext = entry_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            *extension_sizes.entry(ext).or_insert(0) += size;

            if let Some(parent) = entry_path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                let entry = dir_sizes.entry(parent_str).or_insert((0, 0, 0));
                entry.0 += size;
                entry.1 += 1;
            }
        } else if entry.file_type().is_dir() && entry.depth() > 0 {
            if let Some(parent) = entry_path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                let e = dir_sizes.entry(parent_str).or_insert((0, 0, 0));
                e.2 += 1;
            }
        }
    }

    let duration = start_time.elapsed().as_secs_f64();
    if let Some(ref pb) = spinner {
        animation::finish_scan_spinner(pb, filtered_file_count as u64, duration);
    }

    let mut result = ScanResult::new();
    result.total_files = filtered_file_count;
    result.total_dirs = shared_result.total_directories;
    result.total_size_bytes = filtered_total_size;
    result.total_size_mb = filtered_total_size as f64 / (1024.0 * 1024.0);
    result.duration_secs = duration;
    result.path = path.to_string_lossy().to_string();
    result.errors = shared_result.errors;

    for (ext, count) in shared_result.file_types {
        result.file_types.insert(ext, count as usize);
    }

    result.extension_sizes = extension_sizes;

    let scan_path_str = path.to_string_lossy().to_string();
    let mut top_dirs: Vec<DirEntry> = dir_sizes
        .into_iter()
        .filter(|(p, (sz, _, _))| *sz > 0 && p != &scan_path_str)
        .map(|(p, (size, file_count, dir_count))| {
            let name = Path::new(&p)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());
            DirEntry {
                path: p,
                name,
                total_size: size,
                file_count,
                dir_count,
            }
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
