use std::path::Path;

use crate::file_relations;
use crate::gui_common::{DirEntry, ScanReport};
use crate::origin_tracer::classifiers::{any_app_installed, classify_path, is_project_root};
use crate::origin_tracer::safety::{OriginAssessment, OriginReport, SafetyLevel};

fn trace_dir_relations(path: &str) -> Vec<String> {
    let mut related = Vec::new();
    let p = Path::new(path);

    if let Ok(meta) = std::fs::symlink_metadata(p) {
        if meta.file_type().is_symlink() {
            if let Ok(target) = std::fs::read_link(p) {
                related.push(format!("symlink → {}", target.display()));
            }
        }
    }

    // Find the nearest enclosing project root.
    let mut current = p.parent();
    while let Some(parent) = current {
        if is_project_root(parent.to_str().unwrap_or("")) {
            related.push(format!("belongs to project: {}", parent.display()));
            break;
        }
        current = parent.parent();
    }

    related
}

/// Build an [`OriginAssessment`] for a scanned directory entry.
pub fn assess_directory(dir: &DirEntry) -> OriginAssessment {
    let class = classify_path(&dir.path);
    let related = trace_dir_relations(&dir.path);
    let app_installed = any_app_installed(class.apps);

    OriginAssessment {
        path: dir.path.clone(),
        name: dir.name.clone(),
        size: dir.total_size,
        file_count: dir.file_count,
        is_directory: true,
        origin: class.origin.to_string(),
        category: class.category.to_string(),
        safety: class.safety,
        recoverable: class.recoverable,
        app_installed,
        related_paths: related,
        reasoning: class.reasoning,
    }
}

/// Build an [`OriginAssessment`] for an individual large file.
///
/// Uses [`file_relations::analyze_file_dependencies`] to trace siblings,
/// hardlinks and symlinks so deletion impact is visible.
pub fn assess_file(path: &str, size: u64) -> OriginAssessment {
    let class = classify_path(path);
    let name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path)
        .to_string();
    let app_installed = any_app_installed(class.apps);

    // Trace file-level relationships via the existing dependency analyzer.
    let mut related: Vec<String> = Vec::new();
    let dep = file_relations::analyze_file_dependencies(path);
    if dep.is_symlink {
        if let Some(t) = &dep.symlink_target {
            related.push(format!("symlink → {t}"));
        }
    }
    if dep.hardlink_count > 0 {
        related.push(format!(
            "{} hardlink/duplicate candidate(s) — deleting one copy keeps the data",
            dep.hardlink_count
        ));
    }
    for f in dep.same_stem_files.iter().take(5) {
        related.push(format!("same-stem file: {}", f.path));
    }
    for f in dep.symlink_sources.iter().take(5) {
        related.push(format!("symlink source: {}", f.path));
    }
    if !dep.summary.is_empty() {
        related.push(dep.summary);
    }

    OriginAssessment {
        path: path.to_string(),
        name,
        size,
        file_count: 0,
        is_directory: false,
        origin: class.origin.to_string(),
        category: class.category.to_string(),
        safety: class.safety,
        recoverable: class.recoverable,
        app_installed,
        related_paths: related,
        reasoning: class.reasoning,
    }
}

/// Build a full [`OriginReport`] from a scan result.
///
/// Assesses the top directories and the largest individual files, then
/// aggregates the safety verdicts into reclaimable-space totals.
pub fn build_report(result: &ScanReport, max_dirs: usize, max_files: usize) -> OriginReport {
    let mut assessments: Vec<OriginAssessment> = Vec::new();

    for dir in result.top_directories.iter().take(max_dirs) {
        assessments.push(assess_directory(dir));
    }

    // Assess largest files, skipping ones already covered by their parent dir.
    let dir_paths: std::collections::HashSet<&str> = result
        .top_directories
        .iter()
        .take(max_dirs)
        .map(|d| d.path.as_str())
        .collect();
    for file in result.largest_files.iter().take(max_files) {
        let path = &file.path;
        let size = file.size;
        let covered = dir_paths.iter().any(|dp| path.starts_with(dp));
        if covered {
            continue;
        }
        assessments.push(assess_file(path, size));
    }

    // De-duplicate by path, keep largest, sort by size descending.
    assessments.sort_by_key(|a| std::cmp::Reverse(a.size));
    let mut seen = std::collections::HashSet::new();
    assessments.retain(|a| seen.insert(a.path.clone()));

    let mut safe = 0u64;
    let mut review = 0u64;
    let mut caution = 0u64;
    let mut keep = 0u64;
    for a in &assessments {
        match a.safety {
            SafetyLevel::Safe => safe += a.size,
            SafetyLevel::Review => review += a.size,
            SafetyLevel::Caution => caution += a.size,
            SafetyLevel::DoNotDelete => keep += a.size,
        }
    }

    OriginReport {
        scan_path: result.path.clone(),
        total_assessed: assessments.len(),
        safe_to_delete_bytes: safe,
        review_bytes: review,
        caution_bytes: caution,
        keep_bytes: keep,
        assessments,
    }
}

