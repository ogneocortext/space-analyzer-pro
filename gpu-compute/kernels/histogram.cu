// CUDA kernel for computing file size histograms and file type counts
// Each thread processes one file entry, atomically incrementing buckets

extern "C" __global__ void histogram_kernel(
    const unsigned long long* __restrict__ sizes,
    const int* __restrict__ ext_ids,
    unsigned int* __restrict__ size_histogram,
    unsigned int* __restrict__ type_counts,
    int num_buckets,
    int num_entries
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= num_entries) return;

    unsigned long long size = sizes[idx];

    // Determine size bucket (same boundaries as size_bucket() in Rust)
    int bucket;
    if (size == 0) bucket = 0;
    else if (size < 1024) bucket = 1;
    else if (size < 10 * 1024) bucket = 2;
    else if (size < 100 * 1024) bucket = 3;
    else if (size < 1024 * 1024) bucket = 4;
    else if (size < 10ULL * 1024 * 1024) bucket = 5;
    else if (size < 100ULL * 1024 * 1024) bucket = 6;
    else if (size < 1024ULL * 1024 * 1024) bucket = 7;
    else bucket = 8;

    if (bucket < num_buckets) {
        atomicAdd(&size_histogram[bucket], 1u);
    }

    // Increment file type count (extension ID)
    // ext_id >= 0 means valid extension, -1 means no extension
    int eid = ext_ids[idx];
    if (eid >= 0) {
        atomicAdd(&type_counts[eid], 1u);
    }
}

// Reduction kernel to compute total size per extension
extern "C" __global__ void extension_size_kernel(
    const unsigned long long* __restrict__ sizes,
    const int* __restrict__ ext_ids,
    unsigned long long* __restrict__ ext_sizes,
    int num_entries
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= num_entries) return;

    int eid = ext_ids[idx];
    if (eid >= 0) {
        atomicAdd(&ext_sizes[eid], sizes[idx]);
    }
}
