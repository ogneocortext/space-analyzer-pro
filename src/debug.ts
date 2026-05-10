// Enhanced Debug logging utility
interface DebugConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  prefix: string;
  logToConsole: boolean;
  logToFile: boolean;
}

class DebugService {
  private config: DebugConfig;
  private logBuffer: string[] = [];
  private maxBufferSize = 1000;

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enabled: true,
      level: 'debug',
      prefix: '[DEBUG]',
      logToConsole: true,
      logToFile: false,
      ...config
    };

    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    window.addEventListener("error", (event) => {
      this.error("Global error:", event.message, event.filename, event.lineno);
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.error("Unhandled promise rejection:", event.reason);
    });
  }

  private shouldLog(level: string): boolean {
    if (!this.config.enabled) return false;

    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    return `${timestamp} ${this.config.prefix} [${level.toUpperCase()}] ${message}`;
  }

  private log(level: string, ...args: any[]) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, ...args);

    // Add to buffer
    this.logBuffer.push(formattedMessage);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Log to console
    if (this.config.logToConsole) {
      const logMethod = level === 'error' ? console.error :
                       level === 'warn' ? console.warn :
                       level === 'info' ? console.info : console.log;
      logMethod(formattedMessage);
    }

    // Log to file (if implemented)
    if (this.config.logToFile) {
      // Future implementation for file logging
    }
  }

  debug(...args: any[]) {
    this.log('debug', ...args);
  }

  info(...args: any[]) {
    this.log('info', ...args);
  }

  warn(...args: any[]) {
    this.log('warn', ...args);
  }

  error(...args: any[]) {
    this.log('error', ...args);
  }

  // Performance monitoring
  time(label: string) {
    if (this.shouldLog('debug')) {
      console.time(`${this.config.prefix} ${label}`);
    }
  }

  timeEnd(label: string) {
    if (this.shouldLog('debug')) {
      console.timeEnd(`${this.config.prefix} ${label}`);
    }
  }

  // Memory monitoring
  memoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.debug('Memory usage:', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      });
    }
  }

  // Get logs
  getLogs(count?: number): string[] {
    if (count) {
      return this.logBuffer.slice(-count);
    }
    return [...this.logBuffer];
  }

  clearLogs() {
    this.logBuffer = [];
  }

  // Configuration
  setConfig(config: Partial<DebugConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): DebugConfig {
    return { ...this.config };
  }

  // Component debugging
  componentMount(componentName: string, props?: any) {
    this.debug(`Component mounted: ${componentName}`, props);
  }

  componentUnmount(componentName: string) {
    this.debug(`Component unmounted: ${componentName}`);
  }

  // API debugging
  apiCall(method: string, url: string, data?: any) {
    this.debug(`API call: ${method} ${url}`, data);
  }

  apiResponse(method: string, url: string, status: number, response?: any) {
    this.debug(`API response: ${method} ${url} ${status}`, response);
  }

  apiError(method: string, url: string, error: any) {
    this.error(`API error: ${method} ${url}`, error);
  }
}

// Export singleton instance
export const debug = new DebugService();

// Export class for creating instances
export { DebugService };
