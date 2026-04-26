import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryFixed extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          margin: '20px',
          color: '#ffffff',
          minHeight: '200px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>
            <AlertTriangle size={48} />
          </div>
          <h3 style={{ color: '#ef4444', marginBottom: '10px' }}>Component Error</h3>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
            The application encountered an unexpected error.
          </p>
          {this.props.showErrorDetails && (
            <details style={{ textAlign: 'left', marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer', color: '#10b981' }}>Error Details</summary>
              <pre style={{
                background: '#1e293b',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
                color: '#cbd5e1'
              }}>
                {this.state.error?.stack}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryFixed;
