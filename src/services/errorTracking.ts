/**
 * Error Tracking Service
 * Captures and reports frontend errors to the backend
 */

interface ErrorContext {
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

interface ErrorReport {
  type: string;
  message: string;
  stack?: string;
  url: string;
  timestamp: string;
  viewport: { width: number; height: number };
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

class ErrorTracker {
  private isEnabled = true;
  private buffer: ErrorReport[] = [];
  private bufferSize = 50;
  private flushInterval = 10000; // 10 seconds
  private apiUrl = "/api/errors/report";
  private lastErrors = new Set<string>(); // For deduplication
  private maxDedupeSize = 100;

  constructor() {
    this.setupGlobalHandlers();
    this.startFlushInterval();
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    // Global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.captureError(error || new Error(String(message)), {
        source: "window.onerror",
        lineNumber: lineno,
        columnNumber: colno,
        fileName: source,
      });
      return false; // Let default handler run too
    };

    // Unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { source: "unhandledrejection" }
      );
    });

    // Vue error handler will be registered separately
  }

  /**
   * Start the flush interval
   */
  private startFlushInterval(): void {
    setInterval(() => this.flushBuffer(), this.flushInterval);
  }

  /**
   * Capture and buffer an error
   */
  captureError(error: Error | string, context: ErrorContext = {}): string {
    if (!this.isEnabled) return "";

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorType = error instanceof Error ? error.name : "Error";

    // Deduplication: skip if same error was recently reported
    const dedupeKey = `${errorType}:${errorMessage}:${context.component || ""}`;
    if (this.lastErrors.has(dedupeKey)) {
      return "";
    }

    this.lastErrors.add(dedupeKey);
    if (this.lastErrors.size > this.maxDedupeSize) {
      const first = this.lastErrors.values().next().value;
      this.lastErrors.delete(first);
    }

    // Clear dedupe after 5 minutes
    setTimeout(() => this.lastErrors.delete(dedupeKey), 300000);

    const report: ErrorReport = {
      type: errorType,
      message: errorMessage,
      stack: errorStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      component: context.component,
      action: context.action,
      metadata: {
        ...context.metadata,
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
      },
    };

    // Add to buffer
    this.buffer.push(report);

    // Keep buffer size limited
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error("[ErrorTracker]", errorType + ":", errorMessage, context);
    }

    // Flush immediately for critical errors
    if (this.isCriticalError(error)) {
      this.flushBuffer();
    }

    return report.timestamp;
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(error: Error | string): boolean {
    const criticalPatterns = [
      "SyntaxError",
      "ReferenceError",
      "TypeError",
      "RangeError",
      "out of memory",
      "Maximum call stack",
    ];

    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";

    return criticalPatterns.some((pattern) => message.includes(pattern) || name.includes(pattern));
  }

  /**
   * Flush error buffer to backend
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const errors = [...this.buffer];
    this.buffer = [];

    // Send errors in batch
    for (const error of errors) {
      try {
        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(error),
          // Don't wait for response
          keepalive: true,
        });

        // Check if response is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          // Only parse if it's actually JSON
          try {
            await response.json();
          } catch {
            // JSON parse failed, but we don't care about the response
          }
        }
        // If not JSON (e.g., HTML error page), just ignore - we'll log locally
      } catch (err) {
        // If reporting fails, log locally but don't create infinite loop
        if (import.meta.env.DEV) {
          console.debug("Failed to report error to backend:", err);
        }
        // Could store in localStorage for later retry
      }
    }
  }

  /**
   * Log an error manually
   */
  log(message: string, context: ErrorContext = {}): void {
    this.captureError(new Error(message), context);
  }

  /**
   * Log a warning (non-fatal)
   */
  warn(message: string, context: ErrorContext = {}): void {
    this.captureError(new Error(`[WARNING] ${message}`), { ...context, level: "warn" });
  }

  /**
   * Log an info message
   */
  info(message: string, context: ErrorContext = {}): void {
    // Info messages don't get reported, just logged
    if (import.meta.env.DEV) {
      console.info("[ErrorTracker]", message, context);
    }
  }

  /**
   * Track component lifecycle errors
   */
  trackComponentError(component: string, error: Error, info?: string): void {
    this.captureError(error, {
      component,
      action: "component_error",
      metadata: { info },
    });
  }

  /**
   * Track async operation errors
   */
  async trackAsync<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.captureError(error instanceof Error ? error : new Error(String(error)), context);
      throw error;
    }
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get recent errors from buffer
   */
  getRecentErrors(): ErrorReport[] {
    return [...this.buffer];
  }

  /**
   * Clear the error buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }
}

// Singleton instance
let instance: ErrorTracker | null = null;

export function getErrorTracker(): ErrorTracker {
  if (!instance) {
    instance = new ErrorTracker();
  }
  return instance;
}

// Vue error handler
export function vueErrorHandler(err: unknown, instance: any, info: string): void {
  const tracker = getErrorTracker();
  const componentName = instance?.$options?.name || "UnknownComponent";

  tracker.trackComponentError(
    componentName,
    err instanceof Error ? err : new Error(String(err)),
    info
  );
}

// Composable for Vue components
export function useErrorTracking() {
  const tracker = getErrorTracker();

  return {
    log: (message: string, context?: ErrorContext) => tracker.log(message, context),
    warn: (message: string, context?: ErrorContext) => tracker.warn(message, context),
    info: (message: string, context?: ErrorContext) => tracker.info(message, context),
    capture: (error: Error, context?: ErrorContext) => tracker.captureError(error, context),
    trackAsync: <T>(fn: () => Promise<T>, context: ErrorContext) => tracker.trackAsync(fn, context),
  };
}

export default getErrorTracker();
