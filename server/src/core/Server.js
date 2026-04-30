/**
 * Core Server Module
 * Minimal Express server setup with essential middleware and configuration
 * Refactored from backend-server.js to reduce complexity
 */

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const path = require("path");
const http = require("http");
const { EventEmitter } = require("events");

// Configuration - default port if ports.config.js not available
const DEFAULT_PORT = 8080;

class Server {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || DEFAULT_PORT;
    this.isDevelopment = process.env.NODE_ENV !== "production";
    this.eventEmitter = new EventEmitter();
    this.server = null;
    this.wss = null;

    // State management
    this.activeAnalyses = new Map();
    this.analysisResults = new Map();
    this.analysisCache = new Map();
    this.serverStartTime = Date.now();

    // Configuration object
    this.config = {
      port: this.port,
      ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
      defaultModel: "gemma3:latest",
      setPort(newPort) {
        this.port = newPort;
      },
    };

    this.initialize();
  }

  initialize() {
    this.setupSecurity();
    this.setupMiddleware();
    this.setupErrorHandling();
  }

  setupSecurity() {
    // Basic security headers
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

    // CORS
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
    // Compression
    this.app.use(
      compression({
        level: 6,
        threshold: 1024,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    // Static files
    this.app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

    // Request logging in development
    if (this.isDevelopment) {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error("Server error:", err);
      res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        ...(this.isDevelopment && { stack: err.stack }),
      });
    });
  }

  /**
   * Mount routes from a RoutesManager instance
   */
  mountRoutes(routesManager) {
    if (routesManager && typeof routesManager.mountAll === "function") {
      routesManager.mountAll(this.app);
    }
  }

  /**
   * Add a one-off route (for simple endpoints)
   */
  addRoute(method, path, handler) {
    this.app[method](path, handler);
  }

  /**
   * Get HTTP server instance (for WebSocket attachment)
   */
  getHTTPServer() {
    if (!this.server) {
      this.server = http.createServer(this.app);
    }
    return this.server;
  }

  /**
   * Start the server
   */
  async start(callback) {
    return new Promise((resolve, reject) => {
      const server = this.getHTTPServer();

      server.listen(this.port, (err) => {
        if (err) {
          console.error("❌ Failed to start server:", err);
          reject(err);
          return;
        }

        console.log(`🚀 Server running on port ${this.port}`);
        console.log(`📡 Environment: ${this.isDevelopment ? "development" : "production"}`);

        if (callback) callback();
        resolve(server);
      });

      // Graceful shutdown
      const shutdown = (signal) => {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        server.close(() => {
          console.log("Server closed");
          process.exit(0);
        });

        setTimeout(() => {
          console.log("Forcing shutdown");
          process.exit(1);
        }, 10000);
      };

      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
    });
  }

  /**
   * Get active analyses Map (for external services)
   */
  getActiveAnalyses() {
    return this.activeAnalyses;
  }

  /**
   * Get analysis results Map (for external services)
   */
  getAnalysisResults() {
    return this.analysisResults;
  }

  /**
   * Get analysis cache Map (for external services)
   */
  getAnalysisCache() {
    return this.analysisCache;
  }

  /**
   * Get event emitter (for progress updates)
   */
  getEventEmitter() {
    return this.eventEmitter;
  }

  /**
   * Broadcast to WebSocket clients (placeholder - actual implementation in WebSocketService)
   */
  broadcast(data) {
    this.eventEmitter.emit("broadcast", data);
  }
}

module.exports = Server;
