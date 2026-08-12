//! File Deduplicator Library
//!
//! High-performance file deduplication with BLAKE3 hashing and hard link support.
//! Provides both library and binary interfaces for flexible integration.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use gpu_compute::hash::BatchHasher;
use same_file::is_same_file;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use walkdir::WalkDir;

#[cfg(unix)]
use std::os::unix::fs::MetadataExt;

/// File information with hash
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: PathBuf,
    pub size: u64,
    pub modified: DateTime<Utc>,
    pub hash: String,
    pub is_hard_link: bool,
    #[serde(default)]
    pub dev: u64,
    #[serde(default)]
    pub ino: u64,
}

/// Deduplication result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeduplicationResult {
    pub total_files_scanned: usize,
    pub duplicate_groups: Vec<DuplicateGroup>,
    pub space_saved: u64,
    pub files_processed: usize,
    pub errors: Vec<String>,
}

/// Group of duplicate files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub files: Vec<FileInfo>,
    pub can_deduplicate: bool,
}

/// Deduplication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeduplicationConfig {
    pub min_file_size: u64,
    pub max_file_size: Option<u64>,
    pub follow_symlinks: bool,
    pub exclude_patterns: Vec<String>,
    pub include_patterns: Vec<String>,
    pub dry_run: bool,
    pub create_hard_links: bool,
    pub parallel_jobs: Option<usize>,
    /// Allow GPU-accelerated batch hashing when a compatible device is present.
    /// When false the hasher stays on the CPU even if a GPU is detected, so the
    /// "GPU acceleration" user setting can actually turn the GPU off.
    pub use_gpu: bool,
}

impl Default for DeduplicationConfig {
    fn default() -> Self {
        Self {
            min_file_size: 1024, // 1KB minimum
            max_file_size: None,
            follow_symlinks: false,
            exclude_patterns: vec![
                "*.tmp".to_string(),
                "*.log".to_string(),
                "*.cache".to_string(),
                "node_modules".to_string(),
                ".git".to_string(),
            ],
            include_patterns: vec![],
            dry_run: true,
            create_hard_links: true,
            parallel_jobs: Some(num_cpus::get()),
            use_gpu: true,
        }
    }
}

type ProgressCallback = Box<dyn Fn(usize) + Send + Sync>;

/// Main deduplicator structure
pub struct FileDeduplicator {
    config: DeduplicationConfig,
    progress: Arc<Mutex<Option<ProgressCallback>>>,
    batch_hasher: BatchHasher,
}

impl FileDeduplicator {
    /// Create a new deduplicator with default configuration
    pub fn new() -> Self {
        Self::with_config(DeduplicationConfig::default())
    }

    /// Create a new deduplicator with custom configuration
    pub fn with_config(config: DeduplicationConfig) -> Self {
        let gpu_info = gpu_compute::device::GpuInfo::detect();
        let use_gpu = config.use_gpu && gpu_info.available;
        Self {
            config,
            progress: Arc::new(Mutex::new(None)),
            batch_hasher: BatchHasher::new().with_gpu(use_gpu),
        }
    }

    /// Set progress callback
    pub fn set_progress_callback<F>(&mut self, callback: F)
    where
        F: Fn(usize) + Send + Sync + 'static,
    {
        *self.progress.lock().unwrap() = Some(Box::new(callback));
    }

    /// Scan directory for files and compute hashes
    pub fn scan_directory<P: AsRef<Path>>(&self, path: P) -> Result<Vec<FileInfo>> {
        let path = path.as_ref();
        let mut files = Vec::new();
        let mut errors = Vec::new();
        let mut file_paths = Vec::new();
        let mut scanned = 0usize;

        // Walk directory tree to collect files
        let walker = WalkDir::new(path)
            .follow_links(self.config.follow_symlinks)
            .into_iter();

        for entry in walker {
            let entry = match entry {
                Ok(entry) => entry,
                Err(e) => {
                    errors.push(format!("Error walking directory: {}", e));
                    continue;
                }
            };

            let file_path = entry.path();

            if !file_path.is_file() {
                continue;
            }

            if !self.should_process_file(file_path) {
                continue;
            }

            let metadata = match fs::metadata(file_path) {
                Ok(meta) => meta,
                Err(e) => {
                    errors.push(format!(
                        "Error reading metadata for {}: {}",
                        file_path.display(),
                        e
                    ));
                    continue;
                }
            };

            let file_size = metadata.len();

            if file_size < self.config.min_file_size {
                continue;
            }
            if let Some(max_size) = self.config.max_file_size {
                if file_size > max_size {
                    continue;
                }
            }

            #[cfg(unix)]
            let (dev, ino) = (metadata.dev(), metadata.ino());
            #[cfg(not(unix))]
            let (dev, ino) = (0u64, 0u64);

            file_paths.push((file_path.to_path_buf(), metadata, dev, ino));
            scanned += 1;

            if let Some(ref cb) = *self.progress.lock().unwrap() {
                cb(scanned);
            }
        }

        // Batch hash all files using GPU-accelerated hasher
        let paths: Vec<_> = file_paths.iter().map(|(p, _, _, _)| p.clone()).collect();
        let hash_results = self.batch_hasher.hash_files(&paths);

        // Build FileInfo list
        for (i, hash_result) in hash_results.into_iter().enumerate() {
            if let Some(ref error) = hash_result.error {
                errors.push(format!(
                    "Error hashing {}: {}",
                    hash_result.path.display(),
                    error
                ));
                continue;
            }

            let (_, metadata, dev, ino) = &file_paths[i];
            let modified = metadata
                .modified()
                .map(DateTime::from)
                .unwrap_or_else(|_| Utc::now());

            let file_info = FileInfo {
                path: hash_result.path,
                size: hash_result.size,
                modified,
                hash: hash_result.hash,
                is_hard_link: false,
                dev: *dev,
                ino: *ino,
            };

            files.push(file_info);
        }

        if !errors.is_empty() {
            eprintln!("Encountered {} errors during scan:", errors.len());
            for error in &errors {
                eprintln!("  {}", error);
            }
        }

        Ok(files)
    }

    /// Find duplicate files from scanned files
    pub fn find_duplicates(&self, files: Vec<FileInfo>) -> Vec<DuplicateGroup> {
        let mut hash_map: HashMap<String, Vec<FileInfo>> = HashMap::new();

        // Group files by hash
        for file in files {
            hash_map.entry(file.hash.clone()).or_default().push(file);
        }

        // Filter for duplicates (groups with 2+ files)
        hash_map
            .into_iter()
            .filter_map(|(hash, mut files)| {
                if files.len() <= 1 {
                    return None;
                }

                // Detect existing hard-link sets within this hash group
                let mut linked: Vec<Vec<usize>> = Vec::new();
                for (i, file) in files.iter().enumerate() {
                    if file.is_hard_link {
                        continue;
                    }
                    let mut placed = false;
                    for set in &mut linked {
                        if let Some(&first) = set.first() {
                            if is_same_file(&files[first].path, &file.path).unwrap_or(false) {
                                set.push(i);
                                placed = true;
                                break;
                            }
                        }
                    }
                    if !placed {
                        linked.push(vec![i]);
                    }
                }

                // Mark files that are already hard-linked to another file in the group
                for set in &linked {
                    if set.len() > 1 {
                        for &idx in set {
                            files[idx].is_hard_link = true;
                        }
                    }
                }

                let size = files[0].size;
                let can_deduplicate = files.iter().any(|f| !f.is_hard_link);
                Some(DuplicateGroup {
                    hash,
                    size,
                    files,
                    can_deduplicate,
                })
            })
            .collect()
    }

    /// Deduplicate files by creating hard links
    pub fn deduplicate(
        &self,
        duplicate_groups: &[DuplicateGroup],
        total_files_scanned: usize,
    ) -> Result<DeduplicationResult> {
        let mut result = DeduplicationResult {
            total_files_scanned,
            duplicate_groups: duplicate_groups.to_vec(),
            space_saved: 0,
            files_processed: 0,
            errors: Vec::new(),
        };

        for group in duplicate_groups {
            if group.files.len() < 2 {
                continue;
            }

            // Sort files by modification time (oldest first)
            let mut files = group.files.clone();
            files.sort_by_key(|a| a.modified);

            // Keep the oldest file as the source
            let source_file = &files[0];
            let duplicate_files = &files[1..];

            for duplicate_file in duplicate_files {
                if duplicate_file.is_hard_link {
                    continue;
                }

                if self.config.dry_run {
                    // In dry run mode, just calculate potential space savings
                    result.space_saved += duplicate_file.size;
                } else if self.config.create_hard_links {
                    match self.create_hard_link(source_file, duplicate_file) {
                        Ok(_) => {
                            result.space_saved += duplicate_file.size;
                        }
                        Err(e) => {
                            result.errors.push(format!(
                                "Failed to create hard link from {} to {}: {}",
                                source_file.path.display(),
                                duplicate_file.path.display(),
                                e
                            ));
                        }
                    }
                }
                result.files_processed += 1;
            }
        }

        Ok(result)
    }

    /// Check if file should be processed based on patterns
    fn should_process_file(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();
        let path_lower = path_str.to_lowercase();
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        // Normalize path separators for matching
        let path_normalized = path_lower.replace('\\', "/");

        // Check exclude patterns (support glob-like matching)
        for pattern in &self.config.exclude_patterns {
            let pat_lower = pattern.to_lowercase();
            if let Some(pat_ext) = pat_lower.strip_prefix("*.") {
                // Extension match: "*.tmp" matches files ending in .tmp
                if ext == pat_ext {
                    return false;
                }
            } else if pat_lower.ends_with("/*") || pat_lower.ends_with('/') {
                // Directory name match: matches any path component
                let dir_name = pat_lower.trim_end_matches("/*").trim_end_matches('/');
                if !dir_name.is_empty() && path_normalized.split('/').any(|part| part == dir_name) {
                    return false;
                }
            } else {
                // Substring match for anything else
                if path_normalized.contains(&pat_lower) {
                    return false;
                }
            }
        }

        // Check include patterns (if any specified)
        if !self.config.include_patterns.is_empty() {
            for pattern in &self.config.include_patterns {
                let pat_lower = pattern.to_lowercase();
                if let Some(pat_ext) = pat_lower.strip_prefix("*.") {
                    if ext == pat_ext {
                        return true;
                    }
                } else if pat_lower.ends_with("/*") || pat_lower.ends_with('/') {
                    let dir_name = pat_lower.trim_end_matches("/*").trim_end_matches('/');
                    if !dir_name.is_empty()
                        && path_normalized.split('/').any(|part| part == dir_name)
                    {
                        return true;
                    }
                } else if path_normalized.contains(&pat_lower) {
                    return true;
                }
            }
            return false;
        }

        true
    }

    /// Create hard link from source to duplicate
    fn create_hard_link(&self, source: &FileInfo, duplicate: &FileInfo) -> Result<()> {
        let tmp_path = duplicate.path.with_extension("dedup_tmp");

        // Create hard link at a temporary path first
        fs::hard_link(&source.path, &tmp_path).with_context(|| {
            format!(
                "Failed to create hard link from {} to {}",
                source.path.display(),
                tmp_path.display()
            )
        })?;

        // Remove the original duplicate and atomically move the temp link into place
        fs::remove_file(&duplicate.path)?;
        fs::rename(&tmp_path, &duplicate.path)?;

        Ok(())
    }

    /// Run complete deduplication process
    pub fn run<P: AsRef<Path>>(&self, path: P) -> Result<DeduplicationResult> {
        println!("🔍 Scanning directory: {}", path.as_ref().display());

        // Scan files
        let files = self.scan_directory(path)?;
        let total_files_scanned = files.len();
        println!("📁 Found {} files to analyze", total_files_scanned);

        // Find duplicates
        let duplicate_groups = self.find_duplicates(files);
        println!("🔗 Found {} duplicate groups", duplicate_groups.len());

        // Calculate total duplicates
        let total_duplicates: usize = duplicate_groups.iter().map(|g| g.files.len() - 1).sum();
        println!("📊 Total duplicate files: {}", total_duplicates);

        // Deduplicate
        let result = self.deduplicate(&duplicate_groups, total_files_scanned)?;

        println!("✅ Deduplication complete!");
        println!("💾 Space saved: {} bytes", result.space_saved);

        Ok(result)
    }
}

impl Default for FileDeduplicator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_duplicate_detection() {
        let deduplicator = FileDeduplicator::with_config(DeduplicationConfig {
            min_file_size: 0,
            ..Default::default()
        });
        let temp_dir = TempDir::new().unwrap();

        // Create two identical files
        let file1_path = temp_dir.path().join("file1.txt");
        let file2_path = temp_dir.path().join("file2.txt");

        let content = "This is test content for duplicate detection.";
        fs::write(&file1_path, content).unwrap();
        fs::write(&file2_path, content).unwrap();

        let files = deduplicator.scan_directory(temp_dir.path()).unwrap();
        let duplicate_groups = deduplicator.find_duplicates(files);

        assert_eq!(duplicate_groups.len(), 1);
        assert_eq!(duplicate_groups[0].files.len(), 2);
    }

    #[test]
    fn test_existing_hard_link_detection() {
        let deduplicator = FileDeduplicator::with_config(DeduplicationConfig {
            min_file_size: 0,
            ..Default::default()
        });
        let temp_dir = TempDir::new().unwrap();

        let file1_path = temp_dir.path().join("file1.txt");
        let file2_path = temp_dir.path().join("file2.txt");

        fs::write(&file1_path, "duplicate content").unwrap();
        fs::hard_link(&file1_path, &file2_path).unwrap();

        let files = deduplicator.scan_directory(temp_dir.path()).unwrap();
        let duplicate_groups = deduplicator.find_duplicates(files);

        assert_eq!(duplicate_groups.len(), 1);
        assert_eq!(duplicate_groups[0].files.len(), 2);
        assert!(duplicate_groups[0]
            .files
            .iter()
            .all(|f| f.is_hard_link || duplicate_groups[0].files.len() == 1));
        assert!(!duplicate_groups[0].can_deduplicate);
    }

    #[test]
    fn test_should_process_file_patterns() {
        let deduplicator = FileDeduplicator::new();

        assert!(!deduplicator.should_process_file(Path::new("test.tmp")));
        assert!(!deduplicator.should_process_file(Path::new("node_modules/pkg")));
        assert!(!deduplicator.should_process_file(Path::new(".git/config")));
        assert!(deduplicator.should_process_file(Path::new("readme.md")));
    }

    #[test]
    fn test_no_duplicates_for_unique_files() {
        let deduplicator = FileDeduplicator::with_config(DeduplicationConfig {
            min_file_size: 0,
            ..Default::default()
        });
        let temp_dir = TempDir::new().unwrap();

        fs::write(temp_dir.path().join("a.txt"), "content A").unwrap();
        fs::write(temp_dir.path().join("b.txt"), "content B").unwrap();
        fs::write(temp_dir.path().join("c.txt"), "content C").unwrap();

        let files = deduplicator.scan_directory(temp_dir.path()).unwrap();
        let duplicate_groups = deduplicator.find_duplicates(files);

        assert_eq!(duplicate_groups.len(), 0);
    }

    #[test]
    fn test_empty_file_handling() {
        let deduplicator = FileDeduplicator::with_config(DeduplicationConfig {
            min_file_size: 0,
            ..Default::default()
        });
        let temp_dir = TempDir::new().unwrap();

        fs::write(temp_dir.path().join("empty1.txt"), "").unwrap();
        fs::write(temp_dir.path().join("empty2.txt"), "").unwrap();

        let files = deduplicator.scan_directory(temp_dir.path()).unwrap();
        let duplicate_groups = deduplicator.find_duplicates(files);

        assert_eq!(duplicate_groups.len(), 1);
        assert_eq!(duplicate_groups[0].files.len(), 2);
    }

    #[test]
    fn test_min_file_size_filters_small_files() {
        let deduplicator = FileDeduplicator::with_config(DeduplicationConfig {
            min_file_size: 100,
            ..Default::default()
        });
        let temp_dir = TempDir::new().unwrap();

        fs::write(temp_dir.path().join("small.txt"), "tiny").unwrap();
        fs::write(temp_dir.path().join("large.txt"), "x".repeat(200)).unwrap();

        let files = deduplicator.scan_directory(temp_dir.path()).unwrap();

        assert!(!files.iter().any(|f| f.path.ends_with("small.txt")));
        assert!(files.iter().any(|f| f.path.ends_with("large.txt")));
    }
}
