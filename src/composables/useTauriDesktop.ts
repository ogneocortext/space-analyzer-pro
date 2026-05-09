import { ref, onMounted, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open, save, ask, message, confirm } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-globalShortcut";

export interface TauriFeatures {
  fileSystem: boolean;
  notifications: boolean;
  globalShortcuts: boolean;
  systemTheme: "light" | "dark" | "system";
  platform: string;
  version: string;
}

export interface FileSystemStats {
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  platform: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
}

export interface GlobalShortcut {
  accelerator: string;
  action: () => void;
  enabled: boolean;
}

export function useTauriDesktop() {
  // State
  const isTauri = ref(!!window.__TAURI__);
  const features = ref<TauriFeatures>({
    fileSystem: false,
    notifications: false,
    globalShortcuts: false,
    systemTheme: "system",
    platform: "unknown",
    version: "1.0.0",
  });
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Registered shortcuts
  const registeredShortcuts = ref<Map<string, string>>(new Map());

  // Check if running in Tauri
  const checkTauriAvailability = async () => {
    try {
      if (window.__TAURI__) {
        const version = await invoke<string>("get_app_version");
        const platform = await invoke<string>("get_platform");

        features.value = {
          fileSystem: true,
          notifications: await isPermissionGranted("notification"),
          globalShortcuts: true,
          systemTheme: "system", // Will be detected
          platform: platform || "unknown",
          version: version || "1.0.0",
        };
      }
    } catch (err) {
      console.error("Failed to check Tauri availability:", err);
      error.value = err instanceof Error ? err.message : "Unknown error";
    }
  };

  // File system operations
  const selectDirectory = async (): Promise<string | null> => {
    try {
      const selected = await open({
        title: "Select Directory for Analysis",
        directory: true,
        multiple: false,
        recursive: false,
      });
      return selected;
    } catch (err) {
      console.error("Failed to select directory:", err);
      error.value = err instanceof Error ? err.message : "Directory selection failed";
      return null;
    }
  };

  const saveAnalysisReport = async (data: any, filename?: string): Promise<boolean> => {
    try {
      const defaultFilename =
        filename || `space-analysis-${new Date().toISOString().split("T")[0]}.json`;
      const filePath = await save({
        title: "Save Analysis Report",
        defaultPath: defaultFilename,
        filters: [
          {
            name: "JSON Files",
            extensions: ["json"],
          },
          {
            name: "CSV Files",
            extensions: ["csv"],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(data, null, 2));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to save report:", err);
      error.value = err instanceof Error ? err.message : "Save failed";
      return false;
    }
  };

  const checkFileExists = async (path: string): Promise<boolean> => {
    try {
      return await exists(path);
    } catch (err) {
      console.error("Failed to check file existence:", err);
      return false;
    }
  };

  const createAnalysisDirectory = async (path: string): Promise<boolean> => {
    try {
      await mkdir(path, { recursive: true });
      return true;
    } catch (err) {
      console.error("Failed to create directory:", err);
      error.value = err instanceof Error ? err.message : "Directory creation failed";
      return false;
    }
  };

  // Get file system statistics
  const getFileSystemStats = async (): Promise<FileSystemStats | null> => {
    try {
      const stats = await invoke<FileSystemStats>("get_filesystem_stats");
      return stats;
    } catch (err) {
      console.error("Failed to get filesystem stats:", err);
      error.value = err instanceof Error ? err.message : "Failed to get filesystem stats";
      return null;
    }
  };

  // Notification system
  const sendDesktopNotification = async (options: NotificationOptions): Promise<boolean> => {
    try {
      if (!features.value.notifications) {
        const granted = await requestPermission("notification");
        if (!granted) return false;
      }

      await sendNotification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        silent: options.silent || false,
      });
      return true;
    } catch (err) {
      console.error("Failed to send notification:", err);
      error.value = err instanceof Error ? err.message : "Notification failed";
      return false;
    }
  };

  const notifyAnalysisComplete = async (fileCount: number, duration: number): Promise<void> => {
    await sendDesktopNotification({
      title: "Analysis Complete",
      body: `Analyzed ${fileCount} files in ${Math.round(duration / 1000)}s`,
      icon: "icons/success.png",
    });
  };

  const notifyError = async (message: string): Promise<void> => {
    await sendDesktopNotification({
      title: "Error",
      body: message,
      icon: "icons/error.png",
    });
  };

  // Global shortcuts
  const registerShortcut = async (shortcut: GlobalShortcut): Promise<boolean> => {
    try {
      if (!features.value.globalShortcuts) return false;

      await register(shortcut.accelerator, shortcut.action);
      registeredShortcuts.value.set(shortcut.accelerator, shortcut.accelerator);
      return true;
    } catch (err) {
      console.error("Failed to register shortcut:", err);
      error.value = err instanceof Error ? err.message : "Shortcut registration failed";
      return false;
    }
  };

  const unregisterShortcut = async (accelerator: string): Promise<boolean> => {
    try {
      await unregister(accelerator);
      registeredShortcuts.value.delete(accelerator);
      return true;
    } catch (err) {
      console.error("Failed to unregister shortcut:", err);
      error.value = err instanceof Error ? err.message : "Shortcut unregistration failed";
      return false;
    }
  };

  const setupDefaultShortcuts = async (): Promise<void> => {
    const shortcuts: GlobalShortcut[] = [
      {
        accelerator: "CmdOrCtrl+O",
        action: () => selectDirectory(),
        enabled: true,
      },
      {
        accelerator: "CmdOrCtrl+S",
        action: () => {
          // Trigger save from current context
          console.log("Save shortcut triggered");
        },
        enabled: true,
      },
      {
        accelerator: "CmdOrCtrl+R",
        action: () => {
          // Trigger refresh/analysis
          console.log("Refresh shortcut triggered");
        },
        enabled: true,
      },
      {
        accelerator: "F11",
        action: () => {
          // Toggle fullscreen
          console.log("Fullscreen shortcut triggered");
        },
        enabled: true,
      },
    ];

    for (const shortcut of shortcuts) {
      await registerShortcut(shortcut);
    }
  };

  // System integration
  const minimizeToTray = async (): Promise<void> => {
    try {
      await invoke("minimize_to_tray");
    } catch (err) {
      console.error("Failed to minimize to tray:", err);
      error.value = err instanceof Error ? err.message : "Minimize failed";
    }
  };

  const showInTaskbar = async (): Promise<void> => {
    try {
      await invoke("show_in_taskbar");
    } catch (err) {
      console.error("Failed to show in taskbar:", err);
      error.value = err instanceof Error ? err.message : "Show in taskbar failed";
    }
  };

  const setAlwaysOnTop = async (alwaysOnTop: boolean): Promise<void> => {
    try {
      await invoke("set_always_on_top", { alwaysOnTop });
    } catch (err) {
      console.error("Failed to set always on top:", err);
      error.value = err instanceof Error ? err.message : "Set always on top failed";
    }
  };

  // Window management
  const focusWindow = async (): Promise<void> => {
    try {
      await invoke("focus_window");
    } catch (err) {
      console.error("Failed to focus window:", err);
    }
  };

  const centerWindow = async (): Promise<void> => {
    try {
      await invoke("center_window");
    } catch (err) {
      console.error("Failed to center window:", err);
    }
  };

  // System theme detection
  const detectSystemTheme = async (): Promise<"light" | "dark"> => {
    try {
      const theme = await invoke<"light" | "dark">("get_system_theme");
      features.value.systemTheme = theme;
      return theme;
    } catch (err) {
      console.error("Failed to detect system theme:", err);
      return "system";
    }
  };

  // User confirmation dialogs
  const confirmAction = async (message: string, title?: string): Promise<boolean> => {
    try {
      const result = await confirm(title || "Confirm Action", message);
      return result;
    } catch (err) {
      console.error("Failed to show confirmation:", err);
      return false;
    }
  };

  const promptUser = async (
    message: string,
    title?: string,
    defaultValue?: string
  ): Promise<string | null> => {
    try {
      const result = await ask(title || "Input Required", message, {
        type: "text",
        defaultValue: defaultValue || "",
      });
      return result;
    } catch (err) {
      console.error("Failed to show prompt:", err);
      return null;
    }
  };

  const showMessage = async (message: string, title?: string): Promise<void> => {
    try {
      await message(title || "Information", message, { type: "info" });
    } catch (err) {
      console.error("Failed to show message:", err);
    }
  };

  // Cleanup on unmount
  const cleanup = async (): Promise<void> => {
    // Unregister all shortcuts
    for (const accelerator of registeredShortcuts.value.values()) {
      try {
        await unregisterShortcut(accelerator);
      } catch (err) {
        console.error(`Failed to unregister shortcut ${accelerator}:`, err);
      }
    }
    registeredShortcuts.value.clear();
  };

  // Lifecycle
  onMounted(async () => {
    await checkTauriAvailability();

    if (isTauri.value) {
      await detectSystemTheme();
      await setupDefaultShortcuts();
      console.log("Tauri desktop features initialized");
    }
  });

  onUnmounted(async () => {
    await cleanup();
    console.log("Tauri desktop features cleaned up");
  });

  return {
    // State
    isTauri,
    features,
    isLoading,
    error,
    registeredShortcuts,

    // File system
    selectDirectory,
    saveAnalysisReport,
    checkFileExists,
    createAnalysisDirectory,
    getFileSystemStats,

    // Notifications
    sendDesktopNotification,
    notifyAnalysisComplete,
    notifyError,

    // Global shortcuts
    registerShortcut,
    unregisterShortcut,
    setupDefaultShortcuts,

    // System integration
    minimizeToTray,
    showInTaskbar,
    setAlwaysOnTop,
    focusWindow,
    centerWindow,

    // Window management
    detectSystemTheme,

    // User interaction
    confirmAction,
    promptUser,
    showMessage,

    // Cleanup
    cleanup,
  };
}
