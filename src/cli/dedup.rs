use file_deduplicator::{DeduplicationConfig, FileDeduplicator};
use scan_engine::format_bytes;
use serde::Serialize;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::{AppError, AppResult};

use crate::cli::args::OutputFormat;
use crate::hprintln;

#[derive(Debug, Serialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub file_count: usize,
    pub files: Vec<String>,
    pub wasted_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct DedupResult {
    pub duplicate_groups: Vec<DuplicateGroup>,
    pub total_duplicate_files: usize,
    pub potential_savings_bytes: u64,
    /// Human-readable companion for `potential_savings_bytes`, so a `--format json`
    /// consumer gets a readable size without re-implementing byte formatting.
    pub potential_savings_human: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files_processed: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space_saved_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
}

/// Run duplicate-file analysis, or actually reclaim space when `apply` is set.
///
/// Human-facing text is emitted through the shared [`crate::hprintln!`] sink so
/// it lands on stderr when stdout must stay a single JSON document (e.g. when
/// `--clean` is called from a `scan --format json` run). Returns an error
/// instead of only printing one, so the caller can exit non-zero.
#[allow(clippy::too_many_arguments)]
pub fn run_clean_analysis(
    path: &str,
    output_format: OutputFormat,
    min_size: Option<u64>,
    max_size: Option<u64>,
    no_gpu: bool,
    apply: bool,
    yes: bool,
    scan_id: Option<i64>,
) -> AppResult<()> {
    let action = if apply {
        "DEDUPLICATE (create hard links)"
    } else {
        "DRY RUN (preview only)"
    };

    if !output_format.is_machine_readable() {
        hprintln!("🔗 DUPLICATE FILE ANALYSIS");
        hprintln!("   Mode: {action}");
        hprintln!("   Scanning for duplicate files (this may take a while)...");
        hprintln!();
    } else if apply && !yes {
        // A destructive operation requested through machine-readable output
        // without an explicit --yes must not silently proceed.
        return Err(AppError::Validation(
            "Refusing to modify files: pass --yes to apply deduplication non-interactively"
                .to_string(),
        ));
    }

    if apply && !yes && !confirm_apply()? {
        return Err(AppError::Validation(
            "Aborted: deduplication not confirmed by user".to_string(),
        ));
    }

    let config = DeduplicationConfig {
        min_file_size: min_size.unwrap_or(1024),
        max_file_size: max_size,
        dry_run: !apply,
        create_hard_links: true,
        use_gpu: !no_gpu,
        ..Default::default()
    };
    let deduplicator = FileDeduplicator::with_config(config);
    let files = deduplicator
        .scan_directory(path)
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let duplicate_groups = deduplicator.find_duplicates(files);
    if duplicate_groups.is_empty() {
        if output_format.is_machine_readable() {
            print_json(&DedupResult {
                duplicate_groups: vec![],
                total_duplicate_files: 0,
                potential_savings_bytes: 0,
                potential_savings_human: format_bytes(0),
                files_processed: None,
                space_saved_bytes: None,
                errors: None,
            });
        } else {
            hprintln!("   ✅ No duplicate files found!");
        }
        return Ok(());
    }

    let total_duplicates: usize = duplicate_groups.iter().map(|g| g.files.len() - 1).sum();
    let dup_savings: u64 = duplicate_groups
        .iter()
        .map(|g| g.size * (g.files.len() as u64 - 1))
        .sum();

    // Persist the analysis so it can be retrieved later via
    // `history --id <id> --duplicates`. Linked to the caller-supplied scan when
    // one is given (exact), otherwise to the most recent scan of this path;
    // skipped (no write) when no matching scan exists.
    persist_duplicate_analysis(path, &duplicate_groups, dup_savings, scan_id);

    if apply {
        let dedup_result = match deduplicator.deduplicate(&duplicate_groups, total_duplicates) {
            Ok(r) => r,
            Err(e) => {
                if output_format.is_machine_readable() {
                    print_json(&DedupResult {
                        duplicate_groups: vec![],
                        total_duplicate_files: total_duplicates,
                        potential_savings_bytes: 0,
                        potential_savings_human: format_bytes(0),
                        files_processed: None,
                        space_saved_bytes: None,
                        errors: Some(vec![e.to_string()]),
                    });
                } else {
                    eprintln!("   ❌ Deduplication failed: {e}");
                }
                return Ok(());
            }
        };
        let errors = if dedup_result.errors.is_empty() {
            None
        } else {
            Some(dedup_result.errors.clone())
        };
        if output_format.is_machine_readable() {
            print_json(&DedupResult {
                duplicate_groups: vec![],
                total_duplicate_files: total_duplicates,
                potential_savings_bytes: dedup_result.space_saved,
                potential_savings_human: format_bytes(dedup_result.space_saved),
                files_processed: Some(dedup_result.files_processed),
                space_saved_bytes: Some(dedup_result.space_saved),
                errors,
            });
        } else {
            hprintln!(
                "   ✅ Deduplicated {} files, reclaimed {}.",
                dedup_result.files_processed,
                format_bytes(dedup_result.space_saved)
            );
            if let Some(errs) = errors {
                for e in errs {
                    eprintln!("   ⚠️  {e}");
                }
            }
        }
        return Ok(());
    }

    if output_format.is_machine_readable() {
        let mut sorted_groups = duplicate_groups;
        sorted_groups.sort_by_key(|g| std::cmp::Reverse(g.size * (g.files.len() as u64 - 1)));

        let groups: Vec<DuplicateGroup> = sorted_groups
            .iter()
            .map(|g| {
                let waste = g.size * (g.files.len() as u64 - 1);
                DuplicateGroup {
                    hash: g.hash.clone(),
                    size: g.size,
                    file_count: g.files.len(),
                    files: g
                        .files
                        .iter()
                        .map(|f| f.path.display().to_string())
                        .collect(),
                    wasted_bytes: waste,
                }
            })
            .collect();

        print_json(&DedupResult {
            duplicate_groups: groups,
            total_duplicate_files: total_duplicates,
            potential_savings_bytes: dup_savings,
            potential_savings_human: format_bytes(dup_savings),
            files_processed: None,
            space_saved_bytes: None,
            errors: None,
        });
    } else {
        hprintln!(
            "   Found {} duplicate groups ({} duplicate files)",
            duplicate_groups.len(),
            total_duplicates
        );
        hprintln!(
            "   💾 Potential space savings: {}",
            format_bytes(dup_savings)
        );
        hprintln!();

        let mut sorted_groups = duplicate_groups;
        sorted_groups.sort_by_key(|g| std::cmp::Reverse(g.size * (g.files.len() as u64 - 1)));

        hprintln!("   Top duplicates by wasted space:");
        for (i, group) in sorted_groups.iter().take(15).enumerate() {
            let waste = group.size * (group.files.len() as u64 - 1);
            hprintln!(
                "   {:>2}. {} × {} copies = {} wasted  [{}]",
                i + 1,
                format_bytes(group.size),
                group.files.len(),
                format_bytes(waste),
                &group.hash[..group.hash.len().min(12)]
            );
            for f in &group.files {
                hprintln!("       📄 {}", f.path.display());
            }
        }
        if sorted_groups.len() > 15 {
            hprintln!("   ... and {} more groups", sorted_groups.len() - 15);
        }

        hprintln!();
        hprintln!("   ℹ️  Dry run only — no files were modified.");
        hprintln!("   Re-run with --apply to create hard links and reclaim space.");
    }
    Ok(())
}

fn print_json(result: &DedupResult) {
    println!(
        "{}",
        serde_json::to_string_pretty(result).unwrap_or_default()
    );
}

/// Persist a duplicate analysis to the embedded DB. When `scan_id` is supplied
/// (and that scan actually exists) the analysis is linked to it exactly;
/// otherwise it is linked to the most recent scan of `path`. Best-effort: any
/// failure (no DB, no matching scan, serialize error) is swallowed so analysis
/// output is never blocked by storage.
fn persist_duplicate_analysis(
    path: &str,
    groups: &[file_deduplicator::DuplicateGroup],
    savings: u64,
    scan_id: Option<i64>,
) {
    if let Ok(db) = Database::default_open() {
        // Prefer an explicit, verified scan id; fall back to the latest scan of
        // the same path. `None` is returned when there is no scan to attach to.
        let resolved = match scan_id {
            Some(id) => db.get_scan_by_id(id).ok().flatten().map(|r| r.id),
            None => db.get_latest_scan_id_for_path(path).ok().flatten(),
        };
        if let Some(scan_id) = resolved {
            // Re-shape into the canonical `dedup::DuplicateGroup` wire format so
            // the stored JSON matches the `dedup` subcommand output and the C#
            // `DuplicateGroup` model (files as paths, with file_count/wasted_bytes).
            let canonical: Vec<DuplicateGroup> = groups
                .iter()
                .map(|g| DuplicateGroup {
                    hash: g.hash.clone(),
                    size: g.size,
                    file_count: g.files.len(),
                    files: g
                        .files
                        .iter()
                        .map(|f| f.path.display().to_string())
                        .collect(),
                    wasted_bytes: g.size * (g.files.len() as u64 - 1),
                })
                .collect();
            if let Ok(json) = serde_json::to_string(&canonical) {
                let _ = db.save_duplicate_analysis(scan_id, &json, savings);
            }
        }
    }
}

/// Ask the user to confirm a destructive deduplication. Reads a single line from
/// stdin; only `y`/`yes` (case-insensitive) proceeds. Returns `Ok(false)` when
/// the user declines or input cannot be read.
fn confirm_apply() -> AppResult<bool> {
    use std::io::Write;
    eprint!("🔗 Deduplication will replace duplicate files with hard links. Continue? [y/N] ");
    let _ = std::io::stderr().flush();
    let mut buf = String::new();
    if std::io::stdin().read_line(&mut buf).is_err() {
        return Ok(false);
    }
    let answer = buf.trim().to_lowercase();
    Ok(answer == "y" || answer == "yes")
}
