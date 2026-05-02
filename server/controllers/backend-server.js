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

  setupSecurity() { setupSecurity(this.app); }
  setupMiddleware() { setupMiddleware(this.app); }
  
  setupRoutes() {
    this.routesManager = new RoutesManager(this);
    this.routesManager.mountAll(this.app);
  }

  async initializeAsync() {
    await this.learningService.initialize();
    await this.checkOllamaAvailability();
  }

  async checkOllamaAvailability() {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: "localhost",
        port: 11434,
        path: "/api/tags",
        method: "GET",
        timeout: 2000,
      }, (res) => {
        if (res.statusCode === 200) this.ollamaAvailable = true;
        resolve();
      });
      req.on("error", () => { this.ollamaAvailable = false; resolve(); });
      req.on("timeout", () => { req.destroy(); resolve(); });
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

    const server = http.createServer(app.app);
    setupWebSocketServer(server);

    server.listen(app.port, () => {
      console.log(`🚀 Space Analyzer Backend running on port ${app.port}`);
      app.initializeAsync();
    });
  })();
}
