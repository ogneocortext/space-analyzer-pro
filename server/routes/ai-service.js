/**
 * AI Service Proxy Routes
 * Proxies requests to Python AI service on port 5000
 * Provides unified API entry point with logging and error handling
 */

const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";
const REQUEST_TIMEOUT = 30000; // 30 seconds

class AIServiceRoutes {
  constructor(server) {
    this.server = server;
    this.router = require("express").Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check - checks both Node backend and Python AI service
    this.router.get("/ai/health", async (req, res) => {
      try {
        const aiHealth = await this.checkAIHealth();
        res.json({
          success: true,
          node: "healthy",
          ai_service: aiHealth,
          ai_service_url: AI_SERVICE_URL,
        });
      } catch (error) {
        console.error("AI health check failed:", error.message);
        res.status(503).json({
          success: false,
          node: "healthy",
          ai_service: "unavailable",
          error: error.message,
          ai_service_url: AI_SERVICE_URL,
        });
      }
    });

    // Get ML models status
    this.router.get("/ai/models", async (req, res) => {
      try {
        const response = await axios.get(`${AI_SERVICE_URL}/models/status`, {
          timeout: REQUEST_TIMEOUT,
        });
        res.json({
          success: true,
          models: response.data,
        });
      } catch (error) {
        this.handleError(error, res, "Failed to get models status");
      }
    });

    // Predict file category
    this.router.post("/ai/predict/category", async (req, res) => {
      try {
        const fileData = req.body;

        // Validate required fields
        if (!fileData.path || !fileData.name || fileData.size === undefined) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields: path, name, size",
          });
        }

        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/category`,
          fileData,
          { timeout: REQUEST_TIMEOUT }
        );

        res.json({
          success: true,
          prediction: response.data,
        });
      } catch (error) {
        this.handleError(error, res, "Failed to predict category");
      }
    });

    // Batch predict categories
    this.router.post("/ai/predict/categories-batch", async (req, res) => {
      try {
        const { files } = req.body;

        if (!Array.isArray(files) || files.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Missing required field: files (array)",
          });
        }

        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/categories-batch`,
          files,
          { timeout: REQUEST_TIMEOUT * 2 } // Longer timeout for batch
        );

        res.json({
          success: true,
          predictions: response.data.predictions,
        });
      } catch (error) {
        this.handleError(error, res, "Failed to batch predict categories");
      }
    });

    // Get cleanup recommendations
    this.router.post("/ai/predict/cleanup", async (req, res) => {
      try {
        const analysisData = req.body;

        if (!analysisData.directory_path) {
          return res.status(400).json({
            success: false,
            error: "Missing required field: directory_path",
          });
        }

        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/cleanup`,
          analysisData,
          { timeout: REQUEST_TIMEOUT }
        );

        res.json({
          success: true,
          recommendations: response.data,
        });
      } catch (error) {
        this.handleError(error, res, "Failed to get cleanup recommendations");
      }
    });

    // Train categorizer model
    this.router.post("/ai/train/categorizer", async (req, res) => {
      try {
        const { files } = req.body;

        if (!Array.isArray(files) || files.length < 10) {
          return res.status(400).json({
            success: false,
            error: "Need at least 10 labeled files for training",
          });
        }

        const response = await axios.post(
          `${AI_SERVICE_URL}/train/categorizer`,
          files,
          { timeout: 5000 } // Short timeout - training is background
        );

        res.json({
          success: true,
          message: response.data.message,
          files_count: files.length,
        });
      } catch (error) {
        this.handleError(error, res, "Failed to start categorizer training");
      }
    });

    // Train cleanup predictor
    this.router.post("/ai/train/cleanup-predictor", async (req, res) => {
      try {
        const { analyses } = req.body;

        if (!Array.isArray(analyses) || analyses.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Missing required field: analyses (array)",
          });
        }

        const response = await axios.post(
          `${AI_SERVICE_URL}/train/cleanup-predictor`,
          analyses,
          { timeout: 5000 }
        );

        res.json({
          success: true,
          message: response.data.message,
          analyses_count: analyses.length,
        });
      } catch (error) {
        this.handleError(error, res, "Failed to start cleanup predictor training");
      }
    });

    // Proxy to Python service docs (for development)
    this.router.get("/ai/docs", async (req, res) => {
      res.redirect(`${AI_SERVICE_URL}/docs`);
    });

    console.log("  ✅ AI Service routes added");
  }

  async checkAIHealth() {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/health`, {
        timeout: 5000,
      });
      return response.data.status === "healthy" ? "healthy" : "degraded";
    } catch (error) {
      return "unavailable";
    }
  }

  handleError(error, res, message) {
    console.error(`AI Service Error: ${message}`, error.message);

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error: "AI service unavailable. Is Python service running on port 5000?",
        code: "AI_SERVICE_OFFLINE",
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.error || message,
        ai_error: error.response.data,
      });
    }

    res.status(500).json({
      success: false,
      error: message,
      details: error.message,
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AIServiceRoutes;
