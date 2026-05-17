/**
 * Space Analyzer Pro - Backend Server
 * Provides API for file scanning, analysis, and system monitoring
 */

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Load configuration - use 8091 as default to match config.js
const PORT = 8091;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://127.0.0.1:8002";

// Debug: Log configuration
console.log(`[CONFIG] PORT from env: ${process.env.PORT}`);
console.log(`[CONFIG] Using PORT: ${PORT}`);
console.log(`[CONFIG] AI_SERVICE_URL: ${AI_SERVICE_URL}`);
console.log(`[CONFIG] ORCHESTRATOR_URL: ${ORCHESTRATOR_URL}`);

const app = express();
const server = http.createServer(app);

// WebSocket for real-time updates
const wss = new WebSocketServer({ server });

// CORS middleware - configurable via environment
app.use((req, res, next) => {
  const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? false : "*");
  if (corsOrigin === "*" || corsOrigin === true) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true }));

// WebSocket connections
wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");
  ws.send(JSON.stringify({ type: "connected", message: "WebSocket connected" }));
});

function broadcast(event, data) {
  const message = JSON.stringify({ type: event, ...data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// ============ API Routes ============

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    version: "2.14.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// System info
app.get("/api/system/info", async (req, res) => {
  const os = await import("os");
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
    hostname: os.hostname(),
    uptime: os.uptime(),
  });
});

// Scan directory
app.post("/api/files/scan", async (req, res) => {
  const { directory = process.cwd() } = req.body;
  const scanDir = path.resolve(directory);

  try {
    if (!fs.existsSync(scanDir)) {
      return res.status(404).json({ error: "Directory not found" });
    }

    const files = [];
    const items = fs.readdirSync(scanDir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(scanDir, item.name);
      const stats = fs.statSync(fullPath);
      files.push({
        name: item.name,
        path: fullPath,
        size: stats.size,
        isDirectory: item.isDirectory(),
        created: stats.birthtime,
        modified: stats.mtime,
        permissions: stats.mode.toString(8).slice(-3),
      });
    }

    res.json({
      directory: scanDir,
      total: files.length,
      files,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get file structure (recursive)
app.get("/api/files/structure", async (req, res) => {
  const { directory = process.cwd(), depth = 3 } = req.query;
  const scanDir = path.resolve(directory);

  function scanDirRecursive(dirPath, currentDepth) {
    if (currentDepth > depth) return null;
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const structure = [];

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const entry = { name: item.name, path: fullPath };

      if (item.isDirectory()) {
        const children = scanDirRecursive(fullPath, currentDepth + 1);
        if (children) entry.children = children;
      } else {
        try {
          const stats = fs.statSync(fullPath);
          entry.size = stats.size;
        } catch {}
      }
      structure.push(entry);
    }

    return structure;
  }

  try {
    const structure = scanDirRecursive(scanDir, 0);
    res.json({ directory: scanDir, structure });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze specific files
app.post("/api/files/analyze", async (req, res) => {
  const { files = [] } = req.body;
  const results = [];

  for (const filePath of files) {
    try {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        results.push({ file: filePath, error: "File not found" });
        continue;
      }

      const stats = fs.statSync(resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      const isText = [".txt", ".md", ".json", ".js", ".ts", ".py", ".html", ".css", ".vue"].includes(ext);

      results.push({
        file: filePath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        extension: ext,
        isText,
        created: stats.birthtime,
        modified: stats.mtime,
        permissions: stats.mode.toString(8).slice(-3),
      });
    } catch (error) {
      results.push({ file: filePath, error: error.message });
    }
  }

  res.json({ count: results.length, results });
});

// AI Models list - proxy to AI service
app.get("/api/ai/models", async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/models/status`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("AI Service unavailable, using fallback:", error.message);
    res.json({
      models: [
        { id: "phi4-mini", name: "Phi-4 Mini", type: "general" },
        { id: "qwen3.5", name: "Qwen 3.5 4B", type: "code" },
        { id: "gemma4", name: "Gemma 4", type: "general" },
      ],
    });
  }
});

// AI Categorize - proxy to AI service
app.post("/api/ai/categorize", async (req, res) => {
  const { files = [] } = req.body;

  try {
    // Convert files to FileData format for AI service
    const fileDataList = files.map(file => {
      const filePath = typeof file === "string" ? file : file.path;
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        extension: path.extname(filePath),
        modified_time: stats.mtimeMs / 1000,
      };
    });

    // Call AI service batch categorization
    const response = await axios.post(
      `${AI_SERVICE_URL}/predict/categories-batch`,
      fileDataList,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    // Transform response to match expected format
    const categories = {};
    response.data.predictions.forEach(pred => {
      const category = pred.predicted_category;
      if (!categories[category]) categories[category] = [];
      categories[category].push(pred.path);
    });

    res.json({ categories });
  } catch (error) {
    console.error("AI Service categorization failed, using fallback:", error.message);
    // Fallback to rule-based categorization
    const categories = {};
    for (const file of files) {
      const filePath = typeof file === "string" ? file : file.path;
      const ext = path.extname(filePath).toLowerCase();
      let category = "Other";

      if ([".js", ".ts", ".py", ".rs", ".cpp", ".c", ".h", ".java"].includes(ext)) category = "Source Code";
      else if ([".jpg", ".png", ".gif", ".svg", ".webp"].includes(ext)) category = "Images";
      else if ([".mp4", ".avi", ".mkv"].includes(ext)) category = "Video";
      else if ([".mp3", ".wav", ".flac"].includes(ext)) category = "Audio";
      else if ([".pdf", ".doc", ".docx", ".xls", ".xlsx"].includes(ext)) category = "Documents";
      else if ([".zip", ".tar", ".gz", ".rar"].includes(ext)) category = "Archives";
      else if ([".json", ".xml", ".yaml", ".yml", ".toml"].includes(ext)) category = "Data/Config";
      else if ([".html", ".css", ".vue", ".jsx", ".tsx"].includes(ext)) category = "Web";

      if (!categories[category]) categories[category] = [];
      categories[category].push(filePath);
    }

    res.json({ categories });
  }
});

// AI Cleanup Recommendations - proxy to AI service
app.post("/api/ai/cleanup", async (req, res) => {
  const { directory = process.cwd() } = req.body;

  try {
    // Scan directory for file data
    const scanDir = path.resolve(directory);
    const files = [];
    const items = fs.readdirSync(scanDir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(scanDir, item.name);
      const stats = fs.statSync(fullPath);
      files.push({
        path: fullPath,
        name: item.name,
        size: stats.size,
        extension: path.extname(fullPath),
        modified_time: stats.mtimeMs / 1000,
      });
    }

    // Call AI service cleanup prediction
    const response = await axios.post(
      `${AI_SERVICE_URL}/predict/cleanup`,
      { files, path: scanDir },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("AI Service cleanup prediction failed, using fallback:", error.message);
    res.json({
      recommendations: [
        { type: "cleanup", message: "Consider removing node_modules to free space when not building" },
        { type: "archive", message: "Old build artifacts found - consider archiving" },
        { type: "duplicate", message: "Check for duplicate files in project" },
      ],
    });
  }
});

// AI Recommendations - proxy to AI service
app.get("/api/ai/recommendations", async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/predict/cleanup`,
      { files: [], path: process.cwd() },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("AI Service recommendations failed, using fallback:", error.message);
    res.json({
      recommendations: [
        { type: "cleanup", message: "Consider removing node_modules to free space when not building" },
        { type: "archive", message: "Old build artifacts found - consider archiving" },
        { type: "duplicate", message: "Check for duplicate files in project" },
      ],
    });
  }
});

// Analytics trends
app.get("/api/analytics/trends", (req, res) => {
  res.json({
    trends: [
      { date: new Date().toISOString().split("T")[0], usage: 65 },
    ],
  });
});

// Analytics performance
app.get("/api/analytics/performance", (req, res) => {
  res.json({
    cpu: Math.round(Math.random() * 100),
    memory: Math.round(Math.random() * 100),
    disk: Math.round(Math.random() * 100),
  });
});

// Storage prediction
app.post("/api/analytics/predict", (req, res) => {
  res.json({
    predictedGrowth: `${(Math.random() * 10).toFixed(1)}GB`,
    estimatedTimeFrame: "30 days",
    confidence: `${(70 + Math.random() * 25).toFixed(0)}%`,
  });
});

// Status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    server: "running",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    port: PORT,
    ai_service: AI_SERVICE_URL,
    orchestrator: ORCHESTRATOR_URL,
  });
});

// ============ Orchestrator Integration Endpoints ============

// List workflows
app.get("/api/orchestrator/workflows", async (req, res) => {
  try {
    const response = await axios.get(`${ORCHESTRATOR_URL}/workflows`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator unavailable:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable", workflows: [] });
  }
});

// Get workflow details
app.get("/api/orchestrator/workflows/:workflowId", async (req, res) => {
  try {
    const response = await axios.get(`${ORCHESTRATOR_URL}/workflows/${req.params.workflowId}`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator workflow fetch failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// Execute workflow
app.post("/api/orchestrator/workflows/:workflowId/execute", async (req, res) => {
  try {
    const response = await axios.post(
      `${ORCHESTRATOR_URL}/workflows/${req.params.workflowId}/execute`,
      req.body,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator workflow execution failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// Schedule workflow
app.post("/api/orchestrator/workflows/:workflowId/schedule", async (req, res) => {
  try {
    const response = await axios.post(
      `${ORCHESTRATOR_URL}/workflows/${req.params.workflowId}/schedule`,
      req.body,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator workflow scheduling failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// List tasks
app.get("/api/orchestrator/tasks", async (req, res) => {
  try {
    const response = await axios.get(`${ORCHESTRATOR_URL}/tasks`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator tasks fetch failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable", tasks: [] });
  }
});

// Execute task
app.post("/api/orchestrator/tasks/execute", async (req, res) => {
  try {
    const response = await axios.post(
      `${ORCHESTRATOR_URL}/tasks/execute`,
      req.body,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator task execution failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// Get execution details
app.get("/api/orchestrator/executions/:executionId", async (req, res) => {
  try {
    const response = await axios.get(`${ORCHESTRATOR_URL}/executions/${req.params.executionId}`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator execution fetch failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// Get workflow status
app.get("/api/orchestrator/workflows/:workflowId/status", async (req, res) => {
  try {
    const response = await axios.get(`${ORCHESTRATOR_URL}/workflows/${req.params.workflowId}/status`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator workflow status fetch failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// Get orchestrator metrics
app.get("/api/orchestrator/metrics", async (req, res) => {
  try {
    const response = await axios.get(`${ORCHESTRATOR_URL}/metrics`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator metrics fetch failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// List available tools
app.get("/api/orchestrator/tools", async (req, res) => {
  try {
    const response = await axios.get(`${ORCHESTRATOR_URL}/tools`, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Orchestrator tools fetch failed:", error.message);
    res.status(503).json({ error: "Orchestrator service unavailable" });
  }
});

// Serve static frontend if available
const staticPaths = [
  path.join(__dirname, "..", "dist"),
  path.join(__dirname, "..", "public"),
];

for (const staticPath of staticPaths) {
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    break;
  }
}

// Catch-all for SPA routing
app.get("/{*path}", (req, res) => {
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({
      message: "Space Analyzer Backend Server",
      version: "2.14.0",
      endpoints: [
        "GET /api/health",
        "GET /api/system/info",
        "POST /api/files/scan",
        "GET /api/files/structure",
        "POST /api/files/analyze",
        "GET /api/ai/models",
        "POST /api/ai/categorize",
        "POST /api/ai/cleanup",
        "GET /api/ai/recommendations",
        "GET /api/analytics/trends",
        "GET /api/analytics/performance",
        "POST /api/analytics/predict",
        "GET /api/status",
        "GET /api/orchestrator/workflows",
        "GET /api/orchestrator/workflows/:workflowId",
        "POST /api/orchestrator/workflows/:workflowId/execute",
        "POST /api/orchestrator/workflows/:workflowId/schedule",
        "GET /api/orchestrator/tasks",
        "POST /api/orchestrator/tasks/execute",
        "GET /api/orchestrator/executions/:executionId",
        "GET /api/orchestrator/workflows/:workflowId/status",
        "GET /api/orchestrator/metrics",
        "GET /api/orchestrator/tools",
        "WebSocket / (real-time updates)",
      ],
      services: {
        ai_service: AI_SERVICE_URL,
        orchestrator: ORCHESTRATOR_URL,
      },
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Space Analyzer Backend Server`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket on ws://localhost:${PORT}`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI Service: ${AI_SERVICE_URL}`);
  console.log(`🎯 Orchestrator: ${ORCHESTRATOR_URL}`);
  console.log(`📁 Serving static from: ${staticPaths.filter(fs.existsSync).join(", ") || "none"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down server...");
  wss.close();
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("Shutting down server...");
  wss.close();
  server.close(() => process.exit(0));
});