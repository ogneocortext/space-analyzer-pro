/* Performance Optimization Hook for Space Analyzer */
/* Enhanced with AI-recommended optimizations */

import React, { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { AnalysisResult, NeuralData, PerformanceMetrics } from "../types/frontend";

export interface PerformanceConfig {
  maxNodes: number;
  maxConnections: number;
  frameRateLimit: number;
  memoryThreshold: number;
  enableVirtualization: boolean;
  enableCanvasOptimization: boolean;
  enableMemoization: boolean;
  enableDebouncing: boolean;
  debounceDelay: number;
  enableThrottling: boolean;
  throttleDelay: number;
  enableLazyLoading: boolean;
  enableCodeSplitting: boolean;
}

export interface PerformanceState {
  metrics: PerformanceMetrics;
  isOptimized: boolean;
  memoryUsage: number;
  frameTime: number;
  nodeCount: number;
  connectionCount: number;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  maxNodes: 1000,
  maxConnections: 5000,
  frameRateLimit: 60,
  memoryThreshold: 100 * 1024 * 1024, // 100MB
  enableVirtualization: true,
  enableCanvasOptimization: true,
  enableMemoization: true,
  enableDebouncing: true,
  debounceDelay: 300,
  enableThrottling: true,
  throttleDelay: 16, // ~60fps
  enableLazyLoading: true,
  enableCodeSplitting: true,
};

// Performance monitoring utilities
export const usePerformanceMonitor = () => {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const lastRenderTimeRef = useRef(Date.now());

  const trackRender = useCallback(() => {
    const now = Date.now();
    const renderTime = now - lastRenderTimeRef.current;

    renderCountRef.current++;
    renderTimesRef.current.push(renderTime);

    // Keep only last 100 render times for average calculation
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current = renderTimesRef.current.slice(-100);
    }

    lastRenderTimeRef.current = now;

    return {
      renderCount: renderCountRef.current,
      renderTime,
      averageRenderTime:
        renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length,
    };
  }, []);

  const getMetrics = useCallback(() => {
    const averageRenderTime =
      renderTimesRef.current.length > 0
        ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
        : 0;

    return {
      renderCount: renderCountRef.current,
      averageRenderTime,
      lastRenderTime: lastRenderTimeRef.current,
      fps: averageRenderTime > 0 ? 1000 / averageRenderTime : 0,
    };
  }, []);

  return { trackRender, getMetrics };
};

// Enhanced debounce hook
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T => {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, deps) as T;
};

// Enhanced throttle hook
export const useThrottledCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T => {
  const lastCallRef = useRef<number>(0);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    }
  }, deps) as T;
};

// Memoized component wrapper
export const useMemoizedComponent = <T extends React.ComponentType<any>>(
  Component: T,
  areEqual?: (prevProps: any, nextProps: any) => boolean
): T => {
  return useMemo(() => {
    const MemoizedComponent = React.memo(Component, areEqual);
    MemoizedComponent.displayName = `Memoized(${Component.displayName || Component.name})`;
    return MemoizedComponent as unknown as T;
  }, [Component, areEqual]) as T;
};

// Virtual scrolling hook
export const useVirtualScrolling = (
  items: any[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    totalHeight,
    startIndex: visibleRange.startIndex,
    endIndex: visibleRange.endIndex,
    setScrollTop,
  };
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (options: IntersectionObserverInit = {}) => {
  const [entries, setEntries] = useState<IntersectionObserverEntry[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const observe = useCallback((element: Element) => {
    if (observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  const unobserve = useCallback((element: Element) => {
    if (observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      setEntries(entries);
    }, options);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [options]);

  return { entries, observe, unobserve };
};

// Memory monitoring hook
export const useMemoryMonitor = (threshold: number = 100 * 1024 * 1024) => {
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [isNearThreshold, setIsNearThreshold] = useState(false);
  const [isOverThreshold, setIsOverThreshold] = useState(false);

  useEffect(() => {
    const checkMemory = () => {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        const usedJSHeapSize = memory.usedJSHeapSize;

        setMemoryUsage(usedJSHeapSize);
        setIsNearThreshold(usedJSHeapSize > threshold * 0.8);
        setIsOverThreshold(usedJSHeapSize > threshold);
      }
    };

    const interval = setInterval(checkMemory, 5000);
    checkMemory();

    return () => clearInterval(interval);
  }, [threshold]);

  return { memoryUsage, isNearThreshold, isOverThreshold };
};

// RequestAnimationFrame hook for smooth animations
export const useRequestAnimationFrame = () => {
  const rafRef = useRef<number | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);

  const animate = useCallback(
    (callback: () => void) => {
      const animationLoop = () => {
        callback();
        if (isAnimating) {
          rafRef.current = requestAnimationFrame(animationLoop);
        }
      };

      rafRef.current = requestAnimationFrame(animationLoop);
    },
    [isAnimating]
  );

  const startAnimation = useCallback(
    (callback: () => void) => {
      setIsAnimating(true);
      animate(callback);
    },
    [animate, isAnimating]
  );

  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  return { startAnimation, stopAnimation, isAnimating };
};

export const usePerformanceOptimization = (config: Partial<PerformanceConfig> = {}) => {
  const finalConfig = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  const [state, setState] = useState<PerformanceState>({
    metrics: {
      fps: 0,
      nodes: 0,
      connections: 0,
      processingTime: 0,
      memoryUsage: 0,
      renderTime: 0,
    },
    isOptimized: false,
    memoryUsage: 0,
    frameTime: 0,
    nodeCount: 0,
    connectionCount: 0,
    renderCount: 0,
    lastRenderTime: Date.now(),
    averageRenderTime: 0,
  });

  const { trackRender, getMetrics } = usePerformanceMonitor();
  const { memoryUsage, isNearThreshold, isOverThreshold } = useMemoryMonitor(
    finalConfig.memoryThreshold
  );
  const { startAnimation, stopAnimation, isAnimating } = useRequestAnimationFrame();

  // Enhanced performance optimization methods
  const optimizeRender = useCallback(() => {
    const metrics = getMetrics();

    setState((prev) => ({
      ...prev,
      renderCount: metrics.renderCount,
      averageRenderTime: metrics.averageRenderTime,
      lastRenderTime: metrics.lastRenderTime,
      metrics: {
        ...prev.metrics,
        fps: metrics.fps,
        averageRenderTime: metrics.averageRenderTime,
      },
    }));

    // Apply optimizations based on performance metrics
    if (metrics.fps < 30) {
      // Low FPS - reduce visual effects
      document.body.style.setProperty("--animation-duration", "0s", "important");
    } else if (metrics.fps > 50) {
      // Good FPS - enable animations
      document.body.style.removeProperty("--animation-duration");
    }

    if (isOverThreshold) {
      // Memory pressure - trigger cleanup
      setState((prev) => ({ ...prev, isOptimized: false }));
    } else if (!isNearThreshold) {
      setState((prev) => ({ ...prev, isOptimized: true }));
    }
  }, [getMetrics, isNearThreshold, isOverThreshold]);

  // Performance monitoring effect
  useEffect(() => {
    const interval = setInterval(optimizeRender, 1000);
    return () => clearInterval(interval);
  }, [optimizeRender]);

  // Memoized performance utilities
  const debouncedCallback = useCallback(
    useDebouncedCallback((callback: Function) => callback, finalConfig.debounceDelay, []),
    [finalConfig.debounceDelay]
  );

  const throttledCallback = useCallback(
    useThrottledCallback((callback: Function) => callback, finalConfig.throttleDelay, []),
    [finalConfig.throttleDelay]
  );

  return {
    ...state,
    config: finalConfig,
    trackRender,
    getMetrics,
    debouncedCallback,
    throttledCallback,
    useMemoizedComponent,
    useVirtualScrolling,
    useIntersectionObserver,
    useMemoryMonitor,
    useRequestAnimationFrame,
    startAnimation,
    stopAnimation,
    isAnimating,
    memoryUsage,
    isNearThreshold,
    isOverThreshold,
  };
};
