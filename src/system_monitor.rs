//! System monitoring for Space Analyzer Pro
//!
//! Provides disk usage information, system resource monitoring,
//! and hardware detection (GPU status).

use serde::{Deserialize, Serialize};

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
    pub cpu_model: String,
    pub cpu_cores: usize,
    pub cpu_physical_cores: usize,
    pub memory_total_bytes: u64,
    pub memory_used_bytes: u64,
    pub memory_percent: f32,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

/// GPU information
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
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

        let cpu_usage = system.global_cpu_usage();

        SystemResources {
            cpu_percent: cpu_usage,
            cpu_model: system
                .cpus()
                .first()
                .map(|c| c.brand().to_string())
                .unwrap_or_default(),
            cpu_cores: system.cpus().len(),
            cpu_physical_cores: sysinfo::System::physical_core_count().unwrap_or(0),
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

    /// Detect GPU availability via nvidia-smi
    pub fn detect_gpu() -> GpuInfo {
        // Try to get GPU info via nvidia-smi
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=name,memory.total", "--format=csv,noheader"])
            .output()
        {
            if output.status.success() {
                if let Ok(info) = String::from_utf8(output.stdout) {
                    let lines: Vec<&str> = info.lines().collect();
                    if !lines.is_empty() {
                        let parts: Vec<&str> = lines[0].split(',').map(|s| s.trim()).collect();
                        if parts.len() >= 2 {
                            let mem_str = parts[1].trim_end_matches(" MiB");
                            let vram_mb = mem_str.parse::<u64>().unwrap_or(0);
                            return GpuInfo {
                                available: true,
                                name: Some(parts[0].to_string()),
                                vram_bytes: Some(vram_mb * 1024 * 1024),
                                cuda_version: Self::get_cuda_version(),
                            };
                        }
                    }
                }
            }
        }
        GpuInfo::default()
    }

    /// Get CUDA version via nvidia-smi
    fn get_cuda_version() -> Option<String> {
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .args(["--version"])
            .output()
        {
            if let Ok(s) = String::from_utf8(output.stdout) {
                if let Some(line) = s.lines().find(|l| l.contains("CUDA Version")) {
                    let parts: Vec<&str> = line.split("CUDA Version:").collect();
                    if parts.len() > 1 {
                        return Some(parts[1].trim().to_string());
                    }
                }
            }
        }
        None
    }

    /// Get a formatted system summary
    pub fn get_system_summary() -> String {
        let resources = Self::get_system_resources();
        let volumes = Self::get_disk_volumes();
        let gpu = Self::detect_gpu();

        let mut summary = String::new();
        summary.push_str(&format!(
            "CPU: {} ({:.1}%)\n",
            resources.cpu_model, resources.cpu_percent
        ));
        summary.push_str(&format!(
            "Memory: {} / {} ({:.1}%)\n",
            shared_scanner::format_bytes(resources.memory_used_bytes),
            shared_scanner::format_bytes(resources.memory_total_bytes),
            resources.memory_percent
        ));

        if !volumes.is_empty() {
            let primary = &volumes[0];
            summary.push_str(&format!(
                "Disk ({}): {} / {} ({:.1}%)\n",
                primary.mount_point,
                shared_scanner::format_bytes(primary.used_bytes),
                shared_scanner::format_bytes(primary.total_bytes),
                primary.usage_percent
            ));
        }

        if gpu.available {
            summary.push_str(&format!(
                "GPU: {} ({})\n",
                gpu.name.as_deref().unwrap_or("Unknown"),
                gpu.vram_bytes
                    .map(shared_scanner::format_bytes)
                    .unwrap_or("Unknown".to_string())
            ));
        }

        summary
    }
}
