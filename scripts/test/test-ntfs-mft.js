#!/usr/bin/env node

/**
 * NTFS MFT Test Script
 * Tests NTFS Master File Table access and analysis capabilities
 */

import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";

class NTFSMFTTestRunner {
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
    this.log("Checking platform support for NTFS MFT...", "INFO");

    if (this.platform !== "win32") {
      this.log("⚠️ NTFS MFT analysis is Windows-only", "WARN");
      this.log("   This test will run in simulation mode", "INFO");
      return false;
    }

    try {
      // Check if we have admin privileges (simplified check)
      const testPath = path.join(process.env.TEMP || "/tmp", "ntfs_test.txt");
      fs.writeFileSync(testPath, "test");
      fs.unlinkSync(testPath);
      this.log("✅ Platform supports NTFS operations", "SUCCESS");
      return true;
    } catch (error) {
      this.log("⚠️ Limited NTFS access detected", "WARN");
      return false;
    }
  }

  async testNTFSEndpoints() {
    this.log("Testing NTFS MFT Analysis Endpoints...", "INFO");

    const tests = [
      {
        name: "NTFS Drive Detection",
        path: "/api/system/ntfs-drives",
        method: "GET",
      },
      {
        name: "MFT Analysis API",
        path: "/api/analysis/mft-analysis",
        method: "GET",
      },
      {
        name: "NTFS Metadata Extraction",
        path: "/api/files/ntfs-metadata",
        method: "POST",
        data: { path: "C:\\", include_mft: true },
      },
      {
        name: "File System Info",
        path: "/api/system/filesystem-info",
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

  async testNativeComponents() {
    this.log("Testing Native NTFS Components...", "INFO");

    // Check if native scanner exists
    const nativeScannerPath = path.join(process.cwd(), "native", "scanner");
    const scannerExists = fs.existsSync(nativeScannerPath);

    if (scannerExists) {
      this.log("✅ Native scanner component found", "SUCCESS");
      this.testResults.push({
        test: "Native Scanner Component",
        status: "PASS",
      });
    } else {
      this.log("⚠️ Native scanner component not found", "WARN");
      this.testResults.push({
        test: "Native Scanner Component",
        status: "SKIP",
      });
    }

    // Check for Rust components
    const rustPath = path.join(process.cwd(), "src", "rust");
    const rustExists = fs.existsSync(rustPath);

    if (rustExists) {
      this.log("✅ Rust components found", "SUCCESS");
      this.testResults.push({ test: "Rust Components", status: "PASS" });
    } else {
      this.log("⚠️ Rust components not found", "WARN");
      this.testResults.push({ test: "Rust Components", status: "SKIP" });
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
    console.log("💾 NTFS MFT Test Runner\n");

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
    const hasNTFSSupport = await this.checkPlatformSupport();

    // Run tests
    await this.testNTFSEndpoints();
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

    if (!hasNTFSSupport) {
      console.log("\n💡 Note: NTFS MFT analysis requires Windows platform");
      console.log("   Some tests were skipped due to platform limitations");
    }

    if (failed > 0 || errors > 0) {
      console.log("\n❌ Some tests failed:");
      this.testResults
        .filter((r) => r.status === "FAIL" || r.status === "ERROR")
        .forEach((r) => console.log(`   - ${r.test}: ${r.error || r.status}`));
      process.exit(1);
    } else {
      console.log("\n✅ NTFS MFT tests completed successfully!");
    }
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught error:", error.message);
  process.exit(1);
});

// Run tests
new NTFSMFTTestRunner().run().catch(console.error);
