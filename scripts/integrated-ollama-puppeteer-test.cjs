#!/usr/bin/env node

/**
 * Integrated Ollama Puppeteer Test
 * Tests Ollama integration with Puppeteer for web scraping
 */

const puppeteer = require("puppeteer");
const http = require("http");

class OllamaPuppeteerTest {
  constructor() {
    this.backendUrl = "http://localhost:8080";
    this.ollamaUrl = "http://localhost:11434";
    this.testResults = [];
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

  async testOllamaConnection() {
    this.log("Testing Ollama connection...", "INFO");

    try {
      const result = await this.makeRequest(`${this.ollamaUrl}/api/tags`);

      if (result.status === 200) {
        this.log("✅ Ollama server is accessible", "SUCCESS");
        this.testResults.push({ test: "Ollama Connection", status: "PASS" });
        return true;
      } else {
        this.log(`❌ Ollama server returned status ${result.status}`, "ERROR");
        this.testResults.push({
          test: "Ollama Connection",
          status: "FAIL",
          error: result.status,
        });
        return false;
      }
    } catch (error) {
      this.log(`❌ Ollama connection failed: ${error.message}`, "ERROR");
      this.testResults.push({
        test: "Ollama Connection",
        status: "ERROR",
        error: error.message,
      });
      return false;
    }
  }

  async testBackendIntegration() {
    this.log("Testing backend Ollama integration...", "INFO");

    const tests = [
      {
        name: "Ollama Service Status",
        path: "/api/ai/ollama/status",
        method: "GET",
      },
      {
        name: "AI Models List",
        path: "/api/ai/models",
        method: "GET",
      },
      {
        name: "AI Service Health",
        path: "/api/ai/health",
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

  async testPuppeteerIntegration() {
    this.log("Testing Puppeteer integration...", "INFO");

    let browser;
    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // Test frontend accessibility
      await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });

      const title = await page.title();
      if (title && title.includes("Space")) {
        this.log("✅ Frontend loaded successfully", "SUCCESS");
        this.testResults.push({ test: "Puppeteer Frontend", status: "PASS" });
      } else {
        this.log("❌ Frontend title not as expected", "ERROR");
        this.testResults.push({ test: "Puppeteer Frontend", status: "FAIL" });
      }

      // Test AI-related elements
      const aiElements = await page.$$(
        '[data-testid*="ai"], .ai-component, [class*="ai"]',
      );
      if (aiElements.length > 0) {
        this.log(
          `✅ Found ${aiElements.length} AI-related elements`,
          "SUCCESS",
        );
        this.testResults.push({
          test: "AI Elements Detection",
          status: "PASS",
        });
      } else {
        this.log("⚠️ No AI-related elements found", "WARN");
        this.testResults.push({
          test: "AI Elements Detection",
          status: "SKIP",
        });
      }
    } catch (error) {
      this.log(`❌ Puppeteer test failed: ${error.message}`, "ERROR");
      this.testResults.push({
        test: "Puppeteer Frontend",
        status: "ERROR",
        error: error.message,
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async checkServicesHealth() {
    this.log("Checking services health...", "INFO");

    const services = [
      { name: "Backend", url: `${this.backendUrl}/api/health` },
      { name: "Frontend", url: "http://localhost:5173" },
      { name: "Ollama", url: `${this.ollamaUrl}/api/tags` },
    ];

    const healthResults = {};

    for (const service of services) {
      try {
        const result = await this.makeRequest(service.url);
        healthResults[service.name] = result.status === 200;
      } catch (error) {
        healthResults[service.name] = false;
      }
    }

    return healthResults;
  }

  async run() {
    console.log("🧪 Integrated Ollama Puppeteer Test Runner\n");

    // Check services health
    const health = await this.checkServicesHealth();

    if (!health.Backend) {
      this.log(
        "❌ Backend is not running. Please start the server first.",
        "ERROR",
      );
      this.log("   Run: npm run server", "INFO");
      process.exit(1);
    }

    if (!health.Frontend) {
      this.log(
        "❌ Frontend is not running. Please start the dev server first.",
        "ERROR",
      );
      this.log("   Run: npm run dev", "INFO");
      process.exit(1);
    }

    if (!health.Ollama) {
      this.log("⚠️ Ollama is not running. Some tests will be skipped.", "WARN");
      this.log(
        "   Run: ollama serve (if you want full integration tests)",
        "INFO",
      );
    }

    this.log("✅ Required services are healthy", "SUCCESS");

    // Run tests
    await this.testOllamaConnection();
    await this.testBackendIntegration();
    await this.testPuppeteerIntegration();

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

    if (failed > 0 || errors > 0) {
      console.log("\n❌ Some tests failed:");
      this.testResults
        .filter((r) => r.status === "FAIL" || r.status === "ERROR")
        .forEach((r) => console.log(`   - ${r.test}: ${r.error || r.status}`));
      process.exit(1);
    } else {
      console.log("\n✅ All integration tests passed!");
    }
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught error:", error.message);
  process.exit(1);
});

// Run tests
new OllamaPuppeteerTest().run().catch(console.error);
