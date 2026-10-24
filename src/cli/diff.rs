//! Scan diff — compare two scan-history records side by side.
//!
//! `space-analyzer-cli diff --id1 10 --id2 20` loads both saved scans from the
//! embedded database and reports what grew or shrank in total size, file count,
//! per-category sizes, per-extension sizes, top directories, and largest files.
//! Useful for verifying the effect of a cleanup run (before/after).

use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::{AppError, AppResult};
use space_analyzer_pro_desktop::gui_common::{DirEntry, LargestFileEntry, ScanReport};

use crate::cli::args::{DiffArgs, OutputFormat};
use scan_engine::format_bytes;

/// Result of diffing two scans.
#[derive(Debug, serde::Serialize)]
struct DiffResult {
    scan_id_before: i64,
    scan_id_after: i64,
    path_before: String,
    path_after: String,
    timestamp_before: String,
    timestamp_after: String,
    total_size_before: u64,
    total_size_after: u64,
    total_size_delta_bytes: i64,
    total_size_delta_human: String,
    total_files_before: usize,
    total_files_after: usize,
    total_files_delta: i64,
    category_deltas: Vec<CategoryDelta>,
    directory_deltas: Vec<DirectoryDelta>,
    file_deltas: Vec<FileDelta>,
}

/// A single changed category between two scans.
#[derive(Debug, serde::Serialize, Clone)]
struct CategoryDelta {
    category: String,
    before_bytes: u64,
    after_bytes: u64,
    delta_bytes: i64,
    delta_human: String,
}

/// A single changed directory between two scans.
#[derive(Debug, serde::Serialize, Clone)]
struct DirectoryDelta {
    path: String,
    name: String,
    before_bytes: u64,
    after_bytes: u64,
    delta_bytes: i64,
    delta_human: String,
}

/// A single changed file between two scans.
#[derive(Debug, serde::Serialize, Clone)]
struct FileDelta {
    path: String,
    name: String,
    before_bytes: u64,
    after_bytes: u64,
    delta_bytes: i64,
    delta_human: String,
}

pub fn run(args: DiffArgs, output_format: OutputFormat) -> AppResult<()> {
    let db = Database::default_open()
        .map_err(|e| AppError::Validation(format!("Database open failed: {e}")))?;

    let before = db
        .get_scan_by_id(args.id1)
        .map_err(|e| AppError::Validation(format!("Failed to load scan {}: {e}", args.id1)))?
        .ok_or_else(|| AppError::Validation(format!("No scan found with id {}", args.id1)))?;
    let after = db
        .get_scan_by_id(args.id2)
        .map_err(|e| AppError::Validation(format!("Failed to load scan {}: {e}", args.id2)))?
        .ok_or_else(|| AppError::Validation(format!("No scan found with id {}", args.id2)))?;

    let before_report = ScanReport::from_history_record(&before);
    let after_report = ScanReport::from_history_record(&after);

    let size_delta = after_report.total_size_bytes as i64 - before_report.total_size_bytes as i64;
    let files_delta = after_report.total_files as i64 - before_report.total_files as i64;

    let category_deltas = diff_hash_map(&before_report.category_sizes, &after_report.category_sizes);
    let directory_deltas = diff_dir_entries(&before_report.top_directories, &after_report.top_directories);
    let file_deltas = diff_largest_files(&before_report.largest_files, &after_report.largest_files);

    if output_format.is_machine_readable() {
        let result = DiffResult {
            scan_id_before: args.id1,
            scan_id_after: args.id2,
            path_before: before_report.path.clone(),
            path_after: after_report.path.clone(),
            timestamp_before: before.timestamp.clone(),
            timestamp_after: after.timestamp.clone(),
            total_size_before: before_report.total_size_bytes,
            total_size_after: after_report.total_size_bytes,
            total_size_delta_bytes: size_delta,
            total_size_delta_human: format_size_delta(size_delta),
            total_files_before: before_report.total_files,
            total_files_after: after_report.total_files,
            total_files_delta: files_delta,
            category_deltas,
            directory_deltas,
            file_deltas,
        };
        println!("{}", serde_json::to_string_pretty(&result).unwrap_or_default());
    } else {
        println!(
            "Scan diff: #{} ({}) → #{} ({})",
            args.id1, before_report.path, args.id2, after_report.path
        );
        println!("  Before: {}", before.timestamp);
        println!("  After:  {}", after.timestamp);
        println!();
        println!(
            "  Total size: {} → {} ({})",
            format_bytes(before_report.total_size_bytes),
            format_bytes(after_report.total_size_bytes),
            format_size_delta(size_delta)
        );
        println!(
            "  Total files: {} → {} ({})",
            before_report.total_files,
            after_report.total_files,
            if files_delta >= 0 {
                format!("+{}", files_delta)
            } else {
                format!("{}", files_delta)
            }
        );
        println!();

        if !category_deltas.is_empty() {
            println!("📂 Category changes:");
            for d in &category_deltas {
                println!(
                    "  {:<20} {} → {} ({})",
                    d.category,
                    format_bytes(d.before_bytes),
                    format_bytes(d.after_bytes),
                    d.delta_human
                );
            }
            println!();
        }

        if !directory_deltas.is_empty() {
            println!("📁 Top directory changes:");
            for d in &directory_deltas {
                println!(
                    "  {:<14} {} → {} ({})  {}",
                    format_size_delta(d.delta_bytes),
                    format_bytes(d.before_bytes),
                    format_bytes(d.after_bytes),
                    if d.delta_bytes >= 0 { "+" } else { "" },
                    d.path
                );
            }
            println!();
        }

        if !file_deltas.is_empty() {
            println!("🏆 Largest file changes:");
            for f in &file_deltas {
                println!(
                    "  {:<14} {} → {} ({})  {}",
                    format_size_delta(f.delta_bytes),
                    format_bytes(f.before_bytes),
                    format_bytes(f.after_bytes),
                    if f.delta_bytes >= 0 { "+" } else { "" },
                    f.path
                );
            }
        }

        if category_deltas.is_empty() && directory_deltas.is_empty() && file_deltas.is_empty() {
            println!("  No measurable changes between the two scans.");
        }
    }

    Ok(())
}

/// Diff two `HashMap<String, u64>` maps (e.g. category_sizes, extension_sizes).
/// Returns only entries whose value changed, sorted by absolute delta descending.
fn diff_hash_map(
    before: &std::collections::HashMap<String, u64>,
    after: &std::collections::HashMap<String, u64>,
) -> Vec<CategoryDelta> {
    let mut all_keys: std::collections::HashSet<String> =
        before.keys().cloned().collect();
    all_keys.extend(after.keys().cloned());

    let mut deltas: Vec<CategoryDelta> = all_keys
        .into_iter()
        .filter_map(|key| {
            let b = before.get(&key).copied().unwrap_or(0);
            let a = after.get(&key).copied().unwrap_or(0);
            if b == a {
                return None;
            }
            let delta = a as i64 - b as i64;
            Some(CategoryDelta {
                category: key,
                before_bytes: b,
                after_bytes: a,
                delta_bytes: delta,
                delta_human: format_size_delta(delta),
            })
        })
        .collect();
    deltas.sort_by_key(|d| std::cmp::Reverse(d.delta_bytes.abs()));
    deltas
}

/// Diff two `Vec<DirEntry>` lists by path. Returns only changed entries.
fn diff_dir_entries(before: &[DirEntry], after: &[DirEntry]) -> Vec<DirectoryDelta> {
    let before_map: std::collections::HashMap<&str, &DirEntry> =
        before.iter().map(|d| (d.path.as_str(), d)).collect();
    let after_map: std::collections::HashMap<&str, &DirEntry> =
        after.iter().map(|d| (d.path.as_str(), d)).collect();

    let mut all_paths: std::collections::HashSet<&str> = before_map.keys().copied().collect();
    all_paths.extend(after_map.keys().copied());

    let mut deltas: Vec<DirectoryDelta> = all_paths
        .into_iter()
        .filter_map(|path| {
            let default_b = DirEntry {
                path: path.to_string(),
                name: String::new(),
                total_size: 0,
                file_count: 0,
                dir_count: 0,
            };
            let b = before_map.get(path).copied().unwrap_or(&default_b);
            let default_a = DirEntry {
                path: path.to_string(),
                name: String::new(),
                total_size: 0,
                file_count: 0,
                dir_count: 0,
            };
            let a = after_map.get(path).copied().unwrap_or(&default_a);
            if b.total_size == a.total_size {
                return None;
            }
            let delta = a.total_size as i64 - b.total_size as i64;
            Some(DirectoryDelta {
                path: path.to_string(),
                name: a.name.clone(),
                before_bytes: b.total_size,
                after_bytes: a.total_size,
                delta_bytes: delta,
                delta_human: format_size_delta(delta),
            })
        })
        .collect();
    deltas.sort_by_key(|d| std::cmp::Reverse(d.delta_bytes.abs()));
    deltas.truncate(20);
    deltas
}

/// Diff two `Vec<LargestFileEntry>` lists by path. Returns only changed entries.
fn diff_largest_files(before: &[LargestFileEntry], after: &[LargestFileEntry]) -> Vec<FileDelta> {
    let before_map: std::collections::HashMap<&str, &LargestFileEntry> = before
        .iter()
        .map(|f| (f.path.as_str(), f))
        .collect();
    let after_map: std::collections::HashMap<&str, &LargestFileEntry> = after
        .iter()
        .map(|f| (f.path.as_str(), f))
        .collect();

    let mut all_paths: std::collections::HashSet<&str> = before_map.keys().copied().collect();
    all_paths.extend(after_map.keys().copied());

    let mut deltas: Vec<FileDelta> = all_paths
        .into_iter()
        .filter_map(|path| {
            let default_b = LargestFileEntry {
                path: path.to_string(),
                size: 0,
                size_human: String::new(),
            };
            let b = before_map.get(path).copied().unwrap_or(&default_b);
            let default_a = LargestFileEntry {
                path: path.to_string(),
                size: 0,
                size_human: String::new(),
            };
            let a = after_map.get(path).copied().unwrap_or(&default_a);
            if b.size == a.size {
                return None;
            }
            let delta = a.size as i64 - b.size as i64;
            Some(FileDelta {
                path: path.to_string(),
                name: a.path.clone(),
                before_bytes: b.size,
                after_bytes: a.size,
                delta_bytes: delta,
                delta_human: format_size_delta(delta),
            })
        })
        .collect();
    deltas.sort_by_key(|d| std::cmp::Reverse(d.delta_bytes.abs()));
    deltas.truncate(20);
    deltas
}

/// Format a signed byte delta as a human string like `+2.50 GB` or `-1.10 MB`.
fn format_size_delta(delta: i64) -> String {
    let abs = delta.abs();
    let human = format_bytes(abs as u64);
    if delta >= 0 {
        format!("+{}", human)
    } else {
        format!("-{}", human)
    }
}
