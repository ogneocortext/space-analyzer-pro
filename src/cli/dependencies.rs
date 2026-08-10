//! `dependencies` subcommand: analyze file relationships and deletion impact.

use crate::cli::args::OutputFormat;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::file_relations::analyze_file_dependencies;

/// Run the `dependencies` subcommand and emit a dependency/impact report.
pub fn run(path: String, format: OutputFormat) -> AppResult<()> {
    let report = analyze_file_dependencies(&path);
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&report).unwrap_or_default());
        }
        _ => {
            println!("{}", report.summary);
        }
    }
    Ok(())
}
