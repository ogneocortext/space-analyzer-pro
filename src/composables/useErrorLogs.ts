/**
 * Unified Error Logs composable
 * Works in both web mode (API) and Tauri desktop mode (commands)
 */
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useDebugLogger } from "@/services/DebugLogger";

const logger = useDebugLogger("ErrorLogs");

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  source: string;
  url?: string;
  component?: string;
  action?: string;
  statusCode?: number;
}

export interface ErrorStats {
  total: number;
  critical: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byDay: Record<string, number>;
}

// Check if running in Tauri
const isTauri = (): boolean => {
  return !!(window as any).__TAURI__;
};

export function useErrorLogs() {
  const errors = ref<ErrorLogEntry[]>([]);
  const stats = ref<ErrorStats | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch errors - uses Tauri commands in desktop mode, API in web mode
  const fetchErrors = async (limit: number = 100): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      if (isTauri()) {
        // Tauri desktop mode
        const tauriErrors = await invoke<
          Array<{
            id: string;
            timestamp: string;
            error_type: string;
            message: string;
            stack?: string;
            source: string;
            url?: string;
            component?: string;
          }>
        >("get_error_logs", { limit });

        errors.value = tauriErrors.map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          type: e.error_type,
          message: e.message,
          stack: e.stack,
          source: e.source,
          url: e.url,
          component: e.component,
        }));
      } else {
        // Web mode - fetch from API
        const response = await fetch(`/api/errors/recent?limit=${limit}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success) {
          errors.value = data.errors;
        } else {
          throw new Error(data.error || "Failed to fetch errors");
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load errors";
      logger.error("Failed to fetch errors", { error: err });
    } finally {
      loading.value = false;
    }
  };

  // Fetch stats
  const fetchStats = async (): Promise<void> => {
    try {
      if (isTauri()) {
        // Tauri desktop mode - build stats from errors
        const tauriStats = await invoke<{ total: number; recent: number }>("get_error_stats");

        // Build stats from current errors
        const byType: Record<string, number> = {};
        const bySource: Record<string, number> = {};
        let critical = 0;

        errors.value.forEach((e) => {
          byType[e.type] = (byType[e.type] || 0) + 1;
          bySource[e.source] = (bySource[e.source] || 0) + 1;
          if (
            e.type === "uncaughtException" ||
            e.type === "unhandledRejection" ||
            (e.statusCode && e.statusCode >= 500)
          ) {
            critical++;
          }
        });

        stats.value = {
          total: tauriStats.total,
          critical,
          byType,
          bySource,
          byDay: {},
        };
      } else {
        // Web mode
        const response = await fetch("/api/errors/stats?days=7");
        if (!response.ok) return;
        const data = await response.json();
        if (data.success) {
          stats.value = data.stats;
        }
      }
    } catch (err) {
      logger.error("Failed to fetch stats", { error: err });
    }
  };

  // Clear all errors
  const clearErrors = async (): Promise<void> => {
    try {
      if (isTauri()) {
        await invoke("clear_error_logs");
      } else {
        const response = await fetch("/api/errors/clear", { method: "DELETE" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
      }
      errors.value = [];
      stats.value = null;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to clear errors");
    }
  };

  // Delete specific errors
  const deleteErrors = async (ids: string[]): Promise<void> => {
    try {
      if (isTauri()) {
        await invoke("delete_error_logs", { ids });
      } else {
        const response = await fetch("/api/errors/bulk-delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorIds: ids }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
      }
      errors.value = errors.value.filter((e) => !ids.includes(e.id));
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to delete errors");
    }
  };

  // Report a new error
  const reportError = async (entry: Omit<ErrorLogEntry, "id" | "timestamp">): Promise<void> => {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    try {
      if (isTauri()) {
        await invoke("report_error", {
          error: {
            id,
            timestamp,
            error_type: entry.type,
            message: entry.message,
            stack: entry.stack,
            source: entry.source,
            url: entry.url,
            component: entry.component,
          },
        });
      } else {
        // Web mode - post to API
        await fetch("/api/errors/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            timestamp,
            type: entry.type,
            message: entry.message,
            stack: entry.stack,
            source: entry.source,
            url: entry.url,
            component: entry.component,
            viewport: { width: window.innerWidth, height: window.innerHeight },
          }),
          keepalive: true,
        });
      }
    } catch (err) {
      logger.error("Failed to report error", { error: err });
    }
  };

  return {
    errors: computed(() => errors.value),
    stats: computed(() => stats.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchErrors,
    fetchStats,
    clearErrors,
    deleteErrors,
    reportError,
    isTauri: isTauri(),
  };
}
