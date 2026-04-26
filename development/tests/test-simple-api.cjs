const http = require('http');

// Test a simple API call to see if server is responsive
const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/smart-analyze/strategies',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  
  res.on('data', (d) => {
    console.log('Response:', d.toString());
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.setTimeout(5000, () => {
  console.log('Request timed out');
  req.destroy();
});

req.end();
