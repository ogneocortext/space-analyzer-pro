//! GPU-accelerated scan post-processing
//!
//! Directory traversal is I/O-bound and stays on CPU.
//! After collecting raw file entries (path + size), this module
//! accelerates the compute-heavy post-processing on GPU:
//! - Extension extraction and file type categorization
//! - Size distribution histograms
//! - Top-N largest file selection
//! - Pattern filtering

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Raw file entry collected during I/O phase
#[derive(Debug, Clone)]
pub struct RawFileEntry {
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
}

/// GPU-accelerated scan result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuScanResult {
    pub total_files: u64,
    pub total_size: u64,
    pub file_types: HashMap<String, u64>,
    pub extension_sizes: HashMap<String, u64>,
    pub size_distribution: HashMap<String, u64>,
    pub largest_files: Vec<GpuFileInfo>,
    pub empty_dirs: Vec<String>,
    pub subdirectories: Vec<DirInfo>,
    pub processing_time_ms: u64,
    pub device: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuFileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub extension: String,
}

/// Per-directory aggregate information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirInfo {
    pub path: String,
    pub name: String,
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub largest_file_size: u64,
}

/// GPU-accelerated post-processor for scan results
pub struct GpuScanProcessor {
    use_gpu: bool,
    top_n: usize,
    scan_root: Option<String>,
}

impl GpuScanProcessor {
    pub fn new() -> Self {
        Self {
            use_gpu: false,
            top_n: 100,
            scan_root: None,
        }
    }

    pub fn with_gpu(mut self, use_gpu: bool) -> Self {
        self.use_gpu = use_gpu;
        self
    }

    pub fn with_top_n(mut self, n: usize) -> Self {
        self.top_n = n;
        self
    }

    pub fn with_scan_root(mut self, root: impl Into<String>) -> Self {
        self.scan_root = Some(root.into());
        self
    }

    /// Process raw file entries.
    /// GPU acceleration is not yet implemented; this always uses CPU with rayon parallelism.
    /// The use_gpu field is preserved for forward compatibility.
    pub fn process(&self, entries: &[RawFileEntry]) -> GpuScanResult {
        let start = std::time::Instant::now();
        let mut result = self.process_cpu(entries);
        result.processing_time_ms = start.elapsed().as_millis() as u64;
        result
    }

    /// CPU-optimized parallel processing using rayon
    fn process_cpu(&self, entries: &[RawFileEntry]) -> GpuScanResult {
        let mut total_files = 0u64;
        let mut total_size = 0u64;
        let mut file_types: HashMap<String, u64> = HashMap::new();
        let mut extension_sizes: HashMap<String, u64> = HashMap::new();
        let mut size_distribution: HashMap<String, u64> = HashMap::new();
        let mut empty_dirs = Vec::new();

        // Parallel extension extraction and categorization
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

        // Aggregate results
        for (_path, size, ext, bucket) in &processed {
            total_files += 1;
            total_size += size;
            *file_types.entry(ext.clone()).or_insert(0) += 1;
            *extension_sizes.entry(ext.clone()).or_insert(0) += size;
            *size_distribution.entry(bucket.clone()).or_insert(0) += 1;
        }

        // Find top-N largest files (partial sort)
        let mut largest: Vec<_> = processed
            .iter()
            .map(|(path, size, ext, _)| GpuFileInfo {
                path: path.clone(),
                name: extract_filename(path),
                size: *size,
                extension: ext.clone(),
            })
            .collect();

        // Use introselect for top-N (O(n) average vs O(n log n) full sort)
        if largest.len() > self.top_n {
            largest.select_nth_unstable_by(self.top_n, |a, b| b.size.cmp(&a.size));
            largest.truncate(self.top_n);
        }
        largest.sort_by_key(|b| std::cmp::Reverse(b.size));

        // Detect empty directories
        let dir_counts = count_dir_entries(entries);
        for (dir_path, count) in &dir_counts {
            if *count == 0 {
                empty_dirs.push(dir_path.clone());
            }
        }

        // Compute per-directory aggregates
        let subdirectories =
            compute_subdirectories(entries, self.scan_root.as_deref().map(Path::new));

        GpuScanResult {
            total_files,
            total_size,
            file_types,
            extension_sizes,
            size_distribution,
            largest_files: largest,
            empty_dirs,
            subdirectories,
            processing_time_ms: 0, // Set by caller
            device: "CPU (rayon)".to_string(),
        }
    }

}

impl Default for GpuScanProcessor {
    fn default() -> Self {
        Self::new()
    }
}

// Helper functions

fn extract_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
}

fn extract_filename(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string()
}

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

/// Count entries per parent directory from the filtered entry list.
///
/// Note: this operates on the filtered `entries` slice, so directories
/// that contain only excluded files (e.g. hidden files with
/// `include_hidden: false`) will appear to have zero children.
/// True empty-directory detection should be computed from the raw
/// walk results before filtering.
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
///
/// Each entry is attributed to the subdirectory of `scan_root` that contains it,
/// so a file sitting directly in `scan_root` lands in the root group instead of
/// being reported as its own "directory". `dir_count` counts only sub-directories
/// *inside* each group (not the group directory itself), and `name` is the
/// directory's basename rather than its full path.
fn compute_subdirectories(entries: &[RawFileEntry], scan_root: Option<&Path>) -> Vec<DirInfo> {
    let mut dir_sizes: HashMap<String, u64> = HashMap::new();
    let mut dir_file_counts: HashMap<String, u64> = HashMap::new();
    let mut dir_dir_counts: HashMap<String, u64> = HashMap::new();
    let mut dir_largest: HashMap<String, u64> = HashMap::new();

    for entry in entries {
        let path = Path::new(&entry.path);
        let sub_name: String = match scan_root {
            Some(root) => match path.strip_prefix(root) {
                Ok(rel) => match rel.components().next() {
                    Some(first) => root
                        .join(first.as_os_str())
                        .to_string_lossy()
                        .to_string(),
                    None => root.to_string_lossy().to_string(),
                },
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
            // Skip the group directory itself so it is not counted in its own
            // dir_count.
            if entry.path != sub_name {
                *dir_dir_counts.entry(sub_name.clone()).or_insert(0) += 1;
            }
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
            let basename = Path::new(&name)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| name.clone());
            DirInfo {
                path: name.clone(),
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

/// Benchmark scan post-processing performance
pub fn benchmark_scan_processing(
    entries: &[RawFileEntry],
    iterations: usize,
) -> ScanBenchmarkResult {
    use std::time::Instant;

    let processor = GpuScanProcessor::new();
    let mut cpu_times = Vec::new();
    let mut gpu_times = Vec::new();

    // CPU benchmark
    for _ in 0..iterations {
        let start = Instant::now();
        processor.process_cpu(entries);
        cpu_times.push(start.elapsed().as_micros() as u64);
    }

    // GPU benchmark (if available)
    if super::device::GpuInfo::is_available() {
        let gpu_processor = GpuScanProcessor::new().with_gpu(true);
        for _ in 0..iterations {
            let start = Instant::now();
            gpu_processor.process(entries);
            gpu_times.push(start.elapsed().as_micros() as u64);
        }
    }

    let cpu_avg = cpu_times.iter().sum::<u64>() / cpu_times.len() as u64;
    let gpu_avg = if gpu_times.is_empty() {
        0
    } else {
        gpu_times.iter().sum::<u64>() / gpu_times.len() as u64
    };

    ScanBenchmarkResult {
        entry_count: entries.len(),
        iterations,
        cpu_avg_us: cpu_avg,
        gpu_avg_us: gpu_avg,
        speedup: if gpu_avg > 0 {
            cpu_avg as f64 / gpu_avg as f64
        } else {
            1.0
        },
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanBenchmarkResult {
    pub entry_count: usize,
    pub iterations: usize,
    pub cpu_avg_us: u64,
    pub gpu_avg_us: u64,
    pub speedup: f64,
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
        // Trailing slash behavior varies by platform; just verify it doesn't panic
        let _ = extract_filename("C:/dir/");
        let _ = extract_filename("");
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
    fn gpu_processor_uses_cpu_when_gpu_unavailable() {
        let processor = GpuScanProcessor::new().with_gpu(true);
        let entries = vec![
            RawFileEntry {
                path: "test.txt".to_string(),
                size: 1024,
                is_dir: false,
            },
        ];
        let result = processor.process(&entries);
        assert_eq!(result.device, "CPU (rayon)");
        assert_eq!(result.total_files, 1);
    }

    #[test]
    fn gpu_processor_aggregates_file_types() {
        let processor = GpuScanProcessor::new();
        let entries = vec![
            RawFileEntry { path: "a.txt".to_string(), size: 100, is_dir: false },
            RawFileEntry { path: "b.txt".to_string(), size: 200, is_dir: false },
            RawFileEntry { path: "c.pdf".to_string(), size: 500, is_dir: false },
        ];
        let result = processor.process(&entries);
        assert_eq!(result.file_types.get("txt"), Some(&2));
        assert_eq!(result.file_types.get("pdf"), Some(&1));
        assert_eq!(result.total_size, 800);
    }

    #[test]
    fn gpu_processor_sorts_largest_files() {
        let processor = GpuScanProcessor::new();
        let entries = vec![
            RawFileEntry { path: "small.txt".to_string(), size: 100, is_dir: false },
            RawFileEntry { path: "large.txt".to_string(), size: 10000, is_dir: false },
            RawFileEntry { path: "medium.txt".to_string(), size: 1000, is_dir: false },
        ];
        let result = processor.process(&entries);
        assert_eq!(result.largest_files[0].path, "large.txt");
        assert_eq!(result.largest_files[1].path, "medium.txt");
        assert_eq!(result.largest_files[2].path, "small.txt");
    }
}
