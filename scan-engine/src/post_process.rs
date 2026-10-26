//! CPU post-processing for scanned file entries.
//!
//! Replaces the former GPU-accelerated post-processing. Directory traversal
//! is I/O-bound and stays on CPU; this module accelerates the compute-heavy
//! aggregation (extension counts, size histograms, top-N largest files,
//! per-directory aggregates) using rayon parallelism.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Raw file entry collected during the I/O walk phase.
#[derive(Debug, Clone)]
pub struct RawFileEntry {
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
}

/// Result of post-processing raw file entries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostProcessResult {
    pub total_files: u64,
    pub total_size: u64,
    pub file_types: HashMap<String, u64>,
    pub extension_sizes: HashMap<String, u64>,
    pub size_distribution: HashMap<String, u64>,
    pub largest_files: Vec<FileInfo>,
    pub empty_dirs: Vec<String>,
    pub subdirectories: Vec<DirInfo>,
    pub processing_time_ms: u64,
    pub device: String,
}

/// Per-file info for largest-files reporting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub extension: String,
}

/// Per-directory aggregate information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirInfo {
    pub path: String,
    pub name: String,
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub largest_file_size: u64,
}

/// Post-process raw file entries into aggregated scan results.
///
/// This is CPU-only (rayon parallelism). The former GPU path never actually
/// used the GPU — it always fell back to CPU — so this is a drop-in
/// replacement with no functional change.
pub fn post_process_entries(
    entries: &[RawFileEntry],
    top_n: usize,
    scan_root: Option<&Path>,
) -> PostProcessResult {
    let start = std::time::Instant::now();

    // Parallel: extract extension and size bucket for each non-dir entry.
    let processed: Vec<_> = entries
        .par_iter()
        .filter_map(|entry| {
            if entry.is_dir {
                return None;
            }

            let ext = extract_extension(&entry.path);
            let bucket = size_bucket(entry.size);

            Some((entry.path.clone(), entry.size, ext, bucket))
        })
        .collect();

    // Aggregate results.
    let mut total_files = 0u64;
    let mut total_size = 0u64;
    let mut file_types: HashMap<String, u64> = HashMap::new();
    let mut extension_sizes: HashMap<String, u64> = HashMap::new();
    let mut size_distribution: HashMap<String, u64> = HashMap::new();

    for (_path, size, ext, bucket) in &processed {
        total_files += 1;
        total_size += size;
        *file_types.entry(ext.clone()).or_insert(0) += 1;
        *extension_sizes.entry(ext.clone()).or_insert(0) += size;
        *size_distribution.entry(bucket.clone()).or_insert(0) += 1;
    }

    // Find top-N largest files (partial sort — O(n) average).
    let mut largest: Vec<_> = processed
        .iter()
        .map(|(path, size, ext, _)| FileInfo {
            path: strip_verbatim(path.clone()),
            name: extract_filename(path),
            size: *size,
            extension: ext.clone(),
        })
        .collect();

    if largest.len() > top_n {
        largest.select_nth_unstable_by(top_n, |a, b| b.size.cmp(&a.size));
        largest.truncate(top_n);
    }
    largest.sort_by_key(|b| std::cmp::Reverse(b.size));

    // Detect empty directories from filtered entries.
    let dir_counts = count_dir_entries(entries);
    let mut empty_dirs: Vec<_> = dir_counts
        .iter()
        .filter(|(_, count)| **count == 0)
        .map(|(path, _)| path.clone())
        .collect();
    empty_dirs.sort();

    // Compute per-directory aggregates for immediate subdirectories of scan_root.
    let subdirectories = compute_subdirectories(entries, scan_root);

    PostProcessResult {
        total_files,
        total_size,
        file_types,
        extension_sizes,
        size_distribution,
        largest_files: largest,
        empty_dirs,
        subdirectories,
        processing_time_ms: start.elapsed().as_millis() as u64,
        device: "CPU (rayon)".to_string(),
    }
}

/// Extract the file extension (lowercased) from a path.
fn extract_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
}

/// Extract the filename basename from a path.
pub fn extract_filename(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string()
}

/// Bucket a file size into a human-readable range string.
fn size_bucket(size: u64) -> String {
    if size == 0 {
        "0 B".to_string()
    } else if size < 1024 {
        "< 1 KB".to_string()
    } else if size < 10 * 1024 {
        "1-10 KB".to_string()
    } else if size < 100 * 1024 {
        "10-100 KB".to_string()
    } else if size < 1024 * 1024 {
        "100 KB-1 MB".to_string()
    } else if size < 10 * 1024 * 1024 {
        "1-10 MB".to_string()
    } else if size < 100 * 1024 * 1024 {
        "10-100 MB".to_string()
    } else if size < 1024 * 1024 * 1024 {
        "100 MB-1 GB".to_string()
    } else {
        "> 1 GB".to_string()
    }
}

/// Strip the Windows extended-length verbatim prefix (`\\?\`).
pub fn strip_verbatim(path: impl AsRef<std::path::Path>) -> String {
    let text = path.as_ref().to_string_lossy().to_string();
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}

/// Count entries per parent directory.
fn count_dir_entries(entries: &[RawFileEntry]) -> HashMap<String, u64> {
    let mut counts: HashMap<String, u64> = HashMap::new();

    // Initialize all directories with 0
    for entry in entries {
        if entry.is_dir {
            counts.entry(entry.path.clone()).or_insert(0);
        }
    }

    // Count entries per parent directory
    for entry in entries {
        if let Some(parent) = Path::new(&entry.path).parent() {
            let parent_str = parent.to_string_lossy().to_string();
            *counts.entry(parent_str).or_insert(0) += 1;
        }
    }

    counts
}

/// Compute per-directory aggregate information for immediate subdirectories of
/// `scan_root`.
fn compute_subdirectories(entries: &[RawFileEntry], scan_root: Option<&Path>) -> Vec<DirInfo> {
    let mut dir_sizes: HashMap<String, u64> = HashMap::new();
    let mut dir_file_counts: HashMap<String, u64> = HashMap::new();
    let mut dir_dir_counts: HashMap<String, u64> = HashMap::new();
    let mut dir_largest: HashMap<String, u64> = HashMap::new();

    for entry in entries {
        let path = Path::new(&entry.path);
        let sub_name: String = match scan_root {
            Some(root) => match path.strip_prefix(root) {
                Ok(rel) => {
                    let rel_comps: Vec<_> = rel.components().collect();
                    if rel_comps.len() <= 1 {
                        if rel_comps.is_empty() || !entry.is_dir {
                            root.to_string_lossy().to_string()
                        } else {
                            match rel_comps.first() {
                                Some(first) => {
                                    root.join(first.as_os_str()).to_string_lossy().to_string()
                                }
                                None => root.to_string_lossy().to_string(),
                            }
                        }
                    } else {
                        match rel_comps.first() {
                            Some(first) => {
                                root.join(first.as_os_str()).to_string_lossy().to_string()
                            }
                            None => root.to_string_lossy().to_string(),
                        }
                    }
                }
                Err(_) => root.to_string_lossy().to_string(),
            },
            None => {
                let comps: Vec<_> = path.components().collect();
                if comps.len() >= 3 {
                    comps[2].as_os_str().to_string_lossy().to_string()
                } else {
                    path.to_string_lossy().to_string()
                }
            }
        };

        if entry.is_dir {
            if entry.path != sub_name {
                *dir_dir_counts.entry(sub_name.clone()).or_insert(0) += 1;
            }
            *dir_sizes.entry(sub_name.clone()).or_insert(0) += entry.size;
        } else {
            *dir_sizes.entry(sub_name.clone()).or_insert(0) += entry.size;
            *dir_file_counts.entry(sub_name.clone()).or_insert(0) += 1;
            let current_largest = dir_largest.entry(sub_name.clone()).or_insert(0);
            if entry.size > *current_largest {
                *current_largest = entry.size;
            }
        }
    }

    let mut all_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_names.extend(dir_sizes.keys().cloned());
    all_names.extend(dir_dir_counts.keys().cloned());

    let mut result: Vec<DirInfo> = all_names
        .into_iter()
        .map(|name| {
            let clean_path = strip_verbatim(name.clone());
            let basename = Path::new(&clean_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| clean_path.clone());
            DirInfo {
                path: clean_path,
                name: basename,
                total_size: dir_sizes.get(&name).copied().unwrap_or(0),
                file_count: dir_file_counts.get(&name).copied().unwrap_or(0),
                dir_count: dir_dir_counts.get(&name).copied().unwrap_or(0),
                largest_file_size: dir_largest.get(&name).copied().unwrap_or(0),
            }
        })
        .collect();

    result.sort_by_key(|b| std::cmp::Reverse(b.total_size));
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_extension_returns_lowercase() {
        assert_eq!(extract_extension("file.TXT"), "txt");
        assert_eq!(extract_extension("file.tar.gz"), "gz");
        assert_eq!(extract_extension("file"), "");
        assert_eq!(extract_extension(""), "");
    }

    #[test]
    fn extract_filename_returns_basename() {
        assert_eq!(extract_filename("C:/dir/file.txt"), "file.txt");
        assert_eq!(extract_filename("file.txt"), "file.txt");
    }

    #[test]
    fn size_bucket_correct_ranges() {
        assert_eq!(size_bucket(0), "0 B");
        assert_eq!(size_bucket(1), "< 1 KB");
        assert_eq!(size_bucket(1023), "< 1 KB");
        assert_eq!(size_bucket(1024), "1-10 KB");
        assert_eq!(size_bucket(10 * 1024), "10-100 KB");
        assert_eq!(size_bucket(100 * 1024), "100 KB-1 MB");
        assert_eq!(size_bucket(1024 * 1024), "1-10 MB");
        assert_eq!(size_bucket(10 * 1024 * 1024), "10-100 MB");
        assert_eq!(size_bucket(100 * 1024 * 1024), "100 MB-1 GB");
        assert_eq!(size_bucket(1024 * 1024 * 1024), "> 1 GB");
    }

    #[test]
    fn post_process_aggregates_file_types() {
        let entries = vec![
            RawFileEntry {
                path: "a.txt".to_string(),
                size: 100,
                is_dir: false,
            },
            RawFileEntry {
                path: "b.txt".to_string(),
                size: 200,
                is_dir: false,
            },
            RawFileEntry {
                path: "c.pdf".to_string(),
                size: 500,
                is_dir: false,
            },
        ];
        let result = post_process_entries(&entries, 10, None);
        assert_eq!(result.file_types.get("txt"), Some(&2));
        assert_eq!(result.file_types.get("pdf"), Some(&1));
        assert_eq!(result.total_size, 800);
    }

    #[test]
    fn post_process_sorts_largest_files() {
        let entries = vec![
            RawFileEntry {
                path: "small.txt".to_string(),
                size: 100,
                is_dir: false,
            },
            RawFileEntry {
                path: "large.txt".to_string(),
                size: 10000,
                is_dir: false,
            },
            RawFileEntry {
                path: "medium.txt".to_string(),
                size: 1000,
                is_dir: false,
            },
        ];
        let result = post_process_entries(&entries, 10, None);
        assert_eq!(result.largest_files[0].path, "large.txt");
        assert_eq!(result.largest_files[1].path, "medium.txt");
        assert_eq!(result.largest_files[2].path, "small.txt");
    }

    #[test]
    fn post_process_bounds_top_n() {
        let entries: Vec<_> = (0..10)
            .map(|i| RawFileEntry {
                path: format!("file_{}.txt", i),
                size: i as u64 * 100,
                is_dir: false,
            })
            .collect();
        let result = post_process_entries(&entries, 3, None);
        assert_eq!(result.largest_files.len(), 3);
        assert_eq!(result.largest_files[0].size, 900);
        assert_eq!(result.largest_files[1].size, 800);
        assert_eq!(result.largest_files[2].size, 700);
    }
}
