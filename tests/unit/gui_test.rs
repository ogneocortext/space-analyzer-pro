//! Space Analyzer Pro — Library regression tests
//!
//! Tests core library types and utilities directly from the root crate.
//!
//! Run: cargo test --test gui_test

#![cfg(test)]

use space_analyzer_pro_desktop::database::AppSettings;
use space_analyzer_pro_desktop::gui_common::{self, ScanReport};
use space_analyzer_pro_desktop::ollama::client::OllamaClient;
use space_analyzer_pro_desktop::ollama::types::ClientMetrics;
use space_analyzer_pro_desktop::system_monitor::SystemMonitor;
use space_analyzer_pro_desktop::workflows::WorkflowTemplates;
use std::collections::HashMap;

macro_rules! say {
    ($($arg:tt)*) => { eprintln!($($arg)*) };
}

macro_rules! pass {
    () => {
        eprintln!("  ✅ PASS\n");
    };
}

// 1. ScanReport default must be internally coherent
#[test]
fn scan_result_defaults_are_zeroed() {
    say!("🔍 Test: ScanReport defaults are zeroed");
    let r = ScanReport::new();
    say!(
        "   Files: {} | Dirs: {} | Size: {} bytes",
        r.total_files,
        r.total_dirs,
        r.total_size_bytes
    );
    say!(
        "   File types empty: {} | Extension sizes empty: {}",
        r.file_types.is_empty(),
        r.extension_sizes.is_empty()
    );
    say!(
        "   Largest files empty: {} | Errors empty: {} | Path: '{}'",
        r.largest_files.is_empty(),
        r.errors.is_empty(),
        r.path
    );
    assert_eq!(r.total_files, 0);
    assert_eq!(r.total_dirs, 0);
    assert_eq!(r.total_size_bytes, 0);
    assert!(r.file_types.is_empty());
    assert!(r.extension_sizes.is_empty());
    assert!(r.largest_files.is_empty());
    assert!(r.errors.is_empty());
    assert!(r.path.is_empty());
    pass!();
}

/// 2. format_bytes must produce correct unit suffixes
#[test]
fn format_bytes_units() {
    say!("🔍 Test: format_bytes unit suffixes");
    let cases = [
        (0, "B"),
        (1024, "KB"),
        (1_048_576, "MB"),
        (1_073_741_824, "GB"),
    ];
    for (bytes, expected_unit) in &cases {
        let result = gui_common::formatting::format_bytes(*bytes);
        say!(
            "   {} → '{}' (expected unit: {})",
            bytes,
            result,
            expected_unit
        );
        assert!(
            result.contains(*expected_unit),
            "format_bytes({}) should contain '{}', got '{}'",
            bytes,
            expected_unit,
            result
        );
    }
    pass!();
}

/// 3. ScanReport::from_shared must convert scan_engine types correctly
#[test]
fn scan_result_from_shared_converts_fields() {
    say!("🔍 Test: ScanReport::from_shared converts fields");
    use scan_engine::{FileInfo, ScanResult as SharedScanResult};
    let shared = SharedScanResult {
        total_files: 5,
        total_directories: 2,
        total_size: 1024,
        file_types: HashMap::from([("rs".into(), 3u64), ("md".into(), 2u64)]),
        extension_sizes: HashMap::from([("rs".into(), 600), ("md".into(), 424)]),
        size_distribution: HashMap::new(),
        largest_files: vec![FileInfo {
            path: "/tmp/big.rs".into(),
            name: "big.rs".into(),
            size: 500,
            modified: None,
            file_type: "file".into(),
            extension: "rs".into(),
        }],
        empty_directories: vec![],
        errors: vec![],
        subdirectories: vec![],
        scanned_files: HashMap::new(),
        category_sizes: HashMap::new(),
        reclaim_tier_sizes: HashMap::new(),
        category_reclaimable: HashMap::new(),
    };
    say!(
        "   Input: {} files, {} dirs, {} bytes",
        shared.total_files,
        shared.total_directories,
        shared.total_size
    );
    let result = ScanReport::from_shared(&shared, "/tmp".into(), 1.0);
    say!(
        "   Output: {} files, {} dirs, {} bytes",
        result.total_files,
        result.total_dirs,
        result.total_size_bytes
    );
    say!("   File types: {:?}", result.file_types);
    say!("   Largest files: {} entries", result.largest_files.len());
    assert_eq!(result.total_files, 5);
    assert_eq!(result.total_dirs, 2);
    assert_eq!(result.total_size_bytes, 1024);
    assert_eq!(result.file_types.get("rs").copied().unwrap_or(0), 3);
    assert_eq!(result.largest_files.len(), 1);
    pass!();
}

/// 4. AppSettings defaults must be sane
#[test]
fn app_settings_defaults_sane() {
    say!("🔍 Test: AppSettings defaults are sane");
    let s = AppSettings::default();
    say!("   Ollama URL: '{}'", s.ollama_url);
    say!("   Default scan path: '{}'", s.default_scan_path);
    assert!(!s.ollama_url.is_empty());
    assert!(!s.default_scan_path.is_empty());
    pass!();
}

/// 5. WorkflowTemplates::all_templates() must be non-empty
#[test]
fn workflow_templates_populated() {
    say!("🔍 Test: WorkflowTemplates are populated");
    let t = WorkflowTemplates::all_templates();
    say!("   Found {} templates:", t.len());
    for wf in &t {
        say!("     • {} ({:?})", wf.name, wf.category);
    }
    assert!(
        !t.is_empty(),
        "all_templates() must seed at least one workflow"
    );
    pass!();
}

/// 6. OllamaClient creation succeeds with valid URL
#[test]
fn ollama_client_creates_successfully() {
    say!("🔍 Test: OllamaClient::new() accepts valid URL + model");
    let client = OllamaClient::new("http://localhost:11434", "qwen3:8b");
    match &client {
        Ok(c) => {
            say!("   Created client at '{}'", c.base_url());
            pass!();
        }
        Err(e) => {
            say!("   ❌ FAIL: {:?}", e);
            panic!("Expected Ok, got Err: {:?}", e);
        }
    }
}

/// 7. OllamaClient rejects empty URL
#[test]
fn ollama_client_rejects_empty_url() {
    say!("🔍 Test: OllamaClient::new() rejects empty URL");
    let result = OllamaClient::new("", "test-model");
    say!("   Rejected empty URL: {}", result.is_err());
    assert!(result.is_err());
    pass!();
}

/// 8. ClientMetrics default is zeroed
#[test]
fn client_metrics_defaults_zeroed() {
    say!("🔍 Test: ClientMetrics defaults are zeroed");
    let m = ClientMetrics::new();
    say!(
        "   Total requests: {} | Total chat requests: {}",
        m.total_requests,
        m.total_chat_requests
    );
    assert_eq!(m.total_requests, 0);
    assert_eq!(m.total_chat_requests, 0);
    pass!();
}

/// 9. SystemMonitor::get_disk_volumes returns at least one volume
#[test]
fn system_monitor_detects_volumes() {
    say!("🔍 Test: SystemMonitor detects disk volumes");
    let volumes = SystemMonitor::get_disk_volumes();
    say!("   Found {} volumes:", volumes.len());
    for (i, v) in volumes.iter().enumerate() {
        let total_gb = v.total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        let avail_gb = v.available_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        say!(
            "     [{}] {} ({}) — {:.1} GB total, {:.1} GB available",
            i + 1,
            v.mount_point,
            v.file_system,
            total_gb,
            avail_gb
        );
    }
    assert!(
        !volumes.is_empty(),
        "Should detect at least one disk volume"
    );
    for v in &volumes {
        assert!(v.total_bytes > 0, "Volume should have total bytes");
        assert!(
            v.available_bytes <= v.total_bytes,
            "Available should not exceed total"
        );
    }
    pass!();
}

/// 10. SystemMonitor::get_system_resources returns reasonable values
#[test]
fn system_monitor_resources_reasonable() {
    say!("🔍 Test: SystemMonitor returns reasonable resource values");
    let r = SystemMonitor::get_system_resources();
    let mem_total_gb = r.memory_total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
    let mem_used_gb = r.memory_used_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
    say!("   CPU usage: {:.1}%", r.cpu_percent);
    say!(
        "   Memory: {:.1} GB / {:.1} GB used",
        mem_used_gb,
        mem_total_gb
    );
    assert!(
        r.cpu_percent >= 0.0 && r.cpu_percent <= 100.0,
        "CPU percent should be 0-100"
    );
    assert!(r.memory_total_bytes > 0, "Should have total memory");
    assert!(
        r.memory_used_bytes <= r.memory_total_bytes,
        "Used memory should not exceed total"
    );
    pass!();
}
