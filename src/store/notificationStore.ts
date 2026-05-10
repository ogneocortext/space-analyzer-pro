/**
 * Notification Store for Space Analyzer
 * Manages application notifications and settings with rich content support
 */

import { ref, reactive } from "vue";

export type NotificationType = "info" | "success" | "warning" | "error" | "progress";

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: "primary" | "secondary" | "danger";
}

export interface NotificationLink {
  text: string;
  path?: string;
  url?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
  icon?: string;
  image?: string;
  link?: NotificationLink;
  actions?: NotificationAction[];
  progress?: number; // 0-100 for progress notifications
  duration?: number; // milliseconds, undefined = persistent
}

export interface NotificationTypeSettings {
  enabled: boolean;
  persistent: boolean;
  duration: number;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  sounds: boolean; // For compatibility with settings view
  desktop: boolean;
  position:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  duration: number;
  maxVisible: number;
  showProgress: boolean;
  types: Record<NotificationType, NotificationTypeSettings>;
}

class NotificationStore {
  private notifications = ref<Notification[]>([]);
  private settings = reactive<NotificationSettings>({
    enabled: true,
    sound: true,
    sounds: true, // For compatibility
    desktop: true,
    position: "top-right",
    duration: 5000,
    maxVisible: 5,
    showProgress: true,
    types: {
      info: { enabled: true, persistent: false, duration: 5000 },
      success: { enabled: true, persistent: false, duration: 5000 },
      warning: { enabled: true, persistent: false, duration: 7000 },
      error: { enabled: true, persistent: true, duration: 10000 },
      progress: { enabled: true, persistent: true, duration: 0 },
    },
  });
  private pausedTimeouts = ref<Set<string>>(new Set());
  private activeTimeouts = ref<Map<string, number>>(new Map());

  get notificationsList() {
    return this.notifications.value;
  }

  get unreadCount() {
    return this.notifications.value.filter((n) => !n.read).length;
  }

  get currentSettings() {
    return this.settings;
  }

  addNotification(notification: Omit<Notification, "id" | "timestamp" | "read">): string {
    // Check if notifications are enabled and this type is enabled
    if (!this.settings.enabled || !this.settings.types[notification.type].enabled) {
      return "";
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const typeSettings = this.settings.types[notification.type];
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
      progress: notification.progress ?? (notification.type === "progress" ? 0 : undefined),
    };

    this.notifications.value.unshift(newNotification);

    // Remove old notifications if exceeding max
    if (this.notifications.value.length > this.settings.maxVisible * 2) {
      this.notifications.value = this.notifications.value.slice(0, this.settings.maxVisible * 2);
    }

    // Auto-remove after duration (skip for progress type or persistent)
    const duration = notification.duration ?? (typeSettings.persistent ? 0 : typeSettings.duration);
    if (duration > 0 && notification.type !== "progress") {
      const timeoutId = window.setTimeout(() => {
        if (!this.pausedTimeouts.value.has(id)) {
          this.removeNotification(id);
        }
      }, duration);
      this.activeTimeouts.value.set(id, timeoutId);
    }

    // Play sound if enabled
    if (this.settings.sound && this.settings.sounds) {
      this.playNotificationSound(notification.type);
    }

    // Show desktop notification if enabled
    if (this.settings.desktop && "Notification" in window) {
      this.showDesktopNotification(newNotification);
    }

    return id;
  }

  private playNotificationSound(type: NotificationType) {
    try {
      const audio = new Audio();
      switch (type) {
        case "success":
          audio.src =
            "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiS2Oy9diMFl2+z5N17SAUuhM3yxnkpBjGH0fPTgjMGHm7A7+OZURE";
          break;
        case "error":
          audio.src =
            "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiS2Oy9diMFl2+z5N17SAUuhM3yxnkpBjGH0fPTgjMGHm7A7+OZURE";
          break;
        case "warning":
          audio.src =
            "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiS2Oy9diMFl2+z5N17SAUuhM3yxnkpBjGH0fPTgjMGHm7A7+OZURE";
          break;
        default:
          audio.src =
            "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiS2Oy9diMFl2+z5N17SAUuhM3yxnkpBjGH0fPTgjMGHm7A7+OZURE";
      }
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (user interaction required)
      });
    } catch (error) {
      // Ignore audio errors
    }
  }

  private showDesktopNotification(notification: Notification) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.message,
        icon: "/favicon.ico",
        tag: notification.id,
      });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(notification.title, {
            body: notification.message,
            icon: "/favicon.ico",
            tag: notification.id,
          });
        }
      });
    }
  }

  updateProgress(id: string, progress: number, message?: string) {
    const notification = this.notifications.value.find((n) => n.id === id);
    if (notification && notification.type === "progress") {
      notification.progress = Math.min(100, Math.max(0, progress));
      if (message) notification.message = message;

      // Auto-dismiss when complete
      if (progress >= 100) {
        setTimeout(() => {
          this.removeNotification(id);
        }, 2000);
      }
    }
  }

  removeNotification(id: string) {
    const index = this.notifications.value.findIndex((n) => n.id === id);
    if (index > -1) {
      this.notifications.value.splice(index, 1);
    }
    // Clear any pending timeout
    const timeoutId = this.activeTimeouts.value.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.activeTimeouts.value.delete(id);
    }
  }

  markAsRead(id: string) {
    const notification = this.notifications.value.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  markAllAsRead() {
    this.notifications.value.forEach((n) => (n.read = true));
  }

  clearAll() {
    // Clear all pending timeouts
    this.activeTimeouts.value.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    this.activeTimeouts.value.clear();
    this.notifications.value = [];
  }

  updateSettings(newSettings: Partial<NotificationSettings>) {
    Object.assign(this.settings, newSettings);
    this.saveSettings();
  }

  initializeSettings() {
    try {
      const savedSettings = localStorage.getItem("notification-settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        Object.assign(this.settings, parsed);
      }
    } catch (error) {
      console.warn("Failed to load notification settings:", error);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem("notification-settings", JSON.stringify(this.settings));
    } catch (error) {
      console.warn("Failed to save notification settings:", error);
    }
  }

  // Convenience methods
  success(title: string, message: string) {
    return this.addNotification({ title, message, type: "success" });
  }

  error(title: string, message: string) {
    return this.addNotification({ title, message, type: "error" });
  }

  warning(title: string, message: string) {
    return this.addNotification({ title, message, type: "warning" });
  }

  info(title: string, message: string) {
    return this.addNotification({ title, message, type: "info" });
  }

  progress(title: string, message: string, initialProgress = 0) {
    return this.addNotification({
      title,
      message,
      type: "progress",
      progress: initialProgress,
      duration: 0,
    });
  }

  // Additional methods needed by NotificationCenter
  get visibleNotifications() {
    return this.notifications.value
      .filter((n) => n.type !== "progress")
      .slice(0, this.settings.maxVisible);
  }

  get activeProgressNotifications() {
    return this.notifications.value.filter(
      (n) => n.type === "progress" && n.progress !== undefined && n.progress < 100
    );
  }

  get recentNotifications() {
    return this.notifications.value;
  }

  // Center panel state (controlled externally via UI)
  private _centerOpen = ref(false);

  get centerOpen() {
    return this._centerOpen.value;
  }

  toggleCenter() {
    this._centerOpen.value = !this._centerOpen.value;
  }

  openCenter() {
    this._centerOpen.value = true;
  }

  closeCenter() {
    this._centerOpen.value = false;
  }

  dismissNotification(id: string) {
    this.removeNotification(id);
  }

  deleteNotification(id: string) {
    this.removeNotification(id);
  }

  pauseDismiss(id: string) {
    this.pausedTimeouts.value.add(id);
  }

  resumeDismiss(id: string) {
    this.pausedTimeouts.value.delete(id);
    // Check if timeout should fire now
    const notification = this.notifications.value.find((n) => n.id === id);
    if (notification && notification.type !== "progress") {
      // Schedule removal after a short delay
      setTimeout(() => {
        this.removeNotification(id);
      }, 1000);
    }
  }
}

// Singleton instance
export const notificationStore = new NotificationStore();

// Composable function for Vue components
export function useNotificationStore() {
  return notificationStore;
}
