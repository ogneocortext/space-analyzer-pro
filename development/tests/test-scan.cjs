const http = require('http');

const data = JSON.stringify({
  directoryPath: "D:/Backup of Important Data for Windows 11 Upgrade/Native Media AI Studio",
  options: {
    recursive: true
  }
});

const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  console.log(`headers:`, res.headers);
  
  res.on('data', (d) => {
    console.log('Response:', d.toString());
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
