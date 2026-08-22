//! GPU device detection and information

use serde::{Deserialize, Serialize};

/// GPU device information
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GpuInfo {
    pub available: bool,
    pub device_name: String,
    pub compute_capability: String,
    pub total_memory_mb: u64,
    pub cuda_version: String,
    pub device_count: usize,
}

use std::sync::OnceLock;
static GPU_AVAILABLE: OnceLock<bool> = OnceLock::new();

impl GpuInfo {
    /// Detect available GPU devices
    pub fn detect() -> Self {
        #[cfg(feature = "cuda")]
        {
            use cudarc::driver::CudaContext;

            match CudaContext::new(0) {
                Ok(device) => {
                    let name = device.name().unwrap_or_default();
                    let total_mem = device.total_mem().unwrap_or(0);
                    let (major, minor) = device.compute_capability().unwrap_or((0, 0));
                    let total_mem_mb = (total_mem / (1024 * 1024)) as u64;

                    Self {
                        available: true,
                        device_name: name,
                        compute_capability: format!("{major}.{minor}"),
                        total_memory_mb: total_mem_mb,
                        cuda_version: "12.0+".to_string(),
                        device_count: 1,
                    }
                }
                Err(_) => Self::default(),
            }
        }

        #[cfg(not(feature = "cuda"))]
        {
            // Check for NVIDIA GPU via nvidia-smi
            if let Ok(output) = std::process::Command::new("nvidia-smi")
                .args([
                    "--query-gpu=name,memory.total,compute_cap",
                    "--format=csv,noheader",
                ])
                .output()
            {
                if output.status.success() {
                    if let Ok(info) = String::from_utf8(output.stdout) {
                        let lines: Vec<&str> = info.lines().collect();
                        if !lines.is_empty() {
                            let parts: Vec<&str> = lines[0].split(',').map(|s| s.trim()).collect();
                            if parts.len() >= 3 {
                                let mem_str = parts[1].trim_end_matches(" MiB");
                                let total_mem_mb = mem_str.parse::<u64>().unwrap_or(0);

                                return Self {
                                    available: true,
                                    device_name: parts[0].to_string(),
                                    compute_capability: parts[2].to_string(),
                                    total_memory_mb: total_mem_mb,
                                    cuda_version: get_cuda_version(),
                                    device_count: lines.len(),
                                };
                            }
                        }
                    }
                }
            }
            Self::default()
        }
    }

    /// Check if GPU acceleration is available
    pub fn is_available() -> bool {
        *GPU_AVAILABLE.get_or_init(|| {
            #[cfg(feature = "cuda")]
            {
                use cudarc::driver::CudaContext;
                CudaContext::new(0).is_ok()
            }
            #[cfg(not(feature = "cuda"))]
            {
                std::process::Command::new("nvidia-smi")
                    .args(["--query-gpu=name", "--format=csv,noheader"])
                    .output()
                    .map(|o| o.status.success())
                    .unwrap_or(false)
            }
        })
    }
}

#[cfg(not(feature = "cuda"))]
fn get_cuda_version() -> String {
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .args(["--version"])
        .output()
    {
        if let Ok(s) = String::from_utf8(output.stdout) {
            if let Some(line) = s.lines().find(|l| l.contains("CUDA Version")) {
                let parts: Vec<&str> = line.split("CUDA Version:").collect();
                if parts.len() > 1 {
                    return parts[1].trim().to_string();
                }
            }
        }
    }
    "unknown".to_string()
}
