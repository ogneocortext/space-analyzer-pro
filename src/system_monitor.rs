//! System monitoring for Space Analyzer Pro
//! 
//! Provides disk usage information, system resource monitoring,
//! and hardware detection (GPU status).

use serde::{Serialize, Deserialize};

/// Disk volume information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskVolume {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub usage_percent: f32,
    pub file_system: String,
}

/// System resource usage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemResources {
    pub cpu_percent: f32,
    pub memory_total_bytes: u64,
    pub memory_used_bytes: u64,
    pub memory_percent: f32,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

/// GPU information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub available: bool,
    pub name: Option<String>,
    pub vram_bytes: Option<u64>,
    pub cuda_version: Option<String>,
}

/// System monitor
pub struct SystemMonitor;

impl SystemMonitor {
    /// Get all disk volumes
    pub fn get_disk_volumes() -> Vec<DiskVolume> {
        let mut volumes = Vec::new();
        
        let disks = sysinfo::Disks::new_with_refreshed_list();
        
        for disk in &disks {
            let total = disk.total_space();
            let available = disk.available_space();
            let used = total.saturating_sub(available);
            let usage = if total > 0 {
                (used as f32 / total as f32) * 100.0
            } else {
                0.0
            };

            volumes.push(DiskVolume {
                name: disk.name().to_string_lossy().to_string(),
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                total_bytes: total,
                available_bytes: available,
                used_bytes: used,
                usage_percent: usage,
                file_system: disk.file_system().to_string_lossy().to_string(),
            });
        }

        volumes
    }

    /// Get system resource usage
    pub fn get_system_resources() -> SystemResources {
        let mut system = sysinfo::System::new_all();
        system.refresh_all();

        let memory = system.total_memory();
        let memory_used = system.used_memory();
        let swap_total = system.total_swap();
        let swap_used = system.used_swap();

        SystemResources {
            cpu_percent: system.global_cpu_info().cpu_usage(),
            memory_total_bytes: memory,
            memory_used_bytes: memory_used,
            memory_percent: if memory > 0 {
                (memory_used as f32 / memory as f32) * 100.0
            } else {
                0.0
            },
            swap_total_bytes: swap_total,
            swap_used_bytes: swap_used,
        }
    }

    /// Detect GPU information
    pub fn detect_gpu() -> GpuInfo {
        // Try nvidia-smi first
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let lines: Vec<&str> = stdout.lines().collect();
                
                if let Some(first_line) = lines.first() {
                    let parts: Vec<&str> = first_line.split(',').collect();
                    if parts.len() >= 2 {
                        let name = parts[0].trim().to_string();
                        let vram_mb: u64 = parts[1].trim().parse().unwrap_or(0);
                        
                        return GpuInfo {
                            available: true,
                            name: Some(name),
                            vram_bytes: Some(vram_mb * 1024 * 1024),
                            cuda_version: None,
                        };
                    }
                }
            }
        }

        GpuInfo {
            available: false,
            name: None,
            vram_bytes: None,
            cuda_version: None,
        }
    }

    /// Get a formatted system summary
    pub fn get_system_summary() -> String {
        let resources = Self::get_system_resources();
        let volumes = Self::get_disk_volumes();
        let gpu = Self::detect_gpu();

        let mut summary = String::new();
        summary.push_str(&format!("CPU: {:.1}%\n", resources.cpu_percent));
        summary.push_str(&format!("Memory: {} / {} ({:.1}%)\n",
            format_bytes(resources.memory_used_bytes),
            format_bytes(resources.memory_total_bytes),
            resources.memory_percent
        ));
        
        if !volumes.is_empty() {
            let primary = &volumes[0];
            summary.push_str(&format!("Disk ({}): {} / {} ({:.1}%)\n",
                primary.mount_point,
                format_bytes(primary.used_bytes),
                format_bytes(primary.total_bytes),
                primary.usage_percent
            ));
        }

        if gpu.available {
            summary.push_str(&format!("GPU: {} ({})\n",
                gpu.name.as_deref().unwrap_or("Unknown"),
                gpu.vram_bytes.map(|b| format_bytes(b)).unwrap_or("Unknown".to_string())
            ));
        }

        summary
    }
}

/// Format bytes to human-readable string
pub fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_099_511_627_776 {
        format!("{:.2} TB", bytes as f64 / 1_099_511_627_776.0)
    } else if bytes >= 1_073_741_824 {
        format!("{:.2} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.2} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1_024 {
        format!("{:.2} KB", bytes as f64 / 1_024.0)
    } else {
        format!("{} B", bytes)
    }
}
