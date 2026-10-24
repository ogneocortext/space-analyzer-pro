/// Accumulators shared across batch processing to avoid excessive arguments.
struct BatchAccumulators {
    file_types: HashMap<String, u64>,
    extension_sizes: HashMap<String, u64>,
    category_sizes_acc: HashMap<String, u64>,
    reclaim_tier_sizes_acc: HashMap<String, u64>,
    category_reclaimable_acc: HashMap<String, u64>,
}

/// Collections that grow during the walk.
struct ScanCollections {
    all_raw_entries: Vec<RawFileEntry>,
    scanned_files: HashMap<String, (u64, i64)>,
}

impl FileScanner {
    fn should_include_file(
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

        if !Self::is_within_age_window(metadata, options) {
            return false;
        }

        true
    }

    /// True when the file's modification age falls within `[min_age_days, max_age_days]`.
    /// `None` bounds are unbounded. Age is measured in whole days since modification.
    fn is_within_age_window(metadata: &std::fs::Metadata, options: &ScanOptions) -> bool {
        let Some(_) = options.min_age_days.or(options.max_age_days) else {
            return true;
        };
        let Ok(modified) = metadata.modified() else {
            return true;
        };
        let Ok(age_seconds) = modified.elapsed() else {
            return true;
        };
        let age_days = age_seconds.as_secs() / 86_400;
        if let Some(min) = options.min_age_days {
            if age_days < min {
                return false;
            }
        }
        if let Some(max) = options.max_age_days {
            if age_days > max {
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

    /// Compute directories with zero child entries from raw entries.
    fn compute_true_empty_dirs(entries: &[(String, bool)]) -> Vec<String> {
        use std::collections::{HashMap, HashSet};

        let mut all_dirs: HashSet<String> = HashSet::new();
        let mut child_counts: HashMap<String, usize> = HashMap::new();

        for (path, is_dir) in entries {
            if *is_dir {
                all_dirs.insert(path.clone());
            }

            if let Some(parent) = Path::new(path).parent() {
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

    /// Streamed directory scan with parallel metadata processing.
    ///
    /// WalkDir traversal is sequential, but per-entry metadata syscalls,
    /// categorization, and filtering are parallelised across cores using rayon.
    /// Entries are processed in batches of 1024 to bound memory usage — the
    /// entire tree is never buffered in RAM at once. Progress is reported via
    /// `options.progress_callback` after each batch, and `self.cancel_flag` is
    /// checked before each batch so cancellation is responsive.
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
            largest_files: Vec::new(),
            empty_directories: Vec::new(),
            errors: Vec::new(),
            subdirectories: Vec::new(),
            scanned_files: HashMap::new(),
            category_sizes: HashMap::new(),
            reclaim_tier_sizes: HashMap::new(),
            category_reclaimable: HashMap::new(),
        };

        let dir_cache = options.dir_cache.clone();
        let mut skipped_dirs: Vec<(String, u64, u64, i64)> = Vec::new();
        let mut skip_dirs: HashSet<String> = HashSet::new();
        let include_hidden = options.include_hidden;

        // Incremental accumulators for progress reporting during the walk.
        let mut acc = BatchAccumulators {
            file_types: HashMap::new(),
            extension_sizes: HashMap::new(),
            category_sizes_acc: HashMap::new(),
            reclaim_tier_sizes_acc: HashMap::new(),
            category_reclaimable_acc: HashMap::new(),
        };
        let mut collections = ScanCollections {
            all_raw_entries: Vec::new(),
            scanned_files: HashMap::new(),
        };

        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        let mut batch: Vec<walkdir::DirEntry> = Vec::with_capacity(1024);
        const BATCH_SIZE: usize = 1024;
        let start_time = Instant::now();

        for entry_result in walker {
            // Check cancellation before processing each entry.
            if self.cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            match entry_result {
                Ok(entry) => {
                    let is_dir = entry.file_type().is_dir();
                    let dir_path = entry.path().to_string_lossy().to_string();

                    // Hidden-filter logic
                    if !include_hidden && entry.depth() > 0 && is_dir && Self::dir_entry_is_hidden(&entry) {
                        continue;
                    }

                    // Directory cache skip
                    if is_dir {
                        if let Some(cache) = dir_cache.as_ref().and_then(|c| c.get(&dir_path)) {
                            let (cached_size, cached_file_count, cached_mtime) = cache;
                            if let Ok(meta) = entry.metadata() {
                                if let Ok(mtime) = meta.modified() {
                                    let mtime_unix = mtime
                                        .duration_since(SystemTime::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs() as i64;
                                    if mtime_unix == *cached_mtime {
                                        skipped_dirs.push((
                                            dir_path.clone(),
                                            *cached_size,
                                            *cached_file_count,
                                            *cached_mtime,
                                        ));
                                        skip_dirs.insert(dir_path.clone());
                                        collections.scanned_files.insert(
                                            dir_path.clone(),
                                            (*cached_size, *cached_mtime),
                                        );
                                        continue;
                                    }
                                }
                            }
                        }
                    }

                    // File under a skipped directory: skip processing
                    if !is_dir {
                        let mut parent = entry.path().parent();
                        let mut under_skipped = false;
                        while let Some(p) = parent {
                            if skip_dirs.contains(&p.to_string_lossy().to_string()) {
                                under_skipped = true;
                                break;
                            }
                            parent = p.parent();
                        }
                        if under_skipped {
                            continue;
                        }
                    }

                    batch.push(entry);

                    if batch.len() >= BATCH_SIZE {
                        self.process_batch(
                            &batch,
                            &options,
                            &mut result,
                            &mut acc,
                            &mut collections,
                        )?;
                        batch.clear();

                        if let Some(progress) = &options.progress_callback {
                            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                progress(ScanProgress {
                                    phase: "scanning".to_string(),
                                    entries_discovered: 0,
                                    files_scanned: result.total_files,
                                    directories_scanned: result.total_directories,
                                    total_size: result.total_size,
                                    current_file: "Processing batch".to_string(),
                                    percentage: 0.0,
                                    elapsed_secs: start_time.elapsed().as_secs_f64(),
                                    live_files: Vec::new(),
                                    file_type_counts: acc.file_types.clone(),
                                    extension_sizes: acc.extension_sizes.clone(),
                                    category_sizes: acc.category_sizes_acc.clone(),
                                });
                            }));
                        }
                    }
                }
                Err(error) => result.errors.push(format!("Traversal error: {error}")),
            }
        }

        // Process remaining batch
        if !batch.is_empty() {
            self.process_batch(
                &batch,
                &options,
                &mut result,
                &mut acc,
                &mut collections,
            )?;
            if let Some(progress) = &options.progress_callback {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    progress(ScanProgress {
                        phase: "scanning".to_string(),
                        entries_discovered: 0,
                        files_scanned: result.total_files,
                        directories_scanned: result.total_directories,
                        total_size: result.total_size,
                        current_file: "Processing batch".to_string(),
                        percentage: 0.0,
                        elapsed_secs: start_time.elapsed().as_secs_f64(),
                        live_files: Vec::new(),
                        file_type_counts: acc.file_types.clone(),
                        extension_sizes: acc.extension_sizes.clone(),
                        category_sizes: acc.category_sizes_acc.clone(),
                    });
                }));
            }
        }

        // Compute true empty dirs from raw entries.
        let raw_entry_pairs: Vec<(String, bool)> = collections
            .all_raw_entries
            .iter()
            .map(|e| (e.path.clone(), e.is_dir))
            .collect();
        let true_empty_dirs = Self::compute_true_empty_dirs(&raw_entry_pairs);

        // Run compute-heavy post-processing on all collected entries.
        let post_result =
            post_process_entries(&collections.all_raw_entries, options.top_n, Some(Path::new(path)));

        Self::apply_cpu_result(
            &mut result,
            &post_result,
            &collections.all_raw_entries,
            true_empty_dirs,
            collections.scanned_files,
        );

        // Add skipped directory totals from cache (dirs whose mtime matched,
        // so their subtrees were not walked).
        let skipped_size: u64 = skipped_dirs.iter().map(|(_, s, _, _)| *s).sum();
        let skipped_files: u64 = skipped_dirs.iter().map(|(_, _, f, _)| *f).sum();
        result.total_size += skipped_size;
        result.total_files += skipped_files;
        result.total_directories += skipped_dirs.len() as u64;
        for (dir_path, cached_size, cached_file_count, _) in &skipped_dirs {
            result.subdirectories.push(DirInfo {
                path: strip_verbatim(dir_path.clone()),
                name: extract_filename(dir_path),
                total_size: *cached_size,
                file_count: *cached_file_count,
                dir_count: 0,
                largest_file_size: 0,
            });
        }

        Ok(result)
    }

    /// Process a batch of directory entries in parallel using rayon.
    /// Each thread returns a local result; merging happens sequentially
    /// afterward, so there is no shared mutable state across threads.
    fn process_batch(
        &self,
        batch: &[walkdir::DirEntry],
        options: &ScanOptions,
        result: &mut ScanResult,
        acc: &mut BatchAccumulators,
        collections: &mut ScanCollections,
    ) -> anyhow::Result<()> {
        // Phase 1: parallel metadata extraction per entry.
        let batch_results: Vec<_> = batch
            .par_iter()
            .map(|entry_result| {
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
                        return (
                            path_str,
                            0u64,
                            false,
                            0i64,
                            String::new(),
                            String::new(),
                            ReclaimTier::Keep,
                            false,
                            Some(error_msg),
                        );
                    }
                };

                let is_dir = metadata.is_dir();
                let size = allocated_size(&metadata, entry_path);
                let mtime = Self::get_mtime_unix(&metadata);

                if !is_dir && !Self::should_include_file(&metadata, entry_path, options) {
                    return (
                        path_str,
                        size,
                        false,
                        mtime,
                        String::new(),
                        String::new(),
                        ReclaimTier::Keep,
                        false,
                        None,
                    );
                }

                let ext = Path::new(&entry_path)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let cat = extension_to_category(&ext, &path_str);
                let tier = classify_reclaimability(&ext, &path_str.to_lowercase(), cat);

                (
                    path_str,
                    size,
                    is_dir,
                    mtime,
                    ext,
                    cat.to_string(),
                    tier,
                    true,
                    None,
                )
            })
            .collect();

        // Phase 2: sequential merge (no shared mutable state across threads).
        for (
            path_str,
            size,
            is_dir,
            mtime,
            ext,
            cat,
            tier,
            include,
            error,
        ) in batch_results
        {
            if let Some(err) = error {
                result.errors.push(err);
                continue;
            }
            if !include {
                continue;
            }

            if is_dir {
                result.total_directories += 1;
            } else {
                result.total_files += 1;
                result.total_size += size;
            }

            collections.all_raw_entries.push(RawFileEntry {
                path: path_str.clone(),
                size,
                is_dir,
            });

            collections.scanned_files.insert(path_str.clone(), (size, mtime));

            *acc.file_types.entry(ext.clone()).or_insert(0) += 1;
            *acc.extension_sizes.entry(ext.clone()).or_insert(0) += size;
            *acc.category_sizes_acc.entry(cat.clone()).or_insert(0) += size;
            *acc
                .reclaim_tier_sizes_acc
                .entry(tier.as_str().to_string())
                .or_insert(0)
                += size;
            if tier != ReclaimTier::Keep {
                *acc
                    .category_reclaimable_acc
                    .entry(cat)
                    .or_insert(0)
                    += size;
            }
        }

        Ok(())
    }

    fn apply_cpu_result(
        result: &mut ScanResult,
        cpu_result: &PostProcessResult,
        raw_entries: &[RawFileEntry],
        true_empty_dirs: Vec<String>,
        scanned_files: HashMap<String, (u64, i64)>,
    ) {
        result.total_files = cpu_result.total_files;
        result.total_size = cpu_result.total_size;
        result.file_types = cpu_result.file_types.clone();
        result.extension_sizes = cpu_result.extension_sizes.clone();
        result.empty_directories = true_empty_dirs;
        result.subdirectories = cpu_result
            .subdirectories
            .clone()
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

        for info in &cpu_result.largest_files {
            let modified = std::fs::metadata(&info.path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(Self::format_timestamp);

            result.largest_files.push(FileInfo {
                path: info.path.clone(),
                name: info.name.clone(),
                size: info.size,
                modified,
                file_type: "file".to_string(),
                extension: info.extension.clone(),
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

        for entry in walker
            .into_iter()
            .filter_entry(|e| {
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
            if files_scanned.is_multiple_of(8192) {
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

            if !Self::is_within_age_window(&metadata, &ScanOptions {
                min_age_days: query.min_age_days,
                max_age_days: query.max_age_days,
                ..ScanOptions::default()
            }) {
                continue;
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
}