use anyhow::{Context, Result};
use cudarc::driver::{CudaContext, CudaFunction};
use cudarc::nvrtc::Ptx;
use std::sync::OnceLock;

static PTX_CACHE: OnceLock<Vec<(String, Vec<u8>)>> = OnceLock::new();

fn load_ptx_files() -> &'static Vec<(String, Vec<u8>)> {
    PTX_CACHE.get_or_init(|| {
        let ptx_dir = option_env!("GPU_PTX_DIR").unwrap_or("kernels");
        let kernel_files = ["histogram.ptx", "topk.ptx", "blake3.ptx", "ml_kernels.ptx"];
        let mut result = Vec::new();
        for name in &kernel_files {
            let path = std::path::Path::new(ptx_dir).join(name);
            if let Ok(data) = std::fs::read(&path) {
                result.push((name.to_string(), data));
            } else {
                // Fall back to kernels/ directory (for dev builds without build.rs)
                let fallback = std::path::Path::new("kernels").join(name);
                if let Ok(data) = std::fs::read(&fallback) {
                    result.push((name.to_string(), data));
                }
            }
        }
        result
    })
}

pub fn get_kernel(
    device: &CudaContext,
    ptx_name: &str,
    kernel_name: &str,
) -> Result<CudaFunction> {
    let ptx_files = load_ptx_files();

    for (name, ptx_data) in ptx_files.iter() {
        if name.as_str() == ptx_name {
            let ptx = Ptx::from_src(std::str::from_utf8(ptx_data).unwrap_or(""));
            let module = device
                .load_module(ptx)
                .with_context(|| format!("failed to load PTX module {name}"))?;
            return module
                .load_function(kernel_name)
                .with_context(|| format!("kernel {kernel_name} not found in module {name}"));
        }
    }

    anyhow::bail!("PTX file {ptx_name} not found")
}
