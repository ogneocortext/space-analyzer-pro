# Ollama Cloud Rate Limiting Guide

This guide explains how the Space Analyzer app manages Ollama Cloud API usage to stay within free tier limits.

## Overview

Ollama 0.23.0 introduced cloud-dependent features:
- **OpenClaw Web Search** (`searchWeb()`) - Searches the web via Ollama Cloud
- **Featured Models** (`getFeaturedModels()`) - Fetches server-driven recommendations

Even when running Ollama locally, these features proxy through Ollama Cloud and consume your free quota.

## Free Tier Limits

| Plan | Usage | Concurrency | Reset Period |
|------|-------|-------------|--------------|
| **Free** | "Light usage" (GPU time) | 1 model | Session: 5 hours, Weekly: 7 days |
| **Pro** | 50x Free tier | 3 models | Same reset periods |
| **Max** | 5x Pro tier | 10 models | Same reset periods |

**Important:** Usage is measured by GPU time, not token count. Larger models and longer requests consume more quota.

## Rate Limiting Implementation

### Automatic Rate Limiting

The app includes automatic rate limiting via `OllamaRateLimiter`:

```typescript
// Conservative free tier limits (configurable)
const FREE_TIER_LIMITS = {
  maxCallsPerSession: 50,    // Max calls per 5-hour session
  maxCallsPerWeek: 200,      // Max calls per week
  minIntervalMs: 1000,       // Minimum 1 second between calls
  warningThreshold: 0.8,      // Warn at 80% usage
};
```

### Protected Methods

The following methods automatically check rate limits before making cloud calls:

| Method | Cloud Dependency | Rate Limited |
|--------|-----------------|--------------|
| `searchWeb()` | ✅ Ollama Cloud | ✅ Yes |
| `getFeaturedModels()` | ✅ Ollama Cloud | ✅ Yes |
| `generateWithTools()` | ⚠️ If using cloud tools | ⚠️ Per-tool |
| `generate()` / `chat()` | ❌ Local only | ❌ No |
| `fetchModels()` | ❌ Local only | ❌ No |

### Usage Tracking

Rate limits are tracked via:
1. **Session counters** - Reset every 5 hours
2. **Weekly counters** - Reset every 7 days
3. **LocalStorage** - Persists across page reloads

## Usage Examples

### Basic Usage (Automatic Protection)

```typescript
import { ollamaService } from "@/services/ai/OllamaService";

// These calls automatically respect rate limits
const searchResults = await ollamaService.searchWeb("TypeScript tips");
const featured = await ollamaService.getFeaturedModels();

// If limit reached, methods return null with console warning:
// "[OllamaService] searchWeb rate limited: Session limit reached..."
```

### Check Usage Status

```typescript
import { ollamaRateLimiter } from "@/services/ai/OllamaRateLimiter";

// Get current usage stats
const stats = ollamaRateLimiter.getUsageStats();
console.log(stats);
// {
//   callsThisSession: 23,
//   callsThisWeek: 45,
//   sessionLimit: 50,
//   weekLimit: 200,
//   sessionUsage: 0.46,  // 46%
//   weekUsage: 0.225,    // 22.5%
//   timeUntilSessionReset: "2h 15m",
//   timeUntilWeekReset: "5d 8h"
// }

// Check if call is allowed before making it
const check = ollamaRateLimiter.canMakeCall();
if (check.allowed) {
  await ollamaService.searchWeb("query");
} else {
  console.log("Cannot make call:", check.reason);
}
```

### Local-Only Mode

Disable all cloud calls to guarantee zero quota usage:

```typescript
import { ollamaRateLimiter } from "@/services/ai/OllamaRateLimiter";

// Enable local-only mode
ollamaRateLimiter.setLocalOnlyMode();

// Now cloud-dependent methods return null immediately
const result = await ollamaService.searchWeb("query");
// result === null
// Console: "[OllamaRateLimiter] Local-only mode enabled."

// Check mode
if (ollamaRateLimiter.isLocalOnlyMode()) {
  console.log("Running in local-only mode");
}
```

### Custom Rate Limits

For Pro/Max tier users, adjust limits:

```typescript
import { OllamaRateLimiter } from "@/services/ai/OllamaRateLimiter";

// Pro tier: 50x free tier limits
const proLimiter = new OllamaRateLimiter({
  maxCallsPerSession: 2500,   // 50 * 50
  maxCallsPerWeek: 10000,   // 50 * 200
  minIntervalMs: 500,         // Faster calls allowed
  warningThreshold: 0.9,      // Warn at 90%
});
```

## UI Component

The `OllamaCloudStatus.vue` component displays real-time usage:

```vue
<template>
  <OllamaCloudStatus />
</template>

<script setup>
import OllamaCloudStatus from "@/components/OllamaCloudStatus.vue";
</script>
```

### Features:
- **Visual usage bars** - Session (5h) and weekly progress
- **Color-coded warnings** - Green/Yellow/Red based on usage
- **One-click local-only mode** - Disable cloud calls instantly
- **Auto-refresh** - Updates every 30 seconds

## Best Practices

### 1. Use Local Models When Possible

```typescript
// ❌ Don't: Use cloud search for everything
const result = await ollamaService.searchWeb("common programming question");

// ✅ Do: Use local model for common questions
const result = await ollamaService.generate(
  "Explain JavaScript closures",
  "qwen2.5-coder:7b-instruct"  // Local model
);

// ✅ Do: Use cloud search only for current information
const result = await ollamaService.searchWeb(
  "latest TypeScript 5.5 features May 2024"
);
```

### 2. Batch Operations

```typescript
// ❌ Don't: Make multiple small searches
for (const term of searchTerms) {
  await ollamaService.searchWeb(term);  // N cloud calls
}

// ✅ Do: Combine into single call
const result = await ollamaService.searchWeb(
  `Compare: ${searchTerms.join(", ")}`
);
```

### 3. Cache Results

```typescript
// Cache search results to avoid repeated calls
const searchCache = new Map();

async function cachedSearch(query: string) {
  if (searchCache.has(query)) {
    return searchCache.get(query);
  }
  
  const result = await ollamaService.searchWeb(query);
  searchCache.set(query, result);
  return result;
}
```

### 4. Monitor Usage in Development

```typescript
// Add to your app's debug panel
const stats = ollamaRateLimiter.getUsageStats();
console.table({
  "Session Usage": `${(stats.sessionUsage * 100).toFixed(1)}%`,
  "Weekly Usage": `${(stats.weekUsage * 100).toFixed(1)}%`,
  "Session Reset": stats.timeUntilSessionReset,
  "Week Reset": stats.timeUntilWeekReset,
});
```

## Troubleshooting

### "Rate limited" warnings

**Cause:** Approaching free tier limits  
**Solution:** Enable local-only mode or wait for reset

### Methods returning `null`

**Cause:** Rate limit reached or local-only mode enabled  
**Solution:** Check `ollamaRateLimiter.getUsageStats()`

### Usage not resetting

**Cause:** LocalStorage persistence  
**Solution:** Clear browser localStorage or manually reset counters

## API Reference

### OllamaRateLimiter

| Method | Returns | Description |
|--------|---------|-------------|
| `canMakeCall()` | `{ allowed: boolean, reason?: string }` | Check if cloud call is allowed |
| `recordCall()` | `void` | Record a successful cloud call |
| `getUsageStats()` | `RateLimitStats` | Get current usage statistics |
| `setLocalOnlyMode()` | `void` | Disable all cloud calls |
| `isLocalOnlyMode()` | `boolean` | Check if in local-only mode |

### OllamaService (Cloud-Dependent Methods)

| Method | Rate Limited | Returns on Limit |
|--------|--------------|-------------------|
| `searchWeb(query, opts)` | ✅ Yes | `null` |
| `getFeaturedModels()` | ✅ Yes | `null` |
| `generateWithTools()` | ⚠️ Conditional | `null` |

## Configuration

Default configuration is conservative. Adjust based on your needs:

```typescript
// File: src/services/ai/OllamaRateLimiter.ts

// For testing/development (unlimited)
export const DEV_CONFIG = {
  maxCallsPerSession: 999999,
  maxCallsPerWeek: 999999,
  minIntervalMs: 0,
  warningThreshold: 1.0,
};

// For production (Pro tier)
export const PRO_CONFIG = {
  maxCallsPerSession: 2500,
  maxCallsPerWeek: 10000,
  minIntervalMs: 500,
  warningThreshold: 0.9,
};
```

---

**Remember:** Local Ollama operations (`generate`, `chat`, `fetchModels`) are **unlimited** and don't affect your cloud quota!
