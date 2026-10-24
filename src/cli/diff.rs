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

#[cfg(test)]
mod tests {
    use super::*;
    use space_analyzer_pro_desktop::gui_common::{DirEntry, LargestFileEntry};
    use std::collections::HashMap;

    // ── format_size_delta ───────────────────────────────────────────────────

    #[test]
    fn format_size_delta_positive() {
        let s = format_size_delta(1024);
        assert!(s.starts_with('+'), "positive delta must start with '+', got '{s}'");
        assert!(s.contains("KB"), "expected KB human bytes, got '{s}'");
    }

    #[test]
    fn format_size_delta_negative() {
        let s = format_size_delta(-1024);
        assert!(s.starts_with('-'), "negative delta must start with '-', got '{s}'");
        assert!(s.contains("KB"), "expected KB human bytes, got '{s}'");
    }

    #[test]
    fn format_size_delta_zero() {
        let s = format_size_delta(0);
        assert!(s.starts_with('+'), "zero delta must start with '+', got '{s}'");
    }

    // ── diff_hash_map ───────────────────────────────────────────────────────

    #[test]
    fn diff_hash_map_reports_only_changed_keys() {
        let mut before = HashMap::new();
        before.insert("doc".to_string(), 100);
        before.insert("img".to_string(), 200);

        let mut after = HashMap::new();
        after.insert("doc".to_string(), 100); // unchanged
        after.insert("img".to_string(), 500); // +300
        after.insert("vid".to_string(), 900); // new

        let deltas = diff_hash_map(&before, &after);
        let names: Vec<&str> = deltas.iter().map(|d| d.category.as_str()).collect();
        assert_eq!(names.len(), 2, "only changed keys should appear");
        assert!(names.contains(&"img"), "img changed from 200→500");
        assert!(names.contains(&"vid"), "vid is new (0→900)");
        assert!(!names.contains(&"doc"), "doc unchanged must not appear");

        let img = deltas.iter().find(|d| d.category == "img").unwrap();
        assert_eq!(img.before_bytes, 200);
        assert_eq!(img.after_bytes, 500);
        assert_eq!(img.delta_bytes, 300);
        assert!(img.delta_human.starts_with('+'));

        let vid = deltas.iter().find(|d| d.category == "vid").unwrap();
        assert_eq!(vid.before_bytes, 0);
        assert_eq!(vid.after_bytes, 900);
        assert_eq!(vid.delta_bytes, 900);
    }

    #[test]
    fn diff_hash_map_no_changes_returns_empty() {
        let mut before = HashMap::new();
        before.insert("doc".to_string(), 100);
        let mut after = HashMap::new();
        after.insert("doc".to_string(), 100);
        assert!(diff_hash_map(&before, &after).is_empty());
    }

    #[test]
    fn diff_hash_map_sorted_by_abs_delta_descending() {
        let mut before = HashMap::new();
        before.insert("small".to_string(), 10);
        before.insert("big".to_string(), 100);
        before.insert("mid".to_string(), 50);

        let mut after = HashMap::new();
        after.insert("small".to_string(), 11); // delta +1
        after.insert("big".to_string(), 10);   // delta -90
        after.insert("mid".to_string(), 40);   // delta -10

        let deltas = diff_hash_map(&before, &after);
        assert_eq!(deltas.len(), 3);
        // Order by abs delta desc: big(90) > mid(10) > small(1)
        assert_eq!(deltas[0].category, "big");
        assert_eq!(deltas[1].category, "mid");
        assert_eq!(deltas[2].category, "small");
    }

    // ── diff_dir_entries ────────────────────────────────────────────────────

    #[test]
    fn diff_dir_entries_reports_changed_dirs() {
        let before = vec![DirEntry {
            path: "C:/a".to_string(),
            name: "a".to_string(),
            total_size: 100,
            file_count: 2,
            dir_count: 0,
        }];
        let after = vec![DirEntry {
            path: "C:/a".to_string(),
            name: "a".to_string(),
            total_size: 500,
            file_count: 5,
            dir_count: 0,
        }];

        let deltas = diff_dir_entries(&before, &after);
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].path, "C:/a");
        assert_eq!(deltas[0].before_bytes, 100);
        assert_eq!(deltas[0].after_bytes, 500);
        assert_eq!(deltas[0].delta_bytes, 400);
    }

    #[test]
    fn diff_dir_entries_new_and_removed_dirs() {
        let before = vec![DirEntry {
            path: "C:/old".to_string(),
            name: "old".to_string(),
            total_size: 100,
            file_count: 1,
            dir_count: 0,
        }];
        let after = vec![DirEntry {
            path: "C:/new".to_string(),
            name: "new".to_string(),
            total_size: 100,
            file_count: 1,
            dir_count: 0,
        }];

        let deltas = diff_dir_entries(&before, &after);
        // old removed (100→0), new added (0→100)
        assert_eq!(deltas.len(), 2);
        let paths: Vec<&str> = deltas.iter().map(|d| d.path.as_str()).collect();
        assert!(paths.contains(&"C:/old"));
        assert!(paths.contains(&"C:/new"));
    }

    #[test]
    fn diff_dir_entries_unchanged_returns_empty() {
        let before = vec![DirEntry {
            path: "C:/a".to_string(),
            name: "a".to_string(),
            total_size: 100,
            file_count: 1,
            dir_count: 0,
        }];
        let after = before.clone();
        assert!(diff_dir_entries(&before, &after).is_empty());
    }

    // ── diff_largest_files ──────────────────────────────────────────────────

    #[test]
    fn diff_largest_files_reports_changed_files() {
        let before = vec![LargestFileEntry {
            path: "C:/big.bin".to_string(),
            size: 1000,
            size_human: "1000 B".to_string(),
        }];
        let after = vec![LargestFileEntry {
            path: "C:/big.bin".to_string(),
            size: 2000,
            size_human: "2000 B".to_string(),
        }];

        let deltas = diff_largest_files(&before, &after);
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].path, "C:/big.bin");
        assert_eq!(deltas[0].before_bytes, 1000);
        assert_eq!(deltas[0].after_bytes, 2000);
        assert_eq!(deltas[0].delta_bytes, 1000);
    }

    #[test]
    fn diff_largest_files_unchanged_returns_empty() {
        let before = vec![LargestFileEntry {
            path: "C:/big.bin".to_string(),
            size: 1000,
            size_human: "1000 B".to_string(),
        }];
        let after = before.clone();
        assert!(diff_largest_files(&before, &after).is_empty());
    }
}
