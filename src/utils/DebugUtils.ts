/**
 * Debug Utilities - Enhanced logging and debugging tools
 * Extracted from various components for better maintainability
 */

export interface DebugOptions {
  enableConsole?: boolean;
  enableStorage?: boolean;
  enableRemote?: boolean;
  maxStorageEntries?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface DebugEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  data?: any;
  stack?: string;
}

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: number;
  metadata?: any;
}

/**
 * Debug Logger Class
 */
export class DebugLogger {
  private options: Required<DebugOptions>;
  private entries: DebugEntry[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];

  constructor(tag: string, options: DebugOptions = {}) {
    this.options = {
      enableConsole: true,
      enableStorage: true,
      enableRemote: false,
      maxStorageEntries: 1000,
      logLevel: 'info',
      ...options,
    };
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Core logging method
   */
  private log(level: DebugEntry['level'], message: string, ...args: any[]): void {
    const entry: DebugEntry = {
      timestamp: Date.now(),
      level,
      tag: this.constructor.name,
      message,
      data: args.length > 0 ? args : undefined,
      stack: level === 'error' ? new Error().stack : undefined,
    };

    // Add to in-memory storage
    this.entries.push(entry);
    this.trimEntries();

    // Console output
    if (this.options.enableConsole && this.shouldLog(level)) {
      this.consoleLog(entry);
    }

    // Local storage
    if (this.options.enableStorage) {
      this.saveToStorage(entry);
    }

    // Remote logging (if enabled)
    if (this.options.enableRemote) {
      this.sendToRemote(entry);
    }
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: DebugEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.options.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Console logging with formatting
   */
  private consoleLog(entry: DebugEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.tag}]`;
    
    const styleMap = {
      debug: 'color: #6b7280',
      info: 'color: #3b82f6',
      warn: 'color: #f59e0b',
      error: 'color: #ef4444',
    };

    if (entry.data) {
      console.log(`%c${prefix} ${entry.message}`, styleMap[entry.level], ...entry.data);
    } else {
      console.log(`%c${prefix} ${entry.message}`, styleMap[entry.level]);
    }

    if (entry.stack) {
      console.log(entry.stack);
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(entry: DebugEntry): void {
    try {
      const key = 'debug_logs';
      const existing = localStorage.getItem(key);
      const logs = existing ? JSON.parse(existing) : [];
      
      logs.push(entry);
      
      // Keep only recent entries
      if (logs.length > this.options.maxStorageEntries) {
        logs.splice(0, logs.length - this.options.maxStorageEntries);
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (error) {
      console.warn('Failed to save debug log to localStorage:', error);
    }
  }

  /**
   * Send to remote logging service
   */
  private sendToRemote(entry: DebugEntry): void {
    // Implementation would depend on your logging service
    // This is a placeholder for remote logging
    try {
      // Example: Send to your logging endpoint
      // fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    } catch (error) {
      console.warn('Failed to send log to remote service:', error);
    }
  }

  /**
   * Trim entries to prevent memory leaks
   */
  private trimEntries(): void {
    if (this.entries.length > this.options.maxStorageEntries) {
      this.entries.splice(0, this.entries.length - this.options.maxStorageEntries);
    }
  }

  /**
   * Get all log entries
   */
  getEntries(level?: DebugEntry['level']): DebugEntry[] {
    if (level) {
      return this.entries.filter(entry => entry.level === level);
    }
    return [...this.entries];
  }

  /**
   * Get logs by tag
   */
  getEntriesByTag(tag: string): DebugEntry[] {
    return this.entries.filter(entry => entry.tag === tag);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.entries = [];
    this.performanceMetrics = [];
    localStorage.removeItem('debug_logs');
  }

  /**
   * Export logs to file
   */
  exportToFile(): void {
    const data = {
      entries: this.entries,
      performanceMetrics: this.performanceMetrics,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Start performance measurement
   */
  startPerformance(operation: string, metadata?: any): string {
    const id = `${operation}-${Date.now()}`;
    const metric: PerformanceMetrics = {
      operation,
      startTime: performance.now(),
      memoryUsage: this.getMemoryUsage(),
      metadata,
    };
    
    this.performanceMetrics.push(metric);
    return id;
  }

  /**
   * End performance measurement
   */
  endPerformance(id: string): PerformanceMetrics | null {
    const metric = this.performanceMetrics.find(m => m.operation.includes(id));
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.memoryUsage = this.getMemoryUsage();
      
      this.info(`Performance: ${metric.operation}`, {
        duration: `${metric.duration.toFixed(2)}ms`,
        memory: `${(metric.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      });
      
      return metric;
    }
    return null;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): Record<string, { count: number; avgDuration: number; totalDuration: number }> {
    const summary: Record<string, { count: number; avgDuration: number; totalDuration: number }> = {};
    
    this.performanceMetrics.forEach(metric => {
      if (metric.duration) {
        if (!summary[metric.operation]) {
          summary[metric.operation] = { count: 0, avgDuration: 0, totalDuration: 0 };
        }
        summary[metric.operation].count++;
        summary[metric.operation].totalDuration += metric.duration;
        summary[metric.operation].avgDuration = summary[metric.operation].totalDuration / summary[metric.operation].count;
      }
    });
    
    return summary;
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private measurements: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing
   */
  start(name: string): void {
    this.measurements.set(name, performance.now());
  }

  /**
   * End timing and return duration
   */
  end(name: string): number {
    const startTime = this.measurements.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.measurements.delete(name);
      return duration;
    }
    return 0;
  }

  /**
   * Measure function execution time
   */
  measure<T>(name: string, fn: () => T): T {
    this.start(name);
    try {
      const result = fn();
      const duration = this.end(name);
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Measure async function execution time
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      const duration = this.end(name);
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }
}

/**
 * Error Handler
 */
export class ErrorHandler {
  private static errors: Array<{ timestamp: number; error: Error; context?: any }> = [];

  /**
   * Handle error with logging
   */
  static handle(error: Error, context?: any): void {
    const entry = {
      timestamp: Date.now(),
      error,
      context,
    };
    
    this.errors.push(entry);
    
    console.error('❌ Error handled:', error.message, context);
    
    // Store in localStorage for debugging
    try {
      const key = 'error_log';
      const existing = localStorage.getItem(key);
      const errors = existing ? JSON.parse(existing) : [];
      errors.push(entry);
      
      // Keep only last 100 errors
      if (errors.length > 100) {
        errors.splice(0, errors.length - 100);
      }
      
      localStorage.setItem(key, JSON.stringify(errors));
    } catch (storageError) {
      console.warn('Failed to save error to localStorage:', storageError);
    }
  }

  /**
   * Get all errors
   */
  static getErrors(): Array<{ timestamp: number; error: Error; context?: any }> {
    return [...this.errors];
  }

  /**
   * Clear error log
   */
  static clear(): void {
    this.errors = [];
    localStorage.removeItem('error_log');
  }
}

// Create singleton instances
export const debugLogger = new DebugLogger('App');
export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Composable for Vue components
 */
export function useDebugLogger(tag: string, options?: DebugOptions) {
  return new DebugLogger(tag, options);
}

/**
 * Composable for performance monitoring
 */
export function usePerformanceMonitor() {
  return performanceMonitor;
}

/**
 * Utility function to create debug logs
 */
export function createDebugLog(tag: string, options?: DebugOptions) {
  return new DebugLogger(tag, options);
}