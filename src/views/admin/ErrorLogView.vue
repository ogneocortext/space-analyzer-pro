<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";

// Simple icon components using text/emoji to avoid TypeScript issues
const createIcon = (emoji: string) => ({
  name: `Icon${emoji}`,
  template: `<span class="icon-placeholder">${emoji}</span>`,
});

const AlertTriangle = createIcon("⚠️");
const Download = createIcon("📥");
const Trash2 = createIcon("🗑️");
const X = createIcon("❌");
const ChevronDown = createIcon("▼");
const ChevronRight = createIcon("▶");
const ChevronLeft = createIcon("◀");
const Clock = createIcon("🕐");
const FileCode = createIcon("📄");
const Globe = createIcon("🌐");
const Server = createIcon("🖥️");
const Filter = createIcon("🔍");
const Search = createIcon("🔎");
const BarChart3 = createIcon("📊");
const PieChart = createIcon("🥧");
const Bell = createIcon("🔔");
const BellOff = createIcon("🔕");
const RotateCcw = createIcon("🔄");
const Activity = createIcon("📈");
const Zap = createIcon("⚡");
const TrendingUp = createIcon("📈");
const Database = createIcon("🗄️");

import { Card, Button } from "../../design-system/components";
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

interface ErrorStats {
  total: number;
  critical: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byDay: Record<string, number>;
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
const filterSeverity = ref<string>("all");
const searchTerm = ref<string>("");
const expandedStacks = ref<Set<string>>(new Set());
const autoRefresh = ref<boolean>(false);
const refreshInterval = ref<number | null>(null);
const showRealTime = ref<boolean>(true);
const newErrorCount = ref<number>(0);
const lastErrorCount = ref<number>(0);
const showAdvancedFilters = ref<boolean>(false);
const selectedTimeRange = ref<string>("24h");
const currentPage = ref<number>(1);
const itemsPerPage = ref<number>(20);
const showNotifications = ref<boolean>(true);
const darkMode = ref<boolean>(true);
const errorTrends = ref<any[]>([]);
const showCharts = ref<boolean>(true);
const selectedErrors = ref<Set<string>>(new Set());
const bulkActions = ref<boolean>(false);
const errorCategories = ref<string[]>(["Critical", "Warning", "Info", "Debug"]);
const activeCategories = ref<string[]>(["Critical", "Warning", "Info", "Debug"]);
const performanceMetrics = ref<any>(null);
const systemHealth = ref<any>(null);

const sources = computed(() => {
  const unique = new Set(errors.value.map((e) => e.source || "unknown"));
  return ["all", ...Array.from(unique)];
});

const filteredErrors = computed(() => {
  let filtered = errors.value;

  // Filter by source
  if (filterSource.value !== "all") {
    filtered = filtered.filter((e) => e.source === filterSource.value);
  }

  // Filter by type
  if (filterType.value !== "all") {
    filtered = filtered.filter((e) => e.type === filterType.value);
  }

  // Filter by category
  if (
    activeCategories.value.length > 0 &&
    activeCategories.value.length < errorCategories.value.length
  ) {
    filtered = filtered.filter((e) => {
      // Map error types to categories
      let category = "Info";
      if (e.type === "uncaughtException" || e.type === "unhandledRejection") {
        category = "Critical";
      } else if (e.type === "error" || (e.statusCode && e.statusCode >= 400)) {
        category = "Warning";
      } else if (e.type === "debug") {
        category = "Debug";
      }
      return activeCategories.value.includes(category);
    });
  }

  // Filter by severity (critical vs regular errors)
  if (filterSeverity.value !== "all") {
    if (filterSeverity.value === "critical") {
      filtered = filtered.filter(
        (e) =>
          e.type === "uncaughtException" ||
          e.type === "unhandledRejection" ||
          (e.statusCode && e.statusCode >= 500)
      );
    } else if (filterSeverity.value === "regular") {
      filtered = filtered.filter(
        (e) =>
          e.type !== "uncaughtException" &&
          e.type !== "unhandledRejection" &&
          (!e.statusCode || e.statusCode < 500)
      );
    }
  }

  // Filter by search term
  if (searchTerm.value.trim()) {
    const searchLower = searchTerm.value.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.message.toLowerCase().includes(searchLower) ||
        (e.component && e.component.toLowerCase().includes(searchLower)) ||
        (e.action && e.action.toLowerCase().includes(searchLower)) ||
        (e.url && e.url.toLowerCase().includes(searchLower))
    );
  }

  return filtered;
});

const errorTypes = computed(() => {
  const unique = new Set(errors.value.map((e) => e.type || "unknown"));
  return ["all", ...Array.from(unique).sort()];
});

const criticalErrors = computed(() => {
  return errors.value.filter(
    (e) =>
      e.type === "uncaughtException" ||
      e.type === "unhandledRejection" ||
      (e.statusCode && e.statusCode >= 500)
  );
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
    critical: criticalErrors.value.length,
    recent: errors.value.filter((e) => {
      const errorTime = new Date(e.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return errorTime > oneHourAgo;
    }).length,
    trending: errorTrends.value.length,
  };
  return stats;
});

const errorSeverityDistribution = computed(() => {
  const distribution = {
    critical: 0,
    warning: 0,
    info: 0,
    debug: 0,
  };

  errors.value.forEach((error) => {
    if (error.type === "uncaughtException" || error.type === "unhandledRejection") {
      distribution.critical++;
    } else if (error.statusCode && error.statusCode >= 500) {
      distribution.critical++;
    } else if (error.statusCode && error.statusCode >= 400) {
      distribution.warning++;
    } else {
      distribution.info++;
    }
  });

  return distribution;
});

const hasSelectedErrors = computed(() => selectedErrors.value.size > 0);

// fetchErrors and fetchStats now come from useErrorLogs composable

const exportErrors = async () => {
  try {
    // In Tauri mode, use native commands instead of HTTP API
    if (isTauri()) {
      console.warn("🖥️ Tauri mode detected - using native error export");
      // Dynamically import Tauri API
      const { invoke } = await import("@tauri-apps/api/core");
      const errors = await invoke<Array<any>>("get_error_logs", { limit: 1000 });
      // Create blob from errors data
      const errorText = JSON.stringify(errors, null, 2);
      const blob = new Blob([errorText], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Download the file
      const a = document.createElement("a");
      a.href = url;
      a.download = "error-logs.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

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

const handleClearErrors = async () => {
  if (!confirm("Are you sure you want to clear all error logs?")) return;

  try {
    await clearErrors();
    selectedErrors.value.clear();
  } catch (err) {
    alert("Failed to clear errors: " + (err instanceof Error ? err.message : "Unknown error"));
  }
};

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value;

  if (autoRefresh.value) {
    refreshInterval.value = setInterval(() => {
      fetchErrors();
      fetchStats();
    }, 5000) as unknown as number; // Refresh every 5 seconds
  } else {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value);
      refreshInterval.value = null;
    }
  }
};

const toggleErrorSelection = (errorId: string) => {
  if (selectedErrors.value.has(errorId)) {
    selectedErrors.value.delete(errorId);
  } else {
    selectedErrors.value.add(errorId);
  }
};

const selectAllErrors = () => {
  if (selectedErrors.value.size === paginatedErrors.value.length) {
    selectedErrors.value.clear();
  } else {
    paginatedErrors.value.forEach((error) => {
      selectedErrors.value.add(error.id);
    });
  }
};

const handleBulkDelete = async () => {
  if (selectedErrors.value.size === 0) return;

  if (!confirm(`Are you sure you want to delete ${selectedErrors.value.size} selected errors?`))
    return;

  try {
    await deleteErrors(Array.from(selectedErrors.value));
    selectedErrors.value.clear();
  } catch (err) {
    alert("Failed to delete errors: " + (err instanceof Error ? err.message : "Unknown error"));
  }
};

const handleBulkArchive = async () => {
  if (selectedErrors.value.size === 0) return;

  if (!confirm(`Are you sure you want to archive ${selectedErrors.value.size} selected errors?`))
    return;

  try {
    // In Tauri mode, use native commands
    if (isTauri()) {
      console.warn("🖥️ Tauri mode detected - using native error archive");
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("archive_errors", {
        errorIds: Array.from(selectedErrors.value),
      });
    } else {
      const response = await fetch("/api/errors/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorIds: Array.from(selectedErrors.value) }),
      });

      if (!response.ok) {
        throw new Error(`Archive failed: ${response.statusText}`);
      }
    }

    selectedErrors.value.clear();
    logger.info(`Archived ${selectedErrors.value.size} errors`);
  } catch (err) {
    logger.error("Failed to archive errors", { error: err });
    alert("Failed to archive errors: " + (err instanceof Error ? err.message : "Unknown error"));
  }
};

const handleBulkResolve = async () => {
  if (selectedErrors.value.size === 0) return;

  if (
    !confirm(
      `Are you sure you want to mark ${selectedErrors.value.size} selected errors as resolved?`
    )
  )
    return;

  try {
    // In Tauri mode, use native commands
    if (isTauri()) {
      console.warn("🖥️ Tauri mode detected - using native error resolve");
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("resolve_errors", {
        errorIds: Array.from(selectedErrors.value),
      });
    } else {
      const response = await fetch("/api/errors/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorIds: Array.from(selectedErrors.value) }),
      });

      if (!response.ok) {
        throw new Error(`Resolve failed: ${response.statusText}`);
      }
    }

    selectedErrors.value.clear();
    logger.info(`Resolved ${selectedErrors.value.size} errors`);
  } catch (err) {
    logger.error("Failed to resolve errors", { error: err });
    alert("Failed to resolve errors: " + (err instanceof Error ? err.message : "Unknown error"));
  }
};

const copyErrorDetails = (error: ErrorEntry) => {
  const errorText = `Error ID: ${error.id}
Type: ${error.type}
Source: ${error.source}
Timestamp: ${formatDate(error.timestamp)}
Message: ${error.message}
${error.component ? `Component: ${error.component}` : ""}
${error.url ? `URL: ${error.url}` : ""}
${error.stack ? `Stack Trace:\n${error.stack}` : ""}`;

  navigator.clipboard.writeText(errorText).then(() => {
    // Show success notification
    logger.info("Error details copied to clipboard");
  });
};

const fetchErrorTrends = async () => {
  try {
    // In Tauri mode, skip trends fetch
    if (isTauri()) {
      logger.info("Tauri mode detected - skipping error trends fetch");
      return;
    }

    const response = await fetch("/api/errors/trends?days=7");
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        errorTrends.value = data.trends;
      }
    }
  } catch (err) {
    logger.error("Failed to fetch error trends", { error: err });
  }
};

const fetchSystemHealth = async () => {
  try {
    // In Tauri mode, skip system health fetch
    if (isTauri()) {
      logger.info("Tauri mode detected - skipping system health fetch");
      return;
    }

    const response = await fetch("/api/system/health");
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        systemHealth.value = data.health;
      }
    }
  } catch (err) {
    logger.error("Failed to fetch system health", { error: err });
  }
};

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const exportSelectedErrors = async () => {
  if (selectedErrors.value.size === 0) return;

  try {
    const selectedErrorData = errors.value.filter((error) => selectedErrors.value.has(error.id));
    const blob = new Blob([JSON.stringify(selectedErrorData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selected-errors-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Failed to export selected errors");
  }
};

const applyFilters = () => {
  logger.debug("Applying filters", { activeCategories: activeCategories.value });
  // This function will be called by the computed property filteredErrors
  // The actual filtering logic is handled in the computed property
};

const toggleCategoryFilter = (category: string) => {
  logger.debug("Toggle category filter", { category });

  // Toggle category in active filters
  const index = activeCategories.value.indexOf(category);
  if (index > -1) {
    activeCategories.value.splice(index, 1);
  } else {
    activeCategories.value.push(category);
  }

  // Update filtered errors
  applyFilters();
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

const getStatusClass = (statusCode: number) => {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warning";
  if (statusCode >= 300) return "info";
  return "success";
};

onMounted(() => {
  fetchErrors();
  fetchStats();
  // Note: error trends and system health APIs not available in Tauri mode
  if (!isTauri) {
    fetchErrorTrends();
    fetchSystemHealth();
  }
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});
</script>

<template>
  <div
    class="error-log-view"
    :class="{ 'dark-mode': darkMode }"
  >
    <div class="flex h-screen">
      <div class="sidebar w-64 bg-gray-100 p-4">
        <!-- Sidebar content -->
        <div class="header-icon-wrapper">
          <AlertTriangle class="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h1 class="text-3xl font-bold text-white mb-1">
            Error Management Center
          </h1>
          <p class="text-slate-400 text-sm">
            Monitor, analyze, and manage application errors in real-time
          </p>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-content flex-1">
        <!-- Quick Stats Bar -->
        <div class="quick-stats-bar">
          <div
            v-if="errorStats.critical > 0"
            class="quick-stat critical"
          >
            <div class="quick-stat-number">
              {{ errorStats.critical }}
            </div>
            <div class="quick-stat-label">
              Critical
            </div>
          </div>
          <div class="quick-stat recent">
            <div class="quick-stat-number">
              {{ errorStats.recent }}
            </div>
            <div class="quick-stat-label">
              Recent
            </div>
          </div>
          <div class="quick-stat total">
            <div class="quick-stat-number">
              {{ errorStats.total }}
            </div>
            <div class="quick-stat-label">
              Total
            </div>
          </div>
        </div>
      </div>

      <!-- System Health Indicator -->
      <div
        v-if="systemHealth"
        class="health-indicator"
      >
        <div
          class="health-status"
          :class="systemHealth.status"
        >
          <Activity class="w-3 h-3" />
          <span class="health-text">{{ systemHealth.status }}</span>
        </div>
      </div>
    </div>

    <div class="header-actions">
      <!-- Real-time indicator -->
      <div
        v-if="newErrorCount > 0"
        class="new-errors-badge"
      >
        <div class="pulse-dot" />
        <Zap class="w-3 h-3" />
        <span class="badge-text">+{{ newErrorCount }} new</span>
      </div>

      <!-- Enhanced Search -->
      <div class="search-container">
        <Search class="search-icon" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search errors, components, or messages..."
          class="search-input"
        >
        <div
          v-if="searchTerm"
          class="search-clear"
          @click="searchTerm = ''"
        >
          <X class="w-3 h-3" />
        </div>
      </div>

      <!-- Enhanced Filters -->
      <div class="filter-group">
        <select
          v-model="filterSource"
          class="filter-select"
        >
          <option value="all">
            All Sources
          </option>
          <option
            v-for="source in sources.filter((s) => s !== 'all')"
            :key="source"
            :value="source"
          >
            {{ source }}
          </option>
        </select>

        <select
          v-model="filterType"
          class="filter-select"
        >
          <option value="all">
            All Types
          </option>
          <option
            v-for="type in errorTypes.filter((t) => t !== 'all')"
            :key="type"
            :value="type"
          >
            {{ type }}
          </option>
        </select>

        <select
          v-model="filterSeverity"
          class="filter-select"
        >
          <option value="all">
            All Severities
          </option>
          <option value="critical">
            Critical Only
          </option>
          <option value="regular">
            Regular Only
          </option>
        </select>

        <select
          v-model="selectedTimeRange"
          class="filter-select"
        >
          <option value="1h">
            Last Hour
          </option>
          <option value="24h">
            Last 24 Hours
          </option>
          <option value="7d">
            Last 7 Days
          </option>
          <option value="30d">
            Last 30 Days
          </option>
        </select>
      </div>

      <!-- Category Filters -->
      <div class="category-filters">
        <div class="category-filter-label">
          Categories:
        </div>
        <div class="category-buttons">
          <button
            v-for="category in errorCategories"
            :key="category"
            :class="{ 'category-btn': true, active: activeCategories.includes(category) }"
            :variant="activeCategories.includes(category) ? 'primary' : 'secondary'"
            size="sm"
            @click="toggleCategoryFilter(category)"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <Button
          variant="secondary"
          size="sm"
          @click="showAdvancedFilters = !showAdvancedFilters"
        >
          <Filter class="w-4 h-4" />
          Advanced
        </Button>

        <Button
          :variant="autoRefresh ? 'primary' : 'secondary'"
          size="sm"
          @click="toggleAutoRefresh"
        >
          <RotateCcw
            class="w-4 h-4"
            :class="{ 'animate-spin': autoRefresh }"
          />
          {{ autoRefresh ? "Auto" : "Manual" }}
        </Button>

        <Button
          :disabled="loading"
          variant="secondary"
          size="sm"
          @click="() => fetchErrors()"
        >
          <RotateCcw
            class="w-4 h-4"
            :class="{ 'animate-spin': loading }"
          />
          Refresh
        </Button>

        <Button
          variant="secondary"
          size="sm"
          @click="exportErrors"
        >
          <Download class="w-4 h-4" />
          Export
        </Button>

        <Button
          variant="danger"
          size="sm"
          @click="handleClearErrors"
        >
          <Trash2 class="w-4 h-4" />
          Clear
        </Button>
      </div>
    </div>
  </div>

  <!-- Advanced Filters Panel -->
  <div
    v-if="showAdvancedFilters"
    class="advanced-filters"
  >
    <Card>
      <div class="advanced-filters-content">
        <div class="filter-row">
          <label class="filter-label">Time Range:</label>
          <div class="time-range-buttons">
            <Button
              v-for="range in ['1h', '24h', '7d', '30d']"
              :key="range"
              :variant="selectedTimeRange === range ? 'primary' : 'secondary'"
              size="sm"
              @click="selectedTimeRange = range"
            >
              {{
                range === "1h"
                  ? "1 Hour"
                  : range === "24h"
                    ? "24 Hours"
                    : range === "7d"
                      ? "7 Days"
                      : "30 Days"
              }}
            </Button>
          </div>
        </div>

        <div class="filter-row">
          <label class="filter-label">Error Categories:</label>
          <div class="category-filters">
            <Button
              v-for="category in errorCategories"
              :key="category"
              variant="secondary"
              size="sm"
              @click="toggleCategoryFilter(category)"
            >
              {{ category }}
            </Button>
          </div>
        </div>

        <div class="filter-row">
          <label class="filter-label">Items per page:</label>
          <select
            v-model="itemsPerPage"
            class="filter-select"
          >
            <option value="10">
              10
            </option>
            <option value="20">
              20
            </option>
            <option value="50">
              50
            </option>
            <option value="100">
              100
            </option>
          </select>
        </div>
      </div>
    </Card>
  </div>

  <!-- Main Content Area -->
  <div class="main-content">
    <!-- Stats -->
    <div
      v-if="stats"
      class="stats-grid"
    >
      <Card class="stat-card">
        <div class="stat-value">
          {{ stats.total }}
        </div>
        <div class="stat-label">
          Total Errors (7 days)
        </div>
      </Card>

      <Card
        v-if="stats.critical > 0"
        class="stat-card critical"
      >
        <div class="stat-value text-red-400">
          {{ stats.critical }}
        </div>
        <div class="stat-label">
          Critical Errors
        </div>
      </Card>

      <Card class="stat-card">
        <div class="stat-value">
          {{ Object.keys(stats.byType).length }}
        </div>
        <div class="stat-label">
          Error Types
        </div>
      </Card>

      <Card class="stat-card">
        <div class="stat-value">
          {{ Object.keys(stats.bySource).length }}
        </div>
        <div class="stat-label">
          Sources
        </div>
      </Card>
      <Button
        variant="secondary"
        size="sm"
        @click="toggleSelectAll"
      >
        {{ selectedErrors.size === paginatedErrors.length ? "Deselect All" : "Select All" }}
      </Button>
    </div>
    <div class="bulk-actions-right">
      <Button
        variant="secondary"
        size="sm"
        @click="exportSelectedErrors"
      >
        <Download class="w-4 h-4" />
        Export Selected
      </Button>
      <Button
        variant="secondary"
        size="sm"
        @click="handleBulkArchive"
      >
        <Database class="w-4 h-4" />
        Archive Selected
      </Button>
      <Button
        variant="primary"
        size="sm"
        @click="handleBulkResolve"
      >
        <CheckCircle class="w-4 h-4" />
        Resolve Selected
      </Button>
      <Button
        variant="danger"
        size="sm"
        @click="handleBulkDelete"
      >
        <Trash2 class="w-4 h-4" />
        Delete Selected
      </Button>
    </div>
  </div>

  <!-- Error Message -->
  <div
    v-if="error"
    class="error-message"
  >
    <AlertCircle class="w-4 h-4" />
    {{ error }}
  </div>

  <!-- Empty State -->
  <div
    v-else-if="paginatedErrors.length === 0"
    class="empty-state"
  >
    <div class="empty-state-content">
      <CheckCircle class="w-12 h-12 text-green-400" />
      <h3>No errors found</h3>
      <p>
        {{ searchTerm ? "No errors match your search criteria" : "No errors have been logged" }}
      </p>
      <Button
        v-if="searchTerm"
        variant="secondary"
        @click="searchTerm = ''"
      >
        Clear Search
      </Button>
    </div>
  </div>

  <!-- Enhanced Error Cards -->
  <Card
    v-for="err in paginatedErrors"
    :key="err.id"
    class="error-card"
    :class="{
      critical: isCritical(err),
      selected: selectedErrors.has(err.id),
    }"
    @click="viewDetails(err)"
  >
    <!-- Error Header with Selection -->
    <div class="error-header">
      <div class="error-left">
        <div
          class="error-checkbox"
          @click.stop="toggleErrorSelection(err.id)"
        >
          <input
            type="checkbox"
            :checked="selectedErrors.has(err.id)"
            @click.stop="toggleErrorSelection(err.id)"
          >
        </div>
        <div class="error-type-section">
          <component
            :is="getSourceIcon(err.source)"
            class="w-4 h-4"
            :class="getSourceColor(err.source)"
          />
          <span class="error-type">{{ err.type }}</span>
          <span
            v-if="isCritical(err)"
            class="critical-badge"
          >
            <AlertTriangle class="w-3 h-3" />
            CRITICAL
          </span>
        </div>
      </div>

      <div class="error-right">
        <div class="error-meta">
          <Clock class="w-3 h-3" />
          {{ formatDate(err.timestamp) }}
        </div>
        <div
          class="error-actions"
          @click.stop
        >
          <Button
            variant="ghost"
            size="sm"
            @click="copyErrorDetails(err)"
          >
            <Copy class="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            @click="viewDetails(err)"
          >
            <Eye class="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div class="error-message-text">
      {{ err.message }}
    </div>

    <!-- Error Context -->
    <div
      v-if="err.component || err.url"
      class="error-context"
    >
      <span
        v-if="err.component"
        class="context-tag component"
      >
        <Bug class="w-3 h-3" />
        {{ err.component }}
      </span>
      <span
        v-if="err.url"
        class="context-tag url"
      >
        <Globe class="w-4 h-4" />
        {{ err.url }}
      </span>
      <span
        v-if="err.method"
        class="context-tag method"
      >
        {{ err.method }}
      </span>
      <span
        v-if="err.statusCode"
        class="context-tag status"
        :class="getStatusClass(err.statusCode)"
      >
        {{ err.statusCode }}
      </span>
    </div>

    <!-- Stack Trace Section -->
    <div
      v-if="err.stack"
      class="stack-section"
    >
      <button
        class="stack-toggle"
        @click.stop="toggleStack(err.id)"
      >
        <component
          :is="expandedStacks.has(err.id) ? ChevronDown : ChevronRight"
          class="w-4 h-4"
        />
        {{ expandedStacks.has(err.id) ? "Hide" : "Show" }} Stack Trace
      </button>

      <pre
        v-if="expandedStacks.has(err.id)"
        class="stack-trace"
      >{{ err.stack }}</pre>
    </div>
  </Card>

  <!-- Pagination -->
  <div
    v-if="totalPages > 1"
    class="pagination"
  >
    <div class="pagination-info">
      Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{
        Math.min(currentPage * itemsPerPage, filteredErrors.length)
      }}
      of {{ filteredErrors.length }} errors
    </div>
    <div class="pagination-controls">
      <Button
        :disabled="currentPage === 1"
        variant="secondary"
        size="sm"
        @click="changePage(currentPage - 1)"
      >
        <ChevronLeft class="w-4 h-4" />
        Previous
      </Button>

      <div class="page-numbers">
        <Button
          v-for="page in Math.min(5, totalPages)"
          :key="page"
          :variant="page === currentPage ? 'primary' : 'secondary'"
          size="sm"
          @click="changePage(page)"
        >
          {{ page }}
        </Button>
        <span
          v-if="totalPages > 5"
          class="page-ellipsis"
        >...</span>
        <Button
          v-if="totalPages > 5"
          :variant="totalPages === currentPage ? 'primary' : 'secondary'"
          size="sm"
          @click="changePage(totalPages)"
        >
          {{ totalPages }}
        </Button>
      </div>

      <Button
        :disabled="currentPage === totalPages"
        variant="secondary"
        size="sm"
        @click="changePage(currentPage + 1)"
      >
        Next
        <ChevronRight class="w-4 h-4" />
      </Button>
    </div>
  </div>

  <!-- Error Details Modal -->
  <div
    v-if="showDetails && selectedError"
    class="modal-overlay"
    @click="showDetails = false"
  >
    <div
      class="modal-content"
      @click.stop
    >
      <div class="modal-header">
        <h2>Error Details</h2>
        <Button
          variant="ghost"
          size="sm"
          @click="showDetails = false"
        >
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
            <div
              v-if="selectedError.component"
              class="detail-item"
            >
              <span class="detail-label">Component:</span>
              <span class="detail-value">{{ selectedError.component }}</span>
            </div>
            <div
              v-if="selectedError.url"
              class="detail-item"
            >
              <span class="detail-label">URL:</span>
              <span class="detail-value">{{ selectedError.url }}</span>
            </div>
            <div
              v-if="selectedError.method"
              class="detail-item"
            >
              <span class="detail-label">Method:</span>
              <span class="detail-value">{{ selectedError.method }}</span>
            </div>
            <div
              v-if="selectedError.statusCode"
              class="detail-item"
            >
              <span class="detail-label">Status:</span>
              <span class="detail-value">{{ selectedError.statusCode }}</span>
            </div>
            <div
              v-if="selectedError.ip"
              class="detail-item"
            >
              <span class="detail-label">IP:</span>
              <span class="detail-value">{{ selectedError.ip }}</span>
            </div>
            <div
              v-if="selectedError.userAgent"
              class="detail-item"
            >
              <span class="detail-label">User Agent:</span>
              <span class="detail-value text-xs">{{ selectedError.userAgent }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h3>Message</h3>
          <div class="message-box">
            {{ selectedError.message }}
          </div>
        </div>

        <div
          v-if="selectedError.stack"
          class="detail-section"
        >
          <h3>Stack Trace</h3>
          <pre class="stack-trace-full">{{ selectedError.stack }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-log-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  background: #0f172a;
  min-height: 100vh;
}

/* Enhanced Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border-radius: 1rem;
  padding: 2rem;
  border: 1px solid rgba(59, 130, 246, 0.1);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.header-title-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
}

.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.2));
  border-radius: 1rem;
  border: 1px solid rgba(239, 68, 68, 0.3);
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.2);
}

/* Quick Stats Bar */
.quick-stats-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.quick-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  min-width: 80px;
}

.quick-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
}

.quick-stat.critical {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1));
  border-color: rgba(239, 68, 68, 0.3);
}

.quick-stat.recent {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
  border-color: rgba(59, 130, 246, 0.3);
}

.quick-stat.total {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1));
  border-color: rgba(16, 185, 129, 0.3);
}

.quick-stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.quick-stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Category Filters */
.category-filters {
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.category-filter-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.category-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.category-btn {
  transition: all 0.2s ease;
  border: 1px solid #374151;
}

.category-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.category-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.health-status.healthy {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.health-status.warning {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.health-status.critical {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Advanced Filters */
.advanced-filters {
  margin-bottom: 2rem;
}

.advanced-filters-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-label {
  min-width: 120px;
  font-weight: 500;
  color: #e2e8f0;
}

.time-range-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.category-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Enhanced Stats Dashboard */
.stats-dashboard {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

.stat-card.critical::before {
  background: linear-gradient(90deg, #ef4444, #f59e0b);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.stat-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #64748b;
}

.stat-label {
  font-size: 0.875rem;
  color: #94a3b8;
  font-weight: 500;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 0.5rem;
}

.stat-change {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
}

.stat-change.negative {
  color: #ef4444;
}

/* Chart Card */
.chart-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.chart-header h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 1.125rem;
  font-weight: 600;
}

.chart-content {
  min-height: 200px;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 1rem;
  color: #64748b;
}

.chart-legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-item.critical .legend-color {
  background: #ef4444;
}

.legend-item.warning .legend-color {
  background: #f59e0b;
}

.legend-item.info .legend-color {
  background: #3b82f6;
}

/* Enhanced Search */
.search-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  width: 1.125rem;
  height: 1.125rem;
  color: #64748b;
  pointer-events: none;
  z-index: 2;
}

.search-input {
  padding: 0.75rem 3rem 0.75rem 3rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid #334155;
  border-radius: 0.75rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  width: 350px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.2),
    0 4px 20px rgba(59, 130, 246, 0.1);
  background: rgba(15, 23, 42, 0.95);
  transform: translateY(-1px);
}

.search-input::placeholder {
  color: #64748b;
  font-style: italic;
}

.search-clear {
  position: absolute;
  right: 1rem;
  width: 1.25rem;
  height: 1.25rem;
  color: #64748b;
  cursor: pointer;
  z-index: 2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.search-clear:hover {
  color: #e2e8f0;
  background: rgba(239, 68, 68, 0.1);
}

/* Enhanced Filters */
.filter-select {
  padding: 0.5rem 1rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.filter-select option {
  background: #1e293b;
  color: #e2e8f0;
}

/* Enhanced Error List */
.error-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1rem;
}

.bulk-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
}

.bulk-actions-left,
.bulk-actions-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.selected-count {
  color: #3b82f6;
  font-weight: 600;
}

/* Enhanced Error Cards */
.error-card {
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: 1px solid #334155;
  border-radius: 1rem;
  position: relative;
  overflow: hidden;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
  animation: slideIn 0.3s ease-out;
}

.error-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: #64748b;
  transition: all 0.3s ease;
}

.error-card.critical::before {
  background: linear-gradient(180deg, #ef4444, #f59e0b);
  animation: glow 2s infinite;
}

.error-card.selected::before {
  background: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.error-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  border-color: rgba(59, 130, 246, 0.6);
  background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.error-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.error-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.error-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-checkbox input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
  cursor: pointer;
}

.error-type-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.error-type {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 0.875rem;
}

.critical-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: linear-gradient(135deg, #ef4444, #f59e0b);
  color: white;
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #64748b;
  font-size: 0.75rem;
  white-space: nowrap;
}

.error-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.error-card:hover .error-actions {
  opacity: 1;
}

.error-message-text {
  color: #e2e8f0;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  word-break: break-word;
  line-height: 1.6;
  font-weight: 400;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 0.5rem;
  border-left: 3px solid rgba(59, 130, 246, 0.3);
}

.error-context {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.context-tag {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.context-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.context-tag.component {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.context-tag.url {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.context-tag.method {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.context-tag.status {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.context-tag.status.error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.context-tag.status.warning {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.context-tag.status.info {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.context-tag.status.success {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.stack-section {
  margin-top: 1rem;
  padding-top: 1rem;
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
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.stack-toggle:hover {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
}

.stack-trace {
  margin-top: 0.5rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(51, 65, 85, 0.3);
  border-radius: 0.5rem;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.75rem;
  color: #94a3b8;
  overflow-x: auto;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  backdrop-filter: blur(10px);
}

/* Enhanced Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-state-content h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 1.25rem;
  font-weight: 600;
}

.empty-state-content p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
}

/* Enhanced Pagination */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  margin-top: 2rem;
}

.pagination-info {
  color: #64748b;
  font-size: 0.875rem;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.page-ellipsis {
  color: #64748b;
  padding: 0 0.5rem;
}

/* Enhanced Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 1rem;
  border-radius: 0.5rem;
  backdrop-filter: blur(10px);
}

/* New Errors Badge */
.new-errors-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  animation: pulse 2s infinite;
  border: 1px solid rgba(16, 185, 129, 0.3);
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

.badge-text {
  font-weight: 600;
  letter-spacing: 0.025em;
}

/* Enhanced Modal */
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
  border-bottom: 1px solid rgba(51, 65, 85, 0.3);
}

.modal-header h2 {
  margin: 0;
  color: #e2e8f0;
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-body {
  padding: 1.5rem;
}

.detail-section {
  margin-bottom: 2rem;
}

.detail-section h3 {
  margin: 0 0 1rem 0;
  color: #e2e8f0;
  font-size: 1rem;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  gap: 0.75rem;
}

.detail-item {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  backdrop-filter: blur(10px);
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
  border-radius: 0.5rem;
  color: #fca5a5;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  white-space: pre-wrap;
  backdrop-filter: blur(10px);
}

.stack-trace-full {
  padding: 1rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(51, 65, 85, 0.3);
  border-radius: 0.5rem;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.75rem;
  color: #94a3b8;
  overflow-x: auto;
  white-space: pre;
  max-height: 400px;
  overflow-y: auto;
  backdrop-filter: blur(10px);
}

/* Main Content Area */
.main-content {
  flex: 1;
  margin-left: 320px; /* Account for sidebar width */
  transition: margin-left 0.3s ease;
}

@media (max-width: 1024px) {
  .main-content {
    margin-left: 0; /* Remove margin for smaller screens */
  }
  .error-log-view {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
    align-items: stretch;
  }

  .filter-group {
    justify-content: flex-start;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .error-log-view {
    padding: 0.5rem;
  }

  .header {
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .error-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .error-right {
    width: 100%;
    justify-content: space-between;
  }

  .pagination {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .bulk-actions-bar {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .filter-group {
    flex-direction: column;
    align-items: stretch;
  }

  .action-buttons {
    justify-content: stretch;
  }

  .action-buttons button {
    flex: 1;
  }
  .error-list {
    margin-left: 0; /* Remove fixed margin for responsive layout */
  }
}

/* Animations */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.6);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-card {
  animation: slideIn 0.3s ease-out;
}

/* Dark mode enhancements */
.error-log-view.dark-mode {
  background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
}

.error-log-view.dark-mode .stat-card,
.error-log-view.dark-mode .error-card,
.error-log-view.dark-mode .chart-card {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(30, 41, 59, 0.5);
}

.error-log-view.dark-mode .search-input,
.error-log-view.dark-mode .filter-select {
  background: rgba(2, 6, 23, 0.8);
  border-color: rgba(30, 41, 59, 0.5);
}
</style>
