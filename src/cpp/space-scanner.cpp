/**
 * Space Scanner Implementation
 * High-performance directory and file system analysis engine
 */

#include "space-scanner.h"
#include <filesystem>
#include <algorithm>
#include <thread>
#include <mutex>
#include <queue>
#include <condition_variable>
#include <unordered_set>
#include <vector>
#include <cmath>
#include <numeric>
#include <random>
#include <iomanip>
#include <sstream>
#include <ctime>

namespace fs = std::filesystem;

namespace SpaceAnalyzer {

// SpaceScanner Implementation
SpaceScanner::SpaceScanner(const AnalysisConfig& scannerConfig)
    : config(scannerConfig) {
    // Initialize security scanner and performance monitor if needed
    // securityScanner = std::make_unique<SecurityScanner>();
    // performanceMonitor = std::make_unique<PerformanceMonitor>();
}

SpaceScanner::~SpaceScanner() {
    stopAnalysis();
}

AnalysisResult SpaceScanner::analyzeDirectory(const std::string& directoryPath, IProgressCallback* callback) {
    initializeScan();

    try {
        // Validate input
        if (!validateInputPath(directoryPath)) {
            throw PathAccessException("Invalid directory path: " + directoryPath);
        }

        // Start timing
        startTime = std::chrono::steady_clock::now();

        // Perform the analysis
        scanDirectory(directoryPath, 0, callback);

    // Calculate final timing
    auto endTime = std::chrono::steady_clock::now();
    results.analysisTime = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime);

    // Apply machine learning algorithms
    applyMachineLearningAlgorithms();

} catch (const std::exception& e) {
        (void)e;  // Mark as intentionally unused
        cleanupScan();
        throw;
    }

    cleanupScan();
    return results;
}

AnalysisResult SpaceScanner::analyzeMultipleDirectories(const std::vector<std::string>& paths, IProgressCallback* callback) {
    AnalysisResult combinedResult;

    for (const auto& path : paths) {
        try {
            auto singleResult = analyzeDirectory(path, callback);

            // Combine results
            combinedResult.totalFiles += singleResult.totalFiles;
            combinedResult.totalSize += singleResult.totalSize;
            combinedResult.totalDirectories += singleResult.totalDirectories;
            combinedResult.analysisTime += singleResult.analysisTime;

            // Merge file types
            for (const auto& [ext, count] : singleResult.filesByType) {
                combinedResult.filesByType[ext] += count;
            }

            // Combine largest files (keep top 10)
            combinedResult.largestFiles.insert(
                combinedResult.largestFiles.end(),
                singleResult.largestFiles.begin(),
                singleResult.largestFiles.end()
            );

            // Sort and keep top 10
            std::sort(combinedResult.largestFiles.begin(), combinedResult.largestFiles.end(),
                     [](const auto& a, const auto& b) { return a.second > b.second; });
            if (combinedResult.largestFiles.size() > 10) {
                combinedResult.largestFiles.resize(10);
            }

        } catch (const std::exception& e) {
            (void)e;  // Mark as intentionally unused
            // Continue with other directories if one fails
        }
    }

    return combinedResult;
}

void SpaceScanner::stopAnalysis() {
    shouldStop = true;
}

void SpaceScanner::initializeScan() {
    isScanning = true;
    shouldStop = false;
    filesProcessed = 0;
    directoriesProcessed = 0;
    currentSize = 0;

    // Clear previous results
    results = AnalysisResult();
    scannedPaths.clear();
}

void SpaceScanner::cleanupScan() {
    isScanning = false;
    shouldStop = false;
}

bool SpaceScanner::validateInputPath(const std::string& path) {
    if (path.empty()) return false;

    fs::path fsPath(path);
    if (!fs::exists(fsPath)) return false;
    if (!fs::is_directory(fsPath)) return false;

    // Basic path validation only - let filesystem handle security

    return true;
}

void SpaceScanner::scanDirectory(const std::string& directoryPath, size_t depth, IProgressCallback* callback) {
    if (shouldStop || depth > static_cast<size_t>(config.maxDepth)) {
        return;
    }

    if (callback) {
        callback->onPhase("Scanning directory: " + directoryPath);
    }

    try {
        for (const auto& entry : fs::directory_iterator(directoryPath)) {
            if (shouldStop) break;

            const auto& path = entry.path();

            // Update progress
            updateProgress(callback, path.string());

            if (fs::is_directory(path)) {
                directoriesProcessed++;
                results.totalDirectories++;

                // Check if directory should be excluded
                if (isExcludedDirectory(path.filename().string(), config.excludedDirectories)) {
                    continue;
                }

                // Recurse into subdirectory (no security scan needed for local tool)

                // Recurse into subdirectory
                scanDirectory(path.string(), depth + 1, callback);

            } else if (fs::is_regular_file(path)) {
                processFile(path.string(), entry);
            }
        }

        // Check for empty directories
        checkForEmptyDirectories(directoryPath);

    } catch (const std::exception& e) {
        (void)e;  // Mark as intentionally unused
        // Continue scanning other directories
    }
}

void SpaceScanner::processFile(const std::string& filePath, const fs::directory_entry& entry) {
    (void)entry;  // Mark as intentionally unused (only file_size() is used)
    try {
        auto fileSize = entry.file_size();

        // Check minimum file size
        if (fileSize < static_cast<uint64_t>(config.minFileSize)) {
            return;
        }

        filesProcessed++;
        results.totalFiles++;
        results.totalSize += fileSize;
        currentSize += fileSize;

        // Track file type
        addFileType(filePath);

        // Track largest files
        trackLargestFile(filePath, fileSize);

        // File processed (no security scan needed for local tool)

    } catch (const std::exception& e) {
        // Skip files that can't be processed
        if (config.enablePerformanceMonitoring) {
            // Log performance issue
        }
    }
}

void SpaceScanner::addFileType(const std::string& filePath) {
    std::string extension = getFileExtension(filePath);

    if (!extension.empty()) {
        results.filesByType[extension]++;
    }
}

void SpaceScanner::trackLargestFile(const std::string& filePath, uint64_t size) {
    results.largestFiles.emplace_back(filePath, size);

    // Keep only top files (simple approach - sort later if needed)
    if (results.largestFiles.size() > 100) {  // Keep more than needed for sorting
        std::sort(results.largestFiles.begin(), results.largestFiles.end(),
                 [](const auto& a, const auto& b) { return a.second > b.second; });
        results.largestFiles.resize(10);
    }
}

void SpaceScanner::checkForEmptyDirectories(const std::string& directoryPath) {
    try {
        bool isEmpty = true;
        for (const auto& entry : fs::directory_iterator(directoryPath)) {
            isEmpty = false;
            break;
        }

        if (isEmpty) {
            results.emptyDirectories++;
            results.emptyDirectoryList.push_back(directoryPath);
        }
    } catch (const std::exception&) {
        (void)&std::exception::what;  // Mark as intentionally unused
        // Skip directories that can't be checked
    }
}

// REMOVED: performSecurityScan - unnecessary for local development tool

// REMOVED: isDangerousPath - unnecessary for local development tool

// REMOVED: hasSuspiciousName - unnecessary for local development tool

void SpaceScanner::updateProgress(IProgressCallback* callback, const std::string& currentPath) {
    if (callback) {
        callback->onProgress(currentPath, filesProcessed.load(), currentSize.load());
    }
}

void SpaceScanner::applyMachineLearningAlgorithms() {
    // 1. File Size Anomaly Detection (Statistical Analysis)
    detectFileSizeAnomalies();

    // 2. File Type Clustering (Pattern Recognition)
    clusterFileTypes();

    // 3. Predictive Storage Usage Analysis
    predictStorageUsage();

    // 4. File Naming Pattern Analysis
    analyzeNamingPatterns();

    // 5. Generate ML-based recommendations
    generateMLRecommendations();
}

void SpaceScanner::detectFileSizeAnomalies() {
    if (results.largestFiles.empty()) return;

    // Extract file sizes for statistical analysis
    std::vector<double> fileSizes;
    for (const auto& filePair : results.largestFiles) {
        fileSizes.push_back(static_cast<double>(filePair.second));
    }

    // Calculate statistical measures
    if (fileSizes.size() >= 3) {
        double mean = std::accumulate(fileSizes.begin(), fileSizes.end(), 0.0) / fileSizes.size();

        double variance = 0.0;
        for (double size : fileSizes) {
            variance += std::pow(size - mean, 2);
        }
        variance /= fileSizes.size();
        double stdDev = std::sqrt(variance);

        // Find outliers (files more than 2 standard deviations above mean)
        double threshold = mean + 2.0 * stdDev;

        results.mlInsights["size_anomalies"] = "File size anomaly detection completed";
        results.mlInsights["anomaly_threshold"] = std::to_string(static_cast<uint64_t>(threshold));

        // Mark anomalous files
        for (const auto& filePair : results.largestFiles) {
            const std::string& path = filePair.first;
            uint64_t size = filePair.second;

            if (static_cast<double>(size) > threshold) {
                results.mlInsights["anomalous_files"] += path + " (" + Helpers::formatBytes(size) + "); ";
            }
        }
    }
}

void SpaceScanner::clusterFileTypes() {
    // Simple file type clustering based on extensions
    std::map<std::string, std::vector<std::string>> typeClusters = {
        {"documents", {".doc", ".docx", ".pdf", ".txt", ".rtf", ".odt"}},
        {"images", {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".svg"}},
        {"videos", {".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv"}},
        {"audio", {".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma"}},
        {"archives", {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"}},
        {"code", {".cpp", ".c", ".h", ".hpp", ".py", ".java", ".js", ".html", ".css"}},
        {"executables", {".exe", ".dll", ".so", ".dylib", ".app"}}
    };

    std::map<std::string, uint64_t> clusterSizes;
    std::map<std::string, size_t> clusterCounts;

    for (const auto& typePair : results.filesByType) {
        const std::string& ext = typePair.first;
        uint64_t count = typePair.second;

        for (const auto& clusterPair : typeClusters) {
            const std::string& clusterName = clusterPair.first;
            const std::vector<std::string>& extensions = clusterPair.second;

            if (std::find(extensions.begin(), extensions.end(), ext) != extensions.end()) {
                clusterSizes[clusterName] += count;
                clusterCounts[clusterName] += count;
                break;
            }
        }
    }

    // Store clustering results
    for (const auto& clusterPair : clusterSizes) {
        const std::string& cluster = clusterPair.first;
        uint64_t size = clusterPair.second;

        results.mlInsights["cluster_" + cluster + "_size"] = std::to_string(size);
        results.mlInsights["cluster_" + cluster + "_count"] = std::to_string(clusterCounts[cluster]);
    }

    results.mlInsights["file_clustering"] = "File type clustering analysis completed";
}

void SpaceScanner::predictStorageUsage() {
    // Simple predictive analysis based on current growth patterns
    if (results.totalFiles > 0 && results.analysisTime.count() > 0) {
        // Calculate files per second processing rate
        double filesPerSecond = static_cast<double>(results.totalFiles) /
                               (results.analysisTime.count() / 1000.0);

        // Estimate total files in a larger directory (rough prediction)
        uint64_t estimatedTotalFiles = results.totalFiles * 5; // Assume 5x more files in full system
        double estimatedHours = estimatedTotalFiles / (filesPerSecond * 3600);

        results.mlInsights["processing_rate"] = std::to_string(filesPerSecond) + " files/second";
        results.mlInsights["estimated_full_scan"] = std::to_string(estimatedHours) + " hours";

        // Predict storage growth (simple linear extrapolation)
        uint64_t averageFileSize = results.totalSize / results.totalFiles;
        uint64_t predictedGrowth = averageFileSize * 1000; // Assume 1000 new files

        results.mlInsights["predicted_growth"] = Helpers::formatBytes(predictedGrowth) + " in next 1000 files";
    }
}

void SpaceScanner::analyzeNamingPatterns() {
    // Analyze file naming patterns for duplicates or unusual naming
    std::map<std::string, int> namePatterns;
    std::map<std::string, int> duplicateBases;

    for (const auto& filePair : results.largestFiles) {
        const std::string& path = filePair.first;
        uint64_t size = filePair.second;
        (void)size;  // Mark as intentionally unused

        fs::path filePath(path);
        std::string filename = filePath.filename().string();

        // Extract base name (without extension)
        std::string baseName = filePath.stem().string();

        // Look for patterns like "Copy of", "Backup", numbers, etc.
        if (baseName.find("copy") != std::string::npos ||
            baseName.find("backup") != std::string::npos ||
            baseName.find("temp") != std::string::npos) {
            namePatterns["backup_copy"]++;
        }

        // Check for numbered files (file1.txt, file2.txt, etc.)
        if (std::regex_search(baseName, std::regex("\\d+$"))) {
            namePatterns["numbered"]++;
        }

        // Check for duplicates
        duplicateBases[baseName]++;
    }

    // Count duplicate base names
    int duplicates = 0;
    for (const auto& dupPair : duplicateBases) {
        if (dupPair.second > 1) duplicates++;
    }

    results.mlInsights["duplicate_base_names"] = std::to_string(duplicates);
    results.mlInsights["backup_files"] = std::to_string(namePatterns["backup_copy"]);
    results.mlInsights["numbered_files"] = std::to_string(namePatterns["numbered"]);
    results.mlInsights["naming_analysis"] = "File naming pattern analysis completed";
}

void SpaceScanner::generateMLRecommendations() {
    // Generate recommendations based on ML analysis results
    std::vector<std::string> recommendations;

    // Check for size anomalies
    if (results.mlInsights.count("anomalous_files") > 0) {
        recommendations.push_back("Consider reviewing unusually large files for cleanup opportunities");
    }

    // Check for duplicates
    if (results.mlInsights.count("duplicate_base_names") > 0) {
        int dupCount = std::stoi(results.mlInsights["duplicate_base_names"]);
        if (dupCount > 5) {
            recommendations.push_back("High number of duplicate file names detected - consider cleanup");
        }
    }

    // Check storage predictions
    if (results.mlInsights.count("predicted_growth") > 0) {
        recommendations.push_back("Monitor storage growth trends - " + results.mlInsights["predicted_growth"]);
    }

    // Check for backup files
    if (results.mlInsights.count("backup_files") > 0) {
        int backupCount = std::stoi(results.mlInsights["backup_files"]);
        if (backupCount > 10) {
            recommendations.push_back("Large number of backup/copy files detected - consider archiving old versions");
        }
    }

    // Store recommendations
    for (size_t i = 0; i < recommendations.size(); ++i) {
        results.mlInsights["recommendation_" + std::to_string(i + 1)] = recommendations[i];
    }

    results.mlInsights["ml_analysis_complete"] = "Machine learning analysis and recommendations generated";
}

// Static utility functions
std::string SpaceScanner::formatBytes(uint64_t bytes) {
    return SpaceAnalyzer::Helpers::formatBytes(bytes);
}

std::string SpaceScanner::getFileExtension(const std::string& filePath) {
    fs::path path(filePath);
    std::string ext = path.extension().string();

    // Convert to lowercase
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);

    return ext;
}

bool SpaceScanner::isValidPath(const std::string& path) {
    if (path.empty()) return false;

    fs::path fsPath(path);
    return fs::exists(fsPath);
}

bool SpaceScanner::isExcludedDirectory(const std::string& path, const std::vector<std::string>& exclusions) {
    for (const auto& exclusion : exclusions) {
        if (path.find(exclusion) != std::string::npos) {
            return true;
        }
    }
    return false;
}

bool SpaceScanner::isExcludedExtension(const std::string& path, const std::vector<std::string>& exclusions) {
    std::string ext = getFileExtension(path);
    return std::find(exclusions.begin(), exclusions.end(), ext) != exclusions.end();
}

// Utility functions implementation
namespace Helpers {
    std::string formatBytes(uint64_t bytes) {
        if (bytes == 0) return "0 B";

        const char* units[] = {"B", "KB", "MB", "GB", "TB", "PB"};
        int unit = 0;
        double size = static_cast<double>(bytes);

        while (size >= 1024.0 && unit < 5) {
            size /= 1024.0;
            unit++;
        }

        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2) << size << " " << units[unit];
        return oss.str();
    }

    std::string escapeJsonString(const std::string& str) {
        std::string result;
        for (char c : str) {
            switch (c) {
                case '"': result += "\\\""; break;
                case '\\': result += "\\\\"; break;
                case '\b': result += "\\b"; break;
                case '\f': result += "\\f"; break;
                case '\n': result += "\\n"; break;
                case '\r': result += "\\r"; break;
                case '\t': result += "\\t"; break;
                default: result += c; break;
            }
        }
        return result;
    }

    std::string getCurrentTimestamp() {
        // Simple timestamp without CRT dependency
        auto now = std::chrono::system_clock::now();
        auto duration = now.time_since_epoch();
        auto seconds = std::chrono::duration_cast<std::chrono::seconds>(duration);
        auto milliseconds = std::chrono::duration_cast<std::chrono::milliseconds>(duration - seconds);

        std::stringstream ss;
        ss << seconds.count() << "." << std::setfill('0') << std::setw(3) << milliseconds.count();
        return ss.str();
    }

    uint64_t getFileHash(const std::string& filePath) {
        // Simple hash implementation
        uint64_t hash = 0;
        for (char c : filePath) {
            hash = hash * 31 + static_cast<uint64_t>(c);
        }
        return hash;
    }

    bool isLargeFile(uint64_t size) {
        return size > 100 * 1024 * 1024; // 100MB
    }

    std::string getRelativePath(const std::string& fullPath, const std::string& basePath) {
        fs::path full(fullPath);
        fs::path base(basePath);

        try {
            return fs::relative(full, base).string();
        } catch (...) {
            return fullPath;
        }
    }
}

} // namespace SpaceAnalyzer