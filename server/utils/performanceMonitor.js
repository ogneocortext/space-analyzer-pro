/**
 * Performance Monitoring Utility
 * Tracks request times, response sizes, and system metrics
 */

const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
    constructor() {
        super();
        this.metrics = {
            requests: new Map(),
            responseTimes: [],
            errorCounts: new Map(),
            memoryUsage: [],
            cpuUsage: []
        };
        
        this.startMonitoring();
    }

    startMonitoring() {
        // Monitor memory usage every 30 seconds
        this.memoryInterval = setInterval(() => {
            const usage = process.memoryUsage();
            this.metrics.memoryUsage.push({
                timestamp: Date.now(),
                rss: usage.rss,
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external
            });
            
            // Keep only last 100 entries
            if (this.metrics.memoryUsage.length > 100) {
                this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
            }
        }, 30000);

        // Monitor CPU usage every 5 seconds
        this.cpuInterval = setInterval(() => {
            const usage = process.cpuUsage();
            this.metrics.cpuUsage.push({
                timestamp: Date.now(),
                user: usage.user,
                system: usage.system
            });
            
            // Keep only last 100 entries
            if (this.metrics.cpuUsage.length > 100) {
                this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-100);
            }
        }, 5000);
    }

    recordRequest(req, startTime, endTime) {
        const duration = endTime - startTime;
        const method = req.method;
        const url = req.url;
        const statusCode = res.statusCode;
        
        this.metrics.requests.set(req.headers['x-request-id'] || this.generateRequestId(), {
            method,
            url,
            startTime,
            endTime,
            duration,
            statusCode,
            timestamp: new Date().toISOString()
        });
        
        this.metrics.responseTimes.push(duration);
        
        // Keep only last 1000 response times
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
        }
        
        this.emit('request', { req, duration, statusCode });
    }

    recordError(error, req) {
        const errorType = error.constructor.name;
        const currentCount = this.metrics.errorCounts.get(errorType) || 0;
        this.metrics.errorCounts.set(errorType, currentCount + 1);
        
        this.emit('error', { error, req, errorType });
    }

    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getMetrics() {
        const avgResponseTime = this.metrics.responseTimes.length > 0 
            ? this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / this.metrics.responseTimes.length 
            : 0;
            
        const errorRate = Array.from(this.metrics.errorCounts.values()).reduce((sum, count) => sum + count, 0) / 
            (this.metrics.requests.size || 1);

        return {
            totalRequests: this.metrics.requests.size,
            averageResponseTime: Math.round(avgResponseTime),
            errorRate: Math.round(errorRate * 100) / 100,
            errorsByType: Object.fromEntries(this.metrics.errorCounts),
            currentMemory: process.memoryUsage(),
            recentRequests: Array.from(this.metrics.requests.values()).slice(-10),
            uptime: process.uptime()
        };
    }

    stopMonitoring() {
        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
        }
        if (this.cpuInterval) {
            clearInterval(this.cpuInterval);
        }
    }

    getSlowQueries(threshold = 1000) {
        return this.metrics.responseTimes
            .filter(time => time > threshold)
            .map((time, index) => ({
                duration: time,
                request: this.metrics.requests.get(Array.from(this.metrics.requests.keys())[index])
            }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 10);
    }
}

module.exports = PerformanceMonitor;
