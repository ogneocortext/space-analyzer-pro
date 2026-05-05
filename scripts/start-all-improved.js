import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ServiceManager {
  constructor() {
    this.services = new Map();
    this.isShuttingDown = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.healthCheckInterval = null;
  }

  log(message, service = "SYSTEM") {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${service}] ${message}`);
  }

  async checkPort(port) {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: port,
          path: "/api/health",
          method: "GET",
          timeout: 2000,
        },
        (res) => {
          resolve(res.statusCode === 200);
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

  async waitForService(name, port, maxWaitTime = 60000) {
    const startTime = Date.now();
    this.log(`Waiting for ${name} to be ready on port ${port}...`);

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // For backend, check if port is listening first
        const isListening = await this.isPortListening(port);
        if (isListening) {
          // Then try the health check
          if (name === "backend") {
            // Backend might take longer to fully initialize
            const healthCheck = await this.checkPort(port);
            if (healthCheck) {
              this.log(`✅ ${name} is ready!`, name);
              return true;
            } else {
              // Port is open but health check failed - might still be starting
              this.log(`⏳ ${name} port open, waiting for full initialization...`, name);
            }
          } else {
            // For frontend, just check if port is listening
            this.log(`✅ ${name} is ready!`, name);
            return true;
          }
        }
      } catch (error) {
        // Continue trying
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
    }

    this.log(`❌ ${name} failed to start within ${maxWaitTime / 1000}s`, name);
    return false;
  }

  async isPortListening(port) {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: port,
          path: "/",
          method: "GET",
          timeout: 2000,
        },
        (res) => {
          resolve(true); // Any response means port is listening
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

  startService(name, command, args, options = {}) {
    return new Promise((resolve, reject) => {
      this.log(`Starting ${name}...`, name);

      const service = spawn(command, args, {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        ...options,
      });

      service.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          // Filter out noisy logs for cleaner output
          if (
            !output.includes("⚠️ UNHANDLED REJECTION") &&
            !output.includes("EADDRINUSE") &&
            !output.includes("already in use")
          ) {
            console.log(`[${name}] ${output}`);
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
      const backendHealthy = await this.checkPort(8080);
      if (!backendHealthy && this.services.has("backend")) {
        this.log("⚠️ Backend health check failed", "HEALTH");
      }
    }, 10000); // Check every 10 seconds
  }

  async start() {
    console.log("🚀 Starting Space Analyzer Pro - Enhanced Service Manager\n");
    console.log("📊 Service Status:\n");

    try {
      // Start backend first
      await this.startService("backend", "npm", ["run", "server:dev"], {
        env: { ...process.env, SA_QUIET: "true" },
      });

      // Wait for backend to be ready (shorter timeout)
      const backendReady = await this.waitForService("backend", 8080, 15000); // 15 seconds max
      if (!backendReady) {
        this.log(
          "⚠️ Backend health check timeout, but port is listening - continuing...",
          "backend"
        );
        // Don't throw error - let frontend start anyway
      }

      // Start frontend
      await this.startService("frontend", "npm", ["run", "dev:no-browser"]);

      // Wait for frontend to be ready (check both 5173 and 5174)
      let frontendReady = await this.waitForService("frontend", 5173);
      if (!frontendReady) {
        // Try port 5174 as fallback
        frontendReady = await this.waitForService("frontend", 5174);
      }
      if (!frontendReady) {
        this.log("⚠️ Frontend may not be ready, but continuing...", "frontend");
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
const manager = new ServiceManager();

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
  console.error("❌ Startup failed:", error);
  process.exit(1);
});
