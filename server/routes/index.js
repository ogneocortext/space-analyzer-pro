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

class RoutesManager {
  constructor(server) {
    this.server = server;
    this.routes = {};
    this.routeCache = new Map(); // Cache for route modules
    this.initializationPromise = this.initializeRoutes();
  }

  async waitForInitialization() {
    return this.initializationPromise;
  }

  async initializeRoutes() {
    // Initialize all route modules in parallel for faster startup
    console.log("🔄 Initializing route modules in parallel...");

    const routeModules = [
      { name: "analysis", Module: AnalysisRoutes },
      { name: "ai", Module: AIRoutes },
      { name: "aiService", Module: AIServiceRoutes },
      { name: "files", Module: FileRoutes },
      { name: "exports", Module: ExportRoutes },
      { name: "complexity", Module: ComplexityRoutes },
      { name: "reports", Module: ReportsRoutes },
      { name: "settings", Module: SettingsRoutes },
      { name: "orchestrate", Module: OrchestrateRoutes },
      { name: "system", Module: SystemRoutes },
      { name: "errors", Module: ErrorRoutes },
      { name: "learning", Module: LearningRoutes },
      { name: "nlp", Module: NLPRoutes },
      { name: "aiModels", Module: AIModelsRoutes },
    ];

    // Initialize all routes in parallel with caching
    const initializationPromises = routeModules.map(async ({ name, Module }) => {
      try {
        // Force reload analysis routes to clear cache
        const cacheKey = `${name}_${Module.name}`;
        let route = null;

        if (name === "analysis") {
          // Force reload analysis routes
          this.routeCache.delete(cacheKey);
          route = new Module(this.server);
          this.routeCache.set(cacheKey, route);
          console.log(`🔄 Reloaded route module: ${name}`);
        } else {
          // Check cache first for other routes
          route = this.routeCache.get(cacheKey);

          if (!route) {
            // Create new route instance if not cached
            route = new Module(this.server);
            this.routeCache.set(cacheKey, route);
            console.log(`📦 Cached route module: ${name}`);
          } else {
            console.log(`⚡ Using cached route: ${name}`);
          }
        }

        return { name, route, success: true, fromCache: false };
      } catch (error) {
        console.error(`❌ Failed to initialize ${name}:`, error.message);
        return { name, error, success: false };
      }
    });

    // Wait for all routes to initialize
    const results = await Promise.all(initializationPromises);

    // Store successful route initializations
    const successfulRoutes = [];
    const failedRoutes = [];
    const cachedRoutes = [];

    results.forEach(({ name, route, error, success, fromCache }) => {
      if (success && route) {
        this.routes[name] = route;
        successfulRoutes.push(name);
        if (fromCache) {
          cachedRoutes.push(name);
        }
      } else if (error) {
        failedRoutes.push({ name, error });
      }
    });

    // Log summary with cache statistics
    const cacheHitRate =
      cachedRoutes.length > 0
        ? Math.round((cachedRoutes.length / successfulRoutes.length) * 100)
        : 0;
    console.log(
      ` Initialized ${successfulRoutes.length}/${routeModules.length} route modules (${cachedRoutes.length} from cache, ${cacheHitRate}% hit rate)`
    );

    if (failedRoutes.length > 0) {
      console.log(` Failed routes: ${failedRoutes.map((r) => `${r.name}: ${r.error?.message || r.error}`).join(", ")}`);
    }
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
    console.log(
      "📍 API endpoints: /api/analysis/*, /api/ai/*, /api/errors/*, /api/learning/*, /api/nlp/*, /api/ai-models/*"
    );
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
