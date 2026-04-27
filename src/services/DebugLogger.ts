/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

class DebugLogger {
  private static instance: DebugLogger;
  private logs: Array<{
    timestamp: Date;
    level: "info" | "warn" | "error" | "debug";
    component: string;
    message: string;
    data?: any;
  }> = [];

  private constructor() {
    // Initialize debug logger
    this.log("info", "DebugLogger", "Debug logger initialized");
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  log(level: "info" | "warn" | "error" | "debug", component: string, message: string, data?: any) {
    const logEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      data,
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Console output
    const timestamp = logEntry.timestamp.toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;

    switch (level) {
      case "error":
        console.error(logMessage, data || "");
        break;
      case "warn":
        console.warn(logMessage, data || "");
        break;
      case "debug":
        console.debug(logMessage, data || "");
        break;
      default:
        console.warn(logMessage, data || "");
    }
  }

  info(component: string, message: string, data?: any) {
    this.log("info", component, message, data);
  }

  warn(component: string, message: string, data?: any) {
    this.log("warn", component, message, data);
  }

  error(component: string, message: string, data?: any) {
    this.log("error", component, message, data);
  }

  debug(component: string, message: string, data?: any) {
    this.log("debug", component, message, data);
  }

  getLogs(level?: "info" | "warn" | "error" | "debug") {
    if (level) {
      return this.logs.filter((log) => log.level === level);
    }
    return this.logs;
  }

  getRecentLogs(count: number = 50) {
    return this.logs.slice(-count);
  }

  clearLogs() {
    this.logs = [];
    this.log("info", "DebugLogger", "Logs cleared");
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Performance monitoring
  time(component: string, operation: string): () => void {
    const startTime = performance.now();
    this.debug(component, `Timer started: ${operation}`);

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.info(component, `Timer completed: ${operation}`, {
        duration: `${duration.toFixed(2)}ms`,
      });
    };
  }

  // Component lifecycle tracking
  trackComponent(component: string, lifecycle: "mount" | "unmount" | "update", props?: any) {
    this.debug(component, `Component ${lifecycle}`, props);
  }

  // API call tracking
  trackApiCall(method: string, url: string, status: number, duration: number) {
    const level = status >= 400 ? "error" : status >= 300 ? "warn" : "info";
    this.log(level, "API", `${method} ${url}`, {
      status,
      duration: `${duration.toFixed(2)}ms`,
    });
  }

  // Error boundary tracking
  trackError(component: string, error: Error, errorInfo?: any) {
    this.error(component, "Error boundary caught error", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
    });
  }
}

// Export both class and instance
export { DebugLogger };
export const debugLogger = DebugLogger.getInstance();

// React hook for debugging
export const useDebugLogger = (componentName: string) => {
  const logger = debugLogger;

  return {
    info: (message: string, data?: any) => logger.info(componentName, message, data),
    warn: (message: string, data?: any) => logger.warn(componentName, message, data),
    error: (message: string, data?: any) => logger.error(componentName, message, data),
    debug: (message: string, data?: any) => logger.debug(componentName, message, data),
    time: (operation: string) => logger.time(componentName, operation),
    trackComponent: (lifecycle: "mount" | "unmount" | "update", props?: any) =>
      logger.trackComponent(componentName, lifecycle, props),
  };
};

// Global error tracking
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    debugLogger.error("Global", "Unhandled error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    debugLogger.error("Global", "Unhandled promise rejection", {
      reason: event.reason,
    });
  });
}
