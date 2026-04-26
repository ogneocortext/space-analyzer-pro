import React, { Component, ErrorInfo, ReactNode } from 'react';
import { designTokens } from '../../styles/tokens';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string;
}

// Base Error Boundary Component
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Report error to analytics/monitoring service
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real app, you might send this to Sentry, LogRocket, etc.
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      boundary: this.props.name || 'Unknown'
    };

    console.error('Error Report:', errorReport);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <GenericErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          errorId={this.state.errorId}
        />
      );
    }

    return this.props.children;
  }
}

// Generic Error Fallback Component
interface GenericErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  errorId: string;
}

const GenericErrorFallback: React.FC<GenericErrorFallbackProps> = ({
  error,
  errorInfo,
  onRetry,
  errorId
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      style={{
        padding: designTokens.spacing.xl,
        margin: designTokens.spacing.lg,
        border: `1px solid ${designTokens.colors.semantic.error}`,
        borderRadius: designTokens.borderRadius.lg,
        backgroundColor: `${designTokens.colors.semantic.error}10`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          fontSize: '3rem',
          marginBottom: designTokens.spacing.md,
          opacity: 0.7
        }}
        aria-hidden="true"
      >
        ⚠️
      </div>

      <h2
        style={{
          color: designTokens.colors.semantic.error,
          marginBottom: designTokens.spacing.md,
          fontSize: designTokens.typography.fontSize['2xl'],
          fontWeight: designTokens.typography.fontWeight.bold
        }}
      >
        Something went wrong
      </h2>

      <p
        style={{
          color: designTokens.colors.neutral[700],
          marginBottom: designTokens.spacing.lg,
          maxWidth: '500px',
          lineHeight: designTokens.typography.lineHeight.relaxed
        }}
      >
        We encountered an unexpected error. Our team has been notified and is working to fix this issue.
      </p>

      <div style={{ display: 'flex', gap: designTokens.spacing.sm, flexWrap: 'wrap' }}>
        <button
          onClick={onRetry}
          style={{
            padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
            backgroundColor: designTokens.colors.primary[500],
            color: 'white',
            border: 'none',
            borderRadius: designTokens.borderRadius.md,
            cursor: 'pointer',
            fontWeight: designTokens.typography.fontWeight.medium,
            transition: designTokens.transitions.fast
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = designTokens.colors.primary[600];
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = designTokens.colors.primary[500];
          }}
        >
          Try Again
        </button>

        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
            backgroundColor: 'transparent',
            color: designTokens.colors.primary[500],
            border: `1px solid ${designTokens.colors.primary[500]}`,
            borderRadius: designTokens.borderRadius.md,
            cursor: 'pointer',
            fontWeight: designTokens.typography.fontWeight.medium,
            transition: designTokens.transitions.fast
          }}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {showDetails && (
        <details
          style={{
            marginTop: designTokens.spacing.lg,
            width: '100%',
            maxWidth: '600px',
            textAlign: 'left'
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: designTokens.typography.fontWeight.medium,
              marginBottom: designTokens.spacing.sm
            }}
          >
            Technical Details
          </summary>

          <div
            style={{
              backgroundColor: designTokens.colors.neutral[50],
              padding: designTokens.spacing.md,
              borderRadius: designTokens.borderRadius.md,
              fontSize: designTokens.typography.fontSize.sm,
              fontFamily: 'monospace',
              border: `1px solid ${designTokens.colors.neutral[200]}`
            }}
          >
            <div style={{ marginBottom: designTokens.spacing.sm }}>
              <strong>Error ID:</strong> {errorId}
            </div>
            <div style={{ marginBottom: designTokens.spacing.sm }}>
              <strong>Message:</strong> {error.message}
            </div>
            <div style={{ marginBottom: designTokens.spacing.sm }}>
              <strong>Stack:</strong>
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginTop: designTokens.spacing.xs,
                fontSize: '0.8em'
              }}>
                {error.stack}
              </pre>
            </div>
            {errorInfo && (
              <div>
                <strong>Component Stack:</strong>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  marginTop: designTokens.spacing.xs,
                  fontSize: '0.8em'
                }}>
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

// Specialized Error Boundaries

// Network Error Boundary
export const NetworkErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    name="NetworkErrorBoundary"
    fallback={(error, retry) => (
      <div
        style={{
          padding: designTokens.spacing.xl,
          margin: designTokens.spacing.lg,
          border: `1px solid ${designTokens.colors.semantic.warning}`,
          borderRadius: designTokens.borderRadius.lg,
          backgroundColor: `${designTokens.colors.semantic.warning}10`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
        role="alert"
      >
        <div
          style={{
            fontSize: '3rem',
            marginBottom: designTokens.spacing.md,
            opacity: 0.7
          }}
          aria-hidden="true"
        >
          🌐
        </div>
        <h3
          style={{
            color: designTokens.colors.semantic.warning,
            marginBottom: designTokens.spacing.md
          }}
        >
          Connection Error
        </h3>
        <p style={{ color: designTokens.colors.neutral[700], marginBottom: designTokens.spacing.lg }}>
          Unable to connect to services. Please check your internet connection and try again.
        </p>
        <button
          onClick={retry}
          style={{
            padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
            backgroundColor: designTokens.colors.primary[500],
            color: 'white',
            border: 'none',
            borderRadius: designTokens.borderRadius.md,
            cursor: 'pointer'
          }}
        >
          Retry Connection
        </button>
      </div>
    )}
    onError={(error) => {
      // Log network-specific errors
      console.error('Network error:', error);
    }}
  >
    {children}
  </ErrorBoundary>
);

// Data Error Boundary
export const DataErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    name="DataErrorBoundary"
    fallback={(error, retry) => (
      <div
        style={{
          padding: designTokens.spacing.xl,
          margin: designTokens.spacing.lg,
          border: `1px solid ${designTokens.colors.semantic.info}`,
          borderRadius: designTokens.borderRadius.lg,
          backgroundColor: `${designTokens.colors.semantic.info}10`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
        role="alert"
      >
        <div
          style={{
            fontSize: '3rem',
            marginBottom: designTokens.spacing.md,
            opacity: 0.7
          }}
          aria-hidden="true"
        >
          📊
        </div>
        <h3
          style={{
            color: designTokens.colors.semantic.info,
            marginBottom: designTokens.spacing.md
          }}
        >
          Data Loading Error
        </h3>
        <p style={{ color: designTokens.colors.neutral[700], marginBottom: designTokens.spacing.lg }}>
          Unable to load data. The data might be corrupted or temporarily unavailable.
        </p>
        <button
          onClick={retry}
          style={{
            padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
            backgroundColor: designTokens.colors.primary[500],
            color: 'white',
            border: 'none',
            borderRadius: designTokens.borderRadius.md,
            cursor: 'pointer'
          }}
        >
          Reload Data
        </button>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

// Component Error Boundary
export const ComponentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    name="ComponentErrorBoundary"
    fallback={(error, retry) => (
      <div
        style={{
          padding: designTokens.spacing.md,
          border: `1px solid ${designTokens.colors.neutral[300]}`,
          borderRadius: designTokens.borderRadius.md,
          backgroundColor: designTokens.colors.neutral[50],
          textAlign: 'center'
        }}
        role="alert"
      >
        <p style={{ color: designTokens.colors.neutral[600], marginBottom: designTokens.spacing.sm }}>
          This component encountered an error and couldn't render properly.
        </p>
        <button
          onClick={retry}
          style={{
            padding: `${designTokens.spacing.xs} ${designTokens.spacing.sm}`,
            backgroundColor: designTokens.colors.primary[500],
            color: 'white',
            border: 'none',
            borderRadius: designTokens.borderRadius.sm,
            cursor: 'pointer',
            fontSize: designTokens.typography.fontSize.sm
          }}
        >
          Retry
        </button>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

// Async Error Boundary for handling async operations
export const AsyncErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [asyncError, setAsyncError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      setAsyncError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Unhandled error:', event.error);
      setAsyncError(event.error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  if (asyncError) {
    return (
      <div
        style={{
          padding: designTokens.spacing.xl,
          margin: designTokens.spacing.lg,
          border: `1px solid ${designTokens.colors.semantic.error}`,
          borderRadius: designTokens.borderRadius.lg,
          backgroundColor: `${designTokens.colors.semantic.error}10`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
        role="alert"
      >
        <h3 style={{ color: designTokens.colors.semantic.error, marginBottom: designTokens.spacing.md }}>
          Async Operation Failed
        </h3>
        <p style={{ color: designTokens.colors.neutral[700], marginBottom: designTokens.spacing.lg }}>
          {asyncError.message}
        </p>
        <button
          onClick={() => setAsyncError(null)}
          style={{
            padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
            backgroundColor: designTokens.colors.primary[500],
            color: 'white',
            border: 'none',
            borderRadius: designTokens.borderRadius.md,
            cursor: 'pointer'
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default ErrorBoundary;