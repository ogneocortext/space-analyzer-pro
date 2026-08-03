//! System Monitoring Integration Tests
//!
//! Tests the system monitoring functionality including:
//! - Disk volume detection
//! - System resource monitoring
//! - GPU detection
//! - Formatting utilities
//!

#![cfg(test)]

use space_analyzer_pro_desktop::system_monitor::SystemMonitor;

macro_rules! info {
    ($($arg:tt)*) => { eprintln!("[system_monitor] {}", format!($($arg)*)) };
}

// ------------------------------------------------------------------------------

/// Test that disk volumes are detected
#[test]
fn disk_volumes_are_detected() {
    info!("Verifying SystemMonitor::get_disk_volumes() returns volumes");
    let volumes = SystemMonitor::get_disk_volumes();
    eprintln!("  volume_count={}", volumes.len());
    assert!(
        !volumes.is_empty(),
        "Should detect at least one disk volume"
    );

    for (i, volume) in volumes.iter().enumerate() {
        eprintln!(
            "    [{}] mount='{}', fs={}, total={} bytes, available={} bytes",
            i, volume.mount_point, volume.file_system, volume.total_bytes, volume.available_bytes
        );
        assert!(volume.total_bytes > 0, "Volume should have total bytes");
        assert!(
            volume.available_bytes <= volume.total_bytes,
            "Available should not exceed total"
        );
    }
    info!("PASS");
}

/// Test that system resources are retrieved
#[test]
fn system_resources_are_retrieved() {
    info!("Verifying SystemMonitor::get_system_resources() returns sane values");
    let resources = SystemMonitor::get_system_resources();
    eprintln!(
        "  cpu_percent={}%, memory_total={} bytes, memory_used={} bytes",
        resources.cpu_percent, resources.memory_total_bytes, resources.memory_used_bytes
    );

    // CPU should be between 0 and 100
    assert!(
        resources.cpu_percent >= 0.0 && resources.cpu_percent <= 100.0,
        "CPU percent should be between 0 and 100"
    );

    // Memory should be reasonable
    assert!(resources.memory_total_bytes > 0, "Should have total memory");
    assert!(
        resources.memory_used_bytes <= resources.memory_total_bytes,
        "Used memory should not exceed total"
    );
    info!("PASS");
}

/// Test that GPU detection works (may return unavailable on systems without GPU)
#[test]
fn gpu_detection_works() {
    info!("Verifying SystemMonitor::detect_gpu() returns valid info");
    let gpu = SystemMonitor::detect_gpu();
    eprintln!("  gpu_name='{:?}', available={}", gpu.name, gpu.available);

    // GPU info should always be returned, even if unavailable
    if gpu.available {
        assert!(gpu.name.is_some(), "Available GPU should have a name");
    }
    info!("PASS");
}

/// Test that format_bytes works correctly
#[test]
fn format_bytes_formats_correctly() {
    info!("Verifying format_bytes produces correct unit suffixes");
    use space_analyzer_pro_desktop::gui_common::formatting::format_bytes;

    let cases = [
        (1024, "KB"),
        (1_048_576, "MB"),
        (1_073_741_824, "GB"),
        (1_099_511_627_776, "TB"),
    ];
    for (bytes, expected_unit) in &cases {
        let result = format_bytes(*bytes);
        eprintln!(
            "  format_bytes({}) -> '{}' (expects '{}')",
            bytes, result, expected_unit
        );
        assert!(
            result.contains(*expected_unit),
            "format_bytes({}) should contain '{}', got '{}'",
            bytes,
            expected_unit,
            result
        );
    }
    info!("PASS");
}
