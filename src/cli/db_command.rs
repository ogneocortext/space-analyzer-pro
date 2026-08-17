use crate::cli::args::OutputFormat;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;

pub fn handle_db(
    vacuum: bool,
    info: bool,
    prune_workflows: Option<usize>,
    prune_file_cache: bool,
    prune_disk_space: Option<usize>,
    output_format: OutputFormat,
) -> AppResult<()> {
    if let Ok(db) = Database::default_open() {
        if prune_file_cache {
            match db.prune_orphaned_file_cache() {
                Ok(removed) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"pruned_file_cache": true, "cache_rows_removed": removed})
                        );
                    } else {
                        println!("Removed {} stale file-cache row(s).", removed);
                    }
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"pruned_file_cache": false, "error": e.to_string()})
                        );
                    } else {
                        eprintln!("Failed to prune file cache: {}", e);
                    }
                }
            }
            return Ok(());
        }
        if let Some(keep_hours) = prune_disk_space {
            match db.prune_disk_space_history(keep_hours as u32) {
                Ok(removed) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"pruned_disk_space": true, "disk_records_removed": removed})
                        );
                    } else {
                        println!(
                            "Removed {} disk-space snapshot(s) older than {} hour(s).",
                            removed, keep_hours
                        );
                    }
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"pruned_disk_space": false, "error": e.to_string()})
                        );
                    } else {
                        eprintln!("Failed to prune disk-space history: {}", e);
                    }
                }
            }
            return Ok(());
        }
        if info {
            match db.freelist_info() {
                Ok((free_pages, page_size)) => {
                    let total_pages = db.page_count().unwrap_or(0);
                    let used_pages = total_pages.saturating_sub(free_pages);
                    let mut row_counts = serde_json::Map::new();
                    for (label, table) in [
                        ("scan_history", "scan_history"),
                        ("disk_space_history", "disk_space_history"),
                        ("file_cache", "file_cache"),
                        ("file_embeddings", "file_embeddings"),
                        ("settings", "settings"),
                        ("workflow_executions", "workflow_executions"),
                    ] {
                        if let Ok(c) = db.table_row_count(table) {
                            row_counts.insert(label.to_string(), serde_json::json!(c));
                        }
                    }
                    let response = serde_json::json!({
                        "free_pages": free_pages,
                        "page_size": page_size,
                        "total_pages": total_pages,
                        "used_pages": used_pages,
                        "row_counts": row_counts,
                    });
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&response).unwrap_or_default()
                    );
                }
                Err(e) => eprintln!("Failed to read DB info: {}", e),
            }
            return Ok(());
        }
        if vacuum {
            match db.vacuum() {
                Ok(()) => {
                    let (free_pages, _) = db.freelist_info().unwrap_or((0, 0));
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({"vacuumed": true, "free_pages_after": free_pages})
                        );
                    } else {
                        println!("VACUUM complete. Free pages remaining: {}", free_pages);
                    }
                }
                Err(e) => eprintln!("VACUUM failed: {}", e),
            }
            return Ok(());
        }
        match prune_workflows {
            Some(keep) => match db.prune_workflow_history(keep) {
                Ok(pruned) => {
                    if output_format == OutputFormat::Json {
                        println!(
                            "{}",
                            serde_json::json!({
                                "pruned_workflows": pruned,
                                "retention_limit": keep,
                            })
                        );
                    } else {
                        println!(
                            "Pruned {} workflow execution record(s) (keeping newest {}).",
                            pruned, keep
                        );
                    }
                }
                Err(e) => eprintln!("Failed to prune workflow history: {}", e),
            },
            None => {
                let (free_pages, _) = db.freelist_info().unwrap_or((0, 0));
                if output_format == OutputFormat::Json {
                    println!(
                        "{}",
                        serde_json::json!({
                            "pruned_workflows": 0,
                            "retention_limit": 0,
                            "free_pages": free_pages,
                        })
                    );
                } else {
                    println!(
                        "No workflow-history pruning requested. Free pages: {}",
                        free_pages
                    );
                }
            }
        }
    } else {
        eprintln!("Failed to open database");
    }
    Ok(())
}
