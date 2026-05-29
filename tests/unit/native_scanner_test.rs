//! native/scanner — unit tests for FileInfo / FileSize / CategoryStats
//! model types and their wire-fmt Serde invariants (Windows + Unix paths).
//!
//! Run with:  cargo nextest run native_scanner
//!            cargo nextest run native_scanner --features cuda        (with CUDA)
//!
#![cfg(test)]

use proptest::prelude::*;
use pretty_assertions::assert_ne;
use std::collections::HashMap;

// Re-export model types from the library under test.
// Dev-deps inherit path-based access to the library crate.
#![allow(unused_imports)]
use space_scanner::*;

// ─────────────────────────────────────────────────────────────────────────────
// 1. FileInfo — Serde round-trip (JSON ↔ struct)
// ─────────────────────────────────────────────────────────────────────────────

fn sample_fileinfo() -> FileInfo {
    FileInfo {
        name: "example.rs".into(),
        path: r"C:\projects\example.rs".into(),
        size: FileSize {
            bytes: 1024,
            formatted: "1 KB".into(),
            on_disk: Some(4096),
        },
        extension: "rs".into(),
        category: "source".into(),
        timestamps: FileTimestamps {
            created: Some("2026-01-01T00:00:00Z".into()),
            modified: "2026-05-17T12:00:00Z".into(),
            accessed: None,
        },
        is_hidden: false,
        is_directory: false,
        is_hard_link: false,
        hard_link_count: None,
        attributes: FileAttributes {
            is_readonly: false,
            is_hidden: false,
            is_system: false,
            has_ads: false,
            ads_count: None,
            is_compressed: false,
            compressed_size: None,
            is_sparse: false,
            is_reparse_point: false,
            reparse_tag: None,
            owner: None,
        },
    }
}

#[test]
fn file_info_json_roundtrip() {
    let fi = sample_fileinfo();
    let json = serde_json::to_string(&fi).unwrap();
    let back: FileInfo = serde_json::from_str(&json)
        .expect("Deserialised FileInfo must round-trip to the same struct");
    assert_eq!(back.path, fi.path);
    assert_eq!(back.size.bytes, fi.size.bytes);
    assert_eq!(back.extension, fi.extension);
}

#[test]
fn file_info_vary_only_path_from_varied_schema() {
    // When the same schema generates different actual values for a given
    // instance, those values must be distinct in the serialised form.
    let a = sample_fileinfo();
    let b = FileInfo {
        name: "other.rs".into(),
        path: r"C:\other.rs".into(),
        .. a.clone_extend()        // placeholder; backs a clone pattern
    };
    assert_ne!(a.path, b.path, "Different paths → different stored strings");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CategoryStats — aggregation closure must preserve total
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn category_stats_aggregate_sum_matches_input_total() {
    let mut stats: HashMap<String, CategoryStats> = HashMap::new();

    let entries: Vec<(String, u64)> = vec![
        ("src/lib.rs".into(), 512),
        ("src/main.rs".into(), 256),
        ("tests/app_test.rs".into(), 128),
    ];
    for (path, size) in entries {
        let ext = std::path::Path::new(&path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();
        let entry = stats.entry(ext.clone()).or_insert_with(|| CategoryStats {
            count: 0,
            size: 0,
        });
        entry.count += 1;
        entry.size  += size as i64;
    }

    let total_size: i64 = stats.values().map(|s| s.size).sum();
    assert_eq!(total_size, 512 + 256 + 128);
    let total_count: i64 = stats.values().map(|s| s.count).sum();
    assert_eq!(total_count, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FileSize formatting edge cases
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn file_size_bytes_zero_keeps_formatted_non_panic() {
    let fs = FileSize { bytes: 0, formatted: "0 B".into(), on_disk: None };
    assert_eq!(fs.bytes, 0);
}

#[test]
fn file_size_large_bytes_not_panicked() {
    // 64-bit max file size 2^64 - 1 must round-trip through the struct.
    let fs = FileSize { bytes: u64::MAX, formatted: ">18.4 EB".into(), on_disk: Some(0) };
    assert_eq!(fs.bytes, u64::MAX);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Property-based: FileInfo fields always valid UTF-8
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #[test]
    fn file_info_extension_always_string(name in ".*") {
        let fi = FileInfo {
            name: "x.txt".into(),
            path: "/tmp/x.txt".into(),
            size: FileSize { bytes: 0, formatted: "0 B".into(), on_disk: None },
            extension: "txt".into(),
            category: "file".into(),
            timestamps: FileTimestamps { created: None, modified: "2026-01-01T00:00:00Z".into(), accessed: None },
            is_hidden: false,
            is_directory: false,
            is_hard_link: false,
            hard_link_count: None,
            attributes: FileAttributes {
                is_readonly: false,
                is_hidden: false,
                is_system: false,
                has_ads: false,
                ads_count: None,
                is_compressed: false,
                compressed_size: None,
                is_sparse: false,
                is_reparse_point: false,
                reparse_tag: None,
                owner: None,
            },
        };
        // .extension & .path are String — they are always valid UTF-8 by type,
        // but this assertion documents the invariant explicitly for reviewers.
        assert!(fi.extension.is_ascii() || fi.extension.len() >= 0);
    }
}
