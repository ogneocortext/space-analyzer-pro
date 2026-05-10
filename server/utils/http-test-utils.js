/**
 * Shared HTTP Test Utilities
 * Consolidates duplicate HTTP request testing functionality
 */

const http = require('http');
const https = require('https');

class HttpTestUtils {
  constructor(baseUrl = 'http://localhost:8080', timeout = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Test an HTTP endpoint with consistent error handling
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Endpoint path
   * @param {Object} data - Request body data (optional)
   * @param {Object} options - Additional options
   * @returns {Promise} Response object
   */
  async testEndpoint(method, path, data = null, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const requestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: options.timeout || this.timeout,
      };

      const httpModule = url.protocol === 'https:' ? https : http;
      
      const req = httpModule.request(requestOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: body,
            headers: res.headers,
            success: res.statusCode < 400
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${requestOptions.timeout}ms`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Test endpoint using fetch (for Node.js 18+)
   * @param {string} method - HTTP method
   * @param {string} path - Endpoint path  
   * @param {Object} data - Request body data
   * @param {Object} options - Additional options
   * @returns {Promise} Response object
   */
  async testEndpointFetch(method, path, data = null, options = {}) {
    try {
      const requestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      if (data) {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseUrl}${path}`, requestOptions);
      const responseData = await response.json();

      return {
        status: response.status,
        body: responseData,
        headers: Object.fromEntries(response.headers.entries()),
        success: response.ok && responseData.success
      };
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * Validate URL for security
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is valid and safe
   */
  validateUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Assert helper for testing
   * @param {boolean} condition - Condition to test
   * @param {string} message - Test description
   * @param {Object} counters - Test counters object
   */
  assert(condition, message, counters = { total: 0, passed: 0, failed: 0 }) {
    counters.total++;
    if (condition) {
      counters.passed++;
      console.log(`  ✅ ${message}`);
    } else {
      counters.failed++;
      console.error(`  ❌ ${message}`);
    }
  }

  /**
   * Run a test with error handling
   * @param {string} name - Test name
   * @param {Function} fn - Test function
   * @param {Object} counters - Test counters
   */
  async runTest(name, fn, counters = { total: 0, passed: 0, failed: 0 }) {
    console.log(`\n📋 ${name}`);
    try {
      await fn();
    } catch (error) {
      counters.total++;
      counters.failed++;
      console.error(`  ❌ Test crashed: ${error.message}`);
    }
  }

  /**
   * Print test results summary
   * @param {Object} counters - Test counters
   */
  printSummary(counters) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(60));
    console.log(`  Total:  ${counters.total}`);
    console.log(`  Passed: ${counters.passed}`);
    console.log(`  Failed: ${counters.failed}`);
    console.log('='.repeat(60));
    
    return counters.failed === 0;
  }
}

// Default instance for backward compatibility
const defaultHttpTestUtils = new HttpTestUtils();

module.exports = {
  HttpTestUtils,
  testEndpoint: defaultHttpTestUtils.testEndpoint.bind(defaultHttpTestUtils),
  testEndpointFetch: defaultHttpTestUtils.testEndpointFetch.bind(defaultHttpTestUtils),
  validateUrl: defaultHttpTestUtils.validateUrl.bind(defaultHttpTestUtils),
  assert: defaultHttpTestUtils.assert.bind(defaultHttpTestUtils),
  runTest: defaultHttpTestUtils.runTest.bind(defaultHttpTestUtils),
  printSummary: defaultHttpTestUtils.printSummary.bind(defaultHttpTestUtils)
};