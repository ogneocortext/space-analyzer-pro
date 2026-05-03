/**
 * Routes Index
 * Aggregates all route modules for the Space Analyzer API
 */

const AnalysisRoutes = require("./analysis");
const AIRoutes = require("./ai");
const AIServiceRoutes = require("./ai-service");
const FileRoutes = require("./files");
const ExportRoutes = require("./exports");
const ComplexityRoutes = require("./complexity");
const ReportsRoutes = require("./reports");
const SettingsRoutes = require("./settings");
const OrchestrateRoutes = require("./orchestrate");
const SystemRoutes = require("./system");
const ErrorRoutes = require("./errors");
const LearningRoutes = require("./learning");
const NLPRoutes = require("./nlp");
const AIModelsRoutes = require("./ai-models");
console.log("📦 ErrorRoutes module loaded:", typeof ErrorRoutes);

class RoutesManager {
  constructor(server) {
    this.server = server;
    this.routes = {};
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Initialize all route modules
    console.log("🔄 Initializing route modules...");
    this.routes.analysis = new AnalysisRoutes(this.server);
    console.log("  ✅ AnalysisRoutes loaded");
    this.routes.ai = new AIRoutes(this.server);
    console.log("  ✅ AIRoutes loaded");
    this.routes.aiService = new AIServiceRoutes(this.server);
    console.log("  ✅ AIServiceRoutes loaded");
    this.routes.files = new FileRoutes(this.server);
    console.log("  ✅ FileRoutes loaded");
    this.routes.exports = new ExportRoutes(this.server);
    this.routes.complexity = new ComplexityRoutes(this.server);
    this.routes.reports = new ReportsRoutes(this.server);
    this.routes.settings = new SettingsRoutes(this.server);
    this.routes.orchestrate = new OrchestrateRoutes(this.server);
    this.routes.system = new SystemRoutes(this.server);
    console.log("  ✅ SystemRoutes loaded");
    this.routes.errors = new ErrorRoutes(this.server);
    console.log("  ✅ ErrorRoutes loaded");
    this.routes.learning = new LearningRoutes(this.server);
    console.log("  ✅ LearningRoutes loaded");
    this.routes.nlp = new NLPRoutes(this.server);
    console.log("  ✅ NLPRoutes loaded");
    this.routes.aiModels = new AIModelsRoutes(this.server);
    console.log("  ✅ AIModelsRoutes loaded");
  }

  mountAll(app) {
    // Mount all routes to the Express app
    app.use("/api", this.routes.analysis.getRouter());
    app.use("/api", this.routes.ai.getRouter());
    app.use("/api", this.routes.aiService.getRouter());
    app.use("/api", this.routes.files.getRouter());
    app.use("/api", this.routes.exports.getRouter());
    app.use("/api", this.routes.complexity.getRouter());
    app.use("/api", this.routes.reports.getRouter());
    app.use("/api", this.routes.settings.getRouter());
    app.use("/api", this.routes.orchestrate.getRouter());
    app.use("/api", this.routes.system.getRouter());
    app.use("/api", this.routes.errors.getRouter());
    app.use("/api", this.routes.learning.getRouter());
    app.use("/api", this.routes.nlp.getRouter());
    app.use("/api", this.routes.aiModels.getRouter());

    console.log("✅ All API routes mounted successfully");
    console.log("📍 AI Service routes available at: /api/ai/*");
    console.log("📍 Error routes available at: /api/errors/*");
    console.log("📍 Learning routes available at: /api/learning/*");
    console.log("📍 NLP routes available at: /api/nlp/*");
    console.log("📍 AI Models routes available at: /api/ai-models/*");
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
