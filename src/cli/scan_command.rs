use crate::animation;
use crate::cli::args::OutputFormat;
use crate::cli::helpers;
use crate::cli::output;
use crate::cli::report;
use crate::cli::scan;
use crate::cli::sink;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::gui_common::ScanReport;
use space_analyzer_pro_desktop::origin_tracer::build_report;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[allow(clippy::too_many_arguments)]
pub struct ScanArgs {
    pub path: Option<String>,
    pub verbose: bool,
    pub max_depth: Option<usize>,
    pub deep: bool,
    pub shallow: bool,
    pub min_size: Option<String>,
    pub max_size: Option<String>,
    pub include_hidden: bool,
    pub threads: usize,
    pub no_gpu: bool,
    pub cache: bool,
    pub export: Option<String>,
    pub report: bool,
    pub report_dir: Option<String>,
    pub clean: bool,
    pub cleanup_recommendations: bool,
    pub trace_origins: bool,
    pub ask: Option<String>,
    pub stream: bool,
    pub progress_json: bool,
    pub files: bool,
    pub log: Option<String>,
    pub output_format: OutputFormat,
    pub top_n: usize,
    pub no_anim: bool,
}

pub fn handle_scan(args: ScanArgs) -> AppResult<()> {
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

    if args.output_format == OutputFormat::Text && !args.no_anim && !args.stream {
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
        true,
        args.log.clone(),
        // Always persist to history so the agentic `ask` loop and History view
        // have data to analyze. The saved record uses a generous
        // largest-files/top-directories cap (see `scan_directory`), matching the
        // GUI. `--save-history` remains accepted (the GUI passes it) but saving
        // is now unconditional for CLI scans, as it was before this refactor.
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
            &depth_label(effective_deep, effective_shallow, effective_max_depth),
        )?;
    }

    if let Some(export_path) = &args.export {
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

    // NOTE: saving to history is handled inside `scan_directory` (when
    // `--save-history` is set) with a generous largest-files/top-directories
    // cap. Do NOT re-save `result` here: `result` is display-bounded by
    // `--top` (default 20), so a second save would overwrite the generous
    // record with a 20-item one and defeat history-based tooling (e.g. the
    // agentic `ask` loop).

    if args.clean {
        crate::cli::dedup::run_clean_analysis(
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
        crate::cli::recommendations::print_cleanup_recommendations(&result);
    }

    if args.trace_origins {
        let max_dirs = args.top_n.max(60);
        let max_files = args.top_n.max(40);
        let origin_report = build_report(&result, max_dirs, max_files);
        crate::cli::origins::print_origin_report(&origin_report, args.no_anim);
    }

    if let Some(question) = &args.ask {
        crate::cli::ai_command::run_ai_question(question, result)?;
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
    result: &ScanReport,
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
