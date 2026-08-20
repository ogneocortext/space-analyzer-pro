impl FileScanner {
    pub fn scan_with_progress_sync<F>(
        &self,
        path: &str,
        options: ScanOptions,
        progress_callback: F,
        cancel_flag: &AtomicBool,
        mut log: Option<Box<dyn std::io::Write>>,
    ) -> anyhow::Result<ScanResult>
    where
        F: Fn(ScanProgress) + Send + 'static + Clone,
    {
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

        let mut raw_entries: Vec<gpu_compute::scan::RawFileEntry> = Vec::new();
        let mut live_files: Vec<FileInfo> = Vec::new();
        let mut files_scanned: u64 = 0;
        let mut dirs_scanned: u64 = 0;
        let mut current_size: u64 = 0;
        let mut scanned_files = HashMap::new();
        let mut file_type_counts: HashMap<String, u64> = HashMap::new();
        let mut extension_sizes_acc: HashMap<String, u64> = HashMap::new();
        let mut category_sizes_acc: HashMap<String, u64> = HashMap::new();
        let mut entries_processed: u64 = 0;

        if let Some(log) = log.as_mut() {
            let _ = std::writeln!(
                log,
                "{}",
                serde_json::json!({
                    "step": "start",
                    "path": path,
                    "max_depth": options.max_depth,
                    "include_hidden": options.include_hidden,
                })
            );
        }

        if options.num_threads > 0 {
            let _ = rayon::ThreadPoolBuilder::new()
                .num_threads(options.num_threads)
                .build_global();
        }

        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        let mut walk_entries: Vec<walkdir::DirEntry> = Vec::new();
        for entry in walker
            .into_iter()
            .filter_entry(|e| {
                if options.include_hidden || e.depth() == 0 {
                    return true;
                }
                if !e.file_type().is_dir() {
                    return true;
                }
                !Self::dir_entry_is_hidden(e)
            })
        {
            match entry {
                Ok(e) => walk_entries.push(e),
                Err(error) => {
                    // Previously this was `.filter_map(|e| e.ok())`, which silently
                    // dropped traversal errors (permission-denied directories,
                    // broken junctions, etc.) so they never reached `result.errors`
                    // and coverage gaps were invisible. Record them now so a run can
                    // account for every path it failed to read.
                    let msg = format!("Traversal error: {error}");
                    result.errors.push(msg.clone());
                    if let Some(log) = log.as_mut() {
                        let _ = std::writeln!(
                            log,
                            "{}",
                            serde_json::json!({
                                "step": "error",
                                "kind": "traversal",
                                "message": msg,
                            })
                        );
                    }
                }
            }
        }
        let total_estimate = (walk_entries.len() as u64).max(1);
        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        for entry_result in walk_entries {
            if cancel_flag.load(Ordering::Relaxed) {
                let use_gpu =
                    options.gpu_acceleration && gpu_compute::device::GpuInfo::is_available();
                let processor = gpu_compute::scan::GpuScanProcessor::new()
                    .with_gpu(use_gpu)
                    .with_scan_root(path)
                    .with_top_n(100);

                let gpu_result = processor.process(&raw_entries);

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
                result.category_sizes = category_sizes_acc.clone();

                let pct = if total_estimate > 0 {
                    ((entries_processed as f32 / total_estimate as f32) * 100.0).min(99.0)
                } else {
                    0.0
                };
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    progress_callback(ScanProgress {
                        files_scanned: result.total_files,
                        directories_scanned: result.total_directories,
                        total_size: result.total_size,
                        current_file: "Cancelled".to_string(),
                        percentage: pct,
                        completed: true,
                        live_files: live_files.clone(),
                        file_type_counts: file_type_counts.clone(),
                        extension_sizes: extension_sizes_acc.clone(),
                        category_sizes: category_sizes_acc.clone(),
                    });
                }));

                return Ok(result);
            }

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
                    result.errors.push(error_msg.clone());
                    if let Some(log) = log.as_mut() {
                        let kind = if error_msg.starts_with("Permission denied") {
                            "permission_denied"
                        } else {
                            "metadata"
                        };
                        let _ = std::writeln!(
                            log,
                            "{}",
                            serde_json::json!({
                                "step": "error",
                                "kind": kind,
                                "path": path_str,
                                "message": error_msg,
                            })
                        );
                    }
                    entries_processed += 1;
                    continue;
                }
            };

            let is_dir = metadata.is_dir();
            if entry_result.depth() == 1 && is_dir {
                if let Some(log) = log.as_mut() {
                    let _ = std::writeln!(
                        log,
                        "{}",
                        serde_json::json!({ "step": "enter_dir", "path": path_str })
                    );
                }
            }
            let size = allocated_size(&metadata, entry_path);
            let mtime = Self::get_mtime_unix(&metadata);

            if !is_dir {
                if let Some(cache_map) = options.file_cache.as_ref() {
                    if let Some(&(cached_size, cached_mtime)) = cache_map.get(&path_str) {
                        if cached_size == size && cached_mtime == mtime {
                            scanned_files.insert(path_str.clone(), (cached_size, cached_mtime));
                            raw_entries.push(gpu_compute::scan::RawFileEntry {
                                path: path_str.clone(),
                                size: cached_size,
                                is_dir,
                            });
                            if is_dir {
                                dirs_scanned += 1;
                            } else {
                                files_scanned += 1;
                                current_size += cached_size;

                                let p = Path::new(&path_str);
                                let ext = p
                                    .extension()
                                    .and_then(|e| e.to_str())
                                    .unwrap_or("")
                                    .to_lowercase();

                                *file_type_counts.entry(ext.clone()).or_insert(0) += 1;
                                *extension_sizes_acc.entry(ext.clone()).or_insert(0) += cached_size;
                                let cat = extension_to_category(&ext, &path_str);
                                *category_sizes_acc.entry(cat.to_string()).or_insert(0) +=
                                    cached_size;

                                let file_info = FileInfo {
                                    path: path_str.clone(),
                                    name: p
                                        .file_name()
                                        .and_then(|n| n.to_str())
                                        .unwrap_or("")
                                        .to_string(),
                                    size: cached_size,
                                    modified: Self::format_timestamp(
                                        metadata
                                            .modified()
                                            .ok()
                                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                                    ),
                                    file_type: "file".to_string(),
                                    extension: ext.clone(),
                                };
                                live_files.push(file_info.clone());

                                if live_files.len() > 200 {
                                    live_files.sort_by_key(|b| std::cmp::Reverse(b.size));
                                    live_files.truncate(100);
                                }
                            }
                            entries_processed += 1;

                            if entries_processed.is_multiple_of(200) {
                                let pct = if total_estimate > 0 {
                                    ((entries_processed as f32 / total_estimate as f32) * 100.0)
                                        .min(99.0)
                                } else {
                                    0.0
                                };
                                let _ =
                                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                        progress_callback(ScanProgress {
                                            files_scanned,
                                            directories_scanned: dirs_scanned,
                                            total_size: current_size,
                                            current_file: path_str.clone(),
                                            percentage: pct,
                                            completed: false,
                                            live_files: live_files.clone(),
                                            file_type_counts: file_type_counts.clone(),
                                            extension_sizes: extension_sizes_acc.clone(),
                                            category_sizes: category_sizes_acc.clone(),
                                        });
                                    }));
                            }

                            continue;
                        }
                    }
                }
            }

            if !is_dir && !self.should_include_file(&metadata, entry_path, &options) {
                entries_processed += 1;
                continue;
            }

            if is_dir {
                dirs_scanned += 1;
            }

            raw_entries.push(gpu_compute::scan::RawFileEntry {
                path: path_str.clone(),
                size,
                is_dir,
            });

            if !is_dir {
                let ext = entry_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                *file_type_counts.entry(ext.clone()).or_insert(0) += 1;
                *extension_sizes_acc.entry(ext.clone()).or_insert(0) += size;
                let cat = extension_to_category(&ext, &path_str);
                *category_sizes_acc.entry(cat.to_string()).or_insert(0) += size;

                let file_info = FileInfo {
                    path: path_str.clone(),
                    name: entry_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string(),
                    size,
                    modified: Self::format_timestamp(
                        metadata
                            .modified()
                            .ok()
                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                    ),
                    file_type: "file".to_string(),
                    extension: ext,
                };
                live_files.push(file_info.clone());

                if live_files.len() > 200 {
                    live_files.sort_by_key(|b| std::cmp::Reverse(b.size));
                    live_files.truncate(100);
                }

                files_scanned += 1;
                current_size += size;
                scanned_files.insert(path_str.clone(), (size, mtime));
            }

            entries_processed += 1;

            if entries_processed.is_multiple_of(100_000) {
                if let Some(log) = log.as_mut() {
                    let _ = std::writeln!(
                        log,
                        "{}",
                        serde_json::json!({
                            "step": "progress",
                            "entries_processed": entries_processed,
                            "files_scanned": files_scanned,
                            "dirs_scanned": dirs_scanned,
                            "total_size": current_size,
                        })
                    );
                }
            }

            if entries_processed.is_multiple_of(200) {
                let pct = if total_estimate > 0 {
                    ((entries_processed as f32 / total_estimate as f32) * 100.0).min(99.0)
                } else {
                    0.0
                };
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    progress_callback(ScanProgress {
                        files_scanned,
                        directories_scanned: dirs_scanned,
                        total_size: current_size,
                        current_file: path_str.clone(),
                        percentage: pct,
                        completed: false,
                        live_files: live_files.clone(),
                        file_type_counts: file_type_counts.clone(),
                        extension_sizes: extension_sizes_acc.clone(),
                        category_sizes: category_sizes_acc.clone(),
                    });
                }));
            }
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

        result.category_sizes = category_sizes_acc.clone();

        if let Some(log) = log.as_mut() {
            let _ = std::writeln!(
                log,
                "{}",
                serde_json::json!({
                    "step": "complete",
                    "total_files": result.total_files,
                    "total_directories": result.total_directories,
                    "total_size": result.total_size,
                    "error_count": result.errors.len(),
                })
            );
        }

        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            progress_callback(ScanProgress {
                files_scanned: result.total_files,
                directories_scanned: result.total_directories,
                total_size: result.total_size,
                current_file: "Complete".to_string(),
                percentage: 100.0,
                completed: true,
                live_files,
                file_type_counts,
                extension_sizes: extension_sizes_acc,
                category_sizes: category_sizes_acc,
            });
        }));

        Ok(result)
    }

    #[deprecated(
        note = "scan_with_progress has duplicated categorization work and is unused; use scan_with_progress_sync instead"
    )]
    pub async fn scan_with_progress<F>(
        &self,
        path: &str,
        options: ScanOptions,
        progress_callback: F,
        cancel_flag: &AtomicBool,
    ) -> anyhow::Result<ScanResult>
    where
        F: Fn(ScanProgress) + Send + 'static + Clone,
    {
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

        let callback = progress_callback.clone();
        let cancel = cancel_flag;

        let processed_entries = Arc::new(AtomicU64::new(0));
        let processed_entries_clone = processed_entries.clone();

        let current_files = Arc::new(AtomicU64::new(0));
        let current_directories = Arc::new(AtomicU64::new(0));
        let current_size = Arc::new(AtomicU64::new(0));

        let current_files_clone = current_files.clone();
        let current_directories_clone = current_directories.clone();
        let current_size_clone = current_size.clone();

        let mut scanned_files = HashMap::new();

        let total_estimate = Arc::new(AtomicU64::new(1000));
        let total_estimate_clone = total_estimate.clone();

        let mut walker = WalkDir::new(path);
        if let Some(depth) = options.max_depth {
            walker = walker.max_depth(depth);
        }
        if !options.follow_symlinks {
            walker = walker.follow_links(false);
        }

        let mut walk_entries: Vec<walkdir::DirEntry> = Vec::new();
        for entry in walker.into_iter() {
            match entry {
                Ok(e) => walk_entries.push(e),
                // Record traversal errors instead of silently discarding them
                // (mirrors the fix in `scan_with_progress_sync`).
                Err(error) => result.errors.push(format!("Traversal error: {error}")),
            }
        }
        let true_empty_dirs = Self::compute_true_empty_dirs(&walk_entries);

        for entry_result in walk_entries {
            if cancel.load(Ordering::Relaxed) {
                return Err(anyhow::anyhow!("Scan cancelled"));
            }

            let path = entry_result.path();
            let path_str = path.to_string_lossy().to_string();
            let metadata = match entry_result.metadata() {
                Ok(m) => m,
                Err(e) => {
                    result
                        .errors
                        .push(format!("Metadata error: {}: {}", path_str, e));
                    continue;
                }
            };

            let is_file = metadata.is_file();
            let is_dir = metadata.is_dir();
            let size = allocated_size(&metadata, path);
            let mtime = Self::get_mtime_unix(&metadata);

            if !is_dir {
                if let Some(cache_map) = options.file_cache.as_ref() {
                    if let Some(&(cached_size, cached_mtime)) = cache_map.get(&path_str) {
                        if cached_size == size && cached_mtime == mtime {
                            scanned_files.insert(path_str.clone(), (cached_size, cached_mtime));
                            let files_count =
                                current_files_clone.fetch_add(1, Ordering::Relaxed) + 1;
                            let size_count = current_size_clone
                                .fetch_add(cached_size, Ordering::Relaxed)
                                + cached_size;

                            result.total_files = files_count;
                            result.total_size = size_count;

                            let ext = path_str
                                .rsplit('.')
                                .next()
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_lowercase())
                                .unwrap_or_default();
                            *result.file_types.entry(ext.clone()).or_insert(0) += 1;

                            if options.size_buckets {
                                let bucket = size_bucket(cached_size);
                                *result
                                    .size_distribution
                                    .entry(bucket.to_string())
                                    .or_insert(0) += 1;
                            }

                            if result.largest_files.len() < 100
                                || cached_size
                                    > result.largest_files.last().map(|f| f.size).unwrap_or(0)
                            {
                                let file_info = FileInfo {
                                    path: path_str.clone(),
                                    name: path_str
                                        .rsplit(std::path::MAIN_SEPARATOR)
                                        .next()
                                        .unwrap_or("")
                                        .to_string(),
                                    size: cached_size,
                                    modified: std::fs::metadata(&path_str)
                                        .ok()
                                        .and_then(|m| m.modified().ok())
                                        .and_then(Self::format_timestamp),
                                    file_type: "file".to_string(),
                                    extension: ext,
                                };
                                result.largest_files.push(file_info);
                                result
                                    .largest_files
                                    .sort_by_key(|b| std::cmp::Reverse(b.size));
                                result.largest_files.truncate(100);
                            }

                            let processed =
                                processed_entries_clone.fetch_add(1, Ordering::Relaxed) + 1;
                            let total = total_estimate_clone.load(Ordering::Relaxed);
                            if processed > total {
                                total_estimate_clone.store(processed + 1000, Ordering::Relaxed);
                            }

                            let files_scanned = current_files_clone.load(Ordering::Relaxed);
                            let directories_scanned =
                                current_directories_clone.load(Ordering::Relaxed);
                            let total_size = current_size_clone.load(Ordering::Relaxed);
                            let current_total = total_estimate_clone.load(Ordering::Relaxed);

                            let progress = ScanProgress {
                                files_scanned,
                                directories_scanned,
                                total_size,
                                current_file: path_str.clone(),
                                percentage: if current_total > 0 {
                                    ((processed as f32 / current_total as f32) * 100.0).min(99.0)
                                } else {
                                    0.0
                                },
                                completed: false,
                                live_files: Vec::new(),
                                file_type_counts: HashMap::new(),
                                extension_sizes: HashMap::new(),
                                category_sizes: HashMap::new(),
                            };

                            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                callback(progress);
                            }));
                            continue;
                        }
                    }
                }
            }

            let should_process = if is_file {
                self.should_include_file(&metadata, path, &options)
            } else {
                true
            };

            if should_process {
                if is_file {
                    let files_count = current_files_clone.fetch_add(1, Ordering::Relaxed) + 1;
                    let size_count = current_size_clone.fetch_add(size, Ordering::Relaxed) + size;

                    result.total_files = files_count;
                    result.total_size = size_count;

                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    *result.file_types.entry(ext.clone()).or_insert(0) += 1;

                    if options.size_buckets {
                        let bucket = size_bucket(size);
                        *result
                            .size_distribution
                            .entry(bucket.to_string())
                            .or_insert(0) += 1;
                    }

                    if result.largest_files.len() < 100
                        || size > result.largest_files.last().map(|f| f.size).unwrap_or(0)
                    {
                        let file_info = FileInfo {
                            path: path_str.clone(),
                            name: path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_string(),
                            size,
                            modified: Self::format_timestamp(
                                metadata
                                    .modified()
                                    .ok()
                                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                            ),
                            file_type: "file".to_string(),
                            extension: ext,
                        };
                        result.largest_files.push(file_info);
                        result
                            .largest_files
                            .sort_by_key(|b| std::cmp::Reverse(b.size));
                        result.largest_files.truncate(100);
                    }
                } else if is_dir {
                    let dirs_count = current_directories_clone.fetch_add(1, Ordering::Relaxed) + 1;
                    result.total_directories = dirs_count;
                }
            }

            let processed = processed_entries_clone.fetch_add(1, Ordering::Relaxed) + 1;
            let total = total_estimate_clone.load(Ordering::Relaxed);

            if processed > total {
                total_estimate_clone.store(processed + 1000, Ordering::Relaxed);
            }

            let files_scanned = current_files_clone.load(Ordering::Relaxed);
            let directories_scanned = current_directories_clone.load(Ordering::Relaxed);
            let total_size = current_size_clone.load(Ordering::Relaxed);
            let current_total = total_estimate_clone.load(Ordering::Relaxed);

            let progress = ScanProgress {
                files_scanned,
                directories_scanned,
                total_size,
                current_file: if should_process {
                    path_str
                } else {
                    "Skipping".to_string()
                },
                percentage: if current_total > 0 {
                    ((processed as f32 / current_total as f32) * 100.0).min(99.0)
                } else {
                    0.0
                },
                completed: false,
                live_files: Vec::new(),
                file_type_counts: HashMap::new(),
                extension_sizes: HashMap::new(),
                category_sizes: HashMap::new(),
            };

            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                callback(progress);
            }));
        }

        {
            let final_progress = ScanProgress {
                files_scanned: result.total_files,
                directories_scanned: result.total_directories,
                total_size: result.total_size,
                current_file: "Complete".to_string(),
                percentage: 100.0,
                completed: true,
                live_files: Vec::new(),
                file_type_counts: HashMap::new(),
                extension_sizes: HashMap::new(),
                category_sizes: HashMap::new(),
            };

            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                callback(final_progress);
            }));
        }

        result.empty_directories = true_empty_dirs;
        result.scanned_files = scanned_files;

        Ok(result)
    }
}
