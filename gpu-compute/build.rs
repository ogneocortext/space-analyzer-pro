fn main() {
    #[cfg(feature = "cuda")]
    compile_cuda_kernels();

    #[cfg(not(feature = "cuda"))]
    {
        println!("cargo:warning=CUDA feature disabled — skipping kernel compilation");
    }
}

#[cfg(feature = "cuda")]
fn compile_cuda_kernels() {
    use std::env;
    use std::path::PathBuf;
    use std::process::Command;

    println!("cargo:rerun-if-changed=kernels/");

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let kernel_dir = PathBuf::from("kernels");
    let ptx_dir = out_dir.join("ptx");
    std::fs::create_dir_all(&ptx_dir).expect("failed to create ptx output directory");

    let kernels = ["histogram.cu", "topk.cu", "blake3.cu", "ml_kernels.cu"];

    let nvcc = find_nvcc();

    for kernel in &kernels {
        let src = kernel_dir.join(kernel);
        let ptx_name = kernel.replace(".cu", ".ptx");
        let dst = ptx_dir.join(&ptx_name);

        println!(
            "cargo:warning=Compiling CUDA kernel: {} -> {}",
            kernel,
            dst.display()
        );

        let status = Command::new(&nvcc)
            .args(["--ptx", "-O3", "--use_fast_math", "-arch=sm_60", "-o"])
            .arg(&dst)
            .arg(&src)
            .status()
            .expect("failed to execute nvcc");

        if !status.success() {
            panic!(
                "CUDA kernel compilation failed for {}. \
                 Ensure CUDA toolkit is installed and nvcc is in PATH. \
                 You can also disable the 'cuda' feature.",
                kernel
            );
        }

        println!("cargo:warning=  ✓ {} compiled successfully", kernel);
    }

    println!("cargo:rustc-env=GPU_PTX_DIR={}", ptx_dir.display());
    println!("cargo:rerun-if-changed=kernels/");
    println!("cargo:rustc-cfg=gpu_kernels_compiled");
}

#[cfg(feature = "cuda")]
fn find_nvcc() -> String {
    use std::env;
    use std::path::PathBuf;

    if let Ok(cuda_path) = env::var("CUDA_PATH") {
        let candidate = PathBuf::from(&cuda_path).join("bin").join("nvcc.exe");
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }
    "nvcc.exe".to_string()
}
