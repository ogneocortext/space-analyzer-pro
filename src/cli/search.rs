use scan_engine::{FileScanner, SearchQuery};
use space_analyzer_pro_desktop::error::AppResult;
use std::io::Write;

use crate::cli::args::{OutputFormat, SearchArgs};
use crate::cli::helpers::{display_path, parse_size, resolve_scan_path, validate_size_window};
use crate::cli::sink;

/// Run a real, bounded filesystem search over a directory tree.
///
/// Unlike the cached `search_files` tool (which only filters the handful of
/// largest files kept in a scan result), this walks the tree and returns every
/// file matching the extension/keyword/size filters, capped at `--limit`. This
/// is the backend the WinUI AI assistant now calls for its `search_files` tool,
/// so a query like "find all .log files" actually inspects the whole subtree.
pub fn run(args: SearchArgs, output_format: OutputFormat) -> AppResult<()> {
    sink::route_human_output_to_stderr(output_format.is_machine_readable());

    let path_raw = args
        .path
        .or(args.path_flag)
        .unwrap_or_else(|| ".".to_string());
    let resolved = resolve_scan_path(&path_raw)?;
    let display = display_path(&resolved);

    let min = args
        .min_size
        .as_deref()
        .map(parse_size)
        .transpose()?;
    let max = args
        .max_size
        .as_deref()
        .map(parse_size)
        .transpose()?;
    validate_size_window(min, max)?;

    let query = SearchQuery {
        extension: args.extension.clone(),
        keyword: args.keyword.clone(),
        min_size: min,
        max_size: max,
        include_hidden: args.include_hidden,
        max_depth: args.max_depth,
        limit: args.limit,
    };

    let scanner = FileScanner::new();
    // When a host process asked for progress (the WinUI AI assistant streams tool
    // progress), emit `__PROGRESS__` lines on stderr as files are scanned so the
    // chat bubble can show "Running search_files — <N> files…" live. The search has
    // no total, so percentage stays 0 and the UI shows the running file count.
    let progress_cb: Option<&dyn Fn(u64)> = if args.progress_json {
        Some(&|n: u64| {
            let json = serde_json::json!({
                "type": "progress",
                "files_scanned": n,
                "percentage": 0.0,
            });
            eprintln!("__PROGRESS__{json}");
            let _ = std::io::stderr().flush();
        })
    } else {
        None
    };
    let result = scanner.search_files_sync(&display, query, progress_cb)?;

    if output_format.is_machine_readable() {
        let response = serde_json::json!({
            "path": display,
            "total_matches": result.total_matches,
            "files_scanned": result.files_scanned,
            "truncated": result.truncated,
            "matches": result.matches,
            "errors": result.errors,
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&response).unwrap_or_default()
        );
    } else if result.matches.is_empty() {
        println!("No files matched in {display} (scanned {} files).", result.files_scanned);
    } else {
        println!(
            "Found {} file(s) in {display} (scanned {} files{}):",
            result.matches.len(),
            result.files_scanned,
            if result.truncated { ", more exist" } else { "" }
        );
        for m in &result.matches {
            let size = scan_engine::format_bytes(m.size);
            let modified = m.modified.as_deref().unwrap_or("-");
            println!("{}\t{}\t{}", m.path, size, modified);
        }
    }

    Ok(())
}
