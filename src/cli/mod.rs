pub mod args;
pub mod dedup;
pub mod helpers;
pub mod origins;
pub mod output;
pub mod recommendations;
pub mod render;
pub mod report;
pub mod scan;
pub mod types;

use args::{Cli, Commands};
use clap::Parser;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use std::fs;
use std::path::Path;

use crate::animation;

pub fn main() -> AppResult<()> {
    let cli = Cli::parse();
    let output_format = cli.format.clone();
    let top_n = cli.top;
    let no_anim = cli.no_animation;

    match cli.command {
        Commands::Scan {
            path,
            verbose,
            max_depth,
            deep,
            ref min_size,
            ref max_size,
            include_hidden,
            ref export,
            report,
            clean,
            cleanup_recommendations,
            trace_origins,
            ref channel,
            ref ask,
            shallow,
            threads,
            cache,
            stream,
        } => handle_scan(
            path,
            verbose,
            max_depth,
            deep,
            min_size,
            max_size,
            include_hidden,
            export,
            report,
            clean,
            cleanup_recommendations,
            trace_origins,
            channel,
            ask,
            shallow,
            threads,
            cache,
            stream,
            output_format,
            top_n,
            no_anim,
        ),
        Commands::DiskInfo { .. } => handle_disk_info(),
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
            output_format,
        ),
        Commands::Dedup { path } => {
            dedup::run_clean_analysis(&path, &output_format);
            Ok(())
        }
        Commands::Settings {
            get,
            set,
            key,
            value,
        } => handle_settings(get, set, key, value, &output_format),
        Commands::Db {
            vacuum,
            info,
            prune_workflows,
        } => handle_db(vacuum, info, prune_workflows, &output_format),
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_scan(
    path: String,
    verbose: bool,
    max_depth: Option<usize>,
    deep: bool,
    min_size: &Option<String>,
    max_size: &Option<String>,
    include_hidden: bool,
    export: &Option<String>,
    report: bool,
    clean: bool,
    cleanup_recommendations: bool,
    trace_origins: bool,
    channel: &Option<String>,
    ask: &Option<String>,
    shallow: bool,
    threads: usize,
    cache: bool,
    stream: bool,
    output_format: String,
    top_n: usize,
    no_anim: bool,
) -> AppResult<()> {
    let scan_path = Path::new(&path);
    helpers::validate_input(&path, &output_format)?;

    let min_size = min_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;
    let max_size = max_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;

    if output_format == "text" && !no_anim {
        animation::print_animated_banner();
    }

    let db_settings = Database::default_open()
        .ok()
        .as_ref()
        .map(|db| db.load_settings());

    let effective_max_depth = max_depth.or_else(|| {
        db_settings.as_ref().and_then(|s| {
            if s.max_scan_depth == 5 {
                None
            } else {
                Some(s.max_scan_depth as usize)
            }
        })
    });
    let effective_deep = deep
        || db_settings
            .as_ref()
            .map(|s| s.default_deep_scan)
            .unwrap_or(false);
    let effective_shallow = shallow;

    let result = scan::scan_directory(
        scan_path,
        verbose && output_format != "json" && !no_anim,
        effective_max_depth,
        effective_deep,
        effective_shallow,
        min_size,
        max_size,
        include_hidden,
        threads,
        cache,
        stream,
    )?;

    if output_format == "text" && !no_anim && !stream {
        animation::print_completion_animation(result.duration_secs);
    }

    if !stream {
        output_results(
            &output_format,
            &result,
            &path,
            top_n,
            no_anim,
            &depth_label(effective_deep, effective_shallow, effective_max_depth),
        )?;
    }

    if let Some(channel_dir) = channel {
        let payload = serde_json::json!({
            "path": scan_path.to_string_lossy().to_string(),
            "total_files": result.total_files,
            "total_size_bytes": result.total_size_bytes,
            "total_size_mb": result.total_size_mb,
            "duration_secs": result.duration_secs,
            "file_types": result.file_types,
            "extension_sizes": result.extension_sizes,
            "top_directories": result.top_directories,
            "largest_files": result.largest_files,
        });
        let _ = fs::create_dir_all(channel_dir);
        let target = std::path::Path::new(channel_dir).join("scan-channel.json");
        let _ = fs::write(
            &target,
            serde_json::to_string_pretty(&payload).unwrap_or_default(),
        );
        eprintln!("[CHANNEL] Scan result dropped to: {}", target.display());
    }

    if let Some(export_path) = export {
        report::export_results(&result, export_path, &output_format);
    }

    if report {
        let report_content = report::generate_report(&result, &path, top_n);
        let reports_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("reports");
        let _ = fs::create_dir_all(&reports_dir);
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let sanitized_path: String = path
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
        if let Err(e) = fs::write(&report_path, &report_content) {
            eprintln!("❌ Failed to write report: {}", e);
        } else {
            eprintln!("✅ Report written to: {}", report_path.display());
        }
    }

    if let Ok(db) = Database::default_open() {
        let _ = db.save_scan(
            &result,
            effective_deep,
            effective_shallow,
            effective_max_depth.unwrap_or(5) as u32,
        );
    }

    if clean {
        dedup::run_clean_analysis(&path, &output_format);
    }

    if cleanup_recommendations {
        recommendations::print_cleanup_recommendations(&result);
    }

    if trace_origins {
        let max_dirs = top_n.max(60);
        let max_files = top_n.max(40);
        let origin_report =
            space_analyzer_pro_desktop::origin_tracer::build_report(&result, max_dirs, max_files);
        origins::print_origin_report(&origin_report, no_anim);
    }

    if let Some(question) = ask {
        run_ai_question(question, result)?;
    }

    Ok(())
}

fn handle_disk_info() -> AppResult<()> {
    let disks = helpers::get_all_disks();
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
    output_format: String,
) -> AppResult<()> {
    if let Ok(db) = Database::default_open() {
        if prune {
            match db.prune_duplicate_scans() {
                Ok(duplicates_removed) => {
                    let relative_removed = if drop_relative {
                        db.prune_relative_scan_paths().unwrap_or(0)
                    } else {
                        0
                    };
                    let _ = db.vacuum();
                    if output_format == "json" {
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
                    if output_format == "json" {
                        println!(
                            "{}",
                            serde_json::json!({"pruned": false, "error": e.to_string()})
                        );
                    } else {
                        eprintln!("Failed to prune scan history: {}", e);
                    }
                }
            }
        } else if let Some(scan_id) = delete {
            match db.delete_scan(scan_id) {
                Ok(count) if count > 0 => {
                    if output_format == "json" {
                        println!(
                            "{}",
                            serde_json::json!({"deleted": true, "id": scan_id, "count": count})
                        );
                    } else {
                        println!("Deleted scan record {}.", scan_id);
                    }
                }
                Ok(_) => {
                    if output_format == "json" {
                        println!(
                            "{}",
                            serde_json::json!({"deleted": false, "id": scan_id, "error": "No scan found"})
                        );
                    } else {
                        eprintln!("No scan found with id {}", scan_id);
                    }
                }
                Err(e) => {
                    if output_format == "json" {
                        println!(
                            "{}",
                            serde_json::json!({"deleted": false, "id": scan_id, "error": e.to_string()})
                        );
                    } else {
                        eprintln!("Failed to delete scan {}: {}", scan_id, e);
                    }
                }
            }
        } else if let Some(scan_id) = id {
            match db.get_scan_by_id(scan_id) {
                Ok(Some(record)) => {
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&record).unwrap_or_default()
                    );
                }
                Ok(None) => {
                    eprintln!("No scan found with id {}", scan_id);
                }
                Err(e) => {
                    eprintln!("Failed to load scan {}: {}", scan_id, e);
                }
            }
        } else {
            match db.get_scan_history_page(limit, offset, search.as_deref(), &sort_by, sort_asc) {
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
                    eprintln!("Failed to load history: {}", e);
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
    output_format: &str,
) -> AppResult<()> {
    if let Ok(db) = Database::default_open() {
        if get {
            match db.get_all_settings() {
                Ok(pairs) => {
                    if output_format == "json" {
                        let map: std::collections::BTreeMap<String, String> =
                            pairs.into_iter().collect();
                        println!("{}", serde_json::to_string(&map).unwrap_or_default());
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
                        if output_format == "json" {
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
    prune_workflows: usize,
    output_format: &str,
) -> AppResult<()> {
    if let Ok(db) = Database::default_open() {
        if info {
            match db.freelist_info() {
                Ok((free_pages, page_size)) => {
                    let total_pages = db.page_count().unwrap_or(0);
                    let used_pages = total_pages.saturating_sub(free_pages);
                    let row_counts: Vec<(String, i64)> = [
                        ("scan_history", "scan_history"),
                        ("disk_space_history", "disk_space_history"),
                        ("settings", "settings"),
                        ("workflow_executions", "workflow_executions"),
                    ]
                    .iter()
                    .filter_map(|(label, table)| {
                        db.table_row_count(table)
                            .ok()
                            .map(|c| (label.to_string(), c))
                    })
                    .collect();
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
                    if output_format == "json" {
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
        match db.prune_workflow_history(prune_workflows) {
            Ok(pruned) => {
                if output_format == "json" {
                    println!(
                        "{}",
                        serde_json::json!({
                            "pruned_workflows": pruned,
                            "retention_limit": prune_workflows,
                        })
                    );
                } else {
                    println!(
                        "Pruned {} workflow execution record(s) (keeping newest {}).",
                        pruned, prune_workflows
                    );
                }
            }
            Err(e) => eprintln!("Failed to prune workflow history: {}", e),
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
    format: &str,
    result: &space_analyzer_pro_desktop::gui_common::ScanResult,
    path: &str,
    top: usize,
    no_animation: bool,
    depth_label: &str,
) -> AppResult<()> {
    match format {
        "text" => output::print_text_results(result, top, false, no_animation, depth_label),
        "json" => {
            let json_output = serde_json::to_string_pretty(result).unwrap_or_default();
            println!("{}", json_output);
        }
        "jsonl" => {
            let jsonl_output = report::generate_jsonl(result);
            println!("{}", jsonl_output);
        }
        "csv" => output::print_csv(result),
        "md" | "markdown" => {
            let md_report = report::generate_report(result, path, top);
            println!("{}", md_report);
        }
        _ => unreachable!(),
    }
    Ok(())
}

fn run_ai_question(
    question: &str,
    result: space_analyzer_pro_desktop::gui_common::ScanResult,
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
        .expect("Failed to create Ollama client with selected model");
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
        }
        Err(e) => eprintln!("AI question failed: {}", e),
    }

    Ok(())
}
