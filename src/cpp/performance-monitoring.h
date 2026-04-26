/**
 * Performance Monitoring Header
 * Clean, working performance monitoring for Space Analyzer
 */

#pragma once

#include <iostream>
#include <windows.h>
#include <psapi.h>
#include <chrono>
#include <thread>
#include <atomic>
#include <mutex>
#include <string>
#include <sstream>

// Performance metrics structure
struct PerformanceMetrics {
    double cpuUsage = 0.0;
    uint64_t memoryUsedMB = 0;
    uint64_t availableMemoryMB = 0;
    uint64_t filesProcessed = 0;
    uint64_t bytesProcessed = 0;
    double throughputMBps = 0.0;
    double filesPerSecond = 0.0;
    uint64_t systemUptime = 0;
};

// PerformanceMonitor class
class PerformanceMonitor {
private:
    bool isMonitoring;
    std::chrono::steady_clock::time_point startTime;
    std::chrono::steady_clock::time_point lastUpdateTime;
    PerformanceMetrics currentMetrics;
    std::thread monitoringThread;
    std::mutex metricsMutex;
    LARGE_INTEGER frequency;
    
public:
    PerformanceMonitor();
    ~PerformanceMonitor();
    
    void InitializePerformanceCounters();
    void StartMonitoring();
    void StopMonitoring();
    void MonitoringLoop();
    void UpdateMetrics();
    void CollectSystemInfo();
    double GetCPUUsage();
    uint64_t GetSystemUptime();
    PerformanceMetrics GetCurrentMetrics() const;
    void RecordFileOperation(const std::string& operation, uint64_t size);
    void ResetMetrics();
    std::string GenerateReport() const;
};
