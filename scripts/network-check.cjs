const http = require('http');

function test(name, options) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(options, (res) => {
      const ms = Date.now() - start;
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[${ms}ms] ${name}: ${res.statusCode}`);
        resolve(true);
      });
    });
    req.on('error', (e) => {
      console.log(`[ERR] ${name}: ${e.message}`);
      resolve(false);
    });
    req.setTimeout(5000, () => {
      console.log(`[TMO] ${name}: timeout`);
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function main() {
  const results = [];

  // Test network IP
  results.push(await test('Frontend (192.168.0.164:5173)', {
    hostname: '192.168.0.164', port: 5173, path: '/', method: 'GET'
  }));

  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(0);
}

main();