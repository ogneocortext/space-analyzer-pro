/**
 * Enhanced Error Handling Utilities
 * Provides comprehensive error handling for the Space Analyzer backend
 */

const fs = require('fs').promises;
const path = require('path');

class ErrorHandler {
    constructor(logFile = 'error.log') {
        this.logFile = path.join(__dirname, '..', logFile);
        this.errorCounts = new Map();
        this.maxRetries = 3;
        this.retryDelays = [1000, 2000, 5000]; // Progressive backoff
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
                code: error.code
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

        console.error(`[${level.toUpperCase()}] ${timestamp}: ${error.message}`, context);

        try {
            await fs.appendFile(this.logFile, JSON.stringify(errorEntry) + '\n');
        } catch (logError) {
            console.error('Failed to write to error log:', logError.message);
        }

        return errorEntry;
    }

    /**
     * Categorize errors for better tracking and handling
     */
    categorizeError(error) {
        if (error.code === 'ENOENT') return 'file_not_found';
        if (error.code === 'EACCES') return 'permission_denied';
        if (error.code === 'ENOTDIR') return 'not_a_directory';
        if (error.name === 'ValidationError') return 'validation_error';
        if (error.name === 'TimeoutError') return 'timeout_error';
        if (error.message.includes('database')) return 'database_error';
        if (error.message.includes('network')) return 'network_error';
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
                    console.log(` ${operationName} succeeded on attempt ${attempt + 1}`);
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
                    console.log(`ó Retrying ${operationName} in ${delay}ms (attempt ${attempt + 2}/${maxRetries + 1})`);
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
                type: error.name
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
                ip: req.ip
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
                case 'TimeoutError':
                    baseError.error.code = 'TIMEOUT';
                    break;
                default:
                    baseError.error.code = 'INTERNAL_ERROR';
            }
        }

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
            const stats = await fs.stat(this.logFile);
            const fileAge = Date.now() - stats.mtime.getTime();
            const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

            if (fileAge > maxAge) {
                await fs.unlink(this.logFile);
                console.log(`>ù Cleaned up old error log file (${Math.round(fileAge / (24 * 60 * 60 * 1000))} days old)`);
            }
        } catch (error) {
            // File might not exist, which is fine
            if (error.code !== 'ENOENT') {
                console.error('Error during log cleanup:', error.message);
            }
        }
    }
}

// Express middleware for error handling
const errorHandler = (errorHandlerInstance) => {
    return async (err, req, res, next) => {
        // Log the error
        await errorHandlerInstance.logError(err, {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Don't expose internal errors in production
        const isDevelopment = process.env.NODE_ENV !== 'production';

        const apiError = errorHandlerInstance.createApiError(err, req);

        // Add stack trace in development
        if (isDevelopment && err.stack) {
            apiError.error.stack = err.stack;
        }

        // Determine status code
        let statusCode = 500;
        if (err.name === 'ValidationError') {
            statusCode = 400;
        } else if (err.code === 'ENOENT') {
            statusCode = 404;
        } else if (err.code === 'EACCES') {
            statusCode = 403;
        }

        res.status(statusCode).json(apiError);
    };
};

// Async route wrapper to catch rejected promises
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    ErrorHandler,
    errorHandler,
    asyncHandler
};