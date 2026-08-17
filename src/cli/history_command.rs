use crate::cli::args::OutputFormat;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;

#[allow(clippy::too_many_arguments)]
pub fn handle_history(
    limit: usize,
    offset: usize,
    search: Option<String>,
    sort_by: String,
    sort_asc: bool,
    id: Option<i64>,
    delete: Option<i64>,
    prune: bool,
    drop_relative: bool,
    backfill_categories: bool,
    prune_empty: bool,
    clear: bool,
    only_duplicates: bool,
    trend: bool,
    category_totals: bool,
    duplicates: bool,
    output_format: OutputFormat,
) -> AppResult<()> {
    if let Ok(db) = Database::default_open() {
        if trend {
            match db.get_scan_history_trend() {
                Ok(points) => {
                    println!("{}", serde_json::to_string_pretty(&points).unwrap_or_default());
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!("{}", serde_json::json!({"error": e.to_string()}));
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("Failed to load trend: {e}"),
                        ));
                    }
                }
            }
            return Ok(());
        }
        if category_totals {
            match db.get_category_totals() {
                Ok(totals) => {
                    println!("{}", serde_json::to_string_pretty(&totals).unwrap_or_default());
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!("{}", serde_json::json!({"error": e.to_string()}));
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("Failed to load category totals: {e}"),
                        ));
                    }
                }
            }
            return Ok(());
        }
        if backfill_categories {
            match db.backfill_category_sizes() {
                Ok(n) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"backfilled": true, "records_updated": n})
                        );
                    } else {
                        println!("Back-filled category sizes for {} record(s).", n);
                    }
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"backfilled": false, "error": e.to_string()})
                        );
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("Category back-fill failed: {e}"),
                        ));
                    }
                }
            }
            return Ok(());
        }
        if prune {
            match db.prune_duplicate_scans() {
                Ok(duplicates_removed) => {
                    let relative_removed = if drop_relative {
                        db.prune_relative_scan_paths().unwrap_or(0)
                    } else {
                        0
                    };
                    let _ = db.vacuum();
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({
                                "pruned": true,
                                "duplicate_records_removed": duplicates_removed,
                                "relative_path_records_removed": relative_removed,
                            })
                        );
                    } else {
                        println!("Pruned {} duplicate scan record(s).", duplicates_removed);
                        if relative_removed > 0 {
                            println!(
                                "Removed {} record(s) with non-absolute paths.",
                                relative_removed
                            );
                        }
                        let (free, _) = db.freelist_info().unwrap_or((0, 0));
                        if free > 0 {
                            println!("Free pages remaining: {}", free);
                        }
                    }
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"pruned": false, "error": e.to_string()})
                        );
                    } else {
                        eprintln!("Failed to prune scan history: {}", e);
                    }
                }
            }
        } else if prune_empty {
            match db.prune_empty_scans() {
                Ok(removed) => {
                    let _ = db.vacuum();
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"pruned_empty": true, "empty_records_removed": removed})
                        );
                    } else {
                        println!("Removed {} empty scan record(s).", removed);
                    }
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"pruned_empty": false, "error": e.to_string()})
                        );
                    } else {
                        eprintln!("Failed to prune empty scan records: {}", e);
                    }
                }
            }
        } else if clear {
            match db.clear_history() {
                Ok(removed) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"cleared": true, "records_removed": removed})
                        );
                    } else {
                        println!("Cleared all scan history ({} record(s) removed).", removed);
                    }
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"cleared": false, "error": e.to_string()})
                        );
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("Failed to clear history: {e}"),
                        ));
                    }
                }
            }
        } else if let Some(scan_id) = delete {
            match db.delete_scan(scan_id) {
                Ok(count) if count > 0 => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"deleted": true, "id": scan_id, "count": count})
                        );
                    } else {
                        println!("Deleted scan record {}.", scan_id);
                    }
                }
                Ok(_) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"deleted": false, "id": scan_id, "error": "No scan found"})
                        );
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("No scan found with id {scan_id}"),
                        ));
                    }
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"deleted": false, "id": scan_id, "error": e.to_string()})
                        );
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("Failed to delete scan {scan_id}: {e}"),
                        ));
                    }
                }
            }
        } else if let Some(scan_id) = id {
            if duplicates {
                match db.get_duplicate_analysis(scan_id) {
                    Ok(records) => {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&records).unwrap_or_default()
                        );
                    }
                    Err(e) => {
                        if output_format == OutputFormat::Json {
                            println!(
                                "{}",
                                serde_json::json!({"error": e.to_string()})
                            );
                        } else {
                            return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                                format!("Failed to load duplicate analysis for scan {scan_id}: {e}"),
                            ));
                        }
                    }
                }
            } else {
            match db.get_scan_by_id(scan_id) {
                Ok(Some(record)) => {
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&record).unwrap_or_default()
                    );
                }
                Ok(None) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"error": format!("No scan found with id {scan_id}")})
                        );
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("No scan found with id {scan_id}"),
                        ));
                    }
                }
                Err(e) => {
                    return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                        format!("Failed to load scan {scan_id}: {e}"),
                    ));
                }
            }
        }
        } else {
            match db.get_scan_history_page(limit, offset, search.as_deref(), &sort_by, sort_asc, only_duplicates) {
                Ok((records, total)) => {
                    let response = serde_json::json!({
                        "records": records,
                        "total": total,
                        "limit": limit,
                        "offset": offset,
                    });
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&response).unwrap_or_default()
                    );
                }
                Err(e) => {
                    return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                        format!("Failed to load history: {e}"),
                    ));
                }
            }
        }
    } else {
        eprintln!("Failed to open database");
    }
    Ok(())
}
