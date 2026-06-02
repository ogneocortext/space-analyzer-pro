// CUDA kernel for top-K selection and partial sort of file entries
// Uses a parallel radix-select approach: find the K-th largest element
// via histogram-based partitioning, then collect all elements >= threshold

extern "C" __global__ void topk_threshold_kernel(
    const unsigned long long* __restrict__ sizes,
    unsigned long long threshold,
    int* __restrict__ out_indices,
    int* __restrict__ out_count,
    int num_entries
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= num_entries) return;

    if (sizes[idx] >= threshold) {
        int pos = atomicAdd(out_count, 1);
        if (pos < num_entries) {
            out_indices[pos] = idx;
        }
    }
}

// Compute histogram of log2 size buckets for threshold estimation
extern "C" __global__ void size_bucket_histogram_kernel(
    const unsigned long long* __restrict__ sizes,
    unsigned int* __restrict__ bucket_counts,
    int num_entries
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= num_entries) return;

    unsigned long long size = sizes[idx];
    // 64 buckets covering the full range of file sizes
    int bucket = 0;
    if (size > 0) {
        // Find most significant bit via clz
        bucket = 63 - __clzll(size);
    }
    atomicAdd(&bucket_counts[bucket], 1u);
}

// Prefix-sum helper (single-block for small arrays)
extern "C" __global__ void prefix_sum_kernel(
    unsigned int* __restrict__ data,
    int n
) {
    extern __shared__ unsigned int shared[];
    int tid = threadIdx.x;

    // Load into shared memory
    if (tid < n) {
        shared[tid] = data[tid];
    }
    __syncthreads();

    // Sequential prefix sum (single block, n <= 1024)
    for (int i = 1; i < n; i <<= 1) {
        unsigned int val = 0;
        if (tid >= i) {
            val = shared[tid - i];
        }
        __syncthreads();
        if (tid >= i) {
            shared[tid] += val;
        }
        __syncthreads();
    }

    if (tid < n) {
        data[tid] = shared[tid];
    }
}
