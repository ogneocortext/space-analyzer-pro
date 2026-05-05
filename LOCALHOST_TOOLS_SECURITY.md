# Localhost Tools & Security Guide

This guide explains how to configure tools for localhost-only operation and securely manage API keys for your Space Analyzer application.

## Overview

Space Analyzer now supports **localhost-only tools** that execute locally without requiring Ollama Cloud API calls. This ensures:
- ✅ **Zero Ollama Cloud quota usage**
- ✅ **Complete privacy** - data never leaves your machine
- ✅ **Faster execution** - no network latency
- ✅ **Works offline** - no internet required

## Tool Architecture

### Two Types of Tools

| Tool Type | Cloud Required | Use Case |
|-----------|---------------|----------|
| **Local Tools** | ❌ No | File system analysis, disk usage, calculations |
| **Cloud Tools** | ✅ Yes | Web search, external APIs, cloud-hosted functions |

### Local Tool Registry

All localhost tools are managed by `LocalToolRegistry`:

```typescript
import { localToolRegistry } from "@/services/ai/tools/LocalToolRegistry";

// Get all local-only tools (no cloud required)
const localTools = localToolRegistry.getLocalOnlyTools();
// Returns: ['analyze_directory', 'find_duplicates', 'find_large_files', ...]

// Execute a tool locally
const result = await localToolRegistry.executeTool("analyze_directory", {
  path: "/home/user/Downloads",
  max_depth: 2
});
```

## Available Localhost Tools

### File System Analysis Tools

#### `analyze_directory`
Analyze directory structure, size, and file distribution.

```typescript
const result = await ollamaService.generateWithTools(
  "Analyze my Downloads folder and tell me what's taking up space",
  [localToolRegistry.getToolDefinitions()[0]]  // analyze_directory
);

// Tool definition:
{
  name: "analyze_directory",
  parameters: {
    path: "/home/user/Downloads",     // Required
    max_depth: 2,                    // Optional: 1-5, default: 2
    include_hidden: false            // Optional: default: false
  }
}
```

#### `find_duplicates`
Find duplicate files across directories.

```typescript
// Tool definition:
{
  name: "find_duplicates",
  parameters: {
    paths: ["/home/user/Downloads", "/home/user/Documents"],  // Required
    min_size_bytes: 1024,                                     // Optional: default 1KB
    hash_algorithm: "quick"                                   // Optional: 'md5' | 'sha256' | 'quick'
  }
}
```

#### `find_large_files`
Identify storage-hogging files.

```typescript
// Tool definition:
{
  name: "find_large_files",
  parameters: {
    path: "/home/user",       // Required
    min_size_mb: 100,         // Optional: default 100MB
    top_n: 20                 // Optional: default 20
  }
}
```

#### `get_file_distribution`
Get file type breakdown.

```typescript
// Tool definition:
{
  name: "get_file_distribution",
  parameters: {
    path: "/home/user/Downloads",  // Required
    group_by: "extension"          // Optional: 'extension' | 'category' | 'size_range'
  }
}
```

### Disk Usage & Cleanup Tools

#### `get_disk_usage`
Check drive capacity and free space.

```typescript
// Tool definition:
{
  name: "get_disk_usage",
  parameters: {
    drive: "C:"   // Windows drive or Linux mount point
  }
}
```

#### `get_cleanup_recommendations`
AI-powered cleanup suggestions.

```typescript
// Tool definition:
{
  name: "get_cleanup_recommendations",
  parameters: {
    path: "/home/user/Downloads",  // Required
    min_age_days: 90,              // Optional: default 90 days
    include_temp: true,            // Optional: default true
    include_cache: true              // Optional: default true
  }
}
```

#### `find_old_files`
Locate files not accessed in X days.

```typescript
// Tool definition:
{
  name: "find_old_files",
  parameters: {
    path: "/home/user/Downloads",  // Required
    older_than_days: 365,          // Optional: default 365
    access_type: "accessed"        // Optional: 'modified' | 'accessed' | 'created'
  }
}
```

### Search & Filter Tools

#### `search_files`
Find files by name pattern.

```typescript
// Tool definition:
{
  name: "search_files",
  parameters: {
    path: "/home/user",       // Required
    pattern: "*.jpg",         // Required: wildcards supported
    recursive: true           // Optional: default true
  }
}
```

#### `filter_by_category`
Filter by file type category.

```typescript
// Tool definition:
{
  name: "filter_by_category",
  parameters: {
    path: "/home/user/Downloads",  // Required
    category: "videos",             // Required: see categories below
    min_size_mb: 0                  // Optional: default 0
  }
}
```

**Categories:** `images`, `videos`, `documents`, `audio`, `archives`, `code`, `executables`, `temporary`

### Utility Tools

#### `convert_size`
Convert between size units.

```typescript
// Tool definition:
{
  name: "convert_size",
  parameters: {
    size: 1024,           // Required
    from_unit: "MB"       // Required: 'B' | 'KB' | 'MB' | 'GB' | 'TB'
  }
}
```

#### `estimate_cleanup_savings`
Calculate potential space savings.

```typescript
// Tool definition:
{
  name: "estimate_cleanup_savings",
  parameters: {
    operations: [
      { type: "delete_temp", target_path: "/tmp" },
      { type: "delete_duplicates", target_path: "/home/user" }
    ]
  }
}
```

### System Tools

#### `get_system_info`
Get system information.

```typescript
// Tool definition:
{
  name: "get_system_info",
  parameters: {
    include_drives: true   // Optional: default true
  }
}
```

## Environment Variables Configuration

### Security-First Configuration

All sensitive configuration is stored in environment variables, never in code:

```bash
# .env file (NEVER commit this!)
# ============================================

# Ollama Local (Required)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b-instruct
OLLAMA_TIMEOUT_MS=30000

# Ollama Cloud (Optional - leave disabled for localhost-only)
OLLAMA_CLOUD_ENABLED=false
# OLLAMA_CLOUD_API_KEY=sk-...  # Only set if using cloud features

# Web Search APIs (Optional - for local web search tools)
SERPER_API_KEY=your_key_here          # Google Search API
BING_SEARCH_API_KEY=your_key_here     # Bing Search
TAVILY_API_KEY=your_key_here          # AI-powered search

# Cloud Storage (Optional)
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here

# Security (Auto-generated if not set)
ENCRYPTION_KEY=your_32_char_key_here
JWT_SECRET=your_32_char_secret_here
```

### Environment Variable Security Levels

| Variable | Sensitivity | Log Safe | Commit Safe |
|----------|-------------|----------|-------------|
| `OLLAMA_BASE_URL` | public | ✅ Yes | ✅ Yes |
| `OLLAMA_DEFAULT_MODEL` | public | ✅ Yes | ✅ Yes |
| `OLLAMA_CLOUD_API_KEY` | secret | ❌ No | ❌ No |
| `SERPER_API_KEY` | secret | ❌ No | ❌ No |
| `AWS_SECRET_ACCESS_KEY` | secret | ❌ No | ❌ No |
| `ENCRYPTION_KEY` | secret | ❌ No | ❌ No |

### Using Environment Variables in Code

```typescript
import { 
  getEnv, 
  getEnvBool, 
  getEnvNumber,
  getOllamaConfig,
  getSearchApiKeys,
  hasWebSearchApi 
} from "@/config/env";

// Get string value
const apiKey = getEnv("SERPER_API_KEY");

// Get boolean
const cloudEnabled = getEnvBool("OLLAMA_CLOUD_ENABLED", false);

// Get number
const timeout = getEnvNumber("OLLAMA_TIMEOUT_MS", 30000);

// Get Ollama configuration
const ollamaConfig = getOllamaConfig();
// Returns: { baseUrl, defaultModel, timeoutMs, cloudEnabled, cloudApiKey }

// Check if web search is available
if (hasWebSearchApi()) {
  console.log("Web search tools available");
}
```

## Using Tools with Ollama

### Example 1: File Analysis with Local Tools

```typescript
import { ollamaService } from "@/services/ai/OllamaService";
import { localToolRegistry } from "@/services/ai/tools/LocalToolRegistry";

// Get localhost-only tools
const tools = localToolRegistry.getToolDefinitions(false); // false = no cloud

// Generate with tools
const response = await ollamaService.generateWithTools(
  "My Downloads folder is getting full. Can you analyze it and suggest what I can clean up?",
  tools.filter(t => 
    ["analyze_directory", "find_large_files", "get_cleanup_recommendations"]
      .includes(t.function.name)
  )
);

// The model will decide which tools to use
// Tools execute locally - no cloud calls!
```

### Example 2: Find and Clean Duplicates

```typescript
const response = await ollamaService.generateWithTools(
  "Find duplicate files in my home directory and estimate how much space I could save by removing them.",
  [
    localToolRegistry.getToolDefinitions()
      .find(t => t.function.name === "find_duplicates"),
    localToolRegistry.getToolDefinitions()
      .find(t => t.function.name === "estimate_cleanup_savings")
  ].filter(Boolean)
);
```

### Example 3: Categorize Files

```typescript
const response = await ollamaService.generateWithTools(
  "Show me what types of files are taking up space in my Documents folder.",
  [
    localToolRegistry.getToolDefinitions()
      .find(t => t.function.name === "get_file_distribution")
  ]
);
```

## Security Best Practices

### 1. Never Commit .env Files

```bash
# .gitignore should include:
.env
.env.local
.env.*.local
.env.development
.env.production

# Only commit .env.example (template without real values)
```

### 2. Use Different Keys for Dev/Production

```bash
# Development .env
OPENAI_API_KEY=sk-dev-...

# Production .env (different file, different key)
OPENAI_API_KEY=sk-prod-...
```

### 3. Rotate Keys Regularly

```bash
# Set a reminder to rotate keys every 90 days
# Old keys: revoke immediately if exposed
# New keys: generate and update .env
```

### 4. Validate Environment on Startup

```typescript
import { validateEnv, logEnvStatus } from "@/config/env";

// In your app initialization:
const validation = validateEnv();
if (!validation.valid) {
  console.error("Environment validation failed:", validation.errors);
  process.exit(1);
}

// Log safe environment status
logEnvStatus(); // Only logs public variables
```

### 5. Disable Cloud Features by Default

```bash
# .env
OLLAMA_CLOUD_ENABLED=false  # Safe default
```

### 6. Use Local Tools When Possible

```typescript
// ❌ Don't: Use cloud search for local file operations
const result = await ollamaService.searchWeb("how to find large files");

// ✅ Do: Use local tool for local operations
const tools = localToolRegistry
  .getToolDefinitions(false) // Local only
  .filter(t => t.function.name === "find_large_files");

const result = await ollamaService.generateWithTools(
  "Find files larger than 100MB",
  tools
);
```

## Testing Local Tools

### Test Script

```typescript
import { localToolRegistry } from "@/services/ai/tools/LocalToolRegistry";

async function testLocalTools() {
  console.log("Testing localhost-only tools...\n");
  
  // Test 1: List all local tools
  console.log("1. Available local tools:");
  const localTools = localToolRegistry.getLocalOnlyTools();
  localTools.forEach(tool => console.log(`   - ${tool}`));
  
  // Test 2: Check no cloud-dependent tools
  console.log("\n2. Cloud-dependent tools:");
  const cloudTools = localToolRegistry.getCloudDependentTools();
  if (cloudTools.length === 0) {
    console.log("   ✅ None - all tools are localhost-only!");
  } else {
    cloudTools.forEach(tool => console.log(`   - ${tool} (requires cloud)`));
  }
  
  // Test 3: Execute a calculation tool
  console.log("\n3. Testing convert_size tool:");
  const result = await localToolRegistry.executeTool("convert_size", {
    size: 1024,
    from_unit: "MB"
  });
  console.log("   Result:", result);
  
  // Test 4: Verify environment
  console.log("\n4. Environment check:");
  console.log("   Localhost only mode:", isLocalhostOnly());
  console.log("   Has web search API:", hasWebSearchApi());
}

testLocalTools();
```

## API Reference

### LocalToolRegistry Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getToolDefinitions(cloudAllowed)` | `ToolDefinition[]` | Get all tool definitions |
| `getLocalOnlyTools()` | `string[]` | Get localhost-only tool names |
| `getCloudDependentTools()` | `string[]` | Get cloud-required tool names |
| `executeTool(name, args)` | `Promise<ToolResult>` | Execute a tool locally |
| `hasTool(name)` | `boolean` | Check if tool exists |

### Environment Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getEnv(key, default)` | `string \| undefined` | Get environment variable |
| `getEnvBool(key, default)` | `boolean` | Get as boolean |
| `getEnvNumber(key, default)` | `number` | Get as number |
| `validateEnv()` | `{valid, errors}` | Validate all env vars |
| `isLocalhostOnly()` | `boolean` | Check if cloud disabled |
| `hasWebSearchApi()` | `boolean` | Check if search API configured |
| `getOllamaConfig()` | `OllamaConfig` | Get Ollama settings |
| `logEnvStatus()` | `void` | Log safe env status |

## Troubleshooting

### "Tool execution failed" Error

**Cause:** Tool handler not implemented  
**Solution:** Implement tool handlers with actual file system APIs

### Environment variables not loading

**Cause:** `.env` file not at project root  
**Solution:** Place `.env` in same directory as `package.json`

### API keys appearing in logs

**Cause:** Using `console.log` instead of secure logging  
**Solution:** Use `logEnvStatus()` which masks secrets

### "Tool not found" Error

**Cause:** Tool not registered or misspelled  
**Solution:** Check `localToolRegistry.getAvailableTools()`

## Summary

✅ **14 localhost-only tools available** - No Ollama Cloud required  
✅ **Environment-based security** - API keys in `.env`, never in code  
✅ **Auto-validation** - Checks for required env vars on startup  
✅ **Safe logging** - Secrets never appear in logs  
✅ **Git-safe** - `.env` in `.gitignore`, only `.env.example` committed

**Your Space Analyzer is now configured for secure, localhost-only operation! 🎉**
