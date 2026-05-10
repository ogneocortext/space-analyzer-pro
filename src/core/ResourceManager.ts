export interface ResourceConfig {
  name: string;
  type: 'memory' | 'dom' | 'webgl' | 'websocket' | 'timer' | 'event';
  maxAge?: number;
  maxSize?: number;
  cleanup?: (resource: any) => void;
  priority: 'high' | 'medium' | 'low';
}

export interface ResourceUsage {
  memory: number;
  domNodes: number;
  webglContexts: number;
  activeTimers: number;
  eventListeners: number;
  websockets: number;
}

export class ResourceManager {
  private static instance: ResourceManager;
  private resources = new Map<string, any>();
  private configs = new Map<string, ResourceConfig>();
  private cleanupInterval: number;
  private isDestroyed = false;
  private usageStats: ResourceUsage = {
    memory: 0,
    domNodes: 0,
    webglContexts: 0,
    activeTimers: 0,
    eventListeners: 0,
    websockets: 0
  };

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 30000); // Cleanup every 30 seconds

    // Set up memory monitoring
    this.monitorMemoryUsage();
    
    // Clean up on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.destroy();
      });
    }
  }

  register<T>(key: string, resource: T, config: ResourceConfig): T {
    if (this.isDestroyed) {
      console.warn(`Cannot register resource ${key}: ResourceManager destroyed`);
      return resource;
    }

    this.resources.set(key, resource);
    this.configs.set(key, config);

    // Track resource usage
    this.updateUsageStats(config.type, 1);

    // Set up automatic cleanup if maxAge is specified
    if (config.maxAge) {
      setTimeout(() => {
        this.unregister(key);
      }, config.maxAge);
    }

    return resource;
  }

  unregister(key: string): boolean {
    const resource = this.resources.get(key);
    const config = this.configs.get(key);

    if (!resource || !config) {
      return false;
    }

    try {
      // Perform custom cleanup if provided
      if (config.cleanup) {
        config.cleanup(resource);
      } else {
        this.defaultCleanup(resource, config.type);
      }

      this.resources.delete(key);
      this.configs.delete(key);
      this.updateUsageStats(config.type, -1);

      return true;
    } catch (error) {
      console.error(`Error cleaning up resource ${key}:`, error);
      return false;
    }
  }

  get<T>(key: string): T | undefined {
    return this.resources.get(key);
  }

  has(key: string): boolean {
    return this.resources.has(key);
  }

  private defaultCleanup(resource: any, type: string): void {
    switch (type) {
      case 'webgl':
        if (resource && typeof resource.dispose === 'function') {
          resource.dispose();
        } else if (resource && resource.getContext) {
          const gl = resource.getContext('webgl') || resource.getContext('experimental-webgl');
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.loseContext();
            }
          }
        }
        break;

      case 'websocket':
        if (resource && typeof resource.close === 'function') {
          resource.close();
        }
        break;

      case 'timer':
        if (typeof resource === 'number') {
          clearTimeout(resource);
          clearInterval(resource);
        } else if (resource && typeof resource.clear === 'function') {
          resource.clear();
        }
        break;

      case 'event':
        if (resource && typeof resource.remove === 'function') {
          resource.remove();
        } else if (resource && typeof resource.removeEventListener === 'function') {
          // For DOM event listeners, we can't easily remove them without the original function
          console.warn('DOM event listener cleanup requires original function reference');
        }
        break;

      case 'dom':
        if (resource && resource.parentNode) {
          resource.parentNode.removeChild(resource);
        }
        break;

      case 'memory':
        if (resource && typeof resource.clear === 'function') {
          resource.clear();
        } else if (resource && typeof resource.reset === 'function') {
          resource.reset();
        }
        break;
    }
  }

  private performCleanup(): void {
    if (this.isDestroyed) return;

    const now = Date.now();
    const toCleanup: string[] = [];

    for (const [key, config] of this.configs) {
      const resource = this.resources.get(key);
      if (!resource) continue;

      // Check max age
      if (config.maxAge && this.getResourceAge(key, config) > config.maxAge) {
        toCleanup.push(key);
        continue;
      }

      // Check memory pressure
      if (this.isMemoryPressureHigh() && config.priority === 'low') {
        toCleanup.push(key);
        continue;
      }
    }

    // Clean up identified resources
    toCleanup.forEach(key => {
      console.log(`Auto-cleaning resource: ${key}`);
      this.unregister(key);
    });

    // Log current usage
    this.logUsageStats();
  }

  private getResourceAge(key: string, config: ResourceConfig): number {
    // This is a simplified implementation
    // In practice, you'd want to track registration time
    return 0;
  }

  private isMemoryPressureHigh(): boolean {
    // Check if memory usage is high
    if (performance && performance.memory) {
      const memory = performance.memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      return usageRatio > 0.8; // 80% threshold
    }
    return false;
  }

  private updateUsageStats(type: string, delta: number): void {
    switch (type) {
      case 'memory':
        this.usageStats.memory += delta;
        break;
      case 'dom':
        this.usageStats.domNodes += delta;
        break;
      case 'webgl':
        this.usageStats.webglContexts += delta;
        break;
      case 'timer':
        this.usageStats.activeTimers += delta;
        break;
      case 'event':
        this.usageStats.eventListeners += delta;
        break;
      case 'websocket':
        this.usageStats.websockets += delta;
        break;
    }
  }

  private monitorMemoryUsage(): void {
    setInterval(() => {
      if (performance && performance.memory) {
        const memory = performance.memory;
        const usageMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        const usagePercent = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);

        if (usagePercent > 85) {
          console.warn(`High memory usage: ${usageMB}MB / ${limitMB}MB (${usagePercent}%)`);
          this.performEmergencyCleanup();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private performEmergencyCleanup(): void {
    console.log('Performing emergency cleanup due to memory pressure');
    
    // Clean up low priority resources first
    const lowPriorityKeys: string[] = [];
    
    for (const [key, config] of this.configs) {
      if (config.priority === 'low') {
        lowPriorityKeys.push(key);
      }
    }

    lowPriorityKeys.forEach(key => {
      this.unregister(key);
    });

    // Force garbage collection if available
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
  }

  private logUsageStats(): void {
    const total = Object.values(this.usageStats).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      console.log('Resource Usage:', this.usageStats);
    }
  }

  getUsageStats(): ResourceUsage {
    return { ...this.usageStats };
  }

  getResourceCount(): number {
    return this.resources.size;
  }

  getResourceList(): Array<{ key: string; type: string; priority: string }> {
    const list: Array<{ key: string; type: string; priority: string }> = [];
    
    for (const [key, config] of this.configs) {
      list.push({
        key,
        type: config.type,
        priority: config.priority
      });
    }
    
    return list;
  }

  forceCleanup(priority?: 'high' | 'medium' | 'low'): number {
    let cleaned = 0;
    
    for (const [key, config] of this.configs) {
      if (!priority || config.priority === priority) {
        if (this.unregister(key)) {
          cleaned++;
        }
      }
    }
    
    return cleaned;
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Clean up all resources
    const keys = Array.from(this.resources.keys());
    keys.forEach(key => {
      this.unregister(key);
    });
    
    console.log('ResourceManager destroyed');
  }

  // Utility methods for common resource types
  static createWebGLResource(canvas: HTMLCanvasElement, key: string): WebGLRenderingContext | null {
    const manager = ResourceManager.getInstance();
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (gl) {
      manager.register(key, canvas, {
        name: `WebGL Context: ${key}`,
        type: 'webgl',
        priority: 'high',
        cleanup: (resource) => {
          const context = resource.getContext('webgl') || resource.getContext('experimental-webgl');
          if (context) {
            const loseContext = context.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.loseContext();
            }
          }
        }
      });
    }
    
    return gl as WebGLRenderingContext;
  }

  static createTimer(callback: () => void, delay: number, key: string): number {
    const manager = ResourceManager.getInstance();
    const timerId = setTimeout(callback, delay);
    
    manager.register(key, timerId, {
      name: `Timer: ${key}`,
      type: 'timer',
      priority: 'medium',
      maxAge: delay + 1000 // Auto-cleanup after delay + 1s
    });
    
    return timerId;
  }

  static createWebSocket(url: string, key: string): WebSocket {
    const manager = ResourceManager.getInstance();
    const ws = new WebSocket(url);
    
    manager.register(key, ws, {
      name: `WebSocket: ${key}`,
      type: 'websocket',
      priority: 'high'
    });
    
    return ws;
  }
}