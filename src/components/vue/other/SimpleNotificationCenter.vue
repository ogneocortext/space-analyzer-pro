<template>
  <div class="notification-system">
    <!-- Notification bell trigger -->
    <button
      class="notification-trigger"
      :class="{ 'has-unread': store.unreadCount > 0 }"
      aria-label="Toggle notifications"
      @click="store.toggleCenter"
    >
      <svg
        class="bell-icon"
        :class="{ ringing: store.unreadCount > 0 }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M18 8A6 6 0 0 6 6" />
        <path d="m18 8-6.707 1.707" />
        <path d="m18 8 0 8" />
        <path d="m1 21 4-4 4" />
        <path d="m1 21 4 4" />
      </svg>
      <span v-if="store.unreadCount > 0" class="unread-badge">
        {{ store.unreadCount > 99 ? "99+" : store.unreadCount }}
      </span>
    </button>

    <!-- Toast Notifications -->
    <div
      v-for="notification in store.visibleNotifications"
      v-if="notification && Object.keys(notification).length > 0"
      :key="notification.id"
      class="toast-notification"
      :class="`toast-${notification.type || 'info'}`"
      @mouseenter="store.pauseDismiss(notification.id)"
      @mouseleave="store.resumeDismiss(notification.id)"
    >
      <div class="toast-content">
        <div class="toast-header">
          <h4 class="toast-title">
            {{ notification.title || "Notification" }}
          </h4>
          <button class="toast-close" @click="store.dismissNotification(notification.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
              <path
                d="m6 6 1.414 1.414L19.586 19.586a2 2 0 0 0-2.828 0-2.828L6.172 17.172a4 4 0 0 0-4-4.657-4.657"
              />
            </svg>
          </button>
          <p class="toast-message" v-html="notification.message || ''" />

          <!-- Link -->
          <a v-if="notification.link" class="toast-link" @click="handleLinkClick(notification)">
            {{ notification.link?.text || "Link" }} →
          </a>

          <!-- Actions -->
          <div v-if="notification.actions && notification.actions.length > 0" class="toast-actions">
            <button
              v-for="action in notification.actions"
              :key="action.label"
              class="toast-action-btn"
              @click="handleAction(notification, action)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
// Using simple SVG icons instead of lucide-vue-next to avoid import issues
import {
  useNotificationStore,
  type Notification,
  type NotificationAction,
} from "@/store/notificationStore";

const store = useNotificationStore();
const router = useRouter();

onMounted(() => {
  store.initializeSettings();
});

const handleLinkClick = (notification: Notification) => {
  if (notification.link?.path) {
    router.push(notification.link.path);
    store.closeCenter();
  } else if (notification.link?.text) {
    console.warn("Link clicked:", notification.link.text);
  }
};

const handleAction = (notification: Notification, action: NotificationAction) => {
  action.action();

  // Dismiss notification if it's a one-time action (not for progress)
  if (notification.type !== "progress") {
    store.dismissNotification(notification.id);
  }
};
</script>

<style scoped>
/* Notification Bell */
.notification-trigger {
  position: relative;
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
  font-size: 20px;
}

.notification-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
}

.unread-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.notification-trigger.has-unread .notification-trigger {
  animation: bell-ring 2s ease-in-out infinite;
}

@keyframes bell-ring {
  0%,
  100% {
    transform: rotate(0);
  }
  10%,
  30%,
  50% {
    transform: rotate(10deg);
  }
  20%,
  40% {
    transform: rotate(-10deg);
  }
}

/* Toast Notifications */
.toast-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #1e293b;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  min-width: 320px;
  max-width: 400px;
  border: 1px solid #334155;
  z-index: 9999;
}

/* Toast Types */
.toast-success {
  border-left: 4px solid #10b981;
}

.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-progress {
  border-left: 4px solid #8b5cf6;
}

.toast-content {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.toast-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.toast-close {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #9ca3af;
  font-size: 14px;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.2s;
}

.toast-close:hover {
  background: #334155;
  color: #e2e8f0;
}

.toast-message {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.5;
}

.toast-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 13px;
  color: #3b82f6;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}

.toast-link:hover {
  text-decoration: underline;
}

.toast-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.toast-action-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #334155;
  color: #e2e8f0;
  transition: all 0.2s;
}

.toast-action-btn:hover {
  background: #475569;
}
</style>
