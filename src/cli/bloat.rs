use clap::Args;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::gui_common::{DirEntry, LargestFileEntry};
use space_analyzer_pro_desktop::offline_ai::FilePatternClassifier;

use crate::cli::args::OutputFormat;

/// Arguments for the `bloat` subcommand.
#[derive(Debug, Args)]
pub struct BloatArgs {
    /// Analyze a specific scan record by id (defaults to the most recent scan)
    #[arg(long)]
    pub scan_id: Option<i64>,

    /// Maximum number of bloat findings to return (sorted by size, descending)
    #[arg(long, default_value = "15")]
    pub top: usize,
}

/// A single bloat candidate surfaced from a stored scan.
#[derive(Debug, serde::Serialize)]
struct BloatFinding {
    category: String,
    description: String,
    path: String,
    size: u64,
    priority: i32,
}

/// Detect bloat candidates in a stored scan using the Rust `offline_ai`
/// classifier. Mirrors the WinUI "Bloat Detection" dashboard card: it loads the
/// target scan's largest files and top directories, classifies each with
/// `FilePatternClassifier::classify_path`, and returns the matches sorted by
/// size. This is the backend source of truth the WinUI card now consumes
/// (with a local heuristic fallback when the CLI is unavailable).
pub fn run(args: BloatArgs, output_format: OutputFormat) -> AppResult<()> {
    let mut findings: Vec<BloatFinding> = Vec::new();
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
                let classifier = FilePatternClassifier::new();

                if let Ok(dirs) =
                    serde_json::from_str::<Vec<DirEntry>>(&record.top_directories_json)
                {
                    for dir in &dirs {
                        if let Some(rule) = classifier.classify_path(&dir.path, dir.total_size) {
                            findings.push(BloatFinding {
                                category: rule.name.clone(),
                                description: rule.description.clone(),
                                path: dir.path.clone(),
                                size: dir.total_size,
                                priority: rule.priority,
                            });
                        }
                    }
                }

                if let Ok(files) =
                    serde_json::from_str::<Vec<LargestFileEntry>>(&record.largest_files_json)
                {
                    for file in &files {
                        if let Some(rule) = classifier.classify_path(&file.path, file.size) {
                            findings.push(BloatFinding {
                                category: rule.name.clone(),
                                description: rule.description.clone(),
                                path: file.path.clone(),
                                size: file.size,
                                priority: rule.priority,
                            });
                        }
                    }
                }
            }
        }
    }

    findings.sort_by(|a, b| b.size.cmp(&a.size));
    findings.truncate(args.top);

    let response = serde_json::json!({
        "scan_id": used_scan_id,
        "path": scan_path,
        "findings": findings,
        "count": findings.len(),
    });

    if output_format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&response).unwrap_or_default());
    } else if findings.is_empty() {
        println!("No bloat candidates detected.");
    } else {
        for finding in &findings {
            println!(
                "[{}] {} ({})",
                finding.category,
                finding.path,
                finding.size
            );
        }
    }

    Ok(())
}
