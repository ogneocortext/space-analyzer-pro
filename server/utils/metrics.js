/**
 * Advanced Metrics Collection System
 * Provides performance monitoring, API analytics, and system health metrics
 */

const logger = require('./logger');
const EventEmitter = require('events');

class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableDetailedMetrics: true,
      enablePerformanceMonitoring: true,
      enableAPIAnalytics: true,
      enableSystemHealth: true,
      metricsInterval: 30000, // 30 seconds
      maxHistorySize: 1000,
      ...options
    };
    
    this.metrics = {
      // Performance metrics
      performance: {
        cpu: { current: 0, average: 0, peak: 0 },
        memory: { used: 0, total: 0, percentage: 0 },
        disk: { readSpeed: 0, writeSpeed: 0, spaceAvailable: 0 },
        network: { latency: 0, bandwidth: 0, requests: 0 },
        render: { fps: 0, frameTime: 0, drawCalls: 0 }
      },
      
      // API analytics
      api: {
        totalRequests: 0,
        successfulRequests: 0,
        errorRequests: 0,
        averageResponseTime: 0,
        requestsByEndpoint: new Map(),
        requestsByHour: new Map(),
        topEndpoints: new Map()
      },
      
      // System health
      system: {
        uptime: 0,
        errors: [],
        warnings: [],
        lastRestart: new Date(),
        databaseConnections: 0,
        activeConnections: 0
      },
      
      // Custom metrics
      custom: new Map()
    };
    
    this.collectors = {
      performance: null,
      api: null,
      system: null
    };
    
    this.isCollecting = false;
    this.collectionInterval = null;
  }

  /**
   * Start metrics collection
   */
  start() {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    logger.info('Metrics collection started');
    
    // Initialize collectors
    this.initializeCollectors();
    
    // Start collection interval
    this.collectionInterval = setInterval(() => {
      this.collectAllMetrics();
    }, this.options.metricsInterval);
    
    this.emit('started');
  }

  /**
   * Stop metrics collection
   */
  stop() {
    if (!this.isCollecting) return;
    
    this.isCollecting = false;
    logger.info('Metrics collection stopped');
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    this.emit('stopped');
  }

  /**
   * Initialize all metrics collectors
   */
  initializeCollectors() {
    if (this.options.enablePerformanceMonitoring) {
      this.collectors.performance = this.createPerformanceCollector();
    }
    
    if (this.options.enableAPIAnalytics) {
      this.collectors.api = this.createAPICollector();
    }
    
    if (this.options.enableSystemHealth) {
      this.collectors.system = this.createSystemHealthCollector();
    }
  }

  /**
   * Create performance metrics collector
   */
  createPerformanceCollector() {
    return {
      collect: () => {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        this.metrics.performance = {
          cpu: {
            current: this.calculateCPUPercentage(cpuUsage),
            average: this.updateAverage('cpu', this.calculateCPUPercentage(cpuUsage)),
            peak: Math.max(this.metrics.performance.cpu.peak, this.calculateCPUPercentage(cpuUsage))
          },
          memory: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
          },
          disk: {
            readSpeed: this.metrics.disk.readSpeed || 0,
            writeSpeed: this.metrics.disk.writeSpeed || 0,
            spaceAvailable: this.metrics.disk.spaceAvailable || 0
          },
          network: {
            latency: this.metrics.network.latency || 0,
            bandwidth: this.metrics.network.bandwidth || 0,
            requests: this.metrics.network.requests || 0
          },
          render: {
            fps: this.metrics.render.fps || 0,
            frameTime: this.metrics.render.frameTime || 0,
            drawCalls: this.metrics.render.drawCalls || 0
          }
        };
        
        this.emit('performance_collected', this.metrics.performance);
      }
    };
  }

  /**
   * Create API analytics collector
   */
  createAPICollector() {
    return {
      collect: (endpoint, method, statusCode, responseTime) => {
        this.metrics.api.totalRequests++;
        
        if (statusCode >= 200 && statusCode < 300) {
          this.metrics.api.successfulRequests++;
        } else {
          this.metrics.api.errorRequests++;
        }
        
        // Update endpoint stats
        if (!this.metrics.api.requestsByEndpoint.has(endpoint)) {
          this.metrics.api.requestsByEndpoint.set(endpoint, {
            count: 0,
            totalTime: 0,
            errors: 0,
            averageTime: 0
          });
        }
        
        const endpointStats = this.metrics.api.requestsByEndpoint.get(endpoint);
        endpointStats.count++;
        endpointStats.totalTime += responseTime;
        
        if (statusCode >= 400) {
          endpointStats.errors++;
        }
        
        endpointStats.averageTime = endpointStats.totalTime / endpointStats.count;
        this.metrics.api.requestsByEndpoint.set(endpoint, endpointStats);
        
        // Update average response time
        this.updateAverageResponseTime();
        
        // Update top endpoints
        this.updateTopEndpoints();
        
        this.emit('api_metric_collected', {
          endpoint,
          method,
          statusCode,
          responseTime
        });
      }
    };
  }

  /**
   * Create system health collector
   */
  createSystemHealthCollector() {
    return {
      collect: () => {
        const uptime = process.uptime();
        const loadAverage = require('os').loadavg();
        
        this.metrics.system = {
          uptime: uptime,
          errors: this.metrics.system.errors.slice(-10), // Keep last 10 errors
          warnings: this.metrics.system.warnings.slice(-5), // Keep last 5 warnings
          lastRestart: this.metrics.system.lastRestart,
          databaseConnections: this.metrics.system.databaseConnections,
          activeConnections: this.metrics.system.activeConnections,
          loadAverage: loadAverage
        };
        
        this.emit('system_health_collected', this.metrics.system);
      }
    };
  }

  /**
   * Calculate CPU percentage from usage data
   */
  calculateCPUPercentage(cpuUsage) {
    // Simplified CPU percentage calculation
    const totalPercent = cpuUsage.user + cpuUsage.system;
    return Math.min(100, totalPercent);
  }

  /**
   * Update running average for a metric
   */
  updateAverage(metricName, value) {
    const metric = this.metrics.performance[metricName];
    if (metric) {
      metric.average = (metric.average * 0.9) + (value * 0.1);
    }
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime() {
    let totalTime = 0;
    let totalRequests = 0;
    
    for (const stats of this.metrics.api.requestsByEndpoint.values()) {
      totalTime += stats.totalTime;
      totalRequests += stats.count;
    }
    
    this.metrics.api.averageResponseTime = totalRequests > 0 ? totalTime / totalRequests : 0;
  }

  /**
   * Update top endpoints list
   */
  updateTopEndpoints() {
    const endpoints = Array.from(this.metrics.api.requestsByEndpoint.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        averageTime: stats.averageTime,
        errors: stats.errors
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 endpoints
    
    this.metrics.api.topEndpoints = new Map(
      endpoints.map((ep, index) => [ep.endpoint, ep])
    );
  }

  /**
   * Collect all metrics
   */
  collectAllMetrics() {
    try {
      // Collect from all collectors
      if (this.collectors.performance) {
        this.collectors.performance.collect();
      }
      
      if (this.collectors.api) {
        // API metrics are collected via middleware calls
        // This would be called from the API layer
      }
      
      if (this.collectors.system) {
        this.collectors.system.collect();
      }
      
      // Calculate overall health score
      const healthScore = this.calculateHealthScore();
      
      this.emit('metrics_collected', {
        timestamp: new Date(),
        metrics: this.metrics,
        healthScore
      });
      
      logger.debug('Metrics collection completed', {
        performance: this.metrics.performance,
        api: this.metrics.api,
        system: this.metrics.system
      });
      
    } catch (error) {
      logger.error('Error collecting metrics:', error);
      this.metrics.system.errors.push({
        timestamp: new Date(),
        type: 'metrics_collection_error',
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Calculate overall system health score
   */
  calculateHealthScore() {
    let score = 100;
    
    // Deduct for errors
    score -= this.metrics.system.errors.length * 5;
    
    // Deduct for warnings
    score -= this.metrics.system.warnings.length * 2;
    
    // Deduct for high resource usage
    if (this.metrics.performance.memory.percentage > 90) score -= 20;
    if (this.metrics.performance.cpu.current > 80) score -= 15;
    if (this.metrics.api.errorRequests / this.metrics.api.totalRequests > 0.1) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      healthScore: this.calculateHealthScore(),
      timestamp: new Date()
    };
  }

  /**
   * Add custom metric
   */
  addCustomMetric(name, value) {
    this.metrics.custom.set(name, {
      value,
      timestamp: new Date(),
      history: []
    });
    
    this.emit('custom_metric_added', { name, value });
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(duration = 3600000) { // Default 1 hour
    // This would require persistent storage implementation
    return {
      performance: [],
      api: [],
      system: [],
      custom: []
    };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics() {
    return {
      summary: this.getMetrics(),
      detailed: this.metrics,
      health: {
        status: this.calculateHealthScore() > 70 ? 'healthy' : 'degraded',
        score: this.calculateHealthScore(),
        issues: this.getHealthIssues()
      }
    };
  }

  /**
   * Get health issues
   */
  getHealthIssues() {
    const issues = [];
    
    if (this.metrics.performance.memory.percentage > 90) {
      issues.push({
        type: 'memory',
        severity: 'critical',
        message: 'Memory usage is critically high'
      });
    }
    
    if (this.metrics.performance.cpu.current > 85) {
      issues.push({
        type: 'cpu',
        severity: 'warning',
        message: 'CPU usage is elevated'
      });
    }
    
    if (this.metrics.api.errorRequests / this.metrics.api.totalRequests > 0.05) {
      issues.push({
        type: 'api',
        severity: 'warning',
        message: 'API error rate is elevated'
      });
    }
    
    return issues;
  }
}

module.exports = MetricsCollector;