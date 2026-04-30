# Multi-Agent Orchestrator - Frontend Integration Guide
**Version:** 2.2.7  
**Date:** April 29, 2026

---

## Quick Start

### 1. Import Components

```typescript
import { AnalysisBridge } from '@/services/AnalysisBridge';
import CacheMonitor from '@/components/vue/orchestrator/CacheMonitor.vue';
import AIInsights from '@/components/vue/orchestrator/AIInsights.vue';
```

---

## Step 1: Monitor Cache Hit Rate

### Method: `getCacheMetrics()`

```typescript
const analysisBridge = new AnalysisBridge();

// Get cache performance metrics
const metrics = await analysisBridge.getCacheMetrics();
console.log(`Cache hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
console.log(`Hits: ${metrics.hits}, Misses: ${metrics.misses}`);
console.log(`Entries: ${metrics.size}/${metrics.maxSize}`);
```

### Vue Component: CacheMonitor

```vue
<template>
  <div>
    <!-- Basic usage -->
    <CacheMonitor />

    <!-- Auto-refresh every 5 seconds -->
    <CacheMonitor
      :auto-refresh="true"
      :refresh-interval="5000"
      @metrics-updated="onMetricsUpdated"
      @config-updated="onConfigUpdated"
    />
  </div>
</template>

<script setup>
import CacheMonitor from '@/components/vue/orchestrator/CacheMonitor.vue';

const onMetricsUpdated = (metrics) => {
  console.log('Cache metrics:', metrics);
  // Update your UI, charts, etc.
};

const onConfigUpdated = (config) => {
  console.log('Cache config updated:', config);
};
</script>
```

**Metrics Displayed:**
- Hit Rate (with trend indicator ✅⚠️❌)
- Cache Hits / Misses
- Entries (with utilization progress bar)
- Evictions

**Performance Tips:**
- Low hit rate (<50%) → Increase TTL
- High evictions → Increase max size
- Cache full → Invalidate old entries

---

## Step 2: Tune Cache TTL

### Method: `configureCache()`

```typescript
// Increase TTL to 30 minutes for production
await analysisBridge.configureCache(1800000, 100);

// Or configure separately
await analysisBridge.configureCache(600000); // Just TTL
await analysisBridge.configureCache(undefined, 200); // Just max size

// Check current configuration
const status = await analysisBridge.getOrchestratorStatus();
console.log(`TTL: ${status.cache.ttl}ms, Max entries: ${status.cache.maxSize}`);
```

### Vue Component: CacheMonitor (Built-in)

The `CacheMonitor` component includes configuration controls:

```vue
<CacheMonitor />
```

**Configuration Options:**

| TTL | Use Case |
|-----|----------|
| 1 minute (60,000ms) | Testing/Development |
| 5 minutes (300,000ms) | Frequently changing directories |
| 10 minutes (600,000ms) | Default - balanced |
| 30 minutes (1,800,000ms) | Stable directories |
| 1 hour (3,600,000ms) | Long-term caching |

| Max Size | Use Case |
|----------|----------|
| 10 | Small projects |
| 50 | Default - medium projects |
| 100 | Large projects |
| 200 | Enterprise - many directories |

---

## Step 3: AI Insights

### Method: `getAIInsights()`

```typescript
// Generate AI-powered insights for a directory
const { insights, source, timestamp } = await analysisBridge.getAIInsights(
  "D:\\Your\\Large\\Directory"
);

console.log(`Analysis source: ${source}`); // "cache" or "fresh"

// Access summary
console.log(`Files: ${insights.summary.totalFiles}`);
console.log(`Size: ${insights.summary.totalSize} bytes`);

// Top categories
insights.summary.topCategories.forEach(([name, data]) => {
  console.log(`${name}: ${data.count} files, ${data.size} bytes`);
});

// AI recommendations
insights.recommendations.forEach(rec => {
  console.log(`💡 ${rec}`);
});

// Storage optimization
console.log(`Potential savings: ${insights.storageOptimization.potentialSavings} bytes`);

// Security overview
console.log(`Hidden files: ${insights.security.hiddenFiles.length}`);
console.log(`Executables: ${insights.security.executableCount}`);
```

### Vue Component: AIInsights

```vue
<template>
  <div>
    <!-- With initial path (auto-analyzes) -->
    <AIInsights
      initial-path="D:\\Your\\Directory"
      :show-security="true"
      @insights-generated="onInsights"
      @error="onError"
    />

    <!-- Manual input mode -->
    <AIInsights
      :show-security="false"
      @insights-generated="onInsights"
    />
  </div>
</template>

<script setup>
import AIInsights from '@/components/vue/orchestrator/AIInsights.vue';

const onInsights = (data) => {
  console.log('AI Insights:', data.insights);
  console.log('Source:', data.source); // "cache" or "fresh"
  console.log('Timestamp:', data.timestamp);
};

const onError = (error) => {
  console.error('AI Insights error:', error);
};
</script>
```

**AI Insights Sections:**

1. **📊 Summary**
   - Total files & size
   - Top 5 categories by size
   - Largest files
   - Duplicate groups

2. **💡 AI Recommendations**
   - Personalized suggestions
   - Optimization opportunities
   - Best practices

3. **💾 Storage Optimization**
   - Potential savings from duplicates
   - Compression candidates
   - Old/unused files

4. **🔒 Security Overview** (optional)
   - Hidden files count
   - Executable files
   - Script files

---

## Complete Example: Dashboard Integration

```vue
<template>
  <div class="orchestrator-dashboard">
    <h1>🤖 Multi-Agent Orchestrator Dashboard</h1>

    <!-- Step 1: Cache Monitoring -->
    <section>
      <h2>Step 1: Cache Performance</h2>
      <CacheMonitor
        :auto-refresh="true"
        :refresh-interval="10000"
        @metrics-updated="updateCharts"
      />
    </section>

    <!-- Step 2: Analysis with AI -->
    <section>
      <h2>Step 2: AI-Powered Analysis</h2>
      <div class="input-section">
        <input
          v-model="directoryPath"
          placeholder="Enter directory path..."
          @keyup.enter="analyze"
        />
        <button @click="analyze" :disabled="loading">
          {{ loading ? 'Analyzing...' : 'Analyze with AI' }}
        </button>
      </div>

      <AIInsights
        v-if="showInsights"
        :initial-path="directoryPath"
        :show-security="true"
        @insights-generated="onInsights"
      />
    </section>

    <!-- Step 3: Orchestrated Analysis (Advanced) -->
    <section>
      <h2>Step 3: Orchestrated Directory Scan</h2>
      <button @click="orchestratedScan" :disabled="loading">
        Run Orchestrated Scan
      </button>
      <pre v-if="scanResult">{{ JSON.stringify(scanResult, null, 2) }}</pre>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AnalysisBridge } from '@/services/AnalysisBridge';
import CacheMonitor from '@/components/vue/orchestrator/CacheMonitor.vue';
import AIInsights from '@/components/vue/orchestrator/AIInsights.vue';

const analysisBridge = new AnalysisBridge();

const directoryPath = ref('');
const loading = ref(false);
const showInsights = ref(false);
const scanResult = ref(null);

const analyze = async () => {
  if (!directoryPath.value) return;
  loading.value = true;
  showInsights.value = true; // Triggers AIInsights component
  loading.value = false;
};

const onInsights = (data) => {
  console.log('AI insights received:', data);
  // Update your UI with insights
};

const updateCharts = (metrics) => {
  // Update Chart.js or other visualization libraries
  console.log('Cache metrics for charts:', metrics);
};

const orchestratedScan = async () => {
  loading.value = true;
  try {
    const { result, analysisId } = await analysisBridge.analyzeWithOrchestrator(
      directoryPath.value || "C:\\Users\\Default\\Documents",
      {
        useOllama: true,  // Enable AI
        priority: 1,      // HIGH priority
        parallel: true    // Parallel processing
      }
    );
    scanResult.value = result;
  } catch (error) {
    console.error('Orchestrated scan failed:', error);
  } finally {
    loading.value = false;
  }
};
</script>
```

---

## API Endpoints Reference

### Cache Endpoints

```bash
# Get cache metrics
GET /api/orchestrate/cache/metrics

# Configure cache
POST /api/orchestrate/cache/config
{
  "ttl": 1800000,        // 30 minutes
  "maxSize": 100         // 100 entries
}

# Invalidate cache
POST /api/orchestrate/cache/invalidate
{
  "pattern": "C:\\Data"   // Optional: pattern to match
}
```

### AI Insights Endpoint

```bash
# Generate AI insights
POST /api/orchestrate/insights
{
  "directoryPath": "D:\\Your\\Directory"
}

Response:
{
  "success": true,
  "insights": {
    "summary": { ... },
    "recommendations": [ ... ],
    "storageOptimization": { ... },
    "security": { ... }
  },
  "source": "cache",  // or "fresh"
  "timestamp": "2026-04-30T..."
}
```

### Orchestrator Status

```bash
# Get full orchestrator health
GET /api/orchestrate/status

Response:
{
  "success": true,
  "orchestrator": {
    "status": "running",
    "agents": {
      "total": 2,
      "available": 2,
      "busy": 0,
      "unhealthy": 0
    },
    "tasks": {
      "queued": 0,
      "active": 0,
      "completed": 5,
      "failed": 0
    },
    "cache": {
      "hits": 10,
      "misses": 2,
      "hitRate": 0.833,
      "size": 3,
      "maxSize": 50
    }
  }
}
```

---

## Performance Tuning Guide

### For Your 89GB Directory

**Recommended Configuration:**

```typescript
// Step 1: Increase cache size for large directories
await analysisBridge.configureCache(undefined, 200);

// Step 2: Set appropriate TTL
// If directory changes frequently: 5-10 minutes
// If directory is stable: 30-60 minutes
await analysisBridge.configureCache(1800000, 200); // 30 min, 200 entries

// Step 3: Run AI analysis
const { insights, source } = await analysisBridge.getAIInsights(
  "D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio"
);

// Check if used cache (fast) or fresh analysis
if (source === 'cache') {
  console.log('⚡ Instant results from cache!');
} else {
  console.log('✨ Fresh AI analysis completed');
}
```

**Expected Performance:**

| Scenario | Time | Cache Hit |
|----------|------|-----------|
| First scan (89GB) | ~25 seconds | ❌ Miss |
| Cached scan | 0-1ms | ✅ Hit |
| AI insights (cached) | <100ms | ✅ Hit |
| AI insights (fresh) | ~25s | ❌ Miss |

---

## Troubleshooting

### Low Cache Hit Rate

```typescript
// Problem: Hit rate < 50%
// Solution: Increase TTL
await analysisBridge.configureCache(3600000); // 1 hour
```

### Cache Too Small

```typescript
// Problem: Frequent evictions
// Solution: Increase max size
await analysisBridge.configureCache(undefined, 100);
```

### AI Insights Timeout

```typescript
// Problem: Large directory times out
// Solution: Increase timeout in backend-server.js
// Already set to 10 minutes (600,000ms) for your use case
```

### Path with Spaces Not Working

```typescript
// Use forward slashes or ensure proper escaping
const path = "D:/Backup of Important Data for Windows 11 Upgrade/Native Media AI Studio";
// NOT: "D:\\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"
```

---

## Next Steps

1. **Monitor for 1 week** - Track cache hit rate trends
2. **Tune TTL** - Adjust based on how often your directories change
3. **Add to dashboard** - Integrate CacheMonitor and AIInsights components
4. **Enable AI features** - Use `useOllama: true` for AI categorization

---

## Support

All new features are accessible via:
- **AnalysisBridge.ts** - 3 new methods
- **CacheMonitor.vue** - Real-time cache monitoring
- **AIInsights.vue** - AI-powered analysis display
- **4 new API endpoints** - Full programmatic access

**Status:** ✅ All features tested and ready for production use
