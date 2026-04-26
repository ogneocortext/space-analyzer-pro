/**
 * Space Scanner Core Header
 * High-performance directory and file system analysis engine
 * 
 * Features:
 * - Multi-threaded directory scanning
 * - Memory-efficient large file handling
 * - Real-time progress reporting
 * - Fast local disk analysis
 * - Cross-platform compatibility
 */

#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <unordered_set>
#include <filesystem>
#include <chrono>
#include <thread>
#include <mutex>
#include <atomic>
#include <future>
#include <fstream>
#include <sstream>
#include <regex>
#include <algorithm>
#include <numeric>
#include <memory>

namespace SpaceAnalyzer {

// Forward declarations - commented out to avoid incomplete type errors
// class SecurityScanner;
// class PerformanceMonitor;

/**
 * Analysis results structure
 */
struct AnalysisResult {
    uint64_t totalFiles = 0;
    uint64_t totalSize = 0;
    uint64_t totalDirectories = 0;
    uint64_t emptyDirectories = 0;
    std::map<std::string, uint64_t> filesByType;
    std::vector<std::pair<std::string, uint64_t>> largestFiles;
    std::vector<std::string> emptyDirectoryList;
    std::chrono::milliseconds analysisTime{0};
    // REMOVED: Security validation - unnecessary for local development tool

    // Machine Learning insights and recommendations
    std::map<std::string, std::string> mlInsights;
};

/**
 * Configuration for analysis
 */
struct AnalysisConfig {
    size_t maxDepth = 10;
    size_t minFileSize = 0;
    bool showHidden = false;
    bool enablePerformanceMonitoring = false;  // REMOVED: Security scan - unnecessary for local tool
    size_t threadCount = std::thread::hardware_concurrency();
    size_t batchSize = 1000;
    std::vector<std::string> excludedDirectories = {
        "node_modules", ".git", "dist", "build", ".next", ".nuxt", 
        ".cache", ".electron", ".vscode", "tmp", "temp"
    };
    std::vector<std::string> excludedExtensions = {
        ".log", ".tmp", ".cache", ".swp", ".bak"
    };
    bool validatePaths = false;  // REMOVED: Path validation - let filesystem handle it
    size_t maxPathLength = 260;
};

/**
 * Progress callback interface
 */
class IProgressCallback {
public:
    virtual ~IProgressCallback() = default;
    virtual void onProgress(const std::string& currentPath, size_t filesProcessed, size_t totalSize) = 0;
    virtual void onPhase(const std::string& phase) = 0;
    // REMOVED: onSecurityWarning - unnecessary for local development tool
};

/**
 * Core space scanner class
 * High-performance, memory-efficient directory analysis
 */
class SpaceScanner {
private:
    AnalysisConfig config;
    std::atomic<bool> isScanning{false};
    std::atomic<bool> shouldStop{false};
    std::mutex resultsMutex;
    AnalysisResult results;
    std::vector<std::string> scannedPaths;
    std::unordered_set<std::string> processedPaths;
    
    // Progress tracking
    std::atomic<size_t> filesProcessed{0};
    std::atomic<size_t> directoriesProcessed{0};
    std::atomic<uint64_t> currentSize{0};
    std::chrono::steady_clock::time_point startTime;

public:
    SpaceScanner(const AnalysisConfig& scannerConfig = AnalysisConfig{});
    ~SpaceScanner();

    // Analysis methods
    AnalysisResult analyzeDirectory(const std::string& directoryPath, IProgressCallback* callback = nullptr);
    AnalysisResult analyzeMultipleDirectories(const std::vector<std::string>& paths, IProgressCallback* callback = nullptr);
    
    // Control methods
    void stopAnalysis();
    bool isCurrentlyScanning() const { return isScanning.load(); }
    
    // Configuration
    void setConfig(const AnalysisConfig& newConfig) { this->config = newConfig; }
    AnalysisConfig getConfig() const { return config; }
    
    // Utilities
    static std::string formatBytes(uint64_t bytes);
    static std::string getFileExtension(const std::string& filePath);
    static bool isValidPath(const std::string& path);
    static bool isExcludedDirectory(const std::string& path, const std::vector<std::string>& exclusions);
    static bool isExcludedExtension(const std::string& path, const std::vector<std::string>& exclusions);

private:
    // Internal analysis methods
    void initializeScan();
    void cleanupScan();
    bool validateInputPath(const std::string& path);
    void scanDirectory(const std::string& directoryPath, size_t depth, IProgressCallback* callback);
    void processFile(const std::string& filePath, const std::filesystem::directory_entry& entry);
    void addFileType(const std::string& filePath);
    void trackLargestFile(const std::string& filePath, uint64_t size);
    void checkForEmptyDirectories(const std::string& directoryPath);
    
    // REMOVED: Security methods - unnecessary for local development tool
    
    // Utility methods
    std::string getNormalizedPath(const std::string& path) const;
    void updateProgress(IProgressCallback* callback, const std::string& currentPath);
    // REMOVED: validatePathSecurity - unnecessary for local development tool
    
    // Machine Learning methods
    void applyMachineLearningAlgorithms();
    void detectFileSizeAnomalies();
    void clusterFileTypes();
    void predictStorageUsage();
    void analyzeNamingPatterns();
    void generateMLRecommendations();

    // Threading methods
    void processBatch(const std::vector<std::filesystem::directory_entry>& batch, IProgressCallback* callback);
    std::vector<std::filesystem::directory_entry> getDirectoryEntries(const std::string& directoryPath);

    // JSON output methods
    std::string generateJsonOutput(const AnalysisResult& result) const;
    void saveResultsToFile(const AnalysisResult& result, const std::string& outputPath) const;
};

/**
 * Exception classes
 */
class SpaceScannerException : public std::exception {
private:
    std::string message;
public:
    explicit SpaceScannerException(const std::string& msg) : message(msg) {}
    const char* what() const noexcept override { return message.c_str(); }
};

// REMOVED: SecurityViolationException - unnecessary for local development tool

class PathAccessException : public SpaceScannerException {
public:
    explicit PathAccessException(const std::string& msg) : SpaceScannerException("Path access error: " + msg) {}
};

/**
 * Constants and utilities
 */
namespace Constants {
    constexpr size_t MAX_PATH_LENGTH = 260;
    constexpr size_t DEFAULT_BUFFER_SIZE = 8192;
    constexpr size_t MAX_FILE_SIZE_FOR_DETAILED_ANALYSIS = 100 * 1024 * 1024; // 100MB
    constexpr uint64_t INVALID_FILE_SIZE = UINT64_MAX;
    
    constexpr const char* RESULTS_START_MARKER = "RESULTS_START";
    constexpr const char* RESULTS_END_MARKER = "RESULTS_END";
    constexpr const char* JSON_CONTENT_TYPE = "application/json";
}

/**
 * Helper functions
 */
namespace Helpers {
    std::string formatBytes(uint64_t bytes);
    std::string escapeJsonString(const std::string& str);
    std::string getCurrentTimestamp();
    uint64_t getFileHash(const std::string& filePath);
    bool isLargeFile(uint64_t size);
    std::string getRelativePath(const std::string& fullPath, const std::string& basePath);
}

} // namespace SpaceAnalyzer