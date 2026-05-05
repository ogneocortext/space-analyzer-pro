/**
 * Comprehensive Error Tracking and Reporting System
 * Captures, categorizes, and reports errors across the application
 */

export interface ErrorReport {
  id: string;
  timestamp: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  source: ErrorSource;
  component?: string;
  action?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
  resolved?: boolean;
  count?: number;
}

export enum ErrorType {
  JAVASCRIPT = "javascript",
  NETWORK = "network",
  API = "api",
  COMPONENT = "component",
  ROUTING = "routing",
  STORAGE = "storage",
  PERMISSION = "permission",
  VALIDATION = "validation",
  PERFORMANCE = "performance",
  UNKNOWN = "unknown",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum ErrorSource {
  FRONTEND = "frontend",
  BACKEND = "backend",
  AI_SERVICE = "ai-service",
  SYSTEM = "system",
  USER = "user",
}

export interface ErrorStats {
  total: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  bySource: Record<ErrorSource, number>;
  recent: ErrorReport[];
  critical: ErrorReport[];
  trends: {
    hourly: Record<string, number>;
    daily: Record<string, number>;
  };
}

class ErrorTracker {
  private static instance: ErrorTracker;
  private errors: ErrorReport[] = [];
  private maxErrors = 1000;
  private reportEndpoint = "/api/errors/report";
  private sessionId: string;
  private userId?: string;
  private isTracking = true;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeGlobalHandlers();
    this.loadStoredErrors();
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeGlobalHandlers(): void {
    // Global error handler
    window.addEventListener("error", (event) => {
      this.trackError({
        id: this.generateErrorId(),
        timestamp: new Date().toISOString(),
        type: ErrorType.JAVASCRIPT,
        severity: this.determineSeverity(event.error),
        message: event.message,
        stack: event.error?.stack,
        source: ErrorSource.FRONTEND,
        url: event.filename,
        context: {
          lineno: event.lineno,
          colno: event.colno,
          userAgent: navigator.userAgent,
        },
      });
    });

    // Unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.trackError({
        id: this.generateErrorId(),
        timestamp: new Date().toISOString(),
        type: ErrorType.JAVASCRIPT,
        severity: ErrorSeverity.HIGH,
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        source: ErrorSource.FRONTEND,
        context: {
          reason: event.reason,
          userAgent: navigator.userAgent,
        },
      });
    });

    // Network error monitoring
    this.interceptFetch();
  }

  private interceptFetch(): void {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        // Track HTTP errors
        if (!response.ok) {
          this.trackError({
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            type: ErrorType.API,
            severity: response.status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
            message: `HTTP Error: ${response.status} ${response.statusText}`,
            source: ErrorSource.BACKEND,
            url: args[0] as string,
            context: {
              status: response.status,
              statusText: response.statusText,
              method: args[1]?.method || "GET",
            },
          });
        }

        return response;
      } catch (error) {
        this.trackError({
          id: this.generateErrorId(),
          timestamp: new Date().toISOString(),
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.HIGH,
          message: `Network Error: ${error instanceof Error ? error.message : String(error)}`,
          stack: error instanceof Error ? error.stack : undefined,
          source: ErrorSource.FRONTEND,
          url: args[0] as string,
          context: {
            method: args[1]?.method || "GET",
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    };
  }

  private determineSeverity(error: Error): ErrorSeverity {
    if (!error) return ErrorSeverity.MEDIUM;

    const message = error.message.toLowerCase();

    // Critical indicators
    if (
      message.includes("quota") ||
      message.includes("storage") ||
      message.includes("memory") ||
      message.includes("fatal") ||
      message.includes("security")
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity indicators
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("permission")
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity indicators
    if (message.includes("parse") || message.includes("format") || message.includes("validation")) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadStoredErrors(): void {
    try {
      const stored = localStorage.getItem("error_tracker_errors");
      if (stored) {
        this.errors = JSON.parse(stored);
        // Keep only recent errors
        this.errors = this.errors.slice(-this.maxErrors);
      }
    } catch (error) {
      console.warn("Failed to load stored errors:", error);
    }
  }

  private saveErrors(): void {
    try {
      localStorage.setItem("error_tracker_errors", JSON.stringify(this.errors));
    } catch (error) {
      console.warn("Failed to save errors:", error);
      // Clear some errors if storage is full
      this.errors = this.errors.slice(-500);
      try {
        localStorage.setItem("error_tracker_errors", JSON.stringify(this.errors));
      } catch (retryError) {
        console.warn("Failed to save errors after cleanup:", retryError);
      }
    }
  }

  public trackError(error: Partial<ErrorReport>): void {
    if (!this.isTracking) return;

    const fullError: ErrorReport = {
      id: error.id || this.generateErrorId(),
      timestamp: error.timestamp || new Date().toISOString(),
      type: error.type || ErrorType.UNKNOWN,
      severity: error.severity || ErrorSeverity.MEDIUM,
      message: error.message || "Unknown error",
      stack: error.stack,
      source: error.source || ErrorSource.FRONTEND,
      component: error.component,
      action: error.action,
      url: error.url || window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      context: error.context,
      resolved: false,
      count: 1,
    };

    // Check for duplicate errors
    const existingError = this.findDuplicate(fullError);
    if (existingError) {
      existingError.count = (existingError.count || 1) + 1;
      existingError.timestamp = fullError.timestamp;
    } else {
      this.errors.push(fullError);
    }

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    this.saveErrors();
    this.reportError(fullError);
  }

  private findDuplicate(error: ErrorReport): ErrorReport | null {
    return (
      this.errors.find(
        (e) =>
          e.message === error.message &&
          e.type === error.type &&
          e.component === error.component &&
          e.action === error.action
      ) || null
    );
  }

  private async reportError(error: ErrorReport): Promise<void> {
    try {
      await fetch(this.reportEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(error),
      });
    } catch (reportError) {
      console.warn("Failed to report error to server:", reportError);
    }
  }

  public getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  public getErrorsByType(type: ErrorType): ErrorReport[] {
    return this.errors.filter((e) => e.type === type);
  }

  public getErrorsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return this.errors.filter((e) => e.severity === severity);
  }

  public getErrorsBySource(source: ErrorSource): ErrorReport[] {
    return this.errors.filter((e) => e.source === source);
  }

  public getRecentErrors(limit: number = 50): ErrorReport[] {
    return this.errors.slice(-limit).reverse();
  }

  public getCriticalErrors(): ErrorReport[] {
    return this.errors.filter((e) => e.severity === ErrorSeverity.CRITICAL);
  }

  public getStats(): ErrorStats {
    const stats: ErrorStats = {
      total: this.errors.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      bySource: {} as Record<ErrorSource, number>,
      recent: this.getRecentErrors(10),
      critical: this.getCriticalErrors(),
      trends: {
        hourly: {},
        daily: {},
      },
    };

    // Initialize counters
    Object.values(ErrorType).forEach((type) => {
      stats.byType[type] = 0;
    });
    Object.values(ErrorSeverity).forEach((severity) => {
      stats.bySeverity[severity] = 0;
    });
    Object.values(ErrorSource).forEach((source) => {
      stats.bySource[source] = 0;
    });

    // Count errors
    this.errors.forEach((error) => {
      stats.byType[error.type]++;
      stats.bySeverity[error.severity]++;
      stats.bySource[error.source]++;

      // Calculate trends
      const date = new Date(error.timestamp);
      const hourKey = `${date.getHours()}:00`;
      const dayKey = date.toISOString().split("T")[0];

      stats.trends.hourly[hourKey] = (stats.trends.hourly[hourKey] || 0) + 1;
      stats.trends.daily[dayKey] = (stats.trends.daily[dayKey] || 0) + 1;
    });

    return stats;
  }

  public clearErrors(): void {
    this.errors = [];
    this.saveErrors();
  }

  public resolveError(errorId: string): void {
    const error = this.errors.find((e) => e.id === errorId);
    if (error) {
      error.resolved = true;
      this.saveErrors();
    }
  }

  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public setTracking(enabled: boolean): void {
    this.isTracking = enabled;
  }

  public exportErrors(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        sessionId: this.sessionId,
        userId: this.userId,
        errors: this.errors,
        stats: this.getStats(),
      },
      null,
      2
    );
  }

  // Component-specific error tracking
  public trackComponentError(componentName: string, error: Error, action?: string): void {
    this.trackError({
      type: ErrorType.COMPONENT,
      message: `Component Error: ${componentName} - ${error.message}`,
      stack: error.stack,
      component: componentName,
      action: action,
      severity: this.determineSeverity(error),
    });
  }

  public trackApiError(url: string, status: number, message: string, method?: string): void {
    this.trackError({
      type: ErrorType.API,
      message: `API Error: ${method || "GET"} ${url} - ${status} ${message}`,
      url: url,
      context: { status, method },
      severity: status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
    });
  }

  public trackNetworkError(url: string, error: Error, method?: string): void {
    this.trackError({
      type: ErrorType.NETWORK,
      message: `Network Error: ${method || "GET"} ${url} - ${error.message}`,
      url: url,
      stack: error.stack,
      context: { method, error: error.message },
      severity: ErrorSeverity.HIGH,
    });
  }

  public trackValidationError(field: string, value: any, rule: string): void {
    this.trackError({
      type: ErrorType.VALIDATION,
      message: `Validation Error: ${field} failed ${rule}`,
      context: { field, value, rule },
      severity: ErrorSeverity.LOW,
    });
  }

  public trackPerformanceError(metric: string, value: number, threshold: number): void {
    this.trackError({
      type: ErrorType.PERFORMANCE,
      message: `Performance Warning: ${metric} (${value}) exceeds threshold (${threshold})`,
      context: { metric, value, threshold },
      severity: ErrorSeverity.MEDIUM,
    });
  }
}

// Export singleton instance
export const errorTracker = ErrorTracker.getInstance();

// Vue composable for easy integration
export function useErrorTracker() {
  return {
    trackError: errorTracker.trackError.bind(errorTracker),
    trackComponentError: errorTracker.trackComponentError.bind(errorTracker),
    trackApiError: errorTracker.trackApiError.bind(errorTracker),
    trackNetworkError: errorTracker.trackNetworkError.bind(errorTracker),
    trackValidationError: errorTracker.trackValidationError.bind(errorTracker),
    trackPerformanceError: errorTracker.trackPerformanceError.bind(errorTracker),
    getErrors: errorTracker.getErrors.bind(errorTracker),
    getStats: errorTracker.getStats.bind(errorTracker),
    clearErrors: errorTracker.clearErrors.bind(errorTracker),
    resolveError: errorTracker.resolveError.bind(errorTracker),
    setUserId: errorTracker.setUserId.bind(errorTracker),
    exportErrors: errorTracker.exportErrors.bind(errorTracker),
  };
}
