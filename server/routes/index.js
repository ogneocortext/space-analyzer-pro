/**
 * Routes Index
 * Aggregates all route modules for the Space Analyzer API
 */

const AnalysisRoutes = require("./analysis");
const AIRoutes = require("./ai");
const FileRoutes = require("./files");
const ExportRoutes = require("./exports");
const ComplexityRoutes = require("./complexity");
const ReportsRoutes = require("./reports");
const SettingsRoutes = require("./settings");
const OrchestrateRoutes = require("./orchestrate");
const SystemRoutes = require("./system");

class RoutesManager {
  constructor(server) {
    this.server = server;
    this.routes = {};
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Initialize all route modules
    this.routes.analysis = new AnalysisRoutes(this.server);
    this.routes.ai = new AIRoutes(this.server);
    this.routes.files = new FileRoutes(this.server);
    this.routes.exports = new ExportRoutes(this.server);
    this.routes.complexity = new ComplexityRoutes(this.server);
    this.routes.reports = new ReportsRoutes(this.server);
    this.routes.settings = new SettingsRoutes(this.server);
    this.routes.orchestrate = new OrchestrateRoutes(this.server);
    this.routes.system = new SystemRoutes(this.server);
  }

  mountAll(app) {
    // Mount all routes to the Express app
    app.use("/api", this.routes.analysis.getRouter());
    app.use("/api", this.routes.ai.getRouter());
    app.use("/api", this.routes.files.getRouter());
    app.use("/api", this.routes.exports.getRouter());
    app.use("/api", this.routes.complexity.getRouter());
    app.use("/api", this.routes.reports.getRouter());
    app.use("/api", this.routes.settings.getRouter());
    app.use("/api", this.routes.orchestrate.getRouter());
    app.use("/api", this.routes.system.getRouter());

    console.log("✅ All API routes mounted successfully");
  }

  // Access to individual route modules if needed
  getAnalysisRoutes() {
    return this.routes.analysis;
  }

  getAIRoutes() {
    return this.routes.ai;
  }

  getFileRoutes() {
    return this.routes.files;
  }

  getExportRoutes() {
    return this.routes.exports;
  }

  getComplexityRoutes() {
    return this.routes.complexity;
  }

  getReportsRoutes() {
    return this.routes.reports;
  }

  getSettingsRoutes() {
    return this.routes.settings;
  }
}

module.exports = RoutesManager;
