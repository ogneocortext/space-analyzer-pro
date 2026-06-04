use super::*;

impl ToolRegistry {
    /// Execute a tool call using the current application state
    pub fn execute_tool(
        &self,
        tool_call: &ToolCall,
        scan_result: Option<&ScanResult>,
        db: Option<&Database>,
    ) -> String {
        let function_name = &tool_call.function.name;
        let args = &tool_call.function.arguments;

        match function_name.as_str() {
            "get_scan_summary" => self.get_scan_summary(scan_result),
            "get_scan_history" => self.get_scan_history(args, db),
            "get_disk_volumes" => self.get_disk_volumes(),
            "get_system_resources" => self.get_system_resources(),
            "get_storage_trend" => self.get_storage_trend(args, db),
            "list_workflows" => self.list_workflows(),
            "get_file_type_breakdown" => self.get_file_type_breakdown(scan_result),
            "predict_storage" => self.predict_storage(args, db),
            "analyze_file_patterns" => self.analyze_file_patterns(scan_result),
            "search_files" => self.search_files(args, scan_result),
            "get_largest_files" => self.get_largest_files(args, scan_result),
            "preview_impact" => self.preview_impact(args),
            "move_to_trash" => self.move_to_trash_preview(args),
            "hardlink_duplicates" => self.hardlink_duplicates_preview(args),
            _ => format!("Unknown tool: {}", function_name),
        }
    }

    // ── Destructive-action preview gate tools (Tier 4) ───────────────
    // These tools are READ-ONLY or PREVIEW-ONLY. Actual destructive
    // actions (moving to trash, hardlinking duplicates) must be
    // confirmed by the user through the GUI's Destructive-Action
    // Preview modal or the Dedup tab. The AI agent cannot perform
    // these actions directly — this is the "destructive-preview gate".

    fn preview_impact(&self, args: &serde_json::Value) -> String {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if path.is_empty() {
            return "Error: 'path' parameter is required.".to_string();
        }
        let report = crate::file_relations::analyze_file_dependencies(path);
        serde_json::to_string_pretty(&report).unwrap_or_else(|_| format!("{:#?}", report))
    }

    fn move_to_trash_preview(&self, args: &serde_json::Value) -> String {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if path.is_empty() {
            return "Error: 'path' parameter is required.".to_string();
        }
        let report = crate::file_relations::analyze_file_dependencies(path);
        format!(
            "PREVIEW ONLY — no filesystem changes made.\n\n\
             Target: {}\n\n\
             {}\n\n\
             To actually move this file to trash, the user must confirm via the GUI:\n\
             Dashboard → Destructive-Action Preview → enter the path → review → click Confirm.\n\
             The AI agent cannot perform destructive actions without explicit user approval.",
            report.target_path, report.summary
        )
    }

    fn hardlink_duplicates_preview(&self, args: &serde_json::Value) -> String {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if path.is_empty() {
            return "Error: 'path' parameter is required.".to_string();
        }
        format!(
            "PREVIEW ONLY — no filesystem changes made.\n\n\
             To hard-link duplicates in '{}', the user must:\n\
             1. Run a deduplication scan via the GUI (Dedup tab)\n\
             2. Review the duplicate groups found\n\
             3. Explicitly click 'Hardlink' on each group\n\n\
             The AI agent cannot perform destructive actions without explicit user approval.\n\
             You can use preview_impact on a specific file to assess the impact of any\n\
             individual file deletion or move.",
            path
        )
    }

    fn get_scan_summary(&self, scan_result: Option<&ScanResult>) -> String {
        if let Some(result) = scan_result {
            let mut summary = format!(
                "Scan of: {}\nTotal files: {}\nTotal size: {:.2} MB\nDuration: {:.2}s\n\n",
                result.path, result.total_files, result.total_size_mb, result.duration_secs
            );
            summary.push_str("File types:\n");
            for (ext, count) in &result.file_types {
                summary.push_str(&format!("  .{}: {} files\n", ext, count));
            }
            if !result.largest_files.is_empty() {
                summary.push_str("\nLargest files:\n");
                for (path, size) in result.largest_files.iter().take(10) {
                    summary.push_str(&format!(
                        "  {} ({})\n",
                        path,
                        formatting::format_bytes(*size)
                    ));
                }
            }
            summary
        } else {
            "No scan results available. Please run a scan first.".to_string()
        }
    }

    fn get_scan_history(&self, args: &serde_json::Value, db: Option<&Database>) -> String {
        let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
        let limit = limit.min(50);
        if let Some(db) = db {
            match db.get_scan_history(limit) {
                Ok(records) => {
                    if records.is_empty() {
                        "No scan history available.".to_string()
                    } else {
                        let mut output = format!("Recent scans ({}):\n", records.len());
                        for record in &records {
                            output.push_str(&format!(
                                "  [{}] {} - {} files, {:.2} MB\n",
                                record.timestamp,
                                record.path,
                                record.total_files,
                                record.total_size_mb
                            ));
                        }
                        output
                    }
                }
                Err(_) => {
                    "Unable to retrieve scan history. The database may be corrupt or unavailable."
                        .to_string()
                }
            }
        } else {
            "Database not available.".to_string()
        }
    }

    fn get_disk_volumes(&self) -> String {
        let volumes = SystemMonitor::get_disk_volumes();
        if volumes.is_empty() {
            "No disk volumes found.".to_string()
        } else {
            let mut output = "Disk volumes:\n".to_string();
            for vol in &volumes {
                let usage_pct = if vol.total_bytes > 0 {
                    (vol.used_bytes as f64 / vol.total_bytes as f64) * 100.0
                } else {
                    0.0
                };
                output.push_str(&format!(
                    "  {} ({}) - {:.1}% used, {} free of {}\n",
                    vol.mount_point,
                    vol.name,
                    usage_pct,
                    formatting::format_bytes(vol.available_bytes),
                    formatting::format_bytes(vol.total_bytes)
                ));
            }
            output
        }
    }

    fn get_system_resources(&self) -> String {
        let resources = SystemMonitor::get_system_resources();
        let swap_pct = if resources.swap_total_bytes > 0 {
            (resources.swap_used_bytes as f64 / resources.swap_total_bytes as f64) * 100.0
        } else {
            0.0
        };
        format!(
            "CPU usage: {:.1}%\nMemory: {:.1}% used ({} / {})\nSwap: {:.1}% used",
            resources.cpu_percent,
            resources.memory_percent,
            formatting::format_bytes(resources.memory_used_bytes),
            formatting::format_bytes(resources.memory_total_bytes),
            swap_pct
        )
    }

    fn get_storage_trend(&self, args: &serde_json::Value, db: Option<&Database>) -> String {
        let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
        if let Some(db) = db {
            match db.get_storage_trend(limit) {
                Ok(trend) => {
                    if trend.is_empty() {
                        "No storage trend data available.".to_string()
                    } else {
                        let mut output = "Storage trend (oldest to newest):\n".to_string();
                        for (timestamp, size) in &trend {
                            output.push_str(&format!(
                                "  {}: {:.2} MB\n",
                                timestamp,
                                *size as f64 / (1024.0 * 1024.0)
                            ));
                        }
                        output
                    }
                }
                Err(_) => "Unable to retrieve storage trend data. The database may be corrupt or unavailable.".to_string(),
            }
        } else {
            "Database not available.".to_string()
        }
    }

    fn list_workflows(&self) -> String {
        let templates = WorkflowTemplates::all_templates();
        let mut output = "Available workflows:\n".to_string();
        for wf in &templates {
            output.push_str(&format!("  {} - {}\n", wf.name, wf.description));
        }
        output
    }

    fn get_file_type_breakdown(&self, scan_result: Option<&ScanResult>) -> String {
        if let Some(result) = scan_result {
            let total: usize = result.file_types.values().sum();
            let mut output = format!("File type breakdown ({} total files):\n", total);
            let mut types_vec: Vec<_> = result.file_types.iter().collect();
            types_vec.sort_by(|a, b| b.1.cmp(a.1));
            for (ext, count) in types_vec {
                let pct = if total > 0 {
                    (*count as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                output.push_str(&format!("  .{}: {} files ({:.1}%)\n", ext, count, pct));
            }
            output
        } else {
            "No scan results available.".to_string()
        }
    }

    fn predict_storage(&self, args: &serde_json::Value, db: Option<&Database>) -> String {
        let days_ahead = args
            .get("days_ahead")
            .and_then(|v| v.as_u64())
            .unwrap_or(30) as usize;
        if let Some(db) = db {
            match db.get_storage_trend(50) {
                Ok(trend) => {
                    if trend.len() < 2 {
                        return "Not enough historical data for prediction. Need at least 2 scans.".to_string();
                    }

                    // Calculate growth rate from trend data using actual timestamps
                    let first_size = trend.first().map(|(_, s)| *s).unwrap_or(0) as f64;
                    let last_size = trend.last().map(|(_, s)| *s).unwrap_or(0) as f64;
                    let total_growth = last_size - first_size;

                    // Parse actual timestamps to compute real days between scans
                    let days_between = if trend.len() >= 2 {
                        let first_ts = trend.first().map(|(ts, _)| ts.as_str()).unwrap_or("");
                        let last_ts = trend.last().map(|(ts, _)| ts.as_str()).unwrap_or("");
                        let first_dt = chrono::DateTime::parse_from_rfc3339(first_ts).ok();
                        let last_dt = chrono::DateTime::parse_from_rfc3339(last_ts).ok();
                        match (first_dt, last_dt) {
                            (Some(f), Some(l)) => {
                                let diff = l.signed_duration_since(f);
                                diff.num_seconds() as f64 / 86400.0
                            }
                            _ => (trend.len() - 1) as f64 * 7.0, // Fallback to weekly assumption
                        }
                    } else {
                        0.0
                    };

                    let daily_growth = if days_between > 0.0 {
                        total_growth / days_between
                    } else {
                        0.0
                    };

                    let predicted_size = last_size + (daily_growth * days_ahead as f64);
                    let growth_rate_mb_per_day = daily_growth / (1024.0 * 1024.0);

                    // Get disk volumes to estimate when disk will be full
                    let volumes = SystemMonitor::get_disk_volumes();
                    let mut disk_full_info = String::new();
                    for vol in &volumes {
                        if daily_growth > 0.0 && vol.available_bytes > 0 {
                            let days_until_full = vol.available_bytes as f64 / daily_growth;
                            disk_full_info.push_str(&format!(
                                "  {}: {:.0} days until full at current growth rate\n",
                                vol.mount_point, days_until_full
                            ));
                        }
                    }

                    format!(
                        "Storage Prediction ({} days ahead):\n\
                         Current total scanned size: {:.2} MB\n\
                         Average daily growth: {:.2} MB/day\n\
                         Predicted size in {} days: {:.2} MB\n\
                         Growth trend: {}\n\n\
                         Disk full estimates:\n{}",
                        days_ahead,
                        last_size / (1024.0 * 1024.0),
                        growth_rate_mb_per_day,
                        days_ahead,
                        predicted_size / (1024.0 * 1024.0),
                        if daily_growth > 0.0 { "Increasing" } else if daily_growth < 0.0 { "Decreasing" } else { "Stable" },
                        if disk_full_info.is_empty() { "  No disk full risk detected\n" } else { &disk_full_info }
                    )
                }
                Err(_) => "Unable to retrieve storage data for prediction. The database may be corrupt or unavailable.".to_string(),
            }
        } else {
            "Database not available. Cannot make predictions without historical data.".to_string()
        }
    }

    fn analyze_file_patterns(&self, scan_result: Option<&ScanResult>) -> String {
        if let Some(result) = scan_result {
            let mut output = String::from("File Pattern Analysis:\n\n");

            // File type concentration
            let total: usize = result.file_types.values().sum();
            let mut dominant_types = Vec::new();
            for (ext, count) in &result.file_types {
                let pct = if total > 0 {
                    (*count as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                if pct > 20.0 {
                    dominant_types.push(format!(".{} ({:.1}%)", ext, pct));
                }
            }
            if !dominant_types.is_empty() {
                output.push_str(&format!(
                    "Dominant file types: {}\n",
                    dominant_types.join(", ")
                ));
            }

            // Large file analysis
            if !result.largest_files.is_empty() {
                let total_large_size: u64 = result.largest_files.iter().map(|(_, s)| *s).sum();
                let large_pct = if result.total_size_bytes > 0 {
                    (total_large_size as f64 / result.total_size_bytes as f64) * 100.0
                } else {
                    0.0
                };
                output.push_str(&format!(
                    "Top {} files account for {:.1}% of total space\n",
                    result.largest_files.len(),
                    large_pct
                ));

                // Extension concentration in large files
                let mut ext_counts = std::collections::HashMap::new();
                for (path, _) in &result.largest_files {
                    if let Some(ext) = path.rsplit('.').next() {
                        *ext_counts.entry(ext.to_lowercase()).or_insert(0) += 1;
                    }
                }
                if !ext_counts.is_empty() {
                    output.push_str("Large files by extension:\n");
                    for (ext, count) in ext_counts.iter().take(5) {
                        output.push_str(&format!("  .{}: {} files\n", ext, count));
                    }
                }
            }

            // Small file analysis: use file type counts to detect small-file-heavy extensions
            let total_large: u64 = result.largest_files.iter().map(|(_, s)| *s).sum();
            let total_counted_files: usize = result.file_types.values().sum();
            if total_counted_files > 0 && total_large == 0 {
                output.push_str(
                    "Note: All files are very small. Consider archiving or compressing.\n",
                );
            }

            output
        } else {
            "No scan results available for pattern analysis.".to_string()
        }
    }

    fn search_files(&self, args: &serde_json::Value, scan_result: Option<&ScanResult>) -> String {
        let Some(result) = scan_result else {
            return "No scan results available. Please run a scan first.".to_string();
        };
        let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
        let ext_filter = args
            .get("extension")
            .and_then(|v| v.as_str())
            .map(|s| s.to_lowercase());
        let keyword = args
            .get("keyword")
            .and_then(|v| v.as_str())
            .map(|s| s.to_lowercase());
        let min_size = args
            .get("min_size_mb")
            .and_then(|v| v.as_u64())
            .map(|mb| mb * 1024 * 1024);
        let max_size = args
            .get("max_size_mb")
            .and_then(|v| v.as_u64())
            .map(|mb| mb * 1024 * 1024);

        let mut matches: Vec<&(String, u64)> = result
            .largest_files
            .iter()
            .filter(|(path, size)| {
                if let Some(ref ext) = ext_filter {
                    if !path.to_lowercase().ends_with(&format!(".{}", ext)) {
                        return false;
                    }
                }
                if let Some(ref kw) = keyword {
                    if !path.to_lowercase().contains(kw) {
                        return false;
                    }
                }
                if let Some(min) = min_size {
                    if *size < min {
                        return false;
                    }
                }
                if let Some(max) = max_size {
                    if *size > max {
                        return false;
                    }
                }
                true
            })
            .take(limit)
            .collect();

        if matches.is_empty() {
            return "No files match the search criteria.".to_string();
        }

        matches.sort_by_key(|b| std::cmp::Reverse(b.1));
        let mut output = format!("Search results ({} files):\n", matches.len());
        for (path, size) in matches {
            output.push_str(&format!(
                "  {} ({})\n",
                path,
                formatting::format_bytes(*size)
            ));
        }
        output
    }

    fn get_largest_files(
        &self,
        args: &serde_json::Value,
        scan_result: Option<&ScanResult>,
    ) -> String {
        let Some(result) = scan_result else {
            return "No scan results available. Please run a scan first.".to_string();
        };
        let count = args.get("count").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
        let count = count.min(100);
        let min_size = args
            .get("min_size_mb")
            .and_then(|v| v.as_u64())
            .map(|mb| mb * 1024 * 1024);

        let files: Vec<&(String, u64)> = result
            .largest_files
            .iter()
            .filter(|(_, size)| min_size.is_none_or(|min| *size >= min))
            .take(count)
            .collect();

        if files.is_empty() {
            return "No files found matching the criteria.".to_string();
        }

        let mut output = format!("Largest files (top {}):\n", files.len());
        for (path, size) in &files {
            output.push_str(&format!(
                "  {} ({})\n",
                path,
                formatting::format_bytes(*size)
            ));
        }
        output
    }
}
