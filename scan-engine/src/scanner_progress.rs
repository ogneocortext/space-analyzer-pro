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
                            }
                            entries_processed += 1;

                            if entries_processed.is_multiple_of(5_000) {
                                // Sort + truncate once per callback instead of on every
                                // push — live_files is only consumed here, so sorting
                                // 1.5M times was pure waste.
                                live_files.sort_by_key(|b| std::cmp::Reverse(b.size));
                                live_files.truncate(100);
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

            if entries_processed.is_multiple_of(5_000) {
                // Sort + truncate once per callback instead of on every push.
                live_files.sort_by_key(|b| std::cmp::Reverse(b.size));
                live_files.truncate(100);
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
                live_files,
                file_type_counts,
                extension_sizes: extension_sizes_acc,
                category_sizes: category_sizes_acc,
            });
        }));

        Ok(result)
    }
}
