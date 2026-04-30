/**
 * Space Analyzer API Server
 * Refactored entry point using modular core components
 * Original: ~4,180 lines | New: ~150 lines
 */

const path = require("path");
const http = require("http");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

// Import core modules
const { Server, OllamaManager } = require("./src/core");

// Import existing modular routes
const RoutesManager = require("./routes");

// Import services that are already modular
const SelfLearningSystem = require("./SelfLearningSystem");
const KnowledgeDatabase = require("./KnowledgeDatabase");
const { setupWebSocketServer, broadcast } = require("./modules/websocket");

// Import utilities
const ports = require("./ports.config.js");

class SpaceAnalyzerAPIServer {
  constructor() {
    // Initialize core server
    this.server = new Server({
      port: parseInt(process.env.PORT) || ports.API_SERVER_PORT || 8080,
    });

    // Initialize services
    this.ollamaManager = new OllamaManager({
      ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
      defaultModel: "gemma3:latest",
    });

    this.selfLearning = new SelfLearningSystem(path.join(__dirname, "learning"));
    this.knowledgeDB = new KnowledgeDatabase(path.join(__dirname, "knowledge.db"));

    // WebSocket server reference
    this.wss = null;

    // Setup broadcast integration
    this.setupBroadcast();

    // Initialize routes
    this.setupRoutes();

    // Setup additional endpoints not in RoutesManager
    this.setupAdditionalRoutes();
  }

  setupBroadcast() {
    // Connect server event emitter to WebSocket broadcast
    this.server.getEventEmitter().on("broadcast", (data) => {
      broadcast(data);
    });

    // Progress broadcasting
    this.server.getEventEmitter().on("progress", (progressData) => {
      broadcast({
        type: "progress",
        ...progressData,
        timestamp: new Date().toISOString(),
      });
    });
  }

  setupRoutes() {
    // Initialize modular routes
    const routesManager = new RoutesManager(this);
    this.server.mountRoutes(routesManager);
  }

  setupAdditionalRoutes() {
    const app = this.server.app;

    // Health check endpoint
    app.get("/api/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    // Ollama status endpoint
    app.get("/api/ollama/status", async (req, res) => {
      res.json({
        available: this.ollamaManager.isAvailable(),
        models: this.ollamaManager.getModels(),
        currentModel: this.ollamaManager.currentModel,
      });
    });

    // WebSocket status endpoint
    app.get("/api/websocket/status", (req, res) => {
      const wsClients = require("./modules/websocket").getClients();
      res.json({
        connected: wsClients.size > 0,
        clients: wsClients.size,
      });
    });
  }

  async initializeAsync() {
    console.log("🔄 Initializing async services...");

    // Check Ollama availability
    await this.ollamaManager.checkAvailability();
    if (!this.ollamaManager.isAvailable()) {
      await this.ollamaManager.startIfNeeded();
    }

    // Load self-learning data
    await this.selfLearning.loadData();

    console.log("✅ Async initialization complete");
  }

  async start() {
    // Get HTTP server for WebSocket attachment
    const httpServer = this.server.getHTTPServer();

    // Setup WebSocket server
    this.wss = setupWebSocketServer(httpServer);

    // Start the server
    await this.server.start(() => {
      console.log(`🔌 Ollama AI: ${this.ollamaManager.isAvailable() ? "Available" : "Not available"}`);
      console.log("📡 WebSocket server active");
    });

    // Initialize async services after server starts
    await this.initializeAsync();
  }
}

// Start server if run directly
if (require.main === module && !process.env.TESTING) {
  const app = new SpaceAnalyzerAPIServer();

  app.start().catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });
}

module.exports = { SpaceAnalyzerAPIServer };
