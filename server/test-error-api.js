// Test script to verify error API endpoints
const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('🧪 Testing Error API Endpoints\n');

  // Test health endpoint
  console.log('1. GET /api/errors/health');
  const health = await makeRequest('/api/errors/health');
  console.log('   Status:', health.status);
  console.log('   Data:', JSON.stringify(health.data, null, 2));

  // Test recent errors
  console.log('\n2. GET /api/errors/recent?limit=10');
  const recent = await makeRequest('/api/errors/recent?limit=10');
  console.log('   Status:', recent.status);
  console.log('   Errors count:', recent.data.errors?.length || 0);

  // Test stats
  console.log('\n3. GET /api/errors/stats?days=7');
  const stats = await makeRequest('/api/errors/stats?days=7');
  console.log('   Status:', stats.status);
  console.log('   Stats:', JSON.stringify(stats.data.stats, null, 2));

  // Report a test error
  console.log('\n4. POST /api/errors/report (test error)');
  const testError = {
    type: 'TestError',
    message: 'This is a test error from the API test script',
    source: 'backend',
    stack: 'Test stack trace',
    url: '/api/test',
    method: 'GET',
  };
  const report = await makeRequest('/api/errors/report', 'POST', testError);
  console.log('   Status:', report.status);
  console.log('   Response:', JSON.stringify(report.data, null, 2));

  // Verify error was saved
  console.log('\n5. GET /api/errors/recent (after adding test error)');
  const recent2 = await makeRequest('/api/errors/recent?limit=10');
  console.log('   Status:', recent2.status);
  console.log('   Errors count:', recent2.data.errors?.length || 0);
  if (recent2.data.errors?.length > 0) {
    console.log('   Latest error:', recent2.data.errors[0].message);
  }

  console.log('\n✅ API tests completed!');
}

test().catch(console.error);
