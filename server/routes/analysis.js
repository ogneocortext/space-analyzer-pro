/**
 * Analysis Routes Module
 * Handles directory scanning, analysis management, and progress tracking
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
const AnalysisController = require("../controllers/AnalysisController");
const logger = require("../utils/logger");

class AnalysisRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    this.analysisController = new AnalysisController(server);
    logger.log("🚀", "AnalysisRoutes initialized [v2.8.2-code-quality]");
    this.setupRoutes();
  }

  getRouter() {
    return this.router;
  }

  // Main analysis logic for directory scanning with progress tracking
  async startAnalysisLogic(req, res, directoryPath) {
    try {
      logger.log("🚀", `Starting directory analysis for: ${directoryPath}`);

      // Generate human-readable analysis ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const suffix = Math.random().toString(36).substr(2, 4);
      const analysisId = `analysis-${timestamp}-${suffix}`;

      // Initialize analysis tracking
      if (!this.server.activeAnalyses) {
        this.server.activeAnalyses = new Map();
      }

      // Create analysis entry
      const analysisEntry = {
        analysisId,
        directoryPath,
        status: "running",
        progress: 0,
        currentFile: "Starting scan...",
        filesScanned: 0,
        startTime: Date.now(),
        endTime: null,
        error: null,
        process: null,
      };

      this.server.activeAnalyses.set(analysisId, analysisEntry);

      logger.log("📋", `Analysis created with ID: ${analysisId}`);

      // Generate unique temp file name using UUID to prevent collisions
      const tempFileName = `temp_analysis_${crypto.randomUUID()}.json`;
      analysisEntry.tempFileName = tempFileName;

      // Start the scanner process
      const { spawn } = require("child_process");
      const scannerPath = path.join(__dirname, "../../bin/space-analyzer.exe");

      const scannerProcess = spawn(
        scannerPath,
        ["scan", directoryPath, "--json-progress", "--output", tempFileName],
        {
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      analysisEntry.process = scannerProcess;

      // Set a 10-minute timeout to prevent zombie processes
      const timeoutId = setTimeout(
        () => {
          logger.error(`Analysis ${analysisId} timed out after 10 minutes`);
          scannerProcess.kill();
          analysisEntry.status = "error";
          analysisEntry.error = "Analysis timed out (10 minutes max)";
          analysisEntry.endTime = Date.now();
        },
        10 * 60 * 1000
      ); // 10 minutes

      // Clear timeout when process closes
      scannerProcess.on("close", () => {
        clearTimeout(timeoutId);
      });

      // Handle scanner output for progress updates
      scannerProcess.stderr.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            try {
              const progressData = JSON.parse(line);
              if (progressData.event === "progress") {
                analysisEntry.filesScanned = progressData.files || 0;
                analysisEntry.currentFile = progressData.current_file || "Scanning...";
                analysisEntry.totalSize = progressData.size || 0;

                // Calculate percentage based on maxFiles parameter (default 100,000)
                const maxFiles = 100000;
                analysisEntry.progress = Math.min(
                  100,
                  Math.round(((progressData.files || 0) / maxFiles) * 100)
                );

                logger.log(
                  "📊",
                  `Progress update: ${analysisEntry.progress}% - ${analysisEntry.filesScanned} files`
                );
              }
            } catch (e) {
              // Ignore non-JSON output
            }
          }
        }
      });

      // Handle scanner completion
      scannerProcess.on("close", (code) => {
        logger.log("🏁", `Scanner process finished with code: ${code}`);

        if (code === 0) {
          analysisEntry.status = "complete";
          analysisEntry.progress = 100;
          analysisEntry.currentFile = "Analysis complete";
          analysisEntry.endTime = Date.now();

          // Load and return results with proper JSON error handling
          let resultData = null;
          try {
            const fs = require("fs");
            const resultPath = path.join(__dirname, "../../" + analysisEntry.tempFileName);
            const fileContent = fs.readFileSync(resultPath, "utf8");

            if (!fileContent || fileContent.trim() === "") {
              throw new Error("Empty result file");
            }

            resultData = JSON.parse(fileContent);

            // Clean up temp file
            fs.unlinkSync(resultPath);
          } catch (parseError) {
            logger.error("Failed to parse analysis results", { error: parseError.message });
            analysisEntry.error = "Corrupted analysis results";
            resultData = null;
          }

          // Store results for retrieval
          analysisEntry.result = resultData;

          if (resultData) {
            logger.log("✅", "Analysis completed successfully");
          }
        } else {
          analysisEntry.status = "error";
          analysisEntry.error = `Scanner failed with code: ${code}`;
          analysisEntry.endTime = Date.now();
        }
      });

      // Handle scanner errors
      scannerProcess.on("error", (error) => {
        logger.error("Scanner process error", { error: error.message });
        analysisEntry.status = "error";
        analysisEntry.error = error.message;
        analysisEntry.endTime = Date.now();
      });

      // Return immediate response with analysis ID
      res.json({
        success: true,
        analysisId,
        message: "Analysis started",
        directoryPath,
      });
    } catch (error) {
      logger.error("Error in startAnalysisLogic", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to start analysis",
        message: error.message,
      });
    }
  }

  setupRoutes() {
    // Get current analysis status
    this.router.get("/analysis/current", async (req, res) => {
      try {
        const { path } = req.query;

        if (!path) {
          return res.status(400).json({
            success: false,
            error: "Path parameter is required",
          });
        }

        // Normalize the path for consistent comparison
        const normalizedPath = this.server.normalizePath ? this.server.normalizePath(path) : path;

        logger.log("🔍", `Looking for current analysis for path: ${normalizedPath}`);

        // Find any active analysis for this path
        let activeAnalysis = null;
        if (this.server?.activeAnalyses) {
          for (const [id, analysis] of this.server.activeAnalyses.entries()) {
            const analysisPath = this.server.normalizePath
              ? this.server.normalizePath(analysis.directoryPath)
              : analysis.directoryPath;

            if (analysisPath === normalizedPath) {
              activeAnalysis = {
                id,
                ...analysis,
                // Add computed fields
                progress: analysis.progress || 0,
                status: analysis.status || "unknown",
                startTime: analysis.startTime,
                currentFile: analysis.currentFile || "",
                filesScanned: analysis.filesScanned || 0,
                bytesScanned: analysis.bytesScanned || 0,
              };
              logger.log("✅", `Found active analysis: ${id}`);
              break;
            }
          }
        }

        // Also check completed analyses
        let completedAnalysis = null;
        if (!activeAnalysis && this.server?.analysisResults) {
          for (const [id, result] of this.server.analysisResults.entries()) {
            const resultPath = result.directory || result.path || "";
            const normalizedResultPath = this.server.normalizePath
              ? this.server.normalizePath(resultPath)
              : resultPath;

            if (normalizedResultPath === normalizedPath) {
              completedAnalysis = {
                id,
                status: "complete",
                directoryPath: resultPath,
                completedAt: result.completedAt || Date.now(),
                result: result,
              };
              logger.log("✅", `Found completed analysis: ${id}`);
              break;
            }
          }
        }

        // Return the found analysis
        if (activeAnalysis) {
          res.json({
            success: true,
            analysis: activeAnalysis,
            type: "active",
          });
        } else if (completedAnalysis) {
          res.json({
            success: true,
            analysis: completedAnalysis,
            type: "completed",
          });
        } else {
          logger.log("ℹ️", `No analysis found for path: ${normalizedPath}`);
          res.json({
            success: true,
            analysis: null,
            message: `No analysis found for path: ${normalizedPath}`,
          });
        }
      } catch (error) {
        logger.error("Get current analysis error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to get current analysis",
        });
      }
    });

    // Main Analysis Endpoint
    this.router.post("/analyze", async (req, res) => {
      try {
        logger.log("🚀", "Starting new analysis request");
        let { directoryPath, options = {} } = req.body;

        // Validate input
        if (!directoryPath || typeof directoryPath !== "string") {
          return res.status(400).json({
            success: false,
            error: "Directory path is required and must be a string",
          });
        }

        // Normalize and validate path
        directoryPath = this.server.normalizePath
          ? this.server.normalizePath(directoryPath)
          : directoryPath;
        logger.log("📂", `Analyzing directory: ${directoryPath}`);

        if (this.server.isValidPath && !this.server.isValidPath(directoryPath)) {
          return res.status(400).json({
            success: false,
            error: "Invalid directory path or path does not exist",
          });
        }

        // Check if analysis is already running for this path
        if (this.server?.activeAnalyses) {
          for (const [id, analysis] of this.server.activeAnalyses.entries()) {
            if (analysis.directoryPath === directoryPath && analysis.status === "running") {
              return res.json({
                success: true,
                analysisId: id,
                status: "running",
                message: "Analysis already in progress for this directory",
                existing: true,
              });
            }
          }
        }

        // Generate human-readable analysis ID
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const suffix = Math.random().toString(36).substr(2, 4);
        const analysisId = `analysis-${timestamp}-${suffix}`;
        logger.log("🆔", `Generated analysis ID: ${analysisId}`);

        // Store initial analysis state with enhanced metadata
        const analysisState = {
          id: analysisId,
          status: "running",
          progress: 0,
          directoryPath,
          startTime: Date.now(),
          options: {
            ...options,
            maxFiles: options.maxFiles || 100000,
            includeHidden: options.includeHidden || false,
            followSymlinks: options.followSymlinks || false,
          },
          filesScanned: 0,
          currentFile: "",
          error: null,
        };

        if (this.server?.activeAnalyses) {
          this.server.activeAnalyses.set(analysisId, analysisState);
          logger.log("📊", `Stored initial analysis state for ${analysisId}`);
        } else {
          logger.error("activeAnalyses not available on server");
          return res.status(500).json({
            success: false,
            error: "Server analysis storage not available",
          });
        }

        // Start analysis process asynchronously
        this.runAnalysis(analysisId, directoryPath, options).catch((error) => {
          logger.error(`Analysis failed to start for ${analysisId}`, { error: error.message });
          if (this.server?.activeAnalyses) {
            const analysis = this.server.activeAnalyses.get(analysisId);
            if (analysis) {
              analysis.status = "error";
              analysis.error = error.message;
              this.server.activeAnalyses.set(analysisId, analysis);
            }
          }
        });

        res.json({
          success: true,
          analysisId,
          status: "running",
          message: "Analysis started successfully",
          directoryPath,
          startTime: analysisState.startTime,
        });
      } catch (error) {
        logger.error("Analysis endpoint error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to start analysis",
          timestamp: Date.now(),
        });
      }
    });

    // Get analysis progress
    this.router.get("/progress/:analysisId", (req, res) => {
      try {
        const { analysisId } = req.params;

        // Validate analysis ID
        if (!analysisId || typeof analysisId !== "string") {
          return res.status(400).json({
            success: false,
            error: "Valid analysis ID is required",
          });
        }

        // Check if activeAnalyses is available
        if (!this.server?.activeAnalyses) {
          return res.status(500).json({
            success: false,
            error: "Analysis tracking not available",
          });
        }

        const progress = this.server.activeAnalyses.get(analysisId);

        if (!progress) {
          return res.status(404).json({
            success: false,
            error: "Analysis not found",
            analysisId,
          });
        }

        // Calculate estimated time remaining if available
        let estimatedTimeRemaining = null;
        if (progress.progress > 0 && progress.progress < 100 && progress.startTime) {
          const elapsed = Date.now() - progress.startTime;
          const estimatedTotal = (elapsed / progress.progress) * 100;
          estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);
        }

        res.json({
          success: true,
          analysisId,
          status: progress.status,
          progress: progress.progress || 0,
          currentFile: progress.currentFile || "",
          filesScanned: progress.filesScanned || 0,
          totalSize: progress.totalSize || 0,
          startTime: progress.startTime,
          endTime: progress.endTime,
          error: progress.error || null,
          estimatedTimeRemaining,
          directoryPath: progress.directoryPath,
        });
      } catch (error) {
        logger.error("Progress endpoint error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch progress",
          analysisId: req.params.analysisId,
        });
      }
    });

    // Server-Sent Events for real-time progress
    this.router.get("/progress/stream/:analysisId", (req, res) => {
      try {
        const { analysisId } = req.params;

        // Validate analysis ID
        if (!analysisId || typeof analysisId !== "string") {
          return res.status(400).json({
            success: false,
            error: "Valid analysis ID is required",
          });
        }

        // Check if activeAnalyses is available
        if (!this.server?.activeAnalyses) {
          return res.status(500).json({
            success: false,
            error: "Analysis tracking not available",
          });
        }

        // Check if analysis exists
        const initialProgress = this.server.activeAnalyses.get(analysisId);
        if (!initialProgress) {
          return res.status(404).json({
            success: false,
            error: "Analysis not found",
            analysisId,
          });
        }

        // Set up Server-Sent Events
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
        });

        let interval = null;
        let lastProgressData = null;

        const sendProgress = () => {
          try {
            const progress = this.server.activeAnalyses.get(analysisId);

            if (!progress) {
              // Analysis was removed, close connection
              res.write(
                `data: ${JSON.stringify({
                  status: "removed",
                  message: "Analysis no longer available",
                })}\n\n`
              );
              clearInterval(interval);
              res.end();
              return;
            }

            // Only send if progress data has changed
            const progressData = JSON.stringify(progress);
            if (progressData !== lastProgressData) {
              res.write(`data: ${progressData}\n\n`);
              lastProgressData = progressData;
            }

            // Close connection if analysis is complete or failed
            if (progress.status === "complete" || progress.status === "error") {
              clearInterval(interval);
              res.write(
                `data: ${JSON.stringify({
                  status: "finished",
                  finalStatus: progress.status,
                  analysisId,
                })}\n\n`
              );
              res.end();
            }
          } catch (error) {
            logger.error("Error sending progress data", { error: error.message });
            clearInterval(interval);
            res.end();
          }
        };

        // Send initial progress immediately
        sendProgress();

        // Set up regular updates
        interval = setInterval(sendProgress, 500); // Update every 500ms for smoother progress

        // Handle client disconnect
        req.on("close", () => {
          clearInterval(interval);
          logger.log("🔌", `Client disconnected from progress stream for ${analysisId}`);
        });

        req.on("error", (error) => {
          clearInterval(interval);
          logger.error(`Error in progress stream for ${analysisId}`, { error: error.message });
        });

        // Set timeout to prevent hanging connections
        setTimeout(() => {
          if (interval) {
            clearInterval(interval);
            res.end();
          }
        }, 300000); // 5 minute timeout
      } catch (error) {
        logger.error("Progress stream endpoint error", { error: error.message });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: error.message || "Failed to establish progress stream",
            analysisId: req.params.analysisId,
          });
        }
      }
    });

    // Get results by ID
    this.router.get("/results/:id", async (req, res) => {
      try {
        const analysisId = req.params.id;

        // Validate analysis ID
        if (!analysisId || typeof analysisId !== "string") {
          return res.status(400).json({
            success: false,
            error: "Valid analysis ID is required",
          });
        }

        logger.log("📊", `Fetching results for analysis ID: ${analysisId}`);

        // Check if analysisResults is available
        if (this.server?.analysisResults) {
          logger.log(
            "🔍",
            `Available analysis results: ${Array.from(this.server.analysisResults.keys()).join(", ")}`
          );
        }

        // Check if activeAnalyses is available
        if (this.server?.activeAnalyses) {
          logger.log(
            "🔍",
            `Available active analyses: ${Array.from(this.server.activeAnalyses.keys()).join(", ")}`
          );
        }

        // First check completed results in memory
        let result = this.server?.analysisResults?.get(analysisId);
        if (result) {
          logger.log("✅", `Found completed results in memory for ${analysisId}`);
          return res.json({
            success: true,
            id: analysisId,
            status: "complete",
            data: result,
            completedAt: result.completedAt,
          });
        }

        // Then check active analyses
        const active = this.server?.activeAnalyses?.get(analysisId);
        if (active) {
          logger.log("⏳", `Analysis ${analysisId} still active, status: ${active.status}`);

          // Include estimated time remaining for active analyses
          let estimatedTimeRemaining = null;
          if (active.startTime && active.status === "running") {
            const elapsed = Date.now() - active.startTime;
            // Rough estimate based on current progress
            if (active.progress > 0) {
              const totalTime = (elapsed / active.progress) * 100;
              estimatedTimeRemaining = Math.max(0, totalTime - elapsed);
            }
          }

          return res.json({
            success: true,
            id: analysisId,
            status: active.status || "scanning",
            progress: active.progress || 0,
            currentFile: active.currentFile || "",
            filesScanned: active.filesScanned || 0,
            bytesScanned: active.bytesScanned || 0,
            startTime: active.startTime,
            estimatedTimeRemaining,
          });
        }

        // Finally, check database for historical results
        if (this.server.knowledgeDB && this.server.knowledgeDB.db) {
          try {
            logger.log("🔍", `Checking database for historical results of ${analysisId}`);
            const dbResult = await this.server.knowledgeDB.getAnalysis(analysisId);

            if (dbResult) {
              logger.log("✅", `Found historical results in database for ${analysisId}`);
              return res.json({
                success: true,
                id: analysisId,
                status: "complete",
                data: dbResult,
                fromDatabase: true,
                directory: dbResult.directory_path,
                totalFiles: dbResult.total_files,
                totalSize: dbResult.total_size,
                lastAnalyzed: dbResult.last_analyzed,
              });
            }
          } catch (dbError) {
            logger.error(`Database query failed for ${analysisId}`, { error: dbError.message });
            // Continue to 404 response
          }
        }

        logger.log("❌", `No analysis found for ID: ${analysisId}`);
        return res.status(404).json({
          success: false,
          error: "Analysis not found in memory or database",
          analysisId,
          availableResults: this.server?.analysisResults
            ? Array.from(this.server.analysisResults.keys())
            : [],
          activeAnalyses: this.server?.activeAnalyses
            ? Array.from(this.server.activeAnalyses.keys())
            : [],
        });
      } catch (error) {
        logger.error("Results endpoint error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch analysis results",
          analysisId: req.params.id,
        });
      }
    });

    // Get analysis results by path
    this.router.get("/results", async (req, res) => {
      try {
        const directoryPath = req.query.path;
        if (!directoryPath) {
          return res.status(400).json({
            success: false,
            error: "Directory path is required",
          });
        }

        logger.log("🔍", `Looking for analysis results for path: ${directoryPath}`);

        // Try to find analysis by directory path
        let result = null;
        if (this.server?.analysisResults) {
          for (const [id, data] of this.server.analysisResults) {
            if (data.directory === directoryPath || data.directoryPath === directoryPath) {
              result = { id, ...data };
              break;
            }
          }
        }

        if (result) {
          return res.json({
            success: true,
            analysisId: result.id,
            status: "complete",
            data: result,
            completedAt: result.completedAt,
          });
        } else {
          return res.status(404).json({
            success: false,
            error: "No analysis found for this directory path",
            path: directoryPath,
          });
        }
      } catch (error) {
        logger.error("Get results by path error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch analysis results",
        });
      }
    });

    // Alias for analysis start endpoint
    this.router.post("/start", async (req, res) => {
      try {
        logger.log("🚀", "Starting new analysis request (via /start)");
        let { directoryPath, options = {} } = req.body;

        // Validate input
        if (!directoryPath || typeof directoryPath !== "string") {
          return res.status(400).json({
            success: false,
            error: "Directory path is required and must be a string",
          });
        }

        // Normalize and validate path
        const normalizedPath = this.server.normalizePath
          ? this.server.normalizePath(directoryPath)
          : directoryPath;

        // Check if path exists
        if (!fs.existsSync(normalizedPath)) {
          return res.status(404).json({
            success: false,
            error: "Directory does not exist",
            path: normalizedPath,
          });
        }

        // Check if it's a directory
        const stats = fs.statSync(normalizedPath);
        if (!stats.isDirectory()) {
          return res.status(400).json({
            success: false,
            error: "Path is not a directory",
            path: normalizedPath,
          });
        }

        // Use the main analyze endpoint logic directly
        return this.startAnalysisLogic(req, res, normalizedPath);
      } catch (error) {
        logger.error("Error starting analysis", { error: error.message });
        return res.status(500).json({
          success: false,
          error: "Failed to start analysis",
          message: error.message,
        });
      }
    });

    // Cancel analysis
    this.router.post("/cancel", async (req, res) => {
      try {
        const { analysisId } = req.body;

        logger.log("🛑", `Cancel request received for analysis: ${analysisId}`);

        // If no ID provided, cancel all active scans
        if (!analysisId) {
          if (this.server?.activeAnalyses) {
            // Cancel all active scans
            for (const [id, analysis] of this.server.activeAnalyses) {
              if (analysis.process) {
                analysis.process.kill();
                logger.log("🛑", `Killed scanner process for analysis ${id}`);
              }
            }
            this.server.activeAnalyses.clear();
            return res.json({ success: true, message: "All analyses cancelled" });
          } else {
            return res.status(500).json({
              success: false,
              error: "Unable to cancel analyses - server not available",
            });
          }
        }

        // Cancel specific analysis
        if (this.server?.activeAnalyses) {
          const analysis = this.server.activeAnalyses.get(analysisId);
          if (analysis) {
            if (analysis.process) {
              analysis.process.kill();
              logger.log("🛑", `Killed scanner process for analysis ${analysisId}`);
            }
            this.server.activeAnalyses.delete(analysisId);
            return res.json({ success: true, message: `Analysis ${analysisId} cancelled` });
          }
        }

        res.status(404).json({ error: "Analysis not found or already completed" });
      } catch (error) {
        logger.error("Cancel analysis error", { error: error.message });
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
        search,
      } = req.query;

      try {
        // Validate analysis ID
        if (!analysisId || typeof analysisId !== "string") {
          return res.status(400).json({
            success: false,
            error: "Valid analysis ID is required",
          });
        }

        // Parse pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const offset = (pageNum - 1) * limitNum;

        // Get analysis result
        const result = this.server?.analysisResults?.get(analysisId);
        if (!result || !result.files) {
          return res.status(404).json({
            success: false,
            error: "Analysis not found or has no file data",
          });
        }

        let files = [...result.files];

        // Apply filters
        if (category) {
          files = files.filter((file) => file.category === category);
        }

        if (extension) {
          files = files.filter((file) => file.extension === extension);
        }

        if (search) {
          const searchLower = search.toLowerCase();
          files = files.filter(
            (file) =>
              file.name.toLowerCase().includes(searchLower) ||
              file.path.toLowerCase().includes(searchLower)
          );
        }

        // Apply sorting
        files.sort((a, b) => {
          let aValue, bValue;

          switch (sortBy) {
            case "name":
              aValue = a.name.toLowerCase();
              bValue = b.name.toLowerCase();
              break;
            case "size":
              aValue = a.size.bytes || 0;
              bValue = b.size.bytes || 0;
              break;
            case "extension":
              aValue = a.extension.toLowerCase();
              bValue = b.extension.toLowerCase();
              break;
            case "category":
              aValue = a.category.toLowerCase();
              bValue = b.category.toLowerCase();
              break;
            default:
              aValue = a.size.bytes || 0;
              bValue = b.size.bytes || 0;
          }

          if (sortOrder === "asc") {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

        // Apply pagination
        const paginatedFiles = files.slice(offset, offset + limitNum);
        const totalPages = Math.ceil(files.length / limitNum);

        res.json({
          success: true,
          files: paginatedFiles,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: files.length,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
          filters: {
            category,
            extension,
            search,
            sortBy,
            sortOrder,
          },
        });
      } catch (error) {
        logger.error("Get analysis files error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch analysis files",
        });
      }
    });

    // Get analysis statistics
    this.router.get("/analysis/:analysisId/stats", async (req, res) => {
      const { analysisId } = req.params;

      try {
        // Validate analysis ID
        if (!analysisId || typeof analysisId !== "string") {
          return res.status(400).json({
            success: false,
            error: "Valid analysis ID is required",
          });
        }

        const result = this.server?.analysisResults?.get(analysisId);

        if (!result) {
          return res.status(404).json({
            success: false,
            error: "Analysis not found",
          });
        }

        // Calculate statistics
        const stats = {
          totalFiles: result.files?.length || 0,
          totalSize: result.totalSize || 0,
          categories: {},
          extensions: {},
          largestFiles: [],
          duplicates: {
            count: result.duplicateCount || 0,
            size: result.duplicateSize || 0,
          },
          hardLinks: {
            count: result.hardLinkCount || 0,
            savings: result.hardLinkSavings || 0,
          },
        };

        // Calculate category and extension stats
        if (result.files) {
          result.files.forEach((file) => {
            // Category stats
            const category = file.category || "Unknown";
            stats.categories[category] = (stats.categories[category] || 0) + 1;

            // Extension stats
            const ext = file.extension || "No extension";
            if (!stats.extensions[ext]) {
              stats.extensions[ext] = { count: 0, size: 0 };
            }
            stats.extensions[ext].count++;
            stats.extensions[ext].size += file.size?.bytes || 0;
          });

          // Get largest files
          stats.largestFiles = result.files
            .sort((a, b) => (b.size?.bytes || 0) - (a.size?.bytes || 0))
            .slice(0, 10)
            .map((file) => ({
              name: file.name,
              path: file.path,
              size: file.size,
              category: file.category,
            }));
        }

        res.json({
          success: true,
          analysisId,
          stats,
        });
      } catch (error) {
        logger.error("Get analysis stats error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch analysis statistics",
        });
      }
    });

    // Get analysis history
    this.router.get("/history", async (req, res) => {
      try {
        logger.log("📚", "Fetching analysis history");

        // Get all completed analyses from memory
        let history = [];

        // Check analysisResults (completed scans)
        if (this.server?.analysisResults) {
          for (const [analysisId, result] of this.server.analysisResults) {
            history.push({
              analysisId,
              directory: result.directory || result.directoryPath || result.path || "Unknown",
              totalFiles: result.totalFiles || result.files?.length || 0,
              totalSize: result.totalSize || result.size || 0,
              status: "completed",
              lastAnalyzed: result.completedAt || result.timestamp || Date.now(),
              startTime: result.startTime || result.timestamp || Date.now(),
              endTime: result.completedAt || Date.now(),
              result: result,
            });
          }
        }

        // Also check database for historical analyses
        if (this.server?.knowledgeDB?.db) {
          try {
            const dbHistory = await this.server.knowledgeDB.getAnalysisHistory();
            if (dbHistory && Array.isArray(dbHistory)) {
              dbHistory.forEach((dbAnalysis) => {
                // Only add if not already in history from memory
                if (!history.find((h) => h.analysisId === dbAnalysis.id)) {
                  history.push({
                    analysisId: dbAnalysis.id,
                    directory: dbAnalysis.directory_path || dbAnalysis.directory || "Unknown",
                    totalFiles: dbAnalysis.total_files || 0,
                    totalSize: dbAnalysis.total_size || 0,
                    status: "completed",
                    lastAnalyzed: dbAnalysis.last_analyzed || dbAnalysis.timestamp || Date.now(),
                    startTime: dbAnalysis.created_at || dbAnalysis.timestamp || Date.now(),
                    endTime: dbAnalysis.last_analyzed || Date.now(),
                    fromDatabase: true,
                  });
                }
              });
            }
          } catch (dbError) {
            logger.warn("Failed to fetch from database", { error: dbError.message });
          }
        }

        // Sort by most recent first
        history.sort(
          (a, b) => new Date(b.lastAnalyzed).getTime() - new Date(a.lastAnalyzed).getTime()
        );

        logger.log("✅", `Found ${history.length} analyses in history`);

        res.json({
          success: true,
          analyses: history,
          count: history.length,
        });
      } catch (error) {
        logger.error("Failed to fetch analysis history", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch analysis history",
        });
      }
    });

    // Health check endpoint
    this.router.get("/health", async (req, res) => {
      try {
        const os = require("os");
        const dynamicConfig = require("../config/dynamic-config");

        const systemInfo = {
          platform: os.platform(),
          arch: os.arch(),
          uptime: os.uptime(),
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
          },
          cpu: {
            model: os.cpus()[0]?.model || "Unknown",
            cores: os.cpus().length,
          },
        };

        const analysisInfo = {
          active: this.server?.activeAnalyses?.size || 0,
          completed: this.server?.analysisResults?.size || 0,
          availableResults: this.server?.analysisResults
            ? Array.from(this.server.analysisResults.keys())
            : [],
        };

        const dbInfo = {
          connected: !!this.server?.knowledgeDB?.db,
          initialized: !!this.server?.dbInitializationPromise,
        };

        res.json({
          success: true,
          status: "healthy",
          timestamp: new Date().toISOString(),
          system: systemInfo,
          analysis: analysisInfo,
          database: dbInfo,
          config: {
            maxFiles: dynamicConfig?.maxFiles || 100000,
            timeout: dynamicConfig?.timeout || 120000,
          },
        });
      } catch (error) {
        logger.error("Health check error", { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message || "Health check failed",
        });
      }
    });

    // Setup code quality analysis routes
    // this.setupCodeQualityRoutes(); // Disabled for now
  }

  /**
   * Run analysis with enhanced error handling and progress tracking
   */
  async runAnalysis(analysisId, directoryPath, options = {}) {
    logger.log("🚀", `Starting analysis run for ${analysisId} in ${directoryPath}`);

    try {
      // Update analysis state
      if (this.server?.activeAnalyses) {
        const analysis = this.server.activeAnalyses.get(analysisId);
        if (analysis) {
          analysis.status = "running";
          analysis.startTime = Date.now();
          this.server.activeAnalyses.set(analysisId, analysis);
        }
      }

      // Check for cached results first
      if (this.server?.knowledgeDB?.db) {
        try {
          const cachedResult = await this.server.knowledgeDB.getAnalysisByPath(directoryPath);
          if (cachedResult && !options.forceRescan) {
            logger.log("♻️", `Found cached analysis for unchanged directory: ${directoryPath}`);

            // Store cached result
            if (this.server?.analysisResults) {
              this.server.analysisResults.set(analysisId, cachedResult);
            }

            // Update analysis status
            if (this.server?.activeAnalyses) {
              const analysis = this.server.activeAnalyses.get(analysisId);
              if (analysis) {
                analysis.status = "complete";
                analysis.progress = 100;
                analysis.filesScanned = cachedResult.total_files || cachedResult.totalFiles || 0;
                analysis.bytesScanned = cachedResult.total_size || cachedResult.totalSize || 0;
                analysis.currentFile = "";
                analysis.cacheHit = true;
                analysis.endTime = Date.now();
                analysis.statusMessage = "Reused unchanged historical scan";
                this.server.activeAnalyses.set(analysisId, analysis);
              }
            }

            logger.log("📊", `Analysis ${analysisId} completed from cache`);
            return;
          }
        } catch (cacheError) {
          logger.warn("Cache check failed, proceeding with fresh scan", {
            error: cacheError.message,
          });
        }
      }

      // Run fresh scan
      await this.runFreshScan(analysisId, directoryPath, options);
    } catch (error) {
      logger.error(`Analysis failed for ${analysisId}`, { error: error.message });

      // Update analysis state with error
      if (this.server?.activeAnalyses) {
        const analysis = this.server.activeAnalyses.get(analysisId);
        if (analysis) {
          analysis.status = "error";
          analysis.error = error.message;
          analysis.endTime = Date.now();
          this.server.activeAnalyses.set(analysisId, analysis);
        }
      }

      throw error;
    }
  }

  /**
   * Run fresh scan with native binary
   */
  async runFreshScan(analysisId, directoryPath, options = {}) {
    logger.log("🔍", `Starting fresh scan for ${analysisId}`);

    // Get tempFileName from analysis entry or generate new one
    const analysis = this.server?.activeAnalyses?.get(analysisId);
    const tempFileName = analysis?.tempFileName || `temp_analysis_${crypto.randomUUID()}.json`;

    return new Promise((resolve, reject) => {
      const scannerPath = path.join(__dirname, "..", "..", "bin", "space-analyzer.exe");

      if (!fs.existsSync(scannerPath)) {
        reject(new Error(`Scanner binary not found at ${scannerPath}`));
        return;
      }

      const args = [
        directoryPath,
        "--json-progress",
        "--parallel",
        "--max-files",
        (options.maxFiles || 100000).toString(),
        ...(options.includeHidden ? ["--hidden"] : []),
        "--output",
        tempFileName,
      ];

      logger.log("🔧", `Running scanner: ${scannerPath} ${args.join(" ")}`);

      const scanner = spawn(scannerPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: path.dirname(scannerPath),
      });

      // Store process reference for cancellation
      if (this.server?.activeAnalyses) {
        const analysis = this.server.activeAnalyses.get(analysisId);
        if (analysis) {
          analysis.process = scanner;
          this.server.activeAnalyses.set(analysisId, analysis);
        }
      }

      let output = "";
      let errorOutput = "";

      scanner.stdout.on("data", (data) => {
        const chunk = data.toString();
        output += chunk;

        // Try to parse progress updates from Rust CLI
        try {
          const lines = chunk.split("\n").filter((line) => line.trim());
          lines.forEach((line) => {
            // Handle both progress JSON lines and final result
            if (line.startsWith("{") && line.endsWith("}")) {
              const parsed = JSON.parse(line);

              // Check if this is a progress update from the Rust CLI
              if (parsed.event === "progress") {
                const progress = {
                  files: parsed.files || 0,
                  percentage: Math.min(100, Math.max(0, (parsed.files / 100000) * 100)), // Percentage based on maxFiles limit
                  currentFile: parsed.currentFile || "",
                  totalSize: parsed.size || 0,
                  timestamp: parsed.timestamp,
                };
                this.updateProgress(analysisId, progress);
                logger.log(
                  "📊",
                  `Progress update: ${progress.files} files, ${progress.percentage.toFixed(1)}%`
                );
              } else if (parsed.event === "status" && parsed.status === "complete") {
                // Final completion message
                const progress = {
                  files: parsed.files || 0,
                  percentage: 100,
                  currentFile: "Analysis complete",
                  totalSize: parsed.size || 0,
                  completed: true,
                };
                this.updateProgress(analysisId, progress);
                logger.log("✅", `Analysis complete: ${parsed.files} files`);
              }
            }
          });
        } catch (parseError) {
          // Ignore parse errors for non-JSON output
          logger.debug("Failed to parse progress line", { error: parseError.message });
        }
      });

      scanner.stderr.on("data", (data) => {
        errorOutput += data.toString();
        logger.warn(`Scanner stderr: ${data.toString()}`);
      });

      scanner.on("close", (code) => {
        logger.log("🔚", `Scanner process finished with code: ${code}`);

        if (code === 0) {
          try {
            // Read the result from the output file instead of stdout
            const outputFile = path.join(path.dirname(scannerPath), tempFileName);
            logger.log("🔍", `Looking for output file: ${outputFile}`);

            if (fs.existsSync(outputFile)) {
              const resultData = fs.readFileSync(outputFile, "utf8");
              logger.log("📄", `Output file size: ${resultData.length} characters`);

              // Try to extract the first valid JSON object from the file
              let jsonToParse = resultData.trim();

              // Find the first complete JSON object
              if (jsonToParse.startsWith("{")) {
                let braceCount = 0;
                let jsonEnd = -1;

                for (let i = 0; i < jsonToParse.length; i++) {
                  const char = jsonToParse[i];
                  if (char === "{") braceCount++;
                  if (char === "}") braceCount--;

                  if (braceCount === 0 && char === "}") {
                    jsonEnd = i + 1;
                    break;
                  }
                }

                if (jsonEnd > 0) {
                  jsonToParse = jsonToParse.substring(0, jsonEnd);
                }
              }

              const result = JSON.parse(jsonToParse);
              logger.log("✅", `Successfully parsed JSON with ${result.total_files || 0} files`);
              this.handleScanComplete(analysisId, result);
              resolve(result);
            } else {
              reject(new Error(`Output file not found: ${outputFile}`));
            }
          } catch (parseError) {
            logger.error("Failed to parse scanner output", { error: parseError.message });
            logger.error("Parse error details", { error: parseError.message });
            reject(new Error("Failed to parse scanner output"));
          }
        } else {
          const error = new Error(`Scanner failed with code ${code}: ${errorOutput}`);
          reject(error);
        }
      });

      scanner.on("error", (error) => {
        logger.error("Scanner process error:", { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Update analysis progress
   */
  updateProgress(analysisId, progress) {
    if (!this.server?.activeAnalyses) return;

    const analysis = this.server.activeAnalyses.get(analysisId);
    if (analysis) {
      analysis.progress = progress.percentage || progress.progress || 0;
      analysis.filesScanned = progress.files || progress.filesScanned || 0;
      analysis.bytesScanned = progress.totalSize || progress.bytesScanned || 0;
      analysis.currentFile = progress.currentFile || "";
      analysis.status = progress.completed ? "complete" : "running";
      analysis.lastUpdate = Date.now();
      this.server.activeAnalyses.set(analysisId, analysis);

      // Emit progress event for SSE
      if (this.server.eventEmitter) {
        this.server.eventEmitter.emit("progress", {
          analysisId,
          progress: analysis.progress,
          filesScanned: analysis.filesScanned,
          currentFile: analysis.currentFile,
          status: analysis.status,
        });
      }
    }
  }

  /**
   * Handle scan completion
   */
  handleScanComplete(analysisId, result) {
    logger.log("✅", `Scan completed for ${analysisId}`);

    // Store result in memory
    if (this.server?.analysisResults) {
      this.server.analysisResults.set(analysisId, {
        ...result,
        completedAt: Date.now(),
        directoryPath: result.directory || result.path,
      });
    }

    // Also store in database for persistence
    if (this.server?.knowledgeDB?.db && result.directory) {
      try {
        this.server.knowledgeDB
          .storeAnalysis(result.directory, result)
          .then((storedId) => {
            logger.log("💾", `Analysis stored in database with ID: ${storedId}`);
          })
          .catch((dbError) => {
            logger.warn("Database storage error", { error: dbError.message });
          });
      } catch (dbError) {
        logger.warn("Database storage error", { error: dbError.message });
      }
    }

    // Update analysis state
    if (this.server?.activeAnalyses) {
      const analysis = this.server.activeAnalyses.get(analysisId);
      if (analysis) {
        analysis.status = "complete";
        analysis.progress = 100;
        analysis.endTime = Date.now();
        this.server.activeAnalyses.set(analysisId, analysis);

        // Schedule cleanup of completed analysis after 5 minutes
        setTimeout(
          () => {
            const analysis = this.server.activeAnalyses.get(analysisId);
            if (analysis && analysis.status === "complete") {
              logger.log("🧹", `Cleaning up completed analysis ${analysisId} from activeAnalyses`);
              this.server.activeAnalyses.delete(analysisId);
            }
          },
          5 * 60 * 1000
        ); // 5 minutes
      }
    }
  }
}

module.exports = AnalysisRoutes;
