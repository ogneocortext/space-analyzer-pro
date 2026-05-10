<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";

// Icon components using simple SVG
const AlertTriangle = {
  template: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
};

const Download = {
  template: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
};

const Trash2 = {
  template: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
};

const Search = {
  template: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
};

const Filter = {
  template: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>`,
};

const RefreshCw = {
  template: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`,
};

import { useErrorLogs } from "../../composables/useErrorLogs";
import { useDebugLogger } from "@/services/DebugLogger";

const logger = useDebugLogger("ErrorLogView");

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

const {
  errors,
  stats,
  loading,
  error,
  fetchErrors,
  fetchStats,
  clearErrors,
  deleteErrors,
  isTauri,
} = useErrorLogs();

const selectedError = ref<ErrorEntry | null>(null);
const showDetails = ref(false);
const filterSource = ref<string>("all");
const filterType = ref<string>("all");
const searchTerm = ref<string>("");
const expandedStacks = ref<Set<string>>(new Set());
const autoRefresh = ref<boolean>(false);
const refreshInterval = ref<number | null>(null);
const currentPage = ref<number>(1);
const itemsPerPage = ref<number>(20);

const sources = computed(() => {
  const unique = new Set(errors.value.map((e) => e.source || "unknown"));
  return ["all", ...Array.from(unique)];
});

const filteredErrors = computed(() => {
  let filtered = errors.value;

  if (filterSource.value !== "all") {
    filtered = filtered.filter((e) => e.source === filterSource.value);
  }

  if (filterType.value !== "all") {
    filtered = filtered.filter((e) => e.type === filterType.value);
  }

  if (searchTerm.value.trim()) {
    const searchLower = searchTerm.value.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.message.toLowerCase().includes(searchLower) ||
        (e.component && e.component.toLowerCase().includes(searchLower)) ||
        (e.url && e.url.toLowerCase().includes(searchLower))
    );
  }

  return filtered;
});

const paginatedErrors = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredErrors.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredErrors.value.length / itemsPerPage.value);
});

const errorStats = computed(() => {
  const stats = {
    total: errors.value.length,
    critical: errors.value.filter(
      (e) =>
        e.type === "uncaughtException" ||
        e.type === "unhandledRejection" ||
        (e.statusCode && e.statusCode >= 500)
    ).length,
    recent: errors.value.filter((e) => {
      const errorTime = new Date(e.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return errorTime > oneHourAgo;
    }).length,
  };
  return stats;
});

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case "frontend":
      return "🌐";
    case "backend":
      return "🖥️";
    case "unhandledRejection":
      return "⚠️";
    case "uncaughtException":
      return "🚨";
    default:
      return "📄";
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
    err.type === "uncaughtException" ||
    err.type === "unhandledRejection" ||
    (err.statusCode && err.statusCode >= 500)
  );
};

const getSeverityColor = (err: ErrorEntry) => {
  if (isCritical(err)) return "text-red-400 bg-red-900/20 border-red-800/30";
  if (err.statusCode && err.statusCode >= 400)
    return "text-yellow-400 bg-yellow-900/20 border-yellow-800/30";
  return "text-blue-400 bg-blue-900/20 border-blue-800/30";
};

const toggleStack = (id: string) => {
  if (expandedStacks.value.has(id)) {
    expandedStacks.value.delete(id);
  } else {
    expandedStacks.value.add(id);
  }
};

const viewDetails = (err: ErrorEntry) => {
  selectedError.value = err;
  showDetails.value = true;
};

const exportErrors = async () => {
  try {
    const errorsText = JSON.stringify(errors.value, null, 2);
    const blob = new Blob([errorsText], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export errors:", error);
  }
};

const clearAllErrors = async () => {
  if (confirm("Are you sure you want to clear all errors? This action cannot be undone.")) {
    try {
      await clearErrors();
      await fetchErrors();
    } catch (error) {
      console.error("Failed to clear errors:", error);
    }
  }
};

const refreshErrors = async () => {
  await fetchErrors();
  await fetchStats();
};

onMounted(() => {
  fetchErrors();
  fetchStats();
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});
</script>

<template>
  <div class="page-container">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <div class="flex items-center space-x-4">
          <div class="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <AlertTriangle />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-white">Error Management</h1>
            <p class="text-sm text-slate-400">Monitor and analyze application errors</p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <!-- Search -->
          <div class="search-container">
            <Search class="search-icon" />
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Search errors..."
              class="search-input"
            />
          </div>

          <!-- Actions -->
          <button class="btn btn-ghost" title="Refresh" @click="refreshErrors">
            <RefreshCw />
          </button>

          <button class="btn btn-ghost" title="Export" @click="exportErrors">
            <Download />
          </button>

          <button class="btn btn-danger" title="Clear All" @click="clearAllErrors">
            <Trash2 />
          </button>
        </div>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class="p-4 bg-surface border-b border-primary">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted">Total Errors</p>
              <p class="text-2xl font-bold text-primary">
                {{ errorStats.total }}
              </p>
            </div>
            <div class="p-2 bg-blue-500/10 rounded-lg">
              <span class="text-xl">📊</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted">Critical</p>
              <p class="text-2xl font-bold text-error">
                {{ errorStats.critical }}
              </p>
            </div>
            <div class="p-2 bg-red-500/10 rounded-lg">
              <span class="text-xl">🚨</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted">Recent (1h)</p>
              <p class="text-2xl font-bold text-warning">
                {{ errorStats.recent }}
              </p>
            </div>
            <div class="p-2 bg-yellow-500/10 rounded-lg">
              <span class="text-xl">⏰</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted">Status</p>
              <p
                class="text-2xl font-bold"
                :class="errorStats.critical > 0 ? 'text-error' : 'text-success'"
              >
                {{ errorStats.critical > 0 ? "Critical" : "Healthy" }}
              </p>
            </div>
            <div
              class="p-2 rounded-lg"
              :class="errorStats.critical > 0 ? 'bg-red-500/10' : 'bg-green-500/10'"
            >
              <span class="text-xl">{{ errorStats.critical > 0 ? "⚠️" : "✅" }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="p-4 bg-surface border-b border-primary">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center space-x-2">
          <Filter class="w-4 h-4 text-muted" />
          <span class="text-sm text-muted">Filters:</span>
        </div>

        <select v-model="filterSource" class="form-select" style="width: auto">
          <option value="all">All Sources</option>
          <option v-for="source in sources" :key="source" :value="source">
            {{ source }}
          </option>
        </select>

        <select v-model="filterType" class="form-select" style="width: auto">
          <option value="all">All Types</option>
          <option v-for="type in ['error', 'warning', 'info']" :key="type" :value="type">
            {{ type }}
          </option>
        </select>

        <div class="text-sm text-muted">
          {{ filteredErrors.length }} of {{ errors.length }} errors
        </div>
      </div>
    </div>

    <!-- Error List -->
    <div class="p-4">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="loading-spinner loading-spinner-lg" />
      </div>

      <div v-else-if="filteredErrors.length === 0" class="text-center py-12">
        <div class="text-6xl mb-4">🎉</div>
        <h3 class="text-lg font-medium text-primary mb-2">No errors found</h3>
        <p class="text-muted">Your application is running smoothly!</p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div v-for="error in paginatedErrors" :key="error.id" class="card animate-fade-in">
          <div class="p-4">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center space-x-3 mb-2">
                  <span class="text-lg">{{ getSourceIcon(error.source) }}</span>
                  <span class="badge" :class="isCritical(error) ? 'badge-error' : 'badge-warning'">
                    {{ error.type || "Error" }}
                  </span>
                  <span class="text-sm text-muted">{{ error.source }}</span>
                  <span v-if="error.statusCode" class="text-sm text-muted">
                    {{ error.statusCode }}
                  </span>
                </div>

                <h3 class="text-primary font-medium mb-2">
                  {{ error.message }}
                </h3>

                <div class="flex items-center space-x-4 text-sm text-muted">
                  <span>{{ formatDate(error.timestamp) }}</span>
                  <span v-if="error.component">Component: {{ error.component }}</span>
                  <span v-if="error.url">{{ error.url }}</span>
                </div>
              </div>

              <div class="flex items-center space-x-2 ml-4">
                <button class="btn btn-ghost btn-sm" @click="viewDetails(error)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>

                <button
                  v-if="error.stack"
                  class="btn btn-ghost btn-sm"
                  @click="toggleStack(error.id)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Stack Trace -->
            <div
              v-if="error.stack && expandedStacks.has(error.id)"
              class="mt-4 p-3 bg-surface border border-primary rounded-lg"
            >
              <pre class="text-sm text-secondary whitespace-pre-wrap font-mono">{{
                error.stack
              }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <div class="text-sm text-muted">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to
          {{ Math.min(currentPage * itemsPerPage, filteredErrors.length) }} of
          {{ filteredErrors.length }} errors
        </div>

        <div class="flex items-center space-x-2">
          <button :disabled="currentPage === 1" class="pagination-btn" @click="currentPage--">
            Previous
          </button>

          <span class="px-3 py-1 text-sm text-muted">
            Page {{ currentPage }} of {{ totalPages }}
          </span>

          <button
            :disabled="currentPage === totalPages"
            class="pagination-btn"
            @click="currentPage++"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Error Details Modal -->
    <div v-if="showDetails && selectedError" class="modal-overlay" @click="showDetails = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Error Details</h2>
          <button class="btn btn-ghost btn-sm" @click="showDetails = false">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="flex flex-col gap-4">
            <div>
              <h3 class="text-sm font-medium text-muted mb-1">Message</h3>
              <p class="text-primary">
                {{ selectedError.message }}
              </p>
            </div>

            <div>
              <h3 class="text-sm font-medium text-muted mb-1">Type</h3>
              <p class="text-primary">
                {{ selectedError.type }}
              </p>
            </div>

            <div>
              <h3 class="text-sm font-medium text-muted mb-1">Source</h3>
              <p class="text-primary">
                {{ selectedError.source }}
              </p>
            </div>

            <div>
              <h3 class="text-sm font-medium text-muted mb-1">Timestamp</h3>
              <p class="text-primary">
                {{ formatDate(selectedError.timestamp) }}
              </p>
            </div>

            <div v-if="selectedError.component">
              <h3 class="text-sm font-medium text-muted mb-1">Component</h3>
              <p class="text-primary">
                {{ selectedError.component }}
              </p>
            </div>

            <div v-if="selectedError.url">
              <h3 class="text-sm font-medium text-muted mb-1">URL</h3>
              <p class="text-primary text-sm break-all">
                {{ selectedError.url }}
              </p>
            </div>

            <div v-if="selectedError.stack">
              <h3 class="text-sm font-medium text-muted mb-1">Stack Trace</h3>
              <pre
                class="bg-surface p-3 rounded-lg text-sm text-secondary whitespace-pre-wrap font-mono"
                >{{ selectedError.stack }}</pre
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-log-view {
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;
}

/* Custom scrollbar */
.error-log-view ::-webkit-scrollbar {
  width: 8px;
}

.error-log-view ::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

.error-log-view ::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 4px;
}

.error-log-view ::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.7);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-log-view > div {
  animation: fadeIn 0.3s ease-out;
}
</style>
