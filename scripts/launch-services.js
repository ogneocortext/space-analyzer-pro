#!/usr/bin/env node

/**
 * Launch Services
 * Launches backend and frontend services with configuration options
 */

import { spawn } from "child_process";

const args = process.argv.slice(2);
const launchBackend = !args.includes("--frontend-only");
const launchFrontend = !args.includes("--backend-only");

console.log("🚀 Launching services...\n");

const processes = [];

if (launchBackend) {
  console.log("Starting backend server...");
  const backend = spawn("npm", ["run", "server:dev"], { shell: true, stdio: "inherit" });
  processes.push(backend);
}

if (launchFrontend) {
  console.log("Starting frontend dev server...");
  const frontend = spawn("npm", ["run", "dev:no-browser"], { shell: true, stdio: "inherit" });
  processes.push(frontend);
}

console.log("\n✅ Services launched");
console.log("   Press Ctrl+C to stop all services\n");

// Handle graceful shutdown
const cleanup = () => {
  console.log("\n🛑 Shutting down services...");
  processes.forEach((p) => {
    try {
      p.kill("SIGINT");
    } catch (e) {
      // Process may already be dead
    }
  });
  setTimeout(() => process.exit(0), 1000);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
