//! GPU device detection and information

use serde::{Deserialize, Serialize};

/// GPU device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub available: bool,
    pub device_name: String,
    pub compute_capability: String,
    pub total_memory_mb: u64,
    pub cuda_version: String,
    pub device_count: usize,
}

impl Default for GpuInfo {
    fn default() -> Self {
        Self {
            available: false,
            device_name: String::new(),
            compute_capability: String::new(),
            total_memory_mb: 0,
            cuda_version: String::new(),
            device_count: 0,
        }
    }
}

impl GpuInfo {
    /// Detect available GPU devices
    pub fn detect() -> Self {
        #[cfg(feature = "cuda")]
        {
            use cudarc::driver::CudaDevice;
            
            match CudaDevice::new(0) {
                Ok(device) => {
                    let props = device.properties();
                    let total_mem = device.primary_ctx().total_mem();
                    let total_mem_mb = total_mem / (1024 * 1024);
                    
                    Self {
                        available: true,
                        device_name: props.name.clone(),
                        compute_capability: format!("{}.{}", props.major, props.minor),
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
                .args(["--query-gpu=name,memory.total,compute_cap", "--format=csv,noheader"])
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
        Self::detect().available
    }
}

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
