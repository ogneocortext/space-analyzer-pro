import { ref, onMounted, onUnmounted } from "vue";

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  fps?: number;
  componentCount?: number;
  virtualizationEnabled?: boolean;
  fileCount?: number;
}

interface UsePerformanceMonitorReturn {
  metrics: PerformanceMetrics;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  recordMetric: (name: string, value: number) => void;
}

export const usePerformanceMonitor = (): UsePerformanceMonitorReturn => {
  const metrics = ref<PerformanceMetrics>({
    renderTime: 0,
    fps: 0,
    componentCount: 0,
    virtualizationEnabled: true,
  });

  const isMonitoring = ref(false);
  const frameCount = ref(0);
  const lastFrameTime = ref(0);
  const customMetrics = ref<Record<string, number>>({});

  let animationFrameId: number | null = null;

  const calculateFPS = () => {
    const now = performance.now();
    const delta = now - lastFrameTime.value;
    if (delta > 0) {
      metrics.value.fps = Math.round(1000 / delta);
    }
    lastFrameTime.value = now;
  };

  const updateMetrics = () => {
    if (!isMonitoring.value) return;

    // Calculate FPS
    frameCount.value++;
    calculateFPS();

    // Get memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.value.memoryUsage = memory.usedJSHeapSize;
    }

    // Count components (simplified)
    const components = document.querySelectorAll('[data-component]');
    metrics.value.componentCount = components.length;
  };

  const startMonitoring = () => {
    if (isMonitoring.value) return;
    
    isMonitoring.value = true;
    frameCount.value = 0;
    lastFrameTime.value = performance.now();

    const animate = () => {
      updateMetrics();
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
  };

  const stopMonitoring = () => {
    isMonitoring.value = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  const recordMetric = (name: string, value: number) => {
    customMetrics.value[name] = value;
  };

  onMounted(() => {
    // Auto-start monitoring
    startMonitoring();
  });

  onUnmounted(() => {
    stopMonitoring();
  });

  return {
    metrics,
    startMonitoring,
    stopMonitoring,
    recordMetric,
  };
};
