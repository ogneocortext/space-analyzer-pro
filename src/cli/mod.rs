pub mod app_inventory;
pub mod args;
pub mod bloat;
pub mod dedup;
pub mod dependencies;
pub mod helpers;
pub mod live_scan;
pub mod predict;
pub mod semantic;
pub mod sink;
pub mod origins;
pub mod output;
pub mod recommendations;
pub mod render;
pub mod report;
pub mod scan;
pub mod types;
pub mod usn;

use args::{Cli, Commands, OutputFormat};
use clap::Parser;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use std::fs;
use std::path::{Path, PathBuf};

use crate::animation;

pub fn main() -> AppResult<()> {
    let cli = Cli::parse();
    let output_format = cli.format;
    let top_n = cli.top;
    let no_anim = cli.no_animation;
    let yes = cli.yes;

    match cli.command {
        Commands::Scan {
            path,
            path_flag,
            verbose,
            max_depth,
            deep,
            min_size,
            max_size,
            include_hidden,
            threads,
            no_gpu,
            cache,
            export,
            report,
            report_dir,
            clean,
            cleanup_recommendations,
            trace_origins,
            channel,
            ask,
            stream,
            progress_json,
            files,
            save_history,
            shallow,
        } => {
            let args = ScanArgs {
                path: path.or(path_flag),
                verbose,
                max_depth,
                deep,
                shallow,
                min_size,
                max_size,
                include_hidden,
                threads,
                no_gpu,
                cache,
                export,
                report,
                report_dir,
                clean,
                cleanup_recommendations,
                trace_origins,
                channel,
                ask,
                stream,
                progress_json,
                files,
                save_history,
                output_format,
                top_n,
                no_anim,
            };
            handle_scan(args)
        }
        Commands::DiskInfo { path } => handle_disk_info(path),
        Commands::History {
            limit,
            offset,
            search,
            sort_by,
            sort_asc,
            id,
            delete,
            prune,
            drop_relative,
            backfill_categories,
            prune_empty,
            clear,
            only_duplicates,
            trend,
            category_totals,
            duplicates,
        } => handle_history(
            limit,
            offset,
            search,
            sort_by,
            sort_asc,
            id,
            delete,
            prune,
            drop_relative,
            backfill_categories,
            prune_empty,
            clear,
            only_duplicates,
            trend,
            category_totals,
            duplicates,
            output_format,
        ),
        Commands::Dedup {
            path,
            path_flag,
            min_size,
            max_size,
            no_gpu,
            apply,
            scan_id,
        } => {
            sink::route_human_output_to_stderr(output_format.is_machine_readable());
            let path = path.or(path_flag).unwrap_or_else(|| ".".to_string());
            let scan_path = helpers::resolve_scan_path(&path)?;
            let min = min_size
                .as_ref()
                .map(|s| helpers::parse_size(s))
                .transpose()?;
            let max = max_size
                .as_ref()
                .map(|s| helpers::parse_size(s))
                .transpose()?;
            dedup::run_clean_analysis(
                &helpers::display_path(&scan_path),
                output_format,
                min,
                max,
                no_gpu,
                apply,
                yes,
                scan_id,
            )
        }
        Commands::AppInventory => {
            sink::route_human_output_to_stderr(output_format.is_machine_readable());
            app_inventory::handle(output_format)
        }
        Commands::Settings {
            get,
            set,
            key,
            value,
        } => handle_settings(get, set, key, value, output_format),
        Commands::Db {
            vacuum,
            info,
            prune_workflows,
            prune_file_cache,
            prune_disk_space,
        } => handle_db(
            vacuum,
            info,
            prune_workflows,
            prune_file_cache,
            prune_disk_space,
            output_format,
        ),
        Commands::Dependencies { path } => dependencies::run(path, output_format),
        Commands::Embed {
            path,
            scan_id,
            min_size,
            max_size,
            include_hidden,
            no_gpu,
        } => semantic::run_embed(
            path,
            scan_id,
            min_size,
            max_size,
            include_hidden,
            no_gpu,
            output_format,
        ),
        Commands::SemanticSearch {
            query,
            scan_id,
            top,
            min_score,
        } => semantic::run_search(query, scan_id, top, min_score, output_format),
        Commands::Usn { command } => usn::run(command, output_format),
        Commands::Bloat { scan_id, top } => {
            bloat::run(bloat::BloatArgs { scan_id, top }, output_format)
        }
        Commands::Predict { days, limit } => {
            predict::run(predict::PredictArgs { days, limit }, output_format)
        }
    }
}

/// All options for a single `scan` run, gathered into one struct so the entry
/// point no longer threads twenty-something scalar arguments through the call
/// chain.
struct ScanArgs {
    path: Option<String>,
    verbose: bool,
    max_depth: Option<usize>,
    deep: bool,
    shallow: bool,
    min_size: Option<String>,
    max_size: Option<String>,
    include_hidden: bool,
    threads: usize,
    no_gpu: bool,
    cache: bool,
    export: Option<String>,
    report: bool,
    report_dir: Option<String>,
    clean: bool,
    cleanup_recommendations: bool,
    trace_origins: bool,
    channel: Option<String>,
    ask: Option<String>,
    stream: bool,
    progress_json: bool,
    files: bool,
    save_history: bool,
    output_format: OutputFormat,
    top_n: usize,
    no_anim: bool,
}
fn handle_scan(args: ScanArgs) -> AppResult<()> {
    // When stdout must stay a single machine-readable document (any non-text
    // format) or is a streaming JSONL session, every human-facing notice is
    // routed to stderr so it cannot corrupt the data stream.
    sink::route_human_output_to_stderr(args.output_format.is_machine_readable() || args.stream);

    let raw_path = args.path.clone().unwrap_or_else(|| ".".to_string());
    let scan_path: PathBuf = helpers::resolve_scan_path(&raw_path)?;
    let scan_path_display = helpers::display_path(&scan_path);

    let min_size = args
        .min_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;
    let max_size = args
        .max_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;
    helpers::validate_size_window(min_size, max_size)?;

    if args.output_format == OutputFormat::Text && !args.no_anim {
        animation::print_animated_banner();
    }

    let db_settings = Database::default_open()
        .ok()
        .as_ref()
        .map(|db| db.load_settings());

    let effective_max_depth = args.max_depth.or_else(|| {
        db_settings.as_ref().and_then(|s| {
            if s.max_scan_depth == 5 {
                None
            } else {
                Some(s.max_scan_depth as usize)
            }
        })
    });
    let effective_deep = args.deep
        || db_settings
            .as_ref()
            .map(|s| s.default_deep_scan)
            .unwrap_or(false);
    let effective_shallow = args.shallow;

    let result = scan::scan_directory(
        &scan_path,
        args.verbose && !args.no_anim && !args.stream,
        effective_max_depth,
        effective_deep,
        effective_shallow,
        min_size,
        max_size,
        args.include_hidden,
        args.threads,
        args.no_gpu,
        args.cache,
        args.stream,
        args.progress_json,
        args.files,
        args.top_n,
        args.save_history,
        args.no_anim,
    )?;

    if args.output_format == OutputFormat::Text && !args.no_anim && !args.stream {
        animation::print_completion_animation(result.duration_secs);
    }

    if !args.stream {
        output_results(
            args.output_format,
            &result,
            &scan_path_display,
            args.top_n,
            args.verbose,
            args.no_anim,
            &depth_label(
                effective_deep,
                effective_shallow,
                effective_max_depth,
            ),
        )?;
    }

    if let Some(channel_dir) = &args.channel {
        let _ = fs::create_dir_all(channel_dir);
        let target = Path::new(channel_dir).join("scan-channel.json");
        // Reuse the curated, stable projection (rounded floats + human-readable
        // sizes) so the channel file matches `scan --format json` and stays
        // friendly for any script that reads it.
        let channel_payload = report::generate_json_pretty(&result)?;
        fs::write(&target, channel_payload).map_err(|e| {
            space_analyzer_pro_desktop::error::AppError::Validation(format!(
                "Could not write GUI channel file '{}': {}",
                target.display(),
                e
            ))
        })?;
        eprintln!("[CHANNEL] Scan result dropped to: {}", target.display());
    }

    if let Some(export_path) = &args.export {
        // Errors here are real (missing directory, no permission) and must fail
        // the process instead of being swallowed by a bare `if let Err`.
        report::export_results(&result, export_path, args.output_format, args.top_n)?;
        eprintln!("✅ Results exported to: {export_path}");
    }

    if args.report {
        let report_content = report::generate_report(&result, &scan_path_display, args.top_n);
        let reports_dir = match &args.report_dir {
            Some(dir) => PathBuf::from(dir),
            None => Path::new(env!("CARGO_MANIFEST_DIR")).join("reports"),
        };
        fs::create_dir_all(&reports_dir).map_err(|e| {
            space_analyzer_pro_desktop::error::AppError::Validation(format!(
                "Could not create report directory '{}': {}",
                reports_dir.display(),
                e
            ))
        })?;
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let sanitized_path: String = scan_path_display
            .chars()
            .filter(|c| !['\\', '/', ':'].contains(c))
            .collect();
        let path_hash = {
            let mut h: u32 = 0;
            for b in sanitized_path.bytes() {
                h = h.wrapping_mul(31).wrapping_add(b as u32);
            }
            format!("{:08x}", h)
        };
        let report_filename = format!("{}_{}_{}.md", sanitized_path, timestamp, path_hash);
        let report_path = reports_dir.join(&report_filename);
        fs::write(&report_path, &report_content).map_err(|e| {
            space_analyzer_pro_desktop::error::AppError::Validation(format!(
                "Could not write report '{}': {}",
                report_path.display(),
                e
            ))
        })?;
        eprintln!("✅ Report written to: {}", report_path.display());
    }

    if let Ok(db) = Database::default_open() {
        let _ = db.save_scan(
            &result,
            effective_deep,
            effective_shallow,
            effective_max_depth.unwrap_or(5) as u32,
        );
    }

    if args.clean {
        dedup::run_clean_analysis(
            &scan_path_display,
            args.output_format,
            min_size,
            max_size,
            false,
            false,
            true,
            None,
        )?;
    }

    if args.cleanup_recommendations {
        recommendations::print_cleanup_recommendations(&result);
    }

    if args.trace_origins {
        let max_dirs = args.top_n.max(60);
        let max_files = args.top_n.max(40);
        let origin_report =
            space_analyzer_pro_desktop::origin_tracer::build_report(&result, max_dirs, max_files);
        origins::print_origin_report(&origin_report, args.no_anim);
    }

    if let Some(question) = &args.ask {
        run_ai_question(question, result)?;
    }

    Ok(())
}

fn handle_disk_info(path: Option<String>) -> AppResult<()> {
    let disks = match &path {
        Some(p) => {
            let resolved = helpers::resolve_scan_path(p).ok();
            let target = resolved.as_deref().map(helpers::display_path);
            match target {
                Some(t) => helpers::get_disk_info(&t)
                    .into_iter()
                    .collect::<Vec<_>>(),
                None => Vec::new(),
            }
        }
        None => helpers::get_all_disks(),
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&disks).unwrap_or_default()
    );
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn handle_history(
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
                    // A delete that matched no row must surface as an error so
                    // callers don't assume success, and exit non-zero.
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

fn handle_settings(
    get: bool,
    set: bool,
    key: Option<String>,
    value: Option<String>,
    output_format: OutputFormat,
) -> AppResult<()> {
    if let Ok(db) = Database::default_open() {
        if get {
            match db.get_all_settings() {
                Ok(pairs) => {
                    if output_format == OutputFormat::Json {
                        let map: std::collections::BTreeMap<String, String> =
                            pairs.into_iter().collect();
                        println!("{}", serde_json::to_string_pretty(&map).unwrap_or_default());
                    } else {
                        for (k, v) in pairs {
                            println!("{} = {}", k, v);
                        }
                    }
                }
                Err(e) => eprintln!("Failed to read settings: {}", e),
            }
            return Ok(());
        }
        if set {
            match (key, value) {
                (Some(key), Some(value)) => match db.upsert_settings(&[(&key, value)]) {
                    Ok(written) => {
                        if output_format == OutputFormat::Json {
                            println!(
                                "{}",
                                serde_json::json!({"upserted": written, "success": true})
                            );
                        } else {
                            println!("Upserted {} setting(s).", written);
                        }
                    }
                    Err(e) => eprintln!("Failed to update settings: {}", e),
                },
                _ => eprintln!("settings set requires --key and --value"),
            }
            return Ok(());
        }
        eprintln!("Provide --get or --set with --key and --value");
    } else {
        eprintln!("Failed to open database");
    }
    Ok(())
}

fn handle_db(
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
                    // Emit row_counts as a JSON object (label -> count) so it maps
                    // directly onto a Dictionary<string,long> on the C# side.
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

fn depth_label(deep: bool, shallow: bool, max_depth: Option<usize>) -> String {
    if deep {
        "deep (unlimited)".to_string()
    } else if shallow || max_depth == Some(1) {
        "shallow (depth 1)".to_string()
    } else if let Some(d) = max_depth {
        format!("depth {}", d)
    } else {
        "depth 5".to_string()
    }
}

fn output_results(
    format: OutputFormat,
    result: &space_analyzer_pro_desktop::gui_common::ScanReport,
    path: &str,
    top: usize,
    verbose: bool,
    no_animation: bool,
    depth_label: &str,
) -> AppResult<()> {
    match format {
        OutputFormat::Text => {
            output::print_text_results(result, top, verbose, no_animation, depth_label)
        }
        OutputFormat::Json => {
            let json_output = report::generate_json_pretty(result)?;
            println!("{}", json_output);
        }
        OutputFormat::Jsonl => {
            let jsonl_output = report::generate_jsonl(result)?;
            println!("{}", jsonl_output);
        }
        OutputFormat::Csv => output::print_csv(result),
        OutputFormat::Md => {
            let md_report = report::generate_report(result, path, top);
            println!("{}", md_report);
        }
    }
    Ok(())
}

fn run_ai_question(
    question: &str,
    result: space_analyzer_pro_desktop::gui_common::ScanReport,
) -> AppResult<()> {
    let settings = Database::default_open()
        .ok()
        .as_ref()
        .map(|db| db.load_settings())
        .unwrap_or_default();

    let rt =
        tokio::runtime::Runtime::new().expect("Failed to create async runtime for AI question");

    let probe = space_analyzer_pro_desktop::ollama::client::OllamaClient::new(
        &settings.ollama_url,
        "list-models",
    )
    .expect("Failed to create Ollama discovery client");

    let model = rt
        .block_on(probe.list_models())
        .ok()
        .and_then(|models| {
            let local: Vec<_> = models.iter().filter(|m| m.remote_host.is_none()).collect();
            if let Some(m) = local
                .iter()
                .find(|m| m.capabilities.iter().any(|c| c == "tools"))
            {
                return Some(m.name.clone());
            }
            if let Some(m) = local
                .iter()
                .find(|m| m.capabilities.iter().any(|c| c == "completion"))
            {
                return Some(m.name.clone());
            }
            local.first().map(|m| m.name.clone())
        })
        .unwrap_or_else(|| {
            eprintln!(
                "Warning: no Ollama models discovered at {}, falling back to '{}'",
                settings.ollama_url, settings.ollama_model
            );
            settings.ollama_model.clone()
        });

    let registry =
        space_analyzer_pro_desktop::tool_registry::ToolRegistry::new(Some(result.clone()));
    let tools = registry.get_definitions().to_vec();

    let executor: space_analyzer_pro_desktop::ollama::features::ToolExecutor =
        Box::new(move |call| {
            let local_db = Database::default_open().ok();
            let r = registry.execute_tool(call, Some(&result), local_db.as_ref());
            r.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
        });

    let chat_client = probe
        .with_model(&model)
        .expect("Failed to create Ollama client with selected model")
        .with_cache(settings.to_prompt_cache_config());
    match rt.block_on(
        space_analyzer_pro_desktop::ollama::features::agentic_question(
            &chat_client,
            &model,
            question,
            tools,
            executor,
            5,
        ),
    ) {
        Ok(output) => {
            println!("{}", output.final_answer);
            Ok(())
        }
        Err(e) => Err(space_analyzer_pro_desktop::error::AppError::Validation(
            format!("AI question failed: {e}"),
        )),
    }
}
