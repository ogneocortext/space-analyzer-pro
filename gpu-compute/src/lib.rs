//! GPU-accelerated compute primitives for Space Analyzer
//!
//! Provides CUDA-accelerated implementations for:
//! - BLAKE3 batch file hashing (deduplication)
//! - ML model training (storage prediction)
//! - Scan post-processing (extension extraction, histograms, sorting)
//! - Parallel data processing kernels
//!
//! Falls back to optimized CPU implementations when CUDA is unavailable.

pub mod hash;
pub mod ml;
pub mod scan;
pub mod device;

pub use device::GpuInfo;
pub use hash::BatchHasher;
pub use ml::GpuAcceleratedML;
pub use scan::GpuScanProcessor;
