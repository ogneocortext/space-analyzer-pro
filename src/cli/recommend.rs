use clap::Args;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::gui_common::ScanReport;

use crate::cli::args::OutputFormat;
use crate::cli::render;
use crate::cli::types::Recommendation;

/// Arguments for the `recommend` subcommand.
#[derive(Debug, Args)]
pub struct RecommendArgs {
    /// Analyze a specific scan record by id (defaults to the most recent scan)
    #[arg(long)]
    pub scan_id: Option<i64>,

    /// Maximum number of recommendations to return (sorted by priority)
    #[arg(long, default_value = "50")]
    pub top: usize,
}

/// Surface cleanup recommendations for a stored scan using the shared
/// `render::build_recommendations` rule engine — the same logic that powers
/// `scan --cleanup-recommendations` and the human report. This is the backend
/// source of truth the WinUI dashboard now consumes (with a local heuristic
/// fallback when the CLI is unavailable), so the GUI and CLI never diverge on
/// the advice they show.
pub fn run(args: RecommendArgs, output_format: OutputFormat) -> AppResult<()> {
    let mut recommendations: Vec<Recommendation> = Vec::new();
    let mut scan_path = String::new();
    let mut used_scan_id: Option<i64> = None;

    if let Ok(db) = Database::default_open() {
        let target_id = match args.scan_id {
            Some(id) => Some(id),
            None => db.get_latest_scan_id().ok().flatten(),
        };

        if let Some(id) = target_id {
            if let Ok(Some(record)) = db.get_scan_by_id(id) {
                used_scan_id = Some(id);
                scan_path = record.path.clone();

                // Reconstruct a ScanReport from the persisted scan so the
                // recommendation rules (which read path / extension sizes /
                // top directories / largest files) run against real data.
                let report = ScanReport::from_history_record(&record);
                recommendations = render::build_recommendations(&report);
            }
        }
    }

    recommendations.sort_by_key(|r| std::cmp::Reverse(r.priority));
    recommendations.truncate(args.top);

    let response = serde_json::json!({
        "scan_id": used_scan_id,
        "path": scan_path,
        "recommendations": recommendations,
        "count": recommendations.len(),
    });

    if output_format == OutputFormat::Json {
        println!(
            "{}",
            serde_json::to_string_pretty(&response).unwrap_or_default()
        );
    } else if recommendations.is_empty() {
        println!("No cleanup recommendations.");
    } else {
        for rec in &recommendations {
            println!("[{}] {}", rec.priority, rec.message);
        }
    }

    Ok(())
}
