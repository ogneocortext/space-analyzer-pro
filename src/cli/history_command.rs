use crate::cli::args::OutputFormat;
use scan_engine::format_bytes;
use space_analyzer_pro_desktop::database::Database;
use std::io::IsTerminal;
use space_analyzer_pro_desktop::database::ScanHistoryRecord;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::gui_common::LargestFileEntry;
use space_analyzer_pro_desktop::ollama::client::OllamaClient;
use space_analyzer_pro_desktop::ollama::models::{ScanSummaryInput, ScanSummaryOutput};
use space_analyzer_pro_desktop::ollama::summary::summarize_scan;

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
    summarize: bool,
    include_index_only: bool,
    files: bool,
    calendar: bool,
    yes: bool,
    output_format: OutputFormat,
) -> AppResult<()> {
    if summarize {
        return run_summarize(id, output_format);
    }

    if let Ok(db) = Database::default_open() {
        if trend {
            match db.get_scan_history_trend() {
                Ok(points) => {
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&points).unwrap_or_default()
                    );
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
        if files {
            match db.get_merged_files(search.as_deref(), limit, offset) {
                Ok((entries, total)) => {
                    let response = serde_json::json!({
                        "files": entries,
                        "total": total,
                        "limit": limit,
                        "offset": offset,
                    });
                    println!("{}", serde_json::to_string_pretty(&response).unwrap_or_default());
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!("{}", serde_json::json!({"error": e.to_string()}));
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("Failed to load file inventory: {e}"),
                        ));
                    }
                }
            }
            return Ok(());
        }
        if calendar {
            match db.get_scan_day_counts() {
                Ok(days) => {
                    let response = serde_json::json!({
                        "days": days
                            .into_iter()
                            .map(|(day, count)| serde_json::json!({ "date": day, "count": count }))
                            .collect::<Vec<_>>(),
                    });
                    println!("{}", serde_json::to_string_pretty(&response).unwrap_or_default());
                }
                Err(e) => {
                    if output_format == OutputFormat::Json {
                        println!("{}", serde_json::json!({"error": e.to_string()}));
                    } else {
                        return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                            format!("Failed to load calendar: {e}"),
                        ));
                    }
                }
            }
            return Ok(());
        }
        if category_totals {
            match db.get_category_totals() {
                Ok(totals) => {
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&totals).unwrap_or_default()
                    );
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
            if confirmation_required(yes, output_format) {
                return Ok(());
            }
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
            if confirmation_required(yes, output_format) {
                return Ok(());
            }
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
            if confirmation_required(yes, output_format) {
                return Ok(());
            }
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
            if confirmation_required(yes, output_format) {
                return Ok(());
            }
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
                            println!("{}", serde_json::json!({"error": e.to_string()}));
                        } else {
                            return Err(space_analyzer_pro_desktop::error::AppError::Validation(
                                format!(
                                    "Failed to load duplicate analysis for scan {scan_id}: {e}"
                                ),
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
            match db.get_scan_history_page(
                limit,
                offset,
                search.as_deref(),
                &sort_by,
                sort_asc,
                only_duplicates,
                include_index_only,
            ) {
                Ok((records, total)) => {
                    if output_format == OutputFormat::Text {
                        render_history_page_text(&records, total, limit, offset);
                    } else {
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

/// Parse the `reclaim_tier_sizes_json` blob into (Safe, Caution, Keep) bytes.
fn parse_reclaim_tiers(json: &str) -> (u64, u64, u64) {
    let v: serde_json::Value = serde_json::from_str(json).unwrap_or(serde_json::Value::Null);
    let get = |k: &str| v.get(k).and_then(|x| x.as_u64()).unwrap_or(0);
    (get("Safe"), get("Caution"), get("Keep"))
}

/// Thousands-group a non-negative integer for readable file counts.
fn grouped(n: u64) -> String {
    let s = n.to_string();
    let bytes = s.as_bytes();
    let len = bytes.len();
    let mut out = String::with_capacity(len + len / 3);
    for (i, b) in bytes.iter().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            out.push(',');
        }
        out.push(*b as char);
    }
    out
}

/// Human-readable console table for the scan-history list — the `--format text`
/// default. Mirrors the HistoryPage cards: id, when, path, file/size totals, the
/// Safe/Caution/Keep reclaim tiers, and duplicate / embeddings-only markers.
fn render_history_page_text(records: &[ScanHistoryRecord], total: i64, limit: usize, offset: usize) {
    if records.is_empty() {
        println!("No scan history found.");
        return;
    }

    let tty = std::io::stdout().is_terminal();
    let dim = |s: &str| if tty { format!("\x1b[2m{s}\x1b[0m") } else { s.to_string() };
    let green = |s: &str| if tty { format!("\x1b[32m{s}\x1b[0m") } else { s.to_string() };
    let yellow = |s: &str| if tty { format!("\x1b[33m{s}\x1b[0m") } else { s.to_string() };
    let red = |s: &str| if tty { format!("\x1b[31m{s}\x1b[0m") } else { s.to_string() };

    // Pad a possibly-colored cell using its *visible* (ANSI-stripped) length so
    // colors never break column alignment.
    let pad_vis = |colored: &str, visible: usize, width: usize| -> String {
        if visible >= width {
            colored.to_string()
        } else {
            format!("{colored}{:<width$}", "", width = width - visible)
        }
    };

    // Truncate to `w` chars, appending an ellipsis when cut.
    let trunc = |s: &str, w: usize| -> String {
        let chars: Vec<char> = s.chars().collect();
        if chars.len() <= w {
            format!("{s:<width$}", width = w)
        } else if w <= 1 {
            chars[..w].iter().collect()
        } else {
            let mut t: String = chars[..w - 1].iter().collect();
            t.push('\u{2026}');
            t
        }
    };

    let id_w = 6;
    let date_w = 16;
    let path_w = 46;
    let files_w = 10;
    let size_w = 10;
    let reclaim_w = 34;
    let dup_w = 7;
    let gap = "  ";
    let sep_len = id_w + date_w + path_w + files_w + size_w + reclaim_w + dup_w + gap.len() * 6;

    let header = format!(
        "{:<id_w$}{gap}{:<date_w$}{gap}{:<path_w$}{gap}{:>files_w$}{gap}{:>size_w$}{gap}{:<reclaim_w$}{gap}{:>dup_w$}",
        "ID",
        "DATE",
        "PATH",
        "FILES",
        "SIZE",
        "RECLAIM (safe / caution / keep)",
        "DUP",
        id_w = id_w,
        date_w = date_w,
        path_w = path_w,
        files_w = files_w,
        size_w = size_w,
        reclaim_w = reclaim_w,
        dup_w = dup_w,
        gap = gap,
    );

    println!(
        "{}",
        dim(&format!(
            "SCAN HISTORY  —  showing {}–{} of {}",
            offset + 1,
            offset + records.len(),
            total
        ))
    );
    println!("{header}");
    println!("{}", dim(&"\u{2500}".repeat(sep_len)));

    for rec in records {
        let id_p = format!("{:<id_w$}", rec.id, id_w = id_w);
        let date = rec
            .timestamp
            .get(..16)
            .map(|s| s.replace('T', " "))
            .unwrap_or_else(|| rec.timestamp.clone());
        let date_p = format!("{date:<date_w$}", date_w = date_w);

        // Path, with an [idx] marker for embeddings-only anchors.
        let (path_cell, path_vis) = if rec.is_index_only {
            let t = trunc(&format!("{} [idx]", rec.path), path_w);
            let vis = t.chars().count();
            (dim(&t), vis)
        } else {
            let t = trunc(&rec.path, path_w);
            let vis = t.chars().count();
            (t, vis)
        };
        let path_p = pad_vis(&path_cell, path_vis, path_w);

        let files_p = format!("{:>width$}", grouped(rec.total_files as u64), width = files_w);
        let size_p = format!("{:>width$}", format_bytes(rec.total_size_bytes), width = size_w);

        // Reclaim tiers (Safe / Caution / Keep).
        let (safe, caution, keep) = parse_reclaim_tiers(&rec.reclaim_tier_sizes_json);
        let has = safe > 0 || caution > 0 || keep > 0;
        let plain = if has {
            format!(
                "{} / {} / {}",
                format_bytes(safe),
                format_bytes(caution),
                format_bytes(keep)
            )
        } else {
            "\u{2014}".to_string()
        };
        let cell = if has {
            format!(
                "{} / {} / {}",
                green(&format_bytes(safe)),
                yellow(&format_bytes(caution)),
                red(&format_bytes(keep))
            )
        } else {
            dim("\u{2014}")
        };
        let reclaim_p = pad_vis(&cell, plain.chars().count(), reclaim_w);

        let dup = if rec.duplicate_count > 1 {
            format!("\u{00d7}{}", rec.duplicate_count)
        } else {
            String::new()
        };
        let dup_p = format!("{dup:>width$}", width = dup_w);

        println!(
            "{id_p}{gap}{date_p}{gap}{path_p}{gap}{files_p}{gap}{size_p}{gap}{reclaim_p}{gap}{dup_p}"
        );
    }

    println!("{}", dim(&"\u{2500}".repeat(sep_len)));
    let limit_i = limit.max(1) as i64;
    let pages = (total + limit_i - 1) / limit_i;
    let page = (offset as i64) / limit_i + 1;
    println!(
        "{}",
        dim(&format!(
            "Page {page} of {pages}  ·  --offset/--limit to page  ·  --format json for machine output"
        ))
    );
    println!(
        "{}",
        dim("Safe = safe to delete · Caution = review · Keep = leave · [idx] = embeddings-only anchor")
    );
}

/// Returns true (and emits a refusal message) when a destructive history
/// operation is requested without the confirming `--yes` flag.
fn confirmation_required(yes: bool, output_format: OutputFormat) -> bool {
    if yes {
        return false;
    }
    if output_format == OutputFormat::Json {
        println!(
            "{}",
            serde_json::json!({"error": "confirmation required", "requires_confirmation": true})
        );
    } else {
        eprintln!(
            "Refused: this operation is destructive. Pass --yes (or --assume-yes) to confirm."
        );
    }
    true
}

fn run_summarize(scan_id: Option<i64>, output_format: OutputFormat) -> AppResult<()> {
    let db = Database::default_open().map_err(|e| {
        space_analyzer_pro_desktop::error::AppError::Validation(format!(
            "Failed to open database: {e}"
        ))
    })?;

    let settings = db.load_settings();
    let target_id = match scan_id {
        Some(id) => id,
        None => db
            .get_latest_scan_id()
            .map_err(|e| {
                space_analyzer_pro_desktop::error::AppError::Validation(format!(
                    "Failed to load latest scan: {e}"
                ))
            })?
            .ok_or_else(|| {
                space_analyzer_pro_desktop::error::AppError::Validation(
                    "No scan history found. Run a scan first.".to_string(),
                )
            })?,
    };

    let record = db
        .get_scan_by_id(target_id)
        .map_err(|e| {
            space_analyzer_pro_desktop::error::AppError::Validation(format!(
                "Failed to load scan {target_id}: {e}"
            ))
        })?
        .ok_or_else(|| {
            space_analyzer_pro_desktop::error::AppError::Validation(format!(
                "No scan found with id {target_id}"
            ))
        })?;

    if output_format == OutputFormat::Json {
        println!(
            "{}",
            serde_json::json!({
                "scan_id": target_id,
                "path": record.path,
                "summarize": "requested",
            })
        );
        return Ok(());
    }

    eprintln!("Summarizing scan #{} ({})...", target_id, record.path);

    let top_files: Vec<LargestFileEntry> =
        serde_json::from_str(&record.largest_files_json).unwrap_or_default();
    let file_types: Vec<(String, u64)> =
        serde_json::from_str(&record.extension_sizes_json).unwrap_or_default();

    let input = ScanSummaryInput {
        total_files: record.total_files,
        total_size_bytes: record.total_size_bytes,
        potential_cleanup_bytes: Some(record.potential_cleanup_bytes),
        path: Some(record.path.clone()),
        top_files,
        file_types,
    };

    let rt =
        tokio::runtime::Runtime::new().expect("Failed to create tokio runtime for summarize_scan");

    let client = OllamaClient::new(&settings.ollama_url, &settings.ollama_model).map_err(|e| {
        space_analyzer_pro_desktop::error::AppError::Validation(format!(
            "Failed to create Ollama client: {e}"
        ))
    })?;

    let output: ScanSummaryOutput = rt
        .block_on(summarize_scan(&client, &settings.ollama_model, input))
        .map_err(|e| {
            space_analyzer_pro_desktop::error::AppError::Validation(format!(
                "summarize_scan failed: {e}"
            ))
        })?;

    println!("\n=== Scan Summary ({}) ===", target_id);
    println!("{}", output.summary);
    if !output.key_insights.is_empty() {
        println!("\nKey insights:");
        for insight in &output.key_insights {
            println!("  • {}", insight);
        }
    }
    eprintln!(
        "\nTokens: {} prompt + {} completion in {} ms",
        output.prompt_tokens, output.completion_tokens, output.duration_ms
    );

    Ok(())
}
