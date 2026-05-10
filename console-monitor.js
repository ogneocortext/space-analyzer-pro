import { chromium } from "playwright";

async function monitorConsole() {
  console.log("🔍 Starting performance and console monitoring...");

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture all console messages
  const consoleMessages = [];

  // Performance tracking
  const performanceData = {
    requests: [],
    slowRequests: [],
    largeResources: [],
    timing: {},
    startTime: Date.now(),
  };

  page.on("console", (msg) => {
    const message = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString(),
    };
    consoleMessages.push(message);
    console.log(`[${message.type.toUpperCase()}] ${message.text}`);
  });

  page.on("pageerror", (error) => {
    const message = {
      type: "ERROR",
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
    consoleMessages.push(message);
    console.error(`[ERROR] ${message.text}`);
  });

  page.on("request", (request) => {
    const requestData = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      startTime: Date.now(),
      headers: request.headers(),
    };
    performanceData.requests.push(requestData);
  });

  page.on("response", async (response) => {
    const url = response.url();
    const status = response.status();
    const request = performanceData.requests.find((r) => r.url === url);

    if (request) {
      const endTime = Date.now();
      const duration = endTime - request.startTime;
      request.duration = duration;
      request.status = status;
      request.size = await response
        .body()
        .then((body) => body.length)
        .catch(() => 0);

      // Track slow requests (> 1 second)
      if (duration > 1000) {
        performanceData.slowRequests.push({
          ...request,
          duration: duration,
          reason: "slow",
        });
      }

      // Track large resources (> 100KB)
      if (request.size > 100000) {
        performanceData.largeResources.push({
          ...request,
          size: request.size,
          sizeFormatted: `${(request.size / 1024).toFixed(2)} KB`,
          reason: "large",
        });
      }
    }

    if (status >= 400) {
      const message = {
        type: "HTTP_ERROR",
        url: url,
        status: status,
        statusText: response.statusText(),
        timestamp: new Date().toISOString(),
      };
      consoleMessages.push(message);
      console.error(`[HTTP_ERROR] ${message.status} ${message.statusText} - ${message.url}`);
    }
  });

  page.on("requestfailed", (failedRequest) => {
    const message = {
      type: "REQUEST_FAILED",
      url: failedRequest.url(),
      failure: failedRequest.failure(),
      timestamp: new Date().toISOString(),
    };
    consoleMessages.push(message);
    console.error(`[REQUEST_FAILED] ${message.url} - ${message.failure?.errorText}`);

    // Track failed requests in performance data
    const request = performanceData.requests.find((r) => r.url === failedRequest.url());
    if (request) {
      request.failed = true;
      request.failure = failedRequest.failure();
    }
  });

  try {
    // Navigate to the app
    console.log("🚀 Navigating to http://localhost:5174...");
    const navigationStart = Date.now();

    try {
      await page.goto("http://localhost:5174", { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch (error) {
      console.log("⚠️ Page load timeout, but continuing with monitoring...");
      console.log(`   Error: ${error.message}`);
      // Don't throw the error, continue with monitoring
    }

    const navigationDuration = Date.now() - navigationStart;
    performanceData.timing.navigationDuration = navigationDuration;
    console.log(`⏱️ Navigation completed in ${navigationDuration}ms`);

    // Wait a bit to capture any initial console messages
    await page.waitForTimeout(3000);

    // Get performance metrics from the browser
    const perfMetrics = await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.navigation;

      return {
        // Navigation timing
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        firstPaint: performance.getEntriesByType("paint")[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType("paint")[1]?.startTime || 0,

        // Resource counts
        resourceCount: performance.getEntriesByType("resource").length,

        // Memory usage (if available)
        memory: performance.memory
          ? {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
              jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            }
          : null,
      };
    });

    performanceData.timing.browserMetrics = perfMetrics;

    // Check page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    // Check if app is loaded
    const appElement = await page.locator("#app").first();
    const appExists = await appElement.isVisible().catch(() => false);
    console.log(`🎯 App element visible: ${appExists}`);

    if (appExists) {
      const appContent = await appElement.textContent();
      console.log(
        `📝 App content preview: "${appContent ? appContent.substring(0, 100) + "..." : "empty"}"`
      );
    }

    // Take a screenshot
    await page.screenshot({
      path: "test-results/console-monitor-screenshot.png",
      fullPage: true,
    });
    console.log("📸 Screenshot saved to test-results/console-monitor-screenshot.png");

    // Wait for more console messages
    console.log("⏳ Monitoring console for 5 more seconds...");
    await page.waitForTimeout(5000);
  } catch (error) {
    console.error("❌ Error during monitoring:", error.message);
  }

  // Performance Summary
  console.log("\n📊 PERFORMANCE ANALYSIS:");
  console.log(`Total requests: ${performanceData.requests.length}`);
  console.log(`Navigation duration: ${performanceData.timing.navigationDuration}ms`);

  if (performanceData.timing.browserMetrics) {
    const metrics = performanceData.timing.browserMetrics;
    console.log("\n🎯 Browser Performance Metrics:");
    console.log(`  DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`  DOM Interactive: ${metrics.domInteractive}ms`);
    console.log(`  First Paint: ${metrics.firstPaint.toFixed(2)}ms`);
    console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`  Total Resources: ${metrics.resourceCount}`);

    if (metrics.memory) {
      console.log("\n💾 Memory Usage:");
      console.log(`  Used JS Heap: ${(metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(
        `  Total JS Heap: ${(metrics.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  JS Heap Limit: ${(metrics.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      );
    }
  }

  if (performanceData.slowRequests.length > 0) {
    console.log("\n🐌 Slow Requests (> 1s):");
    performanceData.slowRequests.forEach((req, index) => {
      console.log(`  ${index + 1}. ${req.url} (${req.duration}ms) - ${req.resourceType}`);
    });
  }

  if (performanceData.largeResources.length > 0) {
    console.log("\n📦 Large Resources (> 100KB):");
    performanceData.largeResources.forEach((res, index) => {
      console.log(`  ${index + 1}. ${res.url} (${res.sizeFormatted}) - ${res.resourceType}`);
    });
  }

  // Resource type breakdown
  const resourceTypes = {};
  performanceData.requests.forEach((req) => {
    resourceTypes[req.resourceType] = (resourceTypes[req.resourceType] || 0) + 1;
  });
  console.log("\n📋 Resource Types:");
  Object.entries(resourceTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Console Summary
  console.log("\n📊 CONSOLE SUMMARY:");
  console.log(`Total messages captured: ${consoleMessages.length}`);

  const messageTypes = {};
  consoleMessages.forEach((msg) => {
    messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
  });

  console.log("Message types:");
  Object.entries(messageTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  if (consoleMessages.some((msg) => msg.type === "error" || msg.type === "ERROR")) {
    console.log("\n❌ ERRORS FOUND:");
    consoleMessages
      .filter((msg) => msg.type === "error" || msg.type === "ERROR")
      .forEach((msg) => console.log(`  ${msg.text}`));
  }

  // Performance recommendations
  console.log("\n💡 PERFORMANCE RECOMMENDATIONS:");
  if (performanceData.timing.navigationDuration > 5000) {
    console.log("  ⚠️ Page load is slow (> 5s). Consider:");
    console.log("    - Optimizing JavaScript bundles");
    console.log("    - Implementing code splitting");
    console.log("    - Lazy loading components");
  }

  if (performanceData.slowRequests.length > 0) {
    console.log("  ⚠️ Slow network requests detected. Consider:");
    console.log("    - Implementing request caching");
    console.log("    - Using CDN for static assets");
    console.log("    - Optimizing API response times");
  }

  if (performanceData.largeResources.length > 0) {
    console.log("  ⚠️ Large resources detected. Consider:");
    console.log("    - Image optimization and compression");
    console.log("    - Minifying CSS and JavaScript");
    console.log("    - Using modern image formats (WebP, AVIF)");
  }

  if (performanceData.timing.browserMetrics?.memory) {
    const memoryUsage =
      (performanceData.timing.browserMetrics.memory.usedJSHeapSize /
        performanceData.timing.browserMetrics.memory.jsHeapSizeLimit) *
      100;
    if (memoryUsage > 70) {
      console.log("  ⚠️ High memory usage detected. Consider:");
      console.log("    - Memory leak investigation");
      console.log("    - Optimizing data structures");
      console.log("    - Implementing cleanup patterns");
    }
  }

  await browser.close();
  console.log("✅ Performance and console monitoring complete");
}

monitorConsole().catch(console.error);
