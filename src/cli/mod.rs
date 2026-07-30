pub mod args;
pub mod dedup;
pub mod helpers;
pub mod origins;
pub mod output;
pub mod recommendations;
pub mod report;
pub mod scan;
pub mod types;

use args::{Cli, Commands};
use clap::Parser;
use space_analyzer_pro_desktop::error::AppResult;
use std::fs;
use std::path::Path;

use crate::animation;
use crate::cli::helpers::get_disk_info;

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
        } => {
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

            let result = scan::scan_directory(
                scan_path,
                verbose && output_format != "json" && !no_anim,
                max_depth,
                deep,
                min_size,
                max_size,
                include_hidden,
                no_anim,
            )?;

            if output_format == "text" && !no_anim {
                animation::print_completion_animation(result.duration_secs);
            }

            output_results(&output_format, &result, &path, top_n, no_anim)?;

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

            if let Ok(db) = space_analyzer_pro_desktop::database::Database::default_open() {
                let _ = db.save_scan(&result, deep || verbose);
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
        }

        Commands::DiskInfo { path } => {
            if let Some(disk) = get_disk_info(&path) {
                println!("{}", serde_json::to_string_pretty(&disk).unwrap_or_default());
            } else {
                println!("{}", serde_json::to_string_pretty(&Vec::<()>::new()).unwrap_or_default());
            }
        }

        Commands::History { limit, id } => {
            if let Ok(db) = space_analyzer_pro_desktop::database::Database::default_open() {
                if let Some(scan_id) = id {
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
                    match db.get_scan_history(limit) {
                        Ok(records) => {
                            println!(
                                "{}",
                                serde_json::to_string_pretty(&records).unwrap_or_default()
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
        }

        Commands::Dedup { path } => {
            dedup::run_clean_analysis(&path, &output_format);
        }
    }

    Ok(())
}

fn output_results(
    format: &str,
    result: &space_analyzer_pro_desktop::gui_common::ScanResult,
    path: &str,
    top: usize,
    no_animation: bool,
) -> AppResult<()> {
    match format {
        "text" => output::print_text_results(result, top, false, no_animation),
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
    let settings = space_analyzer_pro_desktop::database::Database::default_open()
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
            let local_db = space_analyzer_pro_desktop::database::Database::default_open().ok();
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
