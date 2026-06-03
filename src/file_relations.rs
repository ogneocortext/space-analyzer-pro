use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// A single related file entry
#[derive(Debug, Clone, Serialize)]
pub struct RelatedFile {
    pub path: String,
    pub relation: String,
    pub size: u64,
    pub modified: String,
}

/// Full dependency report for a target file
#[derive(Debug, Clone, Serialize)]
pub struct DependencyReport {
    pub target_path: String,
    pub target_exists: bool,
    pub target_is_dir: bool,
    pub target_size: u64,
    pub target_modified: String,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub hardlink_count: u64,
    pub same_stem_files: Vec<RelatedFile>,
    pub sibling_files: Vec<RelatedFile>,
    pub symlink_sources: Vec<RelatedFile>,
    pub total_related: usize,
    pub summary: String,
}

fn format_modified(meta: &fs::Metadata) -> String {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .and_then(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0))
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

fn paired_extensions_map() -> &'static HashMap<&'static str, Vec<&'static str>> {
    use std::sync::OnceLock;
    static MAP: OnceLock<HashMap<&str, Vec<&str>>> = OnceLock::new();
    MAP.get_or_init(|| {
        let mut m = HashMap::new();
        m.insert("mp4", vec!["srt", "sub", "idx", "mkv", "avi", "jpg", "nfo"]);
        m.insert("mkv", vec!["srt", "sub", "idx", "mp4", "avi", "jpg", "nfo"]);
        m.insert("html", vec!["css", "js", "json", "png", "jpg", "svg"]);
        m.insert("htm", vec!["css", "js", "json", "png", "jpg", "svg"]);
        m.insert("cpp", vec!["hpp", "h", "c", "hxx"]);
        m.insert("hpp", vec!["cpp", "c", "h", "hxx"]);
        m.insert("c", vec!["h", "hpp"]);
        m.insert("h", vec!["c", "cpp", "hpp"]);
        m.insert("py", vec!["pyc", "pyd", "pyw", "ipynb", "txt", "json"]);
        m.insert("tex", vec!["pdf", "aux", "log", "bbl", "blg", "bib"]);
        m.insert("pdf", vec!["tex", "docx", "doc", "txt"]);
        m.insert("docx", vec!["pdf", "doc", "txt"]);
        m.insert("zip", vec!["zip", "rar", "7z", "tar", "gz"]);
        m.insert("jpg", vec!["raw", "nef", "cr2", "dng", "png", "xmp"]);
        m.insert("raw", vec!["jpg", "nef", "cr2", "dng", "xmp"]);
        m.insert("blend", vec!["png", "jpg", "exr", "tga", "fbx", "obj"]);
        m.insert("psd", vec!["jpg", "png", "tiff"]);
        m.insert("iso", vec!["cue", "img", "mds"]);
        m.insert("flac", vec!["cue", "log", "jpg", "png"]);
        m.insert("md", vec!["html", "pdf", "json", "yaml", "yml"]);
        m
    })
}

/// Analyze file dependencies for a given path
pub fn analyze_file_dependencies(path: &str) -> DependencyReport {
    let target_path = PathBuf::from(path);
    let target_exists = target_path.exists();

    let mut report = DependencyReport {
        target_path: path.to_string(),
        target_exists,
        target_is_dir: target_exists && target_path.is_dir(),
        target_size: 0,
        target_modified: String::new(),
        is_symlink: false,
        symlink_target: None,
        hardlink_count: 0,
        same_stem_files: Vec::new(),
        sibling_files: Vec::new(),
        symlink_sources: Vec::new(),
        total_related: 0,
        summary: String::new(),
    };

    if !target_exists {
        report.summary = format!("File does not exist: {}", path);
        return report;
    }

    if report.target_is_dir {
        report.summary = format!("Target is a directory, not a file: {}", path);
        return report;
    }

    let metadata = match fs::metadata(&target_path) {
        Ok(m) => m,
        Err(e) => {
            report.summary = format!("Cannot read file metadata: {}", e);
            return report;
        }
    };

    let symlink_meta = fs::symlink_metadata(&target_path).ok();
    report.target_size = metadata.len();
    report.target_modified = format_modified(&metadata);
    report.is_symlink = symlink_meta.map_or(false, |m| m.file_type().is_symlink());

    if report.is_symlink {
        if let Ok(target) = fs::read_link(&target_path) {
            report.symlink_target = Some(target.to_string_lossy().to_string());
        }
    }

    let Some(parent) = target_path.parent() else {
        return report;
    };

    // Single pass: read directory once and collect entry data
    let mut dir_entries: Vec<(PathBuf, fs::Metadata)> = Vec::new();
    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path == target_path {
                continue;
            }
            if entry_path.is_dir() {
                continue;
            }
            if let Ok(meta) = fs::metadata(&entry_path) {
                dir_entries.push((entry_path, meta));
            }
        }
    }

    let target_name = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let target_extension = target_path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let target_stem_lower = target_path.file_stem().map(|s| s.to_ascii_lowercase());

    // Track paths already added to avoid duplicates
    let mut added_paths: HashSet<String> = HashSet::new();

    for (entry_path, e_meta) in &dir_entries {
        let entry_path_str = entry_path.to_string_lossy().to_string();
        if !added_paths.insert(entry_path_str.clone()) {
            continue;
        }

        // --- Potential duplicate (same size + same modified time) ---
        if report.target_size >= 1024
            && e_meta.len() == report.target_size
            && e_meta
                .modified()
                .ok()
                .zip(metadata.modified().ok())
                .map_or(false, |(a, b)| a == b)
        {
            report.hardlink_count += 1;
            report.sibling_files.push(RelatedFile {
                path: entry_path_str.clone(),
                relation: "Potential duplicate (same size + modified time)".to_string(),
                size: e_meta.len(),
                modified: format_modified(e_meta),
            });
            continue; // Duplicate trumps other relation types to avoid noise
        }

        let name_stem = entry_path
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();
        let ext = entry_path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        // --- Same-name-stem files ---
        if name_stem == target_name && !ext.is_empty() {
            report.same_stem_files.push(RelatedFile {
                path: entry_path_str.clone(),
                relation: format!("Same name with different extension: .{}", ext),
                size: e_meta.len(),
                modified: format_modified(e_meta),
            });
            continue;
        }

        // --- Symlink source check (only if entry itself is a symlink) ---
        if let Ok(sym_meta) = fs::symlink_metadata(&entry_path) {
            if sym_meta.file_type().is_symlink() {
                if let Ok(link_target) = fs::read_link(entry_path) {
                    let abs_target = if link_target.is_absolute() {
                        link_target.clone()
                    } else {
                        entry_path
                            .parent()
                            .unwrap_or(Path::new("."))
                            .join(&link_target)
                    };
                    if abs_target
                        .canonicalize()
                        .ok()
                        .zip(target_path.canonicalize().ok())
                        .map_or(false, |(a, b)| a == b)
                    {
                        report.symlink_sources.push(RelatedFile {
                            path: entry_path_str.clone(),
                            relation: "Symlink pointing to this file".to_string(),
                            size: e_meta.len(),
                            modified: format_modified(e_meta),
                        });
                        continue;
                    }
                }
            }
        }

        // --- Extension-based pair (same stem, known paired ext) ---
        if let Some(paired_exts) = paired_extensions_map().get(target_extension.as_str()) {
            if paired_exts.contains(&ext.as_str())
                && entry_path.file_stem().map(|s| s.to_ascii_lowercase()) == target_stem_lower
            {
                report.sibling_files.push(RelatedFile {
                    path: entry_path_str.clone(),
                    relation: format!("Potential related file type: .{}", ext),
                    size: e_meta.len(),
                    modified: format_modified(e_meta),
                });
                continue;
            }
        }

        // --- Default: sibling file (same directory) ---
        report.sibling_files.push(RelatedFile {
            path: entry_path_str,
            relation: "Same directory (sibling)".to_string(),
            size: e_meta.len(),
            modified: format_modified(e_meta),
        });
    }

    // Deduplicate sibling files (should already be unique via added_paths, but guard anyway)
    {
        let mut seen = HashSet::new();
        report.sibling_files.retain(|f| seen.insert(f.path.clone()));
    }

    report.total_related =
        report.same_stem_files.len() + report.sibling_files.len() + report.symlink_sources.len();

    // Build summary
    let mut summary_parts = Vec::new();

    if report.is_symlink {
        summary_parts.push(format!(
            "🔗 This file is a symlink pointing to: {}",
            report.symlink_target.as_deref().unwrap_or("unknown")
        ));
    }
    if report.hardlink_count > 0 {
        summary_parts.push(format!(
            "🔗 {} potential duplicate(s) found (same size + modified time) — may share disk data",
            report.hardlink_count
        ));
    }
    if !report.same_stem_files.is_empty() {
        summary_parts.push(format!(
            "📎 Found {} file(s) sharing the same name stem (different extension)",
            report.same_stem_files.len()
        ));
    }
    if !report.symlink_sources.is_empty() {
        summary_parts.push(format!(
            "🔗 Found {} symlink(s) pointing to this file",
            report.symlink_sources.len()
        ));
    }
    if !report.sibling_files.is_empty() {
        summary_parts.push(format!(
            "📁 Found {} sibling file(s) in the same directory",
            report.sibling_files.len()
        ));
    }
    if report.total_related == 0 {
        summary_parts
            .push("✅ No related files detected — this file appears isolated.".to_string());
    } else {
        let impact = if report.total_related > 10 {
            "HIGH"
        } else if report.total_related > 3 {
            "MEDIUM"
        } else {
            "LOW"
        };
        summary_parts.push(format!(
            "⚠  Impact assessment: {} ({}) — deleting this file would affect {} other file(s)",
            impact,
            if report.total_related > 10 {
                "many related files"
            } else if report.total_related > 3 {
                "several related files"
            } else {
                "few or no related files"
            },
            report.total_related
        ));
    }

    report.summary = summary_parts.join("\n");
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nonexistent_file() {
        let report = analyze_file_dependencies("C:\\nonexistent_file_xyz.test");
        assert!(!report.target_exists);
        assert_eq!(report.total_related, 0);
    }

    #[test]
    fn test_analyze_self() {
        let report = analyze_file_dependencies("src/file_relations.rs");
        assert!(report.target_exists);
        assert!(report.target_size > 0);
    }

    #[test]
    fn test_directory_returns_early() {
        let report = analyze_file_dependencies("src");
        assert!(report.target_exists);
        assert!(report.target_is_dir);
        assert_eq!(report.total_related, 0);
    }
}
