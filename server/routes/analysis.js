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
        let { directoryPath, options = {} } = req.body;
        directoryPath = this.server.normalizePath(directoryPath);

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
        
        // First check completed results
        let result = this.server.analysisResults.get(analysisId);
        if (result) {
          return res.json({
            success: true,
            id: analysisId,
            ...result,
          });
        }

        // Then check active analyses
        const active = this.server.activeAnalyses.get(analysisId);
        if (active) {
          return res.json({
            success: true,
            id: analysisId,
            status: active.status || "scanning",
            progress: active.progress || 0,
            message: "Analysis still in progress",
          });
        }

        return res.status(404).json({
          error: "Analysis not found",
          id: analysisId,
        });
      } catch (error) {
        console.error("Get results by ID error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Cancel analysis
    this.router.post("/cancel", async (req, res) => {
      try {
        const { analysisId } = req.body;
        
        // If no ID provided, cancel all for now or the most recent one
        if (!analysisId) {
          // Cancel all active scans
          for (const [id, analysis] of this.server.activeAnalyses) {
            if (analysis.process) {
              analysis.process.kill();
              console.log(`🛑 Killed scanner process for analysis ${id}`);
            }
          }
          this.server.activeAnalyses.clear();
          return res.json({ success: true, message: "All analyses cancelled" });
        }

        const analysis = this.server.activeAnalyses.get(analysisId);
        if (analysis) {
          if (analysis.process) {
            analysis.process.kill();
            console.log(`🛑 Killed scanner process for analysis ${analysisId}`);
          }
          this.server.activeAnalyses.delete(analysisId);
          return res.json({ success: true, message: `Analysis ${analysisId} cancelled` });
        }

        res.status(404).json({ error: "Analysis not found or already completed" });
      } catch (error) {
        console.error("Cancel analysis error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get current analysis by path from database
    this.router.get("/analysis/current", async (req, res) => {
      let { path: directoryPath } = req.query;
      directoryPath = this.server.normalizePath(directoryPath);

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
          data: analysis.analysis_data,
          source: "database",
          lastAnalyzed: analysis.last_analyzed,
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
        const os = require("os");
        const dynamicConfig = require("../config/dynamic-config");

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
            active: this.server.workerPool !== null,
            stats: this.server.workerPool ? this.server.workerPool.getStats() : null,
            message: this.server.workerPool
              ? "Worker pool active - using parallel processing"
              : "Worker pool not initialized - using main thread for processing",
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
      // Use Rust CLI (space-analyzer.exe) from bin/ directory
      const scannerPath = path.join(__dirname, "..", "..", "bin", "space-analyzer.exe");
      const tempFile = path.join(__dirname, "..", "controllers", `output_${analysisId}.json`);

      console.log(`🚀 Starting scanner: ${scannerPath}`);
      console.log(`   Directory: ${directoryPath}`);
      console.log(`   Temp file: ${tempFile}`);

      const scanner = spawn(
        scannerPath,
        [directoryPath, "--format", "json", "--output", tempFile],
        {
          cwd: path.dirname(scannerPath),
        }
      );
      
      analysis.process = scanner;
      analysis.status = "scanning";

      let output = "";
      let errorOutput = "";

      scanner.stdout.on("data", (data) => {
        output += data.toString();
      });

      scanner.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      scanner.on("close", async (code) => {
        console.log(`🏁 Scanner exited with code ${code}`);
        if (code !== 0) {
          console.error(`❌ Scanner error output: ${errorOutput}`);
          analysis.status = "error";
          analysis.error = errorOutput || "Scanner failed";
          this.server.activeAnalyses.set(analysisId, analysis);
          return;
        }

        try {
          console.log(`📄 Reading results from ${tempFile}...`);
          const results = JSON.parse(await fs.promises.readFile(tempFile, "utf8"));
          console.log(`✅ Successfully parsed ${results.total_files || 0} files from scanner results`);

          // Clean up temp file
          await fs.promises.unlink(tempFile).catch(() => {});

          // Store results
          this.server.analysisResults.set(analysisId, {
            ...results,
            directory: directoryPath,
            analysisId,
            completedAt: Date.now(),
          });

          // Update analysis status
          analysis.status = "complete";
          analysis.progress = 100;
          analysis.endTime = Date.now();
          this.server.activeAnalyses.set(analysisId, analysis);

          // Store in database
          const normalizedPath = this.server.normalizePath(directoryPath);
          await this.server.knowledgeDB.storeAnalysis(normalizedPath, results);
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
