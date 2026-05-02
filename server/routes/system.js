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
      res.json({
        status: "ok",
        timestamp: new Date(),
        backend: true,
        ollama: this.server.ollamaAvailable,
        uptime: process.uptime(),
        system: {
          cpu: os.cpus().length,
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: process.memoryUsage(),
          },
          platform: os.platform(),
        },
        workers: {
          configured: dynamicConfig.workerCount,
          active: this.server.workerPool !== null,
        },
      });
    });

    // System metrics
    this.router.get("/system/metrics", async (req, res) => {
      const cpus = os.cpus();
      const cpuUsage = cpus.reduce((acc, cpu) => {
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
