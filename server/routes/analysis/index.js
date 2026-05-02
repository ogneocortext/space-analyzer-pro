/**
 * Analysis Routes Module - Refactored
 * Main router that combines all analysis sub-routes
 */

const express = require("express");
const CoreRoutes = require("./core");
const ResultsRoutes = require("./results");
const CodeQualityRoutes = require("./code-quality");

class AnalysisRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    console.log("🚀 AnalysisRoutes initialized [v2.9.0-modular]");

    // Initialize sub-routers
    this.coreRoutes = new CoreRoutes(server, this.router);
    this.resultsRoutes = new ResultsRoutes(server, this.router);
    this.codeQualityRoutes = new CodeQualityRoutes(server, this.router);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AnalysisRoutes;
