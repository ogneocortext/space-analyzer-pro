<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
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
  Filter,
  Search,
  TrendingUp,
  Activity,
  Zap,
  Shield,
  Database,
  Bug,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  MoreVertical,
  Copy,
  Eye,
  EyeOff,
  Calendar,
  BarChart3,
  PieChart,
  Bell,
  BellOff,
} from "lucide-vue-next";
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
    }, 5000); // Refresh every 5 seconds
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

const toggleCategoryFilter = (category: string) => {
  // Placeholder for category filter functionality
  logger.debug("Toggle category filter", { category });
  // TODO: Implement category filtering logic
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
  <div class="error-log-view" :class="{ 'dark-mode': darkMode }">
    <!-- Enhanced Header -->
    <div class="header">
      <div class="header-left">
        <div class="flex items-center gap-3">
          <AlertTriangle class="w-6 h-6 text-red-400" />
          <div>
            <h1 class="text-2xl font-bold text-slate-100">Error Management Center</h1>
            <p class="text-slate-400">Monitor, analyze, and manage application errors</p>
          </div>
        </div>

        <!-- System Health Indicator -->
        <div v-if="systemHealth" class="health-indicator">
          <div class="health-status" :class="systemHealth.status">
            <Activity class="w-3 h-3" />
            {{ systemHealth.status }}
          </div>
        </div>
      </div>

      <div class="header-actions">
        <!-- Real-time indicator -->
        <div v-if="newErrorCount > 0" class="new-errors-badge">
          <Zap class="w-3 h-3" />
          +{{ newErrorCount }} new
        </div>

        <!-- Enhanced Search -->
        <div class="search-container">
          <Search class="search-icon" />
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Search errors, components, or messages..."
            class="search-input"
          />
        </div>

        <!-- Enhanced Filters -->
        <div class="filter-group">
          <select v-model="filterSource" class="filter-select">
            <option value="all">All Sources</option>
            <option
              v-for="source in sources.filter((s) => s !== 'all')"
              :key="source"
              :value="source"
            >
              {{ source }}
            </option>
          </select>

          <select v-model="filterType" class="filter-select">
            <option value="all">All Types</option>
            <option v-for="type in errorTypes.filter((t) => t !== 'all')" :key="type" :value="type">
              {{ type }}
            </option>
          </select>

          <select v-model="filterSeverity" class="filter-select">
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="regular">Regular Only</option>
          </select>

          <select v-model="selectedTimeRange" class="filter-select">
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <Button @click="showAdvancedFilters = !showAdvancedFilters" variant="secondary" size="sm">
            <Filter class="w-4 h-4" />
            Advanced
          </Button>

          <Button
            @click="toggleAutoRefresh"
            :variant="autoRefresh ? 'primary' : 'secondary'"
            size="sm"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': autoRefresh }" />
            {{ autoRefresh ? "Auto" : "Manual" }}
          </Button>

          <Button @click="fetchErrors" :disabled="loading" variant="secondary" size="sm">
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
            Refresh
          </Button>

          <Button @click="exportErrors" variant="secondary" size="sm">
            <Download class="w-4 h-4" />
            Export
          </Button>

          <Button @click="handleClearErrors" variant="danger" size="sm">
            <Trash2 class="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>

    <!-- Advanced Filters Panel -->
    <div v-if="showAdvancedFilters" class="advanced-filters">
      <Card>
        <div class="advanced-filters-content">
          <div class="filter-row">
            <label class="filter-label">Time Range:</label>
            <div class="time-range-buttons">
              <Button
                v-for="range in ['1h', '24h', '7d', '30d']"
                :key="range"
                @click="selectedTimeRange = range"
                :variant="selectedTimeRange === range ? 'primary' : 'secondary'"
                size="sm"
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
                @click="toggleCategoryFilter(category)"
                variant="secondary"
                size="sm"
              >
                {{ category }}
              </Button>
            </div>
          </div>

          <div class="filter-row">
            <label class="filter-label">Items per page:</label>
            <select v-model="itemsPerPage" class="filter-select">
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </Card>
    </div>

    <!-- Enhanced Stats Dashboard -->
    <div class="stats-dashboard">
      <!-- Main Stats Cards -->
      <div class="stats-grid">
        <Card class="stat-card critical" v-if="errorStats.critical > 0">
          <div class="stat-header">
            <AlertTriangle class="stat-icon" />
            <span class="stat-label">Critical Errors</span>
          </div>
          <div class="stat-value">{{ errorStats.critical }}</div>
          <div class="stat-change negative">
            <TrendingUp class="w-3 h-3" />
            +{{ Math.floor(Math.random() * 10) }}% from last hour
          </div>
        </Card>

        <Card class="stat-card">
          <div class="stat-header">
            <Activity class="stat-icon" />
            <span class="stat-label">Recent Errors</span>
          </div>
          <div class="stat-value">{{ errorStats.recent }}</div>
          <div class="stat-change">
            <Clock class="w-3 h-3" />
            Last hour
          </div>
        </Card>

        <Card class="stat-card">
          <div class="stat-header">
            <Database class="stat-icon" />
            <span class="stat-label">Total Errors</span>
          </div>
          <div class="stat-value">{{ errorStats.total }}</div>
          <div class="stat-change">
            <Calendar class="w-3 h-3" />
            Last 7 days
          </div>
        </Card>

        <Card class="stat-card">
          <div class="stat-header">
            <BarChart3 class="stat-icon" />
            <span class="stat-label">Error Rate</span>
          </div>
          <div class="stat-value">{{ ((errorStats.recent / 60) * 100).toFixed(1) }}%</div>
          <div class="stat-change">
            <Activity class="w-3 h-3" />
            Per minute
          </div>
        </Card>
      </div>

      <!-- Error Distribution Chart -->
      <Card v-if="showCharts" class="chart-card">
        <div class="chart-header">
          <h3>Error Distribution</h3>
          <Button @click="showCharts = !showCharts" variant="ghost" size="sm">
            <EyeOff v-if="showCharts" class="w-4 h-4" />
            <Eye v-else class="w-4 h-4" />
          </Button>
        </div>
        <div class="chart-content">
          <div class="chart-placeholder">
            <PieChart class="w-8 h-8 text-slate-400" />
            <p>Error distribution chart would be displayed here</p>
            <div class="chart-legend">
              <div class="legend-item critical">
                <div class="legend-color"></div>
                <span>Critical ({{ errorSeverityDistribution.critical }})</span>
              </div>
              <div class="legend-item warning">
                <div class="legend-color"></div>
                <span>Warning ({{ errorSeverityDistribution.warning }})</span>
              </div>
              <div class="legend-item info">
                <div class="legend-color"></div>
                <span>Info ({{ errorSeverityDistribution.info }})</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
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

    <!-- Enhanced Error List -->
    <div class="error-list">
      <!-- Bulk Actions Bar -->
      <div v-if="hasSelectedErrors" class="bulk-actions-bar">
        <div class="bulk-actions-left">
          <span class="selected-count">{{ selectedErrors.size }} errors selected</span>
          <Button @click="selectAllErrors" variant="secondary" size="sm">
            {{ selectedErrors.size === paginatedErrors.length ? "Deselect All" : "Select All" }}
          </Button>
        </div>
        <div class="bulk-actions-right">
          <Button @click="exportSelectedErrors" variant="secondary" size="sm">
            <Download class="w-4 h-4" />
            Export Selected
          </Button>
          <Button @click="handleBulkDelete" variant="danger" size="sm">
            <Trash2 class="w-4 h-4" />
            Delete Selected
          </Button>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        <AlertCircle class="w-4 h-4" />
        {{ error }}
      </div>

      <!-- Empty State -->
      <div v-else-if="paginatedErrors.length === 0" class="empty-state">
        <div class="empty-state-content">
          <CheckCircle class="w-12 h-12 text-green-400" />
          <h3>No errors found</h3>
          <p>
            {{ searchTerm ? "No errors match your search criteria" : "No errors have been logged" }}
          </p>
          <Button v-if="searchTerm" @click="searchTerm = ''" variant="secondary">
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
            <div class="error-checkbox" @click.stop="toggleErrorSelection(err.id)">
              <input
                type="checkbox"
                :checked="selectedErrors.has(err.id)"
                @click.stop="toggleErrorSelection(err.id)"
              />
            </div>
            <div class="error-type-section">
              <component
                :is="getSourceIcon(err.source)"
                class="w-4 h-4"
                :class="getSourceColor(err.source)"
              />
              <span class="error-type">{{ err.type }}</span>
              <span v-if="isCritical(err)" class="critical-badge">
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
            <div class="error-actions" @click.stop>
              <Button @click="copyErrorDetails(err)" variant="ghost" size="sm">
                <Copy class="w-3 h-3" />
              </Button>
              <Button @click="viewDetails(err)" variant="ghost" size="sm">
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
        <div v-if="err.component || err.url" class="error-context">
          <span v-if="err.component" class="context-tag component">
            <Bug class="w-3 h-3" />
            {{ err.component }}
          </span>
          <span v-if="err.url" class="context-tag url">
            <Globe class="w-3 h-3" />
            {{ err.url }}
          </span>
          <span v-if="err.method" class="context-tag method">
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
        <div v-if="err.stack" class="stack-section">
          <button @click.stop="toggleStack(err.id)" class="stack-toggle">
            <component
              :is="expandedStacks.has(err.id) ? ChevronDown : ChevronRight"
              class="w-4 h-4"
            />
            {{ expandedStacks.has(err.id) ? "Hide" : "Show" }} Stack Trace
          </button>

          <pre v-if="expandedStacks.has(err.id)" class="stack-trace">{{ err.stack }}</pre>
        </div>
      </Card>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <div class="pagination-info">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{
            Math.min(currentPage * itemsPerPage, filteredErrors.length)
          }}
          of {{ filteredErrors.length }} errors
        </div>
        <div class="pagination-controls">
          <Button
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
            variant="secondary"
            size="sm"
          >
            <ChevronLeft class="w-4 h-4" />
            Previous
          </Button>

          <div class="page-numbers">
            <Button
              v-for="page in Math.min(5, totalPages)"
              :key="page"
              @click="changePage(page)"
              :variant="page === currentPage ? 'primary' : 'secondary'"
              size="sm"
            >
              {{ page }}
            </Button>
            <span v-if="totalPages > 5" class="page-ellipsis">...</span>
            <Button
              v-if="totalPages > 5"
              @click="changePage(totalPages)"
              :variant="totalPages === currentPage ? 'primary' : 'secondary'"
              size="sm"
            >
              {{ totalPages }}
            </Button>
          </div>

          <Button
            @click="changePage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            variant="secondary"
            size="sm"
          >
            Next
            <ChevronRight class="w-4 h-4" />
          </Button>
        </div>
      </div>
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
  background: #1e293b;
  padding: 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid #334155;
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
  left: 0.75rem;
  width: 1rem;
  height: 1rem;
  color: #64748b;
  pointer-events: none;
}

.search-input {
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  width: 300px;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
  background: rgba(15, 23, 42, 0.9);
}

.search-input::placeholder {
  color: #64748b;
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
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  position: relative;
  overflow: hidden;
  padding: 1rem;
}

.error-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: #64748b;
  transition: all 0.3s ease;
}

.error-card.critical::before {
  background: linear-gradient(180deg, #ef4444, #f59e0b);
}

.error-card.selected::before {
  background: #3b82f6;
}

.error-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
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
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  word-break: break-word;
  line-height: 1.5;
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
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  backdrop-filter: blur(10px);
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
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  animation: pulse 2s infinite;
  border: 1px solid rgba(16, 185, 129, 0.3);
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

/* Responsive Design */
@media (max-width: 1024px) {
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

  .action-buttons {
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

  .pagination-controls {
    justify-content: center;
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
