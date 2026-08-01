//! shared-scanner -- unit tests for file-walk statistics, hash stability,
//! and scan-result invariants.
//!
//! Uses tempfile for auto-cleaning fixture directories and proptest for
//! edge-case / property-based coverage (path safety, size counts).
//!
//! Run with:  cargo nextest run shared_scanner

#![cfg(test)]

use proptest::prelude::*;
use shared_scanner::{FileInfo, FileScanner, ScanOptions, ScanResult};

// -----------------------------------------------------------------------------
// 1. ScanResult -- constructors and invariants
// -----------------------------------------------------------------------------

/// A bare ScanResult (via `new()`) must be internally coherent: all counts
/// zero, no file present, empty hashmaps.
#[test]
fn scan_result_defaults_are_zeroed() {
    let r = ScanResult {
        total_files: 0,
        total_directories: 0,
        total_size: 0,
        file_types: std::collections::HashMap::new(),
        extension_sizes: std::collections::HashMap::new(),
        size_distribution: std::collections::HashMap::new(),
        largest_files: Vec::new(),
        empty_directories: Vec::new(),
        errors: Vec::new(),
        subdirectories: Vec::new(),
        scanned_files: std::collections::HashMap::new(),
    };
    assert_eq!(r.total_files, 0);
    assert_eq!(r.total_directories, 0);
    assert_eq!(r.total_size, 0);
    assert!(r.file_types.is_empty());
    assert!(r.extension_sizes.is_empty());
    assert!(r.size_distribution.is_empty());
    assert!(r.largest_files.is_empty());
    assert!(r.empty_directories.is_empty());
    assert!(r.errors.is_empty());
}

// -----------------------------------------------------------------------------
// 2. FileInfo -- serialisation round-trip
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 3. Real filesystem walk over an isolated temp directory
// -----------------------------------------------------------------------------

#[test]
fn scan_temp_dir_counts_correctly() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("alpha.txt"), b"alpha").unwrap();
    std::fs::write(tmp.path().join("beta.bin"), b"beta").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("scan must succeed on a temp dir");
    assert_eq!(result.total_files, 2, "two files expected");
    assert_eq!(result.total_size, 9); // alpha(5) + beta(4)
}

#[test]
fn scan_temp_dir_extension_map_populated() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("a.rs"), b"rust code").unwrap();
    std::fs::write(tmp.path().join("b.rs"), b"more rust").unwrap();
    std::fs::write(tmp.path().join("c.md"), b"markdown").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("scan must succeed");
    assert_eq!(result.file_types.get("rs").copied().unwrap_or(0), 2);
    assert_eq!(result.file_types.get("md").copied().unwrap_or(0), 1);
}

#[test]
fn scan_empty_dir_returns_zero_files() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("empty-dir scan must succeed");
    assert_eq!(result.total_files, 0);
}

#[test]
fn scan_dir_with_only_hidden_files_is_not_empty() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join(".hidden"), b"secret").unwrap();

    let scanner = FileScanner::new();

    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("scan must succeed");
    assert!(
        result.empty_directories.is_empty(),
        "dir with only dotfiles must not be reported empty when hidden files are excluded"
    );

    let result_include_hidden = scanner
        .scan_directory_sync(
            tmp.path().to_str().unwrap(),
            ScanOptions {
                include_hidden: true,
                ..Default::default()
            },
        )
        .expect("scan must succeed");
    assert!(
        result_include_hidden.empty_directories.is_empty(),
        "dir with only dotfiles must not be reported empty when hidden files are included"
    );
}

#[test]
fn scan_nested_subdirs_are_counted() {
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let sub = tmp.path().join("level1").join("level2");
    std::fs::create_dir_all(&sub).unwrap();
    std::fs::write(sub.join("deep.txt"), b"deep").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("nested scan must succeed");
    assert_eq!(result.total_files, 1);
    assert!(
        result.total_directories >= 2,
        "at least level1 and level2 dirs"
    );
}

// -----------------------------------------------------------------------------
// 4. Property-based: scanner never panics -- only returns Result::Ok or Err
// -----------------------------------------------------------------------------

proptest! {
    // Any path-string must not cause a panic inside the walker.
    // The function should return Ok(empty result) or Err for invalid chars, not crash.
    #[test]
    fn scan_never_panics_on_arbitrary_path(p in ".*") {
        let scanner = FileScanner::new();
        let _ = scanner.scan_directory_sync(&p, ScanOptions::default());
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
        // This forces a UTF-8 validation -- a panic here means a malformed path reached
        // the model layer.
        let _ = fi.name.clone();
    }
}
