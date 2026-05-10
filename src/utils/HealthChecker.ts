export interface HealthCheckConfig {
  name: string;
  url?: string;
  method?: 'GET' | 'POST';
  timeout: number;
  interval: number;
  retries?: number;
  expectedStatus?: number;
  customCheck?: () => Promise<boolean>;
  critical?: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  consecutiveFailures: number;
  uptime: number;
}

export class HealthChecker {
  private static instance: HealthChecker;
  private checks = new Map<string, HealthCheckConfig>();
  private statuses = new Map<string, HealthStatus>();
  private intervals = new Map<string, number>();
  private listeners: Array<(name: string, status: HealthStatus) => void> = [];
  private isDestroyed = false;

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  registerCheck(config: HealthCheckConfig): void {
    this.checks.set(config.name, config);
    
    // Initialize status
    this.statuses.set(config.name, {
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      uptime: 100
    });

    // Start periodic checking
    this.startCheck(config.name);
  }

  private startCheck(name: string): void {
    const config = this.checks.get(name);
    if (!config || this.isDestroyed) return;

    const intervalId = setInterval(async () => {
      await this.performCheck(name);
    }, config.interval);

    this.intervals.set(name, intervalId);
  }

  private async performCheck(name: string): Promise<void> {
    const config = this.checks.get(name);
    const currentStatus = this.statuses.get(name);
    
    if (!config || !currentStatus || this.isDestroyed) return;

    const startTime = Date.now();
    let healthy = false;
    let responseTime: number | undefined;
    let error: string | undefined;

    try {
      if (config.customCheck) {
        healthy = await config.customCheck();
      } else if (config.url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(config.url, {
          method: config.method || 'GET',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        clearTimeout(timeoutId);
        responseTime = Date.now() - startTime;

        const expectedStatus = config.expectedStatus || 200;
        healthy = response.status === expectedStatus;
      }
    } catch (err) {
      healthy = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Update status
    const newStatus: HealthStatus = {
      healthy,
      lastCheck: new Date(),
      responseTime,
      error,
      consecutiveFailures: healthy ? 0 : currentStatus.consecutiveFailures + 1,
      uptime: this.calculateUptime(name, healthy)
    };

    this.statuses.set(name, newStatus);

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(name, newStatus);
      } catch (err) {
        console.error('Health check listener error:', err);
      }
    });

    // Log status changes
    if (currentStatus.healthy !== healthy) {
      if (healthy) {
        console.log(`✅ Health check passed: ${name} (${responseTime}ms)`);
      } else {
        console.error(`❌ Health check failed: ${name} - ${error}`);
        
        // If critical service fails, trigger alerts
        if (config.critical) {
          this.triggerCriticalAlert(name, newStatus);
        }
      }
    }
  }

  private calculateUptime(name: string, currentHealthy: boolean): number {
    const status = this.statuses.get(name);
    if (!status) return 100;

    // Simple uptime calculation based on recent checks
    const recentChecks = 10; // Check last 10 attempts
    let uptime = 0;

    for (let i = 0; i < recentChecks; i++) {
      if (i === 0) {
        uptime += currentHealthy ? 1 : 0;
      } else {
        uptime += status.healthy ? 1 : 0;
      }
    }

    return Math.round((uptime / recentChecks) * 100);
  }

  private triggerCriticalAlert(name: string, status: HealthStatus): void {
    console.error(`🚨 CRITICAL SERVICE DOWN: ${name}`);
    
    // Send alert to monitoring service
    fetch('/api/alerts/critical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: name,
        error: status.error,
        consecutiveFailures: status.consecutiveFailures,
        timestamp: new Date().toISOString()
      })
    }).catch(err => {
      console.error('Failed to send critical alert:', err);
    });

    // Show user notification if available
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Critical Service Alert', {
          body: `${name} service is down. Please check your connection.`,
          icon: '/icons/warning.png'
        });
      }
    }
  }

  getStatus(name: string): HealthStatus | undefined {
    return this.statuses.get(name);
  }

  getAllStatuses(): Record<string, HealthStatus> {
    const result: Record<string, HealthStatus> = {};
    for (const [name, status] of this.statuses) {
      result[name] = status;
    }
    return result;
  }

  isHealthy(name: string): boolean {
    const status = this.statuses.get(name);
    return status?.healthy ?? false;
  }

  isSystemHealthy(): boolean {
    const criticalChecks = Array.from(this.checks.values())
      .filter(check => check.critical);

    return criticalChecks.every(check => this.isHealthy(check.name));
  }

  onStatusChange(listener: (name: string, status: HealthStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async checkNow(name: string): Promise<HealthStatus> {
    await this.performCheck(name);
    return this.statuses.get(name)!;
  }

  async checkAllNow(): Promise<Record<string, HealthStatus>> {
    const promises = Array.from(this.checks.keys()).map(name => 
      this.checkNow(name)
    );
    
    const results = await Promise.all(promises);
    const statuses: Record<string, HealthStatus> = {};
    
    const names = Array.from(this.checks.keys());
    names.forEach((name, index) => {
      statuses[name] = results[index];
    });
    
    return statuses;
  }

  removeCheck(name: string): void {
    // Clear interval
    const intervalId = this.intervals.get(name);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(name);
    }

    // Remove check and status
    this.checks.delete(name);
    this.statuses.delete(name);
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Clear all intervals
    for (const intervalId of this.intervals.values()) {
      clearInterval(intervalId);
    }
    
    // Clear all data
    this.checks.clear();
    this.statuses.clear();
    this.intervals.clear();
    this.listeners.length = 0;
    
    console.log('HealthChecker destroyed');
  }

  // Predefined health check configurations
  static readonly configs = {
    api: {
      name: 'api',
      url: '/api/health',
      timeout: 5000,
      interval: 30000,
      critical: true
    },

    database: {
      name: 'database',
      url: '/api/health/database',
      timeout: 3000,
      interval: 60000,
      critical: true
    },

    ollama: {
      name: 'ollama',
      url: 'http://localhost:11434/api/tags',
      timeout: 5000,
      interval: 30000,
      critical: false
    },

    websocket: {
      name: 'websocket',
      customCheck: async () => {
        try {
          const ws = new WebSocket('ws://localhost:3001/ws');
          return new Promise((resolve) => {
            ws.onopen = () => {
              ws.close();
              resolve(true);
            };
            ws.onerror = () => resolve(false);
            setTimeout(() => {
              ws.close();
              resolve(false);
            }, 2000);
          });
        } catch {
          return false;
        }
      },
      timeout: 5000,
      interval: 30000,
      critical: false
    },

    memory: {
      name: 'memory',
      customCheck: async () => {
        if (performance && performance.memory) {
          const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
          return usage < 0.85; // 85% threshold
        }
        return true; // Assume healthy if memory API not available
      },
      timeout: 1000,
      interval: 60000,
      critical: false
    },

    filesystem: {
      name: 'filesystem',
      url: '/api/health/filesystem',
      timeout: 5000,
      interval: 120000, // 2 minutes
      critical: true
    }
  };

  initialize(): void {
    console.log('Initializing HealthChecker...');
    
    // Register all predefined checks
    Object.values(HealthChecker.configs).forEach(config => {
      this.registerCheck(config);
    });

    // Set up global error monitoring
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        console.error('Global error detected:', event.error);
      });

      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
      });
    }

    console.log('HealthChecker initialized with', this.checks.size, 'checks');
  }
}