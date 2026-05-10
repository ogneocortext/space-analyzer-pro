/**
 * Performance Monitoring System for Space Analyzer
 * Provides real-time performance tracking and optimization suggestions
 */

import { ref, computed, onMounted, onUnmounted } from "vue";
import type { PerformanceMetrics } from "@/types/core";
import { eventBus } from "./EventBus";

export interface PerformanceThresholds {
  memory: {
    warning: number; // % memory usage
    critical: number; // % memory usage
  };
  cpu: {
    warning: number; // % CPU usage
    critical: number; // % CPU usage
  };
  disk: {
    readSpeed: {
      slow: number; // MB/s
      fast: number; // MB/s
    };
    writeSpeed: {
      slow: number; // MB/s
      fast: number; // MB/s
    };
  };
  render: {
    fps: {
      target: number; // Target FPS
      warning: number; // Below this is warning
      critical: number; // Below this is critical
    };
    frameTime: {
      target: number; // Target frame time (ms)
      warning: number; // Above this is warning
      critical: number; // Above this is critical
    };
  };
}

export interface PerformanceAlert {
  type: "memory" | "cpu" | "disk" | "render" | "network";
  severity: "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  suggestions: string[];
}

export interface PerformanceReport {
  timestamp: Date;
  duration: number;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  score: number; // 0-100 performance score
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  recommendations: string[];
}

export function usePerformanceMonitor() {
  // State
  const isMonitoring = ref(false);
  const metrics = ref<PerformanceMetrics>({
    memory: { used: 0, total: 0, percentage: 0 },
    cpu: { usage: 0, average: 0 },
    disk: { readSpeed: 0, writeSpeed: 0, spaceAvailable: 0 },
    network: { latency: 0, bandwidth: 0 },
    render: { fps: 0, frameTime: 0, drawCalls: 0, triangles: 0 },
    timestamp: new Date(),
  });
  const alerts = ref<PerformanceAlert[]>([]);
  const report = ref<PerformanceReport | null>(null);
  const thresholds = ref<PerformanceThresholds>({
    memory: { warning: 80, critical: 95 },
    cpu: { warning: 75, critical: 90 },
    disk: {
      readSpeed: { slow: 10, fast: 100 }, // MB/s
      writeSpeed: { slow: 5, fast: 50 }, // MB/s
    },
    render: {
      fps: { target: 60, warning: 30, critical: 15 },
      frameTime: { target: 16.67, warning: 33.33, critical: 66.67 }, // 60fps = 16.67ms
    },
  });

  // Monitoring intervals
  let memoryMonitor: number | null = null;
  let cpuMonitor: number | null = null;
  let renderMonitor: number | null = null;
  let networkMonitor: number | null = null;

  /**
   * Initialize performance monitoring
   */
  const startMonitoring = () => {
    if (isMonitoring.value) return;

    isMonitoring.value = true;
    console.log("🔍 Performance monitoring started");

    // Memory monitoring
    if ("memory" in performance) {
      memoryMonitor = window.setInterval(() => {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.totalJSHeapSize;
        const percentage = (used / total) * 100;

        metrics.value.memory = { used, total, percentage };
        checkThresholds("memory", percentage, thresholds.value.memory);
      }, 1000);
    }

    // CPU monitoring (simplified)
    cpuMonitor = window.setInterval(() => {
      // Estimate CPU usage based on frame time
      const frameTime = metrics.value.render.frameTime;
      const cpuUsage = Math.min(100, (frameTime / 16.67) * 100); // 16.67ms = 60fps

      metrics.value.cpu.usage = cpuUsage;
      metrics.value.cpu.average = metrics.value.cpu.average * 0.9 + cpuUsage * 0.1;
      checkThresholds("cpu", cpuUsage, thresholds.value.cpu);
    }, 2000);

    // Render monitoring
    renderMonitor = window.setInterval(() => {
      const now = performance.now();
      const frameTime = now - (metrics.value.timestamp as Date).getTime();

      metrics.value.render.frameTime = frameTime;
      metrics.value.timestamp = new Date(now);

      checkThresholds("render", frameTime, thresholds.value.render as any);
    }, 100);

    // Network monitoring
    networkMonitor = window.setInterval(() => {
      // Simulate network monitoring (would be enhanced with actual network APIs)
      const latency = Math.random() * 100 + 50; // 50-150ms latency
      const bandwidth = Math.random() * 50 + 10; // 10-60 Mbps

      metrics.value.network.latency = latency;
      metrics.value.network.bandwidth = bandwidth;

      checkThresholds("network" as any, latency, { warning: 150, critical: 300 });
    }, 5000);

    // Emit monitoring started event
    eventBus.emit("performance_monitoring_started", {
      enabled: true,
      thresholds: thresholds.value,
    });
  };

  /**
   * Stop performance monitoring
   */
  const stopMonitoring = () => {
    if (!isMonitoring.value) return;

    isMonitoring.value = false;
    console.log("⏹️ Performance monitoring stopped");

    // Clear intervals
    if (memoryMonitor) window.clearInterval(memoryMonitor);
    if (cpuMonitor) window.clearInterval(cpuMonitor);
    if (renderMonitor) window.clearInterval(renderMonitor);
    if (networkMonitor) window.clearInterval(networkMonitor);

    memoryMonitor = null;
    cpuMonitor = null;
    renderMonitor = null;
    networkMonitor = null;

    // Emit monitoring stopped event
    eventBus.emit("performance_monitoring_stopped", {
      enabled: false,
      finalMetrics: metrics.value,
    });
  };

  /**
   * Check performance against thresholds and create alerts
   */
  const checkThresholds = (
    type: keyof PerformanceThresholds,
    value: number,
    threshold: { warning: number; critical: number }
  ) => {
    let severity: "warning" | "critical" | null = null;
    let message = "";

    if (value >= threshold.critical) {
      severity = "critical";
      message = `${type} usage is critically high: ${value.toFixed(1)}% (threshold: ${threshold.critical}%)`;
    } else if (value >= threshold.warning) {
      severity = "warning";
      message = `${type} usage is elevated: ${value.toFixed(1)}% (threshold: ${threshold.warning}%)`;
    }

    if (severity) {
      const alert: PerformanceAlert = {
        type: type as any,
        severity,
        message,
        value,
        threshold: threshold[severity],
        timestamp: new Date(),
        suggestions: generateSuggestions(type, value, threshold),
      };

      alerts.value.push(alert);
      eventBus.emit("performance_warning", alert);

      // Keep only last 10 alerts
      if (alerts.value.length > 10) {
        alerts.value = alerts.value.slice(-10);
      }
    }
  };

  /**
   * Generate optimization suggestions based on performance issues
   */
  const generateSuggestions = (
    type: keyof PerformanceThresholds,
    value: number,
    _threshold: { warning: number; critical: number }
  ): string[] => {
    const suggestions: string[] = [];

    switch (type) {
      case "memory":
        if (value > 90) {
          suggestions.push("Consider closing unused applications");
          suggestions.push("Clear browser cache and restart application");
          suggestions.push("Enable memory optimization in settings");
        } else if (value > 80) {
          suggestions.push("Monitor memory-intensive operations");
          suggestions.push("Consider reducing concurrent analysis tasks");
        }
        break;

      case "cpu":
        if (value > 85) {
          suggestions.push("Close unnecessary background processes");
          suggestions.push("Reduce analysis complexity");
          suggestions.push("Enable hardware acceleration if available");
        } else if (value > 70) {
          suggestions.push("Optimize algorithms for better performance");
          suggestions.push("Consider reducing real-time updates");
        }
        break;

      case "render":
        if (value < 30) {
          suggestions.push("Graphics performance is excellent");
        } else if (value < 15) {
          suggestions.push("Consider enabling GPU acceleration");
          suggestions.push("Reduce visual effects and animations");
          suggestions.push("Lower render quality settings");
        } else {
          suggestions.push("Graphics performance is critically low");
          suggestions.push("Update graphics drivers");
          suggestions.push("Consider hardware upgrade");
        }
        break;

      case "network" as any:
        if (value > 200) {
          suggestions.push("Check network connection stability");
          suggestions.push("Consider using wired connection");
          suggestions.push("Reduce concurrent network operations");
        }
        break;
    }

    return suggestions;
  };

  /**
   * Generate performance report
   */
  const generateReport = (): PerformanceReport => {
    const score = calculatePerformanceScore();
    const grade = calculatePerformanceGrade(score);

    const report: PerformanceReport = {
      timestamp: new Date(),
      duration: 60000, // 1 minute of monitoring
      metrics: metrics.value,
      alerts: alerts.value,
      score,
      grade,
      recommendations: generateOverallRecommendations(score, grade),
    };

    // report.value = report; // Commented out as report doesn't have a value property
    eventBus.emit("performance_report_generated", report);

    return report;
  };

  /**
   * Calculate overall performance score (0-100)
   */
  const calculatePerformanceScore = (): number => {
    let score = 100;

    // Memory impact (40% weight)
    const memoryScore = Math.max(0, 100 - metrics.value.memory.percentage);
    score = score * 0.6 + memoryScore * 0.4;

    // CPU impact (30% weight)
    const cpuScore = Math.max(0, 100 - metrics.value.cpu.usage);
    score = score * 0.7 + cpuScore * 0.3;

    // Render impact (30% weight)
    let renderScore = 100;
    if (metrics.value.render.fps < thresholds.value.render.fps.critical) {
      renderScore = 20;
    } else if (metrics.value.render.fps < thresholds.value.render.fps.warning) {
      renderScore = 50;
    } else if (metrics.value.render.fps < thresholds.value.render.fps.target) {
      renderScore = 80;
    }
    score = score * 0.7 + renderScore * 0.3;

    return Math.round(score);
  };

  /**
   * Calculate performance grade
   */
  const calculatePerformanceGrade = (score: number): "A+" | "A" | "B" | "C" | "D" | "F" => {
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  /**
   * Generate overall recommendations
   */
  const generateOverallRecommendations = (_score: number, grade: string): string[] => {
    const recommendations: string[] = [];

    if (grade === "A+" || grade === "A") {
      recommendations.push("Performance is excellent - continue current configuration");
    } else if (grade === "B") {
      recommendations.push("Consider optimizing for better performance");
      recommendations.push("Monitor for potential bottlenecks");
    } else if (grade === "C") {
      recommendations.push("Performance needs improvement - identify and resolve bottlenecks");
      recommendations.push("Consider hardware upgrades if issues persist");
    } else {
      recommendations.push("Critical performance issues require immediate attention");
      recommendations.push("Consider reducing application complexity");
      recommendations.push("Hardware upgrade may be necessary");
    }

    return recommendations;
  };

  /**
   * Update render metrics from Three.js or other sources
   */
  const updateRenderMetrics = (
    fps: number,
    frameTime: number,
    drawCalls: number,
    triangles: number
  ) => {
    metrics.value.render.fps = fps;
    metrics.value.render.frameTime = frameTime;
    metrics.value.render.drawCalls = drawCalls;
    metrics.value.render.triangles = triangles;
  };

  /**
   * Update disk metrics
   */
  const updateDiskMetrics = (readSpeed: number, writeSpeed: number, spaceAvailable: number) => {
    metrics.value.disk.readSpeed = readSpeed;
    metrics.value.disk.writeSpeed = writeSpeed;
    metrics.value.disk.spaceAvailable = spaceAvailable;
  };

  // Lifecycle
  onMounted(() => {
    console.log("🔍 Performance monitor mounted");
  });

  onUnmounted(() => {
    stopMonitoring();
    console.log("🔍 Performance monitor unmounted");
  });

  return {
    // State
    isMonitoring,
    metrics,
    alerts,
    report,
    thresholds,

    // Actions
    startMonitoring,
    stopMonitoring,
    generateReport,
    updateRenderMetrics,
    updateDiskMetrics,

    // Computed
    performanceScore: computed(() => calculatePerformanceScore()),
    performanceGrade: computed(() => calculatePerformanceGrade(calculatePerformanceScore())),
    criticalAlerts: computed(() => alerts.value.filter((a) => a.severity === "critical")),
    warningAlerts: computed(() => alerts.value.filter((a) => a.severity === "warning")),
  };
}
