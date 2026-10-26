use crate::animation;
use crate::cli::args::OutputFormat;
use crate::cli::config::{load_config, resolve_config_path};
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
    pub min_age: Option<u64>,
    pub max_age: Option<u64>,
    pub include_hidden: bool,
    pub follow_symlinks: bool,
    pub threads: usize,
    pub no_gpu: bool,
    pub cache: bool,
    pub dir_cache: bool,
    pub export: Option<String>,
    pub report: bool,
    pub report_dir: Option<String>,
    pub clean: bool,
    pub cleanup_recommendations: bool,
    pub trace_origins: bool,
    pub ask: Option<String>,
    pub stream: bool,
    pub progress_json: bool,
    pub progress_log: Option<String>,
    pub files: bool,
    pub drill: usize,
    pub log: Option<String>,
    pub output_format: OutputFormat,
    pub top_n: usize,
    pub no_anim: bool,
    /// Quiet mode — suppress all non-essential human-facing output.
    pub quiet: bool,
    /// Path to a TOML config file (overrides defaults).
    pub config: Option<String>,
}

pub fn handle_scan(args: ScanArgs) -> AppResult<()> {
    // ── Config file defaults ─────────────────────────────────────────
    // Config file values serve as defaults; explicit CLI flags override them.
    let config = args
        .config
        .as_deref()
        .and_then(|p| load_config(Path::new(p)))
        .or_else(|| resolve_config_path(None).and_then(|p| load_config(&p)));

    let config_format_str = config.as_ref().and_then(|c| c.output_format.as_deref());
    let config_format = config_format_str.and_then(|s| match s {
        "json" => Some(OutputFormat::Json),
        "csv" => Some(OutputFormat::Csv),
        "jsonl" => Some(OutputFormat::Jsonl),
        "md" | "markdown" => Some(OutputFormat::Md),
        "text" => Some(OutputFormat::Text),
        _ => None,
    });
    let effective_format = if args.output_format == OutputFormat::Text {
        // Only override text (the default) if config specifies a format.
        config_format.unwrap_or(args.output_format)
    } else {
        args.output_format
    };
    let config_top = config.as_ref().and_then(|c| c.top).unwrap_or(args.top_n);
    let config_threads = config
        .as_ref()
        .and_then(|c| c.threads)
        .unwrap_or(args.threads);
    let config_no_anim = config
        .as_ref()
        .and_then(|c| c.no_animation)
        .unwrap_or(args.no_anim);
    let config_include_hidden = config
        .as_ref()
        .and_then(|c| c.include_hidden)
        .unwrap_or(args.include_hidden);
    let config_no_gpu = config
        .as_ref()
        .and_then(|c| c.no_gpu)
        .unwrap_or(args.no_gpu);

    sink::route_human_output_to_stderr(effective_format.is_machine_readable() || args.stream);

    // ── Thread pool ──────────────────────────────────────────────────
    // Build the rayon thread pool ONCE per process with the requested thread count.
    if config_threads > 0 {
        if let Err(e) = rayon::ThreadPoolBuilder::new()
            .num_threads(config_threads)
            .build_global()
        {
            if !args.quiet {
                eprintln!(
                    "⚠️ Could not apply --threads {}: {}. Using default thread pool.",
                    config_threads, e
                );
            }
        }
    }

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
    helpers::validate_age_window(args.min_age, args.max_age)?;

    if args.output_format == OutputFormat::Text && !config_no_anim && !args.stream && !args.quiet {
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
        args.verbose && !config_no_anim && !args.stream,
        effective_max_depth,
        effective_deep,
        effective_shallow,
        min_size,
        max_size,
        config_include_hidden,
        args.follow_symlinks,
        config_threads,
        config_no_gpu,
        args.cache,
        args.dir_cache,
        args.stream,
        args.progress_json,
        args.progress_log,
        args.files,
        args.drill,
        config_top,
        true,
        args.log.clone(),
        args.no_anim,
        args.min_age,
        args.max_age,
    )?;

    // A scan that hit many permission-denied errors probably skipped protected
    // system directories (C:\Windows, C:\Program Files, etc.). Surface a warning
    // so the user knows the totals are incomplete and can re-run elevated.
    let permission_errors: Vec<_> = result
        .errors
        .iter()
        .filter(|e| {
            e.contains("Permission denied")
                || e.contains("Access is denied")
                || e.contains("access is denied")
        })
        .collect();
    let permission_error_count = permission_errors.len();
    if permission_error_count >= 5 && !args.quiet {
        eprintln!(
            "⚠️  {} directories were skipped due to permissions. For full coverage, \
             re-run from an elevated (Administrator) terminal.",
            permission_error_count
        );
        for err in permission_errors.iter().take(3) {
            eprintln!("   - {}", err);
        }
        if permission_error_count > 3 {
            eprintln!("   ... and {} more", permission_error_count - 3);
        }
    }

    if effective_format == OutputFormat::Text && !config_no_anim && !args.stream && !args.quiet {
        animation::print_completion_animation(result.duration_secs);
    }

    if !args.stream {
        output_results(
            effective_format,
            &result,
            &scan_path_display,
            args.top_n,
            args.verbose,
            args.no_anim,
            &depth_label(effective_deep, effective_shallow, effective_max_depth),
        )?;
    }

    if let Some(export_path) = &args.export {
        report::export_results(&result, export_path, effective_format, args.top_n)?;
        if !args.quiet {
            eprintln!("✅ Results exported to: {export_path}");
        }
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
        if !args.quiet {
            eprintln!("✅ Report written to: {}", report_path.display());
        }
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
