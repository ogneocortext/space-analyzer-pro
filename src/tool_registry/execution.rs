use super::*;
use crate::error::AppError;
use crate::gui_common;

impl ToolRegistry {
    /// Execute a tool call using the current application state
    pub fn execute_tool(
        &self,
        tool_call: &ToolCall,
        scan_result: Option<&ScanReport>,
        db: Option<&Database>,
    ) -> Result<String, AppError> {
        let function_name = &tool_call.function.name;
        let args = &tool_call.function.arguments;

        match function_name.as_str() {
            "get_scan_summary" => Ok(self.get_scan_summary(scan_result)),
            "get_scan_history" => self.get_scan_history(args, db),
            "get_disk_volumes" => Ok(self.get_disk_volumes()),
            "get_system_resources" => Ok(self.get_system_resources()),
            "get_storage_trend" => self.get_storage_trend(args, db),
            "list_workflows" => Ok(self.list_workflows()),
            "get_file_type_breakdown" => Ok(self.get_file_type_breakdown(scan_result)),
            "predict_storage" => self.predict_storage(args, db),
            "analyze_file_patterns" => Ok(self.analyze_file_patterns(scan_result)),
            "search_files" => Ok(self.search_files(args, scan_result)),
            "get_largest_files" => Ok(self.get_largest_files(args, scan_result)),
            "preview_impact" => Ok(self.preview_impact(args)),
            "move_to_trash" => Ok(self.move_to_trash_preview(args)),
            "hardlink_duplicates" => Ok(self.hardlink_duplicates_preview(args)),
            _ => Ok(
                serde_json::json!({"error": format!("Unknown tool: {}", function_name)})
                    .to_string(),
            ),
        }
    }

    // ── Destructive-action preview gate tools (Tier 4) ───────────────

    fn preview_impact(&self, args: &serde_json::Value) -> String {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if path.is_empty() {
            return serde_json::json!({"error": "'path' parameter is required."}).to_string();
        }
        let report = crate::file_relations::analyze_file_dependencies(path);
        serde_json::to_string_pretty(&report).unwrap_or_else(|_| format!("{:#?}", report))
    }

    fn move_to_trash_preview(&self, args: &serde_json::Value) -> String {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if path.is_empty() {
            return serde_json::json!({"error": "'path' parameter is required."}).to_string();
        }
        let report = crate::file_relations::analyze_file_dependencies(path);
        serde_json::json!({
            "preview": true,
            "action": "move_to_trash",
            "target_path": report.target_path,
            "summary": report.summary,
            "instructions": "To actually move this file to trash, the user must confirm via the GUI: Dashboard → Destructive-Action Preview → enter the path → review → click Confirm. The AI agent cannot perform destructive actions without explicit user approval."
        }).to_string()
    }

    fn hardlink_duplicates_preview(&self, args: &serde_json::Value) -> String {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if path.is_empty() {
            return serde_json::json!({"error": "'path' parameter is required."}).to_string();
        }
        serde_json::json!({
            "preview": true,
            "action": "hardlink_duplicates",
            "path": path,
            "instructions": [
                "Run a deduplication scan via the GUI (Dedup tab)",
                "Review the duplicate groups found",
                "Explicitly click 'Hardlink' on each group"
            ],
            "note": "The AI agent cannot perform destructive actions without explicit user approval. Use preview_impact on a specific file to assess the impact of any individual file deletion or move."
        }).to_string()
    }

    fn get_scan_summary(&self, scan_result: Option<&ScanReport>) -> String {
        if let Some(result) = scan_result {
            let file_types: Vec<serde_json::Value> = result
                .file_types
                .iter()
                .map(|(ext, count)| serde_json::json!({"extension": ext, "count": count}))
                .collect();
            let largest_files: Vec<serde_json::Value> = result
                .largest_files
                .iter()
                .take(10)
                .map(|file| serde_json::json!({"path": file.path, "size_bytes": file.size}))
                .collect();
            serde_json::json!({
                "path": result.path,
                "total_files": result.total_files,
                "total_size_bytes": result.total_size_bytes,
                "total_size_mb": result.total_size_mb,
                "duration_secs": result.duration_secs,
                "file_types": file_types,
                "largest_files": largest_files
            })
            .to_string()
        } else {
            serde_json::json!({"error": "No scan results available. Please run a scan first."})
                .to_string()
        }
    }

    fn get_scan_history(
        &self,
        args: &serde_json::Value,
        db: Option<&Database>,
    ) -> Result<String, AppError> {
        let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
        let limit = limit.min(50);
        if let Some(db) = db {
            match db.get_scan_history(limit) {
                Ok(records) => {
                    if records.is_empty() {
                        Ok(serde_json::json!({"status": "empty", "message": "No scan history available."}).to_string())
                    } else {
                        let entries: Vec<serde_json::Value> = records
                            .iter()
                            .map(|r| {
                                serde_json::json!({
                                    "timestamp": r.timestamp,
                                    "path": r.path,
                                    "total_files": r.total_files,
                                    "total_size_mb": r.total_size_mb
                                })
                            })
                            .collect();
                        Ok(
                            serde_json::json!({"scans": entries, "count": entries.len()})
                                .to_string(),
                        )
                    }
                }
                Err(e) => Err(AppError::Scanner(e.into())),
            }
        } else {
            Ok(serde_json::json!({"error": "Database not available."}).to_string())
        }
    }

    fn get_disk_volumes(&self) -> String {
        let volumes = SystemMonitor::get_disk_volumes();
        if volumes.is_empty() {
            serde_json::json!({"status": "empty", "message": "No disk volumes found."}).to_string()
        } else {
            let entries: Vec<serde_json::Value> = volumes
                .iter()
                .map(|vol| {
                    let usage_pct = if vol.total_bytes > 0 {
                        (vol.used_bytes as f64 / vol.total_bytes as f64) * 100.0
                    } else {
                        0.0
                    };
                    serde_json::json!({
                        "mount_point": vol.mount_point,
                        "name": vol.name,
                        "total_bytes": vol.total_bytes,
                        "used_bytes": vol.used_bytes,
                        "available_bytes": vol.available_bytes,
                        "used_percent": (usage_pct * 100.0).round() / 100.0
                    })
                })
                .collect();
            serde_json::json!({"volumes": entries}).to_string()
        }
    }

    fn get_system_resources(&self) -> String {
        let resources = SystemMonitor::get_system_resources();
        let swap_pct = if resources.swap_total_bytes > 0 {
            (resources.swap_used_bytes as f64 / resources.swap_total_bytes as f64) * 100.0
        } else {
            0.0
        };
        serde_json::json!({
            "cpu_percent": resources.cpu_percent,
            "memory_percent": resources.memory_percent,
            "memory_used_bytes": resources.memory_used_bytes,
            "memory_total_bytes": resources.memory_total_bytes,
            "swap_used_bytes": resources.swap_used_bytes,
            "swap_total_bytes": resources.swap_total_bytes,
            "swap_percent": (swap_pct * 100.0).round() / 100.0
        })
        .to_string()
    }

    fn get_storage_trend(
        &self,
        args: &serde_json::Value,
        db: Option<&Database>,
    ) -> Result<String, AppError> {
        let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
        if let Some(db) = db {
            match db.get_storage_trend(limit) {
                Ok(trend) => {
                    if trend.is_empty() {
                        Ok(serde_json::json!({"status": "empty", "message": "No storage trend data available."}).to_string())
                    } else {
                        let entries: Vec<serde_json::Value> = trend.iter().map(|(ts, size)| {
                            serde_json::json!({"timestamp": ts, "size_bytes": size})
                        }).collect();
                        Ok(
                            serde_json::json!({"trend": entries, "count": entries.len()})
                                .to_string(),
                        )
                    }
                }
                Err(e) => Err(AppError::Scanner(e.into())),
            }
        } else {
            Ok(serde_json::json!({"error": "Database not available."}).to_string())
        }
    }

    fn list_workflows(&self) -> String {
        let templates = WorkflowTemplates::all_templates();
        let entries: Vec<serde_json::Value> = templates
            .iter()
            .map(|wf| serde_json::json!({"name": wf.name, "description": wf.description}))
            .collect();
        serde_json::json!({"workflows": entries}).to_string()
    }

    fn get_file_type_breakdown(&self, scan_result: Option<&ScanReport>) -> String {
        if let Some(result) = scan_result {
            let total: usize = result.file_types.values().sum();
            let mut types_vec: Vec<_> = result.file_types.iter().collect();
            types_vec.sort_by(|a, b| b.1.cmp(a.1));
            let entries: Vec<serde_json::Value> = types_vec
                .iter()
                .map(|(ext, count)| {
                    let pct = if total > 0 {
                        (**count as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };
                    serde_json::json!({
                        "extension": ext,
                        "count": count,
                        "percent": (pct * 100.0).round() / 100.0
                    })
                })
                .collect();
            serde_json::json!({"total_files": total, "types": entries}).to_string()
        } else {
            serde_json::json!({"error": "No scan results available."}).to_string()
        }
    }

    fn predict_storage(
        &self,
        args: &serde_json::Value,
        db: Option<&Database>,
    ) -> Result<String, AppError> {
        let days_ahead = args
            .get("days_ahead")
            .and_then(|v| v.as_u64())
            .unwrap_or(30) as usize;
        if let Some(db) = db {
            match db.get_storage_trend(50) {
                Ok(trend) => {
                    if trend.len() < 2 {
                        return Ok(
                            serde_json::json!({"error": "Not enough historical data for prediction. Need at least 2 scans."}).to_string(),
                        );
                    }

                    let first_size = trend.first().map(|(_, s)| *s).unwrap_or(0) as f64;
                    let last_size = trend.last().map(|(_, s)| *s).unwrap_or(0) as f64;
                    let total_growth = last_size - first_size;

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
                            _ => (trend.len() - 1) as f64 * 7.0,
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

                    let volumes = SystemMonitor::get_disk_volumes();
                    let mut disk_full_estimates = Vec::new();
                    for vol in &volumes {
                        if daily_growth > 0.0 && vol.available_bytes > 0 {
                            let days_until_full = vol.available_bytes as f64 / daily_growth;
                            disk_full_estimates.push(serde_json::json!({
                                "mount_point": vol.mount_point,
                                "days_until_full": days_until_full.round() as u64
                            }));
                        }
                    }

                    let growth_trend = if daily_growth > 0.0 {
                        "increasing"
                    } else if daily_growth < 0.0 {
                        "decreasing"
                    } else {
                        "stable"
                    };

                    Ok(serde_json::json!({
                        "days_ahead": days_ahead,
                        "current_size_bytes": last_size as u64,
                        "daily_growth_bytes": daily_growth as u64,
                        "predicted_size_bytes": predicted_size as u64,
                        "growth_trend": growth_trend,
                        "disk_full_estimates": disk_full_estimates
                    })
                    .to_string())
                }
                Err(e) => Err(AppError::Scanner(e.into())),
            }
        } else {
            Ok(
                serde_json::json!({"error": "Database not available. Cannot make predictions without historical data."}).to_string(),
            )
        }
    }

    fn analyze_file_patterns(&self, scan_result: Option<&ScanReport>) -> String {
        if let Some(result) = scan_result {
            let total: usize = result.file_types.values().sum();

            let mut dominant_types = Vec::new();
            for (ext, count) in &result.file_types {
                let pct = if total > 0 {
                    (*count as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                if pct > 20.0 {
                    dominant_types.push(serde_json::json!({
                        "extension": ext,
                        "percent": (pct * 100.0).round() / 100.0,
                        "count": count
                    }));
                }
            }

            let top_files_concentration = if !result.largest_files.is_empty() {
                let total_large_size: u64 = result.largest_files.iter().map(|f| f.size).sum();
                let large_pct = if result.total_size_bytes > 0 {
                    (total_large_size as f64 / result.total_size_bytes as f64) * 100.0
                } else {
                    0.0
                };
                Some(serde_json::json!({
                    "count": result.largest_files.len(),
                    "total_size_bytes": total_large_size,
                    "percent_of_total": (large_pct * 100.0).round() / 100.0
                }))
            } else {
                None
            };

            let mut large_by_ext = Vec::new();
            if !result.largest_files.is_empty() {
                let mut ext_counts = std::collections::HashMap::new();
                for file in &result.largest_files {
                    if let Some(ext) = file.path.rsplit('.').next() {
                        *ext_counts.entry(ext.to_lowercase()).or_insert(0) += 1;
                    }
                }
                for (ext, count) in ext_counts.iter().take(5) {
                    large_by_ext.push(serde_json::json!({"extension": ext, "count": count}));
                }
            }

            let total_large: u64 = result.largest_files.iter().map(|f| f.size).sum();
            let total_counted_files: usize = result.file_types.values().sum();
            let mut notes = Vec::new();
            if total_counted_files > 0 && total_large == 0 {
                notes.push("All files are very small. Consider archiving or compressing.");
            }

            serde_json::json!({
                "dominant_file_types": dominant_types,
                "top_files_concentration": top_files_concentration,
                "large_files_by_extension": large_by_ext,
                "notes": notes
            })
            .to_string()
        } else {
            serde_json::json!({"error": "No scan results available for pattern analysis."})
                .to_string()
        }
    }

    fn search_files(&self, args: &serde_json::Value, scan_result: Option<&ScanReport>) -> String {
        let Some(result) = scan_result else {
            return serde_json::json!({"error": "No scan results available. Please run a scan first."}).to_string();
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

        let mut matches: Vec<&gui_common::LargestFileEntry> = result
            .largest_files
            .iter()
            .filter(|file| {
                if let Some(ref ext) = ext_filter {
                    if !file.path.to_lowercase().ends_with(&format!(".{}", ext)) {
                        return false;
                    }
                }
                if let Some(ref kw) = keyword {
                    if !file.path.to_lowercase().contains(kw) {
                        return false;
                    }
                }
                if let Some(min) = min_size {
                    if file.size < min {
                        return false;
                    }
                }
                if let Some(max) = max_size {
                    if file.size > max {
                        return false;
                    }
                }
                true
            })
            .take(limit)
            .collect();

        if matches.is_empty() {
            return serde_json::json!({"status": "empty", "message": "No files match the search criteria."}).to_string();
        }

        matches.sort_by_key(|b| std::cmp::Reverse(b.size));
        let entries: Vec<serde_json::Value> = matches
            .iter()
            .map(|file| serde_json::json!({"path": file.path, "size_bytes": file.size}))
            .collect();
        serde_json::json!({"results": entries, "count": entries.len()}).to_string()
    }

    fn get_largest_files(
        &self,
        args: &serde_json::Value,
        scan_result: Option<&ScanReport>,
    ) -> String {
        let Some(result) = scan_result else {
            return serde_json::json!({"error": "No scan results available. Please run a scan first."}).to_string();
        };
        let count = args.get("count").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
        let count = count.min(100);
        let min_size = args
            .get("min_size_mb")
            .and_then(|v| v.as_u64())
            .map(|mb| mb * 1024 * 1024);

        let files: Vec<&gui_common::LargestFileEntry> = result
            .largest_files
            .iter()
            .filter(|file| min_size.is_none_or(|min| file.size >= min))
            .take(count)
            .collect();

        if files.is_empty() {
            return serde_json::json!({"status": "empty", "message": "No files found matching the criteria."}).to_string();
        }

        let entries: Vec<serde_json::Value> = files
            .iter()
            .map(|file| serde_json::json!({"path": file.path, "size_bytes": file.size}))
            .collect();
        serde_json::json!({"files": entries, "count": entries.len()}).to_string()
    }
}
