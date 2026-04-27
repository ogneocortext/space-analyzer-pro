import React, { useState, FC } from "react";
import {
  AlertTriangle,
  X,
  RefreshCw,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AppError, ErrorType, errorHandler } from "../services/ErrorHandler";

interface ErrorDisplayProps {
  errors: AppError[];
  onDismiss?: (errorId: string) => void;
  onRetry?: (error: AppError) => void;
  className?: string;
}

const ErrorDisplay: FC<ErrorDisplayProps> = ({ errors, onDismiss, onRetry, className = "" }) => {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  if (errors.length === 0) {
    return null;
  }

  const toggleExpanded = (errorId: string) => {
    setExpandedErrors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  const getErrorIcon = (type: ErrorType) => {
    switch (type) {
      case ErrorType.NETWORK:
        return <WifiOff className="w-5 h-5" />;
      case ErrorType.BACKEND:
        return <AlertCircle className="w-5 h-5" />;
      case ErrorType.ANALYSIS:
        return <Clock className="w-5 h-5" />;
      case ErrorType.PERMISSION:
        return <Shield className="w-5 h-5" />;
      case ErrorType.TIMEOUT:
        return <Clock className="w-5 h-5" />;
      case ErrorType.VALIDATION:
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getErrorColor = (type: ErrorType) => {
    switch (type) {
      case ErrorType.NETWORK:
        return "border-red-500/50 bg-red-500/10 text-red-400";
      case ErrorType.BACKEND:
        return "border-orange-500/50 bg-orange-500/10 text-orange-400";
      case ErrorType.ANALYSIS:
        return "border-yellow-500/50 bg-yellow-500/10 text-yellow-400";
      case ErrorType.PERMISSION:
        return "border-purple-500/50 bg-purple-500/10 text-purple-400";
      case ErrorType.TIMEOUT:
        return "border-blue-500/50 bg-blue-500/10 text-blue-400";
      case ErrorType.VALIDATION:
        return "border-pink-500/50 bg-pink-500/10 text-pink-400";
      default:
        return "border-gray-500/50 bg-gray-500/10 text-gray-400";
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return timestamp.toLocaleDateString();
  };

  const handleRecoveryAction = async (error: AppError, action: () => void | Promise<void>) => {
    try {
      await action();
    } catch (recoveryError) {
      console.error("Recovery action failed:", recoveryError);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {errors.map((error) => {
        const isExpanded = expandedErrors.has(error.id);
        const colorClass = getErrorColor(error.type);

        return (
          <div
            key={error.id}
            className={`border rounded-lg p-4 transition-all duration-200 ${colorClass}`}
          >
            {/* Error Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="flex-shrink-0 mt-0.5">{getErrorIcon(error.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-sm">
                      {error.type === ErrorType.NETWORK
                        ? "Connection Error"
                        : error.type === ErrorType.BACKEND
                          ? "Backend Error"
                          : error.type === ErrorType.ANALYSIS
                            ? "Analysis Error"
                            : error.type === ErrorType.PERMISSION
                              ? "Permission Error"
                              : error.type === ErrorType.TIMEOUT
                                ? "Timeout Error"
                                : error.type === ErrorType.VALIDATION
                                  ? "Validation Error"
                                  : "Error"}
                    </h4>
                    <span className="text-xs opacity-75">{formatTimestamp(error.timestamp)}</span>
                  </div>
                  <p className="text-sm mt-1 leading-relaxed">{error.message}</p>
                </div>
              </div>

              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={() => toggleExpanded(error.id)}
                  className="p-1 hover:bg-black/20 rounded transition-colors"
                  aria-label={isExpanded ? "Collapse error details" : "Expand error details"}
                >
                  <Info className="w-4 h-4" />
                </button>
                {onDismiss && (
                  <button
                    onClick={() => onDismiss(error.id)}
                    className="p-1 hover:bg-black/20 rounded transition-colors"
                    aria-label="Dismiss error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Error Details */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-current/20">
                {error.details && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium mb-2">Details:</h5>
                    <p className="text-xs opacity-90 leading-relaxed">{error.details}</p>
                  </div>
                )}

                {/* Recovery Actions */}
                {error.recoveryActions && error.recoveryActions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-3">Suggested Actions:</h5>
                    <div className="flex flex-wrap gap-2">
                      {error.recoveryActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => handleRecoveryAction(error, action.action)}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            action.primary
                              ? "bg-current/20 hover:bg-current/30 text-current"
                              : "bg-white/10 hover:bg-white/20 text-current"
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Context (for debugging) */}
                {error.context && process.env.NODE_ENV === "development" && (
                  <details className="mt-4">
                    <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100">
                      Technical Details
                    </summary>
                    <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-x-auto">
                      {JSON.stringify(error.context, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ErrorDisplay;
