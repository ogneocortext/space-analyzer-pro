/**
 * Performance Optimization Utilities
 * Handles route preloading, resource hints, and performance monitoring
 */

import type { RouteLocationNormalized } from 'vue-router';

// Performance monitoring
export class PerformanceMonitor {
  static mark(name: string) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  }

  static measure(name: string, startMark: string, endMark?: string) {
    if (typeof performance !== 'undefined' && performance.measure) {
      performance.measure(name, startMark, endMark);
    }
  }

  static getMetrics() {
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      return performance.getEntriesByType('measure');
    }
    return [];
  }
}

// Route preloading
export class RoutePreloader {
  private static preloadedRoutes = new Set<string>();

  static preloadRoute(route: RouteLocationNormalized) {
    const routeName = route.name as string;
    
    if (this.preloadedRoutes.has(routeName)) {
      return;
    }

    // Preload the route component
    if (route.meta?.preload && route.component) {
      const component = route.component as () => Promise<any>;
      if (typeof component === 'function') {
        component().catch(() => {
          // Silently fail preloading - it's just an optimization
        });
        this.preloadedRoutes.add(routeName);
      }
    }
  }

  static preloadCriticalRoutes(router: any) {
    // Preload dashboard and scan routes as they're most commonly used
    const criticalRoutes = ['dashboard', 'scan'];
    
    criticalRoutes.forEach(routeName => {
      const route = router.resolve({ name: routeName });
      this.preloadRoute(route);
    });
  }
}

// Resource hints for external resources
export class ResourceHints {
  static preloadFont(url: string) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  static prefetchResource(url: string, as: string) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
  }

  static preconnectToOrigin(origin: string) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

// Intersection Observer for lazy loading
export class LazyLoader {
  private static observer: IntersectionObserver | null = null;

  static getObserver(): IntersectionObserver {
    if (!this.observer) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target as HTMLElement;
              if (element.dataset.component) {
                // Load component when element comes into view
                this.loadComponent(element.dataset.component, element);
              }
            }
          });
        },
        { rootMargin: '50px' } // Start loading 50px before element is visible
      );
    }
    return this.observer;
  }

  static observe(element: HTMLElement) {
    this.getObserver().observe(element);
  }

  static unobserve(element: HTMLElement) {
    this.getObserver().unobserve(element);
  }

  private static loadComponent(componentName: string, element: HTMLElement) {
    // Implementation for loading components on demand
    this.unobserve(element);
  }
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Memory optimization
export class MemoryManager {
  private static cleanupCallbacks: (() => void)[] = [];

  static registerCleanup(callback: () => void) {
    this.cleanupCallbacks.push(callback);
  }

  static cleanup() {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Cleanup callback failed:', error);
      }
    });
    this.cleanupCallbacks = [];
  }

  static forceGC() {
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
  }
}

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  PerformanceMonitor.mark('app-init-start');
  
  // Monitor first contentful paint
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          PerformanceMonitor.measure('first-contentful-paint', 'app-init-start');
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });
  }
}