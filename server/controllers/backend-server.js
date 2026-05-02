const express = require("express");
const path = require("path");
const fs = require("fs");
const { promises: fsPromises } = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { existsSync } = require("fs");
const { EventEmitter } = require("events");
const http = require("http");

// Import modules & services
const { setupSecurity, setupMiddleware } = require("../modules/security");
const { setupWebSocketServer, broadcast, getClients } = require("../modules/websocket");
const RoutesManager = require("../routes");
const EnhancedOllamaService = require("../services/EnhancedOllamaService");
const LearningService = require("../services/LearningService");
const PortDetector = require("../utils/port-detector");
const { isValidPath, normalizePath } = require("../modules/file-utils");
const ScanCache = require("../scan-cache");
const { ScanProfileManager } = require("../scan-profiles");
const FilePreviewManager = require("../file-preview");
const ScanController = require("./scan-controller");
const ScanFilter = require("../scan-filter");
const ConfigManager = require("../utils/config-manager");
const AnalyticsManager = require("../analytics");
const { getErrorLogger } = require("../utils/error-logger");

class SpaceAnalyzerAPIServer {
  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT) || 8080;
    this.activeAnalyses = new Map();
    this.analysisResults = new Map();
    this.eventEmitter = new EventEmitter();
    this.ollamaAvailable = false;

    // Initialize systems
    this.learningService = new LearningService(path.join(__dirname, "learning"));
    this.ollamaService = new EnhancedOllamaService();
    this.ollamaService.setLearningService(this.learningService);

    this.scanCache = new ScanCache();
    this.scanProfileManager = new ScanProfileManager();
    this.filePreviewManager = new FilePreviewManager();
    this.scanController = new ScanController();
    this.scanFilter = new ScanFilter();
    this.configManager = new ConfigManager();
    this.analyticsManager = new AnalyticsManager();
    this.errorLogger = getErrorLogger();

    // Setup global error handlers
    this.setupGlobalErrorHandlers();

    // Initialize database
    this.knowledgeDB = null;
    this.dbInitializationPromise = this.initializeDatabase();

    try {
      const { WorkerPool } = require("../worker-pool");
      this.workerPool = new WorkerPool({
        numWorkers: require("../config/dynamic-config").workerCount,
        workerScript: path.join(__dirname, "../worker.js"),
      });
    } catch (e) {
      this.workerPool = null;
    }

    this.isValidPath = isValidPath;
    this.normalizePath = normalizePath;

    this.initDirectories();
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
  }

  async initDirectories() {
    const uploadDir = path.join(__dirname, "uploads");
    if (!existsSync(uploadDir)) await fsPromises.mkdir(uploadDir, { recursive: true });
  }

  setupSecurity() {
    setupSecurity(this.app);
  }
  setupMiddleware() {
    setupMiddleware(this.app);
  }

  setupRoutes() {
    this.routesManager = new RoutesManager(this);
    this.routesManager.mountAll(this.app);

    // Diagnostic endpoint to verify routes
    this.app.get("/api/debug/routes", (req, res) => {
      const routes = [];
      this.app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          // Routes registered directly on the app
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods),
          });
        } else if (middleware.name === "router") {
          // Routes registered via router
          middleware.handle.stack.forEach((handler) => {
            if (handler.route) {
              const path = handler.route.path;
              const fullPath = "/api" + path;
              routes.push({
                path: fullPath,
                methods: Object.keys(handler.route.methods),
              });
            }
          });
        }
      });
      res.json({
        success: true,
        count: routes.length,
        routes: routes.filter((r) => r.path.includes("error")),
      });
    });

    // Setup error handling middleware (must be after all routes)
    this.setupErrorHandling();
  }

  setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on("uncaughtException", async (error) => {
      await this.errorLogger.logUncaughtException(error);
      console.error("💥 Uncaught Exception:", error);
      // Give time for log to flush before exiting
      setTimeout(() => process.exit(1), 1000);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", async (reason, promise) => {
      await this.errorLogger.logUnhandledRejection(reason, promise);
      console.error("⚠️ Unhandled Rejection:", reason);
    });

    // Handle warnings
    process.on("warning", (warning) => {
      console.warn("⚡ Node.js Warning:", warning.name, warning.message);
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res, next) => {
      res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Endpoint ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    this.app.use(async (error, req, res, next) => {
      // Log the error
      await this.errorLogger.logRequestError(error, req, res, {
        body: req.body,
        params: req.params,
      });

      // Don't leak error details in production
      const isDev = process.env.NODE_ENV === "development";

      res.status(error.status || 500).json({
        success: false,
        error: error.message || "Internal Server Error",
        ...(isDev && { stack: error.stack }),
        errorId: await this.errorLogger.logError(error, { source: "express_final_handler" }),
      });
    });
  }

  async initializeAsync() {
    await this.learningService.initialize();
    await this.checkOllamaAvailability();
    await this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      // Check if database is already initialized
      if (this.knowledgeDB && this.knowledgeDB.db) {
        console.log("✅ Database already initialized, skipping...");
        return true;
      }

      console.log("🔄 Initializing database...");
      const KnowledgeDatabase = require("../KnowledgeDatabase");

      // Ensure data directory exists
      const dataDir = path.join(__dirname, "..", "data");
      if (!existsSync(dataDir)) {
        console.log(`📁 Creating data directory: ${dataDir}`);
        await fsPromises.mkdir(dataDir, { recursive: true });
      }

      const dbPath = path.join(dataDir, "space-analyzer.db");
      console.log(`📚 Database path: ${dbPath}`);

      this.knowledgeDB = new KnowledgeDatabase(dbPath);

      // Wait a moment for database to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test database connection
      if (this.knowledgeDB.db) {
        console.log("✅ KnowledgeDatabase initialized successfully");
        console.log(`📊 Database file: ${dbPath}`);

        // Check database stats
        const stats = await fsPromises.stat(dbPath).catch(() => ({ size: 0 }));
        const sizeMB = stats.size / (1024 * 1024);
        console.log(`📈 Database size: ${sizeMB.toFixed(2)} MB`);

        return true;
      } else {
        console.error("❌ Database initialization failed - no database object");
        return false;
      }
    } catch (error) {
      console.error("❌ Failed to initialize KnowledgeDatabase:", error);
      this.knowledgeDB = null;
      return false;
    }
  }

  async checkOllamaAvailability() {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: 11434,
          path: "/api/tags",
          method: "GET",
          timeout: 2000,
        },
        (res) => {
          if (res.statusCode === 200) this.ollamaAvailable = true;
          resolve();
        }
      );
      req.on("error", () => {
        this.ollamaAvailable = false;
        resolve();
      });
      req.on("timeout", () => {
        req.destroy();
        resolve();
      });
      req.end();
    });
  }
}

const app = new SpaceAnalyzerAPIServer();
module.exports = { SpaceAnalyzerAPIServer, app };

if (require.main === module) {
  (async () => {
    const portDetector = new PortDetector(app.port);
    const availablePort = await portDetector.findAvailablePort();
    app.port = availablePort;

    const { logConfig } = require("../config/dynamic-config");
    await logConfig();

    const server = http.createServer(app.app);
    setupWebSocketServer(server);

    server.listen(app.port, () => {
      console.log(`🚀 Space Analyzer Backend running on port ${app.port}`);
      app.initializeAsync();
    });
  })();
}
