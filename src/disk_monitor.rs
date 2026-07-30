//! Background disk space monitor
//!
//! Periodically samples disk usage and records snapshots to the database.
//! When a significant change occurs (delta > threshold), captures the top
//! processes by disk I/O and file size to help identify the cause.

use crate::database::Database;
use crate::system_monitor::SystemMonitor;
use serde::{Deserialize, Serialize};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

/// Message sent from the background monitor thread to the GUI
#[derive(Debug, Clone)]
pub enum DiskMonitorMessage {
    /// A new snapshot was recorded
    SnapshotRecorded {
        mount_point: String,
        available_bytes: u64,
        used_bytes: u64,
        usage_percent: f32,
    },
    /// A significant change was detected
    SignificantChange {
        mount_point: String,
        delta_bytes: i64,
        top_processes: Vec<ProcessInfo>,
    },
}

/// Process information captured during a significant disk change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub disk_read_bytes: u64,
    pub disk_write_bytes: u64,
    pub memory_bytes: u64,
}

/// In-memory state for the disk monitor (accessed from GUI thread)
#[derive(Default)]
pub struct DiskMonitorState {
    pub snapshots: Vec<SnapshotEntry>,
    pub last_change: Option<SignificantChange>,
    pub is_running: bool,
    pub receiver: Option<mpsc::Receiver<DiskMonitorMessage>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotEntry {
    pub timestamp: String,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub usage_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignificantChange {
    pub mount_point: String,
    pub delta_bytes: i64,
    pub top_processes: Vec<ProcessInfo>,
    pub timestamp: String,
}

/// Get top processes sorted by disk usage (read + write bytes)
fn get_top_processes(limit: usize) -> Vec<ProcessInfo> {
    let mut system = sysinfo::System::new_all();
    system.refresh_all();
    // Brief pause to let I/O counters accumulate
    thread::sleep(Duration::from_millis(100));
    system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut processes: Vec<ProcessInfo> = system
        .processes()
        .iter()
        .map(|(pid, proc_info)| {
            let disk_usage = proc_info.disk_usage();
            ProcessInfo {
                name: proc_info.name().to_string_lossy().to_string(),
                pid: pid.as_u32(),
                disk_read_bytes: disk_usage.read_bytes,
                disk_write_bytes: disk_usage.written_bytes,
                memory_bytes: proc_info.memory(),
            }
        })
        .collect();

    // Sort by total disk I/O descending
    processes.sort_by(|a, b| {
        (b.disk_read_bytes + b.disk_write_bytes).cmp(&(a.disk_read_bytes + a.disk_write_bytes))
    });
    processes.truncate(limit);
    processes
}

/// Start the background disk monitor thread
pub fn start_disk_monitor(
    mount_point: String,
    interval_secs: u64,
    change_threshold_mb: u64,
) -> mpsc::Receiver<DiskMonitorMessage> {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        // Open our own database connection (rusqlite::Connection is Send but not Sync)
        let db_path = Database::default_path();
        let db = match Database::open(db_path) {
            Ok(db) => db,
            Err(e) => {
                eprintln!("Disk monitor: failed to open database: {}", e);
                return;
            }
        };

        // Take an initial snapshot to establish baseline
        let volumes = SystemMonitor::get_disk_volumes();
        let mut last_used = volumes
            .iter()
            .find(|v| v.mount_point == mount_point)
            .map(|v| v.used_bytes)
            .unwrap_or(0);

        loop {
            thread::sleep(Duration::from_secs(interval_secs));

            let volumes = SystemMonitor::get_disk_volumes();
            let current = volumes.iter().find(|v| v.mount_point == mount_point);
            let Some(current) = current else {
                continue;
            };

            let used = current.used_bytes;
            let available = current.available_bytes;
            let total = current.total_bytes;
            let usage = current.usage_percent;

            // Capture top processes BEFORE recording (so we have fresh data)
            let top_processes = get_top_processes(5);
            let top_json = serde_json::to_string(&top_processes).unwrap_or_default();

            // Record snapshot to database
            let _ = db.record_disk_snapshot(&mount_point, total, available, used, usage, &top_json);

            // Prune entries older than 24 hours periodically
            let _ = db.prune_disk_space_history(24);

            // Check for significant change
            let delta = used as i64 - last_used as i64;
            let threshold_bytes = change_threshold_mb * 1024 * 1024;

            if delta.unsigned_abs() > threshold_bytes {
                // Capture more detailed process list for significant changes
                let detailed_processes = get_top_processes(10);
                let _ = tx.send(DiskMonitorMessage::SignificantChange {
                    mount_point: mount_point.clone(),
                    delta_bytes: delta,
                    top_processes: detailed_processes,
                });
            } else {
                let _ = tx.send(DiskMonitorMessage::SnapshotRecorded {
                    mount_point: mount_point.clone(),
                    available_bytes: available,
                    used_bytes: used,
                    usage_percent: usage,
                });
            }

            last_used = used;
        }
    });

    rx
}
