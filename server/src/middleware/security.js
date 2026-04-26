/**
 * Security Middleware
 * Provides authentication, authorization, and security headers
 */

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

class SecurityMiddleware {
    constructor() {
        this.redisClient = null;
        this.initializeRedis();
    }

    /**
     * Initialize Redis client for rate limiting
     */
    async initializeRedis() {
        try {
            const redisOptions = config.getRedisOptions();
            this.redisClient = redis.createClient({
                host: redisOptions.host,
                port: redisOptions.port,
                password: redisOptions.password,
                db: redisOptions.db
            });

            this.redisClient.on('error', (err) => {
                console.warn('Redis connection error:', err.message);
                this.redisClient = null;
            });

            await this.redisClient.connect();
            console.log('✅ Redis connected for rate limiting');
        } catch (error) {
            console.warn('⚠️ Redis not available for rate limiting:', error.message);
            this.redisClient = null;
        }
    }

    /**
     * JWT Authentication middleware
     */
    authenticateToken() {
        return async (req, res, next) => {
            try {
                const authHeader = req.headers['authorization'];
                const token = authHeader && authHeader.split(' ')[1];

                if (!token) {
                    throw new UnauthorizedError('Access token required');
                }

                const jwtOptions = config.getJWTOptions();
                const payload = jwt.verify(token, jwtOptions.secret);

                // Add user info to request
                req.user = {
                    id: payload.sub,
                    email: payload.email,
                    role: payload.role,
                    permissions: payload.permissions || [],
                    iat: payload.iat,
                    exp: payload.exp
                };

                next();
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    throw new UnauthorizedError('Token has expired');
                } else if (error.name === 'JsonWebTokenError') {
                    throw new UnauthorizedError('Invalid token');
                }
                next(error);
            }
        };
    }

    /**
     * Role-based authorization middleware
     */
    requireRole(requiredRoles) {
        return (req, res, next) => {
            if (!req.user) {
                throw new UnauthorizedError('Authentication required');
            }

            const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
            const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

            if (!hasRequiredRole) {
                throw new ForbiddenError(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
            }

            next();
        };
    }

    /**
     * Permission-based authorization middleware
     */
    requirePermission(requiredPermissions) {
        return (req, res, next) => {
            if (!req.user) {
                throw new UnauthorizedError('Authentication required');
            }

            const userPermissions = req.user.permissions || [];
            const hasRequiredPermission = requiredPermissions.every(permission => 
                userPermissions.includes(permission)
            );

            if (!hasRequiredPermission) {
                throw new ForbiddenError(`Access denied. Required permissions: ${requiredPermissions.join(', ')}`);
            }

            next();
        };
    }

    /**
     * API Key authentication middleware
     */
    authenticateApiKey() {
        return (req, res, next) => {
            const apiKey = req.headers['x-api-key'];
            
            if (!apiKey) {
                throw new UnauthorizedError('API key required');
            }

            // In a real application, you would validate the API key against a database
            // For now, we'll use a simple environment variable check
            const validApiKey = process.env.API_KEY;
            
            if (!validApiKey || apiKey !== validApiKey) {
                throw new UnauthorizedError('Invalid API key');
            }

            // Add API key info to request
            req.apiKey = {
                key: apiKey,
                valid: true
            };

            next();
        };
    }

    /**
     * Path validation middleware to prevent directory traversal
     */
    validatePath() {
        return (req, res, next) => {
            const path = req.body.path || req.params.path || req.query.path;
            
            if (!path) {
                return next();
            }

            // Normalize the path
            const normalizedPath = require('path').normalize(path);

            // Check for directory traversal attempts
            if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
                throw new ForbiddenError('Invalid path. Directory traversal not allowed');
            }

            // Additional validation for file system access
            const allowedPatterns = [
                /^[a-zA-Z0-9\/\-_\.]+$/, // Alphanumeric, slashes, hyphens, underscores, dots
                /^[a-zA-Z]:[\\\/]/ // Windows drive letters
            ];

            const isValidPath = allowedPatterns.some(pattern => pattern.test(normalizedPath));
            
            if (!isValidPath) {
                throw new ForbiddenError('Invalid path format');
            }

            next();
        };
    }

    /**
     * File upload validation middleware
     */
    validateFileUpload() {
        return (req, res, next) => {
            const fileProcessingConfig = config.getFileProcessingConfig();
            
            // Check file size
            if (req.file && req.file.size > fileProcessingConfig.maxFileSize) {
                throw new ForbiddenError(`File too large. Maximum size: ${fileProcessingConfig.maxFileSize} bytes`);
            }

            // Check file extension
            if (req.file && fileProcessingConfig.allowedExtensions.length > 0) {
                const fileExtension = require('path').extname(req.file.originalname).toLowerCase();
                const allowedExtensions = fileProcessingConfig.allowedExtensions.map(ext => ext.toLowerCase());
                
                if (!allowedExtensions.includes('*') && !allowedExtensions.includes(fileExtension)) {
                    throw new ForbiddenError(`File type not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`);
                }
            }

            next();
        };
    }

    /**
     * Rate limiting middleware
     */
    createRateLimit(options = {}) {
        const securityConfig = config.getSecurityConfig();
        const rateLimitConfig = securityConfig.rateLimit;

        const baseConfig = {
            windowMs: rateLimitConfig.windowMs,
            max: rateLimitConfig.max,
            skipSuccessfulRequests: rateLimitConfig.skipSuccessfulRequests,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                success: false,
                error: {
                    message: 'Too many requests, please try again later.',
                    code: 'RATE_LIMIT_EXCEEDED',
                    statusCode: 429
                },
                retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000)
            }
        };

        // Use Redis store if available
        if (this.redisClient) {
            baseConfig.store = new RedisStore({
                sendCommand: (...args) => this.redisClient.sendCommand(args)
            });
        }

        return rateLimit({
            ...baseConfig,
            ...options
        });
    }

    /**
     * Create different rate limiters for different endpoints
     */
    createRateLimiters() {
        return {
            // General API rate limiting
            general: this.createRateLimit({
                max: 1000, // 1000 requests per 15 minutes
                windowMs: 15 * 60 * 1000
            }),

            // Authentication endpoints (stricter)
            auth: this.createRateLimit({
                max: 10, // 10 attempts per 15 minutes
                windowMs: 15 * 60 * 1000,
                skipSuccessfulRequests: true
            }),

            // File upload endpoints (more lenient)
            upload: this.createRateLimit({
                max: 50, // 50 uploads per 15 minutes
                windowMs: 15 * 60 * 1000
            }),

            // AI endpoints (moderate)
            ai: this.createRateLimit({
                max: 100, // 100 AI requests per 15 minutes
                windowMs: 15 * 60 * 1000
            }),

            // Analysis endpoints (moderate)
            analysis: this.createRateLimit({
                max: 50, // 50 analysis requests per 15 minutes
                windowMs: 15 * 60 * 1000
            })
        };
    }

    /**
     * CORS configuration middleware
     */
    configureCORS() {
        const securityConfig = config.getSecurityConfig();
        const corsConfig = securityConfig.cors;

        return (req, res, next) => {
            // Set CORS headers
            res.header('Access-Control-Allow-Origin', corsConfig.origin);
            res.header('Access-Control-Allow-Methods', corsConfig.methods);
            res.header('Access-Control-Allow-Headers', corsConfig.allowedHeaders);
            
            if (corsConfig.credentials) {
                res.header('Access-Control-Allow-Credentials', 'true');
            }

            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.status(200).end();
                return;
            }

            next();
        };
    }

    /**
     * Security headers middleware
     */
    configureSecurityHeaders() {
        const securityConfig = config.getSecurityConfig();
        
        if (!securityConfig.helmet.enabled) {
            return (req, res, next) => next();
        }

        return (req, res, next) => {
            // Set security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
            res.setHeader('X-Download-Options', 'noopen');

            // Content Security Policy
            if (securityConfig.helmet.contentSecurityPolicy) {
                res.setHeader('Content-Security-Policy', 
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data: https:; " +
                    "font-src 'self' https:; " +
                    "connect-src 'self' http://localhost:* https://localhost:*; " +
                    "frame-ancestors 'none';"
                );
            }

            // Cross-Origin Embedder Policy
            if (securityConfig.helmet.crossOriginEmbedderPolicy) {
                res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            }

            next();
        };
    }

    /**
     * Request logging middleware
     */
    logRequests() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Log request
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);

            // Log response
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
                
                console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            });

            next();
        };
    }

    /**
     * Request size limiting middleware
     */
    limitRequestSize() {
        const fileProcessingConfig = config.getFileProcessingConfig();
        
        return (req, res, next) => {
            // Check request body size
            const contentLength = parseInt(req.headers['content-length'], 10);
            
            if (contentLength && contentLength > fileProcessingConfig.maxFileSize) {
                throw new ForbiddenError(`Request too large. Maximum size: ${fileProcessingConfig.maxFileSize} bytes`);
            }

            next();
        };
    }

    /**
     * API versioning middleware
     */
    checkAPIVersion() {
        return (req, res, next) => {
            const apiVersion = req.headers['api-version'] || req.query.api_version;
            
            if (apiVersion) {
                // In a real application, you would validate against supported versions
                req.apiVersion = apiVersion;
            }

            next();
        };
    }

    /**
     * Request ID middleware for tracing
     */
    addRequestId() {
        return (req, res, next) => {
            const requestId = require('uuid').v4();
            req.requestId = requestId;
            res.setHeader('X-Request-ID', requestId);
            next();
        };
    }
}

// Create singleton instance
const securityMiddleware = new SecurityMiddleware();

// Export middleware functions
module.exports = {
    authenticateToken: () => securityMiddleware.authenticateToken(),
    requireRole: (roles) => securityMiddleware.requireRole(roles),
    requirePermission: (permissions) => securityMiddleware.requirePermission(permissions),
    authenticateApiKey: () => securityMiddleware.authenticateApiKey(),
    validatePath: () => securityMiddleware.validatePath(),
    validateFileUpload: () => securityMiddleware.validateFileUpload(),
    createRateLimiters: () => securityMiddleware.createRateLimiters(),
    configureCORS: () => securityMiddleware.configureCORS(),
    configureSecurityHeaders: () => securityMiddleware.configureSecurityHeaders(),
    logRequests: () => securityMiddleware.logRequests(),
    limitRequestSize: () => securityMiddleware.limitRequestSize(),
    checkAPIVersion: () => securityMiddleware.checkAPIVersion(),
    addRequestId: () => securityMiddleware.addRequestId()
};