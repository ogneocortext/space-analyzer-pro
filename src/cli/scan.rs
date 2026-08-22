use scan_engine::{FileScanner, ScanOptions, ScanProgress};
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::gui_common::LargestFileEntry;
use std::collections::HashMap;
use std::io::IsTerminal;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use super::live_scan::LiveProgress;
use super::types::{CompleteEvent, DirDrillDown, DirEntry, FileInfoStreaming, ProgressEvent, ScanReport, StreamEvent};
use crate::animation;

/// How many of the largest files / top directories to persist in a saved scan
/// history record. Mirrors the GUI, which always scans with `--top 250`. The
/// display `--top` default is 20, but history-based tooling (e.g. the agentic
/// `ask` loop and its `get_largest_files` tool) needs a much larger slice than
/// the on-screen report would otherwise store.
const SAVE_HISTORY_TOP_N: usize = 250;

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
    follow_symlinks: bool,
    threads: usize,
    no_gpu: bool,
    cache: bool,
    stream: bool,
    progress_json: bool,
    progress_log: Option<String>,
    include_files: bool,
    drill: usize,
    top_n: usize,
    save_history: bool,
    log_path: Option<String>,
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
        follow_symlinks,
        num_threads: threads,
        top_n,
        file_cache,
        gpu_acceleration: !no_gpu,
        ..depth_mode
    };
    let cancel_flag = AtomicBool::new(false);
    let live_for_cb = Arc::clone(&live);

    // Open the optional JSON-lines step log. Failures to open are non-fatal: we
    // warn and continue scanning without a step log rather than aborting the run.
    let mut log_writer: Option<Box<dyn std::io::Write>> = None;
    if let Some(log_path) = &log_path {
        match std::fs::File::create(log_path) {
            Ok(file) => log_writer = Some(Box::new(file)),
            Err(e) => eprintln!("⚠️ Could not open scan step-log file '{}': {}", log_path, e),
        }
    }

    // Open the optional machine-readable progress log. Independent of stderr so a
    // GUI or log watcher can follow structured progress events while the terminal
    // keeps the human-readable live view. Each line is one JSON object. Wrapped in
    // Arc<Mutex<>> so the Clone + Send scanner callback can append to it.
    let progress_log_writer: Arc<Mutex<Option<Box<dyn std::io::Write + Send>>>> =
        Arc::new(Mutex::new(None));
    if let Some(pl_path) = &progress_log {
        match std::fs::File::create(pl_path) {
            Ok(file) => *progress_log_writer.lock().unwrap() = Some(Box::new(file)),
            Err(e) => {
                eprintln!("⚠️ Could not open progress-log file '{}': {}", pl_path, e)
            }
        }
    }
    let progress_log_for_cb = Arc::clone(&progress_log_writer);

    let shared_result = scanner.scan_with_progress_sync(
        path_str,
        options,
        move |progress: ScanProgress| {
            // Snapshot fields the downstream arms may move, before any move.
            let current_file = progress.current_file.clone();
            if stream {
                let event = StreamEvent::Progress(Box::new(ProgressEvent {
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
                }));
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
            // Machine-readable progress log (optional, file-based).
            if let Ok(mut log) = progress_log_for_cb.lock() {
                if let Some(log) = log.as_mut() {
                    let event = serde_json::json!({
                        "type": "progress",
                        "files_scanned": progress.files_scanned,
                        "directories_scanned": progress.directories_scanned,
                        "total_size": progress.total_size,
                        "percentage": progress.percentage,
                        "current_file": current_file,
                    });
                    if let Ok(line) = serde_json::to_string(&event) {
                        let _ = writeln!(log, "{line}");
                    }
                }
            }
        },
        &cancel_flag,
        log_writer,
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

    // Final progress-log line so a watcher knows the run is done.
    if let Ok(mut log) = progress_log_writer.lock() {
        if let Some(log) = log.as_mut() {
            let event = serde_json::json!({
                "type": "complete",
                "files_scanned": shared_result.total_files,
                "total_size": shared_result.total_size,
                "duration_secs": duration,
                "error_count": shared_result.errors.len(),
            });
            if let Ok(line) = serde_json::to_string(&event) {
                let _ = writeln!(log, "{line}");
            }
        }
    }

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
    result.reclaim_tier_sizes = shared_result.reclaim_tier_sizes.clone();
    result.category_reclaimable = shared_result.category_reclaimable.clone();

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
    result.top_directories = top_dirs.iter().take(top_n).cloned().collect();

    // Drill-down: for the top `drill` directories, walk their immediate children
    // on the filesystem and attach child subdirectory sizes plus the largest files
    // directly inside each. Consumers can see what is consuming space without
    // re-scanning the whole tree.
    if drill > 0 {
        let mut drill_down = HashMap::new();
        for dir in result.top_directories.iter().take(drill) {
            let (children, largest) = drill_directory(&dir.path);
            if !children.is_empty() || !largest.is_empty() {
                drill_down.insert(dir.path.clone(), DirDrillDown { children, largest_files: largest });
            }
        }
        result.drill_down = drill_down;
    }

    // Display slice of the largest files is also bounded by `--top`.
    result.largest_files = shared_result
        .largest_files
        .iter()
        .take(top_n)
        .map(|file| LargestFileEntry {
            path: file.path.clone(),
            size: file.size,
        })
        .collect();

    result.empty_dirs = shared_result.empty_directories;
    // Improved reclaim estimate: sum the Safe + Caution tiers (actionable space),
    // which the scanner now computes directly instead of the old lossy heuristic
    // that only counted .tmp/.cache/.log extensions and installer archives.
    let safe = result.reclaim_tier_sizes.get("Safe").copied().unwrap_or(0);
    let caution = result.reclaim_tier_sizes.get("Caution").copied().unwrap_or(0);
    result.potential_cleanup_bytes = safe + caution;
    result.timestamp = chrono::Utc::now().to_rfc3339();

    if stream {
        let complete = StreamEvent::Complete(Box::new(CompleteEvent {
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
            reclaim_tier_sizes: result.reclaim_tier_sizes.clone(),
            category_reclaimable: result.category_reclaimable.clone(),
            potential_cleanup_bytes: result.potential_cleanup_bytes,
            timestamp: result.timestamp.clone(),
            drill_down: result.drill_down.clone(),
        }));
        let line = serde_json::to_string(&complete).unwrap_or_default();
        println!("{}", line);
        let _ = std::io::stdout().flush();
    }

    if save_history {
        if let Ok(db) = Database::default_open() {
            let max_scan_depth = max_depth.unwrap_or(5) as u32;
            // Persist a generous slice (matching the GUI's `--top 250`) so
            // history-based tooling — the agentic `ask` loop and its
            // `get_largest_files` tool — can analyze far more than the on-screen
            // `--top` (default 20) would otherwise store. The display `result`
            // stays bounded by `--top`; only the saved record gets the larger
            // cap, so machine-readable output is unaffected.
            let mut history_report = result.clone();
            if history_report.largest_files.len() < SAVE_HISTORY_TOP_N
                && !shared_result.largest_files.is_empty()
            {
                history_report.largest_files = shared_result
                    .largest_files
                    .iter()
                    .take(SAVE_HISTORY_TOP_N)
                    .map(|file| LargestFileEntry {
                        path: file.path.clone(),
                        size: file.size,
                    })
                    .collect();
            }
            if history_report.top_directories.len() < SAVE_HISTORY_TOP_N
                && !top_dirs.is_empty()
            {
                history_report.top_directories =
                    top_dirs.iter().take(SAVE_HISTORY_TOP_N).cloned().collect();
            }
            if let Ok(id) = db.save_scan(&history_report, deep, shallow, max_scan_depth) {
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

/// Walk the immediate children of `path` and return (child subdirectories sorted
/// largest-first, largest files directly in `path` sorted largest-first). Used by
/// `--drill` to show what is consuming space inside a large directory without a
/// full re-scan. Best-effort: permission errors are skipped silently.
fn drill_directory(path: &str) -> (Vec<DirEntry>, Vec<LargestFileEntry>) {
    let mut children: Vec<DirEntry> = Vec::new();
    let mut largest: Vec<LargestFileEntry> = Vec::new();
    let entries: Vec<_> = match std::fs::read_dir(path) {
        Ok(it) => it.flatten().collect(),
        Err(_) => return (children, largest),
    };
    if entries.is_empty() {
        return (children, largest);
    }
    for entry in entries {
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let child_path = entry.path();
        let path_str = child_path.to_string_lossy().to_string();
        let name = child_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if meta.is_file() {
            if meta.len() > 0 {
                largest.push(LargestFileEntry {
                    path: path_str,
                    size: meta.len(),
                });
            }
        } else if meta.is_dir() {
            let (size, file_count, dir_count) = dir_size(&child_path);
            children.push(DirEntry {
                path: path_str,
                name,
                total_size: size,
                file_count,
                dir_count,
            });
        }
    }
    children.sort_by_key(|b| std::cmp::Reverse(b.total_size));
    children.truncate(50);
    largest.sort_by_key(|b| std::cmp::Reverse(b.size));
    largest.truncate(50);
    (children, largest)
}

/// Recursive size walk of a directory. Returns (total_bytes, file_count, dir_count).
fn dir_size(path: &std::path::Path) -> (u64, u64, u64) {
    let mut total = 0u64;
    let mut files = 0u64;
    let mut dirs = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = match std::fs::read_dir(&current) {
            Ok(it) => it,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.is_file() {
                total += meta.len();
                files += 1;
            } else if meta.is_dir() {
                dirs += 1;
                stack.push(entry.path());
            }
        }
    }
    (total, files, dirs)
}
