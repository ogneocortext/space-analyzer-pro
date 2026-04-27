import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Bug, ExternalLink } from "lucide-react";
import { useErrorStore } from "../store";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  isolate?: boolean; // Whether to isolate this boundary from parent boundaries
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Add error to global error store
    const addError = useErrorStore.getState().addError;
    addError({
      message: `Component Error: ${error.message}`,
      type: "error",
      persistent: true,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error details for debugging
    console.error("ErrorBoundary caught an error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    });

    // Send error to error reporting service (if configured)
    this.reportError(error, errorInfo);
  }

  reportError = (error: Error, errorInfo: ErrorInfo) => {
    // Implement error reporting service integration here
    // Examples: Sentry, LogRocket, Bugsnag, etc.

    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
      // Only report errors in production
      try {
        // Example: Send to error reporting service
        // This is a placeholder - implement your preferred error reporting
        console.log("Would report error to service:", {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
      } catch (reportingError) {
        console.error("Failed to report error:", reportingError);
      }
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onReset={this.handleReset}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
          isolate={this.props.isolate}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  onReset: () => void;
  onReload: () => void;
  onGoHome: () => void;
  isolate?: boolean;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onReset,
  onReload,
  onGoHome,
  isolate = false,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl overflow-hidden">
        {/* Error Header */}
        <div className="bg-red-500/20 border-b border-red-500/30 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-500/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">Application Error</h1>
              <p className="text-red-200 mt-1">
                {isolate
                  ? "This component has been isolated due to an error."
                  : "Something went wrong in the application."}
              </p>
            </div>
          </div>
        </div>

        {/* Error Details */}
        <div className="p-6 space-y-6">
          {/* Error Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="text-sm text-slate-300 mb-1">Error ID</div>
              <div className="font-mono text-sm text-white">{errorId}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="text-sm text-slate-300 mb-1">Time</div>
              <div className="font-mono text-sm text-white">{new Date().toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="text-sm text-slate-300 mb-1">Component</div>
              <div className="font-mono text-sm text-white truncate">
                {errorInfo?.componentStack?.split("\n")[1]?.trim() || "Unknown"}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="w-4 h-4 text-red-400" />
                <span className="text-sm text-slate-300">Error Message</span>
              </div>
              <div className="text-white font-mono text-sm bg-black/30 p-3 rounded border border-white/10">
                {error.message}
              </div>
            </div>
          )}

          {/* Stack Trace */}
          {errorInfo && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-300">Component Stack</span>
              </div>
              <div className="text-white font-mono text-xs bg-black/30 p-3 rounded border border-white/10 max-h-40 overflow-auto">
                {errorInfo.componentStack}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            <button
              onClick={onReload}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>

            <button
              onClick={onGoHome}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Go Home
            </button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-slate-400 bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="mb-2">
              <strong>Troubleshooting:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Try refreshing the page to reset the application state</li>
              <li>Clear your browser cache and cookies if the error persists</li>
              <li>Check your internet connection if the error involves network requests</li>
              <li>Contact support with the error ID above if the problem continues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for programmatic error handling
export const useErrorHandler = () => {
  const addError = useErrorStore.getState().addError;

  const handleError = (error: Error, context?: string) => {
    const message = context ? `${context}: ${error.message}` : error.message;
    addError({
      message,
      type: "error",
      persistent: false,
    });

    console.error("Handled error:", error);
  };

  const handleWarning = (message: string, context?: string) => {
    const fullMessage = context ? `${context}: ${message}` : message;
    addError({
      message: fullMessage,
      type: "warning",
      persistent: false,
    });
  };

  const handleInfo = (message: string, context?: string) => {
    const fullMessage = context ? `${context}: ${message}` : message;
    addError({
      message: fullMessage,
      type: "info",
      persistent: false,
    });
  };

  return {
    error: handleError,
    warning: handleWarning,
    info: handleInfo,
  };
};

// Higher-order component for wrapping components with error boundaries
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ErrorBoundary;
