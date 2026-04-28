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
const { errorHandler, asyncHandler } = require("./utils/errorHandler");
const PerformanceMonitor = require("./utils/performanceMonitor");
const PortDetector = require("./port-detector");
const EnhancedOllamaService = require("./EnhancedOllamaService");
const WebSocket = require("ws");

// Import other required services
const SelfLearningSystem = require("./SelfLearningSystem");
const KnowledgeDatabase = require("./KnowledgeDatabase");
const dependencyScanner = require("./dependencyScanner");

// Import modules
const { setupSecurity, setupMiddleware } = require("./modules/security");
const { setupWebSocketServer, broadcast, getClients, getServer } = require("./modules/websocket");

// Get WebSocket clients from module
const wsClients = getClients();

// Import independent utility functions
const {
  formatBytes,
  convertToCSV,
  convertToTXT,
  convertCategoryDistribution,
  convertExtensionDistribution,
} = require("./modules/data-conversion");
const {
  findProjectRoot,
  isValidPath,
  generateFileHash,
  getDirectoryFilesQuick,
} = require("./modules/file-utils");
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

    // Configuration
    this.config = {
      port: parseInt(process.env.PORT) || 8080,
      ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
      defaultModel: "gemma3:latest", // Updated default
      // Allow port to be overridden after initialization
      setPort(newPort) {
        this.port = newPort;
      },
    };

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
    // Health check endpoint
    this.app.get("/api/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date(),
        backend: true,
        websocket: wsClients.size > 0,
        ollama: this.ollamaAvailable,
        uptime: process.uptime(),
        requests: this.requestCount || 0,
        errors: this.errorCount || 0,
      });
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

    // Analysis history endpoint
    this.app.get("/api/analysis/history", (req, res) => {
      const historyDir = path.join(__dirname, "analysis_history");

      if (!existsSync(historyDir)) {
        return res.json({
          success: true,
          analyses: [],
          message: "No analysis history yet",
        });
      }

      const analyses = [];
      try {
        const files = fs.readdirSync(historyDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const filePath = path.join(historyDir, file);
            const content = fs.readFileSync(filePath, "utf8");
            const data = JSON.parse(content);
            analyses.push({
              id: data.analysisId || file.replace(".json", ""),
              path: data.path || "Unknown",
              date:
                data.timestamp ||
                new Date(file.replace("analysis_", "").replace(".json", "")).toISOString(),
              totalFiles: data.totalFiles || 0,
              totalSize: data.totalSize || 0,
            });
          }
        }

        // Sort by date descending
        analyses.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
          success: true,
          analyses,
          total: analyses.length,
        });
      } catch (error) {
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
  }

  findProjectRoot(startDir) {
    return findProjectRoot(startDir);
  }

  isValidPath(p) {
    return isValidPath(p);
  }

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

  async runAnalysisAsync(analysisId, directoryPath, options) {
    const cppPath = await this.findCppExecutable();
    let result;

    if (cppPath) {
      console.log(`🚀 Using Rust CLI Backend: ${cppPath}`);
      result = await this.runCppAnalysis(analysisId, directoryPath, options);
    } else {
      console.log("⚠️ Falling back to JS Analysis");
      result = await this.runJsAnalysis(analysisId, directoryPath);
    }

    return result;
  }

  async findCppExecutable() {
    const serverDir = __dirname;
    console.log(`🔍 findCppExecutable: serverDir = ${serverDir}`);
    const searchPaths = new Set();

    searchPaths.add(serverDir);

    let currentDir = serverDir;
    for (let i = 0; i < 5; i++) {
      currentDir = path.dirname(currentDir);
      searchPaths.add(currentDir);
    }

    const executableNames = [
      "space-analyzer.exe",
      "space-analyzer-rust.exe",
      "space-analyzer-rust-gnu.exe",
      "space_analyzer_ai_enhanced.exe",
      "space_analyzer_ai.exe",
      "space-analyzer-cli.exe", // Last priority - uses C++ format
    ];

    const searchSubdirs = [
      "bin",
      "native/scanner/target/release",
      "native/scanner/target/debug",
      "cli/target/release",
      "cli/target/debug",
      "bin/Release",
      "bin/Debug",
      "target/release",
      "target/debug",
    ];

    for (const baseDir of searchPaths) {
      for (const subdir of searchSubdirs) {
        const searchDir = path.join(baseDir, subdir);
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
    return new Promise(async (resolve, reject) => {
      try {
        const exePath = await this.findCppExecutable();
        if (!exePath) {
          return reject(new Error("Analysis executable missing"));
        }

        const isRustCLI =
          exePath.includes("space-analyzer.exe") || exePath.includes("space-analyzer-rust");
        // space-analyzer-cli.exe uses C++ format
        const tempFile = path.join(__dirname, `output_${analysisId}.json`);

        let args, commandName;

        // Use ML-optimized format for large directories (> 50,000 files)
        const isLargeDirectory = options.estimatedFiles > 50000;

        if (isRustCLI) {
          // New Rust CLI format: space-analyzer.exe [directory] --format json --output [file] --progress --parallel
          args = [
            directoryPath,
            "--format",
            "json",
            "--output",
            tempFile,
            "--progress",
            "--parallel",
          ];
          commandName = "Rust CLI";
        } else {
          args = [directoryPath, "--json", tempFile];
          commandName = "C++";
        }

        console.log(`🎬 Spawning ${commandName}: ${exePath} ${args.join(" ")}`);
        const proc = spawn(exePath, args);

        proc.on("error", (err) => {
          console.error(`💥 ${commandName} Spawn Error:`, err);
          reject(err);
        });

        let stderrOutput = "";
        proc.stderr.on("data", (data) => {
          stderrOutput += data.toString();
          console.error(`🔴 ${commandName} Stderr: ${data.toString().trim()}`);
        });

        proc.on("close", async (code) => {
          console.log(`🏁 ${commandName} finished with code ${code}`);
          if (code !== 0) {
            console.error(`❌ ${commandName} failed with exit code ${code}`);
            console.error(`   Directory: ${directoryPath}`);
            console.error(`   Args: ${args.join(" ")}`);
            console.error(`   Stderr: ${stderrOutput}`);
          }
          if (code === 0) {
            try {
              if (existsSync(tempFile)) {
                const content = await fsPromises.readFile(tempFile, "utf8");
                const data = JSON.parse(content);
                await fsPromises.unlink(tempFile).catch(() => {});

                if (isRustCLI) {
                  const convertedData = await this.convertRustOutputToWebFormat(
                    data,
                    analysisId,
                    isLargeDirectory
                  );
                  resolve(convertedData);
                } else {
                  resolve(data);
                }
              } else {
                reject(new Error("Output file not created"));
              }
            } catch (e) {
              console.error(`❌ Failed to parse ${commandName} output:`, e);
              reject(e);
            }
          } else {
            reject(new Error(`${commandName} exit code ${code}`));
          }
        });

        // Track cumulative size for progress updates
        let cumulativeSize = 0;

        if (isRustCLI) {
          proc.stdout.on("data", (data) => {
            const output = data.toString();
            console.log(`📊 Rust CLI Output: ${output.trim()}`);

            // Try to parse [current/total]
            const progressMatch = output.match(/\[(\d+)\/(\d+)\]/);
            if (progressMatch) {
              const current = parseInt(progressMatch[1]);
              const total = parseInt(progressMatch[2]);
              const percentage = Math.min((current / total) * 100, 95);

              const progressData = {
                analysisId,
                success: true,
                files: current,
                filesProcessed: current,
                totalSize: cumulativeSize,
                percentage: Math.round(percentage),
                currentFile: `Processing ${current}/${total}`,
                status: "analyzing",
                completed: false,
                startTime: Date.now(),
                progress: {
                  filesProcessed: current,
                  totalSize: cumulativeSize,
                  percentage: Math.round(percentage),
                  currentFile: `Processing ${current}/${total}`,
                  status: "analyzing",
                },
              };

              this.activeAnalyses.set(analysisId, progressData);
              this.eventEmitter.emit("progress", progressData);
            }
          });

          proc.stderr.on("data", (data) => {
            const stderr = data.toString().trim();
            console.error(`🔴 Rust CLI Stderr: ${stderr}`);

            // Parse "Scanned: N files, Size: X bytes" format
            const scannedMatch = stderr.match(/Scanned:\s*(\d+)\s*files/i);
            const sizeMatch = stderr.match(/[Ss]ize:\s*(\d+)/);

            if (scannedMatch) {
              const current = parseInt(scannedMatch[1]);
              if (sizeMatch) {
                cumulativeSize = parseInt(sizeMatch[1]);
              }
              // Use a better estimate based on quick scan results
              const estimatedTotal = options.estimatedFiles || 50000;
              const percentage = Math.min((current / estimatedTotal) * 100, 95);

              const progressData = {
                analysisId,
                success: true,
                files: current,
                filesProcessed: current,
                totalSize: cumulativeSize,
                percentage: Math.round(percentage),
                currentFile: `Scanned ${current} files`,
                status: "analyzing",
                completed: false,
                startTime: Date.now(),
                progress: {
                  filesProcessed: current,
                  totalSize: cumulativeSize,
                  percentage: Math.round(percentage),
                  currentFile: `Scanned ${current} files`,
                  status: "analyzing",
                },
              };

              this.activeAnalyses.set(analysisId, progressData);
              this.eventEmitter.emit("progress", progressData);
            }
          });
        }
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
    let totalFiles = 0;
    let totalSize = 0;
    const files = [];
    const startTime = Date.now();

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
    const { logConfig } = require("./config/dynamic-config");
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
        `⚙️  Hardware-optimized configuration active (${require("./config/dynamic-config").tier} tier)`
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
