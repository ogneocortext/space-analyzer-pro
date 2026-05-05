const { spawn } = require("child_process");

/**
 * Start Ollama server if not already running
 * @param {Function} checkOllamaAvailability - Function to check Ollama availability
 * @param {Function} loadOllamaModels - Function to load Ollama models
 * @returns {Promise<void>}
 */
async function startOllamaIfNeeded(checkOllamaAvailability, loadOllamaModels) {
  try {
    // Check if Ollama is already running
    await checkOllamaAvailability();
    if (this.ollamaAvailable) {
      await loadOllamaModels();
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
        await checkOllamaAvailability();
        if (this.ollamaAvailable) {
          console.log("✅ Ollama server started successfully");
          await loadOllamaModels();
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

/**
 * Cleanup Ollama process on shutdown
 * @returns {void}
 */
function cleanupOllamaProcess() {
  if (this.ollamaProcess) {
    console.log("🧹 Cleaning up Ollama process...");
    try {
      // Kill the process group to ensure all child processes are terminated
      process.kill(-this.ollamaProcess.pid, "SIGTERM");
    } catch (err) {
      // If process group kill fails, try killing just the process
      try {
        this.ollamaProcess.kill("SIGTERM");
      } catch (killErr) {
        console.error("Failed to kill Ollama process:", killErr.message);
      }
    }
    this.ollamaProcess = null;
    this.ollamaAvailable = false;
    this.ollamaServerStarted = false;
  }
}

/**
 * Check if Ollama is available
 * @param {Object} enhancedOllama - Enhanced Ollama service instance
 * @param {Map} modelPerformance - Model performance tracking
 * @returns {Promise<boolean>}
 */
async function checkOllamaAvailability(enhancedOllama, modelPerformance) {
  try {
    // Use Enhanced Ollama Service for better availability checking
    const isAvailable = await enhancedOllama.testConnection();
    this.ollamaAvailable = isAvailable;

    if (isAvailable) {
      console.log(
        "🦙 Enhanced Ollama is available - AI features enhanced with production features"
      );

      // Load models using enhanced service
      const models = await enhancedOllama.fetchModels();
      this.ollamaModels = models.map((m) => m.name);
      console.log(
        `📚 Loaded ${this.ollamaModels.length} Enhanced Ollama models:`,
        this.ollamaModels.join(", ")
      );

      // Initialize model performance tracking
      this.ollamaModels.forEach((model) => {
        if (!modelPerformance.has(model)) {
          modelPerformance.set(model, {
            totalQueries: 0,
            successfulQueries: 0,
            averageResponseTime: 0,
            lastUsed: null,
            complexityScores: [],
          });
        }
      });

      // Log enhanced service metrics
      console.log("📈 Enhanced Ollama Metrics:", enhancedOllama.getMetrics());
    } else {
      console.log("⚠️ Enhanced Ollama not available - using basic AI insights");
    }
  } catch (error) {
    console.log("⚠️ Enhanced Ollama check failed - using basic AI insights:", error.message);
    this.ollamaAvailable = false;
  }

  return this.ollamaAvailable;
}

/**
 * Load Ollama models (now handled by checkOllamaAvailability)
 * @returns {Promise<void>}
 */
async function loadOllamaModels() {
  // Models are now loaded in checkOllamaAvailability using EnhancedOllamaService
  // This method is kept for compatibility but functionality moved
  console.log("📚 Models already loaded via Enhanced Ollama Service");
}

module.exports = {
  startOllamaIfNeeded,
  checkOllamaAvailability,
  loadOllamaModels,
  cleanupOllamaProcess,
};
