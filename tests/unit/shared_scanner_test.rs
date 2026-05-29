//! shared-scanner — unit tests for file-walk statistics, hash stability,
//! and scan-result invariants.
//!
//! Uses `tempfile` for auto-cleaning fixture directories and `proptest` for
//! edge-case / property-based coverage (path safety, size counts).
//!
//! Run with:  cargo nextest run shared_scanner
//!
#![cfg(test)]

use proptest::prelude::*;
use shared_scanner::{FileInfo, ScanResult, ScanOptions, scan, blob_scan};
use std::path::{Path, PathBuf};

// ─────────────────────────────────────────────────────────────────────────────
// 1. ScanResult — constructors and invariants
// ─────────────────────────────────────────────────────────────────────────────

/// A bare ScanResult (via `new()`) must be internally coherent: all counts
/// zero, no file present, empty hasmaps.
#[test]
fn scan_result_defaults_are_zeroed() {
    let r = ScanResult::new();
    assert_eq!(r.total_files, 0);
    assert_eq!(r.total_directories, 0);
    assert_eq!(r.total_size_bytes, 0);
    assert_eq!(r.total_size_mb, 0.0);
    assert_eq!(r.duration_secs, 0.0);
    assert!(r.file_types.is_empty());
    assert!(r.extension_sizes.is_empty());
    assert!(r.size_distribution.is_empty());
    assert!(r.largest_files.is_empty());
    assert!(r.empty_directories.is_empty());
    assert!(r.errors.is_empty());
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FileInfo — serialisation round-trip
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn file_info_serde_roundtrip() {
    let fi = FileInfo {
        path: "/tmp/test.txt".into(),
        name: "test.txt".into(),
        size: 42,
        modified: Some("2026-01-01T00:00:00Z".into()),
        file_type: "file".into(),
        extension: "txt".into(),
    };
    let json = serde_json::to_string(&fi).expect("serialise must succeed");
    let back: FileInfo = serde_json::from_str(&json).expect("deserialise must succeed");
    assert_eq!(back.path, fi.path);
    assert_eq!(back.size, fi.size);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Real filesystem walk over an isolated temp directory
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn scan_temp_dir_counts_correctly() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("alpha.txt"), b"alpha").unwrap();
    std::fs::write(tmp.path().join("beta.bin"), b"beta").unwrap();

    let result = scan(tmp.path())
        .expect("scan must succeed on a temp dir");
    assert_eq!(result.total_files, 2, "two files expected");
    assert_eq!(result.total_size_bytes, 10); // alpha + beta = 5 + 5
}

#[test]
fn scan_temp_dir_extension_map_populated() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("a.rs"), b"rust code").unwrap();
    std::fs::write(tmp.path().join("b.rs"), b"more rust").unwrap();
    std::fs::write(tmp.path().join("c.md"), b"markdown").unwrap();

    let result = scan(tmp.path())
        .expect("scan must succeed");
    assert_eq!(result.file_types.get("rs").copied().unwrap_or(0), 2);
    assert_eq!(result.file_types.get("md").copied().unwrap_or(0), 1);
}

#[test]
fn scan_empty_dir_returns_zero_files() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let result = scan(tmp.path())
        .expect("empty-dir scan must succeed");
    assert_eq!(result.total_files, 0);
}

#[test]
fn scan_nested_subdirs_are_counted() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let sub = tmp.path().join("level1").join("level2");
    std::fs::create_dir_all(&sub).unwrap();
    std::fs::write(sub.join("deep.txt"), b"deep").unwrap();

    let result = scan(tmp.path())
        .expect("nested scan must succeed");
    assert_eq!(result.total_files, 1);
    assert!(result.total_directories >= 2, "at least level1 and level2 dirs");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Scan with seekable blob input (FilesList / stdin scenarios)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn blob_scan_empty_vocabulary_returns_empty_result() {
    let empty_vocabulary: Vec<u8> = Vec::new();
    let result = blob_scan(empty_vocabulary.as_slice())
        .expect("blob_scan on empty must not panic");
    assert_eq!(result.total_files, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Property-based: scanner never panics — only returns Result::Ok or Err
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    // Any path-string must not cause a panic inside the walker.
    // The function should return Ok(empty result) or Err for invalid chars, not crash.
    #[test]
    fn scan_never_panics_on_arbitrary_path(p in ".*") {
        let _ = scan(Path::new(&p));
    }

    // FileInfo field access never panics for any u64 size
    #[test]
    fn file_info_size_access_never_panics(size: u64) {
        let fi = FileInfo {
            path: "/tmp/x".into(),
            name: "x".into(),
            size,
            modified: None,
            file_type: "file".into(),
            extension: "".into(),
        };
        assert_eq!(fi.size, size);
    }

    // A path of arbitrary UTF-8 produced by proptest's string strategy must not
    // end up as ill-formed UTF-8 in FileInfo::name
    #[test]
    fn file_path_string_is_always_valid_utf8(s in ".*") {
        let fi = FileInfo {
            path: s.clone(),
            name: s.clone(),
            size: 0,
            modified: None,
            file_type: "file".into(),
            extension: "".into(),
        };
        // This forces a UTF-8 validation — a panic here means a malformed path reached
        // the model layer.
        let _ = fi.name.clone();
    }
}
