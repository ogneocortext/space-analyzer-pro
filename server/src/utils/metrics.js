/**
 * Metrics Utility
 * Provides metrics collection and reporting
 */

class Metrics {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                error: 0,
                byEndpoint: new Map()
            },
            analysis: {
                total: 0,
                completed: 0,
                failed: 0,
                averageDuration: 0
            },
            system: {
                startTime: Date.now(),
                memoryUsage: [],
                cpuUsage: []
            }
        };
    }

    incrementRequest(endpoint, success = true) {
        this.metrics.requests.total++;
        
        if (success) {
            this.metrics.requests.success++;
        } else {
            this.metrics.requests.error++;
        }

        const endpointCount = this.metrics.requests.byEndpoint.get(endpoint) || { total: 0, success: 0, error: 0 };
        endpointCount.total++;
        
        if (success) {
            endpointCount.success++;
        } else {
            endpointCount.error++;
        }

        this.metrics.requests.byEndpoint.set(endpoint, endpointCount);
    }

    recordAnalysis(duration, success = true) {
        this.metrics.analysis.total++;
        
        if (success) {
            this.metrics.analysis.completed++;
        } else {
            this.metrics.analysis.failed++;
        }

        // Update average duration
        const totalCompleted = this.metrics.analysis.completed;
        const currentAverage = this.metrics.analysis.averageDuration;
        this.metrics.analysis.averageDuration = ((currentAverage * (totalCompleted - 1)) + duration) / totalCompleted;
    }

    recordMemoryUsage() {
        const usage = process.memoryUsage();
        this.metrics.system.memoryUsage.push({
            timestamp: Date.now(),
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss
        });

        // Keep only last 100 entries
        if (this.metrics.system.memoryUsage.length > 100) {
            this.metrics.system.memoryUsage.shift();
        }
    }

    recordCpuUsage() {
        const usage = process.cpuUsage();
        this.metrics.system.cpuUsage.push({
            timestamp: Date.now(),
            user: usage.user,
            system: usage.system
        });

        // Keep only last 100 entries
        if (this.metrics.system.cpuUsage.length > 100) {
            this.metrics.system.cpuUsage.shift();
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.system.startTime,
            timestamp: new Date().toISOString()
        };
    }

    resetMetrics() {
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                error: 0,
                byEndpoint: new Map()
            },
            analysis: {
                total: 0,
                completed: 0,
                failed: 0,
                averageDuration: 0
            },
            system: {
                startTime: Date.now(),
                memoryUsage: [],
                cpuUsage: []
            }
        };
    }

    getSuccessRate() {
        const { total, success } = this.metrics.requests;
        return total > 0 ? (success / total) * 100 : 0;
    }

    getAnalysisSuccessRate() {
        const { total, completed } = this.metrics.analysis;
        return total > 0 ? (completed / total) * 100 : 0;
    }

    getTopEndpoints(limit = 10) {
        return Array.from(this.metrics.requests.byEndpoint.entries())
            .map(([endpoint, stats]) => ({ endpoint, ...stats }))
            .sort((a, b) => b.total - a.total)
            .slice(0, limit);
    }
}

// Create and export a singleton instance
const metrics = new Metrics();

// Record system metrics periodically
setInterval(() => {
    metrics.recordMemoryUsage();
    metrics.recordCpuUsage();
}, 30000); // Every 30 seconds

module.exports = metrics;
