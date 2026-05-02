const express = require("express");
const os = require("os");
const diskusage = require("diskusage");
const dynamicConfig = require("../config/dynamic-config");

class SystemRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.router.get("/health", (req, res) => {
      try {
        const memUsage = process.memoryUsage();
        const activeAnalyses = this.server.activeAnalyses ? this.server.activeAnalyses.size : 0;

        // Check database status
        const dbStatus = {
          available: !!(this.server.knowledgeDB && this.server.knowledgeDB.db),
          initialized: !!this.server.dbInitializationPromise,
        };

        // Check worker pool status
        const workerStatus = {
          configured: dynamicConfig.workerCount,
          active: this.server.workerPool !== null,
          busy: this.server.workerPool ? this.server.workerPool.busy : 0,
        };

        // Calculate system health score
        let healthScore = 100;
        if (!dbStatus.available) healthScore -= 30;
        if (!this.server.ollamaAvailable) healthScore -= 10;
        if (!workerStatus.active) healthScore -= 20;
        if (activeAnalyses > 10) healthScore -= 10;

        const health = {
          status: healthScore >= 80 ? "healthy" : healthScore >= 60 ? "degraded" : "unhealthy",
          score: healthScore,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          backend: true,
          services: {
            database: dbStatus,
            ollama: this.server.ollamaAvailable,
            workers: workerStatus,
          },
          system: {
            cpu: os.cpus().length,
            memory: {
              total: os.totalmem(),
              free: os.freemem(),
              used: memUsage,
              usagePercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2),
            },
            platform: os.platform(),
            nodeVersion: process.version,
          },
          activity: {
            activeAnalyses,
            cachedResults: this.server.analysisResults ? this.server.analysisResults.size : 0,
          },
        };

        // Set appropriate HTTP status based on health
        const statusCode = healthScore >= 80 ? 200 : healthScore >= 60 ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        console.error("❌ Health check error:", error);
        res.status(503).json({
          status: "unhealthy",
          score: 0,
          timestamp: new Date().toISOString(),
          error: error.message,
          backend: false,
        });
      }
    });

    // System metrics
    this.router.get("/system/metrics", async (req, res) => {
      const cpus = os.cpus();
      const cpuUsage =
        cpus.reduce((acc, cpu) => {
          const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
          const idle = cpu.times.idle;
          return acc + (total - idle) / total;
        }, 0) / cpus.length;

      let diskInfo = { used: 0, total: 0, percentage: 0, free: 0 };
      try {
        const disk = await diskusage.check(".");
        diskInfo = {
          free: disk.free,
          total: disk.total,
          used: disk.total - disk.free,
          percentage: ((disk.total - disk.free) / disk.total) * 100,
        };
      } catch (e) {
        console.log("Could not get disk info:", e.message);
      }

      res.json({
        cpu: { usage: Math.round(cpuUsage * 100), cores: cpus.length, model: cpus[0]?.model },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        },
        disk: diskInfo,
        process: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
        },
      });
    });

    // WebSocket status
    this.router.get("/websocket/status", (req, res) => {
      const { getClients } = require("../modules/websocket");
      const wsClients = getClients();
      res.json({
        connected: wsClients.size > 0,
        clients: wsClients.size,
      });
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = SystemRoutes;
