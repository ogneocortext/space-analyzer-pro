const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { promises: fsPromises } = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { existsSync, statSync, createReadStream, createWriteStream } = require("fs");
const { spawn, exec } = require("child_process");
const { EventEmitter } = require("events");
const os = require("os");
const crypto = require("crypto");
const http = require("http");
const cluster = require("cluster");
const compression = require("compression");
const helmet = require("helmet");
const diskusage = require("diskusage");
const filesize = require("filesize");
const { errorHandler, asyncHandler } = require("../utils/errorHandler");
const PerformanceMonitor = require("../utils/performanceMonitor");
const PortDetector = require("../utils/port-detector");
const EnhancedOllamaService = require("../services/EnhancedOllamaService");
const WebSocket = require("ws");

// Import other required services
const SelfLearningSystem = require("../SelfLearningSystem");
const KnowledgeDatabase = require("../KnowledgeDatabase");
// const MultiAgentOrchestrator = require("../src/integration/multi-agent-orchestrator.cjs"); // Not found
// const ollamaService = require("../src/integration/ollama-service.cjs"); // Not found
// const dependencyScanner = require("../src/integration/dependency-scanner.cjs"); // Not found
const ScanCache = require("../scan-cache");
const { ScanProfileManager } = require("../scan-profiles");
const FilePreviewManager = require("../file-preview");
const ScanController = require("./scan-controller");
const ScanFilter = require("../scan-filter");
const ConfigManager = require("../utils/config-manager");
const AnalyticsManager = require("../analytics");
const DuplicateDetector = require("../modules/duplicate-detector");

// Import modules
const { setupSecurity, setupMiddleware } = require("../modules/security");
const { setupWebSocketServer, broadcast, getClients, getServer } = require("../modules/websocket");
const RoutesManager = require("../routes");
const ScanTestController = require("./scan-test");
const FixedScanController = require("./scan-fixed");
const OptimizedScanController = require("./scan-optimized");

// Get WebSocket clients from module
const wsClients = getClients();

// Import independent utility functions
const {
  formatBytes,
  convertToCSV,
  convertToTXT,
  convertCategoryDistribution,
  convertExtensionDistribution,
} = require("../modules/data-conversion");
const {
  findProjectRoot,
  isValidPath,
  normalizePath,
  generateFileHash,
  getDirectoryFilesQuick,
} = require("../modules/file-utils");
let wss = null;
let server = null;

class SpaceAnalyzerAPIServer {
  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT) || 8080;
    this.isDevelopment = process.env.NODE_ENV !== "production";
    this.activeAnalyses = new Map();
    this.analysisResults = new Map();
    this.analysisCache = new Map();
    this.serverStartTime = Date.now();
    this.eventEmitter = new EventEmitter();

    // Bind broadcast function to class instance
    this.broadcast = broadcast;
    this.ollamaAvailable = false;

    // Ollama and self-learning properties
    this.ollamaProcess = null;
    this.ollamaModels = [];
    this.currentModel = "gemma3:latest";
    this.selfLearningData = new Map();
    this.interactionHistory = [];
    this.modelPerformance = new Map();
    this.hardwareWearReduction = true;
    this.ollamaServerStarted = false;

    // Event emitter for progress updates

    // Broadcast progress events to WebSocket clients
    this.eventEmitter.on("progress", (progressData) => {
      console.log("📡 Broadcasting progress:", progressData);
      broadcast({
        type: "progress",
        ...progressData,
        timestamp: new Date().toISOString(),
      });
    });

    // Initialize systems
    this.selfLearning = new SelfLearningSystem(path.join(__dirname, "learning"));
    this.knowledgeDB = new KnowledgeDatabase(path.join(__dirname, "knowledge.db"));
    this.ollamaAvailable = false;

    // Initialize orchestrator (commented out - module not found)
    // this.orchestrator = new MultiAgentOrchestrator();

    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor();

    // Initialize Ollama service
    this.ollamaService = new EnhancedOllamaService();

    // Initialize scan cache
    this.scanCache = new ScanCache();

    // Initialize scan profile manager
    this.scanProfileManager = new ScanProfileManager();

    // Initialize file preview manager
    this.filePreviewManager = new FilePreviewManager();

    // Initialize scan controller
    this.scanController = new ScanController();

    // Initialize scan filter
    this.scanFilter = new ScanFilter();

    // Initialize configuration manager
    this.configManager = new ConfigManager();

    // Initialize analytics manager
    this.analyticsManager = new AnalyticsManager();

    // Initialize worker pool for parallel processing
    try {
      const { WorkerPool } = require("../worker-pool");
      this.workerPool = new WorkerPool({
        numWorkers: require("../config/dynamic-config").workerCount,
        workerScript: path.join(__dirname, "../worker.js"),
      });
      console.log(`✅ Worker pool initialized with ${this.workerPool.numWorkers} workers`);
    } catch (error) {
      console.log("⚠️  Worker pool initialization failed, using main thread:", error.message);
      this.workerPool = null;
    }

    // WebSocket server (handled externally in startup code)
    // this.setupWebSocketServer();

    // Initialize active analyses map for progress tracking
    this.activeAnalyses = new Map();

    this.isValidPath = isValidPath;
    this.normalizePath = normalizePath;

    this.initDirectories();
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeSelfLearning();
  }

  async initDirectories() {
    const uploadDir = path.join(__dirname, "uploads");
    const projectsDir = path.join(__dirname, "projects");
    if (!existsSync(uploadDir)) await fsPromises.mkdir(uploadDir, { recursive: true });
    if (!existsSync(projectsDir)) await fsPromises.mkdir(projectsDir, { recursive: true });
  }

  async initializeAsync() {
    await this.loadSelfLearningData();
    await this.checkOllamaAvailability();
    if (!this.ollamaAvailable) {
      await this.startOllamaIfNeeded();
    } else {
      await this.loadOllamaModels();
    }
  }

  setupSecurity() {
    setupSecurity(this.app);
  }

  setupMiddleware() {
    setupMiddleware(this.app);

    // Add error handler for JSON parse errors
    this.app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        console.error("❌ JSON Parse Error:", err.message);
        console.error("   Request path:", req.path);
        console.error("   Request method:", req.method);
        console.error("   Content-Type:", req.get("Content-Type"));
        return res.status(400).json({
          success: false,
          error: "Invalid JSON in request body",
          details: err.message,
        });
      }
      next(err);
    });
  }

  // Ollama Server Management
  async startOllamaIfNeeded() {
    try {
      // Check if Ollama is already running
      await this.checkOllamaAvailability();
      if (this.ollamaAvailable) {
        await this.loadOllamaModels();
        return;
      }

      // Try to start Ollama server
      console.log("🔄 Attempting to start Ollama server...");
      this.ollamaProcess = spawn("ollama", ["serve"], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.ollamaServerStarted = true;

      // Wait for server to start
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds

      const checkServer = async () => {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          await this.checkOllamaAvailability();
          if (this.ollamaAvailable) {
            console.log("✅ Ollama server started successfully");
            await this.loadOllamaModels();
            return;
          }
        } catch (error) {
          // Continue checking
        }

        if (attempts < maxAttempts) {
          checkServer();
        } else {
          console.log("⚠️ Failed to start Ollama server - using basic AI insights");
        }
      };

      checkServer();

      // Handle process events
      if (this.ollamaProcess) {
        this.ollamaProcess.on("close", (code) => {
          console.log(`Ollama process exited with code ${code}`);
          this.ollamaAvailable = false;
          this.ollamaServerStarted = false;
        });

        this.ollamaProcess.on("error", (error) => {
          console.error("Ollama process error:", error);
          this.ollamaAvailable = false;
          this.ollamaServerStarted = false;
        });
      }
    } catch (error) {
      console.log("⚠️ Could not start Ollama server - using basic AI insights");
    }
  }

  async checkOllamaAvailability() {
    return new Promise((resolve) => {
      try {
        const http = require("http");
        const req = http.request(
          {
            hostname: "localhost",
            port: 11434,
            path: "/api/tags",
            method: "GET",
            timeout: 5000,
          },
          (res) => {
            // Consume response data to prevent hanging
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              if (res.statusCode === 200) {
                this.ollamaAvailable = true;
                console.log("🦙 Ollama is available - AI features enhanced");
              }
              resolve();
            });
          }
        );
        req.on("error", () => {
          this.ollamaAvailable = false;
          console.log("⚠️ Ollama not available - using basic AI insights");
          resolve();
        });
        req.on("timeout", () => {
          this.ollamaAvailable = false;
          console.log("⚠️ Ollama check timed out - using basic AI insights");
          req.destroy();
          resolve();
        });
        req.end();
      } catch (e) {
        this.ollamaAvailable = false;
        console.log("⚠️ Ollama check failed - using basic AI insights");
        resolve();
      }
    });
  }

  async loadOllamaModels() {
    try {
      const models = await this.queryOllamaAPI("tags");
      if (models && models.models) {
        this.ollamaModels = models.models.map((m) => m.name);
        console.log(
          `📚 Loaded ${this.ollamaModels.length} Ollama models:`,
          this.ollamaModels.join(", ")
        );

        // Initialize model performance tracking
        this.ollamaModels.forEach((model) => {
          if (!this.modelPerformance.has(model)) {
            this.modelPerformance.set(model, {
              totalQueries: 0,
              successfulQueries: 0,
              averageResponseTime: 0,
              lastUsed: null,
              complexityScores: [],
            });
          }
        });
      }
    } catch (error) {
      console.log("⚠️ Could not load Ollama models:", error.message);
      // Fallback to known models based on our curl test
      this.ollamaModels = [
        "gemma3:latest",
        "llava:latest",
        "deepseek-coder:6.7b",
        "codegemma:7b-instruct",
        "qwen2.5-coder:7b-instruct",
      ];
      console.log("🔄 Using fallback model list:", this.ollamaModels.join(", "));

      // Initialize performance tracking for fallback models
      this.ollamaModels.forEach((model) => {
        if (!this.modelPerformance.has(model)) {
          this.modelPerformance.set(model, {
            totalQueries: 0,
            successfulQueries: 0,
            averageResponseTime: 0,
            lastUsed: null,
            complexityScores: [],
          });
        }
      });
    }
  }

  // Enhanced Model Selection with Query Classification
  selectOptimalModel(query, analysisData) {
    if (!this.ollamaModels.length) return "gemma3:latest";

    // Classify query intent
    const queryType = this.classifyQuery(query);
    const complexity = this.calculateQueryComplexity(query, analysisData);

    console.log(`🎯 Query type: ${queryType}, Complexity: ${complexity.toFixed(2)}`);

    // Model selection based on query type and complexity
    let bestModel = "gemma3:latest";
    let bestScore = -1;

    for (const model of this.ollamaModels) {
      const perf = this.modelPerformance.get(model);
      if (!perf) continue;

      let score = 0;

      // Query type matching
      switch (queryType) {
        case "code_analysis":
        case "technical":
          // Prefer code-specialized models
          if (model.includes("coder") || model.includes("codegemma") || model.includes("qwen")) {
            score += 5;
          } else if (model.includes("gemma3")) {
            score += 2;
          }
          break;

        case "file_search":
        case "optimization":
          // Prefer fast, general-purpose models
          if (model.includes("gemma3")) {
            score += 4;
          } else if (model.includes("coder")) {
            score += 2;
          }
          break;

        case "general":
        default:
          // Prefer gemma3 for general questions
          if (model.includes("gemma3")) {
            score += 4;
          } else {
            score += 1;
          }
          break;
      }

      // Complexity bonus
      if (complexity > 0.7 && (model.includes("coder") || model.includes("qwen"))) {
        score += 2; // High complexity benefits from specialized models
      }

      // Performance bonus (prefer faster, more reliable models)
      if (perf.successfulQueries > 0) {
        const successRate = perf.successfulQueries / perf.totalQueries;
        score += successRate * 2;

        if (perf.averageResponseTime < 5000) score += 1; // Fast response bonus
      }

      // Hardware wear reduction (avoid overusing the same model)
      const timeSinceLastUse = perf.lastUsed ? Date.now() - perf.lastUsed : Infinity;
      if (timeSinceLastUse > 300000) score += 1; // 5 minute cooldown bonus

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }

    console.log(`🤖 Auto-selected model: ${bestModel} (score: ${bestScore.toFixed(2)})`);
    return bestModel;
  }

  // Classify query to determine intent
  classifyQuery(query) {
    const lowerQuery = query.toLowerCase();

    // Code/Technical Analysis
    const codeTerms = [
      "function",
      "class",
      "method",
      "code",
      "import",
      "dependency",
      "dependencies",
      "refactor",
      "algorithm",
      "complexity",
      "performance",
      "optimize",
    ];
    if (codeTerms.some((term) => lowerQuery.includes(term))) {
      return "code_analysis";
    }

    // File Search
    const searchTerms = ["find", "search", "locate", "where", "which files", "show me"];
    if (searchTerms.some((term) => lowerQuery.includes(term))) {
      return "file_search";
    }

    // Optimization
    const optimizeTerms = ["reduce", "save", "free up", "delete", "remove", "clean", "optimize"];
    if (optimizeTerms.some((term) => lowerQuery.includes(term))) {
      return "optimization";
    }

    // Technical questions
    const techTerms = ["why", "how", "explain", "what is", "memory", "storage", "disk"];
    if (techTerms.some((term) => lowerQuery.includes(term))) {
      return "technical";
    }

    return "general";
  }

  calculateQueryComplexity(query, analysisData) {
    let complexity = 0;

    // Query length and technical terms
    const technicalTerms = [
      "optimize",
      "refactor",
      "performance",
      "memory",
      "storage",
      "dependencies",
      "complexity",
      "algorithm",
    ];
    const words = query.toLowerCase().split(" ");
    complexity += words.length * 0.1;
    complexity += technicalTerms.filter((term) => query.toLowerCase().includes(term)).length * 0.2;

    // Analysis data complexity
    if (analysisData) {
      const fileCount = analysisData.totalFiles || 0;
      const sizeGB = (analysisData.totalSize || 0) / (1024 * 1024 * 1024);

      if (fileCount > 10000) complexity += 0.3;
      else if (fileCount > 1000) complexity += 0.2;
      else if (fileCount > 100) complexity += 0.1;

      if (sizeGB > 10) complexity += 0.3;
      else if (sizeGB > 1) complexity += 0.2;
      else if (sizeGB > 0.1) complexity += 0.1;

      // File type diversity
      const categories = Object.keys(analysisData.categories || {});
      complexity += Math.min(categories.length * 0.05, 0.3);
    }

    return Math.min(complexity, 1.0); // Cap at 1.0
  }

  // Self-Learning System
  initializeSelfLearning() {
    // Initialize learning directories
    const learningDir = path.join(__dirname, "learning");
    const cacheDir = path.join(learningDir, "cache");
    const historyDir = path.join(learningDir, "history");

    if (!existsSync(learningDir)) fsPromises.mkdir(learningDir, { recursive: true });
    if (!existsSync(cacheDir)) fsPromises.mkdir(cacheDir, { recursive: true });
    if (!existsSync(historyDir)) fsPromises.mkdir(historyDir, { recursive: true });
  }

  async loadSelfLearningData() {
    try {
      const learningDir = path.join(__dirname, "learning");
      const cacheFile = path.join(learningDir, "cache.json");
      const historyFile = path.join(learningDir, "history.json");

      if (existsSync(cacheFile)) {
        const cacheData = JSON.parse(await fsPromises.readFile(cacheFile, "utf8"));
        this.selfLearningData = new Map(Object.entries(cacheData));
        console.log(`🧠 Loaded ${this.selfLearningData.size} cached responses`);
      }

      if (existsSync(historyFile)) {
        this.interactionHistory = JSON.parse(await fsPromises.readFile(historyFile, "utf8"));
        console.log(`📚 Loaded ${this.interactionHistory.length} interaction records`);
      }
    } catch (error) {
      console.log("⚠️ Could not load learning data:", error.message);
    }
  }

  async saveSelfLearningData() {
    try {
      const learningDir = path.join(__dirname, "learning");
      const cacheFile = path.join(learningDir, "cache.json");
      const historyFile = path.join(learningDir, "history.json");

      // Save cache (convert Map to object)
      const cacheObject = Object.fromEntries(this.selfLearningData);
      await fsPromises.writeFile(cacheFile, JSON.stringify(cacheObject, null, 2));

      // Save history
      await fsPromises.writeFile(historyFile, JSON.stringify(this.interactionHistory, null, 2));

      console.log("💾 Learning data saved");
    } catch (error) {
      console.log("⚠️ Could not save learning data:", error.message);
    }
  }

  // Generate cache key for queries
  generateCacheKey(query, analysisData, model) {
    const dataHash = crypto
      .createHash("md5")
      .update(
        JSON.stringify({
          query,
          totalFiles: analysisData.totalFiles,
          totalSize: analysisData.totalSize,
          categories: Object.keys(analysisData.categories || {}),
          model,
        })
      )
      .digest("hex");
    return dataHash;
  }

  // Check self-learning cache first
  async checkSelfLearningCache(query, analysisData, model) {
    if (!this.hardwareWearReduction) return null;

    const cacheKey = this.generateCacheKey(query, analysisData, model);
    const cached = this.selfLearningData.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      // 24 hours
      console.log("🎯 Using cached response (hardware protection)");
      return cached.response;
    }

    return null;
  }

  // Store response in self-learning cache
  async storeSelfLearningResponse(query, analysisData, model, response) {
    const cacheKey = this.generateCacheKey(query, analysisData, model);
    const learningEntry = {
      timestamp: Date.now(),
      query,
      model,
      response,
      analysisFingerprint: {
        totalFiles: analysisData.totalFiles,
        totalSize: analysisData.totalSize,
        categories: Object.keys(analysisData.categories || {}),
      },
    };

    this.selfLearningData.set(cacheKey, learningEntry);

    // Limit cache size to prevent memory issues
    if (this.selfLearningData.size > 1000) {
      const oldestKey = Array.from(this.selfLearningData.keys())[0];
      this.selfLearningData.delete(oldestKey);
    }

    // Save periodically
    if (Math.random() < 0.1) {
      // 10% chance to save
      await this.saveSelfLearningData();
    }
  }

  // Record interaction for learning
  recordInteraction(query, analysisData, model, response, responseTime, success) {
    const interaction = {
      timestamp: Date.now(),
      query,
      model,
      responseTime,
      success,
      analysisFingerprint: {
        totalFiles: analysisData.totalFiles,
        totalSize: analysisData.totalSize,
        categories: Object.keys(analysisData.categories || {}),
      },
      responseLength: response ? response.length : 0,
    };

    this.interactionHistory.push(interaction);

    // Update model performance
    const perf = this.modelPerformance.get(model) || {
      totalQueries: 0,
      successfulQueries: 0,
      averageResponseTime: 0,
      lastUsed: null,
      complexityScores: [],
    };

    perf.totalQueries++;
    if (success) perf.successfulQueries++;
    perf.lastUsed = Date.now();

    // Update average response time
    const alpha = 0.1; // Learning rate
    perf.averageResponseTime = perf.averageResponseTime * (1 - alpha) + responseTime * alpha;

    // Store complexity score
    const complexity = this.calculateQueryComplexity(query, analysisData);
    perf.complexityScores.push(complexity);
    if (perf.complexityScores.length > 100) {
      perf.complexityScores = perf.complexityScores.slice(-100);
    }

    this.modelPerformance.set(model, perf);

    // Limit history size
    if (this.interactionHistory.length > 10000) {
      this.interactionHistory = this.interactionHistory.slice(-10000);
    }
  }

  setupRoutes() {
    // Initialize modular routes
    this.routesManager = new RoutesManager(this);
    this.routesManager.mountAll(this.app);

    // Add scan test controller for direct testing
    const scanTestController = new ScanTestController();
    this.app.use("/api/scan-test", scanTestController.getRouter());

    // Add fixed scan controller
    const fixedScanController = new FixedScanController();
    this.app.use("/api/scan-fixed", fixedScanController.getRouter());

    // Add optimized scan controller
    const optimizedScanController = new OptimizedScanController();
    this.app.use("/api/scan-optimized", optimizedScanController.getRouter());

    // Add debug route to verify API is working
    this.app.get("/api/debug/routes", (req, res) => {
      res.json({
        routes: Object.keys(this.routesManager.routes),
        message: "Routes loaded successfully",
      });
    });

    // Health check endpoint (keep simple endpoint here)
    this.app.get("/api/health", (req, res) => {
      const dynamicConfig = require("../config/dynamic-config");
      res.json({
        status: "ok",
        timestamp: new Date(),
        backend: true,
        websocket: wsClients.size > 0,
        ollama: this.ollamaAvailable,
        uptime: process.uptime(),
        requests: this.requestCount || 0,
        errors: this.errorCount || 0,
        system: {
          cpu: os.cpus().length,
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: process.memoryUsage(),
          },
          platform: os.platform(),
          nodeVersion: process.version,
        },
        workers: {
          configured: dynamicConfig.workerCount,
          memoryPerWorker: dynamicConfig.workerMemoryMB,
          active: this.workerPool !== null,
          stats: this.workerPool ? this.workerPool.getStats() : null,
          message: this.workerPool
            ? "Worker pool active - using parallel processing"
            : "Worker pool not initialized - using main thread for processing",
        },
      });
    });

    // ==========================================
    // Multi-Agent Orchestrator API Endpoints
    // ==========================================

    // Orchestrator analysis endpoint (simplified single-call analysis)
    this.app.post("/api/orchestrate/analyze", async (req, res) => {
      try {
        // Log incoming request for debugging
        console.log(`📥 Received analyze request`);
        console.log(`   Body type: ${typeof req.body}`);
        console.log(`   Body keys: ${req.body ? Object.keys(req.body).join(", ") : "null"}`);

        const { directoryPath, options = {} } = req.body;

        if (!directoryPath) {
          console.error("❌ Missing directoryPath in request");
          return res.status(400).json({
            success: false,
            error: "directoryPath is required",
          });
        }

        // Generate analysis ID for progress tracking
        const analysisId = `orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log(`🎯 Orchestrator analyzing: ${directoryPath} (ID: ${analysisId})`);

        // Set initial progress
        this.activeAnalyses.set(analysisId, {
          analysisId,
          files: 0,
          filesProcessed: 0,
          totalSize: 0,
          percentage: 0,
          currentFile: "Starting orchestrator analysis...",
          status: "starting",
          completed: false,
          startTime: Date.now(),
          success: true,
          progress: {
            filesProcessed: 0,
            totalSize: 0,
            percentage: 0,
            currentFile: "Starting...",
            status: "starting",
          },
        });

        // Emit initial progress
        this.eventEmitter.emit("progress", {
          analysisId,
          files: 0,
          filesProcessed: 0,
          totalSize: 0,
          percentage: 0,
          currentFile: "Starting orchestrator analysis...",
          status: "starting",
        });

        // Run analysis in background with progress updates
        this.orchestrator
          .analyzeDirectory(directoryPath, {
            ai: options.useOllama || false,
            priority: options.priority || PRIORITY.NORMAL,
            parallel: options.parallel !== false,
          })
          .then((result) => {
            // Update progress to complete
            const finalProgress = {
              analysisId,
              files: result.total_files || 0,
              filesProcessed: result.total_files || 0,
              totalSize: result.total_size || 0,
              percentage: 100,
              currentFile: "Analysis complete",
              status: "complete",
              completed: true,
              progress: {
                filesProcessed: result.total_files || 0,
                totalSize: result.total_size || 0,
                percentage: 100,
                currentFile: "Analysis complete",
                status: "complete",
              },
            };

            this.activeAnalyses.set(analysisId, finalProgress);
            this.eventEmitter.emit("progress", finalProgress);
          })
          .catch((error) => {
            console.error("Orchestrator analysis error:", error);
            const errorProgress = {
              analysisId,
              files: 0,
              filesProcessed: 0,
              totalSize: 0,
              percentage: 0,
              currentFile: `Error: ${error.message}`,
              status: "failed",
              completed: true,
              error: error.message,
            };
            this.activeAnalyses.set(analysisId, errorProgress);
            this.eventEmitter.emit("progress", errorProgress);
          });

        // Return immediately with analysis ID
        res.json({
          success: true,
          analysisId,
          message: "Analysis started",
          meta: {
            orchestrated: true,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Orchestrator analysis failed:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
          success: false,
          error: error.message || "Analysis failed",
        });
      }
    });

    // Orchestrator health/status endpoint
    this.app.get("/api/orchestrate/status", (req, res) => {
      res.json({
        success: true,
        orchestrator: this.orchestrator.getHealth(),
        timestamp: new Date().toISOString(),
      });
    });

    // Cache management endpoints
    this.app.post("/api/orchestrate/cache/invalidate", (req, res) => {
      const { pattern } = req.body;
      const count = this.orchestrator.cache.invalidate(pattern || "");
      res.json({ success: true, invalidated: count });
    });

    this.app.get("/api/orchestrate/cache/metrics", (req, res) => {
      res.json({
        success: true,
        cache: this.orchestrator.cache.getMetrics(),
      });
    });

    // Cache TTL configuration endpoint (Step 2: Tune cache TTL)
    this.app.post("/api/orchestrate/cache/config", (req, res) => {
      const { ttl, maxSize } = req.body;
      const updates = {};

      if (ttl && typeof ttl === "number" && ttl > 0) {
        this.orchestrator.cache.defaultTTL = ttl;
        updates.ttl = ttl;
      }

      if (maxSize && typeof maxSize === "number" && maxSize > 0) {
        this.orchestrator.cache.maxSize = maxSize;
        updates.maxSize = maxSize;
      }

      res.json({
        success: true,
        message: "Cache configuration updated",
        config: {
          ttl: this.orchestrator.cache.defaultTTL,
          maxSize: this.orchestrator.cache.maxSize,
          currentSize: this.orchestrator.cache.size,
        },
        updates,
      });
    });

    // AI insights endpoint for analyzed directories (Step 3: AI Insights)
    this.app.post("/api/orchestrate/insights", async (req, res) => {
      try {
        const { directoryPath } = req.body;

        if (!directoryPath) {
          return res.status(400).json({
            success: false,
            error: "directoryPath is required",
          });
        }

        console.log(`🧠 Generating AI insights for: ${directoryPath}`);

        // First check cache for existing analysis
        const cachedResult = this.orchestrator.cache.get(directoryPath);

        let analysisData;
        if (cachedResult) {
          analysisData = cachedResult;
          console.log("📋 Using cached analysis for AI insights");
        } else {
          // Run new analysis with AI enabled
          analysisData = await this.orchestrator.analyzeDirectory(directoryPath, {
            ai: true,
            priority: PRIORITY.HIGH,
            parallel: true,
          });
        }

        // Generate AI insights from the data
        const insights = {
          summary: {
            totalFiles: analysisData.total_files || 0,
            totalSize: analysisData.total_size || 0,
            topCategories: analysisData.categories
              ? Object.entries(analysisData.categories)
                  .sort((a, b) => b[1].size - a[1].size)
                  .slice(0, 5)
              : [],
            largestFiles: analysisData.large_files || [],
            duplicates: analysisData.duplicate_groups || [],
          },
          recommendations: analysisData.insights || [],
          storageOptimization: {
            potentialSavings: analysisData.duplicate_size || 0,
            compressionCandidates: analysisData.compression_candidates || [],
            oldFiles: analysisData.old_files || [],
          },
          security: {
            hiddenFiles: analysisData.hidden_files || [],
            executableCount: analysisData.executable_count || 0,
            scriptFiles: analysisData.script_files || [],
          },
        };

        res.json({
          success: true,
          insights,
          source: cachedResult ? "cache" : "fresh",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("AI insights generation failed:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // STEP 4: Circuit Breaker Status - Monitor agent health
    this.app.get("/api/orchestrate/agents/health", (req, res) => {
      try {
        const agentHealth = Array.from(this.orchestrator.agents.values()).map((agent) => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          state: agent.state,
          circuitBreaker: agent.circuitBreaker.getHealth(),
          metrics: agent.metrics,
          isAvailable: agent.state === "IDLE" && agent.circuitBreaker.state !== "OPEN",
          lastUsed: agent.metrics.lastUsed,
        }));

        const summary = {
          total: agentHealth.length,
          available: agentHealth.filter((a) => a.isAvailable).length,
          busy: agentHealth.filter((a) => a.state === "BUSY").length,
          unhealthy: agentHealth.filter((a) => a.circuitBreaker.state === "OPEN").length,
          idle: agentHealth.filter((a) => a.state === "IDLE").length,
        };

        res.json({
          success: true,
          agents: agentHealth,
          summary,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // STEP 5: Task Queue Management - View and manage task queue
    this.app.get("/api/orchestrate/tasks", (req, res) => {
      try {
        const { status = "all", limit = 50 } = req.query;

        // Get tasks from orchestrator's task queue
        const taskQueue = this.orchestrator.taskQueue || { tasks: [] };
        const allTasks = Array.from(taskQueue.tasks || []);

        // Filter by status if specified
        let filteredTasks = allTasks;
        if (status !== "all") {
          filteredTasks = allTasks.filter((task) => task.status === status);
        }

        // Sort by priority (lower = higher priority) and creation time
        filteredTasks.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        // Apply limit
        const limitedTasks = filteredTasks.slice(0, parseInt(limit));

        // Get queue statistics
        const stats = {
          total: allTasks.length,
          pending: allTasks.filter((t) => t.status === "pending").length,
          active: allTasks.filter((t) => t.status === "active").length,
          completed: allTasks.filter((t) => t.status === "completed").length,
          failed: allTasks.filter((t) => t.status === "failed").length,
          byPriority: {
            critical: allTasks.filter((t) => t.priority === 0).length,
            high: allTasks.filter((t) => t.priority === 1).length,
            normal: allTasks.filter((t) => t.priority === 2).length,
            low: allTasks.filter((t) => t.priority === 3).length,
            background: allTasks.filter((t) => t.priority === 4).length,
          },
        };

        res.json({
          success: true,
          tasks: limitedTasks.map((task) => ({
            id: task.id,
            status: task.status,
            priority: task.priority,
            priorityLabel:
              ["CRITICAL", "HIGH", "NORMAL", "LOW", "BACKGROUND"][task.priority] || "UNKNOWN",
            data: task.data,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            assignedAgent: task.assignedAgent,
            result: task.result
              ? {
                  success: task.result.success,
                  hasData: !!task.result.data,
                }
              : null,
            error: task.error,
          })),
          stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Cancel a specific task
    this.app.post("/api/orchestrate/tasks/:taskId/cancel", (req, res) => {
      try {
        const { taskId } = req.params;
        const taskQueue = this.orchestrator.taskQueue;

        if (!taskQueue) {
          return res.status(400).json({
            success: false,
            error: "Task queue not available",
          });
        }

        // Find and cancel the task
        const taskIndex = taskQueue.tasks.findIndex((t) => t.id === taskId);
        if (taskIndex === -1) {
          return res.status(404).json({
            success: false,
            error: "Task not found",
          });
        }

        const task = taskQueue.tasks[taskIndex];
        if (task.status === "completed" || task.status === "failed") {
          return res.status(400).json({
            success: false,
            error: `Cannot cancel task with status: ${task.status}`,
          });
        }

        // Mark as cancelled
        task.status = "cancelled";
        task.cancelledAt = new Date().toISOString();

        res.json({
          success: true,
          message: "Task cancelled successfully",
          taskId,
          status: task.status,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // STEP 6: Batch Analysis - Analyze multiple directories at once
    this.app.post("/api/orchestrate/batch", async (req, res) => {
      try {
        const { directories, options = {} } = req.body;

        if (!Array.isArray(directories) || directories.length === 0) {
          return res.status(400).json({
            success: false,
            error: "directories must be a non-empty array",
          });
        }

        if (directories.length > 20) {
          return res.status(400).json({
            success: false,
            error: "Maximum 20 directories allowed per batch",
          });
        }

        console.log(`📦 Starting batch analysis of ${directories.length} directories`);

        const results = [];
        const errors = [];
        const startTime = Date.now();

        // Process directories with concurrency limit
        const concurrency = options.concurrency || 3;
        const priority = options.priority || PRIORITY.NORMAL;

        // Process in chunks
        for (let i = 0; i < directories.length; i += concurrency) {
          const chunk = directories.slice(i, i + concurrency);

          const chunkPromises = chunk.map(async (dir, index) => {
            const dirStartTime = Date.now();
            try {
              const result = await this.orchestrator.analyzeDirectory(dir, {
                ai: options.useOllama || false,
                priority: Math.min(priority + Math.floor(index / 2), 4), // Slight priority increase for later tasks
                parallel: options.parallel !== false,
              });

              return {
                directory: dir,
                success: true,
                result,
                duration: Date.now() - dirStartTime,
              };
            } catch (error) {
              return {
                directory: dir,
                success: false,
                error: error.message,
                duration: Date.now() - dirStartTime,
              };
            }
          });

          const chunkResults = await Promise.all(chunkPromises);
          results.push(...chunkResults.filter((r) => r.success));
          errors.push(...chunkResults.filter((r) => !r.success));

          // Small delay between chunks to prevent overwhelming
          if (i + concurrency < directories.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        const totalDuration = Date.now() - startTime;

        // Calculate aggregate statistics
        const totalFiles = results.reduce((sum, r) => sum + (r.result.total_files || 0), 0);
        const totalSize = results.reduce((sum, r) => sum + (r.result.total_size || 0), 0);

        res.json({
          success: true,
          batch: {
            totalDirectories: directories.length,
            successful: results.length,
            failed: errors.length,
            totalDuration,
            aggregateStats: {
              totalFiles,
              totalSize,
              avgFilesPerDirectory:
                results.length > 0 ? Math.round(totalFiles / results.length) : 0,
            },
          },
          results,
          errors: errors.length > 0 ? errors : undefined,
          timestamp: new Date().toISOString(),
        });

        console.log(
          `✅ Batch analysis complete: ${results.length}/${directories.length} successful in ${totalDuration}ms`
        );
      } catch (error) {
        console.error("Batch analysis failed:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // System metrics endpoint for real system monitoring
    this.app.get("/api/system/metrics", async (req, res) => {
      const os = require("os");
      const cpus = os.cpus();

      // Calculate CPU usage
      const cpuUsage =
        cpus.reduce((acc, cpu) => {
          const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
          const idle = cpu.times.idle;
          return acc + (total - idle) / total;
        }, 0) / cpus.length;

      // Memory info
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;

      // Disk info using diskusage package
      let diskInfo = { used: 0, total: 0, percentage: 0, free: 0 };
      try {
        const disk = await diskusage.check(".");
        diskInfo = {
          free: disk.free,
          total: disk.total,
          used: disk.total - disk.free,
          percentage: ((disk.total - disk.free) / disk.total) * 100,
        };
      } catch (e) {
        console.log("Could not get disk info:", e.message);
        // Fallback to memory-based estimate
        diskInfo = {
          used: usedMemory,
          total: totalMemory,
          free: freeMemory,
          percentage: (usedMemory / totalMemory) * 100,
        };
      }

      res.json({
        cpu: {
          usage: Math.round(cpuUsage * 100),
          cores: cpus.length,
          model: cpus[0]?.model || "Unknown",
        },
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: Math.round((usedMemory / totalMemory) * 100),
          free: freeMemory,
        },
        disk: diskInfo,
        system: {
          platform: os.platform(),
          arch: os.arch(),
          uptime: os.uptime(),
          hostname: os.hostname(),
        },
        process: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
        },
      });
    });

    // WebSocket status endpoint
    this.app.get("/api/websocket/status", (req, res) => {
      res.json({
        connected: wsClients.size > 0,
        clients: wsClients.size,
      });
    });

    // Enhanced Ollama AI Insights endpoint with model cycling and self-learning
    this.app.post("/api/ai/insights", async (req, res) => {
      const startTime = Date.now();
      try {
        const { analysisData, query } = req.body;

        if (!this.ollamaAvailable) {
          // Use basic AI insights without Ollama
          const insights = this.generateAIInsights(analysisData || {});
          return res.json({
            success: true,
            source: "basic",
            insights,
            cached: false,
            model: "basic-ai",
            responseTime: Date.now() - startTime,
          });
        }

        // Select optimal model based on query complexity
        const selectedModel = this.selectOptimalModel(query, analysisData);
        console.log(`🤖 Using model: ${selectedModel} for query: "${query?.substring(0, 50)}..."`);

        // Check self-learning cache first (hardware wear reduction)
        const cachedResponse = await this.checkSelfLearningCache(
          query,
          analysisData,
          selectedModel
        );
        if (cachedResponse) {
          this.recordInteraction(
            query,
            analysisData,
            selectedModel,
            cachedResponse,
            Date.now() - startTime,
            true
          );
          return res.json({
            success: true,
            source: "ollama-cached",
            response: cachedResponse,
            cached: true,
            model: selectedModel,
            responseTime: Date.now() - startTime,
          });
        }

        // Query Ollama with selected model
        const prompt = this.buildOllamaPrompt(analysisData, query);
        const ollamaResponse = await this.queryOllamaWithModel(prompt, selectedModel);

        // Store in self-learning cache
        await this.storeSelfLearningResponse(
          query,
          analysisData,
          selectedModel,
          ollamaResponse.response
        );

        // Record interaction for learning
        this.recordInteraction(
          query,
          analysisData,
          selectedModel,
          ollamaResponse.response,
          Date.now() - startTime,
          true
        );

        res.json({
          success: true,
          source: "ollama",
          response: ollamaResponse.response,
          thinking: ollamaResponse.thinking,
          done_reason: ollamaResponse.done_reason,
          model: ollamaResponse.model,
          created_at: ollamaResponse.created_at,
          total_duration: ollamaResponse.total_duration,
          load_duration: ollamaResponse.load_duration,
          prompt_eval_count: ollamaResponse.prompt_eval_count,
          prompt_eval_duration: ollamaResponse.prompt_eval_duration,
          eval_count: ollamaResponse.eval_count,
          eval_duration: ollamaResponse.eval_duration,
          cached: false,
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("AI insights error:", error);

        // Record failed interaction
        this.recordInteraction(
          query || "",
          analysisData || {},
          this.currentModel,
          null,
          Date.now() - startTime,
          false
        );

        res.status(500).json({
          success: false,
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // Server-Sent Events for real-time progress
    this.app.get("/api/progress/stream/:analysisId", (req, res) => {
      const { analysisId } = req.params;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const sendProgress = (progress) => {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      };

      const currentProgress = this.activeAnalyses.get(analysisId);
      if (currentProgress) {
        sendProgress(currentProgress);
      }

      const progressListener = (progress) => {
        console.log(
          `[SSE ${analysisId}] Received progress event:`,
          progress.analysisId,
          progress.percentage + "%"
        );
        if (progress.analysisId === analysisId) {
          console.log(`[SSE ${analysisId}] Sending progress to client:`, progress.percentage + "%");
          sendProgress(progress);
        } else {
          console.log(`[SSE ${analysisId}] Ignoring event for different ID:`, progress.analysisId);
        }
        if (progress.percentage >= 100) {
          res.end();
          this.eventEmitter.removeListener("progress", progressListener);
        }
      };

      this.eventEmitter.on("progress", progressListener);

      req.on("close", () => {
        this.eventEmitter.removeListener("progress", progressListener);
      });
    });

    // Main Analysis Endpoint
    this.app.post("/api/analyze", async (req, res) => {
      try {
        const { directoryPath, options = {} } = req.body;

        if (!directoryPath) {
          return res.status(400).json({
            success: false,
            error: "Directory path is required",
          });
        }

        const projectRoot = this.findProjectRoot(__dirname);

        let actualPath = directoryPath;

        if (directoryPath === "[FILE_SYSTEM_API]") {
          actualPath = path.join(projectRoot, "src");
        } else if (directoryPath.startsWith && directoryPath.startsWith("./")) {
          const relativePath = directoryPath.substring(2);
          actualPath = path.join(projectRoot, relativePath);
        } else if (directoryPath === "." || directoryPath === "") {
          actualPath = projectRoot;
        }

        const resolvedPath = path.resolve(actualPath);

        // Generate a more readable analysis ID based on directory name and timestamp
        const dirName = path
          .basename(resolvedPath)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 30);
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
        const analysisId = options.analysisId || `${dirName}_${timestamp}`;

        if (!existsSync(resolvedPath)) {
          return res.status(404).json({
            success: false,
            error: `Directory not found: ${actualPath}`,
          });
        }

        const stats = statSync(resolvedPath);
        if (!stats.isDirectory()) {
          return res.status(400).json({
            success: false,
            error: `Path is not a directory: ${actualPath}`,
          });
        }

        // Broadcast analysis start to WebSocket clients
        broadcast({
          type: "analysis_start",
          analysisId,
          path: actualPath,
          timestamp: new Date().toISOString(),
        });

        console.log("Starting analysis for path:", resolvedPath);

        // Check for incremental analysis opportunity
        console.log(`🔍 Checking for incremental analysis: ${actualPath}`);
        let incrementalResult = null;
        let currentFiles = null;

        try {
          const previousAnalysis = await this.knowledgeDB.getAnalysis(actualPath);
          if (previousAnalysis && previousAnalysis.analysis_data) {
            console.log(
              `📊 Found previous analysis (${new Date(previousAnalysis.last_analyzed).toISOString()})`
            );

            // Get current directory structure to check for changes
            currentFiles = await this.getDirectoryFilesQuick(actualPath);
            const changes = await this.knowledgeDB.getChangedFiles(actualPath, currentFiles);

            const totalChanges =
              changes.added.length + changes.changed.length + changes.removed.length;
            console.log(
              `🔄 File changes detected: +${changes.added.length} ~${changes.changed.length} -${changes.removed.length} (total: ${totalChanges})`
            );

            // If minimal changes (< 5% of files), reuse previous analysis with updates
            const changeThreshold = Math.max(
              10,
              Math.floor(previousAnalysis.analysis_data.totalFiles * 0.05)
            );
            if (totalChanges < changeThreshold) {
              console.log(`⚡ Using incremental analysis (changes < ${changeThreshold})`);

              // Create incremental result based on previous analysis
              incrementalResult = {
                ...previousAnalysis.analysis_data,
                analysisId: analysisId,
                incremental: true,
                lastAnalyzed: previousAnalysis.last_analyzed,
                changesDetected: totalChanges,
                changeSummary: {
                  added: changes.added.length,
                  changed: changes.changed.length,
                  removed: changes.removed.length,
                },
                cacheTimestamp: new Date().toISOString(),
              };

              // Update timestamps
              incrementalResult.analysisTime =
                Date.now() - Date.parse(previousAnalysis.last_analyzed);

              // Broadcast incremental completion immediately
              broadcast({
                type: "analysis_complete",
                analysisId,
                incremental: true,
                result: {
                  totalFiles: incrementalResult.totalFiles,
                  totalSize: incrementalResult.totalSize,
                  categories: Object.keys(incrementalResult.categories || {}),
                  changesDetected: totalChanges,
                },
                timestamp: new Date().toISOString(),
              });
            } else {
              console.log(
                `🔄 Significant changes detected (${totalChanges} >= ${changeThreshold}), running full analysis`
              );
            }
          }
        } catch (incrementalError) {
          console.log(
            "⚠️ Incremental analysis check failed, proceeding with full analysis:",
            incrementalError.message
          );
        }

        if (incrementalResult) {
          // Return incremental result
          const normalizedPath = directoryPath.startsWith("./")
            ? directoryPath.substring(2)
            : directoryPath;
          this.analysisResults.set(actualPath, incrementalResult);
          this.analysisResults.set(normalizedPath, incrementalResult);
          this.analysisResults.set(directoryPath, incrementalResult);
          this.analysisResults.set(analysisId, incrementalResult);

          // Update progress to complete
          const finalProgress = {
            analysisId,
            files: incrementalResult.totalFiles,
            percentage: 100,
            currentFile: "Incremental analysis complete",
            status: "complete",
            completed: true,
          };

          this.activeAnalyses.set(analysisId, finalProgress);
          this.eventEmitter.emit("progress", finalProgress);

          setTimeout(() => {
            this.activeAnalyses.delete(analysisId);
          }, 5000);

          return res.json({
            success: true,
            analysisId,
            incremental: true,
            message: `Incremental analysis complete (${incrementalResult.changesDetected} changes detected)`,
            changes: incrementalResult.changeSummary,
          });
        }

        this.activeAnalyses.set(analysisId, {
          analysisId,
          files: 0,
          filesProcessed: 0,
          totalSize: 0,
          percentage: 0,
          currentFile: "Starting full analysis...",
          status: "starting",
          completed: false,
          startTime: Date.now(),
          success: true,
          progress: {
            filesProcessed: 0,
            totalSize: 0,
            percentage: 0,
            currentFile: "Starting...",
            status: "starting",
          },
        });

        // Pass quick scan file count for better progress estimation
        const analysisOptions = {
          ...options,
          estimatedFiles: currentFiles?.length || options.estimatedFiles || 50000,
        };

        this.runAnalysisAsync(analysisId, actualPath, analysisOptions)
          .then(async (result) => {
            const normalizedPath = directoryPath.startsWith("./")
              ? directoryPath.substring(2)
              : directoryPath;
            this.analysisResults.set(actualPath, result);
            this.analysisResults.set(normalizedPath, result);
            this.analysisResults.set(directoryPath, result);
            this.analysisResults.set(analysisId, result); // Store by ID for frontend retrieval

            console.log("Analysis completed successfully for:", actualPath);

            // Store analysis in persistent database for incremental analysis
            try {
              await this.knowledgeDB.storeAnalysis(actualPath, result);

              // Store file metadata for future incremental scans
              if (result.files && result.files.length > 0) {
                // For incremental analysis, we need to get full file list for metadata storage
                if (!result.incremental) {
                  await this.knowledgeDB.storeFileMetadata(actualPath, result.files);
                  console.log(`💾 Stored metadata for ${result.files.length} files`);
                } else {
                  // For incremental updates, get fresh file list and update metadata
                  console.log(`🔄 Updating metadata for incremental analysis`);
                  const freshFiles = await this.getDirectoryFilesQuick(actualPath);
                  await this.knowledgeDB.storeFileMetadata(actualPath, freshFiles);
                  console.log(`💾 Updated metadata for ${freshFiles.length} files`);
                }
              }
            } catch (dbError) {
              console.error("Failed to store in knowledge database:", dbError);
              // Continue even if database storage fails
            }

            const finalProgress = {
              analysisId,
              success: true,
              files: result.totalFiles,
              filesProcessed: result.totalFiles,
              totalSize: result.totalSize,
              percentage: 100,
              currentFile: "Analysis complete",
              status: "complete",
              completed: true,
              progress: {
                filesProcessed: result.totalFiles,
                totalSize: result.totalSize,
                percentage: 100,
                currentFile: "Analysis complete",
                status: "complete",
              },
            };

            this.activeAnalyses.set(analysisId, finalProgress);
            this.eventEmitter.emit("progress", finalProgress);

            // Broadcast completion to WebSocket clients
            broadcast({
              type: "analysis_complete",
              analysisId,
              result: {
                totalFiles: result.totalFiles,
                totalSize: result.totalSize,
                categories: Object.keys(result.categories || {}),
              },
              timestamp: new Date().toISOString(),
            });

            setTimeout(() => {
              this.activeAnalyses.delete(analysisId);
            }, 5000);
          })
          .catch((error) => {
            console.error("Analysis failed for path:", actualPath, error);

            this.eventEmitter.emit("progress", {
              analysisId,
              files: 0,
              percentage: 0,
              currentFile: "Analysis failed",
              error: error.message || "Unknown error",
              status: "failed",
              completed: true,
            });

            // Broadcast error to WebSocket clients
            broadcast({
              type: "analysis_error",
              analysisId,
              error: error.message,
              timestamp: new Date().toISOString(),
            });

            setTimeout(() => {
              this.activeAnalyses.delete(analysisId);
            }, 5000);
          });

        res.json({
          success: true,
          analysisId,
          serviceMetadata: { analysisId },
          message: "Analysis started",
        });
      } catch (error) {
        console.error("Analysis error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Export endpoint (CSV, JSON, TXT)
    this.app.post("/api/export", async (req, res) => {
      try {
        const { data, format = "json", filename = "analysis" } = req.body;

        let content, contentType, extension;

        switch (format.toLowerCase()) {
          case "csv":
            content = this.convertToCSV(data);
            contentType = "text/csv";
            extension = "csv";
            break;
          case "txt":
            content = this.convertToTXT(data);
            contentType = "text/plain";
            extension = "txt";
            break;
          case "json":
          default:
            content = JSON.stringify(data, null, 2);
            contentType = "application/json";
            extension = "json";
        }

        const exportFilename = `${filename}_${Date.now()}.${extension}`;
        const exportPath = path.join(__dirname, "exports");

        if (!existsSync(exportPath)) {
          await fsPromises.mkdir(exportPath, { recursive: true });
        }

        const fullPath = path.join(exportPath, exportFilename);
        await fsPromises.writeFile(fullPath, content);

        res.json({
          success: true,
          filename: exportFilename,
          path: fullPath,
          size: content.length,
        });
      } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Results endpoint
    this.app.get("/api/results", async (req, res) => {
      try {
        const directoryPath = req.query.path;
        if (!directoryPath) {
          return res.status(400).json({ success: false, error: "Path parameter required" });
        }

        const result = this.analysisResults.get(directoryPath);

        if (result) {
          res.json({ success: true, data: result });
        } else {
          res.status(404).json({ success: false, error: "Results not found" });
        }
      } catch (error) {
        console.error("Results error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Results by ID endpoint (Required by AnalysisBridge)
    this.app.get("/api/results/:id", async (req, res) => {
      try {
        const analysisId = req.params.id;
        const result = this.analysisResults.get(analysisId);

        if (result) {
          // Results are ready, return them even if progress entry still exists
          res.json({ success: true, data: result });
        } else {
          // Check if it's still processing
          const progress = this.activeAnalyses.get(analysisId);
          if (progress) {
            // If progress is marked as completed but results aren't found yet, wait briefly
            if (progress.completed) {
              // Give it a moment for results to be stored
              await new Promise((resolve) => setTimeout(resolve, 100));
              const retryResult = this.analysisResults.get(analysisId);
              if (retryResult) {
                return res.json({ success: true, data: retryResult });
              }
            }
            return res.status(202).json({ success: false, status: "processing", progress });
          }
          res.status(404).json({ success: false, error: "Results not found" });
        }
      } catch (error) {
        console.error("Results/ID error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // File Management Endpoints
    this.app.post("/api/files/delete", async (req, res) => {
      try {
        const { path: filePath } = req.body;
        if (!filePath || !this.isValidPath(filePath))
          return res.status(400).json({ error: "Invalid path" });

        await fsPromises.unlink(filePath);

        // Broadcast deletion to WebSocket clients
        broadcast({
          type: "file_deleted",
          path: filePath,
          timestamp: new Date().toISOString(),
        });

        res.json({ success: true, message: "File deleted" });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post("/api/files/rename", async (req, res) => {
      try {
        const { oldPath, newName } = req.body;
        if (!oldPath || !newName || !this.isValidPath(oldPath))
          return res.status(400).json({ error: "Invalid path" });

        const newPath = path.join(path.dirname(oldPath), newName);
        if (!this.isValidPath(newPath)) return res.status(400).json({ error: "Invalid new name" });

        await fsPromises.rename(oldPath, newPath);

        // Broadcast rename to WebSocket clients
        broadcast({
          type: "file_renamed",
          oldPath,
          newPath,
          timestamp: new Date().toISOString(),
        });

        res.json({ success: true, newPath });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post("/api/files/reveal", async (req, res) => {
      const { path: filePath } = req.body;
      if (!filePath || !this.isValidPath(filePath))
        return res.status(400).json({ error: "Invalid path" });

      const command =
        process.platform === "win32" ? `explorer /select,"${filePath}"` : `open -R "${filePath}"`;
      spawn(command, { shell: true });
      res.json({ success: true });
    });

    this.app.post("/api/files/open-explorer", async (req, res) => {
      try {
        if (process.platform === "win32") {
          const startPath = "C:\\Users\\" + (os.userInfo().username || "Public");
          const command = `explorer "${startPath}"`;
          spawn(command, { shell: true });
          res.json({ success: true, message: "File Explorer opened", path: startPath });
        } else {
          const homePath = os.homedir();
          const command =
            process.platform === "darwin" ? `open "${homePath}"` : `xdg-open "${homePath}"`;
          spawn(command, { shell: true });
          res.json({ success: true, message: "File manager opened", path: homePath });
        }
      } catch (error) {
        console.error("Failed to open file explorer:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Search endpoint
    this.app.post("/api/files/search", async (req, res) => {
      try {
        const {
          directory,
          query = "",
          page = 1,
          pageSize = 50,
          sortBy = "name",
          sortOrder = "asc",
          filterExtension = "",
        } = req.body;

        if (!directory || !this.isValidPath(directory)) {
          return res.status(400).json({ error: "Invalid directory path" });
        }

        let allFiles;
        if (this.analysisResults.has(directory)) {
          allFiles = this.analysisResults.get(directory).files || [];
        } else {
          const result = await this.runJsAnalysis(Date.now().toString(), directory);
          allFiles = result.files || [];
          this.analysisResults.set(directory, result);
        }

        let filteredFiles = allFiles.filter((file) => {
          const matchesQuery = !query || file.name.toLowerCase().includes(query.toLowerCase());
          const matchesExtension = !filterExtension || file.name.endsWith(filterExtension);
          return matchesQuery && matchesExtension;
        });

        filteredFiles.sort((a, b) => {
          let aVal = a[sortBy] || a.name;
          let bVal = b[sortBy] || b.name;

          if (sortBy === "size") {
            aVal = a.size || 0;
            bVal = b.size || 0;
          }

          if (sortOrder === "desc") {
            return aVal > bVal ? -1 : 1;
          }
          return aVal > bVal ? 1 : -1;
        });

        const total = filteredFiles.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const files = filteredFiles.slice(startIndex, endIndex);

        const stats = {
          totalFiles: allFiles.length,
          totalSize: allFiles.reduce((sum, file) => sum + (file.size || 0), 0),
          uniqueExtensions: new Set(allFiles.map((f) => f.name.split(".").pop())).size,
          largestFile: allFiles.reduce(
            (largest, file) => ((file.size || 0) > (largest.size || 0) ? file : largest),
            allFiles[0]
          ),
        };

        res.json({
          files,
          pagination: { page, pageSize, total, totalPages },
          stats,
        });
      } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Duplicate detection endpoint
    this.app.post("/api/analysis/:analysisId/duplicates", async (req, res) => {
      const { analysisId } = req.params;
      let result = this.analysisResults.get(analysisId);

      // If not in memory, try to get from database using the path
      if (!result && req.body.path) {
        const dbResult = await this.knowledgeDB.getAnalysis(req.body.path);
        if (dbResult && dbResult.analysis_data) {
          result = dbResult.analysis_data;
        }
      }

      if (!result || !result.files) {
        return res.status(404).json({ error: "Analysis not found or no files" });
      }

      try {
        const detector = new DuplicateDetector();
        const duplicates = await detector.findDuplicates(result.files);
        const recommendations = detector.generateRecommendations(duplicates);

        res.json({
          success: true,
          ...duplicates,
          recommendations,
        });
      } catch (error) {
        console.error("Duplicate detection error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Progress endpoint
    this.app.get("/api/progress/:analysisId", (req, res) => {
      const { analysisId } = req.params;
      const progress = this.activeAnalyses.get(analysisId);

      if (progress) {
        res.json(progress);
      } else {
        res.status(404).json({ error: "Analysis not found" });
      }
    });

    // Get current analysis by path from database
    this.app.get("/api/analysis/current", async (req, res) => {
      const { path: directoryPath } = req.query;

      if (!directoryPath) {
        return res.status(400).json({ error: "Path parameter required" });
      }

      try {
        // First check in-memory cache
        const cachedResult = this.analysisResults.get(directoryPath);
        if (cachedResult) {
          return res.json({
            success: true,
            source: "memory",
            data: cachedResult,
          });
        }

        // Then check database
        const dbResult = await this.knowledgeDB.getAnalysis(directoryPath);
        if (dbResult && dbResult.analysis_data) {
          return res.json({
            success: true,
            source: "database",
            data: dbResult.analysis_data,
          });
        }

        res.status(404).json({ error: "No analysis found for this path" });
      } catch (error) {
        console.error("Error retrieving current analysis:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get analysis files with pagination and filtering
    this.app.get("/api/analysis/:analysisId/files", async (req, res) => {
      const { analysisId } = req.params;
      const {
        page = 1,
        perPage = 100,
        category,
        extension,
        minSize,
        maxSize,
        sortBy,
        sortOrder,
      } = req.query;

      try {
        // First get the analysis to find its ID in the database
        // We need to look up by the analysisId which might be a string like "System32_20260429-1553"
        let dbAnalysisId = null;

        // Try to find in active analyses first to get the path
        for (const [path, result] of this.analysisResults) {
          if (result.analysisId === analysisId) {
            const dbResult = await this.knowledgeDB.getAnalysis(path);
            if (dbResult) {
              dbAnalysisId = dbResult.id;
              break;
            }
          }
        }

        if (!dbAnalysisId) {
          return res.status(404).json({ error: "Analysis not found" });
        }

        const options = {
          page: parseInt(page, 10),
          perPage: parseInt(perPage, 10),
          category: category || null,
          extension: extension || null,
          minSize: minSize ? parseInt(minSize, 10) : null,
          maxSize: maxSize ? parseInt(maxSize, 10) : null,
          sortBy: sortBy || "file_size",
          sortOrder: sortOrder || "DESC",
        };

        const result = await this.knowledgeDB.getAnalysisFiles(dbAnalysisId, options);
        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error("Error fetching analysis files:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get analysis statistics
    this.app.get("/api/analysis/:analysisId/stats", async (req, res) => {
      const { analysisId } = req.params;

      try {
        // Find database analysis ID
        let dbAnalysisId = null;

        for (const [path, result] of this.analysisResults) {
          if (result.analysisId === analysisId) {
            const dbResult = await this.knowledgeDB.getAnalysis(path);
            if (dbResult) {
              dbAnalysisId = dbResult.id;
              break;
            }
          }
        }

        if (!dbAnalysisId) {
          return res.status(404).json({ error: "Analysis not found" });
        }

        const stats = await this.knowledgeDB.getAnalysisStats(dbAnalysisId);
        res.json({
          success: true,
          ...stats,
        });
      } catch (error) {
        console.error("Error fetching analysis stats:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Launch different interfaces
    this.app.get("/api/launch/:type", (req, res) => {
      const { type } = req.params;

      const launchOptions = {
        gui: {
          status: "success",
          url: "/gui",
          message: "Launching Desktop GUI...",
          action: "navigate",
          note: "Opens the C++20 Qt6 Desktop Application",
        },
        web: {
          status: "success",
          url: "/",
          message: "Opening Web Dashboard...",
          action: "navigate",
          note: "You are already on the web interface",
        },
        "cli-enhanced": {
          status: "success",
          message: "Launching Enhanced ML CLI...",
          action: "terminal",
          command: "cargo run --release -- analyze",
          workingDir: path.join(this.findProjectRoot(__dirname), "cli"),
          note: "Use --help for options: analyze <path> --format json --output <file>",
        },
        "cli-basic": {
          status: "success",
          message: "Launching Basic CLI...",
          action: "terminal",
          command: "node cli_integration_test.js",
          workingDir: this.findProjectRoot(__dirname),
          note: "Fast headless analysis with basic output",
        },
      };

      const option = launchOptions[type];

      if (option) {
        console.log(`🚀 Launch request for: ${type}`);
        res.json(option);
      } else {
        res.status(404).json({
          status: "error",
          message: `Unknown launch type: ${type}`,
          availableTypes: Object.keys(launchOptions),
        });
      }
    });

    // Analysis history endpoint - now uses database instead of JSON files
    this.app.get("/api/analysis/history", async (req, res) => {
      try {
        const analyses = await this.knowledgeDB.getAnalysisHistory();

        res.json({
          success: true,
          analyses,
          total: analyses.length,
          source: "database",
        });
      } catch (error) {
        console.error("Error fetching analysis history:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Debug logging endpoint
    this.app.post("/api/debug-log", (req, res) => {
      try {
        const { level, args } = req.body;
        const timestamp = new Date().toISOString();
        const message = args
          .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
          .join(" ");

        console.log(`[${timestamp}] [FRONTEND-${level.toUpperCase()}] ${message}`);
        res.json({ success: true, timestamp });
      } catch (error) {
        console.error("Debug log error:", error);
        res.status(500).json({ error: "Failed to log debug message" });
      }
    });

    // --- OLLAMA PROXY ROUTES (Solves CSP/CORS) ---

    // Proxy Tags (Models)
    this.app.get("/api/ollama/api/tags", async (req, res) => {
      try {
        const response = await fetch(`${this.config.ollamaHost}/api/tags`);
        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error("Ollama Proxy Error (Tags):", error.message);
        res.status(502).json({ error: "Failed to connect to AI Service" });
      }
    });

    // --- TREND TRACKING & AI CONTEXT API ---

    // Get analysis trends for a directory
    this.app.get("/api/trends", async (req, res) => {
      try {
        const { path: directoryPath, limit = 10 } = req.query;

        if (!directoryPath) {
          return res.status(400).json({ error: "Path parameter required" });
        }

        const trends = await this.knowledgeDB.getAnalysisTrends(directoryPath, parseInt(limit));
        const summary = await this.knowledgeDB.getTrendSummary(directoryPath);

        res.json({
          success: true,
          directory: directoryPath,
          trends,
          summary,
        });
      } catch (error) {
        console.error("Error fetching trends:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get AI context for an analysis
    this.app.get("/api/analysis/:analysisId/context", async (req, res) => {
      try {
        const { analysisId } = req.params;
        const { type } = req.query;

        const context = await this.knowledgeDB.getAIAnalysisContext(analysisId, type);

        if (!context) {
          return res.status(404).json({ error: "Context not found" });
        }

        res.json({
          success: true,
          context,
        });
      } catch (error) {
        console.error("Error fetching AI context:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // AI File Summarization
    this.app.post("/api/ai/summarize", async (req, res) => {
      const startTime = Date.now();
      try {
        const { filePath, maxChars = 5000, model = "phi4-mini:latest" } = req.body;

        if (!filePath) {
          return res.status(400).json({ error: "filePath is required" });
        }

        // Check path is valid
        if (!this.isValidPath(filePath)) {
          return res.status(400).json({ error: "Invalid file path" });
        }

        // Generate file hash for caching
        const fs = require("fs").promises;
        const crypto = require("crypto");
        const stats = await fs.stat(filePath).catch(() => null);

        if (!stats) {
          return res.status(404).json({ error: "File not found" });
        }

        const fileHash = crypto
          .createHash("md5")
          .update(`${filePath}:${stats.size}:${stats.mtime}`)
          .digest("hex");

        // Check cache first
        const cached = await this.knowledgeDB.getFileSummary(filePath, fileHash);
        if (cached) {
          return res.json({
            success: true,
            summary: cached.summary_text,
            fileType: cached.file_type,
            cached: true,
            hitCount: cached.hit_count,
            responseTime: Date.now() - startTime,
          });
        }

        // Extract text from file
        const TextExtractor = require("../modules/text-extractor");
        const extractor = new TextExtractor();
        const extractedText = await extractor.extractText(filePath, maxChars);

        if (!extractedText || extractedText.startsWith("[")) {
          return res.status(400).json({
            error: "Unable to extract text from this file type",
            extractedPreview: extractedText,
          });
        }

        // Generate summary via Ollama
        const fileType = extractor.getFileTypeCategory(filePath);
        const prompt = this.buildSummaryPrompt(extractedText, fileType);

        const ollamaResponse = await fetch(`${this.config.ollamaHost}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.3,
              num_predict: 150,
              num_ctx: 4096,
            },
          }),
        });

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama error: ${ollamaResponse.status}`);
        }

        const ollamaData = await ollamaResponse.json();
        const summary =
          ollamaData.response || ollamaData.message?.content || "No summary generated";

        // Store in cache
        await this.knowledgeDB.storeFileSummary(
          filePath,
          fileHash,
          stats.size,
          fileType,
          summary,
          extractedText.substring(0, 500),
          model,
          ollamaData.eval_count || 0
        );

        res.json({
          success: true,
          summary: summary,
          fileType: fileType,
          extractedPreview: extractedText.substring(0, 200) + "...",
          cached: false,
          model: model,
          tokensUsed: ollamaData.eval_count || 0,
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("AI summarization error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // Build summary prompt based on file type
    this.buildSummaryPrompt = (extractedText, fileType) => {
      const prompts = {
        document: `Summarize this document in 2-3 sentences. Focus on the main topic, key points, and purpose:

${extractedText}

Summary:`,

        code: `Explain what this code does in 2-3 sentences. Focus on the main functionality, purpose, and any notable patterns:

${extractedText}

Explanation:`,

        data: `Describe this data file in 2-3 sentences. What kind of data does it contain, and what might it be used for?

${extractedText}

Description:`,

        web: `Summarize this web file (HTML/CSS) in 2-3 sentences. What is its purpose and main functionality?

${extractedText}

Summary:`,

        other: `Summarize the content of this file in 2-3 sentences:

${extractedText}

Summary:`,
      };

      return prompts[fileType] || prompts.other;
    };

    // Proxy Generate
    this.app.post("/api/ollama/api/generate", async (req, res) => {
      try {
        const response = await fetch(`${this.config.ollamaHost}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        });
        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error("Ollama Proxy Error (Generate):", error.message);
        res.status(502).json({ error: "AI Service Error" });
      }
    });

    // Proxy Chat
    this.app.post("/api/ollama/api/chat", async (req, res) => {
      try {
        const response = await fetch(`${this.config.ollamaHost}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        });
        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error("Ollama Proxy Error (Chat):", error.message);
        res.status(502).json({ error: "AI Service Error" });
      }
    });

    // --- NATURAL LANGUAGE QUERY ROUTE ---

    // Natural Language File Search
    this.app.post("/api/ai/nl-query", async (req, res) => {
      const startTime = Date.now();
      try {
        const { query, analysisId } = req.body;

        if (!query) {
          return res.status(400).json({ error: "Query is required" });
        }

        // Get analysis data
        const analysisData = analysisId
          ? this.analysisResults.get(analysisId)
          : Array.from(this.analysisResults.values())[0];

        if (!analysisData || !analysisData.files) {
          return res.status(400).json({
            error: "No analysis data available. Please scan a directory first.",
          });
        }

        // Parse natural language query with Ollama
        const parsedQuery = await this.parseNaturalLanguageQuery(query);

        // Execute query against file data
        const results = this.executeFileQuery(analysisData.files, parsedQuery);

        res.json({
          success: true,
          query: query,
          parsedQuery: parsedQuery,
          results: results.slice(0, 100), // Limit to 100 results
          resultCount: results.length,
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("Natural language query error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // --- AI CLEANUP ASSISTANT ROUTES ---

    // Generate AI cleanup recommendations
    this.app.post("/api/ai/cleanup/analyze", async (req, res) => {
      const startTime = Date.now();
      try {
        const { directory, analysisId, targetSavings } = req.body;

        if (!directory && !analysisId) {
          return res.status(400).json({ error: "Directory or analysisId is required" });
        }

        // Get analysis data
        const analysisData = analysisId
          ? this.analysisResults.get(analysisId)
          : Array.from(this.analysisResults.values()).find((a) => a.directory === directory);

        if (!analysisData || !analysisData.files) {
          return res.status(400).json({ error: "No analysis data found" });
        }

        // Analyze files with Ollama for cleanup recommendations
        const recommendations = await this.generateCleanupRecommendations(
          analysisData,
          targetSavings
        );

        // Store recommendations in database
        for (const rec of recommendations) {
          await this.knowledgeDB.storeCleanupRecommendation(
            directory || analysisData.directory,
            rec.filePath,
            rec.fileSize,
            rec.type,
            rec.confidence,
            rec.reasoning,
            rec.potentialSavings,
            rec.safeToDelete
          );
        }

        // Get potential savings summary
        const savings = await this.knowledgeDB.getPotentialSavings(
          directory || analysisData.directory
        );

        res.json({
          success: true,
          directory: directory || analysisData.directory,
          recommendationsGenerated: recommendations.length,
          potentialSavings: savings,
          topRecommendations: recommendations.slice(0, 10),
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("Cleanup analysis error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // Get cleanup recommendations
    this.app.get("/api/ai/cleanup/recommendations", async (req, res) => {
      try {
        const { directory, type, limit = 50 } = req.query;

        if (!directory) {
          return res.status(400).json({ error: "Directory is required" });
        }

        const recommendations = await this.knowledgeDB.getCleanupRecommendations(
          directory,
          parseInt(limit),
          type || null
        );

        const savings = await this.knowledgeDB.getPotentialSavings(directory);

        res.json({
          success: true,
          directory,
          recommendations,
          potentialSavings: savings,
          count: recommendations.length,
        });
      } catch (error) {
        console.error("Get recommendations error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Update recommendation action (approve/reject)
    this.app.post("/api/ai/cleanup/action", async (req, res) => {
      try {
        const { filePath, action } = req.body;

        if (!filePath || !action) {
          return res.status(400).json({ error: "filePath and action are required" });
        }

        if (!["approved", "rejected", "completed"].includes(action)) {
          return res
            .status(400)
            .json({ error: "Invalid action. Use: approved, rejected, completed" });
        }

        const changes = await this.knowledgeDB.updateCleanupAction(filePath, action);

        res.json({
          success: true,
          filePath,
          action,
          updated: changes > 0,
        });
      } catch (error) {
        console.error("Update action error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // --- CODE COMPLEXITY ANALYSIS ROUTES ---

    // Analyze code complexity for a directory
    this.app.post("/api/complexity/analyze", async (req, res) => {
      const startTime = Date.now();
      try {
        const { directory, analysisId, maxFiles = 100 } = req.body;

        if (!directory && !analysisId) {
          return res.status(400).json({ error: "Directory or analysisId is required" });
        }

        // Get analysis data
        const analysisData = analysisId
          ? this.analysisResults.get(analysisId)
          : Array.from(this.analysisResults.values()).find((a) => a.directory === directory);

        if (!analysisData || !analysisData.files) {
          return res.status(400).json({ error: "No analysis data found" });
        }

        // Filter code files
        const codeExtensions = [
          ".js",
          ".ts",
          ".jsx",
          ".tsx",
          ".py",
          ".java",
          ".cs",
          ".cpp",
          ".c",
          ".go",
          ".rs",
          ".php",
          ".rb",
        ];
        const codeFiles = analysisData.files
          .filter((f) => {
            const ext = path.extname(f.name).toLowerCase();
            return codeExtensions.includes(ext);
          })
          .slice(0, maxFiles);

        // Import complexity analyzer
        const ComplexityAnalyzer = require("../modules/complexity-analyzer");
        const analyzer = new ComplexityAnalyzer();

        // Analyze files
        const filePaths = codeFiles.map((f) => f.path);
        const complexityResults = await analyzer.analyzeFiles(filePaths);

        // Store results in database
        const crypto = require("crypto");
        for (const result of complexityResults) {
          const fileHash = crypto
            .createHash("md5")
            .update(`${result.filePath}:${result.linesOfCode}`)
            .digest("hex");

          await this.knowledgeDB.storeComplexityMetrics({
            filePath: result.filePath,
            directoryPath: directory || analysisData.directory,
            language: result.language,
            linesOfCode: result.linesOfCode,
            logicalLines: result.logicalLines,
            commentLines: result.commentLines,
            blankLines: result.blankLines,
            cyclomaticComplexity: result.cyclomaticComplexity,
            cognitiveComplexity: result.cognitiveComplexity,
            functionCount: result.functionCount,
            maxFunctionLength: result.maxFunctionLength,
            averageFunctionLength: result.averageFunctionLength,
            nestingDepth: result.nestingDepth,
            maintainabilityIndex: result.maintainabilityIndex,
            complexityGrade: result.complexityGrade,
            refactoringPriority: result.refactoringPriority,
            fileHash,
          });
        }

        // Calculate summary statistics
        const summary = analyzer.getSummaryStats(complexityResults);

        res.json({
          success: true,
          directory: directory || analysisData.directory,
          filesAnalyzed: complexityResults.length,
          summary,
          topComplexFiles: summary?.mostComplexFiles || [],
          filesNeedingRefactoring: summary?.filesNeedingRefactoring || 0,
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("Complexity analysis error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // Get complexity metrics for a directory
    this.app.get("/api/complexity/metrics", async (req, res) => {
      try {
        const { directory, minPriority, limit = 50 } = req.query;

        if (!directory) {
          return res.status(400).json({ error: "Directory is required" });
        }

        const metrics = await this.knowledgeDB.getDirectoryComplexity(
          directory,
          minPriority || null
        );

        const summary = await this.knowledgeDB.getComplexitySummary(directory);

        res.json({
          success: true,
          directory,
          metrics: metrics.slice(0, parseInt(limit)),
          summary,
          count: metrics.length,
        });
      } catch (error) {
        console.error("Get complexity metrics error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get complexity summary for a directory
    this.app.get("/api/complexity/summary", async (req, res) => {
      try {
        const { directory } = req.query;

        if (!directory) {
          return res.status(400).json({ error: "Directory is required" });
        }

        const summary = await this.knowledgeDB.getComplexitySummary(directory);
        const filesNeedingRefactoring = await this.knowledgeDB.getFilesNeedingRefactoring(
          directory,
          20
        );

        res.json({
          success: true,
          directory,
          summary,
          filesNeedingRefactoring,
        });
      } catch (error) {
        console.error("Get complexity summary error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get files needing refactoring
    this.app.get("/api/complexity/refactoring", async (req, res) => {
      try {
        const { directory, limit = 20 } = req.query;

        if (!directory) {
          return res.status(400).json({ error: "Directory is required" });
        }

        const files = await this.knowledgeDB.getFilesNeedingRefactoring(directory, parseInt(limit));

        res.json({
          success: true,
          directory,
          files,
          count: files.length,
        });
      } catch (error) {
        console.error("Get refactoring files error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // --- AI & SELF LEARNING ROUTES ---

    // AI QA Endpoint with Persistent Knowledge Database
    this.app.post("/api/ai-models/qa", async (req, res) => {
      const startTime = Date.now();
      try {
        const { question, directory, analysisId } = req.body;

        // 1. Check Persistent Cache (KnowledgeDatabase)
        const contextHash = this.knowledgeDB.generateHash(analysisId || directory || "general");
        const cached = await this.knowledgeDB.findSimilarResponse(question, contextHash);

        if (cached) {
          return res.json({
            success: true,
            answer: cached.answer,
            model: cached.model_used,
            cached: true,
            cacheHits: cached.hit_count,
            intent: "qa_response",
            responseTime: Date.now() - startTime,
          });
        }

        // 2. Prepare Context
        let contextData = null;
        if (analysisId && this.analysisResults.has(analysisId)) {
          contextData = this.analysisResults.get(analysisId);
        } else if (directory && this.analysisResults.has(directory)) {
          contextData = this.analysisResults.get(directory);
        }

        const prompt = contextData ? this.buildOllamaPrompt(contextData, question) : question;

        // 3. Auto-select optimal model based on query
        const model = this.selectOptimalModel(question, contextData);
        console.log(`🤖 Auto-selected ${model} for: "${question.substring(0, 50)}..."`);

        // 4. Query Ollama
        const ollamaResponse = await this.queryOllamaWithModel(prompt, model);

        // 5. Store in persistent database
        const responseTime = Date.now() - startTime;
        await this.knowledgeDB.storeAIResponse(
          question,
          ollamaResponse.response,
          contextHash,
          model,
          responseTime
        );

        // 6. Also store in legacy system for compatibility
        this.selfLearning.addQA(question, ollamaResponse.response, contextHash, model);

        res.json({
          success: true,
          answer: ollamaResponse.response,
          thinking: ollamaResponse.thinking,
          done_reason: ollamaResponse.done_reason,
          model: ollamaResponse.model,
          created_at: ollamaResponse.created_at,
          total_duration: ollamaResponse.total_duration,
          load_duration: ollamaResponse.load_duration,
          prompt_eval_count: ollamaResponse.prompt_eval_count,
          prompt_eval_duration: ollamaResponse.prompt_eval_duration,
          eval_count: ollamaResponse.eval_count,
          eval_duration: ollamaResponse.eval_duration,
          cached: false,
          intent: "qa_response",
          responseTime: responseTime,
        });
      } catch (error) {
        console.error("AI QA Error:", error);
        res.status(500).json({ success: false, error: "AI processing failed" });
      }
    });

    // AI Insights Endpoint
    this.app.post("/api/ai/insights", async (req, res) => {
      try {
        const { analysisData, query } = req.body;

        // Check cache for generic insights request
        const cacheKey = JSON.stringify(analysisData.files.slice(0, 5)); // Roughly hash based on top files
        const cached = this.selfLearning.getCachedResponse("insights", cacheKey);
        if (cached) {
          return res.json({ success: true, insights: cached });
        }

        const prompt = this.buildOllamaPrompt(
          analysisData,
          query || "Provide comprehensive storage insights"
        );
        const ollamaResponse = await this.queryOllamaWithModel(prompt, this.config.defaultModel);

        this.selfLearning.addQA(
          "insights",
          ollamaResponse.response,
          cacheKey,
          this.config.defaultModel
        );

        res.json({
          success: true,
          insights: ollamaResponse.response,
          thinking: ollamaResponse.thinking,
          done_reason: ollamaResponse.done_reason,
          model: ollamaResponse.model,
          created_at: ollamaResponse.created_at,
          total_duration: ollamaResponse.total_duration,
          load_duration: ollamaResponse.load_duration,
          prompt_eval_count: ollamaResponse.prompt_eval_count,
          prompt_eval_duration: ollamaResponse.prompt_eval_duration,
          eval_count: ollamaResponse.eval_count,
          eval_duration: ollamaResponse.eval_duration,
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Active Models Endpoint
    this.app.get("/api/ai-models/:analysisId", (req, res) => {
      res.json({
        success: true,
        aiModels: [
          { id: "gemma3", name: "Gemma 3 (Google)", type: "reasoning", active: true },
          { id: "llama3", name: "Llama 3", type: "general", active: false },
        ],
      });
    });

    // Learning Stats Endpoint
    this.app.get("/api/learning/stats", (req, res) => {
      const stats = this.selfLearning.getStats();
      res.json({
        success: true,
        stats: {
          queryHistory: stats.historySize,
          qaHistory: stats.historySize,
          qaCacheSize: stats.cacheSize,
          learningPatterns: 5, // Mock
          selfLearning: {
            trackingQueries: true,
            trackingQA: true,
            cachingEnabled: true,
            patternLearning: true,
          },
        },
      });
    });

    // Analyze single file endpoint (for drag-drop analysis)
    this.app.post("/api/analyze/file", async (req, res) => {
      try {
        // Handle multipart form data using multer
        const multer = require("multer");
        const upload = multer({ dest: "uploads/" });

        // Use multer middleware
        upload.single("file")(req, res, (err) => {
          if (err) {
            return res.json({ success: false, error: err.message });
          }

          if (!req.file) {
            return res.json({ success: false, error: "No file provided" });
          }

          // Basic file analysis
          const fs = require("fs");
          const path = require("path");
          const stats = fs.statSync(req.file.path);

          const result = {
            name: req.file.originalname,
            size: stats.size,
            type: path.extname(req.file.originalname),
            path: req.file.path,
            category: this.categorizeFile(req.file.originalname),
            analyzed: true,
          };

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({ success: true, data: result });
        });
      } catch (error) {
        console.error("File analysis error:", error);
        res.json({ success: false, error: error.message });
      }
    });

    // Batch file operations endpoint
    this.app.post("/api/files/batch-operations", async (req, res) => {
      try {
        const { operations } = req.body;
        const operationId = `batch-${Date.now()}`;

        // Store operation for progress tracking
        this.batchOperations = this.batchOperations || new Map();
        this.batchOperations.set(operationId, {
          operations,
          status: "running",
          progress: 0,
          completed: 0,
          failed: 0,
        });

        // Process operations asynchronously
        this.processBatchOperations(operationId, operations);

        res.json({ success: true, operationId });
      } catch (error) {
        console.error("Batch operations error:", error);
        res.json({ success: false, error: error.message });
      }
    });

    // Batch operation progress endpoint
    this.app.get("/api/files/batch-progress/:operationId", (req, res) => {
      const { operationId } = req.params;
      const operation = this.batchOperations?.get(operationId);

      if (!operation) {
        return res.json({ success: false, error: "Operation not found" });
      }

      res.json({
        success: true,
        status: operation.status,
        progress: operation.progress,
        completed: operation.completed,
        failed: operation.failed,
        total: operation.operations.length,
      });
    });

    // Error reporting endpoint
    this.app.post("/api/errors/report", async (req, res) => {
      try {
        const { error, component, stack, userAgent, timestamp } = req.body;

        // Log error for monitoring
        console.error("Error Report:", {
          error,
          component,
          timestamp: timestamp || new Date().toISOString(),
          userAgent,
        });

        // Store error in error history
        this.errorHistory = this.errorHistory || [];
        this.errorHistory.push({
          error,
          component,
          stack,
          timestamp: timestamp || new Date().toISOString(),
          userAgent,
        });

        // Limit history size
        if (this.errorHistory.length > 1000) {
          this.errorHistory = this.errorHistory.slice(-1000);
        }

        res.json({ success: true, message: "Error reported" });
      } catch (error) {
        console.error("Error reporting failed:", error);
        res.json({ success: false, error: error.message });
      }
    });

    // AI models endpoint (for listing available models)
    this.app.get("/api/models", async (req, res) => {
      try {
        const models = [];

        // Only fetch models from local Ollama instance
        if (this.ollamaAvailable) {
          try {
            const response = await fetch(`${this.ollamaEndpoint}/api/tags`);
            const data = await response.json();
            if (data.models) {
              models.push(
                ...data.models.map((m) => ({
                  id: m.name,
                  name: m.name,
                  type: "ollama",
                  active: true,
                }))
              );
            }
          } catch (e) {
            console.warn("Failed to fetch Ollama models:", e.message);
          }
        }

        // Return only local Ollama models - no cloud fallbacks
        res.json({ success: true, models });
      } catch (error) {
        console.error("Models endpoint error:", error);
        res.json({ success: false, error: error.message });
      }
    });

    // Cache management endpoints

    // Get cache metrics
    this.app.get("/api/cache/metrics", async (req, res) => {
      try {
        const metrics = this.scanCache.getMetrics();

        res.json({
          success: true,
          metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Cache metrics error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Clear cache
    this.app.post("/api/cache/clear", async (req, res) => {
      try {
        await this.scanCache.clear();

        res.json({
          success: true,
          message: "Cache cleared successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Cache clear error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Invalidate cache for specific directory
    this.app.post("/api/cache/invalidate", async (req, res) => {
      try {
        const { directoryPath } = req.body;

        if (!directoryPath) {
          return res.status(400).json({
            success: false,
            error: "directoryPath is required",
          });
        }

        await this.scanCache.invalidate(directoryPath);

        res.json({
          success: true,
          message: `Cache invalidated for ${directoryPath}`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Cache invalidate error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Set cache TTL
    this.app.post("/api/cache/ttl", async (req, res) => {
      try {
        const { ttl } = req.body; // TTL in milliseconds

        if (!ttl || typeof ttl !== "number" || ttl < 0) {
          return res.status(400).json({
            success: false,
            error: "Valid TTL (number in milliseconds) is required",
          });
        }

        this.scanCache.ttl = ttl;

        res.json({
          success: true,
          message: `Cache TTL set to ${ttl}ms`,
          ttl,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Cache TTL error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Scan profiles endpoints

    // Get all available scan profiles
    this.app.get("/api/profiles", (req, res) => {
      try {
        const profiles = this.scanProfileManager.getAllProfiles();

        res.json({
          success: true,
          profiles,
          defaultProfile: this.scanProfileManager.defaultProfile,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get profiles error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get specific scan profile
    this.app.get("/api/profiles/:profileName", (req, res) => {
      try {
        const { profileName } = req.params;
        const profile = this.scanProfileManager.getProfile(profileName);

        res.json({
          success: true,
          profile,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Create custom scan profile
    this.app.post("/api/profiles/custom", (req, res) => {
      try {
        const { name, options } = req.body;

        if (!name) {
          return res.status(400).json({
            success: false,
            error: "Profile name is required",
          });
        }

        const profile = this.scanProfileManager.createCustomProfile(name, options);
        const validation = this.scanProfileManager.validateProfile(profile);

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: "Invalid profile configuration",
            errors: validation.errors,
          });
        }

        res.json({
          success: true,
          profile,
          message: `Custom profile '${name}' created successfully`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Create custom profile error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get recommended profile for directory
    this.app.post("/api/profiles/recommend", (req, res) => {
      try {
        const { directorySize, fileCount } = req.body;

        if (!directorySize || !fileCount) {
          return res.status(400).json({
            success: false,
            error: "directorySize and fileCount are required",
          });
        }

        const recommendedProfile = this.scanProfileManager.getRecommendedProfile(
          directorySize,
          fileCount
        );
        const estimatedTime = this.scanProfileManager.estimateScanTime(
          directorySize,
          recommendedProfile
        );

        res.json({
          success: true,
          recommendedProfile,
          estimatedTime,
          estimatedTimeHuman: this.formatDuration(estimatedTime),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get profile recommendation error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // File preview endpoints

    // Get file preview
    this.app.post("/api/file/preview", async (req, res) => {
      try {
        const { filePath, options } = req.body;

        if (!filePath) {
          return res.status(400).json({
            success: false,
            error: "filePath is required",
          });
        }

        const preview = await this.filePreviewManager.getFilePreview(filePath, options);

        res.json({
          success: true,
          preview,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("File preview error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get file preview cache metrics
    this.app.get("/api/file/preview/metrics", (req, res) => {
      try {
        const metrics = this.filePreviewManager.getCacheMetrics();

        res.json({
          success: true,
          metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("File preview metrics error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Clear file preview cache
    this.app.post("/api/file/preview/clear", (req, res) => {
      try {
        this.filePreviewManager.clearCache();

        res.json({
          success: true,
          message: "File preview cache cleared successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Clear file preview cache error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Scan control endpoints

    // Pause scan
    this.app.post("/api/scan/pause", async (req, res) => {
      try {
        const { analysisId } = req.body;

        if (!analysisId) {
          return res.status(400).json({
            success: false,
            error: "analysisId is required",
          });
        }

        // Find scan by analysisId
        let scanId = null;
        for (const [sid, scan] of this.scanController.activeScans.entries()) {
          if (scan.analysisId === analysisId) {
            scanId = sid;
            break;
          }
        }

        if (!scanId) {
          return res.status(404).json({
            success: false,
            error: "No active scan found for this analysisId",
          });
        }

        const pausedScan = await this.scanController.pauseScan(scanId);

        // Update progress status
        const progressData = {
          analysisId,
          success: true,
          status: "paused",
          completed: false,
          currentFile: "Scan paused",
          progress: {
            status: "paused",
            currentFile: "Scan paused",
          },
        };

        this.activeAnalyses.set(analysisId, progressData);
        this.eventEmitter.emit("progress", progressData);

        res.json({
          success: true,
          scanId,
          message: "Scan paused successfully",
          scan: pausedScan,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Pause scan error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Resume scan
    this.app.post("/api/scan/resume", async (req, res) => {
      try {
        const { analysisId } = req.body;

        if (!analysisId) {
          return res.status(400).json({
            success: false,
            error: "analysisId is required",
          });
        }

        // Find paused scan by analysisId
        let scanId = null;
        for (const [sid, scan] of this.scanController.pausedScans.entries()) {
          if (scan.analysisId === analysisId) {
            scanId = sid;
            break;
          }
        }

        if (!scanId) {
          return res.status(404).json({
            success: false,
            error: "No paused scan found for this analysisId",
          });
        }

        const resumedScan = await this.scanController.resumeScan(scanId);

        // Update progress status
        const progressData = {
          analysisId,
          success: true,
          status: "resuming",
          completed: false,
          currentFile: "Resuming scan...",
          progress: {
            status: "resuming",
            currentFile: "Resuming scan...",
          },
        };

        this.activeAnalyses.set(analysisId, progressData);
        this.eventEmitter.emit("progress", progressData);

        // Restart the scan with checkpoint data
        this.restartAnalysisFromCheckpoint(analysisId, resumedScan);

        res.json({
          success: true,
          scanId,
          message: "Scan resumed successfully",
          scan: resumedScan,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Resume scan error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Stop scan
    this.app.post("/api/scan/stop", async (req, res) => {
      try {
        const { analysisId } = req.body;

        if (!analysisId) {
          return res.status(400).json({
            success: false,
            error: "analysisId is required",
          });
        }

        // Find scan by analysisId
        let scanId = null;
        let scan = null;

        // Check active scans
        for (const [sid, s] of this.scanController.activeScans.entries()) {
          if (s.analysisId === analysisId) {
            scanId = sid;
            scan = s;
            break;
          }
        }

        // Check paused scans
        if (!scanId) {
          for (const [sid, s] of this.scanController.pausedScans.entries()) {
            if (s.analysisId === analysisId) {
              scanId = sid;
              scan = s;
              break;
            }
          }
        }

        if (!scanId) {
          return res.status(404).json({
            success: false,
            error: "No scan found for this analysisId",
          });
        }

        const stoppedScan = await this.scanController.stopScan(scanId);

        // Update progress status
        const progressData = {
          analysisId,
          success: false,
          status: "stopped",
          completed: true,
          currentFile: "Scan stopped",
          error: "Scan stopped by user",
          progress: {
            status: "stopped",
            currentFile: "Scan stopped",
            error: "Scan stopped by user",
          },
        };

        this.activeAnalyses.set(analysisId, progressData);
        this.eventEmitter.emit("progress", progressData);

        res.json({
          success: true,
          scanId,
          message: "Scan stopped successfully",
          scan: stoppedScan,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Stop scan error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get scan status
    this.app.get("/api/scan/status/:analysisId", (req, res) => {
      try {
        const { analysisId } = req.params;

        // Find scan by analysisId
        let scan = null;
        let scanId = null;

        // Check active scans
        for (const [sid, s] of this.scanController.activeScans.entries()) {
          if (s.analysisId === analysisId) {
            scanId = sid;
            scan = s;
            break;
          }
        }

        // Check paused scans
        if (!scan) {
          for (const [sid, s] of this.scanController.pausedScans.entries()) {
            if (s.analysisId === analysisId) {
              scanId = sid;
              scan = s;
              break;
            }
          }
        }

        // Check scan history
        if (!scan) {
          for (const [sid, s] of this.scanController.scanHistory.entries()) {
            if (s.analysisId === analysisId) {
              scanId = sid;
              scan = s;
              break;
            }
          }
        }

        if (!scan) {
          return res.status(404).json({
            success: false,
            error: "No scan found for this analysisId",
          });
        }

        res.json({
          success: true,
          scanId,
          scan: {
            scanId: scan.scanId,
            analysisId: scan.analysisId,
            directoryPath: scan.directoryPath,
            status: scan.status,
            progress: scan.progress,
            createdAt: scan.createdAt,
            startedAt: scan.startedAt,
            pausedAt: scan.pausedAt,
            resumedAt: scan.resumedAt,
            completedAt: scan.completedAt,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get scan status error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get all scans
    this.app.get("/api/scans", (req, res) => {
      try {
        const metrics = this.scanController.getScanMetrics();
        const activeScans = this.scanController.getActiveScans();
        const pausedScans = this.scanController.getPausedScans();
        const scanHistory = this.scanController.getScanHistory();

        res.json({
          success: true,
          metrics,
          activeScans: activeScans.map((s) => ({
            scanId: s.scanId,
            analysisId: s.analysisId,
            directoryPath: s.directoryPath,
            status: s.status,
            progress: s.progress,
            createdAt: s.createdAt,
            startedAt: s.startedAt,
          })),
          pausedScans: pausedScans.map((s) => ({
            scanId: s.scanId,
            analysisId: s.analysisId,
            directoryPath: s.directoryPath,
            status: s.status,
            progress: s.progress,
            createdAt: s.createdAt,
            startedAt: s.startedAt,
            pausedAt: s.pausedAt,
          })),
          recentHistory: scanHistory.slice(-10).map((s) => ({
            scanId: s.scanId,
            analysisId: s.analysisId,
            directoryPath: s.directoryPath,
            status: s.status,
            progress: s.progress,
            createdAt: s.createdAt,
            completedAt: s.completedAt,
          })),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get all scans error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Scan filter endpoints

    // Get preset filters
    this.app.get("/api/filters/presets", (req, res) => {
      try {
        const presets = this.scanFilter.getPresetFilters();

        res.json({
          success: true,
          presets: Object.keys(presets).map((key) => ({
            key,
            name: presets[key].name,
            description: presets[key].description,
            filter: presets[key].filter,
          })),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get preset filters error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Create custom filter
    this.app.post("/api/filters/create", (req, res) => {
      try {
        const filterOptions = req.body;

        if (!filterOptions) {
          return res.status(400).json({
            success: false,
            error: "Filter options are required",
          });
        }

        const filter = this.scanFilter.createFilter(filterOptions);
        const summary = this.scanFilter.getFilterSummary(filter);

        res.json({
          success: true,
          filter,
          summary,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Create filter error:", error);
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Apply filter to existing results
    this.app.post("/api/filters/apply", async (req, res) => {
      try {
        const { results, filterOptions } = req.body;

        if (!results || !filterOptions) {
          return res.status(400).json({
            success: false,
            error: "Results and filter options are required",
          });
        }

        const filter = this.scanFilter.createFilter(filterOptions);
        const filteredResults = this.scanFilter.applyFilterToResults(results, filter);

        res.json({
          success: true,
          originalCount: results.files?.length || 0,
          filteredCount: filteredResults.files?.length || 0,
          results: filteredResults,
          filter: this.scanFilter.getFilterSummary(filter),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Apply filter error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Validate filter
    this.app.post("/api/filters/validate", (req, res) => {
      try {
        const filterOptions = req.body;

        if (!filterOptions) {
          return res.status(400).json({
            success: false,
            error: "Filter options are required",
          });
        }

        const filter = this.scanFilter.createFilter(filterOptions);

        res.json({
          success: true,
          valid: true,
          summary: this.scanFilter.getFilterSummary(filter),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          valid: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Configuration management endpoints

    // Get all configuration
    this.app.get("/api/config", (req, res) => {
      try {
        const config = this.configManager.getMergedConfig();
        const schema = this.configManager.getConfigSchema();

        res.json({
          success: true,
          config,
          schema,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get config error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get specific configuration value
    this.app.get("/api/config/:key", (req, res) => {
      try {
        const { key } = req.params;
        const value = this.configManager.get(key);

        res.json({
          success: true,
          key,
          value,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get config value error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Set configuration value
    this.app.post("/api/config/:key", async (req, res) => {
      try {
        const { key } = req.params;
        const { value, configType = "user" } = req.body;

        if (value === undefined) {
          return res.status(400).json({
            success: false,
            error: "Value is required",
          });
        }

        const saved = await this.configManager.set(key, value, configType);

        if (saved) {
          res.json({
            success: true,
            key,
            value,
            configType,
            message: "Configuration updated successfully",
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(500).json({
            success: false,
            error: "Failed to save configuration",
          });
        }
      } catch (error) {
        console.error("Set config error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Reset configuration
    this.app.post("/api/config/reset", async (req, res) => {
      try {
        const { key, configType = "user" } = req.body;

        const reset = await this.configManager.reset(key, configType);

        if (reset) {
          res.json({
            success: true,
            key: key || "all",
            configType,
            message: key
              ? `Configuration '${key}' reset to default`
              : "All configuration reset to defaults",
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(500).json({
            success: false,
            error: "Failed to reset configuration",
          });
        }
      } catch (error) {
        console.error("Reset config error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Export configuration
    this.app.get("/api/config/export/:format", async (req, res) => {
      try {
        const { format } = req.params;
        const exportedConfig = await this.configManager.exportConfig(format);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="config.${format}"`);
        res.send(exportedConfig);
      } catch (error) {
        console.error("Export config error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Import configuration
    this.app.post("/api/config/import/:format", async (req, res) => {
      try {
        const { format } = req.params;
        const configData = req.body;

        if (!configData) {
          return res.status(400).json({
            success: false,
            error: "Configuration data is required",
          });
        }

        await this.configManager.importConfig(configData, format);

        res.json({
          success: true,
          format,
          message: "Configuration imported successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Import config error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Backup configuration
    this.app.post("/api/config/backup", async (req, res) => {
      try {
        const backupFile = await this.configManager.backup();

        res.json({
          success: true,
          backupFile,
          message: "Configuration backed up successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Backup config error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Restore configuration
    this.app.post("/api/config/restore", async (req, res) => {
      try {
        const { backupFile } = req.body;

        if (!backupFile) {
          return res.status(400).json({
            success: false,
            error: "Backup file path is required",
          });
        }

        await this.configManager.restore(backupFile);

        res.json({
          success: true,
          backupFile,
          message: "Configuration restored successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Restore config error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get configuration schema
    this.app.get("/api/config/schema", (req, res) => {
      try {
        const schema = this.configManager.getConfigSchema();

        res.json({
          success: true,
          schema,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get config schema error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Analytics endpoints

    // Get real-time metrics
    this.app.get("/api/analytics/realtime", (req, res) => {
      try {
        const metrics = this.analyticsManager.realTimeMetrics;

        res.json({
          success: true,
          metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get realtime analytics error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get analytics summary
    this.app.get("/api/analytics/summary", (req, res) => {
      try {
        const { timeRange = "24h" } = req.query;
        const summary = this.analyticsManager.getAnalyticsSummary(timeRange);

        res.json({
          success: true,
          summary,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get analytics summary error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get detailed metrics
    this.app.get("/api/analytics/detailed", (req, res) => {
      try {
        const metrics = this.analyticsManager.getDetailedMetrics();

        res.json({
          success: true,
          metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Get detailed analytics error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Export analytics
    this.app.get("/api/analytics/export/:format", async (req, res) => {
      try {
        const { format } = req.params;
        const exportedData = await this.analyticsManager.exportAnalytics(format);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="analytics.${format}"`);
        res.send(exportedData);
      } catch (error) {
        console.error("Export analytics error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Clear analytics data
    this.app.post("/api/analytics/clear", async (req, res) => {
      try {
        await this.analyticsManager.clearAnalytics();

        res.json({
          success: true,
          message: "Analytics data cleared successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Clear analytics error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
  }

  findProjectRoot(startDir) {
    return findProjectRoot(startDir);
  }

  isValidPath(p) {
    return isValidPath(p);
  }

  /**
   * Optimized context payload builder following LLM best practices:
   * - Lost-in-the-middle: Critical info at beginning AND end
   * - Context budget: Concise, high-relevance data only
   * - Structured JSON: Better for Ollama 0.22.0 format
   * - Temperature 0: Deterministic outputs
   */
  buildOptimizedContextPayload(analysisData, query, options = {}) {
    const { includeHistory = true, maxTopFiles = 10, maxCategories = 8 } = options;

    // Extract and rank categories by size impact
    const rankedCategories = Object.entries(analysisData.categories || {})
      .map(([name, data]) => ({
        name,
        count: typeof data === "object" ? data.count || 0 : data,
        size: typeof data === "object" ? data.size || 0 : 0,
        impact: (typeof data === "object" ? data.size || 0 : 0) / (analysisData.totalSize || 1),
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, maxCategories);

    // Get top files by size (critical for cleanup recommendations)
    const topFiles = (analysisData.files || [])
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, maxTopFiles)
      .map((f) => ({
        name: f.name || f.path?.split("/").pop() || "unknown",
        path: f.path || "",
        size: f.size || 0,
        category: f.category || "Other",
        extension: f.extension || "",
      }));

    // Calculate storage efficiency metrics
    const totalSize = analysisData.totalSize || 0;
    const totalFiles = analysisData.totalFiles || 0;
    const avgFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;

    // Identify space hogs (>100MB or top 1% by size)
    const spaceHogThreshold = Math.max(100 * 1024 * 1024, totalSize * 0.01);
    const spaceHogs = topFiles.filter((f) => f.size > spaceHogThreshold);

    // Build optimized payload with critical info at BEGINNING and END
    const payload = {
      // [BEGIN] Critical summary first (lost-in-the-middle fix)
      _meta: {
        version: "2.0",
        format: "optimized",
        contextBudget: "concise",
        temperature: 0,
        returnAsJson: true,
      },

      critical_summary: {
        directory: analysisData.path || analysisData.analysisId || "Unknown",
        total_files: totalFiles,
        total_size_bytes: totalSize,
        total_size_human: this.formatBytes(totalSize),
        avg_file_size: Math.round(avgFileSize),
        space_hogs_count: spaceHogs.length,
        cleanup_potential: this.estimateCleanupPotential(analysisData, topFiles),
      },

      // [MIDDLE] Detailed breakdown
      storage_breakdown: {
        categories: rankedCategories.map((c) => ({
          name: c.name,
          file_count: c.count,
          size_bytes: c.size,
          size_human: this.formatBytes(c.size),
          percentage: Math.round(c.impact * 100 * 10) / 10,
          recommendation: this.getCategoryRecommendation(c.name, c.impact),
        })),

        top_space_consumers: topFiles.slice(0, 5).map((f) => ({
          file: f.name,
          size: this.formatBytes(f.size),
          category: f.category,
          action: f.size > spaceHogThreshold ? "REVIEW" : "MONITOR",
        })),
      },

      patterns: {
        largest_category: rankedCategories[0]?.name || "Unknown",
        largest_category_size: this.formatBytes(rankedCategories[0]?.size || 0),
        file_size_distribution: this.calculateSizeDistribution(analysisData.files || []),
        potential_duplicates: this.detectDuplicatePatterns(analysisData.files || []),
      },

      // [END] Query and action items (lost-in-the-middle fix)
      query: query || "Analyze storage and provide cleanup recommendations",

      expected_output: {
        format: "JSON",
        sections: [
          "immediate_actions",
          "cleanup_recommendations",
          "storage_optimization",
          "security_concerns",
        ],
        priority: "High impact, low effort first",
      },

      _instructions: [
        "Return response as JSON",
        "Focus on actionable recommendations",
        "Prioritize by size impact",
        "Include specific file paths",
        "Temperature 0 for consistency",
      ],
    };

    return payload;
  }

  /**
   * Estimate cleanup potential based on analysis
   */
  estimateCleanupPotential(analysisData, topFiles) {
    let potentialBytes = 0;

    // Estimate from node_modules and dependencies
    const deps = Object.entries(analysisData.categories || {}).find(
      ([name]) =>
        name.toLowerCase().includes("depend") || name.toLowerCase().includes("node_module")
    );
    if (deps) {
      potentialBytes += (typeof deps[1] === "object" ? deps[1].size : 0) * 0.3; // 30% can be cleaned
    }

    // Estimate from large duplicate-prone files
    const largeFiles = topFiles.filter((f) => f.size > 100 * 1024 * 1024);
    potentialBytes += largeFiles.reduce((sum, f) => sum + f.size * 0.2, 0);

    return {
      estimated_savings_bytes: Math.round(potentialBytes),
      estimated_savings_human: this.formatBytes(potentialBytes),
      percentage: Math.round((potentialBytes / (analysisData.totalSize || 1)) * 100 * 10) / 10,
    };
  }

  /**
   * Get category-specific recommendation
   */
  getCategoryRecommendation(categoryName, impact) {
    const recs = {
      Dependencies: impact > 0.3 ? "High priority: Audit unused packages" : "Monitor for bloat",
      Media: impact > 0.2 ? "Compress or move to cold storage" : "Organize by project",
      "Build Output": "Clean rebuild artifacts older than 30 days",
      Cache: "Clear if > 1GB",
      Logs: "Archive logs older than 90 days",
    };
    return recs[categoryName] || "Review for duplicates";
  }

  /**
   * Calculate file size distribution
   */
  calculateSizeDistribution(files) {
    const ranges = [
      { name: "Tiny (< 1KB)", max: 1024, count: 0 },
      { name: "Small (1KB - 1MB)", max: 1024 * 1024, count: 0 },
      { name: "Medium (1MB - 100MB)", max: 100 * 1024 * 1024, count: 0 },
      { name: "Large (100MB - 1GB)", max: 1024 * 1024 * 1024, count: 0 },
      { name: "Huge (> 1GB)", max: Infinity, count: 0 },
    ];

    files.forEach((f) => {
      const size = f.size || 0;
      for (const range of ranges) {
        if (size <= range.max) {
          range.count++;
          break;
        }
      }
    });

    return ranges.filter((r) => r.count > 0);
  }

  /**
   * Detect potential duplicate patterns
   */
  detectDuplicatePatterns(files) {
    // Group by name (excluding extension numbers)
    const baseNames = {};
    files.forEach((f) => {
      const name = (f.name || "").replace(/\s*\(\d+\)\s*/, "").toLowerCase();
      if (!baseNames[name]) baseNames[name] = [];
      baseNames[name].push(f);
    });

    const duplicates = Object.entries(baseNames)
      .filter(([_, group]) => group.length > 1)
      .map(([name, group]) => ({
        base_name: name,
        occurrences: group.length,
        total_size: this.formatBytes(group.reduce((s, f) => s + (f.size || 0), 0)),
        locations: group
          .slice(0, 3)
          .map((f) => f.path || "")
          .filter(Boolean),
      }));

    return duplicates.slice(0, 5); // Top 5 potential duplicates
  }

  // Legacy method kept for backward compatibility
  buildOllamaPrompt(analysisData, query) {
    // Extract semantic information from files for better AI context
    const semanticContext = this.extractSemanticContext(analysisData.files || []);

    const summary = `
Analysis Summary:
- Total Files: ${analysisData.totalFiles || 0}
- Total Size: ${this.formatBytes(analysisData.totalSize || 0)}
- Categories: ${Object.keys(analysisData.categories || {}).join(", ") || "None detected"}

Semantic Context:
- Primary Categories: ${semanticContext.primaryCategories.join(", ") || "None"}
- Key Technologies: ${semanticContext.technologies.join(", ") || "None"}
- Development Focus: ${semanticContext.developmentFocus.join(", ") || "None"}
- Platform Indicators: ${semanticContext.platforms.join(", ") || "None"}

Category Breakdown:
${
  Object.entries(analysisData.categories || {})
    .slice(0, 10)
    .map(
      ([cat, data]) => `- ${cat}: ${data.count || data} files (${this.formatBytes(data.size || 0)})`
    )
    .join("\n") || "None detected"
}

Largest Files:
${
  (analysisData.large_files || [])
    .slice(0, 5)
    .map((f) => `- ${f}`)
    .join("\n") || "None detected"
}

Storage Warnings:
${(analysisData.storage_warnings || []).join("\n") || "None"}

User Query: ${query || "Provide insights about this analysis"}
`;
    return summary;
  }

  extractSemanticContext(files) {
    const semanticTags = new Set();
    const subcategories = new Set();
    const categories = new Set();

    files.forEach((file) => {
      if (file.semantic_tags) {
        file.semantic_tags.forEach((tag) => semanticTags.add(tag));
      }
      if (file.subcategory) {
        subcategories.add(file.subcategory);
      }
      if (file.category) {
        categories.add(file.category);
      }
    });

    const allTags = Array.from(semanticTags);

    return {
      primaryCategories: Array.from(categories).slice(0, 5),
      technologies: allTags
        .filter((tag) =>
          [
            "javascript",
            "typescript",
            "python",
            "rust",
            "cpp",
            "java",
            "go",
            "php",
            "ruby",
            "swift",
            "kotlin",
            "scala",
            "csharp",
            "haskell",
            "dart",
            "lua",
            "r",
          ].includes(tag)
        )
        .slice(0, 5),
      developmentFocus: allTags
        .filter((tag) =>
          [
            "web",
            "mobile",
            "systems",
            "database",
            "scripting",
            "functional",
            "concurrent",
            "native",
            "typed",
            "data-science",
            "statistics",
            "embedded",
            "automation",
          ].includes(tag)
        )
        .slice(0, 5),
      platforms: allTags
        .filter((tag) =>
          [
            "windows",
            "linux",
            "macos",
            "ios",
            "android",
            "jvm",
            ".net",
            "apple",
            "microsoft",
            "unix",
          ].includes(tag)
        )
        .slice(0, 5),
    };
  }

  // Helper method to categorize files
  categorizeFile(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const categories = {
      // Images
      jpg: "Images",
      jpeg: "Images",
      png: "Images",
      gif: "Images",
      bmp: "Images",
      svg: "Images",
      webp: "Images",
      // Videos
      mp4: "Videos",
      avi: "Videos",
      mkv: "Videos",
      mov: "Videos",
      wmv: "Videos",
      flv: "Videos",
      // Audio
      mp3: "Audio",
      wav: "Audio",
      flac: "Audio",
      aac: "Audio",
      ogg: "Audio",
      m4a: "Audio",
      // Documents
      pdf: "Documents",
      doc: "Documents",
      docx: "Documents",
      txt: "Documents",
      rtf: "Documents",
      odt: "Documents",
      // Archives
      zip: "Archives",
      rar: "Archives",
      "7z": "Archives",
      tar: "Archives",
      gz: "Archives",
      // Code
      js: "Code",
      ts: "Code",
      tsx: "Code",
      jsx: "Code",
      py: "Code",
      java: "Code",
      cpp: "Code",
      c: "Code",
      cs: "Code",
      go: "Code",
      rs: "Code",
      // System
      exe: "System",
      dll: "System",
      sys: "System",
      bat: "System",
      sh: "System",
      ps1: "System",
    };
    return categories[ext] || "Other";
  }

  // Helper method to process batch operations asynchronously
  async processBatchOperations(operationId, operations) {
    const operation = this.batchOperations.get(operationId);
    if (!operation) return;

    const total = operations.length;
    let completed = 0;
    let failed = 0;

    for (const op of operations) {
      try {
        // Process operation based on type
        switch (op.type) {
          case "delete":
            // Implement delete logic if needed
            break;
          case "copy":
            // Implement copy logic if needed
            break;
          case "move":
            // Implement move logic if needed
            break;
          default:
            console.warn("Unknown operation type:", op.type);
        }
        completed++;
      } catch (error) {
        console.error("Operation failed:", error);
        failed++;
      }

      // Update progress
      operation.progress = Math.round(((completed + failed) / total) * 100);
      operation.completed = completed;
      operation.failed = failed;
      this.batchOperations.set(operationId, operation);

      // Small delay to prevent overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Mark as complete
    operation.status = "complete";
    this.batchOperations.set(operationId, operation);
  }

  // Query Ollama API with generic endpoint
  async queryOllamaAPI(endpoint, data = null) {
    return new Promise((resolve, reject) => {
      const http = require("http");

      const options = {
        hostname: "localhost",
        port: 11434,
        path: `/api/${endpoint}`,
        method: data ? "POST" : "GET",
        headers: data
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(JSON.stringify(data)),
            }
          : {},
      };

      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            if (body.trim()) {
              resolve(JSON.parse(body));
            } else {
              reject(new Error("Empty response from Ollama API"));
            }
          } catch (e) {
            console.error("API Response parsing error:", e.message);
            console.error("Response body:", body.substring(0, 200));
            reject(new Error("Invalid Ollama API response"));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  async queryOllama(prompt) {
    return new Promise((resolve, reject) => {
      const http = require("http");

      const data = JSON.stringify({
        model: "llama3.2",
        prompt: `You are a file storage optimization expert. Analyze this data and provide actionable insights:\n\n${prompt}`,
        stream: false,
      });

      const req = http.request(
        {
          hostname: "localhost",
          port: 11434,
          path: "/api/generate",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": data.length,
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(body);
              resolve(json.response || json);
            } catch (e) {
              reject(new Error("Invalid Ollama response"));
            }
          });
        }
      );

      req.on("error", reject);
      req.write(data);
      req.end();
    });
  }

  // Query Ollama with specific model selection
  async queryOllamaWithModel(prompt, model) {
    const data = {
      model: model,
      prompt: `You are a file storage optimization expert. Analyze this data and provide actionable insights:\n\n${prompt}`,
      stream: false,
      options: {
        temperature: 0.3, // Lower temperature for more consistent responses
        top_p: 0.9,
        num_predict: 1024, // Reasonable response length
      },
    };

    try {
      const response = await this.queryOllamaAPI("generate", data);

      // Extract all relevant fields from Ollama response
      return {
        response: response.response || response,
        thinking: response.thinking || null,
        done_reason: response.done_reason || null,
        model: response.model || model,
        created_at: response.created_at || null,
        total_duration: response.total_duration || null,
        load_duration: response.load_duration || null,
        prompt_eval_count: response.prompt_eval_count || null,
        prompt_eval_duration: response.prompt_eval_duration || null,
        eval_count: response.eval_count || null,
        eval_duration: response.eval_duration || null,
      };
    } catch (error) {
      console.error(`Ollama query failed with model ${model}:`, error.message);
      throw error;
    }
  }

  // --- NATURAL LANGUAGE QUERY & CLEANUP METHODS ---

  /**
   * Generate AI cleanup recommendations for files
   */
  async generateCleanupRecommendations(analysisData, targetSavings = null) {
    const recommendations = [];
    const files = analysisData.files || [];

    // Heuristic-based pre-filtering for efficiency
    const candidateFiles = this.identifyCleanupCandidates(files, targetSavings);

    // Batch analyze top candidates with Ollama
    const topCandidates = candidateFiles.slice(0, 20); // Analyze top 20

    for (const file of topCandidates) {
      try {
        const prompt = `Evaluate this file for safe deletion. Consider:
1. Is it a temporary/cache file?
2. Is it a duplicate or old version?
3. Is it safe to delete without breaking anything?

File: ${file.name}
Path: ${file.path}
Size: ${file.size} bytes
Category: ${file.category}

Respond with JSON:
{
  "safeToDelete": true/false,
  "confidence": 0.0-1.0,
  "type": "safe_to_delete|review|archive|duplicate",
  "reasoning": "brief explanation",
  "potentialSavings": ${file.size}
}`;

        const response = await fetch(`${this.config.ollamaHost}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "phi4-mini:latest",
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.1,
              num_predict: 200,
            },
          }),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const text = data.response || data.message?.content || "";

        // Extract JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          recommendations.push({
            filePath: file.path,
            fileSize: file.size,
            type: result.type || "review",
            confidence: result.confidence || 0.5,
            reasoning: result.reasoning || "No specific reasoning provided",
            potentialSavings: result.potentialSavings || file.size,
            safeToDelete: result.safeToDelete || false,
          });
        }
      } catch (err) {
        // Skip files that fail analysis
        continue;
      }
    }

    // Sort by confidence and potential savings
    return recommendations.sort((a, b) => {
      const scoreA = a.confidence * a.potentialSavings;
      const scoreB = b.confidence * b.potentialSavings;
      return scoreB - scoreA;
    });
  }

  /**
   * Identify cleanup candidate files using heuristics
   */
  identifyCleanupCandidates(files, targetSavings) {
    const candidates = [];
    const commonTempPatterns = [".tmp", ".temp", ".cache", ".log", ".bak", "~", ".old"];
    const largeThreshold = 100 * 1024 * 1024; // 100MB

    for (const file of files) {
      let score = 0;

      // Size factor (larger files = more savings)
      if (file.size > largeThreshold) score += 3;
      else if (file.size > 10 * 1024 * 1024) score += 2;
      else if (file.size > 1024 * 1024) score += 1;

      // Temp/cache patterns
      const name = file.name?.toLowerCase() || "";
      if (commonTempPatterns.some((p) => name.includes(p))) score += 2;

      // Common temp directories
      const path = file.path?.toLowerCase() || "";
      if (path.includes("temp") || path.includes("cache") || path.includes("tmp")) score += 2;

      // Duplicate indicators
      if (name.match(/\(\d+\)/) || name.match(/copy/)) score += 1;

      // Add if score > 0
      if (score > 0) {
        candidates.push({ ...file, cleanupScore: score });
      }
    }

    // Sort by score and size
    return candidates.sort((a, b) => {
      if (b.cleanupScore !== a.cleanupScore) return b.cleanupScore - a.cleanupScore;
      return b.size - a.size;
    });
  }

  /**
   * Parse natural language query using Ollama
   * Converts user query to structured filter criteria
   */
  async parseNaturalLanguageQuery(userQuery) {
    const prompt = `Parse this natural language file query into structured filters.
Available file properties: name, path, size, extension, category, modified date

Examples:
"Find videos from 2023 larger than 500MB"
→ {"extensions": ["mp4", "avi", "mov"], "dateFrom": "2023-01-01", "dateTo": "2023-12-31", "minSize": 524288000}

"Show old documents not opened in 2 years"
→ {"categories": ["Documents"], "lastAccessedBefore": "2 years ago"}

"Big code files over 10MB"
→ {"categories": ["Code"], "minSize": 10485760}

Now parse this query: "${userQuery}"

Respond ONLY with JSON object containing these optional fields:
- extensions: array of file extensions
- categories: array of categories
- minSize: size in bytes
- maxSize: size in bytes
- dateFrom: YYYY-MM-DD
- dateTo: YYYY-MM-DD
- lastAccessedBefore: relative time like "6 months ago"
- nameContains: substring to search in filename

JSON response:`;

    try {
      const response = await fetch(`${this.config.ollamaHost}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "phi4-mini:latest",
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 200,
          },
        }),
      });

      if (!response.ok) throw new Error("Ollama parse failed");

      const data = await response.json();
      const text = data.response || data.message?.content || "";

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: return basic search
      return { nameContains: userQuery };
    } catch (err) {
      console.error("NL query parse error:", err);
      return { nameContains: userQuery }; // Fallback
    }
  }

  /**
   * Execute parsed query against file list
   */
  executeFileQuery(files, query) {
    return files
      .filter((file) => {
        // Extension filter
        if (query.extensions && query.extensions.length > 0) {
          const ext = file.name?.split(".").pop()?.toLowerCase();
          if (!query.extensions.includes(ext)) return false;
        }

        // Category filter
        if (query.categories && query.categories.length > 0) {
          if (!query.categories.includes(file.category)) return false;
        }

        // Size filters
        if (query.minSize && file.size < query.minSize) return false;
        if (query.maxSize && file.size > query.maxSize) return false;

        // Name contains
        if (query.nameContains) {
          const search = query.nameContains.toLowerCase();
          if (
            !file.name?.toLowerCase().includes(search) &&
            !file.path?.toLowerCase().includes(search)
          )
            return false;
        }

        // Date filters (simplified)
        if (query.dateFrom || query.dateTo) {
          // Would need actual date parsing from file.mtime
          // Simplified for now
        }

        return true;
      })
      .sort((a, b) => b.size - a.size); // Sort by size desc
  }

  buildOllamaPrompt(contextData, question) {
    let context = `Context Analysis of Directory: ${contextData.analysisId || "Current"}\n`;
    context += `Total Files: ${contextData.totalFiles}, Total Size: ${(contextData.totalSize / 1024 / 1024).toFixed(2)} MB\n`;

    // Add File Structure Context
    if (contextData.dependencyGraph) {
      const nodes = contextData.dependencyGraph.nodes;
      const edges = contextData.dependencyGraph.edges;

      context += `\nFile Structure & Dependencies:\n`;
      context += `- Tracked Files: ${nodes.length}\n`;
      context += `- Detected Relationships: ${edges.length}\n`;

      // summarize top dependencies
      const imports = edges.filter((e) => e.type === "import");
      if (imports.length > 0) {
        context += `- Key Import/Dependency Flows:\n`;
        // Show top 20 imports
        imports.slice(0, 20).forEach((edge) => {
          const from = nodes.find((n) => n.id === edge.from)?.name;
          const to = nodes.find((n) => n.id === edge.to)?.name;
          if (from && to) context += `  * ${from} imports ${to}\n`;
        });
      }

      // summarize directory structure (top level)
      const rootDirs = nodes.filter(
        (n) => n.type === "directory" && !n.path.includes("/", n.path.indexOf("/") + 1)
      ); // approximate top level
      if (rootDirs.length > 0) {
        context += `- Top Level Directories: ${rootDirs.map((n) => n.name).join(", ")}\n`;
      }
    }

    // Add existing insights
    if (contextData.ai_insights) {
      context += `\nAI Detected Insights:\n`;
      if (contextData.ai_insights.large_files?.length) {
        context += `- Large Files: ${contextData.ai_insights.large_files.slice(0, 5).join(", ")}\n`;
      }
      if (contextData.ai_insights.dependency_candidates?.length) {
        context += `- Project Configs: ${contextData.ai_insights.dependency_candidates.join(", ")}\n`;
      }
    }

    return `You are an expert software architect and file system analyst.
Use the following context about the user's project to answer their question.
Focus on file relationships, structure, and storage impact.

${context}

User Question: "${question}"
Answer:`;
  }

  generateAIInsights(rustData) {
    const insights = {
      recommended_categories: [],
      potential_duplicates: [],
      large_files: [],
      unusual_extensions: [],
      dependency_candidates: [],
      storage_warnings: [],
      optimization_suggestions: [],
    };

    if (!rustData.files) return insights;

    // Find large files (> 10MB)
    const largeFiles = rustData.files
      .filter((f) => f.size > 10 * 1024 * 1024)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    insights.large_files = largeFiles.map((f) => f.path);

    // Find unusual extensions
    const commonExtensions = [
      "js",
      "ts",
      "py",
      "java",
      "cpp",
      "c",
      "h",
      "html",
      "css",
      "json",
      "md",
      "txt",
      "png",
      "jpg",
      "gif",
    ];
    const unusualExtensions = rustData.extensionStats
      ? Object.entries(rustData.extensionStats)
          .filter(([ext, data]) => !commonExtensions.includes(ext) && data.count > 0)
          .map(([ext]) => ext)
      : [];
    insights.unusual_extensions = unusualExtensions.slice(0, 10);

    // Suggest categories
    if (rustData.categories) {
      const categories = Object.keys(rustData.categories);
      if (
        !categories.includes("Code") &&
        categories.some((c) => c.toLowerCase().includes("src") || c.toLowerCase().includes("code"))
      ) {
        insights.recommended_categories.push(
          'Consider creating a "Code" category for source files'
        );
      }
    }

    // Find potential duplicates
    const nameGroups = Object.create(null);
    rustData.files.forEach((f) => {
      const baseName = f.name.replace(/\.(js|ts|py|java|cpp|c|h|html|css|json|md|txt)$/i, "");
      if (!nameGroups[baseName]) {
        nameGroups[baseName] = [f.path];
      } else {
        nameGroups[baseName].push(f.path);
      }
    });
    Object.entries(nameGroups).forEach(([name, paths]) => {
      if (paths.length > 1 && paths.length <= 3) {
        insights.potential_duplicates.push(...paths.slice(0, -1));
      }
    });

    // Dependency candidates
    const depFiles = rustData.files
      .filter((f) =>
        [
          "package.json",
          "requirements.txt",
          "Pipfile",
          "pyproject.toml",
          "Cargo.toml",
          "go.mod",
        ].includes(f.name)
      )
      .map((f) => f.path);
    insights.dependency_candidates = depFiles;

    // Storage warnings
    const totalGB = (rustData.totalSize || rustData.total_size || 0) / (1024 * 1024 * 1024);
    if (totalGB > 10) {
      insights.storage_warnings.push(`Directory size exceeds 10GB (${totalGB.toFixed(2)}GB)`);
    }

    // Optimization suggestions
    if (rustData.files && rustData.files.some((f) => f.path.includes("node_modules"))) {
      insights.optimization_suggestions.push(
        "node_modules detected - can be safely excluded from backups"
      );
    }
    if (rustData.files && rustData.files.some((f) => f.name.endsWith(".zip"))) {
      insights.optimization_suggestions.push(
        "ZIP archives found - consider extracting for better organization"
      );
    }

    return insights;
  }

  convertToCSV(data) {
    return convertToCSV(data);
  }

  convertToTXT(data) {
    return convertToTXT(data, formatBytes);
  }

  formatBytes(bytes) {
    return formatBytes(bytes);
  }

  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)}m`;
    } else {
      return `${(ms / 3600000).toFixed(1)}h`;
    }
  }

  async runAnalysisAsync(analysisId, directoryPath, options) {
    // Check cache first for incremental scanning
    if (options.incremental !== false) {
      const cachedResult = await this.scanCache.get(directoryPath, options);
      if (cachedResult) {
        console.log(`🎯 Using cached result for ${directoryPath}`);

        // Update progress with cached data
        const progressData = {
          analysisId,
          success: true,
          files: cachedResult.total_files || 0,
          filesProcessed: cachedResult.total_files || 0,
          totalSize: cachedResult.total_size || 0,
          percentage: 100,
          currentFile: "Loaded from cache",
          status: "completed",
          completed: true,
          startTime: Date.now(),
          cached: true,
          progress: {
            filesProcessed: cachedResult.total_files || 0,
            totalSize: cachedResult.total_size || 0,
            percentage: 100,
            currentFile: "Loaded from cache",
            status: "completed",
          },
        };

        this.activeAnalyses.set(analysisId, progressData);
        this.eventEmitter.emit("progress", progressData);

        return cachedResult;
      }
    }

    const cppPath = await this.findCppExecutable();
    let result;

    if (cppPath) {
      console.log(`🚀 Using Rust CLI Backend: ${cppPath}`);
      result = await this.runCppAnalysis(analysisId, directoryPath, options);
    } else {
      console.log("⚠️ Falling back to JS Analysis");
      result = await this.runJsAnalysis(analysisId, directoryPath);
    }

    // Cache the result for future incremental scans
    if (result && options.incremental !== false) {
      await this.scanCache.set(directoryPath, result, options);
    }

    return result;
  }

  async findCppExecutable() {
    const serverDir = __dirname;
    console.log(`🔍 findCppExecutable: serverDir = ${serverDir}`);
    const searchPaths = [__dirname, path.join(__dirname, "..", "..")];

    // Only search for Rust CLI executable
    const executableNames = ["space-analyzer.exe"];

    const searchSubdirs = ["bin"];

    for (const baseDir of searchPaths) {
      for (const subdir of searchSubdirs) {
        const searchDir = path.join(baseDir, subdir);
        console.log(`🔍 Searching in: ${searchDir}`);
        if (existsSync(searchDir)) {
          for (const execName of executableNames) {
            const execPath = path.join(searchDir, execName);
            if (existsSync(execPath)) {
              console.log(`Found executable: ${execPath}`);
              return execPath;
            }
          }
        }
      }
    }

    console.log("No analysis executable found");
    return null;
  }

  async runCppAnalysis(analysisId, directoryPath, options) {
    // Apply scan profile configuration
    const profile = this.scanProfileManager.getProfileForOptions(options);
    const mergedOptions = { ...options, ...profile.options };

    // Apply scan filter if provided
    let filter = null;
    let filterArgs = [];
    if (options.filter) {
      filter = this.scanFilter.createFilter(options.filter);
      filterArgs = this.scanFilter.buildRustArgs(filter);
      console.log(`🔍 Applying scan filter:`, this.scanFilter.getFilterSummary(filter));
    }

    console.log(`🔧 Using scan profile: ${profile.options.profile}`);
    console.log(`🔧 Profile options:`, JSON.stringify(profile.options, null, 2));

    return new Promise(async (resolve, reject) => {
      try {
        const exePath = await this.findCppExecutable();
        if (!exePath) {
          return reject(new Error("Analysis executable missing"));
        }

        console.log(`🔧 Using executable: ${exePath}`);

        // Use Rust CLI format (--format json)
        const tempFile = path.join(__dirname, `output_${analysisId}.json`);
        commandName = "Rust CLI";
        args = [directoryPath, "--format", "json", "--output", tempFile];
        console.log(`🔧 Using Rust CLI arguments: ${args.join(" ")}`);

        // Add filter arguments if provided
        if (filterArgs.length > 0) {
          args.push(...filterArgs);
        }

        // Add options
        if (mergedOptions.hidden && !args.includes("--hidden")) {
          args.push("--hidden");
        }
        if (mergedOptions.parallel && !args.includes("--parallel")) {
          args.push("--parallel");
        }
        if (mergedOptions.duplicates && !args.includes("--duplicates")) {
          args.push("--duplicates");
        }
        if (mergedOptions.maxHashSize && !args.includes("--max-hash-size")) {
          args.push("--max-hash-size", mergedOptions.maxHashSize.toString());
        }
        if (mergedOptions.maxFiles && !args.includes("--max-files")) {
          args.push("--max-files", mergedOptions.maxFiles.toString());
        }
        if (mergedOptions.usnIncremental && !args.includes("--usn-incremental")) {
          args.push("--usn-incremental");
        }
        if (mergedOptions.mftFast && !args.includes("--mft-fast")) {
          args.push("--mft-fast");
        }

        console.log(`🎬 Spawning ${commandName}: ${exePath} ${args.join(" ")}`);
        const proc = spawn(exePath, args);

        proc.on("error", (err) => {
          console.error(`💥 ${commandName} Spawn Error:`, err);
          reject(err);
        });

        let stderrOutput = "";
        let scannedFileCount = 0;

        proc.stderr.on("data", (data) => {
          const stderr = data.toString();
          stderrOutput += stderr;
          console.error(`🔴 ${commandName} Stderr: ${stderr.trim()}`);

          // Parse progress from stderr - actual format from Rust CLI
          // Format: "Scanned: NNNN files, Size: XXXXXXXXXX (hard link savings: YYYYY) - Current: C:\path\to\file"
          const scannedMatch = stderr.match(/Scanned:\s*(\d+)\s*files,\s*Size:\s*(\d+)/i);
          if (scannedMatch) {
            scannedFileCount = parseInt(scannedMatch[1]);
            cumulativeSize = parseInt(scannedMatch[2]);

            // Extract current file path
            const currentFileMatch = stderr.match(/Current:\s*(.+)/);
            let currentFilePath = "Scanning...";
            if (currentFileMatch) {
              currentFilePath = currentFileMatch[1].trim();
            }

            const now = Date.now();

            // Calculate scan speed (files per second)
            const timeDelta = now - lastUpdateTime;
            const fileDelta = scannedFileCount - lastFileCount;
            let scanSpeed = 0;
            if (timeDelta > 0 && fileDelta > 0) {
              scanSpeed = (fileDelta / timeDelta) * 1000; // files per second
              scanSpeedHistory.push(scanSpeed);
              // Keep only last 10 measurements for moving average
              if (scanSpeedHistory.length > 10) {
                scanSpeedHistory.shift();
              }
            }

            // Update tracking variables
            lastFileCount = scannedFileCount;
            lastUpdateTime = now;

            // Enhanced estimation algorithm
            if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
              lastProgressUpdate = now;

              // Calculate average scan speed
              let avgScanSpeed = 0;
              if (scanSpeedHistory.length > 0) {
                avgScanSpeed =
                  scanSpeedHistory.reduce((a, b) => a + b, 0) / scanSpeedHistory.length;
              }

              // Dynamic total estimation based on scan speed and elapsed time
              const elapsed = now - startTime;
              if (avgScanSpeed > 0 && elapsed > 5000) {
                // After 5 seconds of scanning
                // Estimate total based on current speed and typical scan patterns
                const speedBasedEstimate = (scannedFileCount / elapsed) * 60000; // Files per minute extrapolation
                const depthMultiplier = 1 + directoryDepth * 0.1; // Account for directory depth

                // Use weighted average of current estimate and speed-based estimate
                const newEstimate = Math.ceil(
                  estimatedTotal * 0.7 + speedBasedEstimate * depthMultiplier * 0.3
                );
                estimatedTotal = Math.max(estimatedTotal, newEstimate);
              } else if (scannedFileCount > estimatedTotal) {
                // Simple fallback: increase estimate if we exceed current estimate
                estimatedTotal = Math.ceil(scannedFileCount * 1.2);
              }

              // Calculate time remaining estimate
              let timeRemaining = 0;
              if (avgScanSpeed > 0) {
                const remainingFiles = estimatedTotal - scannedFileCount;
                timeRemaining = Math.ceil(remainingFiles / avgScanSpeed);
              }

              const percentage = Math.min((scannedFileCount / estimatedTotal) * 100, 95);

              // Get file preview for current file (non-blocking)
              let filePreview = null;
              if (
                currentFilePath &&
                currentFilePath !== "Scanning..." &&
                !currentFilePath.includes("files")
              ) {
                this.filePreviewManager
                  .getFilePreview(currentFilePath, {
                    includeHash: false,
                    includeTextPreview: false,
                    previewLines: 3,
                  })
                  .then((preview) => {
                    filePreview = preview;
                  })
                  .catch((previewError) => {
                    // Don't let preview errors break progress updates
                    console.warn(`Preview error for ${currentFilePath}:`, previewError.message);
                  });
              }

              const progressData = {
                analysisId,
                success: true,
                files: estimatedTotal,
                filesProcessed: scannedFileCount,
                totalSize: cumulativeSize,
                percentage: Math.round(percentage),
                currentFile: currentFilePath,
                status: "analyzing",
                completed: false,
                startTime: startTime,
                scanSpeed: Math.round(avgScanSpeed),
                timeRemaining: timeRemaining,
                filePreview: filePreview,
                progress: {
                  filesProcessed: scannedFileCount,
                  totalSize: cumulativeSize,
                  percentage: Math.round(percentage),
                  currentFile: currentFilePath,
                  status: "analyzing",
                  scanSpeed: Math.round(avgScanSpeed),
                  timeRemaining: timeRemaining,
                  filePreview: filePreview,
                },
              };

              this.activeAnalyses.set(analysisId, progressData);
              this.eventEmitter.emit("progress", progressData);
            }
          }

          // Format 2: "Processing file N" or similar
          const processingMatch = stderr.match(/Processing\s+file\s+(\d+)/i);
          if (processingMatch) {
            const current = parseInt(processingMatch[1]);
            scannedFileCount = Math.max(scannedFileCount, current);
            const now = Date.now();

            if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
              lastProgressUpdate = now;
              const percentage = Math.min((current / estimatedTotal) * 100, 95);

              let args = [...profile.rustArgs];

              // Add directory path
              args.push(directoryPath);

              // Add any additional custom arguments that aren't already covered by the profile
              if (mergedOptions.maxDepth && !args.includes("--max-depth")) {
                args.push("--max-depth", mergedOptions.maxDepth.toString());
              }
              if (mergedOptions.includeHidden && !args.includes("--hidden")) {
                args.push("--hidden");
              }
              if (mergedOptions.parallel && !args.includes("--parallel")) {
                args.push("--parallel");
              }
              if (mergedOptions.duplicates && !args.includes("--duplicates")) {
                args.push("--duplicates");
              }
              if (mergedOptions.maxHashSize && !args.includes("--max-hash-size")) {
                args.push("--max-hash-size", mergedOptions.maxHashSize.toString());
              }
              if (mergedOptions.maxFiles && !args.includes("--max-files")) {
                args.push("--max-files", mergedOptions.maxFiles.toString());
              }
              if (mergedOptions.usnIncremental && !args.includes("--usn-incremental")) {
                args.push("--usn-incremental");
              }
              if (mergedOptions.mftFast && !args.includes("--mft-fast")) {
                args.push("--mft-fast");
              }

              // For non-Rust CLI, just use directory path
              if (!isRustCLI) {
                args = [directoryPath];
              }

              const progressData = {
                analysisId,
                success: true,
                files: estimatedTotal,
                filesProcessed: current,
                totalSize: cumulativeSize,
                percentage: Math.round(percentage),
                currentFile: `Processing file ${current}`,
                status: "analyzing",
                completed: false,
                startTime: Date.now(),
                progress: {
                  filesProcessed: current,
                  totalSize: cumulativeSize,
                  percentage: Math.round(percentage),
                  currentFile: `Processing file ${current}`,
                  status: "analyzing",
                },
              };

              this.activeAnalyses.set(analysisId, progressData);
              this.eventEmitter.emit("progress", progressData);
            }
          }
        });

        proc.on("close", async (code) => {
          console.log(`🏁 ${commandName} finished with code ${code}`);
          if (code !== 0) {
            console.error(`❌ ${commandName} failed with exit code ${code}`);
            console.error(`   Directory: ${directoryPath}`);
            console.error(`   Args: ${args.join(" ")}`);
            console.error(`   Stderr: ${stderrOutput}`);

            // Enhanced error handling with retry logic
            const retryCount = options.retryCount || 0;
            const maxRetries = options.maxRetries || 2;

            // Check for partial results
            if (existsSync(tempFile)) {
              try {
                const partialContent = await fsPromises.readFile(tempFile, "utf8");
                const partialData = JSON.parse(partialContent);

                // Emit partial results if available
                if (partialData.files && partialData.files.length > 0) {
                  console.log(`📊 Partial results available: ${partialData.files.length} files`);

                  const partialProgressData = {
                    analysisId,
                    success: true,
                    files: partialData.total_files || scannedFileCount,
                    filesProcessed: partialData.files.length,
                    totalSize: partialData.total_size || cumulativeSize,
                    percentage: Math.round(
                      (partialData.files.length / (partialData.total_files || scannedFileCount)) *
                        100
                    ),
                    currentFile: "Scan failed - partial results",
                    status: "partial",
                    completed: true,
                    startTime: startTime,
                    error: `Scan failed with exit code ${code}`,
                    partialResults: true,
                    progress: {
                      filesProcessed: partialData.files.length,
                      totalSize: partialData.total_size || cumulativeSize,
                      percentage: Math.round(
                        (partialData.files.length / (partialData.total_files || scannedFileCount)) *
                          100
                      ),
                      currentFile: "Scan failed - partial results",
                      status: "partial",
                    },
                  };

                  this.activeAnalyses.set(analysisId, partialProgressData);
                  this.eventEmitter.emit("progress", partialProgressData);

                  // Convert partial results to expected format
                  const convertedPartialData = isRustCLI
                    ? await this.convertRustOutputToWebFormat(partialData, analysisId, false)
                    : partialData;

                  await fsPromises.unlink(tempFile).catch(() => {});
                  resolve(convertedPartialData);
                  return;
                }
              } catch (parseError) {
                console.error(`⚠️ Could not parse partial results: ${parseError.message}`);
              }
            }

            // Retry logic for common errors
            if (retryCount < maxRetries) {
              const retryableErrors = [
                /Access Denied/i,
                /Permission denied/i,
                /The process cannot access/i,
                /Device or resource busy/i,
                /Network path not found/i,
              ];

              const isRetryable = retryableErrors.some((regex) => regex.test(stderrOutput));

              if (isRetryable) {
                console.log(`🔄 Retrying scan (attempt ${retryCount + 1}/${maxRetries + 1})...`);

                // Wait before retry with exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delay));

                // Retry the analysis
                try {
                  const retryOptions = { ...options, retryCount: retryCount + 1 };
                  const retryResult = await this.runCppAnalysis(
                    analysisId,
                    directoryPath,
                    retryOptions
                  );
                  resolve(retryResult);
                  return;
                } catch (retryError) {
                  console.error(`❌ Retry attempt ${retryCount + 1} failed: ${retryError.message}`);
                }
              }
            }

            // Create error progress data
            const errorProgressData = {
              analysisId,
              success: false,
              files: 0,
              filesProcessed: scannedFileCount,
              totalSize: cumulativeSize,
              percentage: 0,
              currentFile: "Scan failed",
              status: "error",
              completed: true,
              startTime: startTime,
              error: `Scan failed with exit code ${code}: ${stderrOutput}`,
              progress: {
                filesProcessed: scannedFileCount,
                totalSize: cumulativeSize,
                percentage: 0,
                currentFile: "Scan failed",
                status: "error",
              },
            };

            this.activeAnalyses.set(analysisId, errorProgressData);
            this.eventEmitter.emit("progress", errorProgressData);

            reject(new Error(`${commandName} failed with exit code ${code}: ${stderrOutput}`));
            return;
          }

          // Success case
          try {
            if (existsSync(tempFile)) {
              const content = await fsPromises.readFile(tempFile, "utf8");
              const data = JSON.parse(content);
              await fsPromises.unlink(tempFile).catch(() => {});

              // Rust CLI outputs standard format, convert to web format
              const convertedData = await this.convertRustOutputToWebFormat(
                data,
                analysisId,
                false
              );
              resolve(convertedData);
            } else {
              reject(new Error("Output file not created"));
            }
          } catch (e) {
            console.error(`❌ Failed to parse ${commandName} output:`, e);
            reject(e);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async convertRustOutputToWebFormat(rustData, analysisId, isMlSummary = false) {
    if (isMlSummary) {
      // ML Summary format: features + distributions, minimal file data
      return {
        totalFiles: rustData.ml_summary?.metadata?.total_files || 0,
        totalSize: rustData.ml_summary?.metadata?.total_size_bytes || 0,
        files: rustData.ml_summary?.sampling?.sample_files || [],
        categories: this.convertCategoryDistribution(
          rustData.ml_summary?.features?.category_distribution || {}
        ),
        extensionStats: this.convertExtensionDistribution(
          rustData.ml_summary?.features?.extension_distribution || {}
        ),
        analysisType: "cli-ml-summary",
        analysisTime: 0,
        mlFeatures: rustData.ml_summary?.features || {},
        ai_insights: rustData.ml_summary?.insights || {},
      };
    }

    // Standard format
    // Scan for dependencies
    let dependencyGraph = { nodes: [], edges: [] };
    if (rustData.files && rustData.files.length > 0) {
      dependencyGraph = await dependencyScanner.scan(rustData.files);
    }

    const insights = this.generateAIInsights(rustData);

    // Calculate Windows API summary stats
    const files = rustData.files || [];
    let hardLinkCount = 0;
    let hardLinkSavings = 0;
    let adsCount = 0;
    let compressedCount = 0;
    let compressedSavings = 0;
    let sparseCount = 0;
    let reparsePointCount = 0;

    files.forEach((file) => {
      if (file.is_hard_link) hardLinkCount++;
      if (file.has_ads) adsCount++;
      if (file.is_compressed) {
        compressedCount++;
        if (file.compressed_size && file.size) {
          compressedSavings += file.size - file.compressed_size;
        }
      }
      if (file.is_sparse) sparseCount++;
      if (file.is_reparse_point) reparsePointCount++;
    });

    const windowsStats = {
      hardLinkCount,
      hardLinkSavings: rustData.hard_link_savings || 0,
      adsCount,
      compressedCount,
      compressedSavings,
      sparseCount,
      reparsePointCount,
    };

    return {
      totalFiles: rustData.total_files || rustData.totalFiles || 0,
      totalSize: rustData.total_size || rustData.totalSize || 0,
      files: rustData.files || [],
      categories: rustData.categories || {},
      extensionStats: rustData.extension_stats || rustData.extensionStats || {},
      analysisType: rustData.analysis_type || rustData.analysisType || "quick",
      analysisTime: rustData.analysis_duration || rustData.analysisTime || 0,
      analysisId: analysisId,
      ai_insights: insights,
      // Inject Dependency Graph
      dependencyGraph: dependencyGraph,
      windowsStats,
      mlFeatures: {
        category_distribution: rustData.categories
          ? Object.fromEntries(Object.entries(rustData.categories).map(([k, v]) => [k, v.count]))
          : {},
        extension_distribution:
          rustData.extension_stats || rustData.extensionStats
            ? Object.fromEntries(
                Object.entries(rustData.extension_stats || rustData.extensionStats).map(
                  ([k, v]) => [k, v.count]
                )
              )
            : {},
        // Mock other mlFeatures if missing from Rust
        size_distribution: { by_unit: [], unit_labels: [] },
        depth_distribution: { min: 0, max: 10, avg: 3, median: 2 },
        complexity_metrics: {
          nested_directories: dependencyGraph.nodes.filter((n) => n.type === "directory").length,
          file_name_complexity: 0.5,
          path_depth_variance: 0.2,
          extension_diversity: Object.keys(
            rustData.extension_stats || rustData.extensionStats || {}
          ).length,
        },
      },
    };
  }

  convertCategoryDistribution(distribution) {
    return convertCategoryDistribution(distribution);
  }

  convertExtensionDistribution(distribution) {
    return convertExtensionDistribution(distribution);
  }

  // Quick directory scan for incremental analysis comparison
  async getDirectoryFilesQuick(directoryPath) {
    return getDirectoryFilesQuick(directoryPath, this.generateFileHash);
  }

  // Generate simple file hash for change detection
  generateFileHash(filePath, size, mtime) {
    return generateFileHash(filePath, size, mtime);
  }

  async runJsAnalysis(analysisId, directoryPath) {
    console.log(`🔍 Starting JS Analysis for: ${directoryPath}`);
    const startTime = Date.now();

    // Use worker pool if available for parallel scanning
    if (this.workerPool) {
      console.log(`🚀 Using worker pool for parallel scanning`);
      try {
        const result = await this.workerPool.executeTask(
          {
            type: "scanDirectory",
            directoryPath,
            taskId: analysisId,
            maxDepth: 20,
          },
          {
            timeout: 300000, // 5 minute timeout
          }
        );

        const duration = Date.now() - startTime;
        console.log(
          `✅ Worker pool analysis complete: ${result.totalFiles} files in ${duration}ms`
        );

        // Emit final progress
        this.eventEmitter.emit("progress", {
          analysisId,
          filesProcessed: result.totalFiles,
          totalSize: result.totalSize,
          percentage: 100,
          currentFile: "Analysis complete",
        });

        return {
          totalFiles: result.totalFiles,
          totalSize: result.totalSize,
          files: result.files.slice(0, 500), // Limit to 500 files for response
          categories: result.categories,
          analysisType: "js-worker-pool",
          analysisTime: duration,
        };
      } catch (error) {
        console.error(
          `❌ Worker pool analysis failed, falling back to main thread:`,
          error.message
        );
        console.error(`Worker error details:`, {
          code: error.code,
          path: error.path,
          stack: error.stack?.substring(0, 500),
        });
        // Fall back to main thread scanning
      }
    }

    // Fallback to main thread scanning
    console.log(`⚠️ Using main thread for scanning`);
    let totalFiles = 0;
    let totalSize = 0;
    const files = [];

    // First pass: count total files for accurate progress calculation
    let estimatedTotal = 0;
    const countFiles = async (dir) => {
      try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          try {
            if (entry.isDirectory()) {
              if (
                entry.name !== "node_modules" &&
                entry.name !== ".git" &&
                !entry.name.startsWith(".")
              ) {
                await countFiles(fullPath);
              }
            } else {
              estimatedTotal++;
            }
          } catch (e) {
            // Skip files we can't access
          }
        }
      } catch (e) {
        console.error(`❌ Failed to count files in ${dir}:`, e.message);
      }
    };

    await countFiles(directoryPath);
    console.log(`📊 Estimated total files: ${estimatedTotal}`);

    const walk = async (dir) => {
      try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          try {
            if (entry.isDirectory()) {
              if (
                entry.name !== "node_modules" &&
                entry.name !== ".git" &&
                !entry.name.startsWith(".")
              ) {
                await walk(fullPath);
              }
            } else {
              const stats = await fsPromises.stat(fullPath);
              totalFiles++;
              totalSize += stats.size;
              // Store more files for better results (increased from 100 to 500)
              if (files.length < 500) {
                files.push({ name: entry.name, size: stats.size, path: fullPath });
              }

              // Emit progress every 50 files or if estimated total is small
              const progressInterval = estimatedTotal > 1000 ? 100 : 50;
              if (totalFiles % progressInterval === 0) {
                const percentage =
                  estimatedTotal > 0
                    ? Math.min((totalFiles / estimatedTotal) * 100, 95)
                    : Math.min((totalFiles / 1000) * 100, 95);

                this.eventEmitter.emit("progress", {
                  analysisId,
                  filesProcessed: totalFiles,
                  totalSize: totalSize,
                  percentage: percentage,
                  currentFile: entry.name,
                });
              }
            }
          } catch (e) {
            console.warn(`⚠️ Skipping inaccessible file: ${fullPath}`);
          }
        }
      } catch (e) {
        console.error(`❌ Failed to read directory ${dir}:`, e.message);
      }
    };

    await walk(directoryPath);
    const duration = Date.now() - startTime;
    console.log(`✅ JS Analysis complete: ${totalFiles} files in ${duration}ms`);

    // Generate categories from file extensions
    const categories = {};
    const getCategory = (ext) => {
      const extLower = ext.toLowerCase();
      if (
        [
          ".js",
          ".ts",
          ".jsx",
          ".tsx",
          ".vue",
          ".py",
          ".rs",
          ".cpp",
          ".c",
          ".h",
          ".java",
          ".go",
          ".php",
        ].includes(extLower)
      )
        return "Code";
      if ([".md", ".txt", ".doc", ".docx", ".pdf", ".rtf"].includes(extLower)) return "Documents";
      if ([".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".ico"].includes(extLower))
        return "Images";
      if ([".mp3", ".wav", ".ogg", ".flac", ".m4a"].includes(extLower)) return "Audio";
      if ([".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv"].includes(extLower)) return "Video";
      if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(extLower)) return "Archives";
      return "Other";
    };

    files.forEach((file) => {
      const ext = path.extname(file.name).toLowerCase();
      const category = getCategory(ext);
      if (!categories[category]) {
        categories[category] = { count: 0, size: 0, files: [] };
      }
      categories[category].count++;
      categories[category].size += file.size;
      if (categories[category].files.length < 10) {
        categories[category].files.push({ name: file.name, size: file.size, path: file.path });
      }
    });

    // Emit final progress event
    this.eventEmitter.emit("progress", {
      analysisId,
      filesProcessed: totalFiles,
      totalSize: totalSize,
      percentage: 100,
      currentFile: "Complete",
      status: "complete",
      completed: true,
    });

    // Scan for dependencies
    let dependencyGraph = { nodes: [], edges: [] };
    if (files.length > 0) {
      dependencyGraph = await dependencyScanner.scan(files);
    }

    return {
      totalFiles,
      totalSize,
      files,
      dependencyGraph,
      categories,
      extensionStats: {},
      analysisType: "js-fallback",
      analysisTime: duration,
    };
  }
}

// Start the enhanced server only if this file is run directly
if (require.main === module && !process.env.TESTING) {
  // Load and log hardware-optimized configuration (async to detect Ollama models)
  (async () => {
    const { logConfig } = require("../config/dynamic-config");
    await logConfig();

    const app = new SpaceAnalyzerAPIServer();

    // Create HTTP server from Express app
    server = http.createServer(app.app);

    // Attach WebSocket server to the HTTP server
    wss = setupWebSocketServer(server);

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(() => {
        console.log("HTTP server closed");
      });

      // Close WebSocket server
      if (wss) {
        wss.close(() => {
          console.log("WebSocket server closed");
        });
      }

      // Kill Ollama process if running
      if (app.ollamaProcess) {
        app.ollamaProcess.kill();
        console.log("Ollama process terminated");
      }

      // Force exit after timeout
      setTimeout(() => {
        console.log("Forcing shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Start listening
    server.listen(app.config.port, () => {
      console.log(`🚀 Enhanced Backend running on port ${app.config.port}`);
      console.log(
        `⚙️  Hardware-optimized configuration active (${require("../config/dynamic-config").tier} tier)`
      );
      console.log("📡 WebSocket server active");
      console.log("🔌 Ollama AI: " + (app.ollamaAvailable ? "Available" : "Not available"));

      // Initialize async services after server starts
      app
        .initializeAsync()
        .then(() => {
          console.log("✅ Async initialization complete");
        })
        .catch((err) => {
          console.error("❌ Async initialization failed:", err);
        });
    });
  })();
}

module.exports = { SpaceAnalyzerAPIServer, server, wss, broadcast };
