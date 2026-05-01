/**
 * Vue 3 Composable for Performance Optimization
 * Provides reactive performance utilities for Vue components
 */

import { ref, onMounted, onUnmounted, computed } from 'vue';
import { 
  debounce, 
  throttle, 
  VirtualScroller, 
  LazyImageLoader, 
  PerformanceMonitor,
  MemoryManager,
  ResponsiveHelper 
} from '../utils/performanceEnhancements';

// Performance monitoring composable
export function usePerformanceMonitor(componentName: string) {
  const monitor = PerformanceMonitor.getInstance();
  const renderTime = ref(0);
  const isSlow = ref(false);

  onMounted(() => {
    monitor.startTimer(componentName);
  });

  onUnmounted(() => {
    const duration = monitor.endTimer(componentName);
    renderTime.value = duration;
    isSlow.value = duration > 100; // Consider slow if >100ms
  });

  return {
    renderTime,
    isSlow,
  };
}

// Virtual scrolling composable
export function useVirtualScroll(options: {
  itemHeight: number;
  containerHeight: number;
  items: any[];
}) {
  const scrollTop = ref(0);
  const scroller = new VirtualScroller(options.containerHeight, options.itemHeight);

  const visibleRange = computed(() => 
    scroller.getVisibleRange(options.items.length, scrollTop.value)
  );

  const visibleItems = computed(() => {
    const { startIndex, endIndex } = visibleRange.value;
    return options.items.slice(startIndex, endIndex);
  });

  const offsetY = computed(() => 
    scroller.getOffsetY(visibleRange.value.startIndex)
  );

  const totalHeight = computed(() => 
    options.items.length * options.itemHeight
  );

  const handleScroll = throttle((e: Event) => {
    scrollTop.value = (e.target as HTMLElement).scrollTop;
  }, 16); // 60fps

  return {
    visibleItems,
    offsetY,
    totalHeight,
    handleScroll,
  };
}

// Lazy image loading composable
export function useLazyImages() {
  const loader = ref<LazyImageLoader | null>(null);
  const loadedCount = ref(0);

  onMounted(() => {
    loader.value = new LazyImageLoader();
  });

  onUnmounted(() => {
    loader.value?.disconnect();
  });

  const observeImage = (img: HTMLImageElement) => {
    if (loader.value) {
      loader.value.observe(img);
      img.onload = () => loadedCount.value++;
    }
  };

  return {
    observeImage,
    loadedCount,
  };
}

// Memory management composable
export function useMemoryCache(maxSize = 100) {
  const memoryManager = new MemoryManager();
  const cacheSize = ref(0);

  const set = (key: string, value: any) => {
    memoryManager.set(key, value);
    cacheSize.value = memoryManager.size();
  };

  const get = (key: string) => {
    return memoryManager.get(key);
  };

  const clear = () => {
    memoryManager.clear();
    cacheSize.value = 0;
  };

  return {
    set,
    get,
    clear,
    cacheSize,
  };
}

// Responsive design composable
export function useResponsive() {
  const breakpoint = ref(ResponsiveHelper.getCurrentBreakpoint());
  const isMobile = computed(() => ResponsiveHelper.isMobile());
  const isTablet = computed(() => ResponsiveHelper.isTablet());
  const isDesktop = computed(() => ResponsiveHelper.isDesktop());

  const updateBreakpoint = debounce(() => {
    breakpoint.value = ResponsiveHelper.getCurrentBreakpoint();
  }, 100);

  onMounted(() => {
    window.addEventListener('resize', updateBreakpoint);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateBreakpoint);
  });

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
  };
}

// Debounced input composable
export function useDebouncedInput(initialValue = '', delay = 300) {
  const value = ref(initialValue);
  const debouncedValue = ref(initialValue);

  const updateValue = debounce((newValue: string) => {
    debouncedValue.value = newValue;
  }, delay);

  const setValue = (newValue: string) => {
    value.value = newValue;
    updateValue(newValue);
  };

  return {
    value,
    debouncedValue,
    setValue,
  };
}

// Performance metrics composable
export function usePerformanceMetrics() {
  const metrics = ref({
    fps: 60,
    memoryUsage: 0,
    renderTime: 0,
  });

  let frameCount = 0;
  let lastTime = performance.now();

  const measureFPS = () => {
    frameCount++;
    const currentTime = performance.now();
    
    if (currentTime >= lastTime + 1000) {
      metrics.value.fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      frameCount = 0;
      lastTime = currentTime;
    }
    
    requestAnimationFrame(measureFPS);
  };

  const measureMemory = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.value.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
    }
  };

  onMounted(() => {
    requestAnimationFrame(measureFPS);
    measureMemory();
    setInterval(measureMemory, 5000); // Update memory usage every 5 seconds
  });

  return {
    metrics,
  };
}

export {
  debounce,
  throttle,
  PerformanceMonitor,
  ResponsiveHelper,
};
