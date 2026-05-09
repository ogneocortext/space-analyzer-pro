/**
 * Main Application Entry Point
 * Sets up the Express server with all middleware and routes
 */

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const fs = require("fs");

// Import configuration
const config = require("./config");

// Import middleware
const {
  errorMiddleware,
  asyncHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  TimeoutError,
} = require("./middleware/errorHandler");

const {
  authenticateToken,
  requireRole,
  requirePermission,
  authenticateApiKey,
  validatePath,
  validateFileUpload,
  createRateLimiters,
  configureCORS,
  configureSecurityHeaders,
  logRequests,
  limitRequestSize,
  checkAPIVersion,
  addRequestId,
} = require("./middleware/security");

// Import services
const FileScannerService = require("./services/file-scanner/FileScannerService");
const AIService = require("./services/ai-integration/AIService");
const AnalysisService = require("./services/analysis/AnalysisService");

// Import controllers
const AnalysisController = require("./controllers/AnalysisController");
const FileController = require("./controllers/FileController");
const AIController = require("./controllers/AIController");
const HealthController = require("./controllers/HealthController");

// Import models
const FileRepository = require("./models/FileRepository");
const UserRepository = require("./models/UserRepository");

// Import utilities
const logger = require("./utils/logger");
const metrics = require("./utils/metrics");
const ErrorRoutes = require("../routes/errors");

class SpaceAnalyzerApp {
  constructor() {
    this.app = express();
    this.server = null;
    this.services = {};
    this.controllers = {};
    this.repositories = {};

    this.initializeConfig();
    this.initializeServices();
    this.initializeRepositories();
    this.initializeControllers();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize configuration
   */
  initializeConfig() {
    try {
      config.load();
      console.log("✅ Configuration loaded successfully");
    } catch (error) {
      console.error("❌ Configuration loading failed:", error.message);
      process.exit(1);
    }
  }

  /**
   * Initialize services
   */
  initializeServices() {
    try {
      this.services.fileScanner = new FileScannerService();
      this.services.ai = new AIService();
      this.services.analysis = new AnalysisService();

      console.log("✅ Services initialized successfully");
    } catch (error) {
      console.error("❌ Service initialization failed:", error.message);
      process.exit(1);
    }
  }

  /**
   * Initialize repositories
   */
  initializeRepositories() {
    try {
      this.repositories.file = new FileRepository();
      this.repositories.user = new UserRepository();

      console.log("✅ Repositories initialized successfully");
    } catch (error) {
      console.error("❌ Repository initialization failed:", error.message);
      process.exit(1);
    }
  }

  /**
   * Initialize controllers
   */
  initializeControllers() {
    try {
      this.controllers.analysis = new AnalysisController(
        this.services.analysis,
        this.services.fileScanner
      );
      this.controllers.file = new FileController(this.services.fileScanner, this.repositories.file);
      this.controllers.ai = new AIController(this.services.ai);
      this.controllers.health = new HealthController();

      console.log("✅ Controllers initialized successfully");
    } catch (error) {
      console.error("❌ Controller initialization failed:", error.message);
      process.exit(1);
    }
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    const configData = config.get("server");
    const performanceConfig = config.get("performance");
    const fileProcessingConfig = config.get("fileProcessing");

    // Add request ID for tracing
    this.app.use(addRequestId());

    // Log requests
    this.app.use(logRequests());

    // API versioning
    this.app.use(checkAPIVersion());

    // Security headers
    this.app.use(configureSecurityHeaders());

    // CORS configuration
    this.app.use(configureCORS());

    // Compression
    if (performanceConfig.compression.enabled) {
      this.app.use(
        compression({
          level: performanceConfig.compression.level,
          threshold: performanceConfig.compression.threshold,
        })
      );
    }

    // Body parsing
    this.app.use(
      express.json({
        limit: fileProcessingConfig.maxFileSize,
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: fileProcessingConfig.maxFileSize,
      })
    );

    // Request size limiting
    this.app.use(limitRequestSize());

    // Rate limiting
    const rateLimiters = createRateLimiters();
    this.app.use("/api/", rateLimiters.general);
    this.app.use("/api/auth/", rateLimiters.auth);
    this.app.use("/api/upload/", rateLimiters.upload);
    this.app.use("/api/ai/", rateLimiters.ai);
    this.app.use("/api/analyze/", rateLimiters.analysis);

    // Static file serving
    const staticDir = path.join(__dirname, "..", "..", "dist");
    if (fs.existsSync(staticDir)) {
      this.app.use(
        express.static(staticDir, {
          maxAge: "1h",
          etag: true,
          index: ["index.html", "index.htm"],
        })
      );
    }

    // Upload directory
    const uploadDir = path.join(__dirname, "..", "..", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    this.app.use(
      "/uploads",
      express.static(uploadDir, {
        maxAge: "1d",
        etag: true,
      })
    );

    console.log("✅ Middleware setup completed");
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // Health checks
    const monitoringConfig = config.get("monitoring");
    if (monitoringConfig.healthCheck.enabled) {
      this.app.get(
        `/api${monitoringConfig.healthCheck.path}`,
        asyncHandler(this.controllers.health.healthCheck.bind(this.controllers.health))
      );
    }

    if (monitoringConfig.readinessCheck.enabled) {
      this.app.get(
        `/api${monitoringConfig.readinessCheck.path}`,
        asyncHandler(this.controllers.health.readinessCheck.bind(this.controllers.health))
      );
    }

    if (monitoringConfig.startupCheck.enabled) {
      this.app.get(
        `/api${monitoringConfig.startupCheck.path}`,
        asyncHandler(this.controllers.health.livenessCheck.bind(this.controllers.health))
      );
    }

    // Metrics endpoint - disabled for now
    // const performanceConfig = config.get("performance");
    // if (performanceConfig.metrics.enabled) {
    //   this.app.get(
    //     performanceConfig.metrics.endpoint,
    //     asyncHandler(this.controllers.health.getMetrics.bind(this.controllers.health))
    //   );
    // }

    // API Routes
    this.setupAPIRoutes();

    // Serve frontend
    this.app.get("/", (req, res) => {
      const indexPath = path.join(__dirname, "..", "..", "dist", "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send(`
                    <html>
                        <head><title>Space Analyzer Backend</title></head>
                        <body>
                            <h1>🚀 Space Analyzer Backend</h1>
                            <p>Server is running on port ${config.get("server").port}</p>
                            <ul>
                                <li><a href="/api/health">Health Check</a></li>
                                <li><a href="/api/ready">Readiness Check</a></li>
                                <li><a href="/api/startup">Startup Check</a></li>
                                <!-- Metrics disabled for now -->
                            </ul>
                        </body>
                    </html>
                `);
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      const error = new NotFoundError(`Route not found: ${req.method} ${req.path}`);
      errorMiddleware(error, req, res, () => {});
    });

    console.log("✅ Routes setup completed");
  }

  /**
   * Setup API routes
   */
  setupAPIRoutes() {
    const apiRouter = express.Router();

    // File operations
    apiRouter.post(
      "/files/browse",
      asyncHandler(this.controllers.file.browseDirectory.bind(this.controllers.file))
    );

    apiRouter.get(
      "/files/details",
      asyncHandler(this.controllers.file.getFileDetails.bind(this.controllers.file))
    );

    apiRouter.delete(
      "/files/:id",
      authenticateToken(),
      requirePermission(["delete_files"]),
      asyncHandler(this.controllers.file.deleteFile.bind(this.controllers.file))
    );

    // Analysis operations
    apiRouter.get(
      "/analysis/history",
      asyncHandler(this.controllers.analysis.getAnalysisHistory.bind(this.controllers.analysis))
    );

    apiRouter.post(
      "/analyze",
      validatePath(),
      asyncHandler(this.controllers.analysis.analyzeDirectory.bind(this.controllers.analysis))
    );

    apiRouter.get(
      "/analyze/:id",
      asyncHandler(this.controllers.analysis.getAnalysisResult.bind(this.controllers.analysis))
    );

    apiRouter.get(
      "/analyze/:id/status",
      asyncHandler(this.controllers.analysis.getAnalysisStatus.bind(this.controllers.analysis))
    );

    // AI operations
    apiRouter.post(
      "/ai/analyze-files",
      asyncHandler(this.controllers.ai.analyzeFiles.bind(this.controllers.ai))
    );

    apiRouter.post(
      "/ai/recommendations",
      asyncHandler(this.controllers.ai.getRecommendations.bind(this.controllers.ai))
    );

    apiRouter.post(
      "/ai/detect-patterns",
      asyncHandler(this.controllers.ai.detectPatterns.bind(this.controllers.ai))
    );

    // Authentication (if needed)
    apiRouter.post(
      "/auth/login",
      asyncHandler(
        this.controllers.auth
          ? this.controllers.auth.login.bind(this.controllers.auth)
          : (req, res) => {
              res.status(501).json({ success: false, error: "Authentication not implemented" });
            }
      )
    );

    apiRouter.post(
      "/auth/register",
      asyncHandler(
        this.controllers.auth
          ? this.controllers.auth.register.bind(this.controllers.auth)
          : (req, res) => {
              res.status(501).json({ success: false, error: "Authentication not implemented" });
            }
      )
    );

    // Mount error routes
    const errorRoutes = new ErrorRoutes(this);
    this.app.use("/api", errorRoutes.getRouter());

    // Apply API versioning
    this.app.use("/api/v1", apiRouter);

    console.log("✅ API routes setup completed");
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use(errorMiddleware);

    // Unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      logger.error("Unhandled Promise Rejection", { reason, promise: promise.toString() });
    });

    // Uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      logger.error("Uncaught Exception", { error: error.message, stack: error.stack });
      process.exit(1);
    });

    console.log("✅ Error handling setup completed");
  }

  /**
   * Start the server
   */
  async start() {
    try {
      const configData = config.get("server");
      const port = configData.port;
      const host = configData.host;

      this.server = this.app.listen(port, host, () => {
        console.log(`🚀 Space Analyzer Backend started successfully`);
        console.log(`📊 Server: http://${host}:${port}`);
        console.log(`🏥 Health: http://${host}:${port}/api/health`);
        console.log(`✅ Environment: ${configData.env}`);
        const securityConfig = config.get("security");
        console.log(`🔒 Security: ${securityConfig.helmet.enabled ? "Enabled" : "Disabled"}`);
        const performanceConfig = config.get("performance");
        console.log(`📊 Metrics: ${performanceConfig.metrics.enabled ? "Enabled" : "Disabled"}`);
        console.log(`🤖 AI Providers: ${config.getEnabledAIProviders().join(", ")}`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

      return this.server;
    } catch (error) {
      console.error("❌ Failed to start server:", error.message);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      if (this.server) {
        this.server.close(() => {
          console.log("✅ HTTP server closed");

          // Close database connections
          if (this.repositories.file) {
            this.repositories.file.close();
          }

          // Close Redis connections
          if (this.services.ai && this.services.ai.redisClient) {
            this.services.ai.redisClient.quit();
          }

          console.log("✅ Graceful shutdown completed");
          process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          console.log("❌ Forced shutdown due to timeout");
          process.exit(1);
        }, 10000);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  /**
   * Get server instance
   */
  getServer() {
    return this.server;
  }

  /**
   * Get app instance
   */
  getApp() {
    return this.app;
  }
}

// Create and start application
const app = new SpaceAnalyzerApp();

if (require.main === module) {
  app.start().catch((error) => {
    console.error("❌ Application startup failed:", error);
    process.exit(1);
  });
}

module.exports = app;
