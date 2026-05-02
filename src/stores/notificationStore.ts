import { ref, computed } from "vue";
import { defineStore } from "pinia";

export type NotificationType = "success" | "error" | "warning" | "info" | "progress";

export interface NotificationAction {
  label: string;
  handler: () => void;
  variant?: "primary" | "secondary" | "danger";
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  image?: string;
  link?: {
    text: string;
    path: string;
  };
  actions?: NotificationAction[];
  progress?: number; // 0-100 for progress notifications
  duration?: number; // milliseconds, undefined = persistent
  createdAt: Date;
  read: boolean;
  dismissed: boolean;
  source?: string; // e.g., "batch-job", "analysis", "report"
  metadata?: Record<string, any>;
}

export interface NotificationSettings {
  enabled: boolean;
  position: "top-right" | "bottom-right" | "top-center" | "bottom-center";
  duration: number;
  sounds: boolean;
  showProgress: boolean;
  maxVisible: number;
  types: {
    success: { enabled: boolean; duration: number; persistent: boolean };
    error: { enabled: boolean; duration: number; persistent: boolean };
    warning: { enabled: boolean; duration: number; persistent: boolean };
    info: { enabled: boolean; duration: number; persistent: boolean };
    progress: { enabled: boolean; duration: number; persistent: boolean };
  };
}

const API_BASE = "/api";

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  position: "top-right",
  duration: 5000,
  sounds: false,
  showProgress: true,
  maxVisible: 5,
  types: {
    success: { enabled: true, duration: 3000, persistent: false },
    error: { enabled: true, duration: 0, persistent: true },
    warning: { enabled: true, duration: 5000, persistent: false },
    info: { enabled: true, duration: 3000, persistent: false },
    progress: { enabled: true, duration: 0, persistent: true },
  },
};

const ICONS: Record<NotificationType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  progress: "📊",
};

export const useNotificationStore = defineStore("notifications", () => {
  // State
  const notifications = ref<Notification[]>([]);
  const settings = ref<NotificationSettings>(DEFAULT_SETTINGS);
  const centerOpen = ref(false);
  const isInitialized = ref(false);

  // Initialize settings from server
  async function initializeSettings() {
    if (isInitialized.value) return;
    settings.value = await loadSettings();
    isInitialized.value = true;
  }

  // Getters
  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length);
  const recentNotifications = computed(() =>
    notifications.value
      .filter((n) => !n.dismissed)
      .slice(0, 50)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  );
  const visibleNotifications = computed(() =>
    notifications.value
      .filter((n) => !n.dismissed && n.type !== "progress")
      .slice(0, settings.value.maxVisible)
  );
  const activeProgressNotifications = computed(() =>
    notifications.value.filter((n) => n.type === "progress" && !n.dismissed && n.progress !== 100)
  );

  // Actions
  function generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async function loadSettings(): Promise<NotificationSettings> {
    try {
      const response = await fetch(`${API_BASE}/settings/notifications`);
      const data = await response.json();
      if (data.success && data.settings) {
        return { ...DEFAULT_SETTINGS, ...data.settings };
      }
    } catch (error) {
      console.error("Failed to load notification settings from server:", error);
    }
    return DEFAULT_SETTINGS;
  }

  async function saveSettings(): Promise<void> {
    try {
      await fetch(`${API_BASE}/settings/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.value),
      });
    } catch (error) {
      console.error("Failed to save notification settings to server:", error);
    }
  }

  function updateSettings(newSettings: Partial<NotificationSettings>) {
    settings.value = { ...settings.value, ...newSettings };
    saveSettings();
  }

  function updateTypeSettings(
    type: NotificationType,
    typeSettings: Partial<NotificationSettings["types"][NotificationType]>
  ) {
    settings.value.types[type] = { ...settings.value.types[type], ...typeSettings };
    saveSettings();
  }

  function addNotification(
    notification: Omit<Notification, "id" | "createdAt" | "read" | "dismissed">
  ): string {
    if (!settings.value.enabled) return "";
    if (!settings.value.types[notification.type].enabled) return "";

    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: new Date(),
      read: false,
      dismissed: false,
      icon: notification.icon || ICONS[notification.type],
      duration: notification.duration ?? getDefaultDuration(notification.type),
    };

    notifications.value.unshift(newNotification);

    // Auto-dismiss if not persistent
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, newNotification.duration);
    }

    // Limit total notifications
    if (notifications.value.length > 100) {
      notifications.value = notifications.value.slice(0, 100);
    }

    return id;
  }

  function getDefaultDuration(type: NotificationType): number {
    const typeSettings = settings.value.types[type];
    if (typeSettings.persistent) return 0;
    return typeSettings.duration || settings.value.duration;
  }

  function dismissNotification(id: string) {
    const notification = notifications.value.find((n) => n.id === id);
    if (notification) {
      notification.dismissed = true;
    }
  }

  function markAsRead(id: string) {
    const notification = notifications.value.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  function markAllAsRead() {
    notifications.value.forEach((n) => {
      n.read = true;
    });
  }

  function clearAll() {
    notifications.value.forEach((n) => {
      n.dismissed = true;
    });
  }

  function deleteNotification(id: string) {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  }

  function updateProgress(id: string, progress: number, message?: string) {
    const notification = notifications.value.find((n) => n.id === id);
    if (notification && notification.type === "progress") {
      notification.progress = Math.min(100, Math.max(0, progress));
      if (message) notification.message = message;

      // Auto-dismiss when complete
      if (progress >= 100) {
        setTimeout(() => dismissNotification(id), 2000);
      }
    }
  }

  function updateNotification(id: string, updates: Partial<Notification>) {
    const notification = notifications.value.find((n) => n.id === id);
    if (notification) {
      Object.assign(notification, updates);
    }
  }

  // Convenience methods
  function success(
    title: string,
    message: string,
    options?: Partial<
      Omit<Notification, "id" | "createdAt" | "read" | "dismissed" | "type" | "title" | "message">
    >
  ) {
    return addNotification({ type: "success", title, message, ...options });
  }

  function error(
    title: string,
    message: string,
    options?: Partial<
      Omit<Notification, "id" | "createdAt" | "read" | "dismissed" | "type" | "title" | "message">
    >
  ) {
    return addNotification({ type: "error", title, message, ...options });
  }

  function warning(
    title: string,
    message: string,
    options?: Partial<
      Omit<Notification, "id" | "createdAt" | "read" | "dismissed" | "type" | "title" | "message">
    >
  ) {
    return addNotification({ type: "warning", title, message, ...options });
  }

  function info(
    title: string,
    message: string,
    options?: Partial<
      Omit<Notification, "id" | "createdAt" | "read" | "dismissed" | "type" | "title" | "message">
    >
  ) {
    return addNotification({ type: "info", title, message, ...options });
  }

  function progress(
    title: string,
    message: string,
    initialProgress = 0,
    options?: Partial<
      Omit<
        Notification,
        "id" | "createdAt" | "read" | "dismissed" | "type" | "title" | "message" | "progress"
      >
    >
  ) {
    return addNotification({
      type: "progress",
      title,
      message,
      progress: initialProgress,
      ...options,
    });
  }

  function openCenter() {
    centerOpen.value = true;
  }

  function closeCenter() {
    centerOpen.value = false;
  }

  function toggleCenter() {
    centerOpen.value = !centerOpen.value;
  }

  return {
    // State
    notifications,
    settings,
    centerOpen,

    // Getters
    unreadCount,
    recentNotifications,
    visibleNotifications,
    activeProgressNotifications,

    // Actions
    addNotification,
    dismissNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    deleteNotification,
    updateProgress,
    updateNotification,
    updateSettings,
    updateTypeSettings,

    // Convenience
    success,
    error,
    warning,
    info,
    progress,

    // UI
    openCenter,
    closeCenter,
    toggleCenter,

    // Settings
    initializeSettings,
    loadSettings,
    saveSettings,
    isInitialized,
  };
});
