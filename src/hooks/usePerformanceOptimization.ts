/* Performance Optimization Hook for Space Analyzer */
/* Enhanced with AI-recommended optimizations */

import { ref, computed, onMounted, onUnmounted } from "vue";
import { AnalysisResult, NeuralData, PerformanceMetrics } from "../types/frontend";

export interface PerformanceConfig {
  maxNodes: number;
  maxConnections: number;
  frameRateLimit: number;
  enableVirtualization: boolean;
  enableGPUAcceleration: boolean;
  cacheSize: number;
}

export interface UsePerformanceOptimizationReturn {
  config: PerformanceConfig;
  metrics: PerformanceMetrics;
  updateConfig: (newConfig: Partial<PerformanceConfig>) => void;
  optimizeForDataset: (dataSize: number) => void;
  resetMetrics: () => void;
}

export const usePerformanceOptimization = (
  initialConfig: Partial<PerformanceConfig> = {}
): UsePerformanceOptimizationReturn => {
  const config = ref<PerformanceConfig>({
    maxNodes: 10000,
    maxConnections: 1000,
    frameRateLimit: 60,
    enableVirtualization: true,
    enableGPUAcceleration: true,
    cacheSize: 1000,
    ...initialConfig,
  });

  const metrics = ref<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    fps: 0,
    componentCount: 0,
    virtualizationEnabled: config.value.enableVirtualization,
    fileCount: 0,
  });

  const frameCount = ref(0);
  const lastFrameTime = ref(0);
  const animationFrameId = ref<number | null>(null);

  const calculateFPS = () => {
    const now = performance.now();
    const delta = now - lastFrameTime.value;
    if (delta > 0) {
      metrics.value.fps = Math.round(1000 / delta);
    }
    lastFrameTime.value = now;
  };

  const updateMetrics = () => {
    // Calculate FPS
    frameCount.value++;
    calculateFPS();

    // Get memory usage if available
    if ("memory" in performance) {
      const memory = (performance as any).memory;
      metrics.value.memoryUsage = memory.usedJSHeapSize;
    }

    // Count components
    const components = document.querySelectorAll("[data-component]");
    metrics.value.componentCount = components.length;

    // Update render time (simplified)
    metrics.value.renderTime = performance.now() - lastFrameTime.value;
  };

  const optimizeForDataset = (dataSize: number) => {
    // Auto-adjust performance settings based on dataset size
    if (dataSize > 1000000) {
      // > 1M files
      config.value.maxNodes = 5000;
      config.value.enableVirtualization = true;
      config.value.cacheSize = 500;
    } else if (dataSize > 100000) {
      // > 100K files
      config.value.maxNodes = 10000;
      config.value.enableVirtualization = true;
      config.value.cacheSize = 1000;
    } else {
      config.value.maxNodes = 50000;
      config.value.enableVirtualization = false;
      config.value.cacheSize = 2000;
    }
  };

  const updateConfig = (newConfig: Partial<PerformanceConfig>) => {
    config.value = { ...config.value, ...newConfig };
  };

  const resetMetrics = () => {
    metrics.value = {
      renderTime: 0,
      memoryUsage: 0,
      fps: 0,
      componentCount: 0,
      virtualizationEnabled: config.value.enableVirtualization,
      fileCount: 0,
    };
    frameCount.value = 0;
  };

  const startPerformanceMonitoring = () => {
    const animate = () => {
      updateMetrics();
      animationFrameId.value = requestAnimationFrame(animate);
    };
    animationFrameId.value = requestAnimationFrame(animate);
  };

  const stopPerformanceMonitoring = () => {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value);
      animationFrameId.value = null;
    }
  };

  onMounted(() => {
    startPerformanceMonitoring();
  });

  onUnmounted(() => {
    stopPerformanceMonitoring();
  });

  return {
    config,
    metrics,
    updateConfig,
    optimizeForDataset,
    resetMetrics,
  };
};
