/**
 * Core Analysis Routes
 * Current status, start, cancel, progress streaming
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");

class CoreRoutes {
  constructor(server, router) {
    this.server = server;
    this.router = router;
    this.setupRoutes();
  }

  setupRoutes() {
    // Backward-compatible: POST /api/analyze (alias for /api/analysis/start)
    this.router.post("/analyze", async (req, res) => {
      try {
        const { directoryPath, path, options = {} } = req.body;
        const targetPath = directoryPath || path;

        if (!targetPath) {
          return res.status(400).json({
            success: false,
            error: "Path is required (directoryPath or path)",
          });
        }

        // Validate path
        if (this.server.isValidPath && !this.server.isValidPath(targetPath)) {
          return res.status(400).json({
            success: false,
            error: "Invalid path",
          });
        }

        // Generate analysis ID
        const analysisId = `analysis-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

        // Initialize analysis state
        const analysis = {
          id: analysisId,
          directoryPath: targetPath,
          status: "starting",
          progress: 0,
          startTime: Date.now(),
          filesScanned: 0,
          bytesScanned: 0,
          currentFile: "",
          options,
        };

        this.server.activeAnalyses.set(analysisId, analysis);

        // Start analysis in background
        this.runAnalysis(analysisId, targetPath, options).catch((error) => {
          console.error(`Analysis ${analysisId} failed:`, error);
          analysis.status = "error";
          analysis.error = error.message;
        });

        res.json({
          success: true,
          analysisId,
          status: "starting",
          message: "Analysis started",
        });
      } catch (error) {
        console.error("Start analysis error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Backward-compatible: POST /api/analyze/cancel
    this.router.post("/analyze/cancel", async (req, res) => {
      try {
        const { analysisId } = req.body;

        if (!analysisId) {
          // Cancel all active
          let count = 0;
          for (const [id, analysis] of this.server.activeAnalyses) {
            if (analysis.process) {
              analysis.process.kill();
              count++;
            }
          }
          this.server.activeAnalyses.clear();
          return res.json({ success: true, message: `Cancelled ${count} analyses` });
        }

        const analysis = this.server.activeAnalyses.get(analysisId);
        if (!analysis) {
          return res.status(404).json({ success: false, error: "Analysis not found" });
        }

        if (analysis.process) {
          analysis.process.kill();
        }

        analysis.status = "cancelled";
        this.server.activeAnalyses.delete(analysisId);

        res.json({ success: true, message: "Analysis cancelled" });
      } catch (error) {
        console.error("Cancel analysis error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Backward-compatible: POST /api/analyze/file (drag-drop file analysis)
    this.router.post("/analyze/file", async (req, res) => {
      try {
        // Handle multipart form data for file uploads
        const busboy = require("busboy");
        const bb = busboy({ headers: req.headers });

        let filePath = "";
        let fileSize = 0;

        bb.on("field", (fieldname, val) => {
          if (fieldname === "filePath") filePath = val;
          if (fieldname === "fileSize") fileSize = parseInt(val) || 0;
        });

        bb.on("finish", async () => {
          if (!filePath) {
            return res.status(400).json({
              success: false,
              error: "filePath is required",
            });
          }

          // Return immediate response - actual analysis happens via code-quality endpoint
          res.json({
            success: true,
            message: "File analysis request received",
            filePath,
            fileSize,
            analysisId: `file-analysis-${Date.now()}`,
          });
        });

        req.pipe(bb);
      } catch (error) {
        console.error("File analysis error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get current analysis status
    this.router.get("/analysis/current", async (req, res) => {
      try {
        const { path: queryPath } = req.query;

        if (!queryPath) {
          return res.status(400).json({
            success: false,
            error: "Path parameter is required",
          });
        }

        const normalizedPath = this.server.normalizePath
          ? this.server.normalizePath(queryPath)
          : queryPath;

        // Find active analysis
        let activeAnalysis = null;
        if (this.server?.activeAnalyses) {
          for (const [id, analysis] of this.server.activeAnalyses.entries()) {
            const analysisPath = this.server.normalizePath
              ? this.server.normalizePath(analysis.directoryPath)
              : analysis.directoryPath;

            if (analysisPath === normalizedPath) {
              activeAnalysis = { id, ...analysis };
              break;
            }
          }
        }

        // Find completed analysis
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
                result,
              };
              break;
            }
          }
        }

        if (activeAnalysis) {
          res.json({ success: true, analysis: activeAnalysis, type: "active" });
        } else if (completedAnalysis) {
          res.json({ success: true, analysis: completedAnalysis, type: "completed" });
        } else {
          res.json({ success: true, analysis: null, type: "none" });
        }
      } catch (error) {
        console.error("Get current analysis error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Start new analysis
    this.router.post("/analysis/start", async (req, res) => {
      try {
        const { path: directoryPath, options = {} } = req.body;

        if (!directoryPath) {
          return res.status(400).json({
            success: false,
            error: "Path is required",
          });
        }

        // Validate path
        if (this.server.isValidPath && !this.server.isValidPath(directoryPath)) {
          return res.status(400).json({
            success: false,
            error: "Invalid path",
          });
        }

        // Generate analysis ID
        const analysisId = `analysis-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

        // Initialize analysis state
        const analysis = {
          id: analysisId,
          directoryPath,
          status: "starting",
          progress: 0,
          startTime: Date.now(),
          filesScanned: 0,
          bytesScanned: 0,
          currentFile: "",
          options,
        };

        this.server.activeAnalyses.set(analysisId, analysis);

        // Start analysis in background
        this.runAnalysis(analysisId, directoryPath, options).catch((error) => {
          console.error(`Analysis ${analysisId} failed:`, error);
          analysis.status = "error";
          analysis.error = error.message;
        });

        res.json({
          success: true,
          analysisId,
          status: "starting",
          message: "Analysis started",
        });
      } catch (error) {
        console.error("Start analysis error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Cancel analysis
    this.router.post("/analysis/cancel", async (req, res) => {
      try {
        const { analysisId } = req.body;

        if (!analysisId) {
          // Cancel all active
          let count = 0;
          for (const [id, analysis] of this.server.activeAnalyses) {
            if (analysis.process) {
              analysis.process.kill();
              count++;
            }
          }
          this.server.activeAnalyses.clear();
          return res.json({ success: true, message: `Cancelled ${count} analyses` });
        }

        const analysis = this.server.activeAnalyses.get(analysisId);
        if (!analysis) {
          return res.status(404).json({ success: false, error: "Analysis not found" });
        }

        if (analysis.process) {
          analysis.process.kill();
        }

        analysis.status = "cancelled";
        this.server.activeAnalyses.delete(analysisId);

        res.json({ success: true, message: "Analysis cancelled" });
      } catch (error) {
        console.error("Cancel analysis error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get analysis status
    this.router.get("/analysis/status/:analysisId", async (req, res) => {
      try {
        const { analysisId } = req.params;
        const analysis = this.server.activeAnalyses.get(analysisId);

        if (!analysis) {
          // Check if completed
          const result = this.server.analysisResults?.get(analysisId);
          if (result) {
            return res.json({
              success: true,
              status: "complete",
              analysisId,
              result,
            });
          }
          return res.status(404).json({ success: false, error: "Analysis not found" });
        }

        res.json({
          success: true,
          status: analysis.status,
          analysisId,
          progress: analysis.progress,
          filesScanned: analysis.filesScanned,
          bytesScanned: analysis.bytesScanned,
          currentFile: analysis.currentFile,
        });
      } catch (error) {
        console.error("Get analysis status error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Progress stream (SSE)
    this.router.get("/analysis/progress/:analysisId", async (req, res) => {
      const { analysisId } = req.params;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendProgress = () => {
        const analysis = this.server.activeAnalyses.get(analysisId);

        if (!analysis) {
          res.write(`data: ${JSON.stringify({ status: "not-found" })}\n\n`);
          res.end();
          return;
        }

        res.write(`data: ${JSON.stringify(analysis)}\n\n`);

        if (analysis.status === "complete" || analysis.status === "error") {
          res.end();
        }
      };

      sendProgress();
      const interval = setInterval(sendProgress, 1000);

      // Timeout after 5 minutes
      setTimeout(
        () => {
          clearInterval(interval);
          res.end();
        },
        5 * 60 * 1000
      );
    });

    console.log("  ✅ Core analysis routes added");
  }

  // Run analysis implementation
  async runAnalysis(analysisId, directoryPath, options = {}) {
    console.log(`🚀 Starting analysis ${analysisId} for ${directoryPath}`);

    const analysis = this.server.activeAnalyses.get(analysisId);
    if (!analysis) return;

    analysis.status = "running";

    try {
      // Use native scanner binary
      const scannerPath = path.join(__dirname, "../../bin/space-analyzer.exe");
      const tempFile = path.join(__dirname, `../../temp/scan-${analysisId}.json`);

      // Ensure temp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const args = ["scan", directoryPath, "--output", tempFile];

      if (options.includeHidden) args.push("--include-hidden");
      if (options.followSymlinks) args.push("--follow-symlinks");
      if (options.maxDepth) args.push("--max-depth", options.maxDepth.toString());

      return new Promise((resolve, reject) => {
        const process = spawn(scannerPath, args, { stdio: ["ignore", "pipe", "pipe"] });

        analysis.process = process;

        let stderr = "";
        process.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        process.on("close", async (code) => {
          // Clean up process reference
          analysis.process = null;

          if (code !== 0) {
            analysis.status = "error";
            analysis.error = stderr || `Scanner exited with code ${code}`;
            // Clean up temp file on error
            try {
              fs.unlinkSync(tempFile);
            } catch (e) {
              /* ignore */
            }
            reject(new Error(analysis.error));
            return;
          }

          try {
            // Check if temp file exists
            if (!fs.existsSync(tempFile)) {
              throw new Error("Scanner output file not found");
            }

            // Get file stats to check size
            const stats = fs.statSync(tempFile);
            console.log(`📊 Scan output file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

            // For very large files, we might need streaming parsing
            // For now, use chunked reading for files > 100MB
            let results;
            if (stats.size > 100 * 1024 * 1024) {
              console.warn("⚠️ Large scan result, using buffered read");
            }

            // Read and parse results
            const fileContent = fs.readFileSync(tempFile, "utf8");
            results = JSON.parse(fileContent);

            // Validate results structure
            if (!results || typeof results !== "object") {
              throw new Error("Invalid scan results structure");
            }

            // Clean up temp file
            try {
              fs.unlinkSync(tempFile);
            } catch (e) {
              /* ignore */
            }

            // Store results in memory
            this.server.analysisResults.set(analysisId, {
              ...results,
              directory: directoryPath,
              analysisId,
              completedAt: Date.now(),
            });

            // Also save to database for persistence (fire and forget)
            if (this.server?.knowledgeDB?.analysis?.storeAnalysis) {
              this.server.knowledgeDB.analysis
                .storeAnalysis(directoryPath, results)
                .then((dbId) => {
                  console.log(`💾 Analysis saved to database with ID: ${dbId}`);
                })
                .catch((dbError) => {
                  console.warn("⚠️ Failed to save analysis to database:", dbError.message);
                });
            }

            // Auto-trigger AI categorization for uncategorized files
            if (results.files && results.files.length > 0) {
              this.triggerAICategorization(analysisId, directoryPath, results.files)
                .then((catResult) => {
                  if (catResult.categorized > 0) {
                    console.log(`🤖 AI categorized ${catResult.categorized} files`);
                  }
                })
                .catch((err) => {
                  // Don't fail the scan if AI categorization fails
                  console.warn("⚠️ AI categorization failed (non-critical):", err.message);
                });
            }

            analysis.status = "complete";
            analysis.progress = 100;

            resolve(results);
          } catch (error) {
            console.error("❌ Error processing scan results:", error);
            analysis.status = "error";
            analysis.error = error.message || "Failed to process scan results";
            // Clean up temp file on error
            try {
              fs.unlinkSync(tempFile);
            } catch (e) {
              /* ignore */
            }
            reject(error);
          }
        });

        // Handle process errors (crash, killed, etc.)
        process.on("error", (error) => {
          console.error("❌ Scanner process error:", error);
          analysis.status = "error";
          analysis.error = `Scanner process error: ${error.message}`;
          analysis.process = null;
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            /* ignore */
          }
          reject(error);
        });
      });
    } catch (error) {
      analysis.status = "error";
      analysis.error = error.message;
      throw error;
    }
  }

  /**
   * Trigger AI categorization for uncategorized files after scan completes
   * Non-blocking - runs in background, doesn't affect scan result
   */
  async triggerAICategorization(analysisId, directoryPath, files) {
    try {
      // Filter files that need categorization (no category or 'other')
      const uncategorizedFiles = files.filter((f) => !f.category || f.category === "other");

      if (uncategorizedFiles.length === 0) {
        return { categorized: 0, message: "No files to categorize" };
      }

      // Limit to first 50 files to avoid overwhelming the AI service
      const filesToCategorize = uncategorizedFiles.slice(0, 50);

      // Prepare file data for AI service
      const fileData = filesToCategorize.map((f) => ({
        path: f.path || f.name,
        name: f.name || f.path?.split(/[\\/]/).pop() || "unknown",
        size: f.size || 0,
        extension: f.extension || f.path?.split(".").pop() || "",
        modified_time: f.modified_time || Date.now() / 1000,
      }));

      // Call AI service via proxy route (or directly if axios available)
      const axios = require("axios");
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

      const response = await axios.post(`${AI_SERVICE_URL}/predict/categories-batch`, fileData, {
        timeout: 30000,
      });

      const predictions = response.data?.predictions || [];

      // Update files with predicted categories
      let categorizedCount = 0;
      predictions.forEach((prediction) => {
        const fileIndex = files.findIndex((f) => (f.path || f.name) === prediction.path);
        if (fileIndex >= 0) {
          files[fileIndex].category = prediction.predicted_category;
          files[fileIndex].ai_confidence = prediction.confidence;
          categorizedCount++;
        }
      });

      // Store AI categorization results in analysisResults
      const analysisResult = this.server.analysisResults.get(analysisId);
      if (analysisResult) {
        analysisResult.aiCategorized = categorizedCount;
        analysisResult.aiCategories = predictions.map((p) => ({
          path: p.path,
          category: p.predicted_category,
          confidence: p.confidence,
        }));
      }

      return {
        categorized: categorizedCount,
        total: filesToCategorize.length,
        message: `AI categorized ${categorizedCount} files`,
      };
    } catch (error) {
      console.error("AI categorization error:", error.message);
      throw error;
    }
  }
}

module.exports = CoreRoutes;
