// Advanced Memory Management for C++ 2025-2026
// Features: Arena allocation, custom allocators, memory pools, C++26 features

#pragma once

#include <memory>
#include <vector>
#include <unordered_map>
#include <memory_resource>
#include <new>
#include <mutex>
#include <atomic>
#include <concepts>
#include <ranges>

// C++26 Contract-based optimization hints
#ifdef __cpp_contracts
#define CONTRACT_PRE(condition) [[pre: condition]]
#define CONTRACT_POST(condition) [[post: condition]]
#else
#define CONTRACT_PRE(condition)
#define CONTRACT_POST(condition)
#endif

namespace SpaceAnalyzer {

// ============================================================================
// ARENA ALLOCATOR - Zero-allocation patterns for hot paths
// ============================================================================

template<typename T>
class ArenaAllocator {
private:
    std::vector<std::unique_ptr<char[]>> arenas_;
    size_t arena_size_;
    size_t current_offset_;
    std::mutex mutex_; // Thread safety for concurrent allocations

public:
    explicit ArenaAllocator(size_t arena_size = 64 * 1024) // 64KB arenas
        : arena_size_(arena_size), current_offset_(0) {
        allocate_new_arena();
    }

    T* allocate() {
        std::lock_guard<std::mutex> lock(mutex_);

        constexpr size_t alignment = alignof(T);
        size_t aligned_offset = (current_offset_ + alignment - 1) & ~(alignment - 1);

        if (aligned_offset + sizeof(T) > arena_size_) {
            allocate_new_arena();
            aligned_offset = 0;
        }

        T* ptr = reinterpret_cast<T*>(&arenas_.back()[aligned_offset]);
        current_offset_ = aligned_offset + sizeof(T);
        return ptr;
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        arenas_.clear();
        current_offset_ = 0;
        allocate_new_arena();
    }

    size_t memory_usage() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return arenas_.size() * arena_size_;
    }

private:
    void allocate_new_arena() {
        arenas_.emplace_back(new char[arena_size_]);
        current_offset_ = 0;
    }
};

// ============================================================================
// MEMORY POOL - Efficient allocation for frequent small objects
// ============================================================================

class MemoryPool {
private:
    struct FreeBlock {
        FreeBlock* next;
    };

    std::vector<char*> blocks_;
    FreeBlock* free_list_;
    size_t block_size_;
    size_t object_size_;
    std::mutex mutex_;

public:
    MemoryPool(size_t object_size, size_t block_size = 4096)
        : free_list_(nullptr), block_size_(block_size),
          object_size_(std::max(object_size, sizeof(FreeBlock))) {}

    ~MemoryPool() {
        for (auto block : blocks_) {
            delete[] block;
        }
    }

    void* allocate() {
        std::lock_guard<std::mutex> lock(mutex_);

        if (!free_list_) {
            allocate_block();
        }

        void* ptr = free_list_;
        free_list_ = free_list_->next;
        return ptr;
    }

    void deallocate(void* ptr) {
        std::lock_guard<std::mutex> lock(mutex_);

        auto free_block = static_cast<FreeBlock*>(ptr);
        free_block->next = free_list_;
        free_list_ = free_block;
    }

private:
    void allocate_block() {
        char* block = new char[block_size_];
        blocks_.push_back(block);

        // Link all objects in the block into free list
        size_t num_objects = block_size_ / object_size_;
        for (size_t i = 0; i < num_objects; ++i) {
            char* obj_ptr = block + i * object_size_;
            auto free_block = reinterpret_cast<FreeBlock*>(obj_ptr);
            free_block->next = free_list_;
            free_list_ = free_block;
        }
    }
};

// ============================================================================
// POLYMORPHIC MEMORY RESOURCE - C++17 PMR with optimizations
// ============================================================================

class OptimizedMemoryResource : public std::pmr::memory_resource {
private:
    std::pmr::monotonic_buffer_resource monotonic_{1024 * 1024}; // 1MB buffer
    std::pmr::unsynchronized_pool_resource pool_{&monotonic_};
    std::atomic<size_t> allocations_{0};
    std::atomic<size_t> total_allocated_{0};

protected:
    void* do_allocate(size_t bytes, size_t alignment) override {
        allocations_.fetch_add(1, std::memory_order_relaxed);
        total_allocated_.fetch_add(bytes, std::memory_order_relaxed);

        try {
            return pool_.allocate(bytes, alignment);
        } catch (const std::bad_alloc&) {
            // Fallback to system allocator
            return ::operator new(bytes);
        }
    }

    void do_deallocate(void* ptr, size_t bytes, size_t alignment) override {
        try {
            pool_.deallocate(ptr, bytes, alignment);
        } catch (...) {
            // Fallback for system-allocated memory
            ::operator delete(ptr);
        }
    }

    bool do_is_equal(const memory_resource& other) const noexcept override {
        return this == &other;
    }

public:
    size_t allocation_count() const { return allocations_.load(std::memory_order_relaxed); }
    size_t total_allocated() const { return total_allocated_.load(std::memory_order_relaxed); }
};

// ============================================================================
// OBJECT POOL - Reusable object management
// ============================================================================

template<typename T, typename... Args>
class ObjectPool {
private:
    MemoryPool pool_;
    std::mutex mutex_;
    std::atomic<size_t> active_objects_{0};

public:
    ObjectPool() : pool_(sizeof(T)) {}

    template<typename... ConstructArgs>
    std::unique_ptr<T, std::function<void(T*)>> acquire(ConstructArgs&&... args) {
        std::lock_guard<std::mutex> lock(mutex_);
        active_objects_.fetch_add(1, std::memory_order_relaxed);

        void* memory = pool_.allocate();
        T* object = new(memory) T(std::forward<ConstructArgs>(args)...);

        return std::unique_ptr<T, std::function<void(T*)>>(
            object,
            [this](T* ptr) {
                ptr->~T();
                pool_.deallocate(ptr);
                active_objects_.fetch_sub(1, std::memory_order_relaxed);
            }
        );
    }

    size_t active_objects() const { return active_objects_.load(std::memory_order_relaxed); }
};

// ============================================================================
// STRING INTERNING - Memory-efficient string storage
// ============================================================================

class StringInterner {
private:
    std::unordered_map<std::string_view, std::string> strings_;
    ArenaAllocator<char> arena_;
    std::mutex mutex_;

public:
    const char* intern(std::string_view str) {
        std::lock_guard<std::mutex> lock(mutex_);

        auto it = strings_.find(str);
        if (it != strings_.end()) {
            return it->second.c_str();
        }

        // Allocate in arena for persistence
        char* interned = arena_.allocate();
        std::copy(str.begin(), str.end(), interned);
        interned[str.size()] = '\0';

        std::string_view interned_view(interned, str.size());
        strings_[interned_view] = std::string(interned_view);

        return interned;
    }

    size_t memory_usage() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return arena_.memory_usage() + strings_.size() * sizeof(std::pair<std::string_view, std::string>);
    }

    void clear() {
        std::lock_guard<std::mutex> lock(mutex_);
        strings_.clear();
        arena_.reset();
    }
};

// ============================================================================
// CACHE-AWARE DATA STRUCTURES
// ============================================================================

// Cache-aligned vector for better memory access patterns
template<typename T>
class CacheAlignedVector {
private:
    static constexpr size_t CACHE_LINE_SIZE = 64;
    std::vector<T> data_;

public:
    void push_back(const T& value) {
        data_.push_back(value);
    }

    void push_back(T&& value) {
        data_.push_back(std::move(value));
    }

    // Prefetch-aware access
    T& operator[](size_t index) {
        // Prefetch next cache line
        if (index + CACHE_LINE_SIZE / sizeof(T) < data_.size()) {
            __builtin_prefetch(&data_[index + CACHE_LINE_SIZE / sizeof(T)], 0, 1);
        }
        return data_[index];
    }

    const T& operator[](size_t index) const {
        return data_[index];
    }

    size_t size() const { return data_.size(); }
    bool empty() const { return data_.empty(); }
    void clear() { data_.clear(); }
    void reserve(size_t capacity) { data_.reserve(capacity); }
};

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

struct MemoryStats {
    size_t allocations;
    size_t total_allocated;
    size_t peak_usage;
    double allocation_rate;
    std::chrono::steady_clock::time_point last_update;
};

class MemoryMonitor {
private:
    std::atomic<size_t> allocations_{0};
    std::atomic<size_t> total_allocated_{0};
    std::atomic<size_t> peak_usage_{0};
    std::chrono::steady_clock::time_point start_time_;

public:
    MemoryMonitor() : start_time_(std::chrono::steady_clock::now()) {}

    void record_allocation(size_t size) {
        allocations_.fetch_add(1, std::memory_order_relaxed);
        total_allocated_.fetch_add(size, std::memory_order_relaxed);

        size_t current = total_allocated_.load(std::memory_order_relaxed);
        size_t peak = peak_usage_.load(std::memory_order_relaxed);
        while (current > peak && !peak_usage_.compare_exchange_weak(peak, current)) {}
    }

    MemoryStats get_stats() const {
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - start_time_).count();

        return {
            allocations_.load(std::memory_order_relaxed),
            total_allocated_.load(std::memory_order_relaxed),
            peak_usage_.load(std::memory_order_relaxed),
            elapsed > 0 ? static_cast<double>(allocations_.load()) / elapsed * 1000.0 : 0.0,
            now
        };
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Cache-aligned allocation
template<typename T>
T* cache_aligned_allocate(size_t count = 1) {
    constexpr size_t alignment = 64; // Cache line size
    void* ptr = nullptr;
    if (posix_memalign(&ptr, alignment, count * sizeof(T)) != 0) {
        throw std::bad_alloc();
    }
    return static_cast<T*>(ptr);
}

// Memory-mapped file for large data sets
class MemoryMappedFile {
private:
    void* data_;
    size_t size_;
    int fd_;

public:
    MemoryMappedFile(const char* filename) : data_(nullptr), size_(0), fd_(-1) {
        // Implementation would use mmap on Unix/Windows equivalents
        // This is a placeholder for the concept
    }

    ~MemoryMappedFile() {
        // Unmap memory
    }

    const void* data() const { return data_; }
    size_t size() const { return size_; }
};

// ============================================================================
// CONCEPTS FOR TYPE SAFETY (C++20)
// ============================================================================

template<typename T>
concept MemoryManageable = requires(T t) {
    sizeof(T) > 0;
    std::is_trivially_copyable_v<T> || std::is_move_constructible_v<T>;
};

template<typename T>
concept CacheAligned = requires {
    sizeof(T) % 64 == 0; // Cache line aligned
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example: High-performance file info storage
class OptimizedFileDatabase {
private:
    ArenaAllocator<FileInfo> file_allocator_;
    StringInterner string_interner_;
    ObjectPool<FileInfo> file_pool_;

public:
    FileInfo* create_file_info(const std::string& path, uint64_t size) {
        auto pooled_object = file_pool_.acquire(
            string_interner_.intern(path),
            size,
            std::filesystem::last_write_time(std::filesystem::path(path))
        );
        return pooled_object.get();
    }
};

// Example: Cache-aware file processing
void process_files_cache_aware(const std::vector<std::string>& files) {
    CacheAlignedVector<FileData> file_data;
    file_data.reserve(files.size());

    // Process in cache-friendly order
    for (const auto& file : files) {
        file_data.push_back(process_file(file));
    }

    // Further processing maintains cache locality
    for (size_t i = 0; i < file_data.size(); ++i) {
        process_file_data(file_data[i]);
    }
}
*/

} // namespace SpaceAnalyzer