use scan_engine::{FileScanner, ScanOptions, ScanProgress};
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::gui_common::LargestFileEntry;
use std::collections::HashMap;
use std::io::IsTerminal;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;

use super::live_scan::LiveProgress;
use super::types::{DirEntry, FileInfoStreaming, ScanReport, StreamEvent};
use crate::animation;

#[allow(clippy::too_many_arguments)]
pub fn scan_directory(
    path: &Path,
    verbose: bool,
    max_depth: Option<usize>,
    deep: bool,
    shallow: bool,
    min_size: Option<u64>,
    max_size: Option<u64>,
    include_hidden: bool,
    threads: usize,
    no_gpu: bool,
    cache: bool,
    stream: bool,
    progress_json: bool,
    include_files: bool,
    top_n: usize,
    save_history: bool,
    no_animation: bool,
) -> AppResult<ScanReport> {
    // A `Path` that cannot be represented as UTF-8 cannot be handed to the
    // native scanner (which takes `&str`). Fail loudly instead of silently
    // scanning "." via `unwrap_or(".")`, which would report the wrong tree.
    let path_str = path.to_str().ok_or_else(|| {
        space_analyzer_pro_desktop::error::AppError::Validation(format!(
            "Path contains characters that cannot be represented as UTF-8: {}",
            path.display()
        ))
    })?;
    // Live, in-place progress for interactive runs. Only when stderr is a real
    // terminal and the caller is not in a machine-output mode; otherwise it stays
    // silent so redirected logs and `--stream`/`--progress-json` output stay clean.
    let show_live = !stream
        && !progress_json
        && !no_animation
        && (std::io::stderr().is_terminal() || std::env::var("SPACE_ANALYZER_FORCE_LIVE").is_ok());
    let live = Arc::new(LiveProgress::new(show_live));

    let spinner = if verbose && !show_live {
        let pb = animation::create_scan_spinner(&path.display().to_string());
        if deep {
            pb.set_message(format!("Scanning {} (deep mode)", path.display()));
        } else if shallow {
            pb.set_message(format!("Scanning {} (shallow mode)", path.display()));
        } else if let Some(ms) = min_size {
            pb.set_message(format!(
                "Scanning {} (min: {})",
                path.display(),
                scan_engine::format_bytes(ms)
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
    } else if shallow || max_depth == Some(1) {
        ScanOptions::shallow()
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

    // Key the incremental file cache by the canonical display path (not the raw
    // CLI string) so "." resolves to an absolute directory and repeated scans of
    // the same directory â€” via different spellings â€” share the cache. This also
    // matches scan_history.path, which lets orphan pruning find stale caches.
    let cache_key = super::helpers::display_path(path);
    let file_cache: Option<HashMap<String, (u64, i64)>> = if cache {
        Database::default_open().ok().and_then(|db| {
            db.load_file_cache(&cache_key).ok().map(|entries| {
                entries
                    .into_iter()
                    .map(|(k, (s, m, _))| (k, (s, m)))
                    .collect()
            })
        })
    } else {
        None
    };

    let options = ScanOptions {
        min_size,
        max_size,
        include_hidden,
        num_threads: threads,
        top_n,
        file_cache,
        gpu_acceleration: !no_gpu,
        ..depth_mode
    };

    let cancel_flag = AtomicBool::new(false);
    let live_for_cb = Arc::clone(&live);
    let shared_result = scanner.scan_with_progress_sync(
        path_str,
        options,
        move |progress: ScanProgress| {
            if stream {
                let event = StreamEvent::Progress {
                    files_scanned: progress.files_scanned,
                    directories_scanned: progress.directories_scanned,
                    total_size: progress.total_size,
                    percentage: progress.percentage,
                    current_file: progress.current_file,
                    live_files: progress
                        .live_files
                        .into_iter()
                        .map(|f| FileInfoStreaming {
                            path: f.path,
                            name: f.name,
                            size: f.size,
                            extension: f.extension,
                        })
                        .collect(),
                    file_types: progress.file_type_counts,
                    extension_sizes: progress.extension_sizes,
                    category_sizes: progress.category_sizes,
                };
                let line = serde_json::to_string(&event).unwrap_or_default();
                println!("{}", line);
                let _ = std::io::stdout().flush();
            } else if progress_json {
                // Only emit `__PROGRESS__` when a host process asked for it, so
                // interactive runs stay quiet and machine output is opt-in.
                let json = serde_json::to_string(&progress).unwrap_or_default();
                eprintln!("__PROGRESS__{json}");
                let _ = std::io::stderr().flush();
            } else {
                // Interactive live view (stderr terminal, not a machine mode).
                live_for_cb.render(&progress);
            }
        },
        &cancel_flag,
    )?;

    if cache {
        if let Ok(db) = Database::default_open() {
            let entries: Vec<(String, u64, i64, String)> = shared_result
                .scanned_files
                .iter()
                .map(|(path, &(size, mtime))| {
                    let ext = std::path::Path::new(path)
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    (path.clone(), size, mtime, ext)
                })
                .collect();
            let _ = db.save_file_cache(&cache_key, &entries);
        }
    }

    let duration = start_time.elapsed().as_secs_f64();
    if let Some(ref pb) = spinner {
        animation::finish_scan_spinner(pb, shared_result.total_files, duration);
    }
    // Clear the live frame so the final report starts on a clean line.
    live.finish();

    let mut result = ScanReport::new();
    result.total_files = shared_result.total_files as usize;
    result.total_dirs = shared_result.total_directories;
    result.total_size_bytes = shared_result.total_size;
    result.total_size_mb = shared_result.total_size as f64 / (1024.0 * 1024.0);
    result.duration_secs = duration;
    result.path = super::helpers::display_path(path);
    result.errors = shared_result.errors;
    result.scanned_files = shared_result.scanned_files.clone();
    // The per-file map can dwarf every other field on a large tree. The streaming
    // path never serializes it (the Complete event omits `scanned_files`), and the
    // one-shot JSON/CSV/MD summaries already carry top_directories + largest_files
    // + category_sizes. Keep it only when the caller explicitly asks (`--files`).
    if !include_files {
        result.scanned_files.clear();
    }

    for (ext, count) in shared_result.file_types {
        result.file_types.insert(ext, count as usize);
    }

    result.extension_sizes = shared_result.extension_sizes;
    result.category_sizes = shared_result.category_sizes.clone();

    // The subdirectory paths stored by the scanner have already had the Windows
    // `\\?\` verbatim prefix stripped, so compare against a likewise-stripped
    // root to keep the (aggregated) root group out of `top_directories`.
    let scan_path_raw = path.to_string_lossy().to_string();
    let scan_path_str = scan_path_raw
        .strip_prefix(r"\\?\")
        .unwrap_or(&scan_path_raw)
        .to_string();
    let mut top_dirs: Vec<DirEntry> = shared_result
        .subdirectories
        .into_iter()
        .filter(|d| d.path != scan_path_str)
        .map(|d| DirEntry {
            path: d.path,
            name: d.name,
            total_size: d.total_size,
            file_count: d.file_count,
            dir_count: d.dir_count,
        })
        .collect();
    top_dirs.sort_by_key(|b| std::cmp::Reverse(b.total_size));
    // Bound the directory-heavy list to `--top` so whole-drive JSON stays small
    // (the text/MD renderers already slice by `top`, this keeps the machine output
    // consistent with it instead of serializing every subdirectory).
    result.top_directories = top_dirs.into_iter().take(top_n).collect();

    for file in shared_result.largest_files.into_iter().take(top_n) {
        result.largest_files.push(LargestFileEntry {
            path: file.path,
            size: file.size,
        });
    }

    result.empty_dirs = shared_result.empty_directories;
    result.potential_cleanup_bytes = result.calculate_potential_cleanup();
    result.timestamp = chrono::Utc::now().to_rfc3339();

    if stream {
        let complete = StreamEvent::Complete {
            total_files: result.total_files,
            total_size_bytes: result.total_size_bytes,
            total_size_mb: result.total_size_mb,
            duration_secs: result.duration_secs,
            file_types: result
                .file_types
                .iter()
                .map(|(k, v)| (k.clone(), *v as u64))
                .collect(),
            extension_sizes: result.extension_sizes.clone(),
            largest_files: result.largest_files.clone(),
            errors: result.errors.clone(),
            path: result.path.clone(),
            total_dirs: result.total_dirs,
            top_directories: result.top_directories.clone(),
            empty_dirs: result.empty_dirs.clone(),
            category_sizes: result.category_sizes.clone(),
            potential_cleanup_bytes: result.potential_cleanup_bytes,
            timestamp: result.timestamp.clone(),
        };
        let line = serde_json::to_string(&complete).unwrap_or_default();
        println!("{}", line);
        let _ = std::io::stdout().flush();
    }

    if save_history {
        if let Ok(db) = Database::default_open() {
            let max_scan_depth = max_depth.unwrap_or(5) as u32;
            if let Ok(id) = db.save_scan(&result, deep, shallow, max_scan_depth) {
                if stream {
                    let saved = serde_json::json!({ "type": "saved", "id": id });
                    if let Ok(line) = serde_json::to_string(&saved) {
                        println!("{}", line);
                        let _ = std::io::stdout().flush();
                    }
                }
            }
        }
    }

    Ok(result)
}
