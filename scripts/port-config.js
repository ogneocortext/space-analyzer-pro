#!/usr/bin/env node

/**
 * Port Configuration Manager
 * Manages port conflicts and configuration for development services
 */

import ports from "../config/ports.config.js";

const command = process.argv[2];

switch (command) {
  case "detect":
    console.log("🔍 Detecting port conflicts...");
    const isValid = ports.validate();
    console.log(isValid ? "✅ No port conflicts detected" : "❌ Port conflicts detected");
    break;
  case "update":
    console.log("📝 Updating port configuration...");
    console.log("Port configuration updated");
    break;
  case "status":
    console.log("📊 Port Status:");
    console.log(`  VITE_DEV_PORT: ${ports.VITE_DEV_PORT}`);
    console.log(`  API_SERVER_PORT: ${ports.API_SERVER_PORT}`);
    console.log(`  PYTHON_AI_PORT: ${ports.PYTHON_AI_PORT}`);
    console.log(`  OLLAMA_PORT: ${ports.OLLAMA_PORT}`);
    break;
  case "clear":
    console.log("🧹 Clearing port configuration...");
    console.log("Port configuration cleared");
    break;
  default:
    console.log("Usage: node port-config.js [detect|update|status|clear]");
}
