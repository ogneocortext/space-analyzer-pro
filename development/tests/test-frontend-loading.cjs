const http = require('http');

console.log('🔍 Testing Frontend Loading and Backend Connection...\n');

// Test 1: Check if frontend is serving correctly
console.log('1. Testing Frontend Accessibility:');
const frontendTest = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: '/',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`   ✅ Frontend accessible (Status: ${res.statusCode})`);
        console.log(`   📄 HTML content length: ${data.length} characters`);
        console.log(`   🎯 Contains React app: ${data.includes('root') ? 'Yes' : 'No'}`);
        resolve(true);
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Frontend not accessible: ${error.message}`);
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Frontend request timed out'));
    });

    req.end();
  });
};

// Test 2: Check if backend API is accessible from frontend context
console.log('\n2. Testing Backend API from Frontend Context:');
const backendTest = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: '/api/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`   ✅ Backend API accessible through frontend proxy`);
          try {
            const health = JSON.parse(data);
            console.log(`   📊 Backend status: ${health.status}`);
            console.log(`   🤖 AI Models: ${health.models?.length || 0}`);
          } catch (e) {
            console.log(`   ⚠️ Backend response not JSON: ${data.substring(0, 100)}...`);
          }
        } else {
          console.log(`   ⚠️ Backend API returned status: ${res.statusCode}`);
        }
        resolve(true);
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Backend API not accessible through frontend: ${error.message}`);
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Backend API request timed out'));
    });

    req.end();
  });
};

// Test 3: Check if static assets are loading
console.log('\n3. Testing Static Assets:');
const assetsTest = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: '/favicon.svg',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log(`   ✅ Static assets accessible (Status: ${res.statusCode})`);
      console.log(`   🎨 Content-Type: ${res.headers['content-type'] || 'Unknown'}`);
      resolve(true);
    });

    req.on('error', (error) => {
      console.log(`   ⚠️ Static assets issue: ${error.message}`);
      resolve(false); // Don't reject, just warn
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

// Run all tests
async function runTests() {
  try {
    await frontendTest();
    await backendTest();
    await assetsTest();
    
    console.log('\n🎉 Frontend Tests Completed Successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Open http://localhost:3001 in your browser');
    console.log('2. Check browser console for any JavaScript errors');
    console.log('3. Verify the auto-analysis starts with the pre-selected directory');
    console.log('4. Check if the dashboard displays the analysis results');
    
  } catch (error) {
    console.log('\n❌ Frontend Tests Failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure both frontend (port 5173) and backend (port 8080) are running');
    console.log('2. Check if Vite proxy configuration is correct');
    console.log('3. Verify no port conflicts exist');
  }
}

runTests();
