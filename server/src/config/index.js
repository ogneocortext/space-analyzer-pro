/**
 * Configuration Service
 * Centralized configuration management for the Space Analyzer backend
 */

const fs = require('fs');
const path = require('path');
const Joi = require('joi');

class ConfigService {
    constructor() {
        this.config = null;
        this.isLoaded = false;
    }

    /**
     * Load and validate configuration
     */
    load() {
        if (this.isLoaded) {
            return this.config;
        }

        // Load environment variables
        this.loadEnvironment();

        // Validate configuration
        this.config = this.validateConfig(this.buildConfig());
        this.isLoaded = true;

        return this.config;
    }

    /**
     * Load environment variables from .env file
     */
    loadEnvironment() {
        const envPath = path.join(__dirname, '..', '..', '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim();
                }
            });
        }
    }

    /**
     * Build configuration object from environment variables
     */
    buildConfig() {
        return {
            // Server configuration
            server: {
                port: parseInt(process.env.PORT || '3000', 10),
                host: process.env.HOST || 'localhost',
                env: process.env.NODE_ENV || 'development',
                cors: {
                    origin: process.env.CORS_ORIGIN || '*',
                    credentials: process.env.CORS_CREDENTIALS === 'true'
                }
            },

            // Database configuration
            database: {
                type: process.env.DB_TYPE || 'sqlite',
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '3306', 10),
                name: process.env.DB_NAME || 'space_analyzer.db',
                username: process.env.DB_USERNAME || 'root',
                password: process.env.DB_PASSWORD || '',
                ssl: process.env.DB_SSL === 'true',
                pool: {
                    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
                    max: parseInt(process.env.DB_POOL_MAX || '10', 10)
                }
            },

            // Redis configuration
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD || '',
                db: parseInt(process.env.REDIS_DB || '0', 10),
                keyPrefix: process.env.REDIS_KEY_PREFIX || 'space_analyzer:',
                ttl: parseInt(process.env.REDIS_TTL || '3600', 10)
            },

            // JWT configuration
            jwt: {
                secret: process.env.JWT_SECRET || this.generateSecret(),
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
                refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
                issuer: process.env.JWT_ISSUER || 'space-analyzer',
                audience: process.env.JWT_AUDIENCE || 'space-analyzer-users'
            },

            // AI configuration
            ai: {
                providers: {
                    ollama: {
                        enabled: process.env.OLLAMA_ENABLED !== 'false',
                        endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
                        defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'gemma3:latest',
                        timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000', 10)
                    },
                    lmstudio: {
                        enabled: process.env.LMSTUDIO_ENABLED !== 'false',
                        endpoint: process.env.LMSTUDIO_ENDPOINT || 'http://localhost:1234',
                        defaultModel: process.env.LMSTUDIO_DEFAULT_MODEL || 'default',
                        timeout: parseInt(process.env.LMSTUDIO_TIMEOUT || '30000', 10)
                    },
                    localai: {
                        enabled: process.env.LOCALAI_ENABLED !== 'false',
                        endpoint: process.env.LOCALAI_ENDPOINT || 'http://localhost:8080',
                        defaultModel: process.env.LOCALAI_DEFAULT_MODEL || 'default',
                        timeout: parseInt(process.env.LOCALAI_TIMEOUT || '30000', 10)
                    }
                },
                fallbackChain: process.env.AI_FALLBACK_CHAIN?.split(',') || ['ollama', 'lmstudio', 'localai'],
                maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
                retryDelay: parseInt(process.env.AI_RETRY_DELAY || '1000', 10)
            },

            // Logging configuration
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                format: process.env.LOG_FORMAT || 'json',
                file: {
                    enabled: process.env.LOG_FILE_ENABLED === 'true',
                    path: process.env.LOG_FILE_PATH || 'logs/app.log',
                    maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
                    maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5', 10)
                },
                console: {
                    enabled: process.env.LOG_CONSOLE_ENABLED !== 'false'
                }
            },

            // Security configuration
            security: {
                rateLimit: {
                    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
                    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
                    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
                },
                helmet: {
                    enabled: process.env.HELMET_ENABLED !== 'false',
                    contentSecurityPolicy: process.env.HELMET_CSP !== 'false',
                    crossOriginEmbedderPolicy: process.env.HELMET_COEP === 'true'
                },
                cors: {
                    origin: process.env.CORS_ORIGIN || '*',
                    methods: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS',
                    allowedHeaders: process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization',
                    credentials: process.env.CORS_CREDENTIALS === 'true'
                }
            },

            // File processing configuration
            fileProcessing: {
                maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
                allowedExtensions: process.env.ALLOWED_EXTENSIONS?.split(',') || ['*'],
                tempDir: process.env.TEMP_DIR || path.join(__dirname, '..', '..', 'temp'),
                scanTimeout: parseInt(process.env.SCAN_TIMEOUT || '300000', 10), // 5 minutes
                maxConcurrentScans: parseInt(process.env.MAX_CONCURRENT_SCANS || '5', 10)
            },

            // Performance configuration
            performance: {
                compression: {
                    enabled: process.env.COMPRESSION_ENABLED !== 'false',
                    level: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
                    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024', 10)
                },
                metrics: {
                    enabled: process.env.METRICS_ENABLED !== 'false',
                    endpoint: process.env.METRICS_ENDPOINT || '/metrics'
                }
            },

            // Monitoring configuration
            monitoring: {
                healthCheck: {
                    enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
                    path: process.env.HEALTH_CHECK_PATH || '/health'
                },
                readinessCheck: {
                    enabled: process.env.READY_CHECK_ENABLED !== 'false',
                    path: process.env.READY_CHECK_PATH || '/ready'
                },
                startupCheck: {
                    enabled: process.env.STARTUP_CHECK_ENABLED !== 'false',
                    path: process.env.STARTUP_CHECK_PATH || '/startup'
                }
            }
        };
    }

    /**
     * Validate configuration using Joi schema
     */
    validateConfig(config) {
        const schema = Joi.object({
            server: Joi.object({
                port: Joi.number().port().required(),
                host: Joi.string().hostname().required(),
                env: Joi.string().valid('development', 'production', 'test').required(),
                cors: Joi.object({
                    origin: [Joi.string(), Joi.array(), Joi.boolean()],
                    credentials: Joi.boolean().required()
                }).required()
            }).required(),

            database: Joi.object({
                type: Joi.string().valid('sqlite', 'mysql', 'postgresql').required(),
                host: Joi.string().hostname().required(),
                port: Joi.number().port().required(),
                name: Joi.string().required(),
                username: Joi.string().required(),
                password: Joi.string().allow(''),
                ssl: Joi.boolean().required(),
                pool: Joi.object({
                    min: Joi.number().integer().min(1).max(50).required(),
                    max: Joi.number().integer().min(1).max(100).required()
                }).required()
            }).required(),

            redis: Joi.object({
                host: Joi.string().hostname().required(),
                port: Joi.number().port().required(),
                password: Joi.string().allow(''),
                db: Joi.number().integer().min(0).max(15).required(),
                keyPrefix: Joi.string().required(),
                ttl: Joi.number().integer().min(1).required()
            }).required(),

            jwt: Joi.object({
                secret: Joi.string().min(32).required(),
                expiresIn: Joi.string().required(),
                refreshExpiresIn: Joi.string().required(),
                issuer: Joi.string().required(),
                audience: Joi.string().required()
            }).required(),

            ai: Joi.object({
                providers: Joi.object({
                    ollama: Joi.object({
                        enabled: Joi.boolean().required(),
                        endpoint: Joi.string().uri().required(),
                        defaultModel: Joi.string().required(),
                        timeout: Joi.number().integer().min(1000).max(300000).required()
                    }).required(),
                    lmstudio: Joi.object({
                        enabled: Joi.boolean().required(),
                        endpoint: Joi.string().uri().required(),
                        defaultModel: Joi.string().required(),
                        timeout: Joi.number().integer().min(1000).max(300000).required()
                    }).required(),
                    localai: Joi.object({
                        enabled: Joi.boolean().required(),
                        endpoint: Joi.string().uri().required(),
                        defaultModel: Joi.string().required(),
                        timeout: Joi.number().integer().min(1000).max(300000).required()
                    }).required()
                }).required(),
                fallbackChain: Joi.array().items(Joi.string()).min(1).required(),
                maxRetries: Joi.number().integer().min(0).max(10).required(),
                retryDelay: Joi.number().integer().min(100).max(30000).required()
            }).required(),

            logging: Joi.object({
                level: Joi.string().valid('error', 'warn', 'info', 'debug').required(),
                format: Joi.string().valid('json', 'simple').required(),
                file: Joi.object({
                    enabled: Joi.boolean().required(),
                    path: Joi.string().required(),
                    maxSize: Joi.string().required(),
                    maxFiles: Joi.number().integer().min(1).max(100).required()
                }).required(),
                console: Joi.object({
                    enabled: Joi.boolean().required()
                }).required()
            }).required(),

            security: Joi.object({
                rateLimit: Joi.object({
                    windowMs: Joi.number().integer().min(1000).max(3600000).required(),
                    max: Joi.number().integer().min(1).max(10000).required(),
                    skipSuccessfulRequests: Joi.boolean().required()
                }).required(),
                helmet: Joi.object({
                    enabled: Joi.boolean().required(),
                    contentSecurityPolicy: Joi.boolean().required(),
                    crossOriginEmbedderPolicy: Joi.boolean().required()
                }).required(),
                cors: Joi.object({
                    origin: [Joi.string(), Joi.array(), Joi.boolean()],
                    methods: Joi.string().required(),
                    allowedHeaders: Joi.string().required(),
                    credentials: Joi.boolean().required()
                }).required()
            }).required(),

            fileProcessing: Joi.object({
                maxFileSize: Joi.number().integer().min(1024).max(1073741824).required(), // 1GB max
                allowedExtensions: Joi.array().items(Joi.string()).required(),
                tempDir: Joi.string().required(),
                scanTimeout: Joi.number().integer().min(10000).max(1800000).required(), // 30 min max
                maxConcurrentScans: Joi.number().integer().min(1).max(20).required()
            }).required(),

            performance: Joi.object({
                compression: Joi.object({
                    enabled: Joi.boolean().required(),
                    level: Joi.number().integer().min(0).max(9).required(),
                    threshold: Joi.number().integer().min(0).max(1048576).required()
                }).required(),
                metrics: Joi.object({
                    enabled: Joi.boolean().required(),
                    endpoint: Joi.string().required()
                }).required()
            }).required(),

            monitoring: Joi.object({
                healthCheck: Joi.object({
                    enabled: Joi.boolean().required(),
                    path: Joi.string().required()
                }).required(),
                readinessCheck: Joi.object({
                    enabled: Joi.boolean().required(),
                    path: Joi.string().required()
                }).required(),
                startupCheck: Joi.object({
                    enabled: Joi.boolean().required(),
                    path: Joi.string().required()
                }).required()
            }).required()
        });

        const { error, value } = schema.validate(config, { abortEarly: false });
        if (error) {
            throw new Error(`Configuration validation failed: ${error.details.map(d => d.message).join(', ')}`);
        }

        return value;
    }

    /**
     * Generate a random secret for JWT
     */
    generateSecret() {
        const crypto = require('crypto');
        return crypto.randomBytes(64).toString('hex');
    }

    /**
     * Get configuration value by path
     */
    get(path) {
        if (!this.isLoaded) {
            this.load();
        }

        return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
    }

    /**
     * Check if running in development mode
     */
    isDevelopment() {
        return this.get('server.env') === 'development';
    }

    /**
     * Check if running in production mode
     */
    isProduction() {
        return this.get('server.env') === 'production';
    }

    /**
     * Check if running in test mode
     */
    isTest() {
        return this.get('server.env') === 'test';
    }

    /**
     * Get database connection string
     */
    getDatabaseConnectionString() {
        const db = this.get('database');
        
        switch (db.type) {
            case 'sqlite':
                return `sqlite:${db.name}`;
            case 'mysql':
                return `mysql://${db.username}:${db.password}@${db.host}:${db.port}/${db.name}`;
            case 'postgresql':
                return `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.name}`;
            default:
                throw new Error(`Unsupported database type: ${db.type}`);
        }
    }

    /**
     * Get Redis connection options
     */
    getRedisOptions() {
        const redis = this.get('redis');
        return {
            host: redis.host,
            port: redis.port,
            password: redis.password || undefined,
            db: redis.db,
            keyPrefix: redis.keyPrefix
        };
    }

    /**
     * Get JWT options
     */
    getJWTOptions() {
        const jwt = this.get('jwt');
        return {
            secret: jwt.secret,
            expiresIn: jwt.expiresIn,
            issuer: jwt.issuer,
            audience: jwt.audience
        };
    }

    /**
     * Get AI provider configuration
     */
    getAIProviderConfig(provider) {
        const ai = this.get('ai');
        return ai.providers[provider];
    }

    /**
     * Get all enabled AI providers
     */
    getEnabledAIProviders() {
        const ai = this.get('ai');
        return Object.keys(ai.providers).filter(provider => 
            ai.providers[provider].enabled
        );
    }

    /**
     * Get fallback AI provider chain
     */
    getAIFallbackChain() {
        return this.get('ai.fallbackChain');
    }

    /**
     * Get logging configuration
     */
    getLoggingConfig() {
        return this.get('logging');
    }

    /**
     * Get security configuration
     */
    getSecurityConfig() {
        return this.get('security');
    }

    /**
     * Get file processing configuration
     */
    getFileProcessingConfig() {
        return this.get('fileProcessing');
    }

    /**
     * Get performance configuration
     */
    getPerformanceConfig() {
        return this.get('performance');
    }

    /**
     * Get monitoring configuration
     */
    getMonitoringConfig() {
        return this.get('monitoring');
    }
}

// Create singleton instance
const configService = new ConfigService();

// Export singleton instance
module.exports = configService;