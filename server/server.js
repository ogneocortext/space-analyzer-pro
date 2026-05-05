/**
 * Space Analyzer - Unified Backend Server
 * Single, clean server implementation replacing backend-server.js and src/app.js
 */

// Global error handling to prevent crashes
process.on("uncaughtException", (error) => {
  console.error("💥 UNCAUGHT EXCEPTION - Server will stay running:", error);
  // Log to file or monitoring service here
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ UNHANDLED REJECTION at:", promise, "reason:", reason);
  // Log to file or monitoring service here
});

// Increase memory limit for large scans (4GB)
const v8 = require("v8");
const maxMemoryGB = 4;
const maxMemoryMB = maxMemoryGB * 1024;
v8.setFlagsFromString(`--max-old-space-size=${maxMemoryMB}`);
console.log(`📊 Memory limit set to ${maxMemoryGB}GB`);

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { EventEmitter } = require("events");

// Load environment variables
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Import routes and utilities
const RoutesManager = require("./routes");
const { getErrorLogger } = require("./utils/error-logger");
const { isValidPath, normalizePath } = require("./modules/file-utils");

class SpaceAnalyzerServer {
  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT) || 8080;
    this.eventEmitter = new EventEmitter();
    this.errorLogger = getErrorLogger();
    this.rateLimitStore = new Map(); // In-memory rate limiting store

    this.initialize();
  }

  initialize() {
    this.setupSecurity();
    this.setupRateLimiting();
    this.setupMiddleware();
    this.setupDatabase().then(() => {
      this.setupRoutes();
      this.setupErrorHandling();
      this.setupHealthChecks();
    });
  }

  /**
   * Basic in-memory rate limiting middleware
   * Limits: 100 requests per minute per IP
   */
  setupRateLimiting() {
    const WINDOW_MS = 60 * 1000; // 1 minute
    const MAX_REQUESTS = 100;

    this.app.use((req, res, next) => {
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";
      const now = Date.now();

      // Get or create rate limit entry
      let entry = this.rateLimitStore.get(clientIp);
      if (!entry) {
        entry = { count: 0, resetTime: now + WINDOW_MS };
        this.rateLimitStore.set(clientIp, entry);
      }

      // Reset if window has passed
      if (now > entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + WINDOW_MS;
      }

      // Check limit
      if (entry.count >= MAX_REQUESTS) {
        return res.status(429).json({
          success: false,
          error: "Too many requests, please try again later",
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        });
      }

      entry.count++;

      // Add rate limit headers
      res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, MAX_REQUESTS - entry.count));

      next();
    });

    // Cleanup old entries every 5 minutes
    setInterval(
      () => {
        const now = Date.now();
        for (const [ip, entry] of this.rateLimitStore.entries()) {
          if (now > entry.resetTime) {
            this.rateLimitStore.delete(ip);
          }
        }
      },
      5 * 60 * 1000
    );
  }

  /**
   * Initialize database connection
   */
  async setupDatabase() {
    try {
      console.log("🔄 Initializing database...");
      const KnowledgeDatabase = require("./KnowledgeDatabase");

      // Ensure data directory exists
      const dataDir = path.join(__dirname, "data");
      if (!fs.existsSync(dataDir)) {
        console.log(`📁 Creating data directory: ${dataDir}`);
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const dbPath = path.join(dataDir, "space-analyzer.db");
      console.log(`📚 Database path: ${dbPath}`);

      this.knowledgeDB = new KnowledgeDatabase(dbPath);

      // Properly await database initialization to prevent race conditions
      await this.knowledgeDB.initialize();

      if (this.knowledgeDB.db) {
        console.log("✅ Database initialized successfully");
      } else {
        console.warn("⚠️ Database initialization failed, using in-memory fallback");
        this.knowledgeDB = null;
      }
    } catch (error) {
      console.error("❌ Database initialization error:", error.message);
      this.knowledgeDB = null;
    }
  }

  /**
   * Create a mock Knowledge service for settings management
   */
  createKnowledgeService() {
    // In-memory storage for settings (fallback when database is not available)
    const settings = new Map();

    return {
      // Get all user settings
      getAllUserSettings: async () => {
        const defaultSettings = {
          theme: "dark",
          notifications: {
            enabled: true,
            email: false,
            desktop: true,
          },
          scanning: {
            maxFiles: 100000,
            includeHidden: false,
            followSymlinks: false,
          },
          ui: {
            compactMode: false,
            showFilePreviews: true,
          },
        };

        // Return defaults if no settings are stored
        if (settings.size === 0) {
          return defaultSettings;
        }

        // Merge stored settings with defaults
        const storedSettings = Object.fromEntries(settings);
        return { ...defaultSettings, ...storedSettings };
      },

      // Get a specific user setting
      getUserSetting: async (key) => {
        if (settings.has(key)) {
          return settings.get(key);
        }

        // Return default values for common settings
        const defaults = {
          notifications: {
            enabled: true,
            position: "top-right",
            duration: 5000,
            types: {
              analysis: true,
              error: true,
              warning: true,
              success: true,
            },
          },
          theme: "dark",
          scanning: {
            maxFiles: 100000,
            includeHidden: false,
            followSymlinks: false,
          },
        };

        return defaults[key] || null;
      },

      // Set a specific user setting
      setUserSetting: async (key, value) => {
        settings.set(key, value);
        return true;
      },

      // Delete a user setting
      deleteUserSetting: async (key) => {
        return settings.delete(key);
      },

      // Clear all settings
      clearAllSettings: async () => {
        settings.clear();
        return true;
      },
    };
  }

  setupSecurity() {
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"],
          },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        referrerPolicy: { policy: "same-origin" },
        permittedCrossDomainPolicies: { permittedPolicies: "none" },
      })
    );

    // Use CORS configuration from config with localhost restriction
    const config = require("./src/config");
    const corsOptions = config.get("server.cors");
    this.app.use(cors(corsOptions));
  }

  setupMiddleware() {
    this.app.use(compression({ level: 6, threshold: 1024 }));
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    // Static files
    this.app.use("/uploads", express.static(path.join(__dirname, "uploads")));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    console.log("🔄 Setting up routes...");

    // Create server object for RoutesManager with all expected properties
    const mockServer = {
      knowledgeDB: this.knowledgeDB,
      knowledge: this.createKnowledgeService(),
      errorLogger: this.errorLogger,
      activeAnalyses: new Map(),
      analysisResults: new Map(),
      isValidPath,
      normalizePath,
    };

    // Add memory limit for analysisResults (LRU cleanup)
    const originalSet = mockServer.analysisResults.set.bind(mockServer.analysisResults);
    mockServer.analysisResults.set = function (key, value) {
      // Remove oldest entry if limit reached (100 entries)
      if (this.size >= 100) {
        const firstKey = this.keys().next().value;
        this.delete(firstKey);
        console.log(`🧹 Cleaned up old analysis result to prevent memory growth`);
      }
      return originalSet(key, value);
    };

    // Add comprehensive debug endpoint before RoutesManager to ensure it's accessible
    this.app.get("/api/debug/routes", (req, res) => {
      try {
        // Return static route information to avoid router stack access issues
        const routes = [
          // Core endpoints
          { path: "/health", methods: ["GET"] },
          { path: "/debug/routes", methods: ["GET"] },
          // Analysis endpoints
          { path: "/analysis/current", methods: ["GET"] },
          { path: "/analysis/start", methods: ["POST"] },
          { path: "/analysis/cancel", methods: ["POST"] },
          { path: "/analysis/status/:id", methods: ["GET"] },
          { path: "/analysis/health", methods: ["GET"] },
          // Error endpoints
          { path: "/errors/health", methods: ["GET"] },
          { path: "/errors/report", methods: ["POST"] },
          { path: "/errors/recent", methods: ["GET"] },
          // AI endpoints
          { path: "/ai/status", methods: ["GET"] },
          { path: "/ai/chat", methods: ["POST"] },
          { path: "/ai/analyze", methods: ["POST"] },
          // File endpoints
          { path: "/files/list", methods: ["GET"] },
          { path: "/files/delete", methods: ["POST"] },
          { path: "/files/reveal", methods: ["POST"] },
          // System endpoints
          { path: "/system/info", methods: ["GET"] },
          { path: "/system/metrics", methods: ["GET"] },
        ];

        res.json({
          success: true,
          count: routes.length,
          routes,
          note: "Static route listing - router stack access temporarily disabled due to compatibility issues",
        });
      } catch (error) {
        console.error("Debug routes error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to retrieve routes",
          message: error.message,
        });
      }
    });

    // Add fallback analysis health endpoint before RoutesManager
    this.app.get("/api/analysis/health", (req, res) => {
      try {
        const os = require("os");
        res.json({
          success: true,
          status: "healthy",
          timestamp: new Date().toISOString(),
          system: {
            platform: os.platform(),
            arch: os.arch(),
            uptime: os.uptime(),
            memory: {
              total: os.totalmem(),
              free: os.freemem(),
              used: os.totalmem() - os.freemem(),
            },
          },
        });
      } catch (error) {
        console.error("Analysis health error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to get analysis health",
          message: error.message,
        });
      }
    });

    // Add fallback AI status endpoint before RoutesManager
    this.app.get("/api/ai/status", (req, res) => {
      try {
        res.json({
          success: true,
          status: "available",
          service: "AI Service",
          timestamp: new Date().toISOString(),
          note: "Fallback AI status endpoint - knowledge service temporarily unavailable",
        });
      } catch (error) {
        console.error("AI status error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to get AI status",
          message: error.message,
        });
      }
    });

    // Add fallback files list endpoint before RoutesManager
    this.app.get("/api/files/list", (req, res) => {
      try {
        const queryPath = req.query.path || "C:\\";
        res.json({
          success: true,
          path: queryPath,
          files: [],
          note: "Fallback files endpoint - file system access temporarily limited",
        });
      } catch (error) {
        console.error("Files list error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to list files",
          message: error.message,
        });
      }
    });

    // Add fallback system info endpoint before RoutesManager
    this.app.get("/api/system/info", (req, res) => {
      try {
        const os = require("os");
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          system: {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            cpus: os.cpus().length,
            networkInterfaces: os.networkInterfaces(),
          },
          node: {
            version: process.version,
            pid: process.pid,
            memoryUsage: process.memoryUsage(),
          },
        });
      } catch (error) {
        console.error("System info error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to get system info",
          message: error.message,
        });
      }
    });

    // Add a simple health check endpoint directly to ensure it works
    this.app.get("/api/health", (req, res) => {
      try {
        const os = require("os");

        // Check database health
        const dbHealthy = mockServer.knowledgeDB && mockServer.knowledgeDB.db !== null;

        if (!dbHealthy) {
          return res.status(503).json({
            success: false,
            status: "degraded",
            timestamp: new Date().toISOString(),
            error: "Database unavailable",
            message: "Service is running but database connection failed",
            version: "2.8.9",
            service: "Space Analyzer Backend",
          });
        }

        res.json({
          success: true,
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: os.uptime(),
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
          },
          database: dbHealthy ? "connected" : "disconnected",
          version: "2.8.9",
          service: "Space Analyzer Backend",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          status: "error",
          error: "Health check failed",
          message: error.message,
        });
      }
    });

    // Use RoutesManager for all /api routes first
    const routesManager = new RoutesManager(mockServer);
    routesManager.mountAll(this.app);

    // Catch-all for undefined /api routes - return helpful error (must be after routes are mounted)
    this.app.all("/api", (req, res) => {
      res.status(404).json({
        success: false,
        error: "API endpoint not specified",
        message: "Please use a specific endpoint like /api/analysis/start, /api/ai/status, etc.",
        availableEndpoints: [
          { path: "/api/analysis/start", method: "POST", description: "Start directory analysis" },
          {
            path: "/api/analysis/current",
            method: "GET",
            description: "Get current analysis status",
          },
          { path: "/api/ai/status", method: "GET", description: "Get AI service status" },
          { path: "/api/ai/chat", method: "POST", description: "Send message to AI" },
          { path: "/api/system/info", method: "GET", description: "Get system information" },
          { path: "/api/debug/routes", method: "GET", description: "List all available routes" },
        ],
      });
    });

    // Catch-all for undefined /api/* routes (must be after routes are mounted)
    this.app.use((req, res, next) => {
      if (req.path.startsWith("/api/") && !res.headersSent) {
        res.status(404).json({
          success: false,
          error: "API endpoint not found",
          path: req.path,
          method: req.method,
          message: "The requested API endpoint does not exist",
          suggestion: "Check /api/debug/routes for available endpoints",
        });
      } else {
        next();
      }
    });

    // Serve static frontend files
    const distPath = path.join(__dirname, "..", "dist");
    if (fs.existsSync(distPath)) {
      this.app.use(express.static(distPath));
      console.log(`📁 Serving static files from: ${distPath}`);
    }

    // Serve frontend (catch-all for non-API routes - SPA fallback)
    this.app.get("/{*path}", (req, res) => {
      // Skip API routes
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({
          success: false,
          error: "API endpoint not found",
          path: req.path,
        });
      }

      const indexPath = path.join(__dirname, "..", "dist", "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.json({
          success: true,
          message: "Space Analyzer Backend is running",
          port: this.port,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  setupHealthChecks() {
    // Status endpoint (more detailed than health
    this.app.get("/api/status", (req, res) => {
      const os = require("os");
      res.json({
        success: true,
        status: "operational",
        version: process.env.npm_package_version || "2.5.0",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
          },
        },
      });
    });

    // Version endpoint
    this.app.get("/api/version", (req, res) => {
      res.json({
        success: true,
        version: process.env.npm_package_version || "2.5.0",
        apiVersion: "v2",
        buildDate: new Date().toISOString(),
      });
    });

    // CORS preflight handler for all API routes
    this.app.options("/api/{*path}", (req, res) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      res.sendStatus(200);
    });

    // Root API info endpoint
    this.app.get("/api/info", (req, res) => {
      res.json({
        success: true,
        name: "Space Analyzer Pro API",
        version: "2.5.0",
        description: "AI-powered storage analysis and cleanup recommendations",
        documentation: "/api/debug/routes",
        endpoints: {
          health: "/api/health",
          status: "/api/status",
          version: "/api/version",
          analysis: "/api/analysis/*",
          ai: "/api/ai/*",
          files: "/api/files/*",
          settings: "/api/settings/*",
          system: "/api/system/*",
          errors: "/api/errors/*",
        },
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Endpoint ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    this.app.use(async (error, req, res, next) => {
      await this.errorLogger.logRequestError(error, req, res);

      const isDev = process.env.NODE_ENV === "development";
      res.status(error.status || 500).json({
        success: false,
        error: error?.message || "Internal Server Error",
        ...(isDev && error?.stack && { stack: error.stack }),
      });
    });

    // Process error handlers - already handled at top of file, just log here
    process.on("uncaughtException", async (error) => {
      await this.errorLogger.logUncaughtException(error);
      // Don't exit - let the server keep running
    });

    process.on("unhandledRejection", async (reason, promise) => {
      await this.errorLogger.logUnhandledRejection(reason, promise);
    });
  }

  start() {
    const server = http.createServer(this.app);

    server.listen(this.port, () => {
      console.log(`\n🚀 Space Analyzer Server running on port ${this.port}`);
      console.log(`📊 Health check: http://localhost:${this.port}/api/health`);
      console.log(`🔍 Debug routes: http://localhost:${this.port}/api/debug/routes\n`);
    });

    // Graceful shutdown with resource cleanup
    const shutdown = async (signal) => {
      console.log(`\n🛑 ${signal} received, shutting down gracefully...`);

      // Stop accepting new connections
      server.close(async () => {
        console.log("✅ HTTP server closed");

        // Cleanup resources
        try {
          // Stop error logger flush interval
          if (this.errorLogger && this.errorLogger.cleanup) {
            await this.errorLogger.cleanup();
            console.log("✅ Error logger stopped");
          }

          // Cleanup Ollama process if running
          const { cleanupOllamaProcess } = require("./modules/ollama-service");
          cleanupOllamaProcess.call(this);

          // Close database connection
          if (this.knowledgeDB && this.knowledgeDB.close) {
            await this.knowledgeDB.close();
            console.log("✅ Database connection closed");
          }

          // Clean up temp analysis files
          const tempFilePattern = /^temp_analysis_.*\.json$/;
          const tempDir = path.join(__dirname, "..");
          try {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
              if (tempFilePattern.test(file)) {
                fs.unlinkSync(path.join(tempDir, file));
                console.log(`🧹 Cleaned up temp file: ${file}`);
              }
            }
          } catch (e) {
            // Ignore cleanup errors
          }

          // Clear analysis results from memory
          if (this.analysisResults) {
            this.analysisResults.clear();
            console.log("✅ Analysis results cache cleared");
          }

          // Clear active analyses
          if (this.activeAnalyses) {
            this.activeAnalyses.clear();
            console.log("✅ Active analyses cleared");
          }

          console.log("👋 Graceful shutdown complete");
        } catch (error) {
          console.error("❌ Error during shutdown:", error);
        }

        process.exit(0);
      });

      // Force shutdown after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        console.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}

// Start server
const app = new SpaceAnalyzerServer();
app.start();

module.exports = SpaceAnalyzerServer;
