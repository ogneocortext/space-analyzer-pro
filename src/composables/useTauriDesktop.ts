import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { ref, onMounted, onUnmounted } from "vue";
import { useAnalysisStore } from "@/store/analysis";
import { useDebugLogger } from "@/services/DebugLogger";

const logger = useDebugLogger("TauriDesktop");

export interface DesktopScanProgress {
  files_scanned: number;
  directories_scanned: number;
  total_size: number;
  current_file: string;
  percentage: number;
  completed: boolean;
}

export interface DesktopAnalysisResult {
  path: string;
  total_files: number;
  total_directories: number;
  total_size: number;
  analysis_time_ms: number;
  file_types: Record<string, number>;
  largest_files: Array<{
    path: string;
    name: string;
    size: number;
    modified?: string;
    file_type: string;
    extension: string;
  }>;
  empty_directories: string[];
  errors: string[];
}

export interface SystemInfo {
  total_memory: number;
  used_memory: number;
  cpu_count: number;
  os_name: string;
  os_version: string;
  hostname: string;
}

export interface DriveInfo {
  name: string;
  path: string;
  total_space: number;
  available_space: number;
  used_space: number;
  filesystem: string;
  is_removable: boolean;
}

export function useTauriDesktop() {
  const isTauri = ref(false);
  const progress = ref<DesktopScanProgress | null>(null);
  const isScanning = ref(false);
  const unlistenFn = ref<(() => void) | null>(null);
  const store = useAnalysisStore();

  onMounted(async () => {
    isTauri.value = !!(window as any).__TAURI__;

    if (isTauri.value) {
      unlistenFn.value = await listen<DesktopScanProgress>("scan-progress", (event) => {
        progress.value = event.payload;
        isScanning.value = !event.payload.completed;

        // Sync with analysis store for RealTimePerformanceMonitor
        store.updateProgressFromWebSocket({
          files: event.payload.files_scanned,
          percentage: event.payload.percentage,
          currentFile: event.payload.current_file,
          completed: event.payload.completed,
          totalSize: event.payload.total_size,
        });
      });
    }
  });

  onUnmounted(() => {
    if (unlistenFn.value) {
      unlistenFn.value();
    }
  });

  const selectDirectory = async (): Promise<string | null> => {
    if (!isTauri.value) return null;

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Directory to Analyze",
      });
      logger.info("Directory selected", { path: selected });
      return selected as string | null;
    } catch (error) {
      logger.error("Failed to open directory dialog", { error });
      return null;
    }
  };

  const analyzeDirectory = async (path: string): Promise<DesktopAnalysisResult | null> => {
    if (!isTauri.value) {
      throw new Error("Tauri not available");
    }

    try {
      logger.info("Analyzing directory", { path });
      const result = await invoke<DesktopAnalysisResult>("analyze_directory", { path });
      logger.info("Analysis complete", { totalFiles: result.total_files });
      return result;
    } catch (error) {
      logger.error("Failed to analyze directory", { path, error });
      throw new Error(`Analysis failed: ${error}`);
    }
  };

  const analyzeDirectoryWithProgress = async (
    path: string
  ): Promise<DesktopAnalysisResult | null> => {
    if (!isTauri.value) {
      throw new Error("Tauri not available");
    }

    isScanning.value = true;
    progress.value = null;

    try {
      logger.info("Starting analysis with progress", { path });
      const result = await invoke<DesktopAnalysisResult>("analyze_directory_with_progress", {
        path,
      });
      logger.info("Analysis with progress complete", { totalFiles: result.total_files });
      return result;
    } catch (error) {
      logger.error("Analysis with progress failed", { path, error });
      throw new Error(`Analysis failed: ${error}`);
    } finally {
      isScanning.value = false;
    }
  };

  const cancelAnalysis = async (): Promise<void> => {
    if (!isTauri.value) return;
    try {
      await invoke("cancel_analysis");
      logger.info("Analysis cancelled");
    } catch (error) {
      logger.error("Failed to cancel analysis", { error });
    }
  };

  const getSystemInfo = async (): Promise<SystemInfo | null> => {
    if (!isTauri.value) {
      throw new Error("Tauri not available");
    }
    try {
      const info = await invoke<SystemInfo>("get_system_info");
      logger.debug("System info retrieved", { os: info.os_name });
      return info;
    } catch (error) {
      logger.error("Failed to get system info", { error });
      return null;
    }
  };

  const getDrives = async (): Promise<DriveInfo[]> => {
    if (!isTauri.value) {
      throw new Error("Tauri not available");
    }
    try {
      const drives = await invoke<DriveInfo[]>("get_drives");
      logger.debug("Drives retrieved", { count: drives.length });
      return drives;
    } catch (error) {
      logger.error("Failed to get drives", { error });
      return [];
    }
  };

  const openFileLocation = async (path: string): Promise<void> => {
    if (!isTauri.value) return;
    try {
      await invoke("open_file_location", { path });
      logger.info("Opened file location", { path });
    } catch (error) {
      logger.error("Failed to open file location", { path, error });
      throw new Error(`Could not open file location: ${error}`);
    }
  };

  const getFileDetails = async (path: string) => {
    if (!isTauri.value) {
      throw new Error("Tauri not available");
    }
    try {
      const details = await invoke("get_file_details", { path });
      logger.debug("File details retrieved", { path });
      return details;
    } catch (error) {
      logger.error("Failed to get file details", { path, error });
      return null;
    }
  };

  const deleteFiles = async (paths: string[]) => {
    if (!isTauri.value) {
      throw new Error("Tauri not available");
    }
    try {
      const result = await invoke("delete_files", { paths });
      logger.info("Files deleted", { count: paths.length });
      return result;
    } catch (error) {
      logger.error("Failed to delete files", { paths, error });
      throw new Error(`Could not delete files: ${error}`);
    }
  };

  return {
    isTauri,
    progress,
    isScanning,
    selectDirectory,
    analyzeDirectory,
    analyzeDirectoryWithProgress,
    cancelAnalysis,
    getSystemInfo,
    getDrives,
    openFileLocation,
    getFileDetails,
    deleteFiles,
  };
}
