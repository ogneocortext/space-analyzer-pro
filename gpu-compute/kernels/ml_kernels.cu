// CUDA kernels for GPU-accelerated ML operations
// Linear regression: matrix multiplication and solve
// K-Means: distance computation and centroid update

// Matrix multiplication kernel (for X^T X computation)
// Used in linear regression normal equation
extern "C" __global__ void matmul_kernel(
    const double* __restrict__ A,
    const double* __restrict__ B,
    double* __restrict__ C,
    int M, int K, int N
) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < M && col < N) {
        double sum = 0.0;
        for (int k = 0; k < K; k++) {
            sum += A[row * K + k] * B[col + k * N];
        }
        C[row * N + col] = sum;
    }
}

// Matrix-vector multiplication kernel (for X^T y)
extern "C" __global__ void matvec_mul_kernel(
    const double* __restrict__ A,
    const double* __restrict__ x,
    double* __restrict__ y,
    int M, int N
) {
    int row = blockIdx.x * blockDim.x + threadIdx.x;
    if (row < M) {
        double sum = 0.0;
        for (int j = 0; j < N; j++) {
            sum += A[row * N + j] * x[j];
        }
        y[row] = sum;
    }
}

// K-Means: compute distances from all points to all centroids
// Output: nearest_centroid for each point
extern "C" __global__ void kmeans_distance_kernel(
    const double* __restrict__ data,
    const double* __restrict__ centroids,
    int* __restrict__ assignments,
    int n, int k, int dims
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= n) return;

    int nearest = 0;
    double min_dist = __DBL_MAX__;

    for (int c = 0; c < k; c++) {
        double dist = 0.0;
        for (int d = 0; d < dims; d++) {
            double diff = data[idx * dims + d] - centroids[c * dims + d];
            dist += diff * diff;
        }
        if (dist < min_dist) {
            min_dist = dist;
            nearest = c;
        }
    }

    assignments[idx] = nearest;
}

// K-Means: sum points assigned to each centroid (reduction-like)
// Used for centroid update step
extern "C" __global__ void kmeans_centroid_sum_kernel(
    const double* __restrict__ data,
    const int* __restrict__ assignments,
    double* __restrict__ centroid_sums,
    int* __restrict__ centroid_counts,
    int n, int k, int dims
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= n) return;

    int cluster = assignments[idx];
    if (cluster >= 0 && cluster < k) {
        for (int d = 0; d < dims; d++) {
            atomicAdd(&centroid_sums[cluster * dims + d], data[idx * dims + d]);
        }
        atomicAdd(&centroid_counts[cluster], 1);
    }
}
