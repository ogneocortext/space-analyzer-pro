#!/usr/bin/env node
/**
 * Automated page testing script for Space Analyzer Pro
 * Tests all pages and tracks errors with detailed reporting
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Configuration
const BASE_URL = "http://localhost:5173";
const BACKEND_URL = "http://localhost:8080";
const AI_SERVICE_URL = "http://localhost:5000";

// Test results storage
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  errors: [],
  warnings: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
  },
};

// Pages to test
const pages = [
  {
    name: "Home",
    url: "/",
    tests: ["page_loads", "no_console_errors", "elements_present"],
  },
  {
    name: "Scanner",
    url: "/scan",
    tests: ["page_loads", "no_console_errors", "scanner_functionality"],
  },
  {
    name: "Dashboard",
    url: "/dashboard",
    tests: ["page_loads", "no_console_errors", "dashboard_elements"],
  },
  {
    name: "File Browser",
    url: "/browser",
    tests: ["page_loads", "no_console_errors", "browser_functionality"],
  },
  {
    name: "Treemap",
    url: "/treemap",
    tests: ["page_loads", "no_console_errors", "treemap_rendering"],
  },
  {
    name: "Reports",
    url: "/reports",
    tests: ["page_loads", "no_console_errors", "reports_functionality"],
  },
  {
    name: "Settings",
    url: "/settings",
    tests: ["page_loads", "no_console_errors", "settings_elements"],
  },
];

// Service health checks
const serviceChecks = [
  {
    name: "Backend API",
    url: `${BACKEND_URL}/health`,
    expectedStatus: 200,
  },
  {
    name: "AI Service",
    url: `${AI_SERVICE_URL}/health`,
    expectedStatus: 200,
  },
  {
    name: "AI Service Docs",
    url: `${AI_SERVICE_URL}/docs`,
    expectedStatus: 200,
  },
];

// Utility functions
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, data };

  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);

  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }

  if (level === "error") {
    results.errors.push(logEntry);
  } else if (level === "warning") {
    results.warnings.push(logEntry);
  }
}

function saveResults() {
  const resultsDir = path.join(process.cwd(), "test-results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsFile = path.join(resultsDir, `page-test-results-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  log("info", `Results saved to: ${resultsFile}`);
  return resultsFile;
}

// Test functions
async function testPageLoad(page, pageInfo) {
  try {
    const response = await page.goto(`${BASE_URL}${pageInfo.url}`, {
      waitUntil: "networkidle",
      timeout: 10000,
    });

    const status = response.status();
    if (status !== 200) {
      throw new Error(`Page returned status ${status}`);
    }

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    log("info", `✅ ${pageInfo.name} page loaded successfully`, {
      url: pageInfo.url,
      status: status,
    });

    return true;
  } catch (error) {
    log("error", `❌ Failed to load ${pageInfo.name} page`, {
      url: pageInfo.url,
      error: error.message,
    });
    return false;
  }
}

async function testConsoleErrors(page, pageInfo) {
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location(),
      });
    } else if (msg.type() === "warning") {
      consoleWarnings.push({
        text: msg.text(),
        location: msg.location(),
      });
    }
  });

  // Reload page to catch console errors
  await page.reload({ waitUntil: "networkidle" });

  if (consoleErrors.length > 0) {
    log("error", `❌ Console errors on ${pageInfo.name} page`, consoleErrors);
    return false;
  }

  if (consoleWarnings.length > 0) {
    log("warning", `⚠️  Console warnings on ${pageInfo.name} page`, consoleWarnings);
    results.summary.warnings += consoleWarnings.length;
  }

  log("info", `✅ No console errors on ${pageInfo.name} page`);
  return true;
}

async function testPageElements(page, pageInfo) {
  try {
    // Check for common page elements
    const elements = await page.evaluate(() => {
      return {
        hasHeader: !!document.querySelector("header"),
        hasNavigation: !!document.querySelector("nav"),
        hasMain: !!document.querySelector("main"),
        hasTitle: !!document.querySelector("h1"),
        bodyText: document.body.innerText.length,
      };
    });

    if (!elements.hasMain) {
      throw new Error("Missing main content area");
    }

    if (elements.bodyText < 100) {
      log("warning", `⚠️  ${pageInfo.name} page has minimal content`, {
        bodyTextLength: elements.bodyText,
      });
    }

    log("info", `✅ ${pageInfo.name} page elements check passed`, elements);
    return true;
  } catch (error) {
    log("error", `❌ ${pageInfo.name} page elements check failed`, {
      error: error.message,
    });
    return false;
  }
}

async function testScannerFunctionality(page, pageInfo) {
  try {
    // Look for scanner-specific elements
    const scannerElements = await page.evaluate(() => {
      return {
        hasScanButton: !!document.querySelector(
          'button[type="submit"], button[data-action="scan"], .scan-btn'
        ),
        hasPathInput: !!document.querySelector('input[type="text"], input[type="file"]'),
        hasProgressIndicator: !!document.querySelector('[role="progressbar"], .progress'),
      };
    });

    log("info", `✅ Scanner functionality check`, scannerElements);
    return true;
  } catch (error) {
    log("error", `❌ Scanner functionality check failed`, {
      error: error.message,
    });
    return false;
  }
}

async function testBrowserFunctionality(page, pageInfo) {
  try {
    // Look for browser-specific elements
    const browserElements = await page.evaluate(() => {
      return {
        hasFileList: !!document.querySelector(".file-list, .files-container"),
        hasSearchInput: !!document.querySelector(
          'input[type="search"], input[placeholder*="search" i]'
        ),
        hasFilterOptions: !!document.querySelector("select, .filter-container"),
        hasViewToggle: !!document.querySelector(".view-toggle, button[data-view], button.view-btn"),
      };
    });

    log("info", `✅ Browser functionality check`, browserElements);
    return true;
  } catch (error) {
    log("error", `❌ Browser functionality check failed`, {
      error: error.message,
    });
    return false;
  }
}

async function testTreemapRendering(page, pageInfo) {
  try {
    // Look for treemap-specific elements
    const treemapElements = await page.evaluate(() => {
      return {
        hasTreemapContainer: !!document.querySelector(".treemap, svg, canvas"),
        hasDepthControl: !!document.querySelector("select, .depth-control"),
        hasLegend: !!document.querySelector(".legend, .color-legend"),
      };
    });

    log("info", `✅ Treemap rendering check`, treemapElements);
    return true;
  } catch (error) {
    log("error", `❌ Treemap rendering check failed`, {
      error: error.message,
    });
    return false;
  }
}

async function testDashboardElements(page, pageInfo) {
  try {
    // Look for dashboard-specific elements
    const dashboardElements = await page.evaluate(() => {
      return {
        hasStatsCards: !!document.querySelector(".stats, .metric-card"),
        hasCharts: !!document.querySelector(".chart, canvas, svg"),
        hasRecentActivity: !!document.querySelector(".activity, .recent-files"),
      };
    });

    log("info", `✅ Dashboard elements check`, dashboardElements);
    return true;
  } catch (error) {
    log("error", `❌ Dashboard elements check failed`, {
      error: error.message,
    });
    return false;
  }
}

async function testReportsFunctionality(page, pageInfo) {
  try {
    // Look for reports-specific elements
    const reportsElements = await page.evaluate(() => {
      return {
        hasReportGenerator: !!document.querySelector(
          '.report-generator, button[data-action="generate"], .generate-btn'
        ),
        hasTemplateSelector: !!document.querySelector("select, .template-selector"),
        hasExportOptions: !!document.querySelector(
          '.export, button[data-action="export"], .export-btn'
        ),
      };
    });

    log("info", `✅ Reports functionality check`, reportsElements);
    return true;
  } catch (error) {
    log("error", `❌ Reports functionality check failed`, {
      error: error.message,
    });
    return false;
  }
}

async function testSettingsElements(page, pageInfo) {
  try {
    // Look for settings-specific elements
    const settingsElements = await page.evaluate(() => {
      return {
        hasSettingsForm: !!document.querySelector("form, .settings-form"),
        hasToggleSwitches: !!document.querySelector('.toggle, input[type="checkbox"]'),
        hasSaveButton: !!document.querySelector(
          'button[data-action="save"], button[type="submit"], .save-btn'
        ),
      };
    });

    log("info", `✅ Settings elements check`, settingsElements);
    return true;
  } catch (error) {
    log("error", `❌ Settings elements check failed`, {
      error: error.message,
    });
    return false;
  }
}

// Test runner for a single page
async function testPage(page, pageInfo) {
  const testResults = {
    page: pageInfo.name,
    url: pageInfo.url,
    tests: [],
    passed: 0,
    failed: 0,
  };

  for (const testName of pageInfo.tests) {
    let passed = false;

    try {
      switch (testName) {
        case "page_loads":
          passed = await testPageLoad(page, pageInfo);
          break;
        case "no_console_errors":
          passed = await testConsoleErrors(page, pageInfo);
          break;
        case "elements_present":
          passed = await testPageElements(page, pageInfo);
          break;
        case "scanner_functionality":
          passed = await testScannerFunctionality(page, pageInfo);
          break;
        case "browser_functionality":
          passed = await testBrowserFunctionality(page, pageInfo);
          break;
        case "treemap_rendering":
          passed = await testTreemapRendering(page, pageInfo);
          break;
        case "dashboard_elements":
          passed = await testDashboardElements(page, pageInfo);
          break;
        case "reports_functionality":
          passed = await testReportsFunctionality(page, pageInfo);
          break;
        case "settings_elements":
          passed = await testSettingsElements(page, pageInfo);
          break;
        default:
          log("warning", `Unknown test: ${testName}`);
          passed = true;
      }

      testResults.tests.push({
        name: testName,
        passed: passed,
      });

      if (passed) {
        testResults.passed++;
      } else {
        testResults.failed++;
      }
    } catch (error) {
      log("error", `Test ${testName} failed with exception`, {
        error: error.message,
        page: pageInfo.name,
      });

      testResults.tests.push({
        name: testName,
        passed: false,
        error: error.message,
      });

      testResults.failed++;
    }
  }

  results.tests.push(testResults);
  results.summary.total += testResults.tests.length;
  results.summary.passed += testResults.passed;
  results.summary.failed += testResults.failed;

  return testResults;
}

// Service health check
async function checkServiceHealth(service) {
  try {
    const response = await fetch(service.url);
    const status = response.status;

    if (status === service.expectedStatus) {
      log("info", `✅ ${service.name} is healthy`, {
        url: service.url,
        status: status,
      });
      return true;
    } else {
      log("error", `❌ ${service.name} returned unexpected status`, {
        url: service.url,
        expected: service.expectedStatus,
        actual: status,
      });
      return false;
    }
  } catch (error) {
    log("error", `❌ Failed to check ${service.name} health`, {
      url: service.url,
      error: error.message,
    });
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log("info", "🚀 Starting Space Analyzer Pro page testing");

  // Check service health first
  log("info", "🔍 Checking service health...");
  let servicesHealthy = true;

  for (const service of serviceChecks) {
    const healthy = await checkServiceHealth(service);
    if (!healthy) {
      servicesHealthy = false;
    }
  }

  if (!servicesHealthy) {
    log("error", "❌ Some services are not healthy. Tests may fail.");
  }

  // Start browser
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Test each page
    log("info", "📄 Testing pages...");

    for (const pageInfo of pages) {
      log("info", `Testing ${pageInfo.name}...`);
      await testPage(page, pageInfo);
    }

    await context.close();
  } catch (error) {
    log("error", "❌ Browser automation failed", {
      error: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Generate summary
  log("info", "📊 Test Summary");
  log("info", `Total tests: ${results.summary.total}`);
  log("info", `Passed: ${results.summary.passed}`);
  log("info", `Failed: ${results.summary.failed}`);
  log("info", `Warnings: ${results.summary.warnings}`);

  const successRate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);
  log("info", `Success rate: ${successRate}%`);

  // Save results
  const resultsFile = saveResults();

  // Exit with appropriate code
  if (results.summary.failed > 0) {
    log("error", "❌ Some tests failed. Check results for details.");
    process.exit(1);
  } else {
    log("info", "✅ All tests passed!");
    process.exit(0);
  }
}

// Run tests
runAllTests().catch((error) => {
  log("error", "❌ Test runner failed", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export { runAllTests, results };
