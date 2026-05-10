import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FixedServiceManager {
  constructor() {
    this.services = new Map();
    this.isShuttingDown = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.healthCheckInterval = null;
    this.backendReady = false;
    this.frontendReady = false;
  }

  log(message, service = "SYSTEM") {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${service}] ${message}`);
  }

  async checkHealth(port, path = "/api/health") {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: port,
          path: path,
          method: "GET",
          timeout: 3000,
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

  async isPortOpen(port) {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: port,
          path: "/",
          method: "HEAD", // Use HEAD to avoid downloading content
          timeout: 2000,
        },
        (res) => {
          resolve(true);
        }
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  async waitForBackend(maxWaitTime = 30000) {
    const startTime = Date.now();
    this.log("Waiting for backend to be ready on port 8080...");

    let lastHealthCheck = 0;
    const healthCheckInterval = 3000; // Check health every 3 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const portOpen = await this.isPortOpen(8080);

        if (portOpen) {
          // Port is open, now check if it's responding to health checks
          const now = Date.now();
          if (now - lastHealthCheck >= healthCheckInterval) {
            lastHealthCheck = now;

            const health = await this.checkHealth(8080);

            if (health.success) {
              // Check if backend reports as ready or at least starting
              if (health.data && health.data.includes('"status":"healthy"')) {
                this.log("✅ Backend is fully ready!", "backend");
                this.backendReady = true;
                return true;
              } else if (health.data && health.data.includes('"status":"starting"')) {
                this.log("⏳ Backend is starting up...", "backend");
                // Consider starting as ready enough to proceed
                this.backendReady = true;
                return true;
              } else {
                this.log(`⏳ Backend responding, status: checking`, "backend");
                // Any 200 response means the server is running
                this.backendReady = true;
                return true;
              }
            } else {
              this.log(`⏳ Backend port open, health check status: ${health.status}`, "backend");
            }
          } else {
            // Port is open but not time for health check yet
            this.log("⏳ Backend port open, waiting for health check...", "backend");
          }
        } else {
          this.log("⏳ Waiting for backend port to open...", "backend");
        }
      } catch (error) {
        this.log(`⚠️ Backend check error: ${error.message}`, "backend");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // If we reach here, backend didn't become ready in time
    // But let's check one more time if the port is at least open
    const portOpen = await this.isPortOpen(8080);
    if (portOpen) {
      this.log("⚠️ Backend port is open - proceeding with startup", "backend");
      this.backendReady = true;
      return true;
    }

    this.log("❌ Backend failed to start within timeout", "backend");
    return false;
  }

  async waitForFrontend(maxWaitTime = 20000) {
    const startTime = Date.now();
    const ports = [5173, 5174, 5178]; // Include the current port

    for (const port of ports) {
      this.log(`Checking frontend on port ${port}...`);

      while (Date.now() - startTime < maxWaitTime) {
        try {
          const portOpen = await this.isPortOpen(port);

          if (portOpen) {
            this.log(`✅ Frontend is ready on port ${port}!`, "frontend");
            this.frontendReady = true;
            return true;
          }
        } catch (error) {
          // Continue trying
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    this.log("⚠️ Frontend may not be ready, but continuing...", "frontend");
    return false;
  }

  startService(name, command, args, options = {}) {
    return new Promise((resolve, reject) => {
      this.log(`Starting ${name}...`, name);

      const service = spawn(command, args, {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        ...options,
      });

      // Buffer output to reduce noise
      let outputBuffer = [];
      let lastFlush = Date.now();

      const flushOutput = () => {
        if (outputBuffer.length > 0) {
          console.log(`[${name}] ${outputBuffer.join("\n")}`);
          outputBuffer = [];
        }
      };

      service.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          // Filter out repetitive logs
          if (
            !output.includes("Database optimization") &&
            !output.includes("Knowledge database initialized")
          ) {
            outputBuffer.push(output);
          }

          // Flush output every 2 seconds or if buffer gets too large
          if (Date.now() - lastFlush > 2000 || outputBuffer.length > 5) {
            flushOutput();
            lastFlush = Date.now();
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
        this.log(`❌ Failed to start: ${error.message}`, name);
        reject(error);
      });

      service.on("close", (code) => {
        flushOutput(); // Flush any remaining output

        if (code !== 0 && !this.isShuttingDown) {
          this.log(`❌ Process exited with code ${code}`, name);
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.log(
              `🔄 Restarting ${name} (attempt ${this.retryCount}/${this.maxRetries})...`,
              name
            );
            setTimeout(() => this.startService(name, command, args, options), 2000);
          } else {
            this.log(`❌ Max retries reached for ${name}`, name);
            reject(new Error(`${name} failed after ${this.maxRetries} attempts`));
          }
        }
      });

      this.services.set(name, service);
      resolve(service);
    });
  }

  async startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth(8080);
        if (!health.success && this.backendReady) {
          this.log("⚠️ Backend health check failed", "HEALTH");
        }
      } catch (error) {
        // Ignore health check errors
      }
    }, 15000); // Check every 15 seconds
  }

  async start() {
    console.log("🚀 Starting Space Analyzer Pro - Fixed Service Manager\n");
    console.log("📊 Service Status:\n");

    try {
      // Start backend first
      await this.startService("backend", "npm", ["run", "server:dev"], {
        env: { ...process.env, SA_QUIET: "true" },
      });

      // Wait for backend with improved logic
      const backendReady = await this.waitForBackend();
      if (!backendReady) {
        this.log("❌ Backend failed to start properly", "backend");
        throw new Error("Backend startup failed");
      }

      // Start frontend after backend is ready
      await this.startService("frontend", "npm", ["run", "dev:no-browser"]);

      // Wait for frontend
      await this.waitForFrontend();

      // Start health checks
      await this.startHealthChecks();

      // Flush any remaining output
      console.log("\n✅ All services started successfully!");
      console.log(
        "🌐 Frontend: http://localhost:5178 (or http://localhost:5173 or http://localhost:5174)"
      );
      console.log("🔧 Backend API: http://localhost:8080");
      console.log("📊 Health Check: http://localhost:8080/api/health");
      console.log("\n💡 Press Ctrl+C to stop all services\n");

      // Show final status
      console.log("🎯 Service Status:");
      console.log(`   Backend: ${this.backendReady ? "✅ Ready" : "❌ Failed"}`);
      console.log(`   Frontend: ${this.frontendReady ? "✅ Ready" : "⚠️ May be starting"}`);
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
      this.log(`Stopping ${name}...`, name);
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
const manager = new FixedServiceManager();

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

// Start all services
manager.start().catch((error) => {
  console.error("❌ Startup failed:", error.message);
  process.exit(1);
});
