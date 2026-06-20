//! System Monitoring Integration Tests
//!
//! Tests the system monitoring functionality including:
//! - Disk volume detection
//! - System resource monitoring
//! - GPU detection
//! - Integration with tool registry

#![cfg(test)]

use space_analyzer_pro_desktop::system_monitor::SystemMonitor;

// ------------------------------------------------------------------------------

/// Test that disk volumes are detected
#[test]
fn disk_volumes_are_detected() {
    let volumes = SystemMonitor::get_disk_volumes();
    assert!(
        !volumes.is_empty(),
        "Should detect at least one disk volume"
    );

    for volume in volumes {
        assert!(volume.total_bytes > 0, "Volume should have total bytes");
        assert!(
            volume.available_bytes <= volume.total_bytes,
            "Available should not exceed total"
        );
    }
}

/// Test that system resources are retrieved
#[test]
fn system_resources_are_retrieved() {
    let resources = SystemMonitor::get_system_resources();

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
}

/// Test that GPU detection works (may return unavailable on systems without GPU)
#[test]
fn gpu_detection_works() {
    let gpu = SystemMonitor::detect_gpu();

    // GPU info should always be returned, even if unavailable
    if gpu.available {
        assert!(gpu.name.is_some(), "Available GPU should have a name");
    }
}

/// Test that format_bytes works correctly
#[test]
fn format_bytes_formats_correctly() {
    use space_analyzer_pro_desktop::gui_common::formatting::format_bytes;

    assert!(format_bytes(1024).contains("KB"));
    assert!(format_bytes(1_048_576).contains("MB"));
    assert!(format_bytes(1_073_741_824).contains("GB"));
    assert!(format_bytes(1_099_511_627_776).contains("TB"));
}
