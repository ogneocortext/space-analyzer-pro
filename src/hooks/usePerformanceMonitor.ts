import { useCallback, useRef, useEffect, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  fps?: number;
  componentCount?: number;
  virtualizationEnabled?: boolean;
  fileCount?: number;
}

interface PerformanceThresholds {
  renderTime: number;
  memoryUsage: number;
  fps: number;
}

interface PerformanceAlert {
  type: 'warning' | 'error';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

/**
 * Performance monitoring hook with comprehensive metrics tracking
 * Features:
 * - Render time tracking
 * - Memory usage monitoring
 * - FPS monitoring
 * - Virtualization performance
 * - Performance alerts and thresholds
 * - Historical data tracking
 */
export const usePerformanceMonitor = () => {
  const metricsRef = useRef<Map<string, PerformanceMetrics[]>>(new Map());
  const thresholdsRef = useRef<PerformanceThresholds>({
    renderTime: 100, // ms
    memoryUsage: 100, // MB
    fps: 30
  });
  
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  
  const fpsRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // FPS calculation
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    
    if (lastFrameTimeRef.current === 0) {
      lastFrameTimeRef.current = now;
    }

    frameCountRef.current++;

    if (now - lastFrameTimeRef.current >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / (now - lastFrameTimeRef.current));
      fpsRef.current = fps;
      
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }
  }, []);

  // Start FPS monitoring
  const startFPSMonitoring = useCallback(() => {
    if (animationFrameRef.current) return;

    const updateFPS = () => {
      calculateFPS();
      animationFrameRef.current = requestAnimationFrame(updateFPS);
    };

    updateFPS();
  }, [calculateFPS]);

  // Stop FPS monitoring
  const stopFPSMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }, []);

  // Record performance metric
  const recordMetric = useCallback((metricName: string, metrics: PerformanceMetrics) => {
    const metricsList = metricsRef.current.get(metricName) || [];
    metricsList.push({
      ...metrics,
      fps: fpsRef.current
    } as any);

    // Keep only last 100 entries per metric
    if (metricsList.length > 100) {
      metricsList.splice(0, metricsList.length - 100);
    }

    metricsRef.current.set(metricName, metricsList);
    setCurrentMetrics(metrics);

    // Check thresholds and create alerts
    checkThresholds(metricName, metrics);
  }, []);

  // Check performance thresholds
  const checkThresholds = useCallback((metricName: string, metrics: PerformanceMetrics) => {
    const threshold = thresholdsRef.current;
    const newAlerts: PerformanceAlert[] = [];

    if (metrics.renderTime > threshold.renderTime) {
      newAlerts.push({
        type: 'warning',
        message: `Render time exceeded threshold: ${metrics.renderTime.toFixed(2)}ms > ${threshold.renderTime}ms`,
        metric: 'renderTime',
        value: metrics.renderTime,
        threshold: threshold.renderTime,
        timestamp: new Date()
      });
    }

    if (metrics.memoryUsage && metrics.memoryUsage > threshold.memoryUsage) {
      newAlerts.push({
        type: 'error',
        message: `Memory usage exceeded threshold: ${metrics.memoryUsage.toFixed(2)}MB > ${threshold.memoryUsage}MB`,
        metric: 'memoryUsage',
        value: metrics.memoryUsage,
        threshold: threshold.memoryUsage,
        timestamp: new Date()
      });
    }

    if (metrics.fps && metrics.fps < threshold.fps) {
      newAlerts.push({
        type: 'warning',
        message: `FPS dropped below threshold: ${metrics.fps}fps < ${threshold.fps}fps`,
        metric: 'fps',
        value: metrics.fps,
        threshold: threshold.fps,
        timestamp: new Date()
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts]);
    }
  }, []);

  // Get memory usage
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize / 1024 / 1024, // MB
        total: memory.totalJSHeapSize / 1024 / 1024, // MB
        limit: memory.jsHeapSizeLimit / 1024 / 1024 // MB
      };
    }
    return null;
  }, []);

  // Get performance statistics
  const getStats = useCallback((metricName?: string) => {
    if (metricName) {
      return metricsRef.current.get(metricName) || [];
    }
    return Object.fromEntries(metricsRef.current);
  }, []);

  // Get current performance summary
  const getSummary = useCallback(() => {
    const summary: any = {
      currentFPS: fpsRef.current,
      currentMemory: getMemoryUsage(),
      alertCount: alerts.length,
      metricsCount: metricsRef.current.size,
      isMonitoring
    };

    // Calculate averages for recent metrics
    metricsRef.current.forEach((metricsList, metricName) => {
      if (metricsList.length > 0) {
        const recentMetrics = metricsList.slice(-10); // Last 10 entries
        const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
        const avgMemory = recentMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / recentMetrics.length;
        
        summary[`${metricName}Avg`] = {
          renderTime: avgRenderTime,
          memoryUsage: avgMemory,
          count: recentMetrics.length
        };
      }
    });

    return summary;
  }, [alerts.length, isMonitoring, getMemoryUsage]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    metricsRef.current.clear();
    setCurrentMetrics(null);
  }, []);

  // Set thresholds
  const setThresholds = useCallback((newThresholds: Partial<PerformanceThresholds>) => {
    thresholdsRef.current = { ...thresholdsRef.current, ...newThresholds };
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!isMonitoring) {
      setIsMonitoring(true);
      startFPSMonitoring();
    }
  }, [isMonitoring, startFPSMonitoring]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (isMonitoring) {
      setIsMonitoring(false);
      stopFPSMonitoring();
    }
  }, [isMonitoring, stopFPSMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFPSMonitoring();
    };
  }, [stopFPSMonitoring]);

  return {
    // Core functions
    recordMetric,
    startMonitoring,
    stopMonitoring,
    getStats,
    getSummary,
    
    // Configuration
    setThresholds,
    clearAlerts,
    clearMetrics,
    
    // State
    currentMetrics,
    alerts,
    isMonitoring,
    currentFPS: fpsRef.current,
    getMemoryUsage
  };
};

/**
 * Hook for measuring component render performance
 */
export const useRenderPerformance = (componentName: string) => {
  const startTimeRef = useRef<number | undefined>(undefined);
  const performanceMonitor = usePerformanceMonitor();

  useEffect(() => {
    startTimeRef.current = performance.now();
    
    return () => {
      if (startTimeRef.current) {
        const renderTime = performance.now() - startTimeRef.current;
        
        performanceMonitor.recordMetric(componentName, {
          renderTime,
          memoryUsage: performanceMonitor.getMemoryUsage()?.used,
          componentCount: 1
        } as any);
      }
    };
  }, [componentName, performanceMonitor]);

  const { currentMetrics } = performanceMonitor;
  return {
    renderTime: currentMetrics?.renderTime,
    memoryUsage: currentMetrics?.memoryUsage
  };
};

/**
 * Hook for monitoring virtualization performance
 */
export const useVirtualizationPerformance = (itemCount: number, virtualizedCount: number) => {
  const performanceMonitor = usePerformanceMonitor();

  useEffect(() => {
    const efficiency = itemCount > 0 ? (virtualizedCount / itemCount) * 100 : 0;
    
    performanceMonitor.recordMetric('virtualization', {
      renderTime: 0, // Will be calculated by the caller
      memoryUsage: performanceMonitor.getMemoryUsage()?.used,
      componentCount: virtualizedCount,
      fileCount: itemCount
    } as any);
  }, [itemCount, virtualizedCount, performanceMonitor]);

  return {
    efficiency: (virtualizedCount / Math.max(itemCount, 1)) * 100
  };
};

/**
 * Hook for monitoring file processing performance
 */
export const useFileProcessingPerformance = () => {
  const startTimeRef = useRef<number | undefined>(undefined);
  const processedCountRef = useRef<number>(0);
  const performanceMonitor = usePerformanceMonitor();

  const startProcessing = useCallback(() => {
    startTimeRef.current = performance.now();
    processedCountRef.current = 0;
  }, []);

  const recordProcessedFile = useCallback(() => {
    processedCountRef.current++;
  }, []);

  const endProcessing = useCallback((fileCount: number) => {
    if (startTimeRef.current) {
      const totalTime = performance.now() - startTimeRef.current;
      const filesPerSecond = fileCount > 0 ? (fileCount / totalTime) * 1000 : 0;
      
      performanceMonitor.recordMetric('fileProcessing', {
        renderTime: totalTime,
        memoryUsage: performanceMonitor.getMemoryUsage()?.used,
        fileCount
      } as any);
    }
  }, [performanceMonitor]);

  return {
    startProcessing,
    recordProcessedFile,
    endProcessing,
    processedCount: processedCountRef.current
  };
};

export default usePerformanceMonitor;