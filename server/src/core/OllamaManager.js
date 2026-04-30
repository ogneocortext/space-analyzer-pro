/**
 * OllamaManager Service
 * Manages Ollama AI server lifecycle, model loading, and queries
 * Extracted from backend-server.js to reduce complexity
 */

const { spawn } = require("child_process");
const http = require("http");

class OllamaManager {
  constructor(config = {}) {
    this.ollamaHost = config.ollamaHost || "http://localhost:11434";
    this.defaultModel = config.defaultModel || "gemma3:latest";
    this.ollamaProcess = null;
    this.ollamaAvailable = false;
    this.ollamaServerStarted = false;
    this.ollamaModels = [];
    this.currentModel = this.defaultModel;
    this.modelPerformance = new Map();
    this.hardwareWearReduction = true;
  }

  /**
   * Check if Ollama server is available
   */
  async checkAvailability() {
    return new Promise((resolve) => {
      try {
        const req = http.request(
          {
            hostname: "localhost",
            port: 11434,
            path: "/api/tags",
            method: "GET",
            timeout: 5000,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              if (res.statusCode === 200) {
                this.ollamaAvailable = true;
                console.log("🦙 Ollama is available - AI features enhanced");
              }
              resolve(this.ollamaAvailable);
            });
          }
        );

        req.on("error", () => {
          this.ollamaAvailable = false;
          console.log("⚠️ Ollama not available - using basic AI insights");
          resolve(false);
        });

        req.on("timeout", () => {
          this.ollamaAvailable = false;
          console.log("⚠️ Ollama check timed out - using basic AI insights");
          req.destroy();
          resolve(false);
        });

        req.end();
      } catch (e) {
        this.ollamaAvailable = false;
        console.log("⚠️ Ollama check failed - using basic AI insights");
        resolve(false);
      }
    });
  }

  /**
   * Start Ollama server if not running
   */
  async startIfNeeded() {
    try {
      await this.checkAvailability();
      if (this.ollamaAvailable) {
        await this.loadModels();
        return;
      }

      console.log("🔄 Attempting to start Ollama server...");
      this.ollamaProcess = spawn("ollama", ["serve"], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.ollamaServerStarted = true;

      // Wait for server to start
      let attempts = 0;
      const maxAttempts = 30;

      const checkServer = async () => {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          await this.checkAvailability();
          if (this.ollamaAvailable) {
            console.log("✅ Ollama server started successfully");
            await this.loadModels();
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
   * Load available Ollama models
   */
  async loadModels() {
    try {
      const models = await this.queryAPI("tags");
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
            });
          }
        });
      }
    } catch (error) {
      console.log("⚠️ Could not load Ollama models:", error.message);
    }
  }

  /**
   * Query Ollama API
   */
  async queryAPI(endpoint, options = {}) {
    const url = `${this.ollamaHost}/api/${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Ollama API query failed (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Generate AI response using Ollama
   */
  async generate(prompt, model = null, options = {}) {
    const targetModel = model || this.currentModel;
    const startTime = Date.now();

    try {
      const response = await this.queryAPI("generate", {
        method: "POST",
        body: JSON.stringify({
          model: targetModel,
          prompt,
          stream: false,
          ...options,
        }),
      });

      // Update performance metrics
      const responseTime = Date.now() - startTime;
      const perf = this.modelPerformance.get(targetModel) || {
        totalQueries: 0,
        successfulQueries: 0,
        averageResponseTime: 0,
      };

      perf.totalQueries++;
      if (response.response) {
        perf.successfulQueries++;
      }
      perf.averageResponseTime =
        (perf.averageResponseTime * (perf.totalQueries - 1) + responseTime) /
        perf.totalQueries;
      this.modelPerformance.set(targetModel, perf);

      return response;
    } catch (error) {
      console.error(`Ollama generation failed (${targetModel}):`, error.message);
      throw error;
    }
  }

  /**
   * Chat with Ollama
   */
  async chat(messages, model = null, options = {}) {
    const targetModel = model || this.currentModel;

    try {
      const response = await this.queryAPI("chat", {
        method: "POST",
        body: JSON.stringify({
          model: targetModel,
          messages,
          stream: false,
          ...options,
        }),
      });

      return response;
    } catch (error) {
      console.error(`Ollama chat failed (${targetModel}):`, error.message);
      throw error;
    }
  }

  /**
   * Get available models
   */
  getModels() {
    return this.ollamaModels;
  }

  /**
   * Check if Ollama is available
   */
  isAvailable() {
    return this.ollamaAvailable;
  }

  /**
   * Get model performance stats
   */
  getModelPerformance(model) {
    return this.modelPerformance.get(model);
  }

  /**
   * Set current model
   */
  setCurrentModel(model) {
    if (this.ollamaModels.includes(model)) {
      this.currentModel = model;
      return true;
    }
    return false;
  }

  /**
   * Stop Ollama process if we started it
   */
  stop() {
    if (this.ollamaProcess) {
      this.ollamaProcess.kill();
      console.log("Ollama process terminated");
    }
  }
}

module.exports = OllamaManager;
