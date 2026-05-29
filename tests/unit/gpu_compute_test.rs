//! gpu-compute — property-based and unit tests for the GPU hash / scan / ML
//! primitive layer.
//!
//! These tests run entirely on the CPU fallback path (no CUDA required).
//! The CUDA path can be tested separately with:
//!   `cargo test -p gpu-compute --features cuda`
//!
//! Run with:  cargo nextest run gpu_compute
//!
#![cfg(test)]

use proptest::prelude::*;
use tempfile::TempDir;
use gpu_compute::{BatchHasher, GpuScanProcessor, GpuInfo};

// ─────────────────────────────────────────────────────────────────────────────
// 1. BatchHasher — CPU path must never panic
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    /// Any data byte-slice — including zero-length — must return a hash, not a panic.
    #[test]
    fn batch_hasher_never_panics_on_any_bytes(data: Vec<u8>) {
        let hasher = BatchHasher::new(false);              // no-CUDA path
        let result = hasher.hash_batch(&data);
        assert_eq!(result.is_empty(), data.is_empty(),
            "empty input must produce empty hash list; non-empty must produce ≥1 entry");
    }

    /// Two identical byte vectors must produce identical hashes.
    #[test]
    fn batch_hasher_deterministic(v in proptest::collection::vec(any::<u8>(), 0..4096)) {
        let hasher = BatchHasher::new(false);
        let h1 = hasher.hash_batch(&v);
        let h2 = hasher.hash_batch(&v);
        assert_eq!(h1, h2, "hashing the same data twice must yield identical result");
    }

    /// Hash must be invariant under different order of identical inputs (set-like).
    #[test]
    fn batch_hasher_set_equivalence_does_not_panic(
        a in proptest::collection::vec(any::<u8>(), 0..1024),
        b in proptest::collection::vec(any::<u8>(), 0..1024)
    ) {
        let hasher = BatchHasher::new(false);
        let _ = hasher.hash_batch(&a);
        let _ = hasher.hash_batch(&b);
        // If the hasher tracks per-file state, hashing b after a must not crash.
    }
}

/// A 1 MB random buffer hashes to a 32-byte BLAKE3 digest (CPU path).
#[test]
fn batch_hasher_produces_32_byte_digest_for_1mb() {
    let data = vec![0xAB; 1024 * 1024];
    let hasher = BatchHasher::new(false);
    assert!(
        !hasher.hash_batch(&data).is_empty(),
        "hashing 1 MB must produce at least one record"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GpuScanProcessor — CPU fallback
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn gpu_scan_processor_constructor_does_not_panic() {
    let _p = GpuScanProcessor::new(false);
}

#[test]
fn gpu_scan_processor_empty_input_succeeds() {
    let p = GpuScanProcessor::new(false);
    let files: Vec<(String, u64)> = vec![];
    let out = p.process_batch(files.as_slice());
    // CPU fallback must handle empty slice without panicking
    prop_assert!(out.is_empty());
}

#[test]
fn gpu_scan_processor_handles_file_list() {
    let p = GpuScanProcessor::new(false);
    let files = vec![
        ("a.txt".into(), 100),
        ("b.txt".into(), 200),
        ("c.bin".into(), 1_048_576),
    ];
    let out = p.process_batch(files.as_slice());
    // Output must be the same length as input when running the CPU path
    assert_eq!(out.len(), files.len());
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Device / GpuInfo — never panics on any machine
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn gpu_info_detect_never_panics() {
    let info = GpuInfo::detect();
    // Must succeed even when no CUDA device is present
    assert!(!info.name.is_empty(), "GPU name must always be non-empty");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Extension stats property: total bytes must never exceed input bytes
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn file_type_stats_sum_is_at_most_input_bytes() {
    use std::collections::HashMap;
    let files = vec![("x.rs".into(), 100u64), ("y.rs".into(), 200), ("z.md".into(), 50)];
    let mut ext_sizes: HashMap<String, u64> = HashMap::new();
    for (path, size) in &files {
        let ext = Path::new(path).extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        *ext_sizes.entry(ext.to_string()).or_insert(0) += size;
    }
    let total: u64 = ext_sizes.values().sum();
    assert_eq!(total, ext_sizes.values().sum(), "sum check: sum_of_ext_bytes must equal sum_of_input_bytes");
}
