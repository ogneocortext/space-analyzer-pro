/**
 * Space Analyzer - Unified Backend Server
 * Single, clean server implementation replacing backend-server.js and src/app.js
 */

// Global error handling to prevent crashes with Promise.try() for better error handling
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
const { Temporal } = require("@js-temporal/polyfill"); // Temporal API polyfill for Node.js 25/26 compatibility

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

  async initialize() {
    const startTime = Date.now();

    this.setupSecurity();
    this.setupRateLimiting();
    this.setupMiddleware();
    await this.setupDatabase();
    await this.setupRoutes();
    this.setupErrorHandling();
    this.setupHealthChecks();

    const initTime = Date.now() - startTime;
    console.log(`🚀 Space Analyzer server initialized in ${initTime}ms`);
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

      // Check if entry exists, create if not
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

    // Cleanup old entries every 5 minutes using Iterator methods
    setInterval(
      () => {
        const now = Date.now();
        // Filter expired entries - convert iterator to array first
        const expiredEntries = Array.from(this.rateLimitStore.entries())
          .filter(([, entry]) => now > entry.resetTime)
          .map(([ip]) => ip);

        for (const ip of expiredEntries) {
          this.rateLimitStore.delete(ip);
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
      const KnowledgeDatabase = require("./KnowledgeDatabase");

      // Ensure data directory exists
      const dataDir = path.join(__dirname, "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const dbPath = path.join(dataDir, "space-analyzer.db");
      this.knowledgeDB = new KnowledgeDatabase(dbPath);

      // Properly await database initialization to prevent race conditions
      await this.knowledgeDB.initialize();

      // Check if database was properly initialized
      if (this.knowledgeDB && this.knowledgeDB.db) {
        console.log("✅ Database initialized and ready");
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

  /**
   * Create Ollama service for AI chat functionality
   */
  createOllamaService() {
    const OllamaService = require("./services/OllamaService");
    return OllamaService; // The service is already instantiated in the module
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

    // Use CORS configuration from config with proper frontend-backend communication
    const config = require("./config");
    const corsOptions = {
      origin:
        process.env.NODE_ENV === "production"
          ? ["https://yourdomain.com"] // Add your production domain
          : [
              "http://localhost:5173", // Vite dev server
              "http://localhost:4173", // Vite preview server
              "http://localhost:8080", // Backend server
              "http://127.0.0.1:5173",
              "http://127.0.0.1:8080",
            ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "X-Analysis-ID",
      ],
      exposedHeaders: ["X-Total-Count", "X-Page-Count", "X-Analysis-ID"],
    };
    this.app.use(cors(corsOptions));
  }

  setupMiddleware() {
    this.app.use(compression({ level: 6, threshold: 1024 }));
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    // Static files
    this.app.use("/uploads", express.static(path.join(__dirname, "uploads")));

    // Request logging using Temporal API for better date handling
    this.app.use((req, res, next) => {
      const timestamp = Temporal.Now.plainDateTimeISO().toString();
      console.log(`${timestamp} - ${req.method} ${req.path}`);
      next();
    });
  }

  async setupRoutes() {
    // Routes setup - logging consolidated in summary

    // Create server object for RoutesManager with all expected properties
    const mockServer = {
      knowledgeDB: this.knowledgeDB,
      knowledge: this.createKnowledgeService(),
      errorLogger: this.errorLogger,
      activeAnalyses: new Map(),
      analysisResults: new Map(),
      isValidPath,
      normalizePath,
      ollamaService: this.createOllamaService(),
    };

    // Lazy load analysis history - only load when first requested
    mockServer.loadAnalysisHistory = async () => {
      if (!this.knowledgeDB?.db) {
        console.log("⚠️ Database not available for history loading");
        return;
      }

      // Check if history is already loaded
      if (mockServer.analysisResults.size > 0) {
        console.log(
          `📚 Analysis history already loaded (${mockServer.analysisResults.size} analyses)`
        );
        return;
      }

      console.log("📚 Loading analysis history from database (lazy load)...");
      try {
        const historyData = await this.knowledgeDB.getAnalysisHistory(100, 0);
        const history = historyData.analyses || historyData;
        if (Array.isArray(history)) {
          history.forEach((analysis) => {
            mockServer.analysisResults.set(analysis.id || analysis.analysisId, {
              ...analysis,
              status: "completed",
              completedAt: analysis.lastAnalyzed || analysis.last_analyzed,
            });
          });
          console.log(`✅ Loaded ${history.length} analyses from database`);
        }
      } catch (err) {
        console.log("⚠️ Could not load history:", err.message);
      }
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
          { path: "/analysis/progress/:id", methods: ["GET"] },
          { path: "/analysis/progress/stream/:id", methods: ["GET"] }, // SSE for real-time progress
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

    // Add fallback AI status endpoint before RoutesManager
    this.app.get("/api/ai/status", (req, res) => {
      try {
        res.json({
          success: true,
          status: "available",
          service: "AI Service",
          timestamp: Temporal.Now.plainDateTimeISO().toString(),
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

    // Add a simple health check endpoint directly to ensure it works
    this.app.get("/api/health", (req, res) => {
      try {
        const os = require("os");

        // Check database health - be more lenient during startup
        let dbHealthy = false;
        let dbStatus = "checking";

        try {
          if (mockServer && mockServer.knowledgeDB && mockServer.knowledgeDB.db !== null) {
            dbHealthy = true;
            dbStatus = "connected";
          } else if (mockServer && mockServer.knowledgeDB) {
            dbStatus = "initializing";
          } else {
            dbStatus = "not_initialized";
          }
        } catch (dbError) {
          dbStatus = "error";
        }

        // Always return 200 during startup - let the startup script handle readiness
        const healthData = {
          success: true,
          status: dbHealthy ? "healthy" : "starting",
          timestamp: Temporal.Now.plainDateTimeISO().toString(),
          uptime: os.uptime(),
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
          },
          database: dbStatus,
          version: "2.8.9",
          service: "Space Analyzer Backend",
          ready: dbHealthy,
        };

        // Only return 503 if completely failed, not during startup
        if (dbStatus === "error") {
          return res.status(503).json({
            ...healthData,
            status: "degraded",
            error: "Database error",
          });
        }

        res.json(healthData);
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

    // Wait for all routes to initialize before mounting
    await routesManager.waitForInitialization();
    routesManager.mountAll(this.app);

    // Add missing endpoints
    const missingEndpointsRouter = require("./missing-endpoints-fix");
    this.app.use("/api", missingEndpointsRouter);
    console.log("✅ Missing endpoints router mounted");

    // Catch-all for undefined /api routes - return helpful error (must be after routes are mounted)
    this.app.use("/api", (req, res, next) => {
      // Only handle exact /api path, not /api/* paths, and let other routes pass through
      if (req.path === "/api" || req.path === "/api/") {
        res.status(404).json({
          success: false,
          error: "API endpoint not specified",
          message: "Please use a specific endpoint like /api/analysis/start, /api/ai/status, etc.",
          availableEndpoints: [
            {
              path: "/api/analysis/start",
              method: "POST",
              description: "Start directory analysis",
            },
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
    // Use middleware-based catch-all to avoid path-to-regexp compatibility issues
    // This middleware MUST NOT intercept API routes - let them fall through to the 404 handler
    this.app.use((req, res, next) => {
      // Skip all API routes completely
      if (req.path.startsWith("/api/")) {
        return next();
      }

      // Only handle GET/HEAD requests for SPA routing
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }

      const indexPath = path.join(__dirname, "..", "dist", "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.json({
          success: true,
          message: "Space Analyzer Backend is running",
          port: this.port,
          timestamp: Temporal.Now.plainDateTimeISO().toString(),
        });
      }
    });
  }

  setupHealthChecks() {
    // Status endpoint (more detailed than health)
    this.app.get("/api/status", (req, res) => {
      const os = require("os");
      res.json({
        success: true,
        status: "operational",
        version: process.env.npm_package_version || "2.5.0",
        timestamp: Temporal.Now.plainDateTimeISO().toString(),
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
        buildDate: Temporal.Now.plainDateTimeISO().toString(),
      });
    });

    // CORS preflight handler for all API routes
    // Use app.use middleware to avoid path-to-regexp compatibility issues with newer versions
    this.app.use((req, res, next) => {
      if (!req.path.startsWith("/api/")) {
        return next();
      }
      if (req.method === "OPTIONS") {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
        res.header(
          "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        );
        return res.sendStatus(200);
      }
      next();
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
    // 404 handler for non-API routes only
    this.app.use((req, res, next) => {
      // Skip API routes - let them be handled by mounted routes
      if (req.path.startsWith("/api/")) {
        return next();
      }

      res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Endpoint ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler with Promise.resolve().then() for consistent async error handling
    this.app.use(async (error, req, res, next) => {
      await Promise.resolve()
        .then(async () => {
          await this.errorLogger.logRequestError(error, req, res);

          const isDev = process.env.NODE_ENV === "development";
          res.status(error.status || 500).json({
            success: false,
            error: error?.message || "Internal Server Error",
            ...(isDev && error?.stack && { stack: error.stack }),
          });
        })
        .catch(async (handlerError) => {
          console.error("Error in error handler:", handlerError);
          res.status(500).json({
            success: false,
            error: "Internal Server Error",
          });
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
    // Check if port is already in use
    const testServer = http.createServer();

    testServer
      .listen(this.port, () => {
        testServer.close();
        // Port is free, start the actual server
        this.startServer();
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`⚠️ Port ${this.port} is already in use, trying alternative port...`);
          // Try alternative ports
          const alternativePort = this.port + 1;
          this.port = alternativePort;
          console.log(`🔄 Trying alternative port: ${alternativePort}`);
          this.startServer();
        } else {
          console.error(`💥 Server error: ${err.message}`);
          process.exit(1);
        }
      });
  }

  startServer() {
    const server = http.createServer(this.app);

    server.listen(this.port, () => {
      console.log(`\n🚀 Space Analyzer Server running on port ${this.port}`);
      console.log(`📊 Health check: http://localhost:${this.port}/api/health`);
      console.log(`🔍 Debug routes: http://localhost:${this.port}/api/debug/routes\n`);
      console.log(`🌐 API available at: http://localhost:${this.port}/api`);
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

          // Clean up temp analysis files using RegExp.escape() for safety
          const tempFilePattern = new RegExp(`^${RegExp.escape("temp_analysis_")}.*\\.json$`);
          const tempDir = path.join(__dirname, "..");
          try {
            // Use Iterator methods for efficient file processing
            const filesToDelete = fs
              .readdirSync(tempDir)
              .filter((file) => tempFilePattern.test(file));

            for (const file of filesToDelete) {
              fs.unlinkSync(path.join(tempDir, file));
              console.log(`🧹 Cleaned up temp file: ${file}`);
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

// Start server with async initialization
const app = new SpaceAnalyzerServer();
app
  .initialize()
  .then(() => {
    app.start();
  })
  .catch((error) => {
    console.error("❌ Failed to initialize server:", error);
    process.exit(1);
  });

module.exports = SpaceAnalyzerServer;
