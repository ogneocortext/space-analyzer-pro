/**
 * Performance Monitor for Local AI Tools
 * Focuses on performance metrics for local providers, usage tracking only for external APIs
 */

const { EventEmitter } = require('events');
const os = require('os');

class LocalAIPerformanceMonitor extends EventEmitter {
    constructor() {
        super();
        this.metrics = new Map();
        this.performanceHistory = [];
        this.alerts = [];
        this.thresholds = {
            responseTime: 5000, // 5 seconds
            memoryUsage: 80, // 80% of available memory
            cpuUsage: 90, // 90% CPU usage
            errorRate: 10, // 10% error rate
            consecutiveErrors: 3
        };
        
        this.startSystemMonitoring();
    }

    startSystemMonitoring() {
        // Monitor system resources every 5 seconds
        setInterval(() => {
            this.collectSystemMetrics();
        }, 5000);
    }

    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const systemMetrics = {
            timestamp: Date.now(),
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                percentageUsed: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
                idle: cpuUsage.idle,
                total: cpuUsage.user + cpuUsage.system + cpuUsage.idle
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                loadAverage: os.loadavg()
            }
        };

        this.checkPerformanceThresholds(systemMetrics);
        this.emit('systemMetrics', systemMetrics);
    }

    startRequestMonitoring(providerName, requestType, requestId) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        
        const monitoring = {
            requestId,
            provider: providerName,
            requestType,
            startTime,
            startMemory,
            endTime: null,
            duration: null,
            memoryDelta: null,
            success: null,
            error: null,
            tokens: null
        };

        this.metrics.set(requestId, monitoring);
        return requestId;
    }

    endRequestMonitoring(requestId, success, error = null, tokens = null) {
        const monitoring = this.metrics.get(requestId);
        if (!monitoring) return;

        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        monitoring.endTime = endTime;
        monitoring.duration = endTime - monitoring.startTime;
        monitoring.memoryDelta = endMemory.heapUsed - monitoring.startMemory.heapUsed;
        monitoring.success = success;
        monitoring.error = error;
        monitoring.tokens = tokens;

        // Calculate performance metrics
        const performance = {
            ...monitoring,
            tokensPerSecond: tokens ? (tokens / (monitoring.duration / 1000)) : 0,
            memoryPerToken: tokens ? (monitoring.memoryDelta / tokens) : 0,
            responseTime: monitoring.duration
        };

        // Store in history
        this.performanceHistory.push(performance);
        
        // Keep only last 1000 entries
        if (this.performanceHistory.length > 1000) {
            this.performanceHistory = this.performanceHistory.slice(-1000);
        }

        this.emit('requestCompleted', performance);
        this.metrics.delete(requestId);

        // Check for performance alerts
        this.checkRequestPerformance(performance);
    }

    checkRequestPerformance(performance) {
        // Response time alert
        if (performance.duration > this.thresholds.responseTime) {
            this.createAlert('SLOW_RESPONSE', {
                provider: performance.provider,
                duration: performance.duration,
                requestId: performance.requestId
            });
        }

        // Memory usage alert
        if (performance.memoryDelta > 50 * 1024 * 1024) { // 50MB
            this.createAlert('HIGH_MEMORY_USAGE', {
                provider: performance.provider,
                memoryDelta: performance.memoryDelta,
                requestId: performance.requestId
            });
        }

        // Error tracking
        if (!performance.success) {
            this.trackErrorRate(performance.provider);
        }
    }

    trackErrorRate(providerName) {
        const recentRequests = this.performanceHistory.filter(
            req => req.provider === providerName && 
            req.startTime > Date.now() - 60000 // Last minute
        );

        if (recentRequests.length === 0) return;

        const errorCount = recentRequests.filter(req => !req.success).length;
        const errorRate = (errorCount / recentRequests.length) * 100;

        if (errorRate > this.thresholds.errorRate) {
            this.createAlert('HIGH_ERROR_RATE', {
                provider: providerName,
                errorRate,
                errorCount,
                totalRequests: recentRequests.length
            });
        }

        // Check for consecutive errors
        const lastRequests = recentRequests.slice(-this.thresholds.consecutiveErrors);
        const consecutiveErrors = lastRequests.every(req => !req.success);

        if (consecutiveErrors) {
            this.createAlert('CONSECUTIVE_ERRORS', {
                provider: providerName,
                count: this.thresholds.consecutiveErrors
            });
        }
    }

    checkPerformanceThresholds(systemMetrics) {
        // Memory threshold
        if (systemMetrics.memory.percentageUsed > this.thresholds.memoryUsage) {
            this.createAlert('HIGH_SYSTEM_MEMORY', {
                percentage: systemMetrics.memory.percentageUsed,
                used: systemMetrics.memory.used,
                total: systemMetrics.memory.total
            });
        }

        // CPU threshold (simplified)
        const cpuUsage = ((systemMetrics.cpu.total - systemMetrics.cpu.idle) / systemMetrics.cpu.total) * 100;
        if (cpuUsage > this.thresholds.cpuUsage) {
            this.createAlert('HIGH_CPU_USAGE', {
                percentage: cpuUsage,
                user: systemMetrics.cpu.user,
                system: systemMetrics.cpu.system
            });
        }
    }

    createAlert(type, data) {
        const alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            timestamp: Date.now(),
            data,
            severity: this.getAlertSeverity(type)
        };

        this.alerts.push(alert);
        this.emit('performanceAlert', alert);

        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }
    }

    getAlertSeverity(type) {
        const severityMap = {
            'SLOW_RESPONSE': 'medium',
            'HIGH_MEMORY_USAGE': 'medium',
            'HIGH_SYSTEM_MEMORY': 'high',
            'HIGH_CPU_USAGE': 'high',
            'HIGH_ERROR_RATE': 'high',
            'CONSECUTIVE_ERRORS': 'critical'
        };
        return severityMap[type] || 'low';
    }

    getPerformanceStats() {
        const now = Date.now();
        const lastHour = now - 3600000; // 1 hour ago
        const lastDay = now - 86400000; // 1 day ago

        const recentHour = this.performanceHistory.filter(req => req.startTime > lastHour);
        const recentDay = this.performanceHistory.filter(req => req.startTime > lastDay);

        const stats = {
            totalRequests: this.performanceHistory.length,
            lastHour: {
                requests: recentHour.length,
                successRate: this.calculateSuccessRate(recentHour),
                avgResponseTime: this.calculateAvgResponseTime(recentHour),
                avgMemoryUsage: this.calculateAvgMemoryUsage(recentHour)
            },
            lastDay: {
                requests: recentDay.length,
                successRate: this.calculateSuccessRate(recentDay),
                avgResponseTime: this.calculateAvgResponseTime(recentDay),
                avgMemoryUsage: this.calculateAvgMemoryUsage(recentDay)
            },
            byProvider: this.getStatsByProvider(),
            alerts: this.alerts.slice(-10), // Last 10 alerts
            currentSystem: this.getCurrentSystemStats()
        };

        return stats;
    }

    calculateSuccessRate(requests) {
        if (requests.length === 0) return 100;
        const successful = requests.filter(req => req.success).length;
        return (successful / requests.length) * 100;
    }

    calculateAvgResponseTime(requests) {
        if (requests.length === 0) return 0;
        const totalTime = requests.reduce((sum, req) => sum + req.duration, 0);
        return totalTime / requests.length;
    }

    calculateAvgMemoryUsage(requests) {
        if (requests.length === 0) return 0;
        const totalMemory = requests.reduce((sum, req) => sum + (req.memoryDelta || 0), 0);
        return totalMemory / requests.length;
    }

    getStatsByProvider() {
        const providerStats = {};
        
        for (const req of this.performanceHistory) {
            if (!providerStats[req.provider]) {
                providerStats[req.provider] = {
                    requests: 0,
                    successes: 0,
                    failures: 0,
                    totalDuration: 0,
                    totalMemory: 0,
                    totalTokens: 0
                };
            }
            
            const stats = providerStats[req.provider];
            stats.requests++;
            stats.totalDuration += req.duration;
            stats.totalMemory += req.memoryDelta || 0;
            stats.totalTokens += req.tokens || 0;
            
            if (req.success) {
                stats.successes++;
            } else {
                stats.failures++;
            }
        }

        // Calculate averages
        for (const provider in providerStats) {
            const stats = providerStats[provider];
            stats.avgResponseTime = stats.requests > 0 ? stats.totalDuration / stats.requests : 0;
            stats.avgMemoryUsage = stats.requests > 0 ? stats.totalMemory / stats.requests : 0;
            stats.successRate = stats.requests > 0 ? (stats.successes / stats.requests) * 100 : 0;
            stats.tokensPerSecond = stats.totalDuration > 0 ? (stats.totalTokens / (stats.totalDuration / 1000)) : 0;
        }

        return providerStats;
    }

    getCurrentSystemStats() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
                idle: cpuUsage.idle,
                usage: ((cpuUsage.user + cpuUsage.system) / (cpuUsage.user + cpuUsage.system + cpuUsage.idle)) * 100
            },
            uptime: process.uptime(),
            pid: process.pid
        };
    }

    getRecommendations() {
        const recommendations = [];
        const stats = this.getPerformanceStats();
        
        // Response time recommendations
        if (stats.lastHour.avgResponseTime > 3000) {
            recommendations.push({
                type: 'OPTIMIZATION',
                message: 'Average response time is high. Consider optimizing model selection or increasing resources.',
                priority: 'medium'
            });
        }

        // Memory recommendations
        if (stats.currentSystem.memory.percentage > 70) {
            recommendations.push({
                type: 'RESOURCE',
                message: 'Memory usage is high. Consider using smaller models or increasing available memory.',
                priority: 'high'
            });
        }

        // Error rate recommendations
        for (const [provider, providerStats] of Object.entries(stats.byProvider)) {
            if (providerStats.successRate < 90) {
                recommendations.push({
                    type: 'RELIABILITY',
                    message: `${provider} has low success rate (${providerStats.successRate.toFixed(1)}%). Check provider health.`,
                    priority: 'high'
                });
            }
        }

        return recommendations;
    }

    exportMetrics(format = 'json') {
        const stats = this.getPerformanceStats();
        
        switch (format) {
            case 'json':
                return JSON.stringify(stats, null, 2);
            case 'csv':
                return this.convertToCSV(stats);
            case 'prometheus':
                return this.convertToPrometheus(stats);
            default:
                return stats;
        }
    }

    convertToCSV(stats) {
        const csv = ['Timestamp,Provider,RequestType,Duration,Success,Memory,Tokens'];
        
        for (const req of this.performanceHistory) {
            csv.push([
                new Date(req.startTime).toISOString(),
                req.provider,
                req.requestType,
                req.duration,
                req.success,
                req.memoryDelta,
                req.tokens
            ].join(','));
        }
        
        return csv.join('\n');
    }

    convertToPrometheus(stats) {
        const metrics = [];
        
        // Provider metrics
        for (const [provider, providerStats] of Object.entries(stats.byProvider)) {
            metrics.push(`# HELP ai_provider_requests_total Total requests for AI provider`);
            metrics.push(`# TYPE ai_provider_requests_total counter`);
            metrics.push(`ai_provider_requests_total{provider="${provider}"} ${providerStats.requests}`);
            
            metrics.push(`# HELP ai_provider_success_rate Success rate for AI provider`);
            metrics.push(`# TYPE ai_provider_success_rate gauge`);
            metrics.push(`ai_provider_success_rate{provider="${provider}"} ${providerStats.successRate}`);
            
            metrics.push(`# HELP ai_provider_avg_response_time Average response time for AI provider`);
            metrics.push(`# TYPE ai_provider_avg_response_time gauge`);
            metrics.push(`ai_provider_avg_response_time{provider="${provider}"} ${providerStats.avgResponseTime}`);
        }
        
        return metrics.join('\n');
    }
}

module.exports = LocalAIPerformanceMonitor;
