<template>
  <div class="notification-settings">
    <div class="settings-header">
      <h2>🔔 Notification Settings</h2>
      <p class="settings-subtitle">Customize how and when you receive notifications</p>
    </div>

    <!-- General Settings -->
    <section class="settings-section">
      <h3>General</h3>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Enable Notifications</label>
          <p class="setting-description">Show notification toasts and alerts</p>
        </div>
        <label class="toggle">
          <input v-model="store.settings.enabled" type="checkbox" @change="saveSettings" />
          <span class="toggle-slider" />
        </label>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Position</label>
          <p class="setting-description">Where notifications appear on screen</p>
        </div>
        <select v-model="store.settings.position" class="setting-select" @change="saveSettings">
          <option value="top-right">Top Right</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="top-center">Top Center</option>
          <option value="bottom-center">Bottom Center</option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Default Duration</label>
          <p class="setting-description">How long notifications stay visible (seconds)</p>
        </div>
        <div class="setting-input-group">
          <input
            v-model.number="store.settings.duration"
            type="range"
            min="1000"
            max="10000"
            step="500"
            class="setting-slider"
            @change="saveSettings"
          />
          <span class="setting-value">{{ Math.round(store.settings.duration / 1000) }}s</span>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Max Visible</label>
          <p class="setting-description">Maximum notifications shown at once</p>
        </div>
        <select
          v-model.number="store.settings.maxVisible"
          class="setting-select"
          @change="saveSettings"
        >
          <option :value="3">3 notifications</option>
          <option :value="5">5 notifications</option>
          <option :value="7">7 notifications</option>
          <option :value="10">10 notifications</option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-label">Sound Effects</label>
          <p class="setting-description">Play sounds for important notifications</p>
        </div>
        <label class="toggle">
          <input v-model="store.settings.sounds" type="checkbox" @change="saveSettings" />
          <span class="toggle-slider" />
        </label>
      </div>
    </section>

    <!-- Notification Types -->
    <section class="settings-section">
      <h3>Notification Types</h3>
      <p class="section-description">Customize behavior for each notification type</p>

      <div
        v-for="type in notificationTypes"
        :key="type.key"
        class="type-card"
        :class="`type-${type.key}`"
      >
        <div class="type-header">
          <div class="type-icon">
            {{ type.icon }}
          </div>
          <div class="type-info">
            <h4>{{ type.label }}</h4>
            <p>{{ type.description }}</p>
          </div>
          <label class="toggle">
            <input
              v-model="store.settings.types[type.key].enabled"
              type="checkbox"
              @change="saveTypeSettings(type.key)"
            />
            <span class="toggle-slider" />
          </label>
        </div>

        <div v-if="store.settings.types[type.key].enabled" class="type-settings">
          <div class="type-setting-row">
            <label class="checkbox-label">
              <input
                v-model="store.settings.types[type.key].persistent"
                type="checkbox"
                @change="saveTypeSettings(type.key)"
              />
              Stay until dismissed (no auto-hide)
            </label>
          </div>

          <div v-if="!store.settings.types[type.key].persistent" class="type-setting-row">
            <label>Duration</label>
            <div class="setting-input-group">
              <input
                v-model.number="store.settings.types[type.key].duration"
                type="range"
                min="1000"
                max="15000"
                step="500"
                class="setting-slider"
                @change="saveTypeSettings(type.key)"
              />
              <span class="setting-value">
                {{ Math.round(store.settings.types[type.key].duration / 1000) }}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Test Notifications -->
    <section class="settings-section">
      <h3>Test Notifications</h3>
      <p class="section-description">Send test notifications to preview your settings</p>

      <div class="test-buttons">
        <button class="test-btn test-success" @click="sendTestNotification('success')">
          ✅ Test Success
        </button>
        <button class="test-btn test-error" @click="sendTestNotification('error')">
          ❌ Test Error
        </button>
        <button class="test-btn test-warning" @click="sendTestNotification('warning')">
          ⚠️ Test Warning
        </button>
        <button class="test-btn test-info" @click="sendTestNotification('info')">
          ℹ️ Test Info
        </button>
        <button class="test-btn test-progress" @click="sendTestProgress()">📊 Test Progress</button>
      </div>
    </section>

    <!-- Actions -->
    <section class="settings-section">
      <h3>Actions</h3>

      <div class="action-buttons">
        <button class="action-btn secondary" @click="resetToDefaults">↺ Reset to Defaults</button>
        <button class="action-btn danger" @click="clearAllNotifications">
          🗑️ Clear All Notifications
        </button>
      </div>
    </section>

    <!-- Notification Stats -->
    <section v-if="stats.total > 0" class="settings-section">
      <h3>Statistics</h3>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.total }}
          </div>
          <div class="stat-label">Total Notifications</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.unread }}
          </div>
          <div class="stat-label">Unread</div>
        </div>
        <div v-for="type in notificationTypes" :key="type.key" class="stat-card">
          <div class="stat-value">
            {{ stats.byType[type.key] || 0 }}
          </div>
          <div class="stat-label">
            {{ type.label }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useNotificationStore, type NotificationType } from "@/stores/notificationStore";

const store = useNotificationStore();

onMounted(() => {
  store.initializeSettings();
});

const notificationTypes = [
  {
    key: "success" as NotificationType,
    icon: "✅",
    label: "Success",
    description: "Operations completed successfully",
  },
  {
    key: "error" as NotificationType,
    icon: "❌",
    label: "Error",
    description: "Failures requiring attention",
  },
  {
    key: "warning" as NotificationType,
    icon: "⚠️",
    label: "Warning",
    description: "Non-critical issues",
  },
  {
    key: "info" as NotificationType,
    icon: "ℹ️",
    label: "Info",
    description: "General updates and information",
  },
  {
    key: "progress" as NotificationType,
    icon: "📊",
    label: "Progress",
    description: "Long-running operations",
  },
];

const stats = computed(() => {
  const total = store.notifications.length;
  const unread = store.notifications.filter((n) => !n.read).length;
  const byType: Record<string, number> = {};

  notificationTypes.forEach((type) => {
    byType[type.key] = store.notifications.filter((n) => n.type === type.key).length;
  });

  return { total, unread, byType };
});

function saveSettings() {
  store.saveSettings();
}

function saveTypeSettings(type: NotificationType) {
  store.updateTypeSettings(type, store.settings.types[type]);
}

function sendTestNotification(type: NotificationType) {
  const messages: Record<NotificationType, { title: string; message: string }> = {
    success: {
      title: "Success!",
      message: "This is a <strong>success</strong> notification test with <em>HTML</em> support.",
    },
    error: {
      title: "Error!",
      message: "This is an <strong>error</strong> notification test. Something went wrong!",
    },
    warning: {
      title: "Warning",
      message: "This is a <strong>warning</strong> notification. Please check your settings.",
    },
    info: {
      title: "Information",
      message: "This is an <strong>info</strong> notification with details for you.",
    },
    progress: {
      title: "Progress",
      message: "Test progress notification (use Test Progress button instead)",
    },
  };

  const { title, message } = messages[type];

  store.addNotification({
    type,
    title,
    message,
    actions:
      type === "success"
        ? [
            {
              label: "View Details",
              handler: () => console.log("View details clicked"),
              variant: "primary",
            },
            {
              label: "Dismiss",
              handler: () => console.log("Dismiss clicked"),
              variant: "secondary",
            },
          ]
        : undefined,
    link:
      type === "info"
        ? {
            text: "Learn more",
            path: "/settings",
          }
        : undefined,
  });
}

let progressInterval: ReturnType<typeof setInterval> | null = null;

function sendTestProgress() {
  const id = store.progress("Processing Files", "Analyzing directory structure...", 0, {
    actions: [
      {
        label: "Cancel",
        handler: () => {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          store.dismissNotification(id);
          store.info("Cancelled", "Operation was cancelled by user");
        },
        variant: "danger",
      },
    ],
  });

  let progress = 0;
  progressInterval = setInterval(() => {
    progress += 10;
    store.updateProgress(id, progress, `Processing... ${progress}%`);

    if (progress >= 100) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      setTimeout(() => {
        store.dismissNotification(id);
        store.success("Complete!", "Test progress operation finished successfully");
      }, 500);
    }
  }, 500);
}

function resetToDefaults() {
  if (confirm("Reset all notification settings to defaults?")) {
    localStorage.removeItem("notification-settings");
    window.location.reload();
  }
}

function clearAllNotifications() {
  if (confirm("Clear all notification history? This cannot be undone.")) {
    store.clearAll();
  }
}
</script>

<style scoped>
.notification-settings {
  max-width: 800px;
  padding: 24px;
}

.settings-header {
  margin-bottom: 32px;
}

.settings-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px;
}

.settings-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.settings-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.settings-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px;
}

.section-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px;
}

/* Setting Items */
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #f3f4f6;
}

.setting-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-info {
  flex: 1;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
}

.setting-description {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

/* Toggle Switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e7eb;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #3b82f6;
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

/* Select */
.setting-select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 160px;
}

.setting-select:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Slider */
.setting-input-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.setting-slider {
  width: 140px;
  height: 4px;
  border-radius: 2px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
}

.setting-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

.setting-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
}

.setting-value {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  min-width: 40px;
}

/* Type Cards */
.type-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}

.type-success {
  border-left: 4px solid #10b981;
}

.type-error {
  border-left: 4px solid #ef4444;
}

.type-warning {
  border-left: 4px solid #f59e0b;
}

.type-info {
  border-left: 4px solid #3b82f6;
}

.type-progress {
  border-left: 4px solid #8b5cf6;
}

.type-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.type-icon {
  font-size: 24px;
}

.type-info {
  flex: 1;
}

.type-info h4 {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px;
}

.type-info p {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.type-settings {
  padding: 0 16px 16px 52px;
  border-top: 1px solid #f3f4f6;
}

.type-setting-row {
  padding: 12px 0;
}

.type-setting-row label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #4b5563;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #3b82f6;
}

/* Test Buttons */
.test-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.test-btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s;
}

.test-success {
  background: #d1fae5;
  border-color: #10b981;
  color: #065f46;
}

.test-success:hover {
  background: #a7f3d0;
}

.test-error {
  background: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}

.test-error:hover {
  background: #fecaca;
}

.test-warning {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.test-warning:hover {
  background: #fde68a;
}

.test-info {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1e40af;
}

.test-info:hover {
  background: #bfdbfe;
}

.test-progress {
  background: #ede9fe;
  border-color: #8b5cf6;
  color: #5b21b6;
}

.test-progress:hover {
  background: #ddd6fe;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s;
}

.action-btn.secondary {
  background: #f3f4f6;
  border-color: #e5e7eb;
  color: #4b5563;
}

.action-btn.secondary:hover {
  background: #e5e7eb;
}

.action-btn.danger {
  background: #fee2e2;
  border-color: #ef4444;
  color: #dc2626;
}

.action-btn.danger:hover {
  background: #fecaca;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}

.stat-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

/* Responsive */
@media (max-width: 640px) {
  .notification-settings {
    padding: 16px;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .type-header {
    flex-wrap: wrap;
  }

  .type-settings {
    padding-left: 16px;
  }

  .test-buttons {
    justify-content: center;
  }
}
</style>
