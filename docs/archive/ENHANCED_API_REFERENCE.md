# Space Analyzer Enhanced API Reference

## 📚 Complete API Documentation

This reference covers all classes, methods, and modern C++20 features introduced in the enhanced Space Analyzer.

---

## 🎯 Core Classes

### `SpaceAnalyzerCore`

Main analysis engine with modern async capabilities and performance monitoring.

#### Constructors

```cpp
// Default constructor with automatic optimization
SpaceAnalyzerCore();

// Enhanced constructor with custom configuration
explicit SpaceAnalyzerCore(const CoreConfig& config);
```

#### Key Methods

##### Async Analysis
```cpp
// Non-blocking directory analysis
std::future<CoreAnalysisResult> AnalyzeDirectoryAsync(const std::string& directoryPath);

// Traditional synchronous analysis (backward compatible)
CoreAnalysisResult AnalyzeDirectory(const std::string& directoryPath);

// Quick analysis for minimal feature set
CoreAnalysisResult QuickAnalyze(const std::string& directoryPath);
```

##### Performance Monitoring
```cpp
// Real-time performance metrics
PerformanceMetrics getPerformanceMetrics() const;

// Current analysis progress
std::map<std::string, std::string> GetProgress() const;

// Core statistics
std::map<std::string, std::string> GetStatistics() const;
```

##### Control Operations
```cpp
// Cancel ongoing analysis
void CancelAnalysis() noexcept;

// Update configuration
void UpdateConfig(const CoreConfig& newConfig);

// Get current configuration
CoreConfig GetConfig() const;
```

##### Dependency Injection
```cpp
// Custom thread pool injection
void setThreadPool(std::unique_ptr<WorkStealingThreadPool> pool);

// Custom cache injection
void setCache(std::unique_ptr<HierarchicalCache> cache);
```

---

### `ThreadSafeResult`

Lock-free thread-safe result accumulator with cache-line optimization.

#### Thread-Safe Operations

```cpp
// Lock-free atomic operations
void incrementFiles() noexcept;
void addSize(uint64_t size) noexcept;
void incrementDirectories() noexcept;
void incrementEmptyDirectories() noexcept;

// Thread-safe getters with memory ordering
uint64_t getTotalFiles() const noexcept;
uint64_t getTotalSize() const noexcept;
uint64_t getTotalDirectories() const noexcept;
uint64_t getEmptyDirectories() const noexcept;
```

#### Data Structure Operations

```cpp
// File type accumulation
void addFileType(const std::string& extension, uint64_t count, uint64_t size = 0);

// Suspicious file tracking
void addSuspiciousFile(const std::string& filePath);

// Thread-safe data retrieval
std::unordered_map<std::string, uint64_t> getFilesByType() const;
std::unordered_map<std::string, uint64_t> getFilesByTypeSize() const;
std::vector<std::string> getSuspiciousFiles() const;
```

---

### `WorkStealingThreadPool`

High-performance thread pool with work-stealing algorithm and automatic cleanup.

#### Constructors

```cpp
// Default constructor with hardware concurrency
explicit WorkStealingThreadPool();

// Custom thread count
explicit WorkStealingThreadPool(size_t threadCount);
```

#### Task Management

```cpp
// Enqueue task with automatic future creation
template<typename Func, typename... Args>
auto enqueue(Func&& func, Args&&... args) 
    -> std::future<std::invoke_result_t<Func, Args...>>;

// Shutdown pool gracefully
void shutdown();

// Get current queue size
size_t getQueueSize() const;

// Get active task count
size_t getActiveTasks() const noexcept;
```

---

### `HierarchicalCache`

Multi-level caching system with LRU eviction and TTL management.

#### Cache Operations

```cpp
// Retrieve cached result
std::optional<CoreAnalysisResult> get(const std::string& key) const;

// Store result with optional TTL
void put(const std::string& key, const CoreAnalysisResult& result, 
         std::chrono::milliseconds ttl = std::chrono::milliseconds::zero());

// Clear all cached data
void clear();
```

#### Configuration

```cpp
// Cache size management
size_t maxL1Size = 100;     // In-memory cache limit
size_t maxL2Size = 1000;    // Disk cache limit
std::chrono::milliseconds defaultTTL{30 * 60 * 1000}; // 30 minutes
```

---

### `CoreAnalysisResult`

Modern analysis result structure with thread-safe data access.

#### Data Accessors

```cpp
// Thread-safe data access
uint64_t totalFiles() const noexcept;
uint64_t totalSize() const noexcept;
uint64_t totalDirectories() const noexcept;
uint64_t emptyDirectories() const noexcept;
auto filesByType() const;
auto filesByTypeSize() const;
auto suspiciousFiles() const;

// Timing information
std::chrono::milliseconds analysisTime() const;
```

#### Enhanced Data

```cpp
// Additional result data
std::vector<std::pair<std::string, uint64_t>> largestFiles;
std::vector<std::string> emptyDirectoryList;
std::map<std::string, std::string> fileMetadata;
std::string summary;
std::map<std::string, std::string> recommendations;
```

---

### `PerformanceConfig`

Modern performance configuration with environment integration.

#### Configuration Options

```cpp
// SIMD and vectorization
bool enableSIMD = true;
size_t simdBatchSize = 16;

// Memory management
size_t memoryMapThreshold = 100 * 1024 * 1024; // 100MB
size_t maxMemoryMapping = 1024 * 1024 * 1024;  // 1GB

// Threading
size_t optimalThreadCount = std::jthread::hardware_concurrency();
bool enableWorkStealing = true;

// Caching
size_t maxCacheSize = 256 * 1024 * 1024; // 256MB
std::chrono::minutes cacheTimeout{30};

// GPU acceleration
bool enableGPUAcceleration = false;
size_t gpuBatchSize = 1000;
```

#### Environment Integration

```cpp
// Load configuration from environment variables
static PerformanceConfig fromEnvironment();

// Configuration validation
void validate();
```

---

### `CoreConfig`

Enhanced core configuration with validation and modern features.

#### Basic Settings

```cpp
// Analysis parameters
size_t maxDepth = 10;
size_t minFileSize = 0;
bool showHidden = false;

// Performance settings
size_t threadCount = std::thread::hardware_concurrency();
size_t batchSize = 1000;

// Feature flags
bool enableSecurityScan = true;
bool enablePerformanceMonitoring = true;
bool enableContextAnalysis = true;
bool enableMemoryOptimization = true;
bool enableGPUAcceleration = false;
bool enableSIMD = true;
bool enableLockFree = true;
```

#### Exclusion Lists

```cpp
// Directories to exclude from analysis
std::vector<std::string> excludedDirectories = {
    "node_modules", ".git", "dist", "build", ".next", ".nuxt",
    ".cache", ".electron", ".vscode", "tmp", "temp", ".vs",
    "target", "bin", "obj"
};

// File extensions to exclude
std::vector<std::string> excludedExtensions = {
    ".log", ".tmp", ".cache", ".swp", ".bak", ".tmp", ".temp"
};
```

---

## 🛠️ Utility Functions

### `CoreUtils`

Modern utility functions with C++20 features.

#### File Processing

```cpp
// Modern byte formatting with concepts
template<typename T>
requires std::integral<T> || std::floating_point<T>
std::string FormatBytes(T bytes);

// Duration formatting
std::string FormatDuration(std::chrono::milliseconds duration);

// File type detection with structured bindings
std::pair<std::string, std::string> DetectFileTypeAndCategory(const fs::path& path);

// Legacy compatibility
std::string DetectFileType(const fs::path& path);
```

#### Complexity Analysis

```cpp
// Modern complexity calculation with concepts
template<typename Path>
requires std::same_as<Path, fs::path> || std::same_as<Path, std::string>
double CalculateFileComplexity(const Path& path);

// Parallel statistics calculation
template<typename Iterator>
requires std::random_access_iterator<Iterator>
auto CalculateStatisticsParallel(Iterator begin, Iterator end);
```

#### Legacy Compatibility

```cpp
// Traditional utility functions
std::map<std::string, double> CalculateStatistics(const CoreAnalysisResult& result);
std::chrono::seconds EstimateAnalysisTime(const std::string& path);
```

---

## 🚀 GPU Acceleration

### `IGPUAccelerator`

Abstract GPU acceleration interface.

#### Interface Methods

```cpp
// GPU availability check
virtual bool isAvailable() const noexcept = 0;

// Lifecycle management
virtual void initialize() = 0;
virtual void shutdown() = 0;

// GPU processing operations
virtual void processFilesOnGPU(const std::vector<fs::path>& files) = 0;
virtual std::vector<uint64_t> getFileSizes(const std::vector<fs::path>& files) = 0;
```

### `CUDAAccelerator`

CUDA implementation of GPU acceleration.

#### CUDA-Specific Features

```cpp
// CUDA stream management
cudaStream_t stream;

// CUDA error handling
cudaError_t lastError;

// Memory management on GPU
void* gpuMemory;
size_t gpuMemorySize;
```

---

## 💾 Memory Management

### `MemoryMappedProcessor`

Efficient large file processing with memory mapping.

#### Core Operations

```cpp
// File mapping
static FileMapping mapFile(const fs::path& filePath);

// Content extraction
static std::string extractTextContent(const FileMapping& mapping, 
                                     size_t maxSize = 1024 * 1024);

// File mapping structure
struct FileMapping {
    void* data = nullptr;
    size_t size = 0;
    bool isMapped = false;
    
    // Automatic cleanup
    ~FileMapping();
};
```

---

## 📊 Performance Monitoring

### `PerformanceMetrics`

Real-time performance tracking structure.

#### Metrics Data

```cpp
struct PerformanceMetrics {
    std::chrono::milliseconds analysisTime;
    size_t filesPerSecond;
    double throughputMBps;
    size_t memoryUsageMB;
    size_t activeThreads;
    size_t cachedResults;
};
```

---

## 🔧 Modern C++20 Features Used

### Concepts

```cpp
// Type safety with C++20 concepts
template<typename T>
concept NumericType = std::integral<T> || std::floating_point<T>;

template<typename T>
concept StringLike = std::constructible_from<std::string, T>;

template<typename T>
concept FileSystemPath = std::same_as<T, fs::path> || std::same_as<T, std::string>;
```

### Structured Bindings

```cpp
// Modern file type detection
auto [extension, category] = CoreUtils::DetectFileTypeAndCategory(filePath);
```

### RAII and Smart Pointers

```cpp
// Automatic resource management
std::unique_ptr<WorkStealingThreadPool> threadPool;
std::unique_ptr<HierarchicalCache> resultCache;
std::unique_ptr<IGPUAccelerator> gpuAccelerator;
```

### Lock-Free Programming

```cpp
// Cache-line aligned atomic counters
struct alignas(64) AlignedCounter {
    std::atomic<uint64_t> value{0};
    char padding[56]; // Prevent false sharing
};
```

### Parallel Algorithms

```cpp
// SIMD and parallel execution
std::minmax_element(std::execution::par_unseq, begin, end);
std::reduce(std::execution::par_unseq, begin, end, value_type{});
```

### Async/Await Pattern

```cpp
// Modern async operations
std::future<CoreAnalysisResult> future = 
    analyzer.AnalyzeDirectoryAsync(path);
auto result = future.get();
```

---

## 📝 Usage Examples

### Complete Modern Usage

```cpp
#include "space-analyzer-core-modern.h"

int main() {
    // 1. Configure performance settings
    CoreConfig config;
    config.enableSIMD = true;
    config.enableGPUAcceleration = true;
    config.threadCount = std::jthread::hardware_concurrency();
    
    // 2. Initialize enhanced analyzer
    SpaceAnalyzerCore analyzer(config);
    
    // 3. Async analysis with progress monitoring
    auto future = analyzer.AnalyzeDirectoryAsync("/path/to/project");
    
    // 4. Monitor progress
    while (future.wait_for(std::chrono::seconds(1)) != std::future_status::ready) {
        auto progress = analyzer.GetProgress();
        std::cout << "Progress: " << progress["percentage"] << "%" << std::endl;
    }
    
    // 5. Get results
    auto result = future.get();
    
    // 6. Performance metrics
    auto metrics = analyzer.getPerformanceMetrics();
    std::cout << "Performance: " << metrics.filesPerSecond << " files/sec" << std::endl;
    
    // 7. Generate report
    std::string report = analyzer.GenerateReport(result);
    std::cout << report << std::endl;
    
    return 0;
}
```

### High-Performance Batch Processing

```cpp
// Process multiple directories concurrently
std::vector<std::string> directories = {
    "/project/src", "/project/build", "/project/tests"
};

std::vector<std::future<CoreAnalysisResult>> futures;
for (const auto& dir : directories) {
    futures.push_back(analyzer.AnalyzeDirectoryAsync(dir));
}

// Aggregate results
uint64_t totalFiles = 0;
uint64_t totalSize = 0;
for (auto& future : futures) {
    auto result = future.get();
    totalFiles += result.totalFiles();
    totalSize += result.totalSize();
}
```

### Memory-Efficient Large Dataset Analysis

```cpp
// Configure for memory efficiency
CoreConfig config;
config.enableMemoryOptimization = true;
config.memoryMapThreshold = 100 * 1024 * 1024; // 100MB
config.maxMemoryMapping = 1024 * 1024 * 1024;  // 1GB

SpaceAnalyzerCore analyzer(config);
auto result = analyzer.AnalyzeDirectory("/huge/dataset");
```

---

## 🔄 Migration Guide

### From Legacy API

| Legacy Method | Modern Equivalent | Notes |
|---------------|-------------------|-------|
| `AnalyzeDirectory()` | `AnalyzeDirectory()` | Still supported, backward compatible |
| - | `AnalyzeDirectoryAsync()` | New async version |
| - | `getPerformanceMetrics()` | New performance monitoring |
| - | `setThreadPool()` | New dependency injection |
| - | `UpdateConfig()` | New configuration management |

### Breaking Changes

- None - all existing APIs are preserved
- New features are additions, not replacements
- Enhanced performance without API changes

---

*This API reference covers all features introduced in the enhanced Space Analyzer. For additional details, see the implementation files and test suite.*