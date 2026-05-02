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

class AnalysisRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    this.analysisController = new AnalysisController(server);
    console.log("🚀 AnalysisRoutes initialized [v2.8.2-code-quality]");
    this.setupRoutes();
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

        console.log(`🔍 Looking for current analysis for path: ${normalizedPath}`);

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
              console.log(`✅ Found active analysis: ${id}`);
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
              console.log(`✅ Found completed analysis: ${id}`);
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
          console.log(`ℹ️ No analysis found for path: ${normalizedPath}`);
          res.json({
            success: true,
            analysis: null,
            message: `No analysis found for path: ${normalizedPath}`,
          });
        }
      } catch (error) {
        console.error("❌ Get current analysis error:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to get current analysis",
        });
      }
    });

    // Main Analysis Endpoint
    this.router.post("/analyze", async (req, res) => {
      try {
        console.log("🚀 Starting new analysis request");
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
        console.log(`📂 Analyzing directory: ${directoryPath}`);

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

        // Generate unique analysis ID
        const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🆔 Generated analysis ID: ${analysisId}`);

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
          console.log(`📊 Stored initial analysis state for ${analysisId}`);
        } else {
          console.error("❌ activeAnalyses not available on server");
          return res.status(500).json({
            success: false,
            error: "Server analysis storage not available",
          });
        }

        // Start analysis process asynchronously
        this.runAnalysis(analysisId, directoryPath, options).catch((error) => {
          console.error(`❌ Analysis failed to start for ${analysisId}:`, error);
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
        console.error("❌ Analysis endpoint error:", error);
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
          startTime: progress.startTime,
          endTime: progress.endTime,
          error: progress.error || null,
          estimatedTimeRemaining,
          directoryPath: progress.directoryPath,
          // Include full progress data for debugging
          ...progress,
        });
      } catch (error) {
        console.error("❌ Progress endpoint error:", error);
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
            console.error("❌ Error sending progress data:", error);
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
          console.log(`🔌 Client disconnected from progress stream for ${analysisId}`);
        });

        req.on("error", (error) => {
          clearInterval(interval);
          console.error(`❌ Error in progress stream for ${analysisId}:`, error);
        });

        // Set timeout to prevent hanging connections
        setTimeout(() => {
          if (interval) {
            clearInterval(interval);
            res.end();
          }
        }, 300000); // 5 minute timeout
      } catch (error) {
        console.error("❌ Progress stream endpoint error:", error);
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

        console.log(`📊 Fetching results for analysis ID: ${analysisId}`);

        // Check if analysisResults is available
        if (this.server?.analysisResults) {
          console.log(
            `🔍 Available analysis results:`,
            Array.from(this.server.analysisResults.keys())
          );
        }

        // Check if activeAnalyses is available
        if (this.server?.activeAnalyses) {
          console.log(`🔍 Available active analyses:`, Array.from(this.server.activeAnalyses.keys()));
        }

        // First check completed results in memory
        let result = this.server?.analysisResults?.get(analysisId);
        if (result) {
          console.log(`✅ Found completed results in memory for ${analysisId}`);
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
          console.log(`⏳ Analysis ${analysisId} still active, status: ${active.status}`);

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
            console.log(`🔍 Checking database for historical results of ${analysisId}`);
            const dbResult = await this.server.knowledgeDB.getAnalysis(analysisId);

            if (dbResult) {
              console.log(`✅ Found historical results in database for ${analysisId}`);
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
            console.error(`❌ Database query failed for ${analysisId}:`, dbError);
            // Continue to 404 response
          }
        }

        console.log(`❌ No analysis found for ID: ${analysisId}`);
        return res.status(404).json({
          success: false,
          error: "Analysis not found in memory or database",
          analysisId,
          availableResults: this.server?.analysisResults ?
            Array.from(this.server.analysisResults.keys()) : [],
          activeAnalyses: this.server?.activeAnalyses ?
            Array.from(this.server.activeAnalyses.keys()) : [],
        });
      } catch (error) {
        console.error("❌ Results endpoint error:", error);
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

        console.log(`🔍 Looking for analysis results for path: ${directoryPath}`);

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
        console.error("❌ Get results by path error:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch analysis results",
        });
      }
    });

    // Cancel analysis
    this.router.post("/cancel", async (req, res) => {
      try {
        const { analysisId } = req.body;

        console.log(`🛑 Cancel request received for analysis: ${analysisId}`);

        // If no ID provided, cancel all active scans
        if (!analysisId) {
          if (this.server?.activeAnalyses) {
            // Cancel all active scans
            for (const [id, analysis] of this.server.activeAnalyses) {
              if (analysis.process) {
                analysis.process.kill();
                console.log(`🛑 Killed scanner process for analysis ${id}`);
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
              console.log(`🛑 Killed scanner process for analysis ${analysisId}`);
            }
            this.server.activeAnalyses.delete(analysisId);
            return res.json({ success: true, message: `Analysis ${analysisId} cancelled` });
          }
        }

        res.status(404).json({ error: "Analysis not found or already completed" });
      } catch (error) {
        console.error("❌ Cancel analysis error:", error);
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
            error: "Analysis not found or has no file data"
          });
        }

        let files = [...result.files];

        // Apply filters
        if (category) {
          files = files.filter(file => file.category === category);
        }

        if (extension) {
          files = files.filter(file => file.extension === extension);
        }

        if (search) {
          const searchLower = search.toLowerCase();
          files = files.filter(file =>
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
        console.error("❌ Get analysis files error:", error);
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
            error: "Analysis not found"
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
          result.files.forEach(file => {
            // Category stats
            const category = file.category || 'Unknown';
            stats.categories[category] = (stats.categories[category] || 0) + 1;

            // Extension stats
            const ext = file.extension || 'No extension';
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
            .map(file => ({
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
        console.error("❌ Get analysis stats error:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch analysis statistics",
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
          availableResults: this.server?.analysisResults ?
            Array.from(this.server.analysisResults.keys()) : [],
        };

        const dbInfo = {
          connected: !!(this.server?.knowledgeDB?.db),
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
        console.error("❌ Health check error:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Health check failed",
        });
      }
    });

    // Setup code quality analysis routes
    this.setupCodeQualityRoutes();
  }

  /**
   * Run analysis with enhanced error handling and progress tracking
   */
  async runAnalysis(analysisId, directoryPath, options = {}) {
    console.log(`🚀 Starting analysis run for ${analysisId} in ${directoryPath}`);

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
            console.log(`♻️ Found cached analysis for unchanged directory: ${directoryPath}`);

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

            console.log(`📊 Analysis ${analysisId} completed from cache`);
            return;
          }
        } catch (cacheError) {
          console.warn("⚠️ Cache check failed, proceeding with fresh scan:", cacheError);
        }
      }

      // Run fresh scan
      await this.runFreshScan(analysisId, directoryPath, options);

    } catch (error) {
      console.error(`❌ Analysis failed for ${analysisId}:`, error);

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
    console.log(`🔍 Starting fresh scan for ${analysisId}`);

    return new Promise((resolve, reject) => {
      const scannerPath = path.join(__dirname, "..", "native", "scanner", "target", "release", "space_scanner.exe");

      if (!fs.existsSync(scannerPath)) {
        reject(new Error(`Scanner binary not found at ${scannerPath}`));
        return;
      }

      const args = [
        directoryPath,
        "--json",
        "--max-files", (options.maxFiles || 100000).toString(),
        "--include-hidden", options.includeHidden ? "true" : "false",
        "--follow-symlinks", options.followSymlinks ? "true" : "false",
      ];

      console.log(`🔧 Running scanner: ${scannerPath} ${args.join(" ")}`);

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

        // Try to parse progress updates
        try {
          const lines = chunk.split("\n").filter(line => line.trim());
          lines.forEach(line => {
            if (line.startsWith("{") && line.endsWith("}")) {
              const progress = JSON.parse(line);
              this.updateProgress(analysisId, progress);
            }
          });
        } catch (parseError) {
          // Ignore parse errors for non-JSON output
        }
      });

      scanner.stderr.on("data", (data) => {
        errorOutput += data.toString();
        console.warn(`⚠️ Scanner stderr: ${data.toString()}`);
      });

      scanner.on("close", (code) => {
        console.log(`🔚 Scanner process finished with code: ${code}`);

        if (code === 0) {
          try {
            const result = JSON.parse(output);
            this.handleScanComplete(analysisId, result);
            resolve(result);
          } catch (parseError) {
            console.error("❌ Failed to parse scanner output:", parseError);
            reject(new Error("Failed to parse scanner output"));
          }
        } else {
          const error = new Error(`Scanner failed with code ${code}: ${errorOutput}`);
          reject(error);
        }
      });

      scanner.on("error", (error) => {
        console.error("❌ Scanner process error:", error);
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
      this.server.activeAnalyses.set(analysisId, analysis);
    }
  }

  /**
   * Handle scan completion
   */
  handleScanComplete(analysisId, result) {
    console.log(`✅ Scan completed for ${analysisId}`);

    // Store result
    if (this.server?.analysisResults) {
      this.server.analysisResults.set(analysisId, {
        ...result,
        completedAt: Date.now(),
        directoryPath: result.directory || result.path,
      });
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
        setTimeout(() => {
          const analysis = this.server.activeAnalyses.get(analysisId);
          if (analysis && analysis.status === "complete") {
            console.log(`🧹 Cleaning up completed analysis ${analysisId} from activeAnalyses`);
            this.server.activeAnalyses.delete(analysisId);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
    }
  }
}

module.exports = AnalysisRoutes;
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
        console.log("📊 Fetching analysis history...");

        // Wait for database to be initialized if needed
        if (this.server.dbInitializationPromise) {
          console.log("⏳ Waiting for database initialization...");
          await this.server.dbInitializationPromise;
        }

        // Check if knowledgeDB is available
        if (!this.server.knowledgeDB) {
          console.warn("⚠️ KnowledgeDB not available, returning empty history");
          return res.json({
            success: true,
            analyses: [],
            count: 0,
            message: "Database not initialized",
          });
        }

        // Check if database connection is active
        if (!this.server.knowledgeDB.db) {
          console.warn("⚠️ Database connection not active, returning empty history");
          return res.json({
            success: true,
            analyses: [],
            count: 0,
            message: "Database connection not active",
          });
        }

        let analyses = [];
        try {
          analyses = await this.server.knowledgeDB.getAnalysisHistory();
          console.log(`✅ Found ${analyses?.length || 0} analyses in history`);
        } catch (dbError) {
          console.error("❌ Main getAnalysisHistory failed, trying fallback:", dbError);

          // Try basic fallback method
          try {
            analyses = await this.server.knowledgeDB.analysis.getBasicAnalysisHistory();
            console.log(`🔄 Fallback method found ${analyses?.length || 0} analyses`);
          } catch (fallbackError) {
            console.error("❌ Fallback method also failed:", fallbackError);
            analyses = [];
          }
        }

        res.json({
          success: true,
          analyses: analyses || [],
          count: analyses?.length || 0,
        });
      } catch (error) {
        console.error("❌ Get analysis history error:", error);
        console.error("Error stack:", error.stack);

        // Always return empty history on any error - never return 500
        // This ensures the frontend can handle it gracefully
        console.log("🔧 Returning empty history due to error");
        return res.json({
          success: true,
          analyses: [],
          count: 0,
          message:
            error?.message?.includes("SQLITE") || error?.message?.includes("database")
              ? "Database temporarily unavailable"
              : "Failed to fetch history",
        });
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

  async computeDirectoryFingerprint(directoryPath, options = {}) {
    const excludeDirs = new Set([
      ".git",
      "node_modules",
      "__pycache__",
      ".cache",
      "target",
      "build",
      ".vscode",
      ".idea",
      ".tmp",
      "temp",
      "tmp",
    ]);
    const includeHidden = Boolean(options.includeHidden || options.hidden);
    const maxDepth = Number(options.maxDepth || options.max_depth || 100);
    const normalizedRoot = path.resolve(directoryPath);
    const hash = crypto.createHash("sha256");
    let totalFiles = 0;
    let totalSize = 0;
    let latestMtimeMs = 0;

    const walk = async (currentPath, depth) => {
      if (depth > maxDepth) return;

      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        if (!includeHidden && entry.name.startsWith(".")) continue;
        if (entry.isDirectory() && excludeDirs.has(entry.name)) continue;

        const entryPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(normalizedRoot, entryPath).replace(/\\/g, "/");
        let stats;

        try {
          stats = await fs.promises.lstat(entryPath);
        } catch {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(entryPath, depth + 1);
          continue;
        }

        if (!entry.isFile()) continue;

        totalFiles += 1;
        totalSize += stats.size;
        latestMtimeMs = Math.max(latestMtimeMs, stats.mtimeMs);
        hash.update(`${relativePath}\0${stats.size}\0${Math.trunc(stats.mtimeMs)}\n`);
      }
    };

    await walk(normalizedRoot, 0);

    return {
      hash: hash.digest("hex"),
      totalFiles,
      totalSize,
      latestMtimeMs: Math.trunc(latestMtimeMs),
      generatedAt: Date.now(),
    };
  }

  formatCachedAnalysis(analysisId, directoryPath, cachedRow, fingerprint) {
    const cachedData = cachedRow.analysis_data || {};
    return {
      ...cachedData,
      cache_hit: true,
      cached: true,
      reused_from_analysis_id: cachedRow.id,
      analysisId,
      directory: directoryPath,
      directoryPath,
      completedAt: Date.now(),
      lastAnalyzed: cachedRow.last_analyzed,
      directory_fingerprint: fingerprint.hash,
      directory_fingerprint_details: fingerprint,
    };
  }

  async runAnalysis(analysisId, directoryPath, options) {
    const analysis = this.server.activeAnalyses.get(analysisId);
    if (!analysis) return;

    try {
      const normalizedPath = this.server.normalizePath(directoryPath);
      const forceRescan = Boolean(options.forceRescan || options.force || options.noCache);
      let directoryFingerprint = null;

      if (this.server.knowledgeDB && !forceRescan) {
        try {
          analysis.status = "checking-cache";
          analysis.statusMessage = "Checking for unchanged directory";
          this.server.activeAnalyses.set(analysisId, analysis);

          directoryFingerprint = await this.computeDirectoryFingerprint(directoryPath, options);
          const cachedAnalysis = await this.server.knowledgeDB.getAnalysis(normalizedPath);

          if (cachedAnalysis && cachedAnalysis.metadata_hash === directoryFingerprint.hash) {
            const cachedResult = this.formatCachedAnalysis(
              analysisId,
              directoryPath,
              cachedAnalysis,
              directoryFingerprint
            );

            this.server.analysisResults.set(analysisId, cachedResult);
            analysis.status = "complete";
            analysis.progress = 100;
            analysis.filesScanned = cachedResult.total_files || cachedResult.totalFiles || 0;
            analysis.bytesScanned = cachedResult.total_size || cachedResult.totalSize || 0;
            analysis.currentFile = "";
            analysis.cacheHit = true;
            analysis.endTime = Date.now();
            analysis.statusMessage = "Reused unchanged historical scan";
            this.server.activeAnalyses.set(analysisId, analysis);
            console.log(`♻️ Reused cached analysis for unchanged directory: ${normalizedPath}`);
            console.log(
              `📊 Analysis ${analysisId} completed and stored in both activeAnalyses and analysisResults`
            );
            // Don't return here - let the analysis remain in activeAnalyses for progress polling
            // return;

            // Schedule cleanup of completed analysis after 5 minutes
            setTimeout(
              () => {
                const analysis = this.server.activeAnalyses.get(analysisId);
                if (analysis && analysis.status === "complete") {
                  console.log(
                    `🧹 Cleaning up completed analysis ${analysisId} from activeAnalyses`
                  );
                  this.server.activeAnalyses.delete(analysisId);
                }
              },
              5 * 60 * 1000
            ); // 5 minutes
          }
        } catch (cacheError) {
          console.warn(`⚠️ Cache check failed, running fresh scan: ${cacheError.message}`);
          analysis.cacheCheckError = cacheError.message;
          this.server.activeAnalyses.set(analysisId, analysis);
        }
      }

      const bundledScannerPath = path.join(__dirname, "..", "..", "bin", "space-analyzer.exe");
      const releaseScannerPath = path.join(
        __dirname,
        "..",
        "..",
        "native",
        "scanner",
        "target",
        "release",
        "space-analyzer.exe"
      );
      const scannerPath = require("fs").existsSync(releaseScannerPath)
        ? releaseScannerPath
        : bundledScannerPath;
      const tempFile = path.join(__dirname, "..", "controllers", `output_${analysisId}.json`);

      console.log(`🚀 Starting scanner: ${scannerPath}`);
      console.log(`   Directory: ${directoryPath}`);
      console.log(`   Temp file: ${tempFile}`);

      // Check if scanner exists
      if (!require("fs").existsSync(scannerPath)) {
        throw new Error(`Scanner executable not found: ${scannerPath}`);
      }

      const scanner = spawn(
        scannerPath,
        [directoryPath, "--output", tempFile, "--progress", "--json-progress", "--quiet"],
        {
          cwd: path.dirname(scannerPath),
        }
      );

      analysis.process = scanner;
      analysis.status = "scanning";
      analysis.startTime = Date.now();

      let output = "";
      let errorOutput = "";
      let stderrLineBuffer = "";

      scanner.stdout.on("data", (data) => {
        const chunk = data.toString();
        output += chunk;

        // Parse progress from scanner output
        const lines = chunk.trim().split("\n");
        for (const line of lines) {
          // Look for the actual scanner progress pattern: "Scanned: 1234 files, Size: ... - Current: ..."
          const progressMatch = line.match(
            /Scanned:\s*(\d+)\s*files?,\s*Size:\s*[\d,]+\s*\(.*?\)\s*-\s*Current:\s*(.+)$/
          );
          if (progressMatch) {
            const files = parseInt(progressMatch[1]);
            const currentFile = progressMatch[2];

            // Calculate estimated progress based on file count (assuming typical directories have 100K-1M files)
            const estimatedProgress = Math.min(95, Math.floor((files / 10000) * 10)); // Rough estimate

            analysis.progress = estimatedProgress;
            analysis.currentFile = currentFile;
            analysis.filesScanned = files;

            // Update the active analysis in the server
            this.server.activeAnalyses.set(analysisId, analysis);

            console.log(`📊 Real scanner progress: ${files} files scanned (${estimatedProgress}%)`);
            console.log(`📁 Current file: ${currentFile}`);
          }

          // Fallback for simpler progress patterns
          const simpleMatch = line.match(/Scanned:\s*(\d+)\s*files/);
          if (simpleMatch) {
            const files = parseInt(simpleMatch[1]);
            const estimatedProgress = Math.min(95, Math.floor((files / 10000) * 10));

            analysis.progress = estimatedProgress;
            analysis.filesScanned = files;

            this.server.activeAnalyses.set(analysisId, analysis);
            console.log(`� Scanner progress: ${files} files scanned (${estimatedProgress}%)`);
          }
        }

        console.log(`📄 Scanner output: ${chunk.trim()}`);
      });

      scanner.stderr.on("data", (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        stderrLineBuffer += chunk;

        // Parse JSON progress events from stderr
        const lines = stderrLineBuffer.split(/\r?\n/);
        stderrLineBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line.trim());
            if (event.event === "progress") {
              analysis.progress = Math.max(1, Math.min(95, Math.floor((event.files / 10000) * 10)));
              analysis.filesScanned = event.files;
              analysis.currentFile = event.current_file;
              analysis.bytesScanned = event.size;
              analysis.hardLinkSavings = event.hard_link_savings;
              analysis.lastProgressAt = Date.now();
              this.server.activeAnalyses.set(analysisId, analysis);
              console.log(`📊 JSON Progress: ${event.files} files, current: ${event.current_file}`);
            } else if (event.event === "status") {
              analysis.lastStatus = event.status;
              analysis.statusMessage = event.message;
              analysis.lastProgressAt = Date.now();
              this.server.activeAnalyses.set(analysisId, analysis);
              console.log(`📡 Status: ${event.status} - ${event.message}`);
            }
          } catch {
            // Not JSON, treat as regular error output
            console.log(`⚠️ Scanner stderr: ${line}`);
          }
        }
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
          console.log(
            `✅ Successfully parsed ${results.total_files || 0} files from scanner results`
          );

          // Clean up temp file
          await fs.promises.unlink(tempFile).catch(() => {});

          // Store results
          console.log(`💾 Storing results for analysis ID: ${analysisId}`);
          if (!directoryFingerprint) {
            try {
              directoryFingerprint = await this.computeDirectoryFingerprint(directoryPath, options);
            } catch (fingerprintError) {
              console.warn(`⚠️ Could not fingerprint completed scan: ${fingerprintError.message}`);
            }
          }
          if (directoryFingerprint) {
            results.directory_fingerprint = directoryFingerprint.hash;
            results.directory_fingerprint_details = directoryFingerprint;
          }

          console.log(`📊 Results data:`, {
            totalFiles: results.total_files,
            totalSize: results.total_size,
            hasFiles: !!results.files,
            fileCount: results.files?.length || 0,
          });

          this.server.analysisResults.set(analysisId, {
            ...results,
            directory: directoryPath,
            analysisId,
            completedAt: Date.now(),
          });

          console.log(`✅ Results stored in memory for ${analysisId}`);
          console.log(
            `🔍 Current stored analyses:`,
            Array.from(this.server.analysisResults.keys())
          );

          // Update analysis status
          analysis.status = "complete";
          analysis.progress = 100;
          analysis.endTime = Date.now();
          this.server.activeAnalyses.set(analysisId, analysis);

          console.log(`✅ Analysis status updated to complete for ${analysisId}`);

          // Schedule cleanup of completed analysis after 5 minutes
          setTimeout(
            () => {
              const analysis = this.server.activeAnalyses.get(analysisId);
              if (analysis && analysis.status === "complete") {
                console.log(`🧹 Cleaning up completed analysis ${analysisId} from activeAnalyses`);
                this.server.activeAnalyses.delete(analysisId);
              }
            },
            5 * 60 * 1000
          ); // 5 minutes

          // Store in database
          const normalizedPath = this.server.normalizePath(directoryPath);
          console.log(`💾 Storing analysis results in database for: ${normalizedPath}`);

          if (!this.server.knowledgeDB) {
            console.error("❌ KnowledgeDB not available - cannot store analysis results");
            analysis.status = "error";
            analysis.error = "Database not available";
            this.server.activeAnalyses.set(analysisId, analysis);
            return;
          }

          try {
            const storedAnalysisId = await this.server.knowledgeDB.storeAnalysis(
              normalizedPath,
              results
            );
            console.log(`✅ Analysis stored in database with ID: ${storedAnalysisId}`);

            // Update analysis with database ID
            analysis.analysisId = storedAnalysisId;
            this.server.activeAnalyses.set(analysisId, analysis);
          } catch (dbError) {
            console.error("❌ Failed to store analysis in database:", dbError);
            // Don't fail the scan, just log the error
            console.warn("⚠️ Scan completed but database storage failed");
          }
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

  // ==================== CODE QUALITY ANALYSIS ENDPOINTS ====================

  /**
   * POST /analysis/code-quality
   * Run comprehensive code quality analysis on a project
   */
  setupCodeQualityRoutes() {
    // Analyze entire project
    this.router.post("/analysis/code-quality", async (req, res) => {
      try {
        const { projectPath } = req.body;

        if (!projectPath) {
          return res.status(400).json({
            success: false,
            error: "projectPath is required",
          });
        }

        // Validate path
        if (!this.server.isValidPath || this.server.isValidPath(projectPath)) {
          const results = await this.analysisController.analyzeCodeQuality(projectPath);
          res.json(results);
        } else {
          res.status(400).json({
            success: false,
            error: "Invalid project path",
          });
        }
      } catch (error) {
        console.error("Code quality analysis error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Analyze single file
    this.router.get("/analysis/file", async (req, res) => {
      try {
        const { path: filePath } = req.query;

        if (!filePath) {
          return res.status(400).json({
            success: false,
            error: "path query parameter is required",
          });
        }

        const results = await this.analysisController.analyzeSingleFile(filePath);
        res.json(results);
      } catch (error) {
        console.error("Single file analysis error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get available analysis tools status
    this.router.get("/analysis/tools-status", async (req, res) => {
      try {
        const status = await this.analysisController.getToolStatus();
        res.json(status);
      } catch (error) {
        console.error("Tools status error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Install analysis tools (returns install commands)
    this.router.post("/analysis/install-tools", async (req, res) => {
      try {
        const { tools } = req.body || {};

        // Return installation commands
        const installCommands = {
          eslint: "npm install --save-dev eslint",
          typescript: "npm install --save-dev typescript @typescript-eslint/parser @typescript-eslint/eslint-plugin",
          security: "npm install --save-dev eslint-plugin-security",
          sonarjs: "npm install --save-dev eslint-plugin-sonarjs",
          complexity: "npm install --save-dev complexity-report",
        };

        res.json({
          success: true,
          message: "Run these commands in your project directory to install tools",
          commands: tools ? tools.map((t) => installCommands[t]).filter(Boolean) : Object.values(installCommands),
          allTools: installCommands,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    console.log("  ✅ Code quality analysis routes added");
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AnalysisRoutes;
