<template>
  <div class="content-section">
    <h2>Automation</h2>
    <p>Automated cleanup and maintenance tasks</p>

    <div class="automation-section">
      <div class="automation-overview">
        <h3>System Status</h3>
        <div class="status-grid">
          <div class="status-card">
            <h4>Active Rules</h4>
            <div class="status-value">
              {{ rules.filter((rule) => rule.enabled).length }} / {{ rules.length }}
            </div>
            <div class="status-indicator">
              <span
                class="status-dot"
                :style="{
                  backgroundColor: rules.filter((rule) => rule.enabled).length > 0 ? '#10b981' : '#ef4444'
                }"
              />
              {{ rules.filter((rule) => rule.enabled).length > 0 ? 'Active' : 'Inactive' }}
            </div>
          </div>
          <div class="status-card">
            <h4>Storage Usage</h4>
            <div class="status-value">{{ storageUsage.toFixed(1) }}%</div>
            <div class="status-indicator">
              <span
                class="status-dot"
                :style="{ backgroundColor: storageUsage > 80 ? '#ef4444' : '#10b981' }"
              />
              {{ storageUsage > 80 ? 'High' : 'Normal' }}
            </div>
          </div>
          <div class="status-card">
            <h4>Last Run</h4>
            <div class="status-value">
              {{ lastRun?.toLocaleString() || 'Never' }}
            </div>
            <div class="status-indicator">
              <span class="status-dot" style="background-color: #10b981" />
              System Active
            </div>
          </div>
          <div class="status-card">
            <h4>Next Scheduled</h4>
            <div class="status-value">
              {{ nextScheduled?.toLocaleString() || 'No scheduled tasks' }}
            </div>
            <div class="status-indicator">
              <span class="status-dot" style="background-color: #3b82f6" />
              Scheduled
            </div>
          </div>
        </div>
      </div>

      <div class="rules-list">
        <div class="rules-header">
          <h3>Active Automations</h3>
          <button class="add-rule-button" @click="isCreatingRule = true">
            + Add Rule
          </button>
        </div>

        <div
          v-for="rule in rules"
          :key="rule.id"
          :class="['rule-card', rule.enabled ? 'enabled' : 'disabled']"
        >
          <div class="rule-header">
            <div class="rule-info">
              <h4>{{ rule.name }}</h4>
              <p>{{ rule.description }}</p>
            </div>
            <div class="rule-controls">
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="rule.enabled"
                  @change="toggleRule(rule.id)"
                />
                <span class="slider" />
              </label>
              <button
                class="delete-button"
                @click="deleteRule(rule.id)"
                title="Delete rule"
              >
                🗑️
              </button>
            </div>
          </div>

          <div class="rule-details">
            <div class="detail-item">
              <span class="detail-label">Trigger:</span>
              <span class="detail-value">{{ rule.trigger }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Action:</span>
              <span class="detail-value">{{ rule.action }}</span>
            </div>
            <div v-if="rule.lastRun" class="detail-item">
              <span class="detail-label">Last Run:</span>
              <span class="detail-value">{{ rule.lastRun.toLocaleString() }}</span>
            </div>
            <div v-if="rule.nextRun" class="detail-item">
              <span class="detail-label">Next Run:</span>
              <span class="detail-value">{{ rule.nextRun.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <div v-if="isCreatingRule" class="create-rule-form">
          <h4>Create New Automation Rule</h4>
          <div class="form-grid">
            <input type="text" placeholder="Rule name" class="form-input" />
            <input type="text" placeholder="Description" class="form-input" />
            <select class="form-select">
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Real-time</option>
            </select>
            <select class="form-select">
              <option>Delete files</option>
              <option>Archive files</option>
              <option>Generate report</option>
              <option>Send notification</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="form-button">Create Rule</button>
            <button class="cancel-button" @click="isCreatingRule = false">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div class="automation-insights">
        <h3>AI-Powered Automation Suggestions</h3>
        <div class="insights-list">
          <div class="insight-card">
            <h4>Smart Cleanup</h4>
            <p>
              Based on your file patterns, we recommend setting up automated cleanup for temporary
              files every 3 days.
            </p>
            <button class="insight-button">Setup Now</button>
          </div>
          <div class="insight-card">
            <h4>Duplicate Prevention</h4>
            <p>Implement automated duplicate detection to prevent storage waste.</p>
            <button class="insight-button">Configure</button>
          </div>
          <div class="insight-card">
            <h4>Archive Strategy</h4>
            <p>Set up automatic archiving for files older than 6 months to optimize storage.</p>
            <button class="insight-button">Setup</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

interface AutomationPageProps {
  analysisData: any;
  isLoading: boolean;
}

const props = defineProps<AutomationPageProps>();

const rules = ref<AutomationRule[]>([
  {
    id: '1',
    name: 'Auto Cleanup Temporary Files',
    description: 'Remove temporary files older than 7 days',
    trigger: 'Daily at 2:00 AM',
    action: 'Delete files matching *.tmp, *.temp, *.cache',
    enabled: true,
    lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    name: 'Duplicate File Detection',
    description: 'Scan for and flag duplicate files',
    trigger: 'Weekly on Sundays',
    action: 'Generate duplicate file report',
    enabled: true,
    lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    name: 'Archive Old Files',
    description: 'Move files older than 1 year to archive',
    trigger: 'Monthly on 1st',
    action: 'Archive files to external storage',
    enabled: false,
    lastRun: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  },
  {
    id: '4',
    name: 'Storage Usage Alert',
    description: 'Alert when storage usage exceeds 80%',
    trigger: 'Real-time monitoring',
    action: 'Send notification and email',
    enabled: true,
    lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 1 * 60 * 60 * 1000),
  },
]);

const isCreatingRule = ref(false);

const storageUsage = computed(() => {
  if (!props.analysisData || !props.analysisData.totalSize) return 0;
  const totalSizeGB = props.analysisData.totalSize / (1024 * 1024 * 1024);
  const usagePercentage = (totalSizeGB / 1000) * 100;
  return usagePercentage;
});

const lastRun = computed(() => {
  return rules.value.reduce(
    (latest, rule) =>
      rule.lastRun && (!latest || rule.lastRun > latest) ? rule.lastRun : latest,
    null as Date | null
  );
});

const nextScheduled = computed(() => {
  return rules.value.reduce(
    (earliest, rule) =>
      rule.nextRun && (!earliest || rule.nextRun < earliest) ? rule.nextRun : earliest,
    null as Date | null
  );
});

const toggleRule = (id: string) => {
  rules.value = rules.value.map((rule) =>
    rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
  );
};

const deleteRule = (id: string) => {
  rules.value = rules.value.filter((rule) => rule.id !== id);
};
</script>

<style scoped>
.content-section {
  @apply p-6;
}

.automation-section {
  @apply space-y-6;
}

.automation-overview {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-6;
}

.status-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4;
}

.status-card {
  @apply bg-slate-700/50 rounded-lg p-4;
}

.status-card h4 {
  @apply text-sm text-gray-400 mb-2;
}

.status-value {
  @apply text-2xl font-bold text-white mb-2;
}

.status-indicator {
  @apply flex items-center gap-2 text-sm;
}

.status-dot {
  @apply w-2 h-2 rounded-full;
}

.rules-list {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-6;
}

.rules-header {
  @apply flex items-center justify-between mb-4;
}

.rules-header h3 {
  @apply text-lg font-semibold text-white;
}

.add-rule-button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
}

.rule-card {
  @apply bg-slate-700/50 rounded-lg p-4 mb-3;
}

.rule-card.enabled {
  @apply border-l-4 border-green-500;
}

.rule-card.disabled {
  @apply border-l-4 border-gray-500 opacity-60;
}

.rule-header {
  @apply flex items-start justify-between mb-3;
}

.rule-info h4 {
  @apply font-medium text-white mb-1;
}

.rule-info p {
  @apply text-sm text-gray-400;
}

.rule-controls {
  @apply flex items-center gap-2;
}

.switch {
  @apply relative inline-block w-12 h-6;
}

.switch input {
  @apply opacity-0 w-0 h-0;
}

.slider {
  @apply absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-slate-600 rounded-full transition-colors;
}

.slider:before {
  @apply absolute content-[''] h-4 w-4 left-1 bottom-1 bg-white rounded-full transition-transform;
}

.switch input:checked + .slider {
  @apply bg-blue-600;
}

.switch input:checked + .slider:before {
  @apply translate-x-6;
}

.delete-button {
  @apply p-2 text-red-400 hover:text-red-300 transition-colors;
}

.rule-details {
  @apply space-y-2 mt-3 pt-3 border-t border-slate-600;
}

.detail-item {
  @apply flex items-center gap-2 text-sm;
}

.detail-label {
  @apply text-gray-400;
}

.detail-value {
  @apply text-white;
}

.create-rule-form {
  @apply bg-slate-700/50 rounded-lg p-4 mt-4;
}

.create-rule-form h4 {
  @apply font-medium text-white mb-4;
}

.form-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-3 mb-4;
}

.form-input,
.form-select {
  @apply px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500;
}

.form-actions {
  @apply flex gap-2;
}

.form-button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
}

.cancel-button {
  @apply px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors;
}

.automation-insights {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-6;
}

.automation-insights h3 {
  @apply text-lg font-semibold text-white mb-4;
}

.insights-list {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4;
}

.insight-card {
  @apply bg-slate-700/50 rounded-lg p-4;
}

.insight-card h4 {
  @apply font-medium text-white mb-2;
}

.insight-card p {
  @apply text-sm text-gray-400 mb-3;
}

.insight-button {
  @apply px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors;
}
</style>
