/**
 * Enhanced Error Handling Middleware
 * Provides comprehensive error handling with structured logging and user-friendly responses
 */

const winston = require('winston');
const config = require('../config');

class ErrorHandler {
    constructor() {
        this.logger = this.createLogger();
        this.errorCounts = new Map();
        this.maxRetries = 3;
        this.retryDelays = [1000, 2000, 5000];
    }

    /**
     * Create Winston logger with structured logging
     */
    createLogger() {
        const configData = config.getLoggingConfig();
        const logLevel = configData.level;
        const logFormat = configData.format;

        // Create logs directory if it doesn't exist
        const fs = require('fs');
        const path = require('path');
        if (configData.file.enabled) {
            const logDir = path.dirname(configData.file.path);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }

        const transports = [];

        // Console transport
        if (configData.console.enabled) {
            transports.push(new winston.transports.Console({
                level: logLevel,
                format: logFormat === 'json' 
                    ? winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.errors({ stack: true }),
                        winston.format.json()
                    )
                    : winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.errors({ stack: true }),
                        winston.format.colorize(),
                        winston.format.simple()
                    )
            }));
        }

        // File transport
        if (configData.file.enabled) {
            transports.push(new winston.transports.File({
                filename: configData.file.path,
                level: 'error',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.errors({ stack: true }),
                    winston.format.json()
                ),
                maxsize: configData.file.maxSize,
                maxFiles: configData.file.maxFiles
            }));

            transports.push(new winston.transports.File({
                filename: configData.file.path.replace('.log', '.combined.log'),
                level: logLevel,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.errors({ stack: true }),
                    winston.format.json()
                ),
                maxsize: configData.file.maxSize,
                maxFiles: configData.file.maxFiles
            }));
        }

        return winston.createLogger({
            level: logLevel,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports,
            exitOnError: false
        });
    }

    /**
     * Enhanced error logging with context and categorization
     */
    async logError(error, context = {}, level = 'error') {
        const timestamp = new Date().toISOString();
        const errorEntry = {
            timestamp,
            level,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code,
                statusCode: error.statusCode
            },
            context,
            process: {
                pid: process.pid,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };

        // Categorize error for tracking
        const category = this.categorizeError(error);
        this.errorCounts.set(category, (this.errorCounts.get(category) || 0) + 1);

        // Log the error
        this.logger.log(level, errorEntry);

        return errorEntry;
    }

    /**
     * Categorize errors for better tracking and handling
     */
    categorizeError(error) {
        if (error.code === 'ENOENT') return 'file_not_found';
        if (error.code === 'EACCES') return 'permission_denied';
        if (error.code === 'ENOTDIR') return 'not_a_directory';
        if (error.code === 'EISDIR') return 'is_directory';
        if (error.code === 'EMFILE') return 'too_many_open_files';
        if (error.code === 'ECONNREFUSED') return 'connection_refused';
        if (error.code === 'ETIMEDOUT') return 'timeout_error';
        if (error.name === 'ValidationError') return 'validation_error';
        if (error.name === 'UnauthorizedError') return 'authentication_error';
        if (error.name === 'ForbiddenError') return 'authorization_error';
        if (error.name === 'NotFoundError') return 'not_found_error';
        if (error.name === 'ConflictError') return 'conflict_error';
        if (error.name === 'RateLimitError') return 'rate_limit_error';
        if (error.message.includes('database')) return 'database_error';
        if (error.message.includes('network')) return 'network_error';
        if (error.message.includes('redis')) return 'redis_error';
        if (error.message.includes('jwt')) return 'jwt_error';
        if (error.message.includes('ai') || error.message.includes('ollama')) return 'ai_error';
        return 'unknown_error';
    }

    /**
     * Enhanced async error wrapper with retry logic
     */
    async withRetry(operation, options = {}) {
        const {
            maxRetries = this.maxRetries,
            retryDelays = this.retryDelays,
            context = {},
            operationName = 'operation'
        } = options;

        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 0) {
                    this.logger.info(`✅ ${operationName} succeeded on attempt ${attempt + 1}`);
                }
                return result;
            } catch (error) {
                lastError = error;

                await this.logError(error, {
                    ...context,
                    operation: operationName,
                    attempt: attempt + 1,
                    maxRetries
                }, 'warn');

                if (attempt < maxRetries) {
                    const delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
                    this.logger.warn(`🔄 Retrying ${operationName} in ${delay}ms (attempt ${attempt + 2}/${maxRetries + 1})`);
                    await this.delay(delay);
                }
            }
        }

        // All retries exhausted
        throw await this.logError(lastError, {
            ...context,
            operation: operationName,
            exhaustedRetries: true
        }, 'error');
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate request data with detailed error messages
     */
    validateRequest(req, schema) {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            // Required field check
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push({
                    field,
                    message: `${field} is required`,
                    code: 'REQUIRED_FIELD_MISSING'
                });
                continue;
            }

            // Skip further validation if field is not required and not provided
            if (!rules.required && (value === undefined || value === null)) {
                continue;
            }

            // Type validation
            if (rules.type && typeof value !== rules.type) {
                errors.push({
                    field,
                    message: `${field} must be of type ${rules.type}`,
                    code: 'INVALID_TYPE',
                    expected: rules.type,
                    received: typeof value
                });
            }

            // String validations
            if (rules.type === 'string' && typeof value === 'string') {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push({
                        field,
                        message: `${field} must be at least ${rules.minLength} characters`,
                        code: 'STRING_TOO_SHORT'
                    });
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push({
                        field,
                        message: `${field} must be no more than ${rules.maxLength} characters`,
                        code: 'STRING_TOO_LONG'
                    });
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push({
                        field,
                        message: `${field} format is invalid`,
                        code: 'INVALID_FORMAT'
                    });
                }
            }

            // Number validations
            if (rules.type === 'number' && typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push({
                        field,
                        message: `${field} must be at least ${rules.min}`,
                        code: 'NUMBER_TOO_SMALL'
                    });
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push({
                        field,
                        message: `${field} must be no more than ${rules.max}`,
                        code: 'NUMBER_TOO_LARGE'
                    });
                }
            }

            // Array validations
            if (rules.type === 'array' && Array.isArray(value)) {
                if (rules.minItems && value.length < rules.minItems) {
                    errors.push({
                        field,
                        message: `${field} must have at least ${rules.minItems} items`,
                        code: 'ARRAY_TOO_SMALL'
                    });
                }
                if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push({
                        field,
                        message: `${field} must have no more than ${rules.maxItems} items`,
                        code: 'ARRAY_TOO_LARGE'
                    });
                }
            }

            // Custom validation
            if (rules.custom && typeof rules.custom === 'function') {
                try {
                    const customResult = rules.custom(value);
                    if (customResult !== true) {
                        errors.push({
                            field,
                            message: customResult || `${field} failed custom validation`,
                            code: 'CUSTOM_VALIDATION_FAILED'
                        });
                    }
                } catch (error) {
                    errors.push({
                        field,
                        message: `Validation error for ${field}: ${error.message}`,
                        code: 'VALIDATION_ERROR'
                    });
                }
            }
        }

        if (errors.length > 0) {
            const validationError = new Error('Request validation failed');
            validationError.name = 'ValidationError';
            validationError.statusCode = 400;
            validationError.details = errors;
            throw validationError;
        }

        return true;
    }

    /**
     * Create standardized API error responses
     */
    createApiError(error, req = null) {
        const baseError = {
            success: false,
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                type: error.name,
                code: error.code || 'INTERNAL_ERROR'
            }
        };

        // Add validation errors if present
        if (error.name === 'ValidationError' && error.details) {
            baseError.error.details = error.details;
            baseError.error.code = 'VALIDATION_FAILED';
        }

        // Add request context if available
        if (req) {
            baseError.request = {
                method: req.method,
                path: req.path,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: req.timestamp || new Date().toISOString()
            };
        }

        // Add error code for known error types
        if (error.code) {
            baseError.error.code = error.code;
        } else {
            switch (error.name) {
                case 'ValidationError':
                    baseError.error.code = 'VALIDATION_FAILED';
                    break;
                case 'UnauthorizedError':
                    baseError.error.code = 'UNAUTHORIZED';
                    break;
                case 'ForbiddenError':
                    baseError.error.code = 'FORBIDDEN';
                    break;
                case 'NotFoundError':
                    baseError.error.code = 'NOT_FOUND';
                    break;
                case 'ConflictError':
                    baseError.error.code = 'CONFLICT';
                    break;
                case 'RateLimitError':
                    baseError.error.code = 'RATE_LIMIT_EXCEEDED';
                    break;
                case 'TimeoutError':
                    baseError.error.code = 'TIMEOUT';
                    break;
                default:
                    baseError.error.code = 'INTERNAL_ERROR';
            }
        }

        // Set appropriate status code
        let statusCode = error.statusCode || 500;
        if (error.name === 'ValidationError') {
            statusCode = 400;
        } else if (error.name === 'UnauthorizedError') {
            statusCode = 401;
        } else if (error.name === 'ForbiddenError') {
            statusCode = 403;
        } else if (error.name === 'NotFoundError') {
            statusCode = 404;
        } else if (error.name === 'ConflictError') {
            statusCode = 409;
        } else if (error.name === 'RateLimitError') {
            statusCode = 429;
        } else if (error.code === 'ENOENT') {
            statusCode = 404;
        } else if (error.code === 'EACCES') {
            statusCode = 403;
        } else if (error.code === 'ETIMEDOUT') {
            statusCode = 408;
        }

        baseError.error.statusCode = statusCode;

        return baseError;
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
            errorBreakdown: Object.fromEntries(this.errorCounts),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Clean up old error logs (keep last 30 days)
     */
    async cleanupOldLogs(daysToKeep = 30) {
        try {
            const configData = config.getLoggingConfig();
            if (!configData.file.enabled) return;

            const fs = require('fs').promises;
            const path = require('path');
            
            const logFile = configData.file.path;
            const stats = await fs.stat(logFile);
            const fileAge = Date.now() - stats.mtime.getTime();
            const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

            if (fileAge > maxAge) {
                await fs.unlink(logFile);
                this.logger.info(`🧹 Cleaned up old error log file (${Math.round(fileAge / (24 * 60 * 60 * 1000))} days old)`);
            }
        } catch (error) {
            // File might not exist, which is fine
            if (error.code !== 'ENOENT') {
                this.logger.error('Error during log cleanup:', error);
            }
        }
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Express middleware for error handling
const errorMiddleware = (err, req, res, next) => {
    // Add timestamp to request
    req.timestamp = new Date().toISOString();

    // Log the error
    errorHandler.logError(err, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || 'anonymous'
    });

    // Don't expose internal errors in production
    const isDevelopment = config.isDevelopment();

    const apiError = errorHandler.createApiError(err, req);

    // Add stack trace in development
    if (isDevelopment && err.stack) {
        apiError.error.stack = err.stack;
    }

    // Determine status code
    const statusCode = apiError.error.statusCode || 500;

    res.status(statusCode).json(apiError);
};

// Async route wrapper to catch rejected promises
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Custom error classes
class ValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
        this.details = details;
    }
}

class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
        this.statusCode = 401;
    }
}

class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
        this.statusCode = 403;
    }
}

class NotFoundError extends Error {
    constructor(message = 'Not Found') {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

class ConflictError extends Error {
    constructor(message = 'Conflict') {
        super(message);
        this.name = 'ConflictError';
        this.statusCode = 409;
    }
}

class RateLimitError extends Error {
    constructor(message = 'Rate limit exceeded') {
        super(message);
        this.name = 'RateLimitError';
        this.statusCode = 429;
    }
}

class TimeoutError extends Error {
    constructor(message = 'Request timeout') {
        super(message);
        this.name = 'TimeoutError';
        this.statusCode = 408;
    }
}

module.exports = {
    ErrorHandler: errorHandler,
    errorMiddleware,
    asyncHandler,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    TimeoutError
};