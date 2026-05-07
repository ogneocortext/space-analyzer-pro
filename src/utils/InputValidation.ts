// Input Validation Utilities for Security
// Provides validation functions for common input types

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: string | Record<string, unknown>;
}

export class InputValidator {
  // File path validation
  static validateFilePath(path: string): ValidationResult {
    const errors: string[] = [];

    if (!path || typeof path !== "string") {
      errors.push("File path is required and must be a string");
    }

    if (path.length > 260) {
      errors.push("File path exceeds maximum length (260 characters)");
    }

    // Check for path traversal attempts
    if (path.includes("../") || path.includes("..\\")) {
      errors.push("Path traversal sequences are not allowed");
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(path)) {
      errors.push("File path contains invalid characters");
    }

    // Basic sanitization
    const sanitized = path.replace(/[<>:"|?*]/g, "").trim();

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  // Directory path validation
  static validateDirectoryPath(path: string): ValidationResult {
    const result = this.validateFilePath(path);

    // Additional directory-specific checks
    if (
      typeof result.sanitized === "string" &&
      !result.sanitized.endsWith("/") &&
      !result.sanitized.endsWith("\\")
    ) {
      result.errors.push("Directory path should end with path separator");
      result.isValid = false;
    }

    return result;
  }

  // Command input validation
  static validateCommand(command: string, args: string[] = []): ValidationResult {
    const errors: string[] = [];

    if (!command || typeof command !== "string") {
      errors.push("Command is required and must be a string");
    }

    // Check for dangerous commands
    const dangerousCommands = [
      "rm -rf",
      "del /f",
      "format",
      "fdisk",
      "shutdown",
      "reboot",
      "halt",
      "poweroff",
    ];

    if (dangerousCommands.some((cmd) => command.toLowerCase().includes(cmd))) {
      errors.push("Dangerous command detected");
    }

    // Validate arguments
    args.forEach((arg, index) => {
      if (typeof arg !== "string") {
        errors.push(`Argument ${index} must be a string`);
      }

      if (arg.length > 1000) {
        errors.push(`Argument ${index} exceeds maximum length`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // File content validation
  static validateFileContent(
    content: string,
    maxSize: number = 10 * 1024 * 1024
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof content !== "string") {
      errors.push("Content must be a string");
    }

    if (content.length > maxSize) {
      errors.push(`Content exceeds maximum size (${maxSize} bytes)`);
    }

    // Check for potential script injection
    const scriptPatterns = [/<script[^>]*>/gi, /javascript:/gi, /on\w+\s*=/gi];

    if (scriptPatterns.some((pattern) => pattern.test(content))) {
      errors.push("Content contains potentially dangerous script patterns");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // API endpoint validation
  static validateApiEndpoint(endpoint: string): ValidationResult {
    const errors: string[] = [];

    if (!endpoint || typeof endpoint !== "string") {
      errors.push("API endpoint is required and must be a string");
    }

    try {
      const url = new URL(endpoint);

      // Only allow HTTP/HTTPS
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.push("Only HTTP and HTTPS protocols are allowed");
      }

      // Check for localhost in production (should be configurable)
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        errors.push("Localhost endpoints not allowed in production");
      }
    } catch {
      errors.push("Invalid URL format");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // User input validation (for forms, search, etc.)
  static validateUserInput(input: string, maxLength: number = 1000): ValidationResult {
    const errors: string[] = [];

    if (typeof input !== "string") {
      errors.push("Input must be a string");
    }

    if (input.length > maxLength) {
      errors.push(`Input exceeds maximum length (${maxLength} characters)`);
    }

    if (input.length === 0) {
      errors.push("Input cannot be empty");
    }

    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi,
      /(--|;|\/\*|\*\/|'|")/g,
    ];

    if (sqlPatterns.some((pattern) => pattern.test(input))) {
      errors.push("Input contains potentially dangerous SQL patterns");
    }

    // Check for XSS patterns
    const xssPatterns = [/<script[^>]*>/gi, /on\w+\s*=/gi, /javascript:/gi];

    if (xssPatterns.some((pattern) => pattern.test(input))) {
      errors.push("Input contains potentially dangerous script patterns");
    }

    // Sanitize input for safe display
    const sanitized = input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .trim();

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  // TODO item validation
  static validateTODOItem(item: {
    title?: string;
    description?: string;
    file?: string;
    priority?: string;
    type?: string;
  }): ValidationResult {
    const errors: string[] = [];

    if (!item.title || typeof item.title !== "string" || item.title.trim().length === 0) {
      errors.push("TODO title is required");
    }

    if (item.title && item.title.length > 200) {
      errors.push("TODO title exceeds maximum length (200 characters)");
    }

    if (item.description && item.description.length > 2000) {
      errors.push("TODO description exceeds maximum length (2000 characters)");
    }

    if (item.file && !this.validateFilePath(item.file).isValid) {
      errors.push("Invalid file path in TODO item");
    }

    const validPriorities = ["low", "medium", "high", "critical"];
    if (item.priority && !validPriorities.includes(item.priority)) {
      errors.push("Invalid priority level");
    }

    const validTypes = [
      "bug",
      "feature",
      "improvement",
      "documentation",
      "refactoring",
      "testing",
      "optimization",
      "security",
    ];
    if (item.type && !validTypes.includes(item.type)) {
      errors.push("Invalid TODO type");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export convenience functions
export const validateFilePath = (path: string) => InputValidator.validateFilePath(path);
export const validateDirectoryPath = (path: string) => InputValidator.validateDirectoryPath(path);
export const validateCommand = (command: string, args?: string[]) =>
  InputValidator.validateCommand(command, args);
export const validateFileContent = (content: string, maxSize?: number) =>
  InputValidator.validateFileContent(content, maxSize);
export const validateApiEndpoint = (endpoint: string) =>
  InputValidator.validateApiEndpoint(endpoint);
export const validateUserInput = (input: string, maxLength?: number) =>
  InputValidator.validateUserInput(input, maxLength);
export const validateTODOItem = (item: {
  title?: string;
  description?: string;
  file?: string;
  priority?: string;
  type?: string;
}) => InputValidator.validateTODOItem(item);
