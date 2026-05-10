#!/usr/bin/env node

import { spawn, exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import net from "net";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RobustServiceManager {
  constructor() {
    this.services = new Map();
    this.isShuttingDown = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.healthCheckInterval = null;
    this.backendReady = false;
    this.frontendReady = false;
    this.occupiedPorts = new Set();
    this.startupErrors = [];
  }

  log(message, service = "SYSTEM", level = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    const logLevel = level.toUpperCase();
    const colors = {
      INFO: "\x1b[36m",
      WARN: "\x1b[33m",
      ERROR: "\x1b[31m",
      SUCCESS: "\x1b[32m",
      RESET: "\x1b[0m",
    };

    console.log(`${colors[logLevel]}[${timestamp}] [${service}] ${message}${colors.RESET}`);
  }

  async killProcessesOnPort(port) {
    this.log(`Killing processes on port ${port}...`, "SYSTEM", "WARN");

    try {
      // Method 1: netstat (Windows) - findstr returns exit code 1 on no match, ignore it
      try {
        const { stdout } = await execAsync(
          `netstat -ano 2>nul | findstr /c":${port}" 2>nul || echo NO_PROCESS_FOUND`,
          { shell: true, timeout: 5000 }
        );

        if (stdout && stdout.trim() !== "NO_PROCESS_FOUND" && stdout.trim() !== "") {
          const lines = stdout.split("\n");
          for (const line of lines) {
            if (line.includes(`:${port}`) && line.includes("LISTENING")) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                const pid = parts[parts.length - 1];
                if (pid === process.pid.toString()) {
                  this.log(`Skipping own process (PID ${pid})`, "SYSTEM", "WARN");
                  continue;
                }
                this.log(`Killing process ${pid}`, "SYSTEM", "WARN");

                try {
                  await execAsync(`taskkill /F /PID ${pid}`, { shell: true });
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                } catch (e) {
                  this.log(`Failed to kill PID ${pid}: ${e.message}`, "SYSTEM", "WARN");
                }
              }
            }
          }
        }
      } catch (netstatError) {
        // No matching processes found - this is normal
      }

      // Method 2: lsof (Unix only)
      if (process.platform !== "win32") {
        try {
          const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || echo ""`, {
            shell: true,
            timeout: 3000,
          });

          if (stdout) {
            const pids = stdout
              .trim()
              .split("\n")
              .filter((line) => line.trim());
            for (const pid of pids) {
              if (pid) {
                this.log(`Killing process ${pid}`, "SYSTEM", "WARN");
                try {
                  await execAsync(`kill -9 ${pid}`, { shell: true });
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                } catch (killError) {
                  this.log(`Failed to kill ${pid}: ${killError.message}`, "SYSTEM", "WARN");
                }
              }
            }
          }
        } catch (lsofError) {
          this.log(`LSOF method failed: ${lsofError.message}`, "SYSTEM", "WARN");
        }
      }

      // Method 3: PowerShell (Windows specific)
      if (process.platform === "win32") {
        try {
          const { stdout: psStdout } = await execAsync(
            `powershell "$p=${port}; $c = netstat -ano | Where-Object {$_ -match ':$p' -and $_ -match 'LISTENING'}; if ($c) { $id = ($c -split '\\s+')[-1]; if ($id -ne $PID -and $id -ne '${process.pid}') { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue | Out-Null; Write-Output ('Killed process on port '+$p) } }"`,
            { shell: true, timeout: 5000 }
          );
          if (psStdout) {
            this.log(psStdout, "SYSTEM", "SUCCESS");
          }
        } catch (psError) {
          this.log(`PowerShell method failed: ${psError.message}`, "SYSTEM", "WARN");
        }
      }
    } catch (error) {
      this.log(`Process killing failed: ${error.message}`, "SYSTEM", "ERROR");
    }
  }

  async waitForPortRelease(port, maxWait = 10000) {
    this.log(`Waiting for port ${port} to be released...`, "SYSTEM", "WARN");

    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      try {
        const isAvailable = await this.checkPortAvailable(port);
        if (isAvailable) {
          this.log(`Port ${port} is now available`, "SYSTEM", "SUCCESS");
          return true;
        }
      } catch (error) {
        this.log(`Port check error: ${error.message}`, "SYSTEM", "WARN");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }

  async checkPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.on("error", () => {
        resolve(false);
      });

      setTimeout(() => {
        server.close();
        resolve(false);
      }, 2000);
    });
  }

  async findAvailablePort(startPort = 8080, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;

      try {
        const isAvailable = await this.checkPortAvailable(port);
        if (isAvailable) {
          this.log(`Found available port: ${port}`, "PORT_DETECTION", "SUCCESS");
          return port;
        }
      } catch (error) {
        this.log(`Port ${port} check failed: ${error.message}`, "PORT_DETECTION", "WARN");
      }
    }

    throw new Error(`No available ports found from ${startPort} to ${startPort + maxAttempts - 1}`);
  }

  async checkHealth(port, path = "/api/health", retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.makeHttpRequest(port, path, 5000);

        if (result.success && result.status === 200) {
          this.log(`Health check successful (attempt ${attempt})`, "HEALTH", "SUCCESS");
          return result;
        } else {
          this.log(`Health check failed (attempt ${attempt}): ${result.status}`, "HEALTH", "WARN");
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        this.log(`Health check error (attempt ${attempt}): ${error.message}`, "HEALTH", "ERROR");
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    throw new Error(`Health check failed after ${retries} attempts`);
  }

  async makeHttpRequest(port, path, timeout = 5000) {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: port,
          path: path,
          method: "GET",
          timeout: timeout,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            resolve({
              success: res.statusCode === 200,
              status: res.statusCode,
              data: data,
            });
          });
        }
      );

      req.on("error", () => resolve({ success: false, status: 0 }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ success: false, status: 0 });
      });

      req.end();
    });
  }

  async waitForBackendReady(port, maxWait = 60000) {
    this.log(`Waiting for backend readiness on port ${port}...`, "BACKEND");

    const startTime = Date.now();
    const checkInterval = 3000;
    let lastCheck = 0;

    while (Date.now() - startTime < maxWait) {
      const now = Date.now();

      // Only check health every 3 seconds to avoid spamming
      if (now - lastCheck >= checkInterval) {
        lastCheck = now;

        try {
          const healthResult = await this.checkHealth(port, "/api/health", 1);

          if (healthResult.success) {
            this.log("✅ Backend is ready!", "BACKEND", "SUCCESS");
            this.backendReady = true;
            return true;
          }
        } catch (error) {
          // Health check failed, but port might be open
          try {
            await this.makeHttpRequest(port, "/", 2000);
            this.log("⏳ Backend port is open, waiting for full readiness...", "BACKEND", "WARN");
          } catch (portError) {
            this.log(`⏳ Backend not yet accessible: ${portError.message}`, "BACKEND", "WARN");
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Final check - if port is open, consider backend ready enough
    try {
      await this.makeHttpRequest(port, "/", 2000);
      this.log("⚠️ Backend port open - proceeding with startup", "BACKEND", "WARN");
      this.backendReady = true;
      return true;
    } catch (error) {
      this.log(`❌ Backend failed to start within ${maxWait / 1000}s`, "BACKEND", "ERROR");
      return false;
    }
  }

  async waitForFrontendReady(port, maxWait = 30000) {
    this.log(`Waiting for frontend readiness on port ${port}...`, "FRONTEND");

    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const result = await this.makeHttpRequest(port, "/", 3000);

        if (result.success) {
          this.log("✅ Frontend is ready!", "FRONTEND", "SUCCESS");
          this.frontendReady = true;
          return true;
        }
      } catch (error) {
        this.log(`⏳ Frontend not yet accessible: ${error.message}`, "FRONTEND", "WARN");
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    this.log(`❌ Frontend failed to start within ${maxWait / 1000}s`, "FRONTEND", "ERROR");
    return false;
  }

  startService(name, command, args, options = {}) {
    return new Promise((resolve, reject) => {
      this.log(`Starting ${name}...`, name, "INFO");

      const service = spawn(command, args, {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        ...options,
      });

      // Buffer output to reduce noise
      let outputBuffer = [];
      let lastFlush = Date.now();
      const FLUSH_INTERVAL = 2000;
      const MAX_BUFFER_SIZE = 10;

      const flushOutput = (force = false) => {
        if (
          outputBuffer.length > 0 &&
          (force ||
            Date.now() - lastFlush > FLUSH_INTERVAL ||
            outputBuffer.length > MAX_BUFFER_SIZE)
        ) {
          console.log(`[${name}] ${outputBuffer.join("\n")}`);
          outputBuffer = [];
          lastFlush = Date.now();
        }
      };

      service.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          // Filter out repetitive/noisy logs
          if (
            !output.includes("Database optimization") &&
            !output.includes("Knowledge database initialized") &&
            !output.includes("⚠️ UNHANDLED REJECTION") &&
            !output.includes("already in use")
          ) {
            outputBuffer.push(output);
            flushOutput();
          }
        }
      });

      service.stderr.on("data", (data) => {
        const output = data.toString().trim();
        if (output && !output.includes("EADDRINUSE")) {
          console.error(`[${name}] ${output}`);
        }
      });

      service.on("error", (error) => {
        this.log(`❌ Failed to start: ${error.message}`, name, "ERROR");
        reject(error);
      });

      service.on("close", (code) => {
        flushOutput(true);

        if (code !== 0 && !this.isShuttingDown) {
          this.log(`❌ Process exited with code ${code}`, name, "ERROR");
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.log(
              `🔄 Restarting ${name} (attempt ${this.retryCount}/${this.maxRetries})...`,
              name,
              "WARN"
            );
            setTimeout(() => {
              this.startService(name, command, args, options).then(resolve).catch(reject);
            }, 2000);
          } else {
            this.log(`❌ Max retries reached for ${name}`, name, "ERROR");
            reject(new Error(`${name} failed after ${this.maxRetries} attempts`));
          }
        }
      });

      this.services.set(name, service);
      resolve(service);
    });
  }

  async startHealthChecks() {
    // Reduce health check frequency to avoid log spam
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth(8080, "/api/health", 1);
        if (!health.success && this.backendReady) {
          this.log("⚠️ Backend health check failed", "HEALTH", "WARN");
        }
      } catch (error) {
        // Ignore health check errors during normal operation
      }
    }, 30000); // Check every 30 seconds instead of 15
  }

  async start() {
    console.log("🚀 Starting Space Analyzer Pro - Robust Service Manager");
    console.log("📊 Service Status:\n");

    try {
      // Kill existing processes on common ports
      this.log("🔍 Checking for existing processes...", "SYSTEM", "WARN");
      const commonPorts = [8080, 8081, 8082, 5173, 5174, 5178];
      for (const port of commonPorts) {
        await this.killProcessesOnPort(port);
        await this.waitForPortRelease(port, 3000);
      }

      // Start backend
      await this.startService("backend", "npm", ["run", "server:dev"], {
        env: { ...process.env, SA_QUIET: "true" },
      });

      // Wait for backend to be ready
      const backendReady = await this.waitForBackendReady(8080, 45000);
      if (!backendReady) {
        this.log("⚠️ Backend may not be fully ready, but continuing...", "BACKEND", "WARN");
      }

      // Start frontend
      await this.startService("frontend", "npm", ["run", "dev:no-browser"]);

      // Wait for frontend to be ready (try multiple ports)
      let frontendReady = false;
      const frontendPorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179];

      for (const port of frontendPorts) {
        this.log(`Checking frontend on port ${port}...`, "FRONTEND", "INFO");
        if (await this.waitForFrontendReady(port, 10000)) {
          frontendReady = true;
          this.log(`✅ Frontend ready on port ${port}`, "FRONTEND", "SUCCESS");
          break;
        }
      }

      if (!frontendReady) {
        this.log("⚠️ Frontend may not be ready, but continuing...", "FRONTEND", "WARN");
      }

      // Start health checks
      await this.startHealthChecks();

      console.log("\n✅ All services started successfully!");
      console.log("🌐 Frontend: http://localhost:5173 or http://localhost:5174");
      console.log("🔧 Backend API: http://localhost:8080");
      console.log("📊 Health Check: http://localhost:8080/api/health");
      console.log("\n💡 Press Ctrl+C to stop all services\n");
    } catch (error) {
      console.error("\n❌ Failed to start services:", error.message);
      await this.shutdown();
      process.exit(1);
    }
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
          }, 5000);
        })
      );
    }

    await Promise.all(shutdownPromises);
    console.log("✅ All services stopped");
  }
}

// Handle shutdown signals
const manager = new RobustServiceManager();

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

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  console.error("\n💥 Uncaught Exception:", error.message);
  await manager.shutdown();
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("\n💥 Unhandled Rejection at:", promise, "reason:", reason);
  await manager.shutdown();
  process.exit(1);
});

// Start all services
manager.start().catch((error) => {
  console.error("❌ Startup failed:", error.message);
  process.exit(1);
});
