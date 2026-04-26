// Performance Monitoring and Bottleneck Detection Service
// Tracks performance metrics and identifies bottlenecks in real-time

interface PerformanceMetric {
  timestamp: number;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'response-time' | 'throughput' | 'error-rate' | 'cache-hit-rate';
  value: number;
  unit: string;
  source: string;
  tags?: { [key: string]: string };
}

interface PerformanceAlert {
  id: string;
  type: 'threshold' | 'anomaly' | 'trend' | 'spike' | 'degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
  duration?: number;
  impact: string;
  recommendations: string[];
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

interface Bottleneck {
  id: string;
  type: 'cpu-bound' | 'memory-bound' | 'io-bound' | 'network-bound' | 'algorithmic' | 'database' | 'cache' | 'concurrency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: string;
  metrics: {
    [key: string]: number;
  };
  impact: {
    performance: number;
    userExperience: number;
    resources: number;
  };
  rootCause: string;
  suggestions: string[];
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
}

interface PerformanceThreshold {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface PerformanceProfile {
  name: string;
  description: string;
  metrics: PerformanceMetric[];
  baseline: {
    [key: string]: number;
  };
  thresholds: PerformanceThreshold[];
  alerts: PerformanceAlert[];
  bottlenecks: Bottleneck[];
  lastUpdated: number;
}

export class PerformanceMonitoringService {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Map<string, PerformanceAlert[]> = new Map();
  private bottlenecks: Bottleneck[] = [];
  private profiles: Map<string, PerformanceProfile> = new Map();
  private thresholds: PerformanceThreshold[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: number = 5000; // 5 seconds
  private monitoringTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultThresholds();
    this.loadProfiles();
  }

  // Initialize default performance thresholds
  private initializeDefaultThresholds(): void {
    console.log('📊 Initializing performance thresholds...');
    
    this.thresholds = [
      // CPU thresholds
      { metric: 'cpu', operator: '>', value: 80, duration: 30000, severity: 'high' },
      { metric: 'cpu', operator: '>', value: 95, duration: 10000, severity: 'critical' },
      
      // Memory thresholds
      { metric: 'memory', operator: '>', value: 85, duration: 30000, severity: 'high' },
      { metric: 'memory', operator: '>', value: 95, duration: 10000, severity: 'critical' },
      
      // Response time thresholds
      { metric: 'response-time', operator: '>', value: 1000, duration: 30000, severity: 'medium' },
      { metric: 'response-time', operator: '>', value: 2000, duration: 10000, severity: 'high' },
      { metric: 'response-time', operator: '>', value: 5000, duration: 5000, severity: 'critical' },
      
      // Throughput thresholds
      { metric: 'throughput', operator: '<', value: 100, duration: 60000, severity: 'medium' },
      { metric: 'throughput', operator: '<', value: 50, duration: 30000, severity: 'high' },
      
      // Error rate thresholds
      { metric: 'error-rate', operator: '>', value: 5, duration: 30000, severity: 'medium' },
      { metric: 'error-rate', operator: '>', value: 10, duration: 10000, severity: 'high' },
      { metric: 'error-rate', operator: '>', value: 20, duration: 5000, severity: 'critical' },
      
      // Cache hit rate thresholds
      { metric: 'cache-hit-rate', operator: '<', value: 80, duration: 30000, severity: 'medium' },
      { metric: 'cache-hit-rate', operator: '<', value: 60, duration: 10000, severity: 'high' }
    ];
    
    console.log(`✅ Initialized ${this.thresholds.length} performance thresholds`);
  }

  // Load performance profiles
  private loadProfiles(): void {
    console.log('📊 Loading performance profiles...');
    
    // Development profile
    this.profiles.set('development', {
      name: 'Development',
      description: 'Development environment performance profile',
      metrics: [],
      baseline: {
        cpu: 30,
        memory: 45,
        'response-time': 200,
        throughput: 500,
        'error-rate': 0.1,
        'cache-hit-rate': 85
      },
      thresholds: [
        { metric: 'cpu', operator: '>', value: 70, duration: 30000, severity: 'medium' },
        { metric: 'memory', operator: '>', value: 80, duration: 30000, severity: 'medium' },
        { metric: 'response-time', operator: '>', value: 500, duration: 30000, severity: 'medium' }
      ],
      alerts: [],
      bottlenecks: [],
      lastUpdated: Date.now()
    });
    
    // Production profile
    this.profiles.set('production', {
      name: 'Production',
      description: 'Production environment performance profile',
      metrics: [],
      baseline: {
        cpu: 45,
        memory: 60,
        'response-time': 300,
        throughput: 1000,
        'error-rate': 0.5,
        'cache-hit-rate': 90
      },
      thresholds: [
        { metric: 'cpu', operator: '>', value: 80, duration: 30000, severity: 'high' },
        { metric: 'memory', operator: '>', value: 85, duration: 30000, severity: 'high' },
        { metric: 'response-time', operator: '>', value: 1000, duration: 30000, severity: 'high' }
      ],
      alerts: [],
      bottlenecks: [],
      lastUpdated: Date.now()
    });
    
    console.log(`✅ Loaded ${this.profiles.size} performance profiles`);
  }

  // Start performance monitoring
  startMonitoring(profileName: string = 'development'): void {
    if (this.isMonitoring) {
      console.log('⚠️ Performance monitoring is already running');
      return;
    }
    
    console.log(`🚀 Starting performance monitoring with profile: ${profileName}`);
    
    this.isMonitoring = true;
    
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics(profileName);
      this.checkThresholds();
      this.detectAnomalies();
      this.identifyBottlenecks();
    }, this.monitoringInterval);
    
    console.log('✅ Performance monitoring started');
  }

  // Stop performance monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ Performance monitoring is not running');
      return;
    }
    
    console.log('🛑 Stopping performance monitoring...');
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    this.isMonitoring = false;
    
    console.log('✅ Performance monitoring stopped');
  }

  // Collect performance metrics
  private collectMetrics(profileName: string): void {
    const profile = this.profiles.get(profileName);
    if (!profile) return;
    
    const timestamp = Date.now();
    
    // Collect system metrics (mock implementation)
    const metrics: PerformanceMetric[] = [
      {
        timestamp,
        type: 'cpu',
        value: this.simulateMetric('cpu', profile.baseline.cpu),
        unit: '%',
        source: 'system'
      },
      {
        timestamp,
        type: 'memory',
        value: this.simulateMetric('memory', profile.baseline.memory),
        unit: '%',
        source: 'system'
      },
      {
        timestamp,
        type: 'response-time',
        value: this.simulateMetric('response-time', profile.baseline['response-time']),
        unit: 'ms',
        source: 'application'
      },
      {
        timestamp,
        type: 'throughput',
        value: this.simulateMetric('throughput', profile.baseline.throughput),
        unit: 'req/s',
        source: 'application'
      },
      {
        timestamp,
        type: 'error-rate',
        value: this.simulateMetric('error-rate', profile.baseline['error-rate']),
        unit: '%',
        source: 'application'
      },
      {
        timestamp,
        type: 'cache-hit-rate',
        value: this.simulateMetric('cache-hit-rate', profile.baseline['cache-hit-rate']),
        unit: '%',
        source: 'cache'
      }
    ];
    
    // Store metrics
    metrics.forEach(metric => {
      if (!this.metrics.has(metric.type)) {
        this.metrics.set(metric.type, []);
      }
      
      const metricArray = this.metrics.get(metric.type)!;
      metricArray.push(metric);
      
      // Keep only last 1000 metrics per type
      if (metricArray.length > 1000) {
        metricArray.shift();
      }
    });
    
    // Update profile
    profile.metrics.push(...metrics);
    profile.lastUpdated = timestamp;
  }

  // Simulate metric value (in real implementation, this would collect actual metrics)
  private simulateMetric(type: string, baseline: number): number {
    // Add some randomness to simulate real-world variations
    const variation = (Math.random() - 0.5) * baseline * 0.2;
    const value = baseline + variation;
    
    // Ensure value is within reasonable bounds
    switch (type) {
      case 'cpu':
      case 'memory':
      case 'cache-hit-rate':
        return Math.max(0, Math.min(100, value));
      case 'error-rate':
        return Math.max(0, Math.min(100, value));
      case 'response-time':
        return Math.max(0, value);
      case 'throughput':
        return Math.max(0, value);
      default:
        return value;
    }
  }

  // Check thresholds and generate alerts
  private checkThresholds(): void {
    const currentTime = Date.now();
    
    this.thresholds.forEach(threshold => {
      const metricArray = this.metrics.get(threshold.metric);
      if (!metricArray || metricArray.length === 0) return;
      
      // Get recent metrics within the duration
      const recentMetrics = metricArray.filter(
        metric => currentTime - metric.timestamp <= threshold.duration
      );
      
      if (recentMetrics.length === 0) return;
      
      // Check if threshold is violated
      const violatingMetrics = recentMetrics.filter(metric => {
        switch (threshold.operator) {
          case '>': return metric.value > threshold.value;
          case '<': return metric.value < threshold.value;
          case '>=': return metric.value >= threshold.value;
          case '<=': return metric.value <= threshold.value;
          case '=': return metric.value === threshold.value;
          default: return false;
        }
      });
      
      // If all recent metrics violate the threshold, create an alert
      if (violatingMetrics.length === recentMetrics.length && violatingMetrics.length > 0) {
        this.createThresholdAlert(threshold, violatingMetrics[violatingMetrics.length - 1]);
      }
    });
  }

  // Create threshold alert
  private createThresholdAlert(threshold: PerformanceThreshold, metric: PerformanceMetric): void {
    const alertId = `threshold-${threshold.metric}-${Date.now()}`;
    
    // Check if alert already exists
    const existingAlerts = this.alerts.get('threshold') || [];
    const existingAlert = existingAlerts.find(
      alert => alert.metric === threshold.metric && !alert.resolved
    );
    
    if (existingAlert) {
      // Update existing alert
      existingAlert.currentValue = metric.value;
      existingAlert.timestamp = metric.timestamp;
      return;
    }
    
    const alert: PerformanceAlert = {
      id: alertId,
      type: 'threshold',
      severity: threshold.severity,
      title: `${threshold.metric} Threshold Violation`,
      description: `${threshold.metric} is ${metric.value}${metric.unit}, which is ${threshold.operator} ${threshold.value}${metric.unit}`,
      metric: threshold.metric,
      currentValue: metric.value,
      threshold: threshold.value,
      impact: this.getAlertImpact(threshold.metric, threshold.severity),
      recommendations: this.getThresholdRecommendations(threshold.metric, threshold.severity),
      timestamp: metric.timestamp,
      resolved: false
    };
    
    if (!this.alerts.has('threshold')) {
      this.alerts.set('threshold', []);
    }
    
    this.alerts.get('threshold')!.push(alert);
    
    console.log(`🚨 Performance alert: ${alert.title}`);
  }

  // Detect anomalies in metrics
  private detectAnomalies(): void {
    const currentTime = Date.now();
    
    this.metrics.forEach((metricArray, metricType) => {
      if (metricArray.length < 10) return; // Need enough data for anomaly detection
      
      // Get last 10 metrics
      const recentMetrics = metricArray.slice(-10);
      const values = recentMetrics.map(m => m.value);
      
      // Calculate mean and standard deviation
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      // Check for anomalies (values beyond 2 standard deviations)
      const latestMetric = recentMetrics[recentMetrics.length - 1];
      const zScore = Math.abs((latestMetric.value - mean) / stdDev);
      
      if (zScore > 2) {
        this.createAnomalyAlert(metricType, latestMetric, zScore);
      }
    });
  }

  // Create anomaly alert
  private createAnomalyAlert(metricType: string, metric: PerformanceMetric, zScore: number): void {
    const alertId = `anomaly-${metricType}-${Date.now()}`;
    
    const alert: PerformanceAlert = {
      id: alertId,
      type: 'anomaly',
      severity: zScore > 3 ? 'high' : 'medium',
      title: `Anomaly Detected in ${metricType}`,
      description: `${metricType} value ${metric.value}${metric.unit} is ${zScore.toFixed(1)} standard deviations from normal`,
      metric: metricType,
      currentValue: metric.value,
      impact: 'Unusual behavior may indicate performance issues or system problems',
      recommendations: [
        'Investigate recent changes in the system',
        'Check for external factors affecting performance',
        'Monitor for continued anomalies'
      ],
      timestamp: metric.timestamp,
      resolved: false
    };
    
    if (!this.alerts.has('anomaly')) {
      this.alerts.set('anomaly', []);
    }
    
    this.alerts.get('anomaly')!.push(alert);
    
    console.log(`🚨 Anomaly alert: ${alert.title}`);
  }

  // Identify performance bottlenecks
  private identifyBottlenecks(): void {
    const currentTime = Date.now();
    
    // CPU bottleneck
    const cpuMetrics = this.metrics.get('cpu');
    if (cpuMetrics && cpuMetrics.length > 0) {
      const latestCPU = cpuMetrics[cpuMetrics.length - 1];
      if (latestCPU.value > 85) {
        this.createBottleneck('cpu-bound', latestCPU.value);
      }
    }
    
    // Memory bottleneck
    const memoryMetrics = this.metrics.get('memory');
    if (memoryMetrics && memoryMetrics.length > 0) {
      const latestMemory = memoryMetrics[memoryMetrics.length - 1];
      if (latestMemory.value > 85) {
        this.createBottleneck('memory-bound', latestMemory.value);
      }
    }
    
    // Response time bottleneck
    const responseTimeMetrics = this.metrics.get('response-time');
    if (responseTimeMetrics && responseTimeMetrics.length > 0) {
      const latestResponseTime = responseTimeMetrics[responseTimeMetrics.length - 1];
      if (latestResponseTime.value > 2000) {
        this.createBottleneck('io-bound', latestResponseTime.value);
      }
    }
    
    // Error rate bottleneck
    const errorRateMetrics = this.metrics.get('error-rate');
    if (errorRateMetrics && errorRateMetrics.length > 0) {
      const latestErrorRate = errorRateMetrics[errorRateMetrics.length - 1];
      if (latestErrorRate.value > 10) {
        this.createBottleneck('algorithmic', latestErrorRate.value);
      }
    }
  }

  // Create bottleneck
  private createBottleneck(type: Bottleneck['type'], value: number): void {
    const bottleneckId = `bottleneck-${type}-${Date.now()}`;
    
    // Check if bottleneck already exists
    const existingBottleneck = this.bottlenecks.find(
      b => b.type === type && !b.resolved
    );
    
    if (existingBottleneck) {
      // Update existing bottleneck
      existingBottleneck.metrics[type] = value;
      existingBottleneck.detectedAt = Date.now();
      return;
    }
    
    const bottleneck: Bottleneck = {
      id: bottleneckId,
      type,
      severity: value > 90 ? 'critical' : value > 75 ? 'high' : 'medium',
      title: `${type.replace('-', ' ').toUpperCase()} Bottleneck`,
      description: `Performance bottleneck detected: ${type} at ${value}`,
      location: 'System',
      metrics: { [type]: value },
      impact: {
        performance: value / 100,
        userExperience: value / 100,
        resources: value / 100
      },
      rootCause: this.getBottleneckRootCause(type),
      suggestions: this.getBottleneckSuggestions(type),
      detectedAt: Date.now(),
      resolved: false
    };
    
    this.bottlenecks.push(bottleneck);
    
    console.log(`🔍 Bottleneck detected: ${bottleneck.title}`);
  }

  // Get bottleneck root cause
  private getBottleneckRootCause(type: string): string {
    const rootCauses: { [key: string]: string } = {
      'cpu-bound': 'High CPU usage due to inefficient algorithms or excessive computations',
      'memory-bound': 'High memory usage due to memory leaks or inefficient data structures',
      'io-bound': 'Slow I/O operations due to inefficient database queries or file operations',
      'network-bound': 'Network latency or bandwidth limitations affecting performance',
      'algorithmic': 'Inefficient algorithms causing performance degradation',
      'database': 'Database performance issues due to slow queries or lack of optimization',
      'cache': 'Cache miss rates causing performance degradation',
      'concurrency': 'Concurrency issues causing bottlenecks'
    };
    
    return rootCauses[type] || 'Unknown cause';
  }

  // Get bottleneck suggestions
  private getBottleneckSuggestions(type: string): string[] {
    const suggestions: { [key: string]: string[] } = {
      'cpu-bound': [
        'Optimize algorithms and data structures',
        'Implement caching for expensive computations',
        'Use profiling to identify CPU hotspots',
        'Consider parallel processing for CPU-intensive tasks'
      ],
      'memory-bound': [
        'Identify and fix memory leaks',
        'Optimize data structures to reduce memory usage',
        'Implement memory pooling for frequently allocated objects',
        'Use streaming for large data processing'
      ],
      'io-bound': [
        'Optimize database queries and add indexes',
        'Implement caching for frequently accessed data',
        'Use asynchronous I/O operations',
        'Consider connection pooling'
      ],
      'network-bound': [
        'Implement request batching',
        'Use compression for data transfer',
        'Optimize network protocols and formats',
        'Consider CDN for static content'
      ],
      'algorithmic': [
        'Replace inefficient algorithms with better alternatives',
        'Use appropriate data structures',
        'Implement memoization for expensive computations',
        'Consider divide and conquer approaches'
      ],
      'database': [
        'Optimize SQL queries and add proper indexes',
        'Implement database connection pooling',
        'Use database caching strategies',
        'Consider database partitioning for large datasets'
      ],
      'cache': [
        'Implement proper caching strategies',
        'Optimize cache key design',
        'Use appropriate cache eviction policies',
        'Consider distributed caching for scalability'
      ],
      'concurrency': [
        'Implement proper locking mechanisms',
        'Use thread pools for concurrent tasks',
        'Consider async/await patterns',
        'Optimize critical sections'
      ]
    };
    
    return suggestions[type] || ['Investigate the bottleneck and implement appropriate optimizations'];
  }

  // Get alert impact
  private getAlertImpact(metric: string, severity: string): string {
    const impacts: { [key: string]: { [key: string]: string } } = {
      'cpu': {
        'low': 'Minor impact on system responsiveness',
        'medium': 'Noticeable slowdown in application performance',
        'high': 'Significant performance degradation',
        'critical': 'System may become unresponsive'
      },
      'memory': {
        'low': 'Slight increase in memory usage',
        'medium': 'High memory usage may cause swapping',
        'high': 'System may run out of memory',
        'critical': 'System crash due to memory exhaustion'
      },
      'response-time': {
        'low': 'Slight delay in user experience',
        'medium': 'Noticeable delay in application response',
        'high': 'Significant delay affecting user productivity',
        'critical': 'Application may become unusable'
      },
      'throughput': {
        'low': 'Minor reduction in processing capacity',
        'medium': 'Noticeable reduction in system throughput',
        'high': 'Significant reduction in processing capacity',
        'critical': 'System may not handle expected load'
      },
      'error-rate': {
        'low': 'Occasional errors may occur',
        'medium': 'Frequent errors affecting reliability',
        'high': 'High error rate affecting system stability',
        'critical': 'System may become unreliable'
      },
      'cache-hit-rate': {
        'low': 'Slight reduction in cache efficiency',
        'medium': 'Noticeable reduction in cache performance',
        'high': 'Poor cache performance affecting system speed',
        'critical': 'Cache is ineffective, causing major performance issues'
      }
    };
    
    return impacts[metric]?.[severity] || 'Impact on system performance';
  }

  // Get threshold recommendations
  private getThresholdRecommendations(metric: string, severity: string): string[] {
    const recommendations: { [key: string]: { [key: string]: string[] } } = {
      'cpu': {
        'low': ['Monitor CPU usage trends', 'Consider optimization if trend continues'],
        'medium': ['Investigate CPU-intensive processes', 'Consider load balancing'],
        'high': ['Immediate optimization required', 'Scale resources if needed'],
        'critical': ['Emergency optimization required', 'Consider immediate scaling']
      },
      'memory': {
        'low': ['Monitor memory usage patterns', 'Check for memory leaks'],
        'medium': ['Investigate memory usage', 'Consider memory optimization'],
        'high': ['Immediate memory optimization required', 'Check for memory leaks'],
        'critical': ['Emergency memory cleanup required', 'Consider system restart']
      },
      'response-time': {
        'low': ['Monitor response time trends', 'Consider optimization'],
        'medium': ['Investigate slow operations', 'Consider caching'],
        'high': ['Immediate performance optimization required', 'Check for bottlenecks'],
        'critical': ['Emergency performance fix required', 'Consider system maintenance']
      },
      'throughput': {
        'low': ['Monitor throughput trends', 'Consider capacity planning'],
        'medium': ['Investigate throughput limitations', 'Consider optimization'],
        'high': ['Immediate scaling required', 'Check for bottlenecks'],
        'critical': ['Emergency scaling required', 'Consider system upgrade']
      },
      'error-rate': {
        'low': ['Monitor error patterns', 'Investigate occasional errors'],
        'medium': ['Investigate error causes', 'Implement error handling'],
        'high': ['Immediate error resolution required', 'Check system stability'],
        'critical': ['Emergency error fix required', 'Consider system rollback']
      },
      'cache-hit-rate': {
        'low': ['Monitor cache performance', 'Consider cache optimization'],
        'medium': ['Investigate cache miss patterns', 'Optimize cache strategy'],
        'high': ['Immediate cache optimization required', 'Check cache configuration'],
        'critical': ['Emergency cache fix required', 'Consider cache redesign']
      }
    };
    
    return recommendations[metric]?.[severity] || ['Investigate the metric and implement appropriate optimizations'];
  }

  // Add custom metric
  addMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.type)) {
      this.metrics.set(metric.type, []);
    }
    
    this.metrics.get(metric.type)!.push(metric);
  }

  // Get metrics for a specific type
  getMetrics(type: string, timeRange?: number): PerformanceMetric[] {
    const metricArray = this.metrics.get(type) || [];
    
    if (!timeRange) {
      return metricArray;
    }
    
    const cutoff = Date.now() - timeRange;
    return metricArray.filter(metric => metric.timestamp >= cutoff);
  }

  // Get all alerts
  getAlerts(type?: string, resolved?: boolean): PerformanceAlert[] {
    if (type) {
      const alerts = this.alerts.get(type) || [];
      if (resolved !== undefined) {
        return alerts.filter(alert => alert.resolved === resolved);
      }
      return alerts;
    }
    
    const allAlerts: PerformanceAlert[] = [];
    this.alerts.forEach(alerts => {
      allAlerts.push(...alerts);
    });
    
    if (resolved !== undefined) {
      return allAlerts.filter(alert => alert.resolved === resolved);
    }
    
    return allAlerts;
  }

  // Get bottlenecks
  getBottlenecks(resolved?: boolean): Bottleneck[] {
    if (resolved !== undefined) {
      return this.bottlenecks.filter(bottleneck => bottleneck.resolved === resolved);
    }
    return this.bottlenecks;
  }

  // Resolve alert
  resolveAlert(alertId: string): boolean {
    for (const [type, alerts] of this.alerts.entries()) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        console.log(`✅ Resolved alert: ${alert.title}`);
        return true;
      }
    }
    return false;
  }

  // Resolve bottleneck
  resolveBottleneck(bottleneckId: string): boolean {
    const bottleneck = this.bottlenecks.find(b => b.id === bottleneckId);
    if (bottleneck) {
      bottleneck.resolved = true;
      bottleneck.resolvedAt = Date.now();
      console.log(`✅ Resolved bottleneck: ${bottleneck.title}`);
      return true;
    }
    return false;
  }

  // Get performance summary
  getPerformanceSummary(profileName: string = 'development'): {
    metrics: { [key: string]: { current: number; baseline: number; trend: string } };
    alerts: { total: number; bySeverity: { [key: string]: number } };
    bottlenecks: { total: number; byType: { [key: string]: number } };
    health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  } {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      throw new Error(`Profile ${profileName} not found`);
    }
    
    const metrics: { [key: string]: { current: number; baseline: number; trend: string } } = {};
    const alertsBySeverity: { [key: string]: number } = {};
    const bottlenecksByType: { [key: string]: number } = {};
    
    // Calculate current metrics
    Object.keys(profile.baseline).forEach(metricType => {
      const metricArray = this.metrics.get(metricType);
      if (metricArray && metricArray.length > 0) {
        const latest = metricArray[metricArray.length - 1];
        const baseline = profile.baseline[metricType];
        const trend = this.calculateTrend(metricArray, baseline);
        
        metrics[metricType] = {
          current: latest.value,
          baseline,
          trend
        };
      }
    });
    
    // Count alerts by severity
    this.getAlerts(undefined, false).forEach(alert => {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    });
    
    // Count bottlenecks by type
    this.getBottlenecks(false).forEach(bottleneck => {
      bottlenecksByType[bottleneck.type] = (bottlenecksByType[bottleneck.type] || 0) + 1;
    });
    
    // Calculate overall health
    const health = this.calculateHealth(metrics, alertsBySeverity, bottlenecksByType);
    
    return {
      metrics,
      alerts: {
        total: this.getAlerts(undefined, false).length,
        bySeverity: alertsBySeverity
      },
      bottlenecks: {
        total: this.getBottlenecks(false).length,
        byType: bottlenecksByType
      },
      health
    };
  }

  // Calculate trend for a metric
  private calculateTrend(metrics: PerformanceMetric[], baseline: number): string {
    if (metrics.length < 2) return 'stable';
    
    const recent = metrics.slice(-5); // Last 5 metrics
    const avgRecent = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    
    if (avgRecent > baseline * 1.1) return 'increasing';
    if (avgRecent < baseline * 0.9) return 'decreasing';
    return 'stable';
  }

  // Calculate overall health
  private calculateHealth(
    metrics: { [key: string]: { current: number; baseline: number; trend: string } },
    alerts: { [key: string]: number },
    bottlenecks: { [key: string]: number }
  ): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    let score = 100;
    
    // Deduct points for metric deviations
    Object.values(metrics).forEach(metric => {
      const deviation = Math.abs(metric.current - metric.baseline) / metric.baseline;
      if (deviation > 0.2) score -= 10;
      else if (deviation > 0.1) score -= 5;
    });
    
    // Deduct points for alerts
    score -= (alerts.critical || 0) * 20;
    score -= (alerts.high || 0) * 10;
    score -= (alerts.medium || 0) * 5;
    score -= (alerts.low || 0) * 2;
    
    // Deduct points for bottlenecks
    score -= (bottlenecks.critical || 0) * 15;
    score -= (bottlenecks.high || 0) * 10;
    score -= (bottlenecks.medium || 0) * 5;
    
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  // Export performance data
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      metrics: Object.fromEntries(this.metrics),
      alerts: Object.fromEntries(this.alerts),
      bottlenecks: this.bottlenecks,
      profiles: Object.fromEntries(this.profiles),
      thresholds: this.thresholds
    };
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    // CSV export (simplified)
    const csvLines = ['timestamp,type,value,unit,source'];
    this.metrics.forEach((metrics, type) => {
      metrics.forEach(metric => {
        csvLines.push(`${metric.timestamp},${type},${metric.value},${metric.unit},${metric.source}`);
      });
    });
    
    return csvLines.join('\n');
  }

  // Clear all data
  clearData(): void {
    this.metrics.clear();
    this.alerts.clear();
    this.bottlenecks = [];
    console.log('🗑️ Performance monitoring data cleared');
  }
}

export default PerformanceMonitoringService;