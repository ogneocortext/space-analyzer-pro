/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

export interface AppError {
  id: string;
  type: ErrorType;
  message: string;
  details?: string;
  timestamp: Date;
  context?: any;
  recoverable: boolean;
  recoveryActions?: RecoveryAction[];
}

export enum ErrorType {
  NETWORK = "network",
  ANALYSIS = "analysis",
  VALIDATION = "validation",
  BACKEND = "backend",
  TIMEOUT = "timeout",
  PERMISSION = "permission",
  UNKNOWN = "unknown",
}

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: AppError[] = [];
  private maxErrors = 10;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  createError(
    type: ErrorType,
    message: string,
    details?: string,
    context?: any,
    recoverable = true
  ): AppError {
    const error: AppError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      details,
      timestamp: new Date(),
      context,
      recoverable,
      recoveryActions: this.generateRecoveryActions(type, context),
    };

    this.errors.unshift(error);

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log to console for debugging
    console.error(`[${type.toUpperCase()}] ${message}`, details ? { details, context } : context);

    return error;
  }

  private generateRecoveryActions(type: ErrorType, context?: any): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (type) {
      case ErrorType.NETWORK:
        actions.push({
          label: "Retry Connection",
          action: () => {
            window.location.reload();
          },
          primary: true,
        });
        actions.push({
          label: "Check Network",
          action: () => {
            window.open("https://www.google.com", "_blank");
          },
        });
        break;

      case ErrorType.BACKEND:
        actions.push({
          label: "Restart Backend",
          action: () => {
            alert("Please restart the Space Analyzer backend server and refresh this page.");
          },
          primary: true,
        });
        actions.push({
          label: "Refresh Page",
          action: () => {
            window.location.reload();
          },
        });
        break;

      case ErrorType.ANALYSIS:
        if (context?.path) {
          actions.push({
            label: "Try Different Path",
            action: () => {
              const input = document.querySelector(
                'input[placeholder*="directory path"]'
              ) as HTMLInputElement;
              if (input) {
                input.focus();
                input.select();
              }
            },
            primary: true,
          });
        }
        actions.push({
          label: "Check Permissions",
          action: () => alert("Make sure you have read access to the selected directory."),
        });
        break;

      case ErrorType.TIMEOUT:
        actions.push({
          label: "Try Smaller Directory",
          action: () => {
            const input = document.querySelector(
              'input[placeholder*="directory path"]'
            ) as HTMLInputElement;
            if (input) {
              input.value = ".";
              input.focus();
            }
          },
          primary: true,
        });
        actions.push({
          label: "Increase Timeout",
          action: () =>
            alert("For very large directories, the analysis may take longer. Try again."),
        });
        break;

      case ErrorType.PERMISSION:
        actions.push({
          label: "Run as Administrator",
          action: () => alert("Try running the application with administrator privileges."),
          primary: true,
        });
        actions.push({
          label: "Check File Permissions",
          action: () =>
            alert("Ensure you have read access to the target directory and its contents."),
        });
        break;

      default:
        actions.push({
          label: "Refresh Page",
          action: () => {
            window.location.reload();
          },
          primary: true,
        });
        break;
    }

    return actions;
  }

  handleUIError(error: Error, context?: any): AppError {
    return this.createError(ErrorType.UNKNOWN, error.message, error.stack, context, true);
  }

  handleFileSystemError(error: Error, context?: any): AppError {
    return this.createError(ErrorType.PERMISSION, error.message, error.stack, context, true);
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  clearError(errorId: string): void {
    this.errors = this.errors.filter((error) => error.id !== errorId);
  }

  clearAllErrors(): void {
    this.errors = [];
  }

  // Helper method to create user-friendly error messages
  static formatErrorMessage(error: any): { type: ErrorType; message: string; details?: string } {
    if (typeof error === "string") {
      return {
        type: ErrorType.UNKNOWN,
        message: error,
      };
    }

    const errorMessage = error?.message || error?.toString() || "An unknown error occurred";

    // Network errors
    if (
      errorMessage.includes("fetch") ||
      errorMessage.includes("network") ||
      errorMessage.includes("connection")
    ) {
      return {
        type: ErrorType.NETWORK,
        message: "Connection Error",
        details:
          "Unable to connect to the Space Analyzer backend. Please check if the server is running.",
      };
    }

    // Timeout errors
    if (errorMessage.includes("timeout") || errorMessage.includes("aborted")) {
      return {
        type: ErrorType.TIMEOUT,
        message: "Analysis Timeout",
        details: "The analysis took too long to complete. Try analyzing a smaller directory.",
      };
    }

    // Permission errors
    if (
      errorMessage.includes("permission") ||
      errorMessage.includes("access") ||
      errorMessage.includes("denied")
    ) {
      return {
        type: ErrorType.PERMISSION,
        message: "Permission Error",
        details: "You don't have permission to access the selected directory.",
      };
    }

    // Analysis errors
    if (errorMessage.includes("analysis") || errorMessage.includes("scan")) {
      return {
        type: ErrorType.ANALYSIS,
        message: "Analysis Error",
        details: "Failed to analyze the selected directory. Please check the path and try again.",
      };
    }

    // Validation errors
    if (
      errorMessage.includes("path") ||
      errorMessage.includes("directory") ||
      errorMessage.includes("not found")
    ) {
      return {
        type: ErrorType.VALIDATION,
        message: "Invalid Path",
        details: "The specified directory path is invalid or does not exist.",
      };
    }

    // Backend errors
    if (errorMessage.includes("backend") || errorMessage.includes("server")) {
      return {
        type: ErrorType.BACKEND,
        message: "Backend Error",
        details: "The Space Analyzer backend service encountered an error.",
      };
    }

    return {
      type: ErrorType.UNKNOWN,
      message: errorMessage,
    };
  }
}

export const errorHandler = ErrorHandler.getInstance();
