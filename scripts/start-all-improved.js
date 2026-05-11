#!/usr/bin/env node

import { spawn, exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import net from "net";
import { promisify } from "util";
import fs from "fs/promises";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImprovedServiceManager {
  constructor() {
    this.services = new Map();
    this.isShuttingDown = false;
    this.backendPort = 8080;
    this.frontendPort = 5173;
    this.startupTimeout = null;
    this.healthCheckInterval = null;
    this.backendReady = false;
    this.frontendReady = false;
  }

  log(message, service = "SYSTEM", level = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      INFO: "\x1b[36m",
      WARN: "\x1b[33m",
      ERROR: "\x1b[31m",
      SUCCESS: "\x1b[32m",
      RESET: "\x1b[0m",
    };

    console.log(`${colors[level]}[${timestamp}] [${service}] ${message}${colors.RESET}`);
  }

  async killAllNodeProcesses() {
    this.log("🧹 Cleaning up all existing Node.js processes...", "SYSTEM", "INFO");

    try {
      if (process.platform === "win32") {
        // Windows: Get all node processes and kill them
        const { stdout } = await execAsync(
          `powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.Id -ne ${process.pid}} | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; Write-Output 'Killed Node process:' $_.Id }"`,
          { shell: true, timeout: 15000 }
        );
        
        if (stdout) {
          this.log(`Node processes killed: ${stdout.trim()}`, "SYSTEM", "SUCCESS");
        }
      } else {
        // Unix: Kill all node processes except current
        const { stdout } = await execAsync(
          `pgrep -f node | grep -v ${process.pid} || echo ""`,
          { shell: true, timeout: 5000 }
        );
        
        if (stdout) {
          const pids = stdout.trim().split("\n").filter(pid => pid.trim());
          for (const pid of pids) {
            await execAsync(`kill -9 ${pid}`, { shell: true });
          }
          this.log(`Killed ${pids.length} Node processes`, "SYSTEM", "SUCCESS");
        }
      }
      
      // Wait for processes to fully terminate
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      this.log(`Node process cleanup failed: ${error.message}`, "SYSTEM", "WARN");
    }
  }

  async killProcessesOnPort(port) {
    this.log(`Cleaning port ${port}...`, "SYSTEM", "INFO");

    try {
      // Windows-specific approach
      if (process.platform === "win32") {
        const { stdout } = await execAsync(
          `powershell -Command "Get-Process | Where-Object {$_.MainModule.FileName -eq 'node.exe'} | ForEach-Object { $p = Get-NetTCPConnection -OwningProcess $_.Id | Where-Object {$_.LocalAddress -eq '127.0.0.1' -and $_.LocalPort -eq ${port}}; if ($p) { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } }"`,
          { shell: true, timeout: 10000 }
        );
      } else {
        // Unix approach
        const { stdout } = await execAsync(
          `lsof -ti:${port} 2>/dev/null || echo ""`,
          { shell: true, timeout: 5000 }
        );
        
        if (stdout) {
          const pids = stdout.trim().split("\n").filter(pid => pid.trim());
          for (const pid of pids) {
            if (pid && pid !== process.pid.toString()) {
              await execAsync(`kill -9 ${pid}`, { shell: true });
            }
          }
        }
      }
    } catch (error) {
      this.log(`Port cleanup failed: ${error.message}`, "SYSTEM", "WARN");
    }
  }

  async checkPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      server.on("error", () => resolve(false));
      setTimeout(() => {
        server.close();
        resolve(false);
      }, 1000);
    });
  }

  async findAvailablePort(startPort, maxAttempts = 50) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      if (await this.checkPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found from ${startPort}`);
  }

  async checkServiceHealth(port, path = "/", timeout = 3000) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: "localhost",
        port: port,
        path: path,
        method: "GET",
        timeout: timeout,
      }, (res) => {
        resolve({
          success: res.statusCode === 200,
          status: res.statusCode,
        });
      });

      req.on("error", () => resolve({ success: false, status: 0 }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ success: false, status: 0 });
      });

      req.end();
    });
  }

  async startBackend() {
    this.log("Starting backend service...", "BACKEND", "INFO");

    return new Promise((resolve, reject) => {
      const backend = spawn("npm", ["run", "server:dev"], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        env: { ...process.env, NODE_ENV: "development" },
      });

      let outputBuffer = [];
      let portDetected = false;

      backend.stdout.on("data", (data) => {
        const output = data.toString();
        outputBuffer.push(output);

        // Extract port from backend output
        const portMatch = output.match(/Server running on port (\d+)/);
        if (portMatch && !portDetected) {
          this.backendPort = parseInt(portMatch[1], 10);
          portDetected = true;
          this.log(`Backend detected on port ${this.backendPort}`, "BACKEND", "SUCCESS");
        }

        // Check for readiness indicators
        if (
          output.includes("✅ Server initialized successfully") ||
          output.includes("🌐 Server running on port") ||
          output.includes("📊 Health check:")
        ) {
          this.backendReady = true;
        }
      });

      backend.stderr.on("data", (data) => {
        const error = data.toString();
        if (
          !error.includes("EADDRINUSE") &&
          !error.includes("already in use")
        ) {
          this.log(error, "BACKEND", "ERROR");
        }
      });

      backend.on("error", (error) => {
        this.log(`Backend failed to start: ${error.message}`, "BACKEND", "ERROR");
        reject(error);
      });

      backend.on("close", (code) => {
        if (code !== 0 && !this.isShuttingDown) {
          this.log(`Backend exited with code ${code}`, "BACKEND", "ERROR");
          reject(new Error(`Backend failed with exit code ${code}`));
        } else {
          resolve(backend);
        }
      });

      this.services.set("backend", backend);
    });
  }

  async startFrontend() {
    this.log("Starting frontend service...", "FRONTEND", "INFO");

    return new Promise((resolve, reject) => {
      const frontend = spawn("npm", ["run", "dev:no-browser"], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        env: { ...process.env, NODE_ENV: "development" },
      });

      let outputBuffer = [];
      let portDetected = false;

      frontend.stdout.on("data", (data) => {
        const output = data.toString();
        outputBuffer.push(output);

        // Extract port from Vite output
        const portMatch = output.match(/Local:\s*http:\/\/localhost:(\d+)/);
        if (portMatch && !portDetected) {
          this.frontendPort = parseInt(portMatch[1], 10);
          portDetected = true;
          this.log(`Frontend detected on port ${this.frontendPort}`, "FRONTEND", "SUCCESS");
        }

        // Check for readiness indicators
        if (
          output.includes("ready in") ||
          output.includes("Local:") ||
          (output.includes("VITE") && output.includes("ready")) ||
          output.includes("Local:")
        ) {
          this.frontendReady = true;
        }
      });

      frontend.stderr.on("data", (data) => {
        const error = data.toString();
        if (
          !error.includes("EADDRINUSE") &&
          !error.includes("already in use")
        ) {
          this.log(error, "FRONTEND", "ERROR");
        }
      });

      frontend.on("error", (error) => {
        this.log(`Frontend failed to start: ${error.message}`, "FRONTEND", "ERROR");
        reject(error);
      });

      frontend.on("close", (code) => {
        if (code !== 0 && !this.isShuttingDown) {
          this.log(`Frontend exited with code ${code}`, "FRONTEND", "ERROR");
          reject(new Error(`Frontend failed with exit code ${code}`));
        } else {
          resolve(frontend);
        }
      });

      this.services.set("frontend", frontend);
    });
  }

  async waitForServiceReady(serviceName, port, maxWait = 30000) {
    this.log(`Waiting for ${serviceName} readiness...`, serviceName, "INFO");
    
    const startTime = Date.now();
    const checkInterval = 2000;
    
    while (Date.now() - startTime < maxWait) {
      try {
        const health = await this.checkServiceHealth(port, "/", 3000);
        if (health.success) {
          this.log(`${serviceName} is ready!`, serviceName, "SUCCESS");
          return true;
        }
      } catch (error) {
        // Continue checking
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    this.log(`${serviceName} failed to start within ${maxWait/1000}s`, serviceName, "WARN");
    return false;
  }

  async start() {
    console.log("🚀 Starting Space Analyzer Pro - Improved Service Manager");
    console.log("📊 Initializing services...\n");

    try {
      // Clean up all existing Node.js processes first
      await this.killAllNodeProcesses();
      
      // Additional port cleanup for safety
      await this.killProcessesOnPort(8080);
      await this.killProcessesOnPort(5173);
      
      // Find available ports
      this.backendPort = await this.findAvailablePort(8080);
      this.frontendPort = await this.findAvailablePort(5173);
      
      this.log(`Using backend port: ${this.backendPort}`, "SYSTEM", "INFO");
      this.log(`Using frontend port: ${this.frontendPort}`, "SYSTEM", "INFO");

      // Start backend first
      const backendPromise = this.startBackend();
      
      // Wait a bit for backend to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start frontend
      const frontendPromise = this.startFrontend();

      // Wait for both services to initialize (not to be ready)
      await Promise.allSettled([backendPromise, frontendPromise]);

      // Give services time to fully start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Wait for services to be fully ready
      const backendReady = await this.waitForServiceReady("backend", this.backendPort, 45000);
      const frontendReady = await this.waitForServiceReady("frontend", this.frontendPort, 30000);

      if (backendReady && frontendReady) {
        console.log("\n✅ All services started successfully!");
        console.log(`🌐 Frontend: http://localhost:${this.frontendPort}`);
        console.log(`🔧 Backend API: http://localhost:${this.backendPort}`);
        console.log(`📊 Health Check: http://localhost:${this.backendPort}/api/health`);
        console.log("\n💡 Press Ctrl+C to stop all services\n");
        
        // Start health monitoring
        this.startHealthMonitoring();
      } else {
        throw new Error("Services failed to start properly");
      }

    } catch (error) {
      console.error("\n❌ Failed to start services:", error.message);
      await this.shutdown();
      process.exit(1);
    }
  }

  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const backendHealth = await this.checkServiceHealth(this.backendPort, "/api/health", 2000);
        const frontendHealth = await this.checkServiceHealth(this.frontendPort, "/", 2000);
        
        if (!backendHealth.success && this.backendReady) {
          this.log("Backend health check failed", "HEALTH", "WARN");
        }
        
        if (!frontendHealth.success && this.frontendReady) {
          this.log("Frontend health check failed", "HEALTH", "WARN");
        }
      } catch (error) {
        // Ignore health check errors
      }
    }, 15000); // Check every 15 seconds
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log("\n🛑 Shutting down services...");

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const shutdownPromises = [];
    
    for (const [name, service] of this.services) {
      this.log(`Stopping ${name}...`, name, "INFO");
      service.kill("SIGTERM");
      
      shutdownPromises.push(
        new Promise((resolve) => {
          service.on("close", resolve);
          setTimeout(() => {
            service.kill("SIGKILL");
            resolve();
          }, 3000);
        })
      );
    }

    await Promise.all(shutdownPromises);
    console.log("✅ All services stopped");
  }
}

// Handle shutdown signals
const manager = new ImprovedServiceManager();

process.on("SIGINT", async () => {
  console.log("\n📡 Received SIGINT");
  await manager.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n📡 Received SIGTERM");
  await manager.shutdown();
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  console.error("\n💥 Uncaught Exception:", error.message);
  await manager.shutdown();
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("\n💥 Unhandled Rejection:", reason);
  await manager.shutdown();
  process.exit(1);
});

// Start all services
manager.start().catch((error) => {
  console.error("❌ Startup failed:", error.message);
  process.exit(1);
});
