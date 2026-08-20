impl FileScanner {
    fn should_include_file(
        &self,
        metadata: &std::fs::Metadata,
        path: &Path,
        options: &ScanOptions,
    ) -> bool {
        if !options.include_hidden && Self::is_hidden(path, metadata) {
            return false;
        }

        let size = allocated_size(metadata, path);

        if let Some(min) = options.min_size {
            if size < min {
                return false;
            }
        }

        if let Some(max) = options.max_size {
            if size > max {
                return false;
            }
        }

        true
    }

    fn is_hidden(path: &Path, metadata: &std::fs::Metadata) -> bool {
        if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.'))
        {
            return true;
        }

        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
        }

        #[cfg(not(windows))]
        {
            let _ = metadata;
            false
        }
    }

    fn dir_entry_is_hidden(entry: &walkdir::DirEntry) -> bool {
        match entry.metadata() {
            Ok(m) => {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
                    m.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
                }
                #[cfg(not(windows))]
                {
                    entry
                        .file_name()
                        .and_then(|n| n.to_str())
                        .is_some_and(|n| n.starts_with('.'))
                }
            }
            Err(_) => false,
        }
    }

    fn compute_true_empty_dirs(walk_entries: &[walkdir::DirEntry]) -> Vec<String> {
        use std::collections::{HashMap, HashSet};

        let mut all_dirs: HashSet<String> = HashSet::new();
        let mut child_counts: HashMap<String, usize> = HashMap::new();

        for entry in walk_entries {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            if entry.metadata().map(|m| m.is_dir()).unwrap_or(false) {
                all_dirs.insert(path_str);
            }

            if let Some(parent) = path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                *child_counts.entry(parent_str).or_insert(0) += 1;
            }
        }

        all_dirs
            .into_iter()
            .filter(|dir| *child_counts.get(dir).unwrap_or(&0) == 0)
            .collect()
    }

    fn format_timestamp(time: std::time::SystemTime) -> Option<String> {
        time.duration_since(std::time::UNIX_EPOCH)
            .ok()
            .and_then(|d| DateTime::from_timestamp(d.as_secs() as i64, 0))
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
    }

    fn get_mtime_unix(metadata: &std::fs::Metadata) -> i64 {
        metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    }

    pub fn scan_directory_sync(
        &self,
        path: &str,
        options: ScanOptions,
    ) -> anyhow::Result<ScanResult> {
        let mut result = ScanResult {
            total_files: 0,
            total_directories: 0,
            total_size: 0,
            file_types: HashMap::new(),
            extension_sizes: HashMap::new(),
            size_distribution: HashMap::new(),
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
            subdirectories: Vec::new(),
            scanned_files: HashMap::new(),
            category_sizes: HashMap::new(),
            reclaim_tier_sizes: HashMap::new(),
            category_reclaimable: HashMap::new(),
        };

        let mut raw_entries = Vec::new();

        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        let mut walk_entries = Vec::new();
        for entry in walker.into_iter().filter_entry(|e| {
            if options.include_hidden || e.depth() == 0 {
                return true;
            }
            if !e.file_type().is_dir() {
                return true;
            }
            !Self::dir_entry_is_hidden(e)
        }) {
            match entry {
                Ok(entry) => walk_entries.push(entry),
                Err(error) => result.errors.push(format!("Traversal error: {error}")),
            }
        }
        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        let mut scanned_files = HashMap::new();
        for entry_result in walk_entries {
            let entry_path = entry_result.path();
            let path_str = entry_path.to_string_lossy().to_string();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let error_msg = if e.io_error().map(|io_err| io_err.kind())
                        == Some(std::io::ErrorKind::PermissionDenied)
                    {
                        format!("Permission denied: {}", path_str)
                    } else {
                        format!("Metadata error: {}: {}", path_str, e)
                    };
                    result.errors.push(error_msg);
                    continue;
                }
            };

            let is_dir = metadata.is_dir();
            let size = allocated_size(&metadata, entry_path);
            let mtime = Self::get_mtime_unix(&metadata);

            if !is_dir && !self.should_include_file(&metadata, entry_path, &options) {
                continue;
            }

            if !is_dir {
                if let Some(cache_map) = options.file_cache.as_ref() {
                    if let Some(&(cached_size, cached_mtime)) = cache_map.get(&path_str) {
                        if cached_size == size && cached_mtime == mtime {
                            scanned_files.insert(path_str.clone(), (cached_size, cached_mtime));
                            raw_entries.push(gpu_compute::scan::RawFileEntry {
                                path: path_str,
                                size: cached_size,
                                is_dir,
                            });
                            continue;
                        }
                    }
                }
            }

            scanned_files.insert(path_str.clone(), (size, mtime));
            raw_entries.push(gpu_compute::scan::RawFileEntry {
                path: path_str,
                size,
                is_dir,
            });
        }

        let use_gpu = options.gpu_acceleration && gpu_compute::device::GpuInfo::is_available();
        let processor = gpu_compute::scan::GpuScanProcessor::new()
            .with_gpu(use_gpu)
            .with_scan_root(path)
            .with_top_n(options.top_n);

        let gpu_result = processor.process(&raw_entries);

        Self::apply_gpu_result(
            &mut result,
            gpu_result,
            &raw_entries,
            true_empty_dirs,
            scanned_files,
        );

        Ok(result)
    }

    /// Walk `path` and collect every file that satisfies `query`, capped at
    /// `query.limit` matches. Unlike `scan_directory_sync` this performs a
    /// lightweight traversal that returns the actual matching paths rather than a
    /// whole-tree aggregate, so it powers the AI assistant's `search_files` tool
    /// and the `search` CLI subcommand with a real, bounded filesystem search.
    pub fn search_files_sync(
        &self,
        path: &str,
        query: SearchQuery,
        progress: Option<&dyn Fn(u64)>,
    ) -> anyhow::Result<SearchResult> {
        let mut matches: Vec<FileInfo> = Vec::new();
        let mut files_scanned: u64 = 0;
        let mut errors: Vec<String> = Vec::new();
        let mut over_limit = false;

        let ext_filter = query.extension.as_ref().and_then(|e| {
            let trimmed = e.trim_start_matches('.').to_lowercase();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });

        let keyword = query.keyword.as_ref().map(|k| k.to_lowercase());

        let mut walker = WalkDir::new(path);
        if let Some(depth) = query.max_depth {
            walker = walker.max_depth(depth);
        }
        walker = walker.follow_links(false);

        for entry in walker.into_iter().filter_entry(|e| {
            if query.include_hidden || e.depth() == 0 {
                return true;
            }
            if !e.file_type().is_dir() {
                return true;
            }
            !Self::dir_entry_is_hidden(e)
        }) {
            let entry = match entry {
                Ok(e) => e,
                Err(error) => {
                    errors.push(format!("Traversal error: {error}"));
                    continue;
                }
            };

            if entry.file_type().is_dir() {
                continue;
            }

            let entry_path = entry.path();
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(e) => {
                    let path_str = entry_path.to_string_lossy().to_string();
                    let error_msg = if e
                        .io_error()
                        .map(|io_err| io_err.kind())
                        == Some(std::io::ErrorKind::PermissionDenied)
                    {
                        format!("Permission denied: {path_str}")
                    } else {
                        format!("Metadata error: {path_str}: {e}")
                    };
                    errors.push(error_msg);
                    continue;
                }
            };

            files_scanned += 1;

            // Report progress to a host process periodically (every 8192 files so a
            // large subtree doesn't flood the progress channel). The callback decides
            // what to do with it (e.g. emit a `__PROGRESS__` line for the GUI).
            if files_scanned % 8192 == 0 {
                if let Some(report) = progress {
                    report(files_scanned);
                }
            }

            if !query.include_hidden && Self::is_hidden(entry_path, &metadata) {
                continue;
            }

            let size = allocated_size(&metadata, entry_path);

            if let Some(min) = query.min_size {
                if size < min {
                    continue;
                }
            }
            if let Some(max) = query.max_size {
                if size > max {
                    continue;
                }
            }

            if let Some(ext) = &ext_filter {
                let file_ext = entry_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();
                if &file_ext != ext {
                    continue;
                }
            }

            if let Some(kw) = &keyword {
                if !entry_path.to_string_lossy().to_lowercase().contains(kw) {
                    continue;
                }
            }

            if matches.len() >= query.limit {
                over_limit = true;
                continue;
            }

            let path_str = entry_path.to_string_lossy().to_string();
            let name = entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let extension = entry_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let modified = Self::format_timestamp(
                metadata.modified().unwrap_or(std::time::UNIX_EPOCH),
            );

            matches.push(FileInfo {
                path: path_str,
                name,
                size,
                modified,
                file_type: "file".to_string(),
                extension,
            });
        }

        Ok(SearchResult {
            total_matches: matches.len(),
            files_scanned,
            truncated: over_limit,
            matches,
            errors,
        })
    }

    fn apply_gpu_result(
        result: &mut ScanResult,
        gpu_result: gpu_compute::scan::GpuScanResult,
        raw_entries: &[gpu_compute::scan::RawFileEntry],
        true_empty_dirs: Vec<String>,
        scanned_files: HashMap<String, (u64, i64)>,
    ) {
        result.total_files = gpu_result.total_files;
        result.total_size = gpu_result.total_size;
        result.file_types = gpu_result.file_types;
        result.extension_sizes = gpu_result.extension_sizes;
        result.size_distribution = gpu_result.size_distribution;
        result.empty_directories = true_empty_dirs;
        result.subdirectories = gpu_result
            .subdirectories
            .into_iter()
            .map(|d| DirInfo {
                path: d.path,
                name: d.name,
                total_size: d.total_size,
                file_count: d.file_count,
                dir_count: d.dir_count,
                largest_file_size: d.largest_file_size,
            })
            .collect();

        for info in gpu_result.largest_files {
            let modified = std::fs::metadata(&info.path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(Self::format_timestamp);

            result.largest_files.push(FileInfo {
                path: info.path,
                name: info.name,
                size: info.size,
                modified,
                file_type: "file".to_string(),
                extension: info.extension,
            });
        }

        result.total_directories = raw_entries.iter().filter(|e| e.is_dir).count() as u64;
        result.scanned_files = scanned_files;

        let mut category_sizes_acc: HashMap<String, u64> = HashMap::new();
        let mut reclaim_tier_sizes_acc: HashMap<String, u64> = HashMap::new();
        let mut category_reclaimable_acc: HashMap<String, u64> = HashMap::new();
        for entry in raw_entries {
            if entry.is_dir {
                continue;
            }
            let ext = Path::new(&entry.path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let cat = extension_to_category(&ext, &entry.path);
            *category_sizes_acc.entry(cat.to_string()).or_insert(0) += entry.size;
            let tier = classify_reclaimability(&ext, &entry.path.to_lowercase(), cat);
            *reclaim_tier_sizes_acc.entry(tier.as_str().to_string()).or_insert(0) += entry.size;
            if tier != ReclaimTier::Keep {
                *category_reclaimable_acc.entry(cat.to_string()).or_insert(0) += entry.size;
            }
        }
        result.category_sizes = category_sizes_acc;
        result.reclaim_tier_sizes = reclaim_tier_sizes_acc;
        result.category_reclaimable = category_reclaimable_acc;
    }
}
