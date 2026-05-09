import http from "http";

const BASE_URL = "http://localhost:8080";
const TIMEOUT_MS = 30000;

let passed = 0;
let failed = 0;
let total = 0;

function testEndpoint(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: TIMEOUT_MS,
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, body: body, headers: res.headers });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${TIMEOUT_MS}ms`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

async function runTest(name, fn) {
  console.log(`\n📋 ${name}`);
  try {
    await fn();
  } catch (error) {
    total++;
    failed++;
    console.error(`  ❌ Test crashed: ${error.message}`);
  }
}

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
    assert(res.status === 200 || res.status === 503, `Status ${res.status}`);
    assert(body.success !== undefined, "Has success field");
    if (body.status) {
      assert(["healthy", "degraded", "error"].includes(body.status), `Status is valid: ${body.status}`);
    }
  });

  await runTest("GET /api/status - Server status", async () => {
    const res = await testEndpoint("GET", "/api/status");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.success === true, "success is true");
    assert(body.status === "operational", "status is operational");
    assert(body.system !== undefined, "Has system info");
  });

  await runTest("GET /api/version - Version info", async () => {
    const res = await testEndpoint("GET", "/api/version");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.success === true, "success is true");
    assert(body.version !== undefined, "Has version");
  });

  await runTest("GET /api/info - API info", async () => {
    const res = await testEndpoint("GET", "/api/info");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.success === true, "success is true");
    assert(body.endpoints !== undefined, "Has endpoints listing");
  });

  await runTest("GET /api/debug/routes - Debug routes", async () => {
    const res = await testEndpoint("GET", "/api/debug/routes");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.success === true, "success is true");
    assert(Array.isArray(body.routes), "Routes is an array");
    assert(body.count > 0, "Has routes listed");
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
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.success === true, "success is true");
    assert(Array.isArray(body.analyses), "analyses is an array");
  });

  await runTest("GET /api/analysis/health - Analysis health", async () => {
    const res = await testEndpoint("GET", "/api/analysis/health");
    try {
      const body = JSON.parse(res.body);
      assert(res.status === 200, `Status ${res.status}`);
      assert(body.success === true, "success is true");
    } catch {
      // Could also be the server's health endpoint
      assert(res.status < 500, `Status ${res.status} (no server error)`);
    }
  });

  await runTest("GET /api/errors/health - Error service health", async () => {
    const res = await testEndpoint("GET", "/api/errors/health");
    try {
      const body = JSON.parse(res.body);
      assert(res.status === 200, `Status ${res.status}`);
      assert(body.success === true, "success is true");
    } catch {
      // error route might return different format
      assert(res.status < 500, `Status ${res.status} (no server error)`);
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
      assert(res.status === 200 || res.status === 201, `Status ${res.status}`);
      assert(body.success === true, "success is true");
    } catch {
      assert(res.status < 500, `Status ${res.status} (no server error)`);
    }
  });

  await runTest("GET /api/history - Analysis history", async () => {
    const res = await testEndpoint("GET", "/api/history");
    const body = JSON.parse(res.body);
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.success === true, "success is true");
    assert(body.analyses !== undefined, "has analyses field");
  });

  await runTest("POST /api/cancel - Cancel non-existent analysis", async () => {
    const res = await testEndpoint("POST", "/api/cancel", {
      analysisId: "nonexistent-test-id",
    });
    const body = JSON.parse(res.body);
    // Should return 404 for non-existent analysis
    assert(res.status === 404, `Status ${res.status} (expected 404)`);
    assert(body.success === false, "success is false for non-existent");
  });

  await runTest("POST /api/analyze - Invalid path returns 400", async () => {
    const res = await testEndpoint("POST", "/api/analyze", {
      directoryPath: "",
    });
    const body = JSON.parse(res.body);
    assert(res.status === 400, `Status ${res.status} (expected 400)`);
    assert(body.success === false, "success is false for invalid input");
  });

  await runTest("GET /api/errors/recent - Recent errors", async () => {
    const res = await testEndpoint("GET", "/api/errors/recent");
    try {
      const body = JSON.parse(res.body);
      assert(res.status === 200, `Status ${res.status}`);
      assert(body.success === true, "success is true");
    } catch {
      assert(res.status < 500, `Status ${res.status} (no server error)`);
    }
  });

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Results Summary");
  console.log("=".repeat(60));
  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();