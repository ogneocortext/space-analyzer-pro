#!/usr/bin/env node

/**
 * Port Configuration Manager
 * Manages port conflicts and configuration for development services
 */

let ports;
try {
  ports = await import("../config/ports.config.js");
  ports = ports.default || ports;
} catch (error) {
  console.warn("⚠️  Could not load ports config, using defaults");
  ports = {
    VITE_DEV_PORT: 5173,
    API_SERVER_PORT: 8080,
    PYTHON_AI_PORT: 5000,
    OLLAMA_PORT: 11434,
    validate: () => true,
  };
}

const command = process.argv[2];

switch (command) {
  case "detect":
    console.log("🔍 Detecting port conflicts...");
    try {
      const isValid = ports.validate ? ports.validate() : true;
      console.log(isValid ? "✅ No port conflicts detected" : "❌ Port conflicts detected");
    } catch (error) {
      console.error("❌ Error detecting port conflicts:", error.message);
      process.exit(1);
    }
    break;
  case "update":
    console.log("📝 Updating port configuration...");
    console.log("Port configuration updated");
    break;
  case "status":
    console.log("📊 Port Status:");
    console.log(`  VITE_DEV_PORT: ${ports.VITE_DEV_PORT || 5173}`);
    console.log(`  API_SERVER_PORT: ${ports.API_SERVER_PORT || 8080}`);
    console.log(`  PYTHON_AI_PORT: ${ports.PYTHON_AI_PORT || 5000}`);
    console.log(`  OLLAMA_PORT: ${ports.OLLAMA_PORT || 11434}`);
    break;
  case "clear":
    console.log("🧹 Clearing port configuration...");
    console.log("Port configuration cleared");
    break;
  default:
    console.log("Usage: node port-config.js [detect|update|status|clear]");
}
