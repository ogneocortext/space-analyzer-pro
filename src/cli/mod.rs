pub mod args;
pub mod dedup;
pub mod helpers;
pub mod origins;
pub mod output;
pub mod recommendations;
pub mod report;
pub mod scan;
pub mod types;

use args::Cli;
use clap::Parser;
use space_analyzer_pro_desktop::error::AppResult;
use std::fs;
use std::path::Path;

use crate::animation;

pub fn main() -> AppResult<()> {
    let cli = Cli::parse();

    helpers::validate_input(&cli.path, &cli.format)?;

    let min_size = cli
        .min_size
        .as_ref()
        .map(|size| helpers::parse_size(size))
        .transpose()?;

    let max_size = cli
        .max_size
        .as_ref()
        .map(|size| helpers::parse_size(size))
        .transpose()?;

    if cli.format == "text" && !cli.no_animation {
        animation::print_animated_banner();
    }

    let scan_path = Path::new(&cli.path);
    let result = scan::scan_directory(
        scan_path,
        cli.verbose && cli.format != "json" && !cli.no_animation,
        cli.max_depth,
        cli.deep,
        min_size,
        max_size,
        cli.include_hidden,
        cli.no_animation,
    )?;

    if cli.format == "text" && !cli.no_animation {
        animation::print_completion_animation(result.duration_secs);
    }
    match cli.format.as_str() {
        "text" => output::print_text_results(&result, cli.top, cli.verbose, cli.no_animation),
        "json" => {
            let json_output = serde_json::to_string_pretty(&result).unwrap_or_default();
            println!("{}", json_output);
        }
        "jsonl" => {
            let jsonl_output = report::generate_jsonl(&result);
            println!("{}", jsonl_output);
        }
        "csv" => output::print_csv(&result),
        "md" | "markdown" => {
            let md_report = report::generate_report(&result, &cli.path, cli.top);
            println!("{}", md_report);
        }
        _ => unreachable!(),
    }

    if let Some(channel_dir) = &cli.channel {
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

    if let Some(export_path) = &cli.export {
        report::export_results(&result, export_path, &cli.format);
    }

    if cli.report {
        let report_content = report::generate_report(&result, &cli.path, cli.top);
        let reports_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("reports");
        let _ = fs::create_dir_all(&reports_dir);
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let sanitized_path: String = cli
            .path
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
        match fs::write(&report_path, &report_content) {
            Ok(()) => eprintln!("✅ Report written to: {}", report_path.display()),
            Err(e) => eprintln!("❌ Failed to write report: {}", e),
        }
    }

    if let Ok(db) = space_analyzer_pro_desktop::database::Database::default_open() {
        let _ = db.save_scan(&result, cli.deep || cli.verbose);
    }

    if cli.clean {
        dedup::run_clean_analysis(&cli.path);
    }

    if cli.cleanup_recommendations {
        recommendations::print_cleanup_recommendations(&result);
    }

    if cli.trace_origins {
        let max_dirs = cli.top.max(60);
        let max_files = cli.top.max(40);
        let origin_report =
            space_analyzer_pro_desktop::origin_tracer::build_report(&result, max_dirs, max_files);
        origins::print_origin_report(&origin_report, cli.no_animation);
    }

    if let Some(question) = &cli.ask {
        let settings = space_analyzer_pro_desktop::database::Database::default_open()
            .ok()
            .as_ref()
            .map(|db| db.load_settings())
            .unwrap_or_default();

        let rt = tokio::runtime::Runtime::new()
            .expect("Failed to create async runtime for AI question");

        // Discover available models and pick the best one for tool calling
        let probe = space_analyzer_pro_desktop::ollama::client::OllamaClient::new(
            &settings.ollama_url,
            "list-models",
        )
        .expect("Failed to create Ollama discovery client");

        let model = rt
            .block_on(probe.list_models())
            .ok()
            .and_then(|models| {
                // Filter out cloud models, prefer those with "tools" capability
                let local: Vec<_> = models
                    .iter()
                    .filter(|m| m.remote_host.is_none())
                    .collect();
                // 1st choice: any model with "tools" capability
                if let Some(m) = local.iter().find(|m| m.capabilities.iter().any(|c| c == "tools")) {
                    return Some(m.name.clone());
                }
                // 2nd choice: any model with "completion" capability
                if let Some(m) = local.iter().find(|m| m.capabilities.iter().any(|c| c == "completion")) {
                    return Some(m.name.clone());
                }
                // 3rd choice: first available model
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
                if !cli.no_animation {
                    println!("\n{}", output.final_answer);
                } else {
                    println!("{}", output.final_answer);
                }
            }
            Err(e) => eprintln!("AI question failed: {}", e),
        }
    }

    Ok(())
}
