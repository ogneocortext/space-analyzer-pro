/**
 * Analysis Routes Module
 * Handles directory scanning, analysis management, and progress tracking
 */

const express = require("express");
const path = require("path");
const { spawn } = require("child_process");

class AnalysisRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Main Analysis Endpoint
    this.router.post("/analyze", async (req, res) => {
      try {
        const { directoryPath, options = {} } = req.body;

        if (!directoryPath) {
          return res.status(400).json({ error: "Directory path is required" });
        }

        // Validate path
        if (!this.server.isValidPath(directoryPath)) {
          return res.status(400).json({ error: "Invalid directory path" });
        }

        const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store initial analysis state
        this.server.activeAnalyses.set(analysisId, {
          id: analysisId,
          status: "running",
          progress: 0,
          directoryPath,
          startTime: Date.now(),
          options,
        });

        // Start analysis process
        this.runAnalysis(analysisId, directoryPath, options);

        res.json({
          success: true,
          analysisId,
          status: "running",
          message: "Analysis started",
        });
      } catch (error) {
        console.error("Analysis error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get analysis progress
    this.router.get("/progress/:analysisId", (req, res) => {
      const { analysisId } = req.params;
      const progress = this.server.activeAnalyses.get(analysisId);

      if (!progress) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      res.json({
        success: true,
        analysisId,
        ...progress,
      });
    });

    // Server-Sent Events for real-time progress
    this.router.get("/progress/stream/:analysisId", (req, res) => {
      const { analysisId } = req.params;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const sendProgress = () => {
        const progress = this.server.activeAnalyses.get(analysisId);
        if (progress) {
          res.write(`data: ${JSON.stringify(progress)}\n\n`);
        }

        if (progress?.status === "completed" || progress?.status === "error") {
          clearInterval(interval);
          res.end();
        }
      };

      const interval = setInterval(sendProgress, 1000);
      sendProgress();

      req.on("close", () => {
        clearInterval(interval);
      });
    });

    // Get analysis results
    this.router.get("/results", async (req, res) => {
      try {
        const directoryPath = req.query.path;
        if (!directoryPath) {
          return res.status(400).json({ error: "Path parameter is required" });
        }

        // Try to find analysis by directory path
        let result = null;
        for (const [id, data] of this.server.analysisResults) {
          if (data.directory === directoryPath || data.directoryPath === directoryPath) {
            result = { id, ...data };
            break;
          }
        }

        if (!result) {
          return res.status(404).json({ error: "No analysis results found for this path" });
        }

        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error("Get results error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get results by ID
    this.router.get("/results/:id", async (req, res) => {
      try {
        const analysisId = req.params.id;
        const result = this.server.analysisResults.get(analysisId);

        if (!result) {
          return res.status(404).json({
            error: "Analysis not found",
            id: analysisId,
          });
        }

        res.json({
          success: true,
          id: analysisId,
          ...result,
        });
      } catch (error) {
        console.error("Get results by ID error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get current analysis by path from database
    this.router.get("/analysis/current", async (req, res) => {
      const { path: directoryPath } = req.query;

      if (!directoryPath) {
        return res.status(400).json({ error: "Path parameter is required" });
      }

      try {
        const analysis = await this.server.knowledgeDB.getCurrentAnalysis(directoryPath);

        if (!analysis) {
          return res.status(404).json({
            error: "No analysis found for this path",
            path: directoryPath,
          });
        }

        res.json({
          success: true,
          analysis,
        });
      } catch (error) {
        console.error("Get current analysis error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get analysis files with pagination and filtering
    this.router.get("/analysis/:analysisId/files", async (req, res) => {
      const { analysisId } = req.params;
      const {
        page = 1,
        limit = 100,
        sortBy = "size",
        sortOrder = "desc",
        category,
        extension,
        minSize,
        maxSize,
        search,
      } = req.query;

      try {
        const result = this.server.analysisResults.get(analysisId);

        if (!result || !result.files) {
          return res.status(404).json({ error: "Analysis not found" });
        }

        let files = result.files;

        // Apply filters
        if (category) {
          files = files.filter((f) => f.category === category);
        }

        if (extension) {
          files = files.filter((f) => f.name.toLowerCase().endsWith(extension.toLowerCase()));
        }

        if (minSize) {
          files = files.filter((f) => f.size >= parseInt(minSize));
        }

        if (maxSize) {
          files = files.filter((f) => f.size <= parseInt(maxSize));
        }

        if (search) {
          const searchLower = search.toLowerCase();
          files = files.filter(
            (f) =>
              f.name.toLowerCase().includes(searchLower) ||
              f.path.toLowerCase().includes(searchLower)
          );
        }

        // Sort
        files.sort((a, b) => {
          let aVal = a[sortBy];
          let bVal = b[sortBy];

          if (typeof aVal === "string") {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
          }

          if (sortOrder === "desc") {
            return aVal > bVal ? -1 : 1;
          } else {
            return aVal < bVal ? -1 : 1;
          }
        });

        // Paginate
        const start = (parseInt(page) - 1) * parseInt(limit);
        const end = start + parseInt(limit);
        const paginatedFiles = files.slice(start, end);

        res.json({
          success: true,
          analysisId,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: files.length,
            pages: Math.ceil(files.length / parseInt(limit)),
          },
          files: paginatedFiles,
        });
      } catch (error) {
        console.error("Get analysis files error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get analysis statistics
    this.router.get("/analysis/:analysisId/stats", async (req, res) => {
      const { analysisId } = req.params;

      try {
        const result = this.server.analysisResults.get(analysisId);

        if (!result) {
          return res.status(404).json({ error: "Analysis not found" });
        }

        const stats = {
          totalFiles: result.totalFiles || result.files?.length || 0,
          totalSize: result.totalSize || 0,
          categories: result.categories || {},
          extensions: result.extensions || {},
          largestFiles: result.files?.slice(0, 10) || [],
          scanDuration: result.scanDuration || 0,
        };

        res.json({
          success: true,
          analysisId,
          stats,
        });
      } catch (error) {
        console.error("Get analysis stats error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Duplicate detection endpoint
    this.router.post("/analysis/:analysisId/duplicates", async (req, res) => {
      const { analysisId } = req.params;
      let result = this.server.analysisResults.get(analysisId);

      if (!result && req.body.files) {
        result = { files: req.body.files };
      }

      if (!result || !result.files) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      try {
        const DuplicateDetector = require("../modules/duplicate-detector");
        const detector = new DuplicateDetector();

        const duplicates = await detector.findDuplicates(result.files);

        res.json({
          success: true,
          analysisId,
          duplicates,
          duplicateGroups: duplicates.length,
          totalDuplicates: duplicates.reduce((sum, group) => sum + group.files.length, 0),
        });
      } catch (error) {
        console.error("Duplicate detection error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Analysis history endpoint
    this.router.get("/analysis/history", async (req, res) => {
      try {
        const analyses = await this.server.knowledgeDB.getAnalysisHistory();

        res.json({
          success: true,
          analyses: analyses || [],
          count: analyses?.length || 0,
        });
      } catch (error) {
        console.error("Get analysis history error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Launch different interfaces
    this.router.get("/launch/:type", (req, res) => {
      const { type } = req.params;

      const launchOptions = {
        dashboard: "http://localhost:8080",
        wiki: "http://localhost:8080/wiki",
        reports: "http://localhost:8080/reports",
      };

      if (launchOptions[type]) {
        res.json({
          success: true,
          url: launchOptions[type],
          message: `Launch ${type}`,
        });
      } else {
        res.status(400).json({ error: "Unknown launch type" });
      }
    });

    // Health check endpoint
    this.router.get("/health", async (req, res) => {
      try {
        const status = {
          success: true,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          analyses: {
            active: this.server.activeAnalyses.size,
            completed: this.server.analysisResults.size,
          },
          database: {
            connected: !!this.server.knowledgeDB?.db,
          },
        };
        res.json(status);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
  }

  async runAnalysis(analysisId, directoryPath, options) {
    const analysis = this.server.activeAnalyses.get(analysisId);
    if (!analysis) return;

    try {
      // Use the appropriate scanner based on options
      let scannerPath;
      if (options.useRust) {
        scannerPath = path.join(__dirname, "..", "rust-scanner", "scanner.exe");
      } else {
        scannerPath = path.join(__dirname, "..", "scanner", "scanner.exe");
      }

      const scanner = spawn(scannerPath, [directoryPath, "--json"], {
        cwd: path.dirname(scannerPath),
      });

      let output = "";
      let errorOutput = "";

      scanner.stdout.on("data", (data) => {
        output += data.toString();
      });

      scanner.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      scanner.on("close", async (code) => {
        if (code !== 0) {
          analysis.status = "error";
          analysis.error = errorOutput || "Scanner failed";
          this.server.activeAnalyses.set(analysisId, analysis);
          return;
        }

        try {
          const results = JSON.parse(output);

          // Store results
          this.server.analysisResults.set(analysisId, {
            ...results,
            directory: directoryPath,
            analysisId,
            completedAt: Date.now(),
          });

          // Update analysis status
          analysis.status = "completed";
          analysis.progress = 100;
          analysis.endTime = Date.now();
          this.server.activeAnalyses.set(analysisId, analysis);

          // Store in database
          await this.server.knowledgeDB.storeAnalysis(analysisId, directoryPath, results);
        } catch (parseError) {
          analysis.status = "error";
          analysis.error = "Failed to parse scanner output";
          this.server.activeAnalyses.set(analysisId, analysis);
        }
      });
    } catch (error) {
      analysis.status = "error";
      analysis.error = error.message;
      this.server.activeAnalyses.set(analysisId, analysis);
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AnalysisRoutes;
