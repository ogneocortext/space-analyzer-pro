#!/usr/bin/env node

import http from "http";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

class StatusChecker {
  constructor() {
    this.services = [
      { name: "Backend", port: 8080, path: "/api/health", critical: true },
      { name: "Frontend", port: 5173, path: "/", critical: true },
      { name: "Frontend (Alt)", port: 5174, path: "/", critical: false },
      { name: "Frontend (Dev)", port: 5178, path: "/", critical: false },
    ];
  }

  async checkService(service) {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: service.port,
          path: service.path,
          method: "GET",
          timeout: 3000,
        },
        (res) => {
          const responseTime = Date.now() - startTime;
          resolve({
            name: service.name,
            status: res.statusCode === 200 ? "✅ Running" : "⚠️ Error",
            port: service.port,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            critical: service.critical,
          });
        }
      );

      req.on("error", () => {
        const responseTime = Date.now() - startTime;
        resolve({
          name: service.name,
          status: "❌ Stopped",
          port: service.port,
          statusCode: null,
          responseTime: `${responseTime}ms`,
          critical: service.critical,
        });
      });

      req.on("timeout", () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        resolve({
          name: service.name,
          status: "⏱️ Timeout",
          port: service.port,
          statusCode: null,
          responseTime: `${responseTime}ms`,
          critical: service.critical,
        });
      });

      req.end();
    });
  }

  async checkProcesses() {
    try {
      const platform = os.platform();
      let command;

      if (platform === "win32") {
        const { stdout } = await execAsync('tasklist /fi "imagename eq node.exe" /fo csv', {
          timeout: 5000,
        });
        const lines = stdout.split("\n");
        const nodeProcesses = lines.filter((line) => line.includes("node.exe")).length - 1; // Subtract header

        return {
          nodeProcesses: Math.max(0, nodeProcesses),
          platform: "Windows",
        };
      } else {
        const { stdout } = await execAsync("ps aux | grep node | grep -v grep", { timeout: 5000 });
        const nodeProcesses = stdout.split("\n").filter((line) => line.trim()).length;

        return {
          nodeProcesses,
          platform: platform,
        };
      }
    } catch (error) {
      return {
        nodeProcesses: 0,
        platform: os.platform(),
        error: error.message,
      };
    }
  }

  async checkPorts() {
    try {
      const platform = os.platform();
      let command;

      if (platform === "win32") {
        const { stdout } = await execAsync("netstat -an | findstr LISTENING", { timeout: 5000 });
        return {
          port8080: stdout.includes(":8080"),
          port5173: stdout.includes(":5173"),
          port5174: stdout.includes(":5174"),
          port5178: stdout.includes(":5178"),
        };
      } else {
        const { stdout } = await execAsync("netstat -an | grep LISTEN", { timeout: 5000 });
        return {
          port8080: stdout.includes(":8080"),
          port5173: stdout.includes(":5173"),
          port5174: stdout.includes(":5174"),
          port5178: stdout.includes(":5178"),
        };
      }
    } catch (error) {
      return {
        port8080: false,
        port5173: false,
        port5174: false,
        port5178: false,
        error: error.message,
      };
    }
  }

  async getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      uptime: `${Math.round(os.uptime() / 60)}min`,
    };
  }

  async run() {
    console.log("🔍 Space Analyzer Pro - Enhanced Service Status Check\n");

    // Get system info
    const systemInfo = await this.getSystemInfo();
    console.log("💻 System Information:");
    console.log(`   Platform: ${systemInfo.platform} (${systemInfo.arch})`);
    console.log(`   Node.js: ${systemInfo.nodeVersion}`);
    console.log(`   Memory: ${systemInfo.freeMemory} free / ${systemInfo.totalMemory} total`);
    console.log(`   Uptime: ${systemInfo.uptime}\n`);

    // Check services in parallel
    const serviceStatuses = await Promise.all(
      this.services.map((service) => this.checkService(service))
    );

    // Check processes and ports
    const [processes, ports] = await Promise.all([this.checkProcesses(), this.checkPorts()]);

    // Display service results
    console.log("📊 Service Status:");
    const criticalServices = serviceStatuses.filter((s) => s.critical);
    const optionalServices = serviceStatuses.filter((s) => !s.critical);

    console.log("   Critical Services:");
    criticalServices.forEach((service) => {
      const critical = service.critical ? "🔴" : "🟡";
      console.log(
        `   ${service.status.padEnd(12)} ${service.name} (port ${service.port}) - ${service.responseTime} ${critical}`
      );
    });

    if (optionalServices.length > 0) {
      console.log("   Optional Services:");
      optionalServices.forEach((service) => {
        console.log(
          `   ${service.status.padEnd(12)} ${service.name} (port ${service.port}) - ${service.responseTime}`
        );
      });
    }

    console.log("\n🌐 Port Status:");
    console.log(`   Backend (8080): ${ports.port8080 ? "✅ Listening" : "❌ Not listening"}`);
    console.log(`   Frontend (5173): ${ports.port5173 ? "✅ Listening" : "❌ Not listening"}`);
    console.log(`   Frontend Alt (5174): ${ports.port5174 ? "✅ Listening" : "❌ Not listening"}`);
    console.log(`   Frontend Dev (5178): ${ports.port5178 ? "✅ Listening" : "❌ Not listening"}`);

    console.log("\n💻 Process Information:");
    console.log(`   Node.js processes: ${processes.nodeProcesses}`);
    console.log(`   Platform: ${processes.platform}`);
    if (processes.error) {
      console.log(`   ⚠️ Process check error: ${processes.error}`);
    }

    // Overall status
    const criticalRunning = criticalServices.every((s) => s.status === "✅ Running");
    const optionalRunning = optionalServices.filter((s) => s.status === "✅ Running").length;

    console.log(
      `\n${criticalRunning ? "✅" : "⚠️"} Overall Status: ${criticalRunning ? "All critical services running" : "Some critical services down"}`
    );
    if (optionalServices.length > 0) {
      console.log(`   Optional services running: ${optionalRunning}/${optionalServices.length}`);
    }

    // Quick actions
    console.log("\n🚀 Quick Actions:");
    console.log("   npm run start     - Start all services");
    console.log("   npm run server    - Start backend only");
    console.log("   npm run dev       - Start frontend only");
    console.log("   npm run status    - Check this status again");
    console.log("   npm run cleanup   - Clean up processes and ports");

    // Health recommendations
    if (!criticalRunning) {
      console.log("\n💡 Recommendations:");
      const stoppedCritical = criticalServices.filter((s) => s.status !== "✅ Running");
      stoppedCritical.forEach((service) => {
        console.log(`   - ${service.name} is not running. Try: npm run start`);
      });
    }

    if (processes.nodeProcesses > 10) {
      console.log("\n⚠️ Warning: High number of Node.js processes detected");
      console.log("   Consider running: npm run cleanup");
    }
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught error in status check:", error.message);
  process.exit(1);
});

// Run the enhanced status check
new StatusChecker().run().catch(console.error);
