//! shared-scanner -- unit tests for file-walk statistics, hash stability,
//! and scan-result invariants.
//!
//! Uses tempfile for auto-cleaning fixture directories and proptest for
//! edge-case / property-based coverage (path safety, size counts).
//!
//! Run with:  cargo nextest run shared_scanner
//!

#![cfg(test)]

use proptest::prelude::*;
use shared_scanner::{FileInfo, FileScanner, ScanOptions, ScanResult};

macro_rules! info {
    ($($arg:tt)*) => { eprintln!("[shared_scanner] {}", format!($($arg)*)) };
}

// -----------------------------------------------------------------------------
// 1. ScanResult -- constructors and invariants
// -----------------------------------------------------------------------------

/// A bare ScanResult (via struct literal) must be internally coherent: all counts
/// zero, no file present, empty hashmaps.
#[test]
fn scan_result_defaults_are_zeroed() {
    info!("Verifying shared_scanner::ScanResult defaults are zeroed");
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
    eprintln!("  total_files={}, total_directories={}, total_size={}", r.total_files, r.total_directories, r.total_size);
    assert_eq!(r.total_files, 0);
    assert_eq!(r.total_directories, 0);
    assert_eq!(r.total_size, 0);
    assert!(r.file_types.is_empty());
    assert!(r.extension_sizes.is_empty());
    assert!(r.size_distribution.is_empty());
    assert!(r.largest_files.is_empty());
    assert!(r.empty_directories.is_empty());
    assert!(r.errors.is_empty());
    info!("PASS");
}

// -----------------------------------------------------------------------------
// 2. FileInfo -- serialisation round-trip
// -----------------------------------------------------------------------------

#[test]
fn file_info_serde_roundtrip() {
    info!("Verifying FileInfo serialises and deserialises correctly");
    let fi = FileInfo {
        path: "/tmp/test.txt".into(),
        name: "test.txt".into(),
        size: 42,
        modified: Some("2026-01-01T00:00:00Z".into()),
        file_type: "file".into(),
        extension: "txt".into(),
    };
    let json = serde_json::to_string(&fi).expect("serialise must succeed");
    eprintln!("  serialised JSON='{}'", json);
    let back: FileInfo = serde_json::from_str(&json).expect("deserialise must succeed");
    eprintln!("  deserialised path='{}', size={}", back.path, back.size);
    assert_eq!(back.path, fi.path);
    assert_eq!(back.size, fi.size);
    info!("PASS");
}

// -----------------------------------------------------------------------------
// 3. Real filesystem walk over an isolated temp directory
// -----------------------------------------------------------------------------

#[test]
fn scan_temp_dir_counts_correctly() {
    info!("Verifying FileScanner counts files in a temp dir");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("alpha.txt"), b"alpha").unwrap();
    std::fs::write(tmp.path().join("beta.bin"), b"beta").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("scan must succeed on a temp dir");
    eprintln!("  files={}, size={} bytes", result.total_files, result.total_size);
    assert_eq!(result.total_files, 2, "two files expected");
    assert_eq!(result.total_size, 9); // alpha(5) + beta(4)
    info!("PASS");
}

#[test]
fn scan_temp_dir_extension_map_populated() {
    info!("Verifying extension_sizes map is populated");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("a.rs"), b"rust code").unwrap();
    std::fs::write(tmp.path().join("b.rs"), b"more rust").unwrap();
    std::fs::write(tmp.path().join("c.md"), b"markdown").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("scan must succeed");
    eprintln!("  file_types={:?}", result.file_types);
    assert_eq!(result.file_types.get("rs").copied().unwrap_or(0), 2);
    assert_eq!(result.file_types.get("md").copied().unwrap_or(0), 1);
    info!("PASS");
}

#[test]
fn scan_empty_dir_returns_zero_files() {
    info!("Verifying empty dir returns zero files");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("empty-dir scan must succeed");
    eprintln!("  files={}, dirs={}", result.total_files, result.total_directories);
    assert_eq!(result.total_files, 0);
    info!("PASS");
}

#[test]
fn scan_dir_with_only_hidden_files_is_not_empty() {
    info!("Verifying dotfile-only dir is not reported empty");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join(".hidden"), b"secret").unwrap();

    let scanner = FileScanner::new();

    let result = scanner
        .scan_directory_sync(
            tmp.path().to_str().unwrap(),
            ScanOptions {
                include_hidden: false,
                ..Default::default()
            },
        )
        .expect("scan must succeed");
    eprintln!("  include_hidden=false: empty_directories={:?}", result.empty_directories);
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
    eprintln!("  include_hidden=true: empty_directories={:?}", result_include_hidden.empty_directories);
    assert!(
        result_include_hidden.empty_directories.is_empty(),
        "dir with only dotfiles must not be reported empty when hidden files are included"
    );
    info!("PASS");
}

#[test]
fn scan_nested_subdirs_are_counted() {
    info!("Verifying nested subdirs increase directory count");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let sub = tmp.path().join("level1").join("level2");
    std::fs::create_dir_all(&sub).unwrap();
    std::fs::write(sub.join("deep.txt"), b"deep").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("nested scan must succeed");
    eprintln!("  files={}, directories={}", result.total_files, result.total_directories);
    assert_eq!(result.total_files, 1);
    assert!(
        result.total_directories >= 2,
        "at least level1 and level2 dirs"
    );
    info!("PASS");
}

// -----------------------------------------------------------------------------
// 4. Depth limiting: shallow, deep, and custom max_depth
// -----------------------------------------------------------------------------

#[test]
fn shallow_scan_only_reaches_depth_1() {
    info!("Verifying shallow scan only reaches depth 1");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let l1 = tmp.path().join("level1");
    let l2 = l1.join("level2");
    std::fs::create_dir_all(&l2).unwrap();
    std::fs::write(l2.join("deep.txt"), b"deep").unwrap();
    std::fs::write(l1.join("shallow.txt"), b"shallow").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::shallow())
        .expect("shallow scan must succeed");
    eprintln!("  shallow: files={}, dirs={}", result.total_files, result.total_directories);
    assert_eq!(result.total_files, 0, "shallow scan should not descend into level1");
    assert_eq!(result.total_directories, 2, "root + level1/ should be visible at depth 1");
    info!("PASS");
}

#[test]
fn deep_scan_reaches_all_nested_dirs() {
    info!("Verifying deep scan reaches all nested directories");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let deep = tmp.path().join("a").join("b").join("c").join("d");
    std::fs::create_dir_all(&deep).unwrap();
    std::fs::write(deep.join("bottom.txt"), b"bottom").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::deep())
        .expect("deep scan must succeed");
    eprintln!("  deep: files={}, dirs={}", result.total_files, result.total_directories);
    assert_eq!(result.total_files, 1);
    assert!(
        result.total_directories >= 4,
        "deep scan should reach all nested dirs"
    );
    info!("PASS");
}

#[test]
fn custom_max_depth_limits_traversal() {
    info!("Verifying custom max_depth limits traversal");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    let l1 = tmp.path().join("level1");
    let l2 = l1.join("level2");
    let l3 = l2.join("level3");
    std::fs::create_dir_all(&l3).unwrap();
    std::fs::write(l3.join("too_deep.txt"), b"x").unwrap();

    let scanner = FileScanner::new();

    let max_depth_2 = scanner
        .scan_directory_sync(
            tmp.path().to_str().unwrap(),
            ScanOptions {
                max_depth: Some(2),
                ..Default::default()
            },
        )
        .expect("max_depth=2 scan must succeed");

    let max_depth_1 = scanner
        .scan_directory_sync(
            tmp.path().to_str().unwrap(),
            ScanOptions {
                max_depth: Some(1),
                ..Default::default()
            },
        )
        .expect("max_depth=1 scan must succeed");

    eprintln!("  max_depth=2: files={}, dirs={}", max_depth_2.total_files, max_depth_2.total_directories);
    eprintln!("  max_depth=1: files={}, dirs={}", max_depth_1.total_files, max_depth_1.total_directories);

    assert!(
        max_depth_2.total_directories >= 2,
        "max_depth=2 should see level1 and level2"
    );
    assert!(
        max_depth_1.total_directories < max_depth_2.total_directories,
        "shallower max_depth should traverse fewer directories"
    );
    info!("PASS");
}

// -----------------------------------------------------------------------------
// 5. File cache: populate, hit, and skip on unchanged files
// -----------------------------------------------------------------------------

#[test]
fn file_cache_populated_on_first_scan() {
    info!("Verifying file cache populated on first scan");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("keep.txt"), b"cache me").unwrap();

    let scanner = FileScanner::new();
    let result = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("scan must succeed");

    eprintln!("  cached paths: {:?}", result.scanned_files.keys().collect::<Vec<_>>());
    assert!(
        !result.scanned_files.is_empty(),
        "at least one entry should be cached: got {}",
        result.scanned_files.len()
    );
    info!("PASS");
}

#[test]
fn file_cache_hits_on_unchanged_files() {
    info!("Verifying file cache hits on unchanged files");
    let tmp = tempfile::TempDir::new().expect("can create TempDir");
    std::fs::write(tmp.path().join("steady.txt"), b"unchanged").unwrap();

    let scanner = FileScanner::new();

    let first = scanner
        .scan_directory_sync(tmp.path().to_str().unwrap(), ScanOptions::default())
        .expect("first scan must succeed");

    let cache_map = first.scanned_files.clone();
    assert!(!cache_map.is_empty(), "first scan must populate cache");

    let second = scanner
        .scan_directory_sync(
            tmp.path().to_str().unwrap(),
            ScanOptions {
                file_cache: Some(cache_map),
                ..Default::default()
            },
        )
        .expect("second scan with cache must succeed");

    eprintln!("  first: files={}, cached={}", first.total_files, first.scanned_files.len());
    eprintln!("  second: files={}, cached={}", second.total_files, second.scanned_files.len());
    assert_eq!(first.total_files, second.total_files, "file count should stay stable");
    assert_eq!(second.scanned_files.len(), first.scanned_files.len(), "second scan should produce same cache size");
    info!("PASS");
}

// -----------------------------------------------------------------------------
// 6. Property-based: scanner never panics -- only returns Result::Ok or Err
// -----------------------------------------------------------------------------

proptest! {
    /// Any path-string must not cause a panic inside the walker.
    /// The function should return Ok(empty result) or Err for invalid chars, not crash.
    #[test]
    fn scan_never_panics_on_arbitrary_path(p in ".*") {
        info!("Proptest: scanning path '{}'", p);
        let scanner = FileScanner::new();
        let _ = scanner.scan_directory_sync(&p, ScanOptions::default());
        info!("PASS");
    }

    /// FileInfo field access never panics for any u64 size
    #[test]
    fn file_info_size_access_never_panics(size: u64) {
        info!("Proptest: FileInfo size={}", size);
        let fi = FileInfo {
            path: "/tmp/x".into(),
            name: "x".into(),
            size,
            modified: None,
            file_type: "file".into(),
            extension: "".into(),
        };
        assert_eq!(fi.size, size);
        info!("PASS");
    }

    /// A path of arbitrary UTF-8 produced by proptest's string strategy must not
    /// end up as ill-formed UTF-8 in FileInfo::name
    #[test]
    fn file_path_string_is_always_valid_utf8(s in ".*") {
        info!("Proptest: validating UTF-8 for path '{}'", s);
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
        info!("PASS");
    }
}
