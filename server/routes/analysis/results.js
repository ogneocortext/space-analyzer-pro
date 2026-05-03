/**
 * Results Routes
 * Retrieve analysis results, files, and statistics
 */

class ResultsRoutes {
  constructor(server, router) {
    this.server = server;
    this.router = router;
    this.setupRoutes();
  }

  setupRoutes() {
    // Get analysis results by ID
    this.router.get("/results/:id", async (req, res) => {
      try {
        const analysisId = req.params.id;

        if (!analysisId || typeof analysisId !== "string") {
          return res.status(400).json({
            success: false,
            error: "Valid analysis ID is required",
          });
        }

        // Check completed results
        let result = this.server?.analysisResults?.get(analysisId);
        if (result) {
          return res.json({
            success: true,
            id: analysisId,
            status: "complete",
            data: result,
            completedAt: result.completedAt,
          });
        }

        // Check active analyses
        const activeAnalysis = this.server?.activeAnalyses?.get(analysisId);
        if (activeAnalysis) {
          return res.json({
            success: true,
            id: analysisId,
            status: activeAnalysis.status,
            data: activeAnalysis,
          });
        }

        res.status(404).json({
          success: false,
          error: "Analysis not found",
        });
      } catch (error) {
        console.error("Get results error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get analysis files with pagination and filtering
    this.router.get("/analysis/:analysisId/files", async (req, res) => {
      try {
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

        const result = this.server?.analysisResults?.get(analysisId);
        if (!result || !result.files) {
          return res.status(404).json({
            success: false,
            error: "Analysis not found",
          });
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
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get analysis statistics
    this.router.get("/analysis/:analysisId/stats", async (req, res) => {
      try {
        const { analysisId } = req.params;

        const result = this.server?.analysisResults?.get(analysisId);
        if (!result) {
          return res.status(404).json({
            success: false,
            error: "Analysis not found",
          });
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
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get analysis health
    this.router.get("/analysis/health", async (req, res) => {
      try {
        const os = require("os");

        res.json({
          success: true,
          status: "healthy",
          timestamp: new Date().toISOString(),
          system: {
            platform: os.platform(),
            arch: os.arch(),
            uptime: os.uptime(),
            memory: {
              total: os.totalmem(),
              free: os.freemem(),
              used: os.totalmem() - os.freemem(),
            },
          },
          activeAnalyses: this.server?.activeAnalyses?.size || 0,
          completedAnalyses: this.server?.analysisResults?.size || 0,
        });
      } catch (error) {
        console.error("Analysis health error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get analysis history (all completed analyses) - from database
    this.router.get("/analysis/history", async (req, res) => {
      try {
        const { limit = 50, offset = 0 } = req.query;
        const maxLimit = Math.min(parseInt(limit) || 50, 100);
        const skip = parseInt(offset) || 0;

        // Try to get from database first
        if (this.server?.knowledgeDB?.analysis?.getAnalysisHistory) {
          try {
            const dbResult = await this.server.knowledgeDB.analysis.getAnalysisHistory(
              maxLimit,
              skip
            );

            res.json({
              success: true,
              analyses: dbResult.analyses,
              pagination: {
                total: dbResult.total,
                limit: maxLimit,
                offset: skip,
                hasMore: skip + maxLimit < dbResult.total,
              },
              source: "database",
            });
            return;
          } catch (dbError) {
            console.warn("⚠️ Database query failed, falling back to memory:", dbError.message);
          }
        }

        // Fallback to in-memory results
        const analyses = [];
        if (this.server?.analysisResults) {
          for (const [id, result] of this.server.analysisResults.entries()) {
            analyses.push({
              analysisId: id,
              directory: result.directoryPath || result.path || "Unknown",
              status: "complete",
              startTime: result.startTime || result.completedAt,
              completedAt: result.completedAt,
              totalFiles: result.totalFiles || result.files?.length || 0,
              totalSize: result.totalSize || 0,
              categories: result.categories || {},
              extensions: result.extensions || {},
              scanDuration: result.scanDuration || 0,
            });
          }
        }

        // Sort by completion date (newest first)
        analyses.sort((a, b) => {
          const dateA = new Date(b.completedAt || b.startTime || 0);
          const dateB = new Date(a.completedAt || a.startTime || 0);
          return dateA.getTime() - dateB.getTime();
        });

        // Apply pagination
        const total = analyses.length;
        const paginatedAnalyses = analyses.slice(skip, skip + maxLimit);

        res.json({
          success: true,
          analyses: paginatedAnalyses,
          pagination: {
            total,
            limit: maxLimit,
            offset: skip,
            hasMore: skip + maxLimit < total,
          },
          source: "memory",
        });
      } catch (error) {
        console.error("Get analysis history error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    console.log("  ✅ Results routes added");
  }
}

module.exports = ResultsRoutes;
