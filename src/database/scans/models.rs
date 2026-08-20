//! Data models for scan history and duplicate analysis.
//!
//! This module contains the structs used to represent scan history records,
//! trend points, and duplicate analysis results.

/// A compact, chart-friendly projection of a scan-history row. Used by the
/// "Size Trend" graph so the UI can plot every scan over time without pulling
/// the heavy per-scan JSON payloads (top directories, largest files, …) into
/// memory.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HistoryTrendPoint {
    pub id: i64,
    pub path: String,
    pub timestamp: String,
    pub total_size_bytes: u64,
}

/// A single file projected from the union of every per-scan `file_cache`,
/// deduplicated by `file_path`. The same file may appear in several scans (under
/// different `scan_path` roots), so this is the "centralized" view: the newest
/// size and mtime seen across scans, how many distinct scans observed it, and a
/// comma-joined list of the source scan roots. Powers the History page
/// "File Inventory" search/list.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MergedFileEntry {
    pub file_path: String,
    pub size_bytes: u64,
    pub mtime_unix: i64,
    pub extension: String,
    pub scan_count: usize,
    pub source_paths: String,
}

/// A stored duplicate-file analysis result, linked to the scan that produced it.
///
/// `duplicate_groups_json` holds the serialized `Vec<DuplicateGroup>` (the same
/// shape emitted by the `dedup` subcommand), so the full group/file list can be
/// reconstituted on retrieval without re-scanning.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DuplicateAnalysisRecord {
    pub id: i64,
    pub scan_id: i64,
    pub duplicate_groups_json: String,
    pub potential_savings_bytes: u64,
    pub timestamp: String,
}

/// Maximum number of scan-history records kept per distinct path. Newer scans
/// beyond this limit are removed on insert so the cache cannot grow unbounded.
pub const MAX_SCANS_PER_PATH: usize = 20;
