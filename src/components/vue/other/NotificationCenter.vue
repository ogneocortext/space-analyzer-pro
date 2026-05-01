<template>
  <div class="notification-system">
    <!-- Bell Icon with Badge -->
    <button
      class="notification-bell"
      :class="{ 'has-unread': store.unreadCount > 0 }"
      title="Notifications"
      aria-label="Open notifications"
      @click="store.toggleCenter()"
    >
      <span class="bell-icon" aria-hidden="true">🔔</span>
      <span v-if="store.unreadCount > 0" class="unread-badge">
        {{ store.unreadCount > 99 ? "99+" : store.unreadCount }}
      </span>
    </button>

    <!-- Toast Notifications -->
    <TransitionGroup
      name="toast"
      tag="div"
      class="toast-container"
      :class="store.settings.position"
    >
      <div
        v-for="notification in store.visibleNotifications"
        :key="notification.id"
        class="toast-notification"
        :class="[`toast-${notification.type}`, { 'toast-persistent': !notification.duration }]"
        @mouseenter="pauseDismiss(notification.id)"
        @mouseleave="resumeDismiss(notification.id)"
      >
        <!-- Progress Bar for Progress Notifications -->
        <div
          v-if="notification.type === 'progress' && notification.progress !== undefined"
          class="toast-progress-bar"
        >
          <div class="toast-progress-fill" :style="{ width: `${notification.progress}%` }" />
        </div>

        <div class="toast-content">
          <!-- Icon -->
          <div v-if="notification.icon" class="toast-icon">
            {{ notification.icon }}
          </div>

          <!-- Image Thumbnail -->
          <div v-else-if="notification.image" class="toast-image">
            <img :src="notification.image" alt="Notification" />
          </div>

          <!-- Text Content -->
          <div class="toast-text">
            <div class="toast-header">
              <h4 class="toast-title">
                {{ notification.title }}
              </h4>
              <button class="toast-close" @click="store.dismissNotification(notification.id)">
                ✕
              </button>
            </div>
            <p class="toast-message" v-html="notification.message" />

            <!-- Progress Text -->
            <p
              v-if="notification.type === 'progress' && notification.progress !== undefined"
              class="toast-progress-text"
            >
              {{ notification.progress }}% complete
            </p>

            <!-- Link -->
            <a v-if="notification.link" class="toast-link" @click="handleLinkClick(notification)">
              {{ notification.link.text }} →
            </a>

            <!-- Actions -->
            <div v-if="notification.actions?.length" class="toast-actions">
              <button
                v-for="action in notification.actions"
                :key="action.label"
                class="toast-action-btn"
                :class="`action-${action.variant || 'secondary'}`"
                @click="handleAction(notification, action)"
              >
                {{ action.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>

    <!-- Notification Center Slide-out Panel -->
    <Transition name="slide">
      <div v-if="store.centerOpen" class="notification-overlay" @click.self="store.closeCenter()">
        <div class="notification-center">
          <!-- Header -->
          <div class="nc-header">
            <h3>Notifications</h3>
            <div class="nc-actions">
              <button
                class="nc-btn"
                :disabled="store.unreadCount === 0"
                @click="store.markAllAsRead()"
              >
                Mark all read
              </button>
              <button
                class="nc-btn nc-btn-danger"
                :disabled="store.recentNotifications.length === 0"
                @click="confirmClearAll()"
              >
                Clear all
              </button>
              <button class="nc-close" @click="store.closeCenter()">✕</button>
            </div>
          </div>

          <!-- Filter Tabs -->
          <div class="nc-filters">
            <button
              class="nc-filter"
              :class="{ active: activeFilter === 'all' }"
              @click="activeFilter = 'all'"
            >
              All ({{ store.notifications.length }})
            </button>
            <button
              class="nc-filter"
              :class="{ active: activeFilter === 'unread' }"
              @click="activeFilter = 'unread'"
            >
              Unread ({{ store.unreadCount }})
            </button>
            <button
              v-for="type in notificationTypes"
              :key="type"
              class="nc-filter"
              :class="{ active: activeFilter === type }"
              @click="activeFilter = type"
            >
              {{ type.charAt(0).toUpperCase() + type.slice(1) }}
              ({{ countByType(type) }})
            </button>
          </div>

          <!-- Notification List -->
          <div class="nc-list">
            <div
              v-for="notification in filteredNotifications"
              :key="notification.id"
              class="nc-item"
              :class="[`nc-item-${notification.type}`, { unread: !notification.read }]"
              @click="handleNotificationClick(notification)"
            >
              <!-- Icon -->
              <div class="nc-item-icon">
                {{ notification.icon }}
              </div>

              <!-- Content -->
              <div class="nc-item-content">
                <div class="nc-item-header">
                  <h4 class="nc-item-title">
                    {{ notification.title }}
                  </h4>
                  <span class="nc-item-time">{{ formatTime(notification.createdAt) }}</span>
                </div>
                <p class="nc-item-message" v-html="notification.message" />

                <!-- Progress -->
                <div
                  v-if="notification.type === 'progress' && notification.progress !== undefined"
                  class="nc-item-progress"
                >
                  <div class="nc-progress-bar">
                    <div class="nc-progress-fill" :style="{ width: `${notification.progress}%` }" />
                  </div>
                  <span class="nc-progress-text">{{ notification.progress }}%</span>
                </div>

                <!-- Actions -->
                <div v-if="notification.actions?.length" class="nc-item-actions">
                  <button
                    v-for="action in notification.actions"
                    :key="action.label"
                    class="nc-action-btn"
                    @click.stop="handleAction(notification, action)"
                  >
                    {{ action.label }}
                  </button>
                </div>

                <!-- Link -->
                <a
                  v-if="notification.link"
                  class="nc-item-link"
                  @click.stop="handleLinkClick(notification)"
                >
                  {{ notification.link.text }} →
                </a>
              </div>

              <!-- Item Actions -->
              <div class="nc-item-menu">
                <button
                  v-if="!notification.read"
                  class="nc-menu-btn"
                  title="Mark as read"
                  @click.stop="store.markAsRead(notification.id)"
                >
                  👁️
                </button>
                <button
                  class="nc-menu-btn"
                  title="Delete"
                  @click.stop="store.deleteNotification(notification.id)"
                >
                  🗑️
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="filteredNotifications.length === 0" class="nc-empty">
              <div class="nc-empty-icon">🔔</div>
              <p v-if="activeFilter === 'unread'">No unread notifications</p>
              <p v-else-if="activeFilter !== 'all'">No {{ activeFilter }} notifications</p>
              <p v-else>No notifications yet</p>
            </div>
          </div>

          <!-- Footer with Settings Link -->
          <div class="nc-footer">
            <button class="nc-settings-link" @click="openSettings()">
              ⚙️ Notification Settings
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Clear All Confirmation Modal -->
    <div v-if="showClearConfirm" class="nc-modal-overlay" @click.self="showClearConfirm = false">
      <div class="nc-modal">
        <h4>Clear All Notifications?</h4>
        <p>
          This will permanently delete all {{ store.recentNotifications.length }} notifications from
          your history.
        </p>
        <div class="nc-modal-actions">
          <button class="nc-btn" @click="showClearConfirm = false">Cancel</button>
          <button class="nc-btn nc-btn-danger" @click="clearAllConfirmed()">Clear All</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  useNotificationStore,
  type Notification,
  type NotificationAction,
  type NotificationType,
} from "@/stores/notificationStore";

const store = useNotificationStore();
const router = useRouter();

onMounted(() => {
  store.initializeSettings();
});

const activeFilter = ref<"all" | "unread" | NotificationType>("all");
const showClearConfirm = ref(false);
const pausedTimeouts = ref<Set<string>>(new Set());

const notificationTypes: NotificationType[] = ["success", "error", "warning", "info", "progress"];

const filteredNotifications = computed(() => {
  let notifications = store.recentNotifications;

  if (activeFilter.value === "unread") {
    notifications = notifications.filter((n) => !n.read);
  } else if (activeFilter.value !== "all") {
    notifications = notifications.filter((n) => n.type === activeFilter.value);
  }

  return notifications;
});

function countByType(type: NotificationType): number {
  return store.notifications.filter((n) => n.type === type && !n.dismissed).length;
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function handleNotificationClick(notification: Notification) {
  store.markAsRead(notification.id);

  if (notification.link) {
    handleLinkClick(notification);
  }
}

function handleLinkClick(notification: Notification) {
  if (notification.link?.path) {
    router.push(notification.link.path);
    store.closeCenter();
  }
}

function handleAction(notification: Notification, action: NotificationAction) {
  action.handler();

  // Dismiss notification if it's a one-time action
  if (!notification.type === "progress") {
    store.dismissNotification(notification.id);
  }
}

function pauseDismiss(id: string) {
  pausedTimeouts.value.add(id);
}

function resumeDismiss(id: string) {
  pausedTimeouts.value.delete(id);
}

function confirmClearAll() {
  showClearConfirm.value = true;
}

function clearAllConfirmed() {
  store.clearAll();
  showClearConfirm.value = false;
}

function openSettings() {
  store.closeCenter();
  router.push("/settings/notifications");
}
</script>

<style scoped>
/* Notification Bell */
.notification-bell {
  position: relative;
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}

.notification-bell:hover {
  background: rgba(255, 255, 255, 0.1);
}

.bell-icon {
  font-size: 20px;
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

.notification-bell.has-unread .bell-icon {
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

/* Toast Container */
.toast-container {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
  pointer-events: none;
}

.toast-container.top-right {
  top: 20px;
  right: 20px;
}

.toast-container.bottom-right {
  bottom: 20px;
  right: 20px;
}

.toast-container.top-center {
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.toast-container.bottom-center {
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
}

/* Toast Notification */
.toast-notification {
  background: #1e293b;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  pointer-events: auto;
  min-width: 320px;
  border: 1px solid #334155;
}

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

.toast-progress-bar {
  height: 3px;
  background: #e5e7eb;
}

.toast-progress-fill {
  height: 100%;
  background: #8b5cf6;
  transition: width 0.3s ease;
}

.toast-content {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.toast-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.toast-image {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.toast-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.toast-text {
  flex: 1;
  min-width: 0;
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

.toast-progress-text {
  font-size: 12px;
  color: #8b5cf6;
  margin: 4px 0 0;
  font-weight: 500;
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
  transition: all 0.2s;
}

.action-primary {
  background: #3b82f6;
  color: white;
}

.action-primary:hover {
  background: #2563eb;
}

.action-secondary {
  background: #334155;
  color: #e2e8f0;
}

.action-secondary:hover {
  background: #475569;
}

.action-danger {
  background: #ef4444;
  color: white;
}

.action-danger:hover {
  background: #dc2626;
}

/* Toast Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Notification Center Overlay */
.notification-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  z-index: 10000;
}

/* Notification Center Panel */
.notification-center {
  position: fixed;
  top: 0;
  right: 0;
  width: 420px;
  height: 100vh;
  background: #0f172a;
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  border-left: 1px solid #1e293b;
}

/* Slide Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from .notification-center,
.slide-leave-to .notification-center {
  transform: translateX(100%);
}

.slide-enter-from .notification-overlay,
.slide-leave-to .notification-overlay {
  opacity: 0;
}

/* NC Header */
.nc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #1e293b;
  background: #0f172a;
}

.nc-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #f1f5f9;
}

.nc-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nc-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #334155;
  background: #1e293b;
  color: #cbd5e1;
  transition: all 0.2s;
}

.nc-btn:hover:not(:disabled) {
  background: #334155;
  border-color: #475569;
}

.nc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-btn-danger {
  color: #f87171;
  border-color: #7f1d1d;
}

.nc-btn-danger:hover:not(:disabled) {
  background: #7f1d1d;
  border-color: #ef4444;
}

.nc-close {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  font-size: 18px;
  color: #64748b;
  line-height: 1;
  margin-left: 8px;
}

.nc-close:hover {
  color: #e2e8f0;
}

/* NC Filters */
.nc-filters {
  display: flex;
  gap: 8px;
  padding: 12px 24px;
  border-bottom: 1px solid #1e293b;
  overflow-x: auto;
  scrollbar-width: none;
  background: #0f172a;
}

.nc-filters::-webkit-scrollbar {
  display: none;
}

.nc-filter {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #1e293b;
  color: #94a3b8;
  white-space: nowrap;
  transition: all 0.2s;
}

.nc-filter:hover {
  background: #334155;
}

.nc-filter.active {
  background: #3b82f6;
  color: white;
}

/* NC List */
.nc-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.nc-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
  border-left: 3px solid transparent;
}

.nc-item:hover {
  background: #1e293b;
}

.nc-item.unread {
  background: #1e3a5f;
}

.nc-item.unread:hover {
  background: #254770;
}

.nc-item-success {
  border-left-color: #10b981;
}

.nc-item-error {
  border-left-color: #ef4444;
}

.nc-item-warning {
  border-left-color: #f59e0b;
}

.nc-item-info {
  border-left-color: #3b82f6;
}

.nc-item-progress {
  border-left-color: #8b5cf6;
}

.nc-item-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.nc-item-content {
  flex: 1;
  min-width: 0;
}

.nc-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}

.nc-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.nc-item-time {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.nc-item-message {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.5;
}

.nc-item-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.nc-progress-bar {
  flex: 1;
  height: 4px;
  background: #334155;
  border-radius: 2px;
  overflow: hidden;
}

.nc-progress-fill {
  height: 100%;
  background: #8b5cf6;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.nc-progress-text {
  font-size: 12px;
  color: #a78bfa;
  font-weight: 500;
  white-space: nowrap;
}

.nc-item-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.nc-action-btn {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #334155;
  color: #e2e8f0;
  transition: all 0.2s;
}

.nc-action-btn:hover {
  background: #475569;
}

.nc-item-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 13px;
  color: #3b82f6;
  font-weight: 500;
  text-decoration: none;
}

.nc-item-link:hover {
  text-decoration: underline;
}

.nc-item-menu {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.nc-item:hover .nc-item-menu {
  opacity: 1;
}

.nc-menu-btn {
  padding: 4px 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  border-radius: 4px;
  transition: all 0.2s;
}

.nc-menu-btn:hover {
  background: #334155;
}

/* NC Empty */
.nc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  color: #64748b;
}

.nc-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.nc-empty p {
  font-size: 14px;
  margin: 0;
}

/* NC Footer */
.nc-footer {
  padding: 16px 24px;
  border-top: 1px solid #1e293b;
  background: #0f172a;
}

.nc-settings-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #334155;
  background: #1e293b;
  color: #cbd5e1;
  transition: all 0.2s;
}

.nc-settings-link:hover {
  background: #334155;
  border-color: #475569;
}

/* Confirmation Modal */
.nc-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nc-modal {
  background: #1e293b;
  padding: 24px;
  border-radius: 16px;
  max-width: 360px;
  text-align: center;
  border: 1px solid #334155;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.nc-modal h4 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.nc-modal p {
  margin: 0 0 20px;
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.5;
}

.nc-modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* Responsive */
@media (max-width: 640px) {
  .notification-center {
    width: 100%;
  }

  .toast-container {
    left: 16px;
    right: 16px;
    max-width: none;
  }

  .toast-container.top-right,
  .toast-container.bottom-right {
    left: 16px;
    right: 16px;
  }
}
</style>
