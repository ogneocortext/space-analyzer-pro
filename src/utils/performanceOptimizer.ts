/**
 * Performance Optimization Utility
 * Implements performance improvements recommended by the MoE analysis
 */

import { useCallback, useRef, useEffect, useState } from "react";

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring() {
    // Monitor navigation timing
    if ("performance" in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === "navigation") {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.set("pageLoad", navEntry.loadEventEnd - navEntry.loadEventStart);
            this.metrics.set("domInteractive", navEntry.domInteractive);
          }
        });
      });

      observer.observe({ entryTypes: ["navigation"] });
      this.observers.push(observer);
    }

    // Monitor resource loading
    if ("PerformanceObserver" in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === "resource") {
            const resourceEntry = entry as PerformanceResourceTiming;
            this.metrics.set(`resource_${resourceEntry.name}`, resourceEntry.duration);
          }
        });
      });

      resourceObserver.observe({ entryTypes: ["resource"] });
      this.observers.push(resourceObserver);
    }
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  stopMonitoring() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Lazy loading hook
export const useLazyLoad = (threshold = 0.1) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !isLoaded) {
          setIsLoaded(true);
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, isLoaded]);

  return { elementRef, isLoaded, isIntersecting };
};

// Image optimization
export const optimizeImage = (
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "webp" | "avif" | "jpeg" | "png";
  } = {}
): string => {
  const { width, height, quality = 80, format = "webp" } = options;

  // Check browser support for modern formats
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return src;

  // Create optimized image URL
  const params = new URLSearchParams();
  if (width) params.set("w", width.toString());
  if (height) params.set("h", height.toString());
  if (quality !== 80) params.set("q", quality.toString());
  if (format !== "webp") params.set("f", format);

  const baseUrl = src.split("?")[0];
  return `${baseUrl}?${params.toString()}`;
};

// Debounce utility for performance
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility for performance
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Memoization hook
export const useMemoWithCache = <T>(
  factory: () => T,
  deps: React.DependencyList,
  cacheKey?: string
): T => {
  const cache = useRef<Map<string, T>>(new Map());

  const key = cacheKey || JSON.stringify(deps);

  if (cache.current.has(key)) {
    return cache.current.get(key)!;
  }

  const value = factory();
  cache.current.set(key, value);

  return value;
};

// Virtual scrolling for large lists
export const useVirtualScroll = <T>(items: T[], itemHeight: number, containerHeight: number) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const offsetY = visibleStart * itemHeight;

  const handleScroll = useCallback(
    throttle((e: any) => {
      setScrollTop(e.currentTarget.scrollTop);
    }, 16) as any,
    []
  );

  return {
    visibleItems,
    offsetY,
    totalHeight: items.length * itemHeight,
    handleScroll,
  };
};

// Performance optimization for API calls
export const optimizedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Add performance monitoring
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Log performance metrics
    console.warn(`API call to ${url} took ${duration.toFixed(2)}ms`);

    return response;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.error(`API call to ${url} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
};

// Bundle size monitoring
export const getBundleSize = async (): Promise<{
  js: number;
  css: number;
  total: number;
}> => {
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

  const jsSize = resources
    .filter((r) => r.name.endsWith(".js"))
    .reduce((sum, r) => sum + (r.transferSize || 0), 0);

  const cssSize = resources
    .filter((r) => r.name.endsWith(".css"))
    .reduce((sum, r) => sum + (r.transferSize || 0), 0);

  return {
    js: jsSize,
    css: cssSize,
    total: jsSize + cssSize,
  };
};

// Memory usage monitoring
export const getMemoryUsage = (): {
  used: number;
  total: number;
  percentage: number;
} | null => {
  if ("memory" in performance) {
    const memory = (
      performance as Performance & { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }
    ).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
    };
  }
  return null;
};

// Critical CSS extraction
export const extractCriticalCSS = (element: HTMLElement): string => {
  const styles = window.getComputedStyle(element);
  const criticalStyles: string[] = [];

  // Extract only critical styles
  const criticalProperties = [
    "display",
    "position",
    "top",
    "left",
    "right",
    "bottom",
    "width",
    "height",
    "margin",
    "padding",
    "border",
    "background-color",
    "color",
    "font-size",
    "font-weight",
    "text-align",
    "line-height",
    "z-index",
    "overflow",
  ];

  criticalProperties.forEach((prop) => {
    const value = styles.getPropertyValue(prop);
    if (value && value !== "initial" && value !== "auto") {
      criticalStyles.push(`${prop}: ${value};`);
    }
  });

  return criticalStyles.join("\n");
};

// Performance optimization utilities
export const PerformanceUtils = {
  monitor: PerformanceMonitor.getInstance(),
  lazyLoad: useLazyLoad,
  optimizeImage,
  debounce,
  throttle,
  useMemoWithCache,
  useVirtualScroll,
  optimizedFetch,
  getBundleSize,
  getMemoryUsage,
  extractCriticalCSS,
};

export default PerformanceUtils;
