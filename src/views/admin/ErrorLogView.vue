<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  AlertTriangle,
  RefreshCw,
  Download,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCode,
  Globe,
  Server,
} from "lucide-vue-next";
import { Card, Button } from "../../design-system/components";

interface ErrorEntry {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  source: "frontend" | "backend" | "unhandledRejection" | "uncaughtException" | string;
  url?: string;
  method?: string;
  component?: string;
  action?: string;
  code?: string;
  userAgent?: string;
  ip?: string;
  statusCode?: number;
}

interface ErrorStats {
  total: number;
  critical: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byDay: Record<string, number>;
}

const errors = ref<ErrorEntry[]>([]);
const stats = ref<ErrorStats | null>(null);
const loading = ref(false);
const error = ref("");
const selectedError = ref<ErrorEntry | null>(null);
const showDetails = ref(false);
const filterSource = ref<string>("all");
const expandedStacks = ref<Set<string>>(new Set());

const sources = computed(() => {
  const unique = new Set(errors.value.map((e) => e.source || "unknown"));
  return ["all", ...Array.from(unique)];
});

const filteredErrors = computed(() => {
  if (filterSource.value === "all") return errors.value;
  return errors.value.filter((e) => e.source === filterSource.value);
});

const criticalErrors = computed(() => {
  return errors.value.filter(
    (e) =>
      e.source === "uncaughtException" ||
      e.type?.includes("Fatal") ||
      e.message?.includes("database") ||
      e.message?.includes("connection")
  );
});

const fetchErrors = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await fetch("/api/errors/recent?limit=100");

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
    }

    const data = await response.json();

    if (data.success) {
      errors.value = data.errors;
    } else {
      throw new Error(data.error || "Failed to fetch errors");
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load errors";
    console.error("Failed to fetch errors:", err);
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const response = await fetch("/api/errors/stats?days=7");

    if (!response.ok) {
      console.warn("Failed to fetch stats:", response.status);
      return;
    }

    const data = await response.json();

    if (data.success) {
      stats.value = data.stats;
    }
  } catch (err) {
    console.error("Failed to fetch stats:", err);
  }
};

const exportErrors = async () => {
  try {
    const response = await fetch("/api/errors/export?limit=1000");
    const blob = await response.blob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Failed to export errors");
  }
};

const clearErrors = async () => {
  if (!confirm("Are you sure you want to clear all error logs?")) return;

  try {
    const response = await fetch("/api/errors/clear", { method: "DELETE" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      errors.value = [];
      stats.value = null;
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    alert("Failed to clear errors: " + (err instanceof Error ? err.message : "Unknown error"));
  }
};

const viewDetails = (err: ErrorEntry) => {
  selectedError.value = err;
  showDetails.value = true;
};

const toggleStack = (id: string) => {
  if (expandedStacks.value.has(id)) {
    expandedStacks.value.delete(id);
  } else {
    expandedStacks.value.add(id);
  }
};

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case "frontend":
      return Globe;
    case "backend":
      return Server;
    case "unhandledRejection":
      return AlertTriangle;
    case "uncaughtException":
      return AlertTriangle;
    default:
      return FileCode;
  }
};

const getSourceColor = (source: string) => {
  switch (source) {
    case "frontend":
      return "text-blue-400";
    case "backend":
      return "text-green-400";
    case "unhandledRejection":
      return "text-yellow-400";
    case "uncaughtException":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
};

const isCritical = (err: ErrorEntry) => {
  return (
    err.source === "uncaughtException" ||
    err.type?.includes("Fatal") ||
    err.message?.includes("database") ||
    err.message?.includes("connection")
  );
};

onMounted(() => {
  fetchErrors();
  fetchStats();
});
</script>

<template>
  <div class="error-log-view">
    <div class="header">
      <div class="flex items-center gap-3">
        <AlertTriangle class="w-6 h-6 text-red-400" />
        <div>
          <h1 class="text-2xl font-bold text-slate-100">Error Logs</h1>
          <p class="text-slate-400">View and manage application errors</p>
        </div>
      </div>

      <div class="header-actions">
        <select v-model="filterSource" class="source-filter">
          <option value="all">All Sources</option>
          <option
            v-for="source in sources.filter((s) => s !== 'all')"
            :key="source"
            :value="source"
          >
            {{ source }}
          </option>
        </select>

        <Button @click="fetchErrors" :disabled="loading" variant="secondary">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
          Refresh
        </Button>

        <Button @click="exportErrors" variant="secondary">
          <Download class="w-4 h-4" />
          Export
        </Button>

        <Button @click="clearErrors" variant="danger">
          <Trash2 class="w-4 h-4" />
          Clear All
        </Button>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="stats" class="stats-grid">
      <Card class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Errors (7 days)</div>
      </Card>

      <Card class="stat-card critical" v-if="stats.critical > 0">
        <div class="stat-value text-red-400">{{ stats.critical }}</div>
        <div class="stat-label">Critical Errors</div>
      </Card>

      <Card class="stat-card">
        <div class="stat-value">{{ Object.keys(stats.byType).length }}</div>
        <div class="stat-label">Error Types</div>
      </Card>

      <Card class="stat-card">
        <div class="stat-value">{{ Object.keys(stats.bySource).length }}</div>
        <div class="stat-label">Sources</div>
      </Card>
    </div>

    <!-- Error List -->
    <div class="error-list">
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-else-if="filteredErrors.length === 0" class="empty-state">
        <p class="text-slate-400">No errors found</p>
      </div>

      <Card
        v-for="err in filteredErrors"
        :key="err.id"
        class="error-card"
        :class="{ critical: isCritical(err) }"
        @click="viewDetails(err)"
      >
        <div class="error-header">
          <div class="error-type-section">
            <component
              :is="getSourceIcon(err.source)"
              class="w-4 h-4"
              :class="getSourceColor(err.source)"
            />
            <span class="error-type">{{ err.type }}</span>
            <span v-if="isCritical(err)" class="critical-badge">CRITICAL</span>
          </div>

          <div class="error-meta">
            <Clock class="w-3 h-3" />
            {{ formatDate(err.timestamp) }}
          </div>
        </div>

        <div class="error-message-text">
          {{ err.message }}
        </div>

        <div v-if="err.component || err.url" class="error-context">
          <span v-if="err.component" class="context-tag"> Component: {{ err.component }} </span>
          <span v-if="err.url" class="context-tag">
            {{ err.url }}
          </span>
          <span v-if="err.method" class="context-tag">
            {{ err.method }}
          </span>
        </div>

        <div v-if="err.stack" class="stack-section">
          <button @click.stop="toggleStack(err.id)" class="stack-toggle">
            <component
              :is="expandedStacks.has(err.id) ? ChevronDown : ChevronRight"
              class="w-4 h-4"
            />
            Stack Trace
          </button>

          <pre v-if="expandedStacks.has(err.id)" class="stack-trace">{{ err.stack }}</pre>
        </div>
      </Card>
    </div>

    <!-- Error Details Modal -->
    <div v-if="showDetails && selectedError" class="modal-overlay" @click="showDetails = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Error Details</h2>
          <Button @click="showDetails = false" variant="ghost" size="sm">
            <X class="w-4 h-4" />
          </Button>
        </div>

        <div class="modal-body">
          <div class="detail-section">
            <h3>Basic Information</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">ID:</span>
                <span class="detail-value">{{ selectedError.id }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Type:</span>
                <span class="detail-value">{{ selectedError.type }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Source:</span>
                <span class="detail-value">{{ selectedError.source }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Time:</span>
                <span class="detail-value">{{ formatDate(selectedError.timestamp) }}</span>
              </div>
              <div v-if="selectedError.component" class="detail-item">
                <span class="detail-label">Component:</span>
                <span class="detail-value">{{ selectedError.component }}</span>
              </div>
              <div v-if="selectedError.url" class="detail-item">
                <span class="detail-label">URL:</span>
                <span class="detail-value">{{ selectedError.url }}</span>
              </div>
              <div v-if="selectedError.method" class="detail-item">
                <span class="detail-label">Method:</span>
                <span class="detail-value">{{ selectedError.method }}</span>
              </div>
              <div v-if="selectedError.statusCode" class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value">{{ selectedError.statusCode }}</span>
              </div>
              <div v-if="selectedError.ip" class="detail-item">
                <span class="detail-label">IP:</span>
                <span class="detail-value">{{ selectedError.ip }}</span>
              </div>
              <div v-if="selectedError.userAgent" class="detail-item">
                <span class="detail-label">User Agent:</span>
                <span class="detail-value text-xs">{{ selectedError.userAgent }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>Message</h3>
            <div class="message-box">{{ selectedError.message }}</div>
          </div>

          <div v-if="selectedError.stack" class="detail-section">
            <h3>Stack Trace</h3>
            <pre class="stack-trace-full">{{ selectedError.stack }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-log-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.source-filter {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  text-align: center;
  padding: 1.5rem;
}

.stat-card.critical {
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
}

.stat-value {
  font-size: 2rem;
  font-weight: 600;
  color: #f8fafc;
}

.stat-label {
  color: #94a3b8;
  font-size: 0.875rem;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-card {
  cursor: pointer;
  transition: all 0.2s;
}

.error-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.error-card.critical {
  border-left: 3px solid #ef4444;
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.error-type-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-type {
  font-weight: 500;
  color: #f8fafc;
}

.critical-badge {
  background: #ef4444;
  color: white;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  font-weight: 600;
}

.error-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #64748b;
  font-size: 0.75rem;
}

.error-message-text {
  color: #e2e8f0;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  word-break: break-word;
}

.error-context {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.context-tag {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.stack-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.stack-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #64748b;
  font-size: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
}

.stack-toggle:hover {
  color: #94a3b8;
}

.stack-trace {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #0f172a;
  border-radius: 0.375rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #94a3b8;
  overflow-x: auto;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 3rem;
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 1rem;
  border-radius: 0.5rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #334155;
}

.modal-header h2 {
  margin: 0;
  color: #f8fafc;
}

.modal-body {
  padding: 1.5rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h3 {
  margin: 0 0 1rem 0;
  color: #f8fafc;
  font-size: 1rem;
}

.detail-grid {
  display: grid;
  gap: 0.75rem;
}

.detail-item {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 1rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.375rem;
}

.detail-label {
  color: #64748b;
  font-weight: 500;
}

.detail-value {
  color: #e2e8f0;
  word-break: break-all;
}

.message-box {
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.375rem;
  color: #fca5a5;
  font-family: monospace;
  white-space: pre-wrap;
}

.stack-trace-full {
  padding: 1rem;
  background: #0f172a;
  border-radius: 0.375rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #94a3b8;
  overflow-x: auto;
  white-space: pre;
  max-height: 400px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .error-log-view {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .detail-item {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .modal-content {
    width: 95%;
    margin: 1rem;
  }
}
</style>
