/**
 * Error Handler Module
 * Centralized error handling and logging
 */

import type { BridgeError, ErrorContext } from '../types';

export interface ErrorConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogEntries: number;
}

export class ErrorHandler {
  private config: ErrorConfig;
  private errorLog: Array<{
    timestamp: string;
    error: BridgeError;
    context?: ErrorContext;
  }> = [];

  constructor(config: Partial<ErrorConfig> = {}) {
    this.config = {
      enableLogging: true,
      logLevel: 'error',
      maxLogEntries: 100,
      ...config,
    };
  }

  /**
   * Create a standardized error with context
   */
  createError(
    message: string,
    code?: string,
    context?: ErrorContext,
    retryable: boolean = false
  ): BridgeError {
    const error = new Error(message) as BridgeError;
    error.code = code;
    error.context = {
      timestamp: new Date().toISOString(),
      ...context,
    };
    error.retryable = retryable;
    
    return error;
  }

  /**
   * Handle and log errors
   */
  handleError(error: BridgeError | Error | string, context?: ErrorContext): BridgeError {
    let bridgeError: BridgeError;

    if (typeof error === 'string') {
      bridgeError = this.createError(error, 'UNKNOWN_ERROR', context);
    } else if (error instanceof Error) {
      bridgeError = error as BridgeError;
      if (!bridgeError.context) {
        bridgeError.context = {
          timestamp: new Date().toISOString(),
          ...context,
        };
      }
    } else {
      bridgeError = error;
    }

    // Log the error
    this.logError(bridgeError);

    // Add to error log
    this.addToErrorLog(bridgeError);

    return bridgeError;
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: BridgeError): void {
    if (!this.config.enableLogging) return;

    const logEntry = {
      timestamp: error.context?.timestamp || new Date().toISOString(),
      code: error.code,
      message: error.message,
      context: error.context,
      retryable: error.retryable,
    };

    const logMessage = `[ErrorHandler] ${error.code || 'ERROR'}: ${error.message}`;
    
    switch (this.config.logLevel) {
      case 'debug':
        console.debug(logMessage, logEntry);
        break;
      case 'info':
        console.info(logMessage, logEntry);
        break;
      case 'warn':
        console.warn(logMessage, logEntry);
        break;
      case 'error':
      default:
        console.error(logMessage, logEntry);
        break;
    }
  }

  /**
   * Add error to internal log
   */
  private addToErrorLog(error: BridgeError): void {
    this.errorLog.push({
      timestamp: error.context?.timestamp || new Date().toISOString(),
      error,
      context: error.context,
    });

    // Maintain log size limit
    if (this.errorLog.length > this.config.maxLogEntries) {
      this.errorLog.shift();
    }
  }

  /**
   * Get error log
   */
  getErrorLog(limit?: number): Array<{
    timestamp: string;
    error: BridgeError;
    context?: ErrorContext;
  }> {
    if (limit) {
      return this.errorLog.slice(-limit);
    }
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCode: Record<string, number>;
    retryable: number;
    recent: number;
  } {
    const byCode: Record<string, number> = {};
    let retryable = 0;
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let recent = 0;

    for (const entry of this.errorLog) {
      // Count by code
      const code = entry.error.code || 'UNKNOWN';
      byCode[code] = (byCode[code] || 0) + 1;

      // Count retryable
      if (entry.error.retryable) {
        retryable++;
      }

      // Count recent (last hour)
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime > oneHourAgo) {
        recent++;
      }
    }

    return {
      total: this.errorLog.length,
      byCode,
      retryable,
      recent,
    };
  }

  /**
   * Determine if error is retryable
   */
  isRetryable(error: BridgeError | Error | string): boolean {
    if (typeof error === 'string') {
      return this.isRetryableMessage(error);
    }

    if (error instanceof Error) {
      const bridgeError = error as BridgeError;
      return bridgeError.retryable ?? this.isRetryableMessage(error.message);
    }

    return false;
  }

  /**
   * Check if error message indicates retryable condition
   */
  private isRetryableMessage(message: string): boolean {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporary/i,
      /unavailable/i,
      /502/i,
      /503/i,
      /504/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
    ];

    return retryablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Create user-friendly error message
   */
  createUserMessage(error: BridgeError | Error | string): string {
    let message: string;
    let code: string;

    if (typeof error === 'string') {
      message = error;
      code = 'UNKNOWN';
    } else if (error instanceof Error) {
      message = error.message;
      code = (error as BridgeError).code || 'UNKNOWN';
    } else {
      message = 'Unknown error occurred';
      code = 'UNKNOWN';
    }

    // Map error codes to user-friendly messages
    const userMessages: Record<string, string> = {
      'NETWORK_ERROR': 'Unable to connect to the analysis server. Please check your connection and try again.',
      'TIMEOUT_ERROR': 'The analysis request timed out. Please try again.',
      'PATH_INVALID': 'The selected path is invalid. Please choose a valid directory.',
      'ANALYSIS_NOT_FOUND': 'The analysis was not found. Please start a new scan.',
      'SERVER_ERROR': 'The server encountered an error. Please try again later.',
      'PERMISSION_DENIED': 'Permission denied. Please check file permissions and try again.',
      'UNKNOWN': 'An unexpected error occurred. Please try again.',
    };

    return userMessages[code] || message;
  }

  /**
   * Wrap async function with error handling
   */
  async withErrorHandling<T>(
    fn: () => Promise<T>,
    context?: ErrorContext
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const bridgeError = this.handleError(error as Error, context);
      throw bridgeError;
    }
  }

  /**
   * Create context object for error tracking
   */
  createContext(overrides?: Partial<ErrorContext>): ErrorContext {
    return {
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }
}
