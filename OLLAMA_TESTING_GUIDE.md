# Ollama Testing Guide

This guide explains how to test the Zod validation, OllamaService, and related features with a local Ollama instance.

## Prerequisites

1. **Install Ollama** (if not already installed)
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Windows
   # Download from https://ollama.com/download/windows
   ```

2. **Start Ollama Server**
   ```bash
   ollama serve
   ```
   Default URL: `http://localhost:11434`

3. **Pull Required Model**
   ```bash
   ollama pull qwen2.5-coder:7b-instruct
   ```

## Running Tests

### 1. Unit Tests (No Ollama Required)

These test the Zod schemas, validation, and logic without needing a running Ollama instance:

```bash
# Run all unit tests
npm test -- ollama-validation.test.ts

# Run with coverage
npm test -- ollama-validation.test.ts --coverage

# Run in watch mode
npm test -- ollama-validation.test.ts --watch
```

**Unit tests cover:**
- ✅ Schema validation (models, requests, responses)
- ✅ Error extraction and formatting
- ✅ Localhost detection
- ✅ Rate limiting logic
- ✅ Local tool registry
- ✅ Environment configuration

### 2. Integration Tests (Requires Ollama)

These test the actual connection to your local Ollama instance:

```bash
# Ensure Ollama is running
ollama serve

# Run integration tests (if available in your test runner)
npm test -- ollama-integration.test.ts
```

**Integration tests verify:**
- ✅ Connection to `localhost:11434`
- ✅ Model list retrieval and validation
- ✅ Text generation API
- ✅ Chat completion API
- ✅ Response validation with live data

### 3. Manual Testing in Browser

Open browser console during development:

```javascript
// Test 1: Check Ollama connection
fetch('http://localhost:11434/api/tags')
  .then(r => r.json())
  .then(data => console.log('Models:', data.models.length))
  .catch(e => console.error('Connection failed:', e));

// Test 2: Validate a response
import { validateOllamaResponse } from '@/validation/ollama-validation';
const result = validateOllamaResponse({
  model: "qwen2.5-coder:7b-instruct",
  message: { role: "assistant", content: "Test" },
  done: true
});
console.log('Validation:', result);

// Test 3: Check rate limiting
import { ollamaRateLimiter } from '@/services/ai/OllamaRateLimiter';
console.log('Usage:', ollamaRateLimiter.getUsageStats());

// Test 4: List local tools
import { localToolRegistry } from '@/services/ai/tools/LocalToolRegistry';
console.log('Local tools:', localToolRegistry.getLocalOnlyTools());

// Test 5: Environment check
import { getOllamaConfig, isLocalhostOnly } from '@/config/env';
console.log('Config:', getOllamaConfig());
console.log('Local only mode:', isLocalhostOnly());
```

## Testing Checklist

### ✅ Schema Validation

| Test | Command | Expected Result |
|------|---------|-----------------|
| Valid model | `validateOllamaModels([validModel])` | `success: true` |
| Invalid model | `validateOllamaModels([invalidModel])` | `success: false` |
| Valid request | `validateChatRequest(validRequest)` | `success: true` |
| Invalid request | `validateChatRequest(invalidRequest)` | `success: false` |
| Valid response | `validateOllamaResponse(validResponse)` | `success: true` |

### ✅ Connection Tests

| Test | Command | Expected Result |
|------|---------|-----------------|
| Ollama running | `ollama serve` | Server starts on :11434 |
| List models | `curl http://localhost:11434/api/tags` | Returns JSON with models |
| Generate text | Test generation API | Returns valid response |
| Chat API | Test chat API | Returns valid response |

### ✅ Rate Limiting

| Test | Command | Expected Result |
|------|---------|-----------------|
| Check limits | `ollamaRateLimiter.canMakeCall()` | `allowed: true` |
| Record call | `ollamaRateLimiter.recordCall()` | Count increases |
| Local-only mode | `ollamaRateLimiter.setLocalOnlyMode()` | Blocks cloud calls |
| Check usage | `ollamaRateLimiter.getUsageStats()` | Returns stats object |

### ✅ Local Tools

| Test | Command | Expected Result |
|------|---------|-----------------|
| List tools | `localToolRegistry.getLocalOnlyTools()` | Array of 14+ tools |
| Get definitions | `localToolRegistry.getToolDefinitions(false)` | Array of tool defs |
| Execute tool | `localToolRegistry.executeTool("convert_size", args)` | Success with data |
| Cloud tools | `localToolRegistry.getCloudDependentTools()` | Empty array |

### ✅ Environment

| Test | Command | Expected Result |
|------|---------|-----------------|
| Get config | `getOllamaConfig()` | Valid config object |
| Localhost only | `isLocalhostOnly()` | `true` (default) |
| API keys | `getSearchApiKeys()` | Keys from `.env` |
| Validation | `validateEnv()` | Valid or errors listed |

## Test Scenarios

### Scenario 1: Localhost-Only Operation

```bash
# 1. Ensure .env has:
OLLAMA_CLOUD_ENABLED=false

# 2. Start Ollama
ollama serve

# 3. Run tests
npm test -- ollama-validation.test.ts

# 4. Verify no cloud calls made
# Check console - should show "Local-only mode" messages
```

**Expected:** All tests pass, no cloud quota used

### Scenario 2: With Cloud Features Enabled

```bash
# 1. Configure .env:
OLLAMA_CLOUD_ENABLED=true
OLLAMA_CLOUD_API_KEY=your_key_here

# 2. Run tests
npm test -- ollama-validation.test.ts

# 3. Verify rate limiting works
# Should show usage warnings at 80%
```

**Expected:** Tests pass, rate limiting active

### Scenario 3: Validation Failure Handling

```javascript
// Test with invalid data
const badData = {
  model: "", // Empty - should fail
  messages: [{ role: "invalid", content: "test" }],
  stream: "not_boolean" // Wrong type
};

const result = validateChatRequest(badData);
console.log(result);
// Should show:
// success: false
// message: "Validation failed: ..."
// errors: [detailed error list]
```

**Expected:** Validation fails gracefully with clear error messages

### Scenario 4: Tool Calling

```bash
# 1. Start app
npm run dev

# 2. In browser console, test tool execution:
import { localToolRegistry } from '@/services/ai/tools/LocalToolRegistry';
import { ollamaService } from '@/services/ai/OllamaService';

const tools = localToolRegistry.getToolDefinitions(false);
const result = await ollamaService.generateWithTools(
  "Find files larger than 100MB in my home directory",
  tools.filter(t => t.function.name === 'find_large_files')
);

console.log(result);
```

**Expected:** Tool executes locally, returns file list

## Debugging Failed Tests

### Issue: "Cannot connect to Ollama"

**Solution:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If connection refused:
ollama serve

# If using different port:
# Update OLLAMA_BASE_URL in .env
```

### Issue: "Model not found"

**Solution:**
```bash
# List available models
ollama list

# Pull required model
ollama pull qwen2.5-coder:7b-instruct

# Or update OLLAMA_DEFAULT_MODEL in .env to existing model
```

### Issue: "Validation failed" for valid data

**Solution:**
```javascript
// Check what specifically failed
const result = validateOllamaResponse(data);
if (!result.success) {
  console.log('Full error:', result.message);
  console.log('Error details:', result.errors);
  console.log('Received data:', JSON.stringify(data, null, 2));
}
```

### Issue: "Rate limit exceeded"

**Solution:**
```bash
# Check current usage
import { ollamaRateLimiter } from '@/services/ai/OllamaRateLimiter';
console.log(ollamaRateLimiter.getUsageStats());

# Reset if needed (for testing)
localStorage.removeItem('ollama_rate_limit_state');
location.reload();
```

## Continuous Testing

### Pre-commit Testing

Add to `package.json`:
```json
{
  "scripts": {
    "test:ollama": "vitest run src/tests/ollama-validation.test.ts",
    "test:ollama:watch": "vitest src/tests/ollama-validation.test.ts",
    "test:all": "vitest run"
  }
}
```

### GitHub Actions (CI)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ollama
```

## Summary

**All test scenarios:**
- ✅ Unit tests (no Ollama needed) - Run automatically in CI
- ✅ Integration tests (needs Ollama) - Run locally during development
- ✅ Manual browser testing - Interactive debugging
- ✅ End-to-end validation - Real-world usage simulation

**Next Steps:**
1. Run `npm test -- ollama-validation.test.ts` to verify all unit tests pass
2. Start Ollama with `ollama serve`
3. Run integration tests with live Ollama instance
4. Test tool calling in browser console
5. Verify rate limiting with `OllamaCloudStatus.vue` component

**All tests passing = Ready for production! 🎉**
