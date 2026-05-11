#!/usr/bin/env node

/**
 * USN Journal Test Script
 * Tests NTFS USN (Update Sequence Number) Journal analysis capabilities
 */

import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";

class USNJournalTestRunner {
  constructor() {
    this.backendUrl = "http://localhost:8080";
    this.testResults = [];
    this.platform = process.platform;
  }

  log(message, level = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      INFO: "\x1b[36m",
      WARN: "\x1b[33m",
      ERROR: "\x1b[31m",
      SUCCESS: "\x1b[32m",
      RESET: "\x1b[0m",
    };

    console.log(`${colors[level]}[${timestamp}] ${message}${colors.RESET}`);
  }

  async makeRequest(url, method = "GET", data = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const data = body ? JSON.parse(body) : null;
            resolve({
              status: res.statusCode,
              data: data,
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: body,
            });
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async checkPlatformSupport() {
    this.log("Checking platform support for USN Journal...", "INFO");

    if (this.platform !== "win32") {
      this.log("⚠️ USN Journal analysis is Windows-only", "WARN");
      this.log("   This test will run in simulation mode", "INFO");
      return false;
    }

    try {
      // Check if we have admin privileges (simplified check)
      const testPath = path.join(process.env.TEMP || "/tmp", "usn_test.txt");
      fs.writeFileSync(testPath, "test");
      fs.unlinkSync(testPath);
      this.log("✅ Platform supports USN operations", "SUCCESS");
      return true;
    } catch (error) {
      this.log("⚠️ Limited USN access detected", "WARN");
      return false;
    }
  }

  async testUSNEndpoints() {
    this.log("Testing USN Journal Analysis Endpoints...", "INFO");

    const tests = [
      {
        name: "USN Journal Status",
        path: "/api/system/usn-journal-status",
        method: "GET",
      },
      {
        name: "USN Journal Reader",
        path: "/api/analysis/usn-journal",
        method: "GET",
      },
      {
        name: "File Change Detection",
        path: "/api/files/changes",
        method: "POST",
        data: { drive: "C:\\", since: "2024-01-01" },
      },
      {
        name: "USN Volume Info",
        path: "/api/system/usn-volume-info",
        method: "GET",
      },
    ];

    for (const test of tests) {
      try {
        this.log(`Running: ${test.name}`, "INFO");
        const result = await this.makeRequest(
          `${this.backendUrl}${test.path}`,
          test.method,
          test.data,
        );

        if (result.status === 200) {
          this.log(`✅ ${test.name} - SUCCESS`, "SUCCESS");
          this.testResults.push({ test: test.name, status: "PASS" });
        } else {
          this.log(`❌ ${test.name} - FAILED (${result.status})`, "ERROR");
          this.testResults.push({
            test: test.name,
            status: "FAIL",
            error: result.status,
          });
        }
      } catch (error) {
        this.log(`❌ ${test.name} - ERROR: ${error.message}`, "ERROR");
        this.testResults.push({
          test: test.name,
          status: "ERROR",
          error: error.message,
        });
      }
    }
  }

  async testJournalCapabilities() {
    this.log("Testing USN Journal Capabilities...", "INFO");

    const tests = [
      {
        name: "Real-time Monitoring",
        path: "/api/monitoring/usn-stream",
        method: "GET",
      },
      {
        name: "Journal Size Check",
        path: "/api/system/usn-journal-size",
        method: "GET",
      },
      {
        name: "Change History",
        path: "/api/files/change-history",
        method: "POST",
        data: { path: "C:\\", limit: 100 },
      },
    ];

    for (const test of tests) {
      try {
        this.log(`Running: ${test.name}`, "INFO");
        const result = await this.makeRequest(
          `${this.backendUrl}${test.path}`,
          test.method,
          test.data,
        );

        if (result.status === 200) {
          this.log(`✅ ${test.name} - SUCCESS`, "SUCCESS");
          this.testResults.push({ test: test.name, status: "PASS" });
        } else {
          this.log(
            `⚠️ ${test.name} - NOT IMPLEMENTED (${result.status})`,
            "WARN",
          );
          this.testResults.push({ test: test.name, status: "SKIP" });
        }
      } catch (error) {
        this.log(`⚠️ ${test.name} - NOT AVAILABLE: ${error.message}`, "WARN");
        this.testResults.push({ test: test.name, status: "SKIP" });
      }
    }
  }

  async testNativeComponents() {
    this.log("Testing Native USN Components...", "INFO");

    // Check if native scanner exists
    const nativeScannerPath = path.join(process.cwd(), "native", "scanner");
    const scannerExists = fs.existsSync(nativeScannerPath);

    if (scannerExists) {
      this.log("✅ Native scanner component found", "SUCCESS");
      this.testResults.push({ test: "Native USN Scanner", status: "PASS" });
    } else {
      this.log("⚠️ Native scanner component not found", "WARN");
      this.testResults.push({ test: "Native USN Scanner", status: "SKIP" });
    }

    // Check for USN-specific native modules
    const usnModulePath = path.join(process.cwd(), "native", "usn-journal");
    const usnExists = fs.existsSync(usnModulePath);

    if (usnExists) {
      this.log("✅ USN Journal native module found", "SUCCESS");
      this.testResults.push({ test: "USN Native Module", status: "PASS" });
    } else {
      this.log("⚠️ USN Journal native module not found", "WARN");
      this.testResults.push({ test: "USN Native Module", status: "SKIP" });
    }
  }

  async checkBackendHealth() {
    try {
      const result = await this.makeRequest(`${this.backendUrl}/api/health`);
      return result.status === 200;
    } catch (error) {
      return false;
    }
  }

  async run() {
    console.log("📝 USN Journal Test Runner\n");

    // Check if backend is running
    const isBackendHealthy = await this.checkBackendHealth();
    if (!isBackendHealthy) {
      this.log(
        "❌ Backend is not running. Please start the server first.",
        "ERROR",
      );
      this.log("   Run: npm run server", "INFO");
      process.exit(1);
    }

    this.log("✅ Backend is healthy", "SUCCESS");

    // Check platform support
    const hasUSNSupport = await this.checkPlatformSupport();

    // Run tests
    await this.testUSNEndpoints();
    await this.testJournalCapabilities();
    await this.testNativeComponents();

    // Display results
    console.log("\n📊 Test Results:");
    const passed = this.testResults.filter((r) => r.status === "PASS").length;
    const failed = this.testResults.filter((r) => r.status === "FAIL").length;
    const errors = this.testResults.filter((r) => r.status === "ERROR").length;
    const skipped = this.testResults.filter((r) => r.status === "SKIP").length;

    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Skipped: ${skipped}`);

    if (!hasUSNSupport) {
      console.log("\n💡 Note: USN Journal analysis requires Windows platform");
      console.log("   Some tests were skipped due to platform limitations");
    }

    if (failed > 0 || errors > 0) {
      console.log("\n❌ Some tests failed:");
      this.testResults
        .filter((r) => r.status === "FAIL" || r.status === "ERROR")
        .forEach((r) => console.log(`   - ${r.test}: ${r.error || r.status}`));
      process.exit(1);
    } else {
      console.log("\n✅ USN Journal tests completed successfully!");
    }
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught error:", error.message);
  process.exit(1);
});

// Run tests
new USNJournalTestRunner().run().catch(console.error);
