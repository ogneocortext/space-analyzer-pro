<template>
  <div v-if="showStatus" class="ollama-cloud-status">
    <div class="status-header" @click="toggleExpanded">
      <span class="status-icon">☁️</span>
      <span class="status-text">Ollama Cloud</span>
      <span class="usage-badge" :class="usageClass">
        {{ usagePercent }}%
      </span>
      <span class="expand-icon">{{ expanded ? '▼' : '▶' }}</span>
    </div>

    <div v-if="expanded" class="status-details">
      <!-- Session Usage -->
      <div class="usage-bar-container">
        <div class="usage-label">
          <span>Session (5h)</span>
          <span>{{ stats.callsThisSession }}/{{ stats.sessionLimit }}</span>
        </div>
        <div class="usage-bar">
          <div
            class="usage-fill"
            :class="sessionUsageClass"
            :style="{ width: `${Math.min(sessionUsagePercent, 100)}%` }"
          />
        </div>
        <div class="usage-reset">Resets in {{ stats.timeUntilSessionReset }}</div>
      </div>

      <!-- Weekly Usage -->
      <div class="usage-bar-container">
        <div class="usage-label">
          <span>Weekly</span>
          <span>{{ stats.callsThisWeek }}/{{ stats.weekLimit }}</span>
        </div>
        <div class="usage-bar">
          <div
            class="usage-fill"
            :class="weekUsageClass"
            :style="{ width: `${Math.min(weekUsagePercent, 100)}%` }"
          />
        </div>
        <div class="usage-reset">Resets in {{ stats.timeUntilWeekReset }}</div>
      </div>

      <!-- Actions -->
      <div class="status-actions">
        <button
          v-if="!isLocalOnly"
          class="action-btn local-only"
          @click="enableLocalOnly"
        >
          🏠 Local Only Mode
        </button>
        <button
          v-else
          class="action-btn cloud-enabled"
          @click="disableLocalOnly"
        >
          ☁️ Enable Cloud
        </button>
        <button class="action-btn" @click="refreshStats">🔄 Refresh</button>
      </div>

      <!-- Warning -->
      <div v-if="showWarning" class="warning-message">
        ⚠️ Approaching limit! Consider enabling Local Only mode.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ollamaRateLimiter } from "@/services/ai/OllamaRateLimiter";

const expanded = ref(false);
const stats = ref(ollamaRateLimiter.getUsageStats());
const updateInterval = ref<number | null>(null);

const showStatus = computed(() => {
  // Only show if not in local-only mode or if there have been cloud calls
  return !isLocalOnly.value || stats.value.callsThisSession > 0;
});

const isLocalOnly = computed(() => ollamaRateLimiter.isLocalOnlyMode());

const usagePercent = computed(() => {
  const sessionPct = Math.round(stats.value.sessionUsage * 100);
  const weekPct = Math.round(stats.value.weekUsage * 100);
  return Math.max(sessionPct, weekPct);
});

const usageClass = computed(() => {
  if (usagePercent.value >= 90) return "critical";
  if (usagePercent.value >= 75) return "warning";
  if (isLocalOnly.value) return "local-only";
  return "ok";
});

const sessionUsagePercent = computed(() =>
  Math.round(stats.value.sessionUsage * 100)
);

const weekUsagePercent = computed(() =>
  Math.round(stats.value.weekUsage * 100)
);

const sessionUsageClass = computed(() => {
  if (stats.value.sessionUsage >= 0.9) return "critical";
  if (stats.value.sessionUsage >= 0.75) return "warning";
  return "ok";
});

const weekUsageClass = computed(() => {
  if (stats.value.weekUsage >= 0.9) return "critical";
  if (stats.value.weekUsage >= 0.75) return "warning";
  return "ok";
});

const showWarning = computed(() => {
  return !isLocalOnly.value && usagePercent.value >= 75;
});

function toggleExpanded() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    refreshStats();
  }
}

function refreshStats() {
  stats.value = ollamaRateLimiter.getUsageStats();
}

function enableLocalOnly() {
  ollamaRateLimiter.setLocalOnlyMode();
  refreshStats();
}

function disableLocalOnly() {
  // Reset to free tier config
  Object.assign(ollamaRateLimiter, { config: { maxCallsPerSession: 50, maxCallsPerWeek: 200, minIntervalMs: 1000, warningThreshold: 0.8 } });
  refreshStats();
}

onMounted(() => {
  // Update stats every 30 seconds
  updateInterval.value = window.setInterval(refreshStats, 30000);
});

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value);
  }
});
</script>

<style scoped>
.ollama-cloud-status {
  background: var(--surface-color, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  font-size: 13px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.status-icon {
  font-size: 16px;
}

.status-text {
  flex: 1;
  font-weight: 500;
}

.usage-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.usage-badge.ok {
  background: #22c55e;
  color: white;
}

.usage-badge.warning {
  background: #f59e0b;
  color: white;
}

.usage-badge.critical {
  background: #ef4444;
  color: white;
}

.usage-badge.local-only {
  background: #6b7280;
  color: white;
}

.expand-icon {
  font-size: 10px;
  color: var(--text-secondary, #888);
}

.status-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #333);
}

.usage-bar-container {
  margin-bottom: 12px;
}

.usage-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.usage-bar {
  height: 6px;
  background: var(--border-color, #333);
  border-radius: 3px;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.usage-fill.ok {
  background: #22c55e;
}

.usage-fill.warning {
  background: #f59e0b;
}

.usage-fill.critical {
  background: #ef4444;
}

.usage-reset {
  font-size: 11px;
  color: var(--text-secondary, #888);
  margin-top: 2px;
}

.status-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.action-btn {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  background: var(--surface-color, #2a2a2a);
  color: var(--text-primary, #fff);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--surface-hover, #333);
}

.action-btn.local-only {
  border-color: #22c55e;
  color: #22c55e;
}

.action-btn.cloud-enabled {
  border-color: #3b82f6;
  color: #3b82f6;
}

.warning-message {
  margin-top: 12px;
  padding: 8px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 6px;
  font-size: 12px;
  color: #f59e0b;
}
</style>
