// Performance Optimization Configuration
// Advanced performance monitoring and optimization strategies

export const PERFORMANCE_CONFIG = {
  // Critical CSS Extraction
  criticalCSS: {
    enabled: true,
    threshold: 1500, // Above-the-fold content in bytes
    components: ["App", "DashboardPage", "EnhancedFileBrowser", "EnhancedNeuralView"],
  },

  // Bundle Splitting Strategy
  bundleSplitting: {
    enabled: true,
    chunks: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: "vendor",
        chunks: "all",
        priority: 10,
      },
      common: {
        name: "common",
        minChunks: 2,
        chunks: "all",
        priority: 20,
      },
      components: {
        test: /[\\/]src[\\/](components|pages)[\\/]/,
        name: "components",
        chunks: "all",
        priority: 30,
      },
      styles: {
        test: /\.(css|scss|sass|less|styl)$/,
        name: "styles",
        chunks: "all",
        priority: 40,
      },
    },
  },

  // Tree Shaking Configuration
  treeShaking: {
    enabled: true,
    sideEffects: false,
    moduleSideEffects: false,
    usedExports: true,
  },

  // Caching Strategies
  caching: {
    enabled: true,
    strategies: {
      static: {
        pattern: /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/,
        cacheControl: "public, max-age=31536000, immutable",
      },
      dynamic: {
        pattern: /\.(html|json)$/,
        cacheControl: "public, max-age=3600",
      },
      api: {
        pattern: /\/api\//,
        cacheControl: "no-cache, no-store, must-revalidate",
      },
    },
  },

  // Runtime Performance Monitoring
  monitoring: {
    enabled: true,
    metrics: {
      // Core Web Vitals
      lcp: { threshold: 2500, good: 2500, needsImprovement: 4000 },
      fid: { threshold: 100, good: 100, needsImprovement: 300 },
      cls: { threshold: 0.1, good: 0.1, needsImprovement: 0.25 },

      // Custom Metrics
      firstPaint: { threshold: 1000 },
      firstContentfulPaint: { threshold: 1800 },
      timeToInteractive: { threshold: 3800 },
      cumulativeLayoutShift: { threshold: 0.1 },
    },
  },

  // Resource Optimization
  resourceOptimization: {
    images: {
      enabled: true,
      formats: ["webp", "avif"],
      lazyLoading: true,
      responsive: true,
      compression: true,
    },
    fonts: {
      enabled: true,
      display: "swap",
      preconnect: ["https://fonts.googleapis.com"],
      preload: ["Inter Variable", "JetBrains Mono Variable"],
    },
    scripts: {
      enabled: true,
      defer: true,
      async: true,
      minify: true,
    },
  },

  // Memory Management
  memoryManagement: {
    enabled: true,
    strategies: {
      componentUnloading: true,
      imageOptimization: true,
      eventListenerCleanup: true,
      memoryLeakDetection: true,
    },
  },

  // Network Optimization
  networkOptimization: {
    enabled: true,
    strategies: {
      http2: true,
      compression: true,
      keepAlive: true,
      dnsPrefetch: ["api.example.com"],
      preconnect: ["api.example.com", "cdn.example.com"],
    },
  },
};

// Performance Monitoring Class
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isSupported = this.checkSupport();
  }

  checkSupport() {
    return (
      "PerformanceObserver" in window &&
      "PerformanceNavigationTiming" in window &&
      "PerformancePaintTiming" in window
    );
  }

  startMonitoring() {
    if (!this.isSupported) return;

    // Monitor Core Web Vitals
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeFCP();
    this.observeTTFB();

    // Monitor Custom Metrics
    this.observeResourceTiming();
    this.observeLongTasks();
  }

  observeLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.set("LCP", lastEntry.startTime);
      this.reportMetric("LCP", lastEntry.startTime);
    });

    observer.observe({ entryTypes: ["largest-contentful-paint"] });
    this.observers.set("LCP", observer);
  }

  observeFID() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === "first-input") {
          this.metrics.set("FID", entry.processingStart - entry.startTime);
          this.reportMetric("FID", entry.processingStart - entry.startTime);
        }
      });
    });

    observer.observe({ entryTypes: ["first-input"] });
    this.observers.set("FID", observer);
  }

  observeCLS() {
    let clsValue = 0;
    let clsEntries = [];

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsEntries.push(entry);
          clsValue += entry.value;
          this.metrics.set("CLS", clsValue);
          this.reportMetric("CLS", clsValue);
        }
      });
    });

    observer.observe({ entryTypes: ["layout-shift"] });
    this.observers.set("CLS", observer);
  }

  observeFCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find((entry) => entry.name === "first-contentful-paint");
      if (fcpEntry) {
        this.metrics.set("FCP", fcpEntry.startTime);
        this.reportMetric("FCP", fcpEntry.startTime);
      }
    });

    observer.observe({ entryTypes: ["paint"] });
    this.observers.set("FCP", observer);
  }

  observeTTFB() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const ttfbEntry = entries.find((entry) => entry.name === "navigation");
      if (ttfbEntry) {
        const ttfb = ttfbEntry.responseStart - ttfbEntry.requestStart;
        this.metrics.set("TTFB", ttfb);
        this.reportMetric("TTFB", ttfb);
      }
    });

    observer.observe({ entryTypes: ["navigation"] });
    this.observers.set("TTFB", observer);
  }

  observeResourceTiming() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const duration = entry.responseEnd - entry.requestStart;
        this.reportMetric("ResourceTiming", duration, {
          name: entry.name,
          type: entry.initiatorType,
          size: entry.transferSize,
        });
      });
    });

    observer.observe({ entryTypes: ["resource"] });
    this.observers.set("ResourceTiming", observer);
  }

  observeLongTasks() {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) {
          this.reportMetric("LongTask", entry.duration, {
            name: entry.name,
            startTime: entry.startTime,
          });
        }
      });
    });

    observer.observe({ entryTypes: ["longtask"] });
    this.observers.set("LongTask", observer);
  }

  reportMetric(name, value, metadata = {}) {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      ...metadata,
    };

    // Send to analytics or logging service
    console.warn(`Performance Metric: ${name}`, metric);

    // Check thresholds and trigger warnings
    this.checkThreshold(name, value);
  }

  checkThreshold(name, value) {
    const config = PERFORMANCE_CONFIG.monitoring.metrics[name.toLowerCase()];
    if (config) {
      if (value > config.needsImprovement) {
        console.warn(`⚠️ Performance Issue: ${name} needs improvement (${value}ms)`);
      } else if (value > config.good) {
        console.info(`ℹ️ Performance Note: ${name} could be optimized (${value}ms)`);
      } else {
        console.warn(`✅ Performance Good: ${name} (${value}ms)`);
      }
    }
  }

  stopMonitoring() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

// Resource Optimization Utilities
export class ResourceOptimizer {
  static optimizeImages() {
    // Implement image optimization logic
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.srcset && !img.loading) {
        img.loading = "lazy";
        img.decoding = "async";
      }
    });
  }

  static optimizeFonts() {
    // Implement font optimization logic
    const fonts = document.querySelectorAll('link[rel="preload"][as="font"]');
    fonts.forEach((font) => {
      font.crossOrigin = "anonymous";
    });
  }

  static optimizeScripts() {
    // Implement script optimization logic
    const scripts = document.querySelectorAll("script");
    scripts.forEach((script) => {
      if (!script.defer && !script.async && !script.type) {
        script.defer = true;
      }
    });
  }

  static preloadCriticalResources() {
    // Implement critical resource preloading
    const criticalResources = [
      "/fonts/inter-variable.woff2",
      "/fonts/jetbrains-mono-variable.woff2",
      "/api/initial-data",
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.href = resource;

      if (resource.includes(".woff2")) {
        link.as = "font";
        link.type = "font/woff2";
        link.crossOrigin = "anonymous";
      } else if (resource.includes("/api/")) {
        link.as = "fetch";
      }

      document.head.appendChild(link);
    });
  }
}

// Memory Management Utilities
export class MemoryManager {
  constructor() {
    this.componentRegistry = new Map();
    this.eventListeners = new Map();
  }

  registerComponent(name, component) {
    this.componentRegistry.set(name, {
      component,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });
  }

  unregisterComponent(name) {
    const componentData = this.componentRegistry.get(name);
    if (componentData) {
      // Clean up component
      this.cleanupComponent(componentData.component);
      this.componentRegistry.delete(name);
    }
  }

  cleanupComponent(component) {
    // Clean up event listeners
    if (component.removeEventListener) {
      // Component has removeEventListener method
      const listeners = this.eventListeners.get(component);
      if (listeners) {
        listeners.forEach(({ type, handler }) => {
          component.removeEventListener(type, handler);
        });
        this.eventListeners.delete(component);
      }
    }

    // Clean up timers
    if (component._timers) {
      component._timers.forEach((timer) => clearTimeout(timer));
      component._timers = [];
    }

    // Clean up intervals
    if (component._intervals) {
      component._intervals.forEach((interval) => clearInterval(interval));
      component._intervals = [];
    }
  }

  addEventListener(element, type, handler) {
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, []);
    }
    this.eventListeners.get(element).push({ type, handler });
    element.addEventListener(type, handler);
  }

  removeEventListener(element, type, handler) {
    const listeners = this.eventListeners.get(element);
    if (listeners) {
      const index = listeners.findIndex((l) => l.type === type && l.handler === handler);
      if (index !== -1) {
        listeners.splice(index, 1);
        element.removeEventListener(type, handler);
      }
    }
  }

  checkMemoryLeaks() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    this.componentRegistry.forEach((data, name) => {
      if (now - data.lastAccessed > staleThreshold) {
        console.warn(
          `⚠️ Potential memory leak detected: Component ${name} not accessed for ${Math.round((now - data.lastAccessed) / 1000)}s`
        );
      }
    });
  }

  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }
}

// Initialize performance monitoring
export const performanceMonitor = new PerformanceMonitor();
export const resourceOptimizer = new ResourceOptimizer();
export const memoryManager = new MemoryManager();

// Auto-initialize when DOM is ready
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      performanceMonitor.startMonitoring();
      resourceOptimizer.optimizeImages();
      resourceOptimizer.optimizeFonts();
      resourceOptimizer.optimizeScripts();
      resourceOptimizer.preloadCriticalResources();
    });
  } else {
    performanceMonitor.startMonitoring();
    resourceOptimizer.optimizeImages();
    resourceOptimizer.optimizeFonts();
    resourceOptimizer.optimizeScripts();
    resourceOptimizer.preloadCriticalResources();
  }
}
