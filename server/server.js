/**
 * Space Analyzer - Unified Backend Server
 * Single, clean server implementation replacing backend-server.js and src/app.js
 */

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

    this.initialize();
  }

  initialize() {
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupHealthChecks();
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
            connectSrc: ["'self'", "http:", "https:", "ws:", "wss:"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    this.app.use(
      cors({
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      })
    );
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
      knowledgeDB: null,
      errorLogger: this.errorLogger,
      activeAnalyses: new Map(),
      analysisResults: new Map(),
      isValidPath,
      normalizePath,
    };

    // Use RoutesManager for all /api routes
    const routesManager = new RoutesManager(mockServer);
    routesManager.mountAll(this.app);

    // Debug endpoint - list all registered routes
    this.app.get("/api/debug/routes", (req, res) => {
      const routes = [];
      this.app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods),
          });
        } else if (middleware.name === "router") {
          middleware.handle.stack.forEach((handler) => {
            if (handler.route) {
              routes.push({
                path: "/api" + handler.route.path,
                methods: Object.keys(handler.route.methods),
              });
            }
          });
        }
      });
      res.json({ success: true, count: routes.length, routes });
    });

    // Serve frontend (catch-all for non-API routes)
    this.app.get("/", (req, res) => {
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
    // Basic health check
    this.app.get("/api/health", (req, res) => {
      res.json({
        success: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
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
        error: error.message || "Internal Server Error",
        ...(isDev && { stack: error.stack }),
      });
    });

    // Process error handlers
    process.on("uncaughtException", async (error) => {
      await this.errorLogger.logUncaughtException(error);
      console.error("💥 Uncaught Exception:", error);
      setTimeout(() => process.exit(1), 1000);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      await this.errorLogger.logUnhandledRejection(reason, promise);
      console.error("⚠️ Unhandled Rejection:", reason);
    });
  }

  start() {
    const server = http.createServer(this.app);

    server.listen(this.port, () => {
      console.log(`\n🚀 Space Analyzer Server running on port ${this.port}`);
      console.log(`📊 Health check: http://localhost:${this.port}/api/health`);
      console.log(`🔍 Debug routes: http://localhost:${this.port}/api/debug/routes\n`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n🛑 ${signal} received, shutting down...`);
      server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}

// Start server
const app = new SpaceAnalyzerServer();
app.start();

module.exports = SpaceAnalyzerServer;
