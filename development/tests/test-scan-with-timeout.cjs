const http = require('http');

const data = JSON.stringify({
  directory: "D:/Backup of Important Data for Windows 11 Upgrade/Native Media AI Studio",
  options: {
    recursive: true,
    strategy: "speed-optimized"  // Use the fastest strategy
  }
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/smart-analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 30000  // 30 second timeout
};

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  console.log(`headers:`, res.headers);
  
  let responseData = '';
  res.on('data', (d) => {
    responseData += d;
    console.log('Received chunk:', d.length, 'bytes');
  });
  
  res.on('end', () => {
    console.log('Complete Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error);
});

req.on('timeout', () => {
  console.error('Request timed out after 30 seconds');
  req.destroy();
});

req.setTimeout(30000);
req.write(data);
req.end();
