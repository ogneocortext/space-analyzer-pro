import { testEndpoint, assert, runTest, printSummary } from "./server/utils/http-test-utils.js";

const counters = { total: 0, passed: 0, failed: 0 };

async function runTests() {
  console.log("=".repeat(60));
  console.log("🧪 Space Analyzer API Endpoint Tests");
  console.log("=".repeat(60));

  // Check if server is running first
  try {
    await testEndpoint("GET", "/api/health");
  } catch {
    console.error("\n❌ Cannot connect to server at localhost:8080");
    console.error("   Make sure the server is running with: npm run server\n");
    process.exit(1);
  }

  await runTest("GET /api/health - Health check", async () => {
    const res = await testEndpoint("GET", "/api/health");
    const body = JSON.parse(res.body);
    assert(res.status === 200 || res.status === 503, `Status ${res.status}`, counters);
    assert(body.success !== undefined, "Has success field", counters);
    if (body.status) {
      assert(
        ["healthy", "degraded", "error"].includes(body.status),
        `Status is valid: ${body.status}`,
        counters
      );
    }
  });

  await runTest("GET /api/status - Server status", async () => {
    const res = await testEndpoint("GET", "/api/status");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`, counters);
    assert(body.success === true, "success is true", counters);
    assert(body.status === "operational", "status is operational", counters);
    assert(body.system !== undefined, "Has system info", counters);
  });

  await runTest("GET /api/version - Version info", async () => {
    const res = await testEndpoint("GET", "/api/version");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`, counters);
    assert(body.success === true, "success is true", counters);
    assert(body.version !== undefined, "Has version", counters);
  });

  await runTest("GET /api/info - API info", async () => {
    const res = await testEndpoint("GET", "/api/info");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`, counters);
    assert(body.success === true, "success is true", counters);
    assert(body.endpoints !== undefined, "Has endpoints listing", counters);
  });

  await runTest("GET /api/debug/routes - Debug routes", async () => {
    const res = await testEndpoint("GET", "/api/debug/routes");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`, counters);
    assert(body.success === true, "success is true", counters);
    assert(Array.isArray(body.routes), "Routes is an array", counters);
    assert(body.count > 0, "Has routes listed", counters);
  });

  await runTest("GET /api/ai/status - AI service status", async () => {
    const res = await testEndpoint("GET", "/api/ai/status");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.success === true, "success is true");
  });

  await runTest("GET /api/active - Active analyses", async () => {
    const res = await testEndpoint("GET", "/api/active");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`, counters);
    assert(body.success === true, "success is true", counters);
    assert(Array.isArray(body.analyses), "analyses is an array", counters);
  });

  await runTest("GET /api/analysis/health - Analysis health", async () => {
    const res = await testEndpoint("GET", "/api/analysis/health");
    try {
      const body = JSON.parse(res.body);
      assert(res.status === 200, `Status ${res.status}`, counters);
      assert(body.success === true, "success is true", counters);
    } catch {
      // Could also be the server's health endpoint
      assert(res.status < 500, `Status ${res.status} (no server error)`, counters);
    }
  });

  await runTest("GET /api/errors/health - Error service health", async () => {
    const res = await testEndpoint("GET", "/api/errors/health");
    try {
      const body = JSON.parse(res.body);
      assert(res.status === 200, `Status ${res.status}`, counters);
      assert(body.success === true, "success is true", counters);
    } catch {
      // error route might return different format
      assert(res.status < 500, `Status ${res.status} (no server error)`, counters);
    }
  });

  await runTest("POST /api/errors/report - Report error", async () => {
    const res = await testEndpoint("POST", "/api/errors/report", {
      message: "Test error from endpoint test",
      stack: "test stack",
      source: "test_endpoints.js",
    });
    try {
      const body = JSON.parse(res.body);
      assert(res.status === 200 || res.status === 201, `Status ${res.status}`, counters);
      assert(body.success === true, "success is true", counters);
    } catch {
      assert(res.status < 500, `Status ${res.status} (no server error)`, counters);
    }
  });

  await runTest("GET /api/history - Analysis history", async () => {
    const res = await testEndpoint("GET", "/api/history");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`, counters);
    assert(body.success === true, "success is true", counters);
    assert(body.analyses !== undefined, "has analyses field", counters);
  });

  await runTest("POST /api/cancel - Cancel non-existent analysis", async () => {
    const res = await testEndpoint("POST", "/api/cancel", {
      analysisId: "nonexistent-test-id",
    });
    const body = JSON.parse(res.body);
    // Should return 404 for non-existent analysis
    assert(res.status === 404, `Status ${res.status} (expected 404)`, counters);
    assert(body.success === false, "success is false for non-existent", counters);
  });

  await runTest("POST /api/analyze - Invalid path returns 400", async () => {
    const res = await testEndpoint("POST", "/api/analyze", {
      directoryPath: "",
    });
    const body = JSON.parse(res.body);
    assert(res.status === 400, `Status ${res.status} (expected 400)`, counters);
    assert(body.success === false, "success is false for invalid input", counters);
  });

  await runTest("GET /api/errors/recent - Recent errors", async () => {
    const res = await testEndpoint("GET", "/api/errors/recent");
    try {
      const body = JSON.parse(res.body);
      assert(res.status === 200, `Status ${res.status}`, counters);
      assert(body.success === true, "success is true", counters);
    } catch {
      assert(res.status < 500, `Status ${res.status} (no server error)`, counters);
    }
  });

  // Summary
  const allTestsPassed = printSummary(counters);

  if (!allTestsPassed) {
    process.exit(1);
  }
}

runTests();
