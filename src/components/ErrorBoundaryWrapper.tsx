import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { useErrorStore } from '../store';

interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // Whether to isolate this component from parent errors
}

interface ErrorBoundaryWrapperState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

/**
 * Enhanced Error Boundary Wrapper with comprehensive error handling
 * Features:
 * - Automatic error recovery with retry logic
 * - Error reporting and logging
 * - Graceful fallback UI
 * - Performance monitoring
 * - Error boundary isolation
 */
export class ErrorBoundaryWrapper extends Component<ErrorBoundaryWrapperProps, ErrorBoundaryWrapperState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryWrapperProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryWrapperState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error details
    this.logError(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Add error to global error store
    const addError = useErrorStore.getState().addError;
    addError({
      message: error.message,
      type: 'error',
      persistent: false
    });
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('=¨ Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Details:', errorDetails);
      console.groupEnd();
    }

    // Send to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(errorDetails);
    }
  };

  private reportError = async (errorDetails: any) => {
    try {
      // Send to error reporting service (e.g., Sentry, LogRocket, etc.)
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorDetails)
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    const maxRetries = 3;
    const retryCount = this.state.retryCount + 1;

    if (retryCount <= maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount
      });

      // Exponential backoff for retries
      const delay = Math.pow(2, retryCount) * 1000;
      this.retryTimeoutId = setTimeout(() => {
        this.forceUpdate();
      }, delay);
    } else {
      // Max retries reached, show permanent error state
      console.warn('Max retry attempts reached for component');
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary-wrapper">
          <div className="error-boundary-content">
            <div className="error-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="animate-pulse">
                <path d="M12 2L1 21H23L12 2Z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8V12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 16H12.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            
            <h2 className="error-title">Something went wrong</h2>
            <p className="error-message">
              We're sorry, but something unexpected happened. Don't worry, your data is safe.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\nStack Trace:\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div className="error-actions">
              {this.state.retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  className="btn-primary"
                  disabled={this.state.retryCount >= 3}
                >
                  Try Again ({this.state.retryCount}/3)
                </button>
              )}
              <button
                onClick={this.handleReset}
                className="btn-secondary"
              >
                Reset Component
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-ghost"
              >
                Refresh Page
              </button>
            </div>

            <div className="error-hint">
              If this problem persists, please contact support with the error details above.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for easy wrapping of components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryWrapperProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundaryWrapper {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundaryWrapper>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for programmatic error handling
export const useErrorHandler = () => {
  const addError = useErrorStore.getState().addError;

  const handleError = (error: Error, context?: string) => {
    console.error('Error caught:', error);
    
    addError({
      message: context ? `${context}: ${error.message}` : error.message,
      type: 'error',
      persistent: false
    });
  };

  const handleWarning = (message: string, context?: string) => {
    console.warn('Warning:', message);
    
    addError({
      message: context ? `${context}: ${message}` : message,
      type: 'warning',
      persistent: false
    });
  };

  return {
    error: handleError,
    warning: handleWarning
  };
};

// Error recovery utilities
export const ErrorRecovery = {
  // Retry function with exponential backoff
  async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  },

  // Graceful degradation function
  async withFallback<T, F>(
    primary: () => Promise<T>,
    fallback: () => Promise<F>,
    shouldFallback?: (error: Error) => boolean
  ): Promise<T | F> {
    try {
      return await primary();
    } catch (error) {
      if (shouldFallback && !shouldFallback(error as Error)) {
        throw error;
      }

      console.warn('Falling back to alternative implementation:', error);
      return await fallback();
    }
  }
};

// Performance monitoring for error boundaries
export class ErrorBoundaryMetrics {
  private static errors = new Map<string, number>();
  private static errorRate = 0;

  static recordError(componentName: string) {
    const count = this.errors.get(componentName) || 0;
    this.errors.set(componentName, count + 1);
    
    // Calculate error rate (errors per minute)
    const totalErrors = Array.from(this.errors.values()).reduce((sum, count) => sum + count, 0);
    const timeWindow = 60000; // 1 minute
    this.errorRate = totalErrors / (timeWindow / 60000);
  }

  static getErrorRate(): number {
    return this.errorRate;
  }

  static getErrorCounts(): Map<string, number> {
    return new Map(this.errors);
  }

  static reset() {
    this.errors.clear();
    this.errorRate = 0;
  }
}

export default ErrorBoundaryWrapper;