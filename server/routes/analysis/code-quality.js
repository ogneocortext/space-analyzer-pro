/**
 * Code Quality Analysis Routes
 * ESLint integration and static analysis endpoints
 */

const AnalysisController = require("../../controllers/AnalysisController");

class CodeQualityRoutes {
  constructor(server, router) {
    this.server = server;
    this.router = router;
    this.analysisController = new AnalysisController(server);
    this.setupRoutes();
  }

  setupRoutes() {
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
}

module.exports = CodeQualityRoutes;
