//! File Deduplicator Library
//! 
//! High-performance file deduplication with BLAKE3 hashing and hard link support.
//! Provides both library and binary interfaces for flexible integration.

use std::collections::HashMap;
use std::fs::{self, File, Metadata};
use std::io::{self, Read, BufReader};
use std::path::{Path, PathBuf};
use anyhow::{Result, Context, anyhow};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use blake3::Hasher;
use rayon::prelude::*;
use walkdir::WalkDir;
use std::sync::{Arc, Mutex};
use gpu_compute::hash::BatchHasher;

#[cfg(windows)]
use winapi::um::fileapi::CreateHardLinkW;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use std::ptr;

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
        }
    }
}

/// Main deduplicator structure
pub struct FileDeduplicator {
    config: DeduplicationConfig,
    progress: Arc<Mutex<Option<Box<dyn Fn(usize) + Send + Sync>>>>,
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
        Self {
            config,
            progress: Arc::new(Mutex::new(None)),
            batch_hasher: BatchHasher::new().with_gpu(gpu_info.available),
        }
    }

    /// Set progress callback
    pub fn set_progress_callback<F>(&mut self, callback: F) 
    where 
        F: Fn(usize) + Send + Sync + 'static 
    {
        *self.progress.lock().unwrap() = Some(Box::new(callback));
    }

    /// Scan directory for files and compute hashes
    pub fn scan_directory<P: AsRef<Path>>(&self, path: P) -> Result<Vec<FileInfo>> {
        let path = path.as_ref();
        let mut files = Vec::new();
        let mut errors = Vec::new();
        let mut file_paths = Vec::new();

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
                    errors.push(format!("Error reading metadata for {}: {}", file_path.display(), e));
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
            {
                if metadata.nlink() > 1 {
                    continue;
                }
            }

            file_paths.push((file_path.to_path_buf(), metadata));
        }

        // Batch hash all files using GPU-accelerated hasher
        let paths: Vec<_> = file_paths.iter().map(|(p, _)| p.clone()).collect();
        let hash_results = self.batch_hasher.hash_files(&paths);

        // Build FileInfo list
        for (i, hash_result) in hash_results.into_iter().enumerate() {
            if let Some(ref error) = hash_result.error {
                errors.push(format!("Error hashing {}: {}", hash_result.path.display(), error));
                continue;
            }

            let metadata = &file_paths[i].1;
            let modified = metadata.modified()
                .map(|t| DateTime::from(t))
                .unwrap_or_else(|_| Utc::now());

            let file_info = FileInfo {
                path: hash_result.path,
                size: hash_result.size,
                modified,
                hash: hash_result.hash,
                is_hard_link: false,
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
            .filter_map(|(hash, files)| {
                if files.len() > 1 {
                    let size = files[0].size;
                    Some(DuplicateGroup {
                        hash,
                        size,
                        files,
                        can_deduplicate: true,
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    /// Deduplicate files by creating hard links
    pub fn deduplicate(&self, duplicate_groups: &[DuplicateGroup]) -> Result<DeduplicationResult> {
        let mut result = DeduplicationResult {
            total_files_scanned: 0,
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
            files.sort_by(|a, b| a.modified.cmp(&b.modified));

            // Keep the oldest file as the source
            let source_file = &files[0];
            let duplicate_files = &files[1..];

            for duplicate_file in duplicate_files {
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

    /// Compute BLAKE3 hash of a file
    fn compute_file_hash(&self, path: &Path) -> Result<String> {
        let file = File::open(path)
            .with_context(|| format!("Failed to open file: {}", path.display()))?;
        
        let mut hasher = Hasher::new();
        let mut reader = BufReader::new(file);
        let mut buffer = vec![0u8; 8192]; // 8KB buffer

        loop {
            let bytes_read = reader.read(&mut buffer)
                .with_context(|| format!("Failed to read file: {}", path.display()))?;
            
            if bytes_read == 0 {
                break;
            }
            
            hasher.update(&buffer[..bytes_read]);
        }

        Ok(hasher.finalize().to_hex().to_string())
    }

    /// Check if file should be processed based on patterns
    fn should_process_file(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();

        // Check exclude patterns
        for pattern in &self.config.exclude_patterns {
            if path_str.contains(pattern) {
                return false;
            }
        }

        // Check include patterns (if any specified)
        if !self.config.include_patterns.is_empty() {
            for pattern in &self.config.include_patterns {
                if path_str.contains(pattern) {
                    return true;
                }
            }
            return false;
        }

        true
    }

    /// Create hard link from source to duplicate
    #[cfg(windows)]
    fn create_hard_link(&self, source: &FileInfo, duplicate: &FileInfo) -> Result<()> {
        // Remove the duplicate file first
        fs::remove_file(&duplicate.path)?;

        // Convert paths to wide character strings for Windows API
        let source_wide: Vec<u16> = source.path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let duplicate_wide: Vec<u16> = duplicate.path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Create hard link using Windows API
        let result = unsafe {
            CreateHardLinkW(
                duplicate_wide.as_ptr(),
                source_wide.as_ptr(),
                ptr::null_mut(),
            )
        };

        if result == 0 {
            return Err(anyhow!("Failed to create hard link: {}", io::Error::last_os_error()));
        }

        Ok(())
    }

    /// Create hard link from source to duplicate
    #[cfg(unix)]
    fn create_hard_link(&self, source: &FileInfo, duplicate: &FileInfo) -> Result<()> {
        // Remove the duplicate file first
        fs::remove_file(&duplicate.path)?;

        // Create hard link
        fs::hard_link(&source.path, &duplicate.path)
            .with_context(|| {
                format!(
                    "Failed to create hard link from {} to {}",
                    source.path.display(),
                    duplicate.path.display()
                )
            })?;

        Ok(())
    }

    /// Run complete deduplication process
    pub fn run<P: AsRef<Path>>(&self, path: P) -> Result<DeduplicationResult> {
        println!("🔍 Scanning directory: {}", path.as_ref().display());
        
        // Scan files
        let files = self.scan_directory(path)?;
        println!("📁 Found {} files to analyze", files.len());

        // Find duplicates
        let duplicate_groups = self.find_duplicates(files);
        println!("🔗 Found {} duplicate groups", duplicate_groups.len());

        // Calculate total duplicates
        let total_duplicates: usize = duplicate_groups.iter()
            .map(|g| g.files.len() - 1)
            .sum();
        println!("📊 Total duplicate files: {}", total_duplicates);

        // Deduplicate
        let result = self.deduplicate(&duplicate_groups)?;

        println!("✅ Deduplication complete!");
        println!("💾 Space saved: {} bytes", self.format_bytes(result.space_saved));

        Ok(result)
    }

    /// Format bytes to human readable string
    fn format_bytes(&self, bytes: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        let mut size = bytes as f64;
        let mut unit_index = 0;

        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }

        format!("{:.2} {}", size, UNITS[unit_index])
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
    fn test_file_hash_computation() {
        let deduplicator = FileDeduplicator::new();
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        
        fs::write(&file_path, "Hello, World!").unwrap();
        
        let hash = deduplicator.compute_file_hash(&file_path).unwrap();
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // BLAKE3 hex string length
    }

    #[test]
    fn test_duplicate_detection() {
        let deduplicator = FileDeduplicator::new();
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
}