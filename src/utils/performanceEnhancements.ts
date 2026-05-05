/**
 * Performance Enhancement Utilities
 * Optimizes app responsiveness and performance
 */

// Debounce for search and input events
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle for scroll events
export const throttle = <T extends (...args: any[]) => any>(
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

// Virtual scrolling helper for large lists
export class VirtualScroller {
  private containerHeight: number;
  private itemHeight: number;

  constructor(containerHeight: number, itemHeight: number) {
    this.containerHeight = containerHeight;
    this.itemHeight = itemHeight;
  }

  getVisibleRange(totalItems: number, scrollTop: number) {
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(this.containerHeight / this.itemHeight) + 1,
      totalItems
    );
    return { startIndex, endIndex };
  }

  getOffsetY(startIndex: number) {
    return startIndex * this.itemHeight;
  }
}

// Image lazy loading
export class LazyImageLoader {
  private observer: IntersectionObserver;
  private loadedImages = new Set<string>();

  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src && !this.loadedImages.has(src)) {
              img.src = src;
              img.onload = () => {
                img.classList.add("loaded");
                this.loadedImages.add(src);
              };
              this.observer.unobserve(img);
            }
          }
        });
      },
      { rootMargin: "50px" }
    );
  }

  observe(img: HTMLImageElement) {
    this.observer.observe(img);
  }

  disconnect() {
    this.observer.disconnect();
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();

  static getInstance() {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(name: string) {
    this.metrics.set(`${name}_start`, performance.now());
  }

  endTimer(name: string): number {
    const start = this.metrics.get(`${name}_start`);
    if (start) {
      const duration = performance.now() - start;
      this.metrics.set(`${name}_duration`, duration);
      return duration;
    }
    return 0;
  }

  getMetric(name: string): number | undefined {
    return this.metrics.get(name);
  }

  logSlowOperations(threshold = 100) {
    this.metrics.forEach((value, key) => {
      if (key.endsWith("_duration") && value > threshold) {
        console.warn(`Slow operation: ${key.replace("_duration", "")} took ${value.toFixed(2)}ms`);
      }
    });
  }
}

// Memory management for large datasets
export class MemoryManager {
  private cache = new Map<string, any>();
  private maxCacheSize = 100;

  set(key: string, value: any) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Responsive design utilities
export class ResponsiveHelper {
  private static breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
  };

  static getCurrentBreakpoint(): string {
    const width = window.innerWidth;
    if (width >= this.breakpoints["2xl"]) return "2xl";
    if (width >= this.breakpoints.xl) return "xl";
    if (width >= this.breakpoints.lg) return "lg";
    if (width >= this.breakpoints.md) return "md";
    return "sm";
  }

  static isMobile(): boolean {
    return this.getCurrentBreakpoint() === "sm";
  }

  static isTablet(): boolean {
    const bp = this.getCurrentBreakpoint();
    return bp === "md" || bp === "lg";
  }

  static isDesktop(): boolean {
    const bp = this.getCurrentBreakpoint();
    return bp === "xl" || bp === "2xl";
  }
}

// Animation utilities for smooth transitions
export class AnimationHelper {
  static fadeIn(element: HTMLElement, duration = 300): Promise<void> {
    return new Promise((resolve) => {
      element.style.opacity = "0";
      element.style.transition = `opacity ${duration}ms ease-in-out`;

      requestAnimationFrame(() => {
        element.style.opacity = "1";
        setTimeout(() => resolve(), duration);
      });
    });
  }

  static fadeOut(element: HTMLElement, duration = 300): Promise<void> {
    return new Promise((resolve) => {
      element.style.transition = `opacity ${duration}ms ease-in-out`;
      element.style.opacity = "0";
      setTimeout(() => resolve(), duration);
    });
  }

  static slideIn(
    element: HTMLElement,
    direction: "left" | "right" | "up" | "down" = "right",
    duration = 300
  ): Promise<void> {
    return new Promise((resolve) => {
      const transforms = {
        left: "translateX(-100%)",
        right: "translateX(100%)",
        up: "translateY(-100%)",
        down: "translateY(100%)",
      };

      element.style.transform = transforms[direction];
      element.style.transition = `transform ${duration}ms ease-out`;

      requestAnimationFrame(() => {
        element.style.transform = "translate(0)";
        setTimeout(() => resolve(), duration);
      });
    });
  }
}

export default {
  debounce,
  throttle,
  VirtualScroller,
  LazyImageLoader,
  PerformanceMonitor,
  MemoryManager,
  ResponsiveHelper,
  AnimationHelper,
};
