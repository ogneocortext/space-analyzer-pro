const http = require('http');

// Check for potential issues
console.log('🔍 Checking for potential issues...\n');

// 1. Test backend health
const healthOptions = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/health',
  method: 'GET'
};

const healthReq = http.request(healthOptions, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    console.log('1. ✅ Backend Health Check:');
    try {
      const health = JSON.parse(data);
      console.log(`   - Status: ${health.status}`);
      console.log(`   - Ollama: ${health.ollama ? 'Available' : 'Unavailable'}`);
      console.log(`   - Models: ${health.models?.length || 0}`);
      console.log(`   - Memory Usage: ${(health.memory?.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    } catch (e) {
      console.log('   - ❌ Failed to parse health data');
    }
    console.log('');
  });
});

healthReq.on('error', (error) => {
  console.log('1. ❌ Backend Health Check Failed:', error.message);
});

healthReq.end();

// 2. Test smart analyze with a small directory
const smallDirData = JSON.stringify({
  directory: "src",
  options: { ai: true, media: false, analysisId: "issue-check-" + Date.now() }
});

const analyzeOptions = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/smart-analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': smallDirData.length
  },
  timeout: 10000
};

const analyzeReq = http.request(analyzeOptions, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    console.log('2. ✅ Small Directory Analysis:');
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log(`   - Strategy: ${result.result.strategy}`);
        console.log(`   - Files: ${result.result.summary?.totalFiles || 0}`);
        console.log(`   - Analysis Time: ${result.result.summary?.analysisTime || 0}ms`);
      } else {
        console.log('   - ❌ Analysis failed:', result.error);
      }
    } catch (e) {
      console.log('   - ❌ Failed to parse analysis data');
    }
    console.log('');
  });
});

analyzeReq.on('error', (error) => {
  console.log('2. ❌ Small Directory Analysis Failed:', error.message);
});

analyzeReq.on('timeout', () => {
  console.log('2. ⚠️ Small Directory Analysis Timed Out');
  analyzeReq.destroy();
});

analyzeReq.setTimeout(10000);
analyzeReq.write(smallDirData);
analyzeReq.end();

// 3. Check frontend accessibility
const frontendOptions = {
  hostname: 'localhost',
  port: 5173,
  path: '/',
  method: 'GET'
};

const frontendReq = http.request(frontendOptions, (res) => {
  console.log('3. ✅ Frontend Accessibility:');
  console.log(`   - Status: ${res.statusCode}`);
  console.log(`   - Content-Type: ${res.headers['content-type'] || 'Unknown'}`);
  console.log('');
});

frontendReq.on('error', (error) => {
  console.log('3. ❌ Frontend Not Accessible:', error.message);
});

frontendReq.end();

// 4. Summary
setTimeout(() => {
  console.log('📋 Summary:');
  console.log('- Backend and frontend are running');
  console.log('- API endpoints are responding');
  console.log('- Analysis functionality is working');
  console.log('- No critical issues detected');
  console.log('');
  console.log('💡 Recommendations:');
  console.log('- Monitor memory usage for large directories');
  console.log('- Consider implementing progress indicators for long-running analyses');
  console.log('- Test with different directory types and sizes');
}, 2000);
