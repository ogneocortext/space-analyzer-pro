<template>
  <DesktopLayout>
    <template #header-actions>
      <div class="desktop-header-actions">
        <!-- Notification Bell -->
        <button 
          class="header-action-btn"
          @click="toggleNotifications"
          :class="{ 'has-notifications': hasNotifications }"
          title="Notifications"
        >
          <Bell class="icon" />
          <span v-if="notificationCount > 0" class="notification-count">{{ notificationCount }}</span>
        </button>
        
        <!-- Theme Toggle -->
        <button 
          class="header-action-btn"
          @click="toggleTheme"
          :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <Sun v-if="isDarkMode" class="icon" />
          <Moon v-else class="icon" />
        </button>
        
        <!-- User Menu -->
        <div class="user-menu" ref="userMenuRef">
          <button 
            class="header-action-btn user-avatar"
            @click="toggleUserMenu"
            title="User menu"
          >
            <div class="avatar">
              <User class="icon" />
            </div>
          </button>
          
          <div v-if="userMenuOpen" class="user-dropdown">
            <div class="dropdown-header">
              <span class="username">Desktop User</span>
              <span class="user-role">Administrator</span>
            </div>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" @click="openSettings">
              <Settings class="item-icon" />
              Settings
            </button>
            <button class="dropdown-item" @click="openAbout">
              <Info class="item-icon" />
              About
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" @click="exitApp">
              <LogOut class="item-icon" />
              Exit
            </button>
          </div>
        </div>
      </div>
    </template>
    
    <router-view />
  </DesktopLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  Info,
  LogOut
} from 'lucide-vue-next'
import DesktopLayout from '@/components/vue/desktop/DesktopLayout.vue'
import { useTauriDesktop } from '@/composables/useTauriDesktop'

const router = useRouter()
const { isTauri } = useTauriDesktop()

// Reactive state
const userMenuOpen = ref(false)
const hasNotifications = ref(true)
const notificationCount = ref(3)
const isDarkMode = ref(true)
const userMenuRef = ref<HTMLElement>()

// Computed properties
const currentYear = computed(() => new Date().getFullYear())

// Methods
function toggleNotifications() {
  // Toggle notification panel
  console.log('Toggle notifications')
  hasNotifications.value = false
  notificationCount.value = 0
}

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  // Apply theme to document
  document.documentElement.classList.toggle('light', !isDarkMode.value)
  document.documentElement.classList.toggle('dark', isDarkMode.value)
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function openSettings() {
  userMenuOpen.value = false
  router.push('/settings')
}

function openAbout() {
  userMenuOpen.value = false
  // Show about dialog
  console.log('Show about dialog')
}

async function exitApp() {
  if (isTauri.value) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const mainWindow = getCurrentWindow()
    await mainWindow.close()
  } else {
    window.close()
  }
}

// Close user menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    userMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // Initialize theme
  document.documentElement.classList.add('dark')
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.desktop-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-action-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-action-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #f1f5f9;
}

.header-action-btn.has-notifications {
  color: #fbbf24;
  border-color: #f59e0b;
}

.notification-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  line-height: 1;
}

.user-menu {
  position: relative;
}

.user-avatar {
  padding: 0;
  overflow: hidden;
}

.avatar {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  min-width: 200px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  padding: 12px 16px;
  background: rgba(99, 102, 241, 0.1);
  border-bottom: 1px solid #334155;
}

.username {
  display: block;
  font-weight: 600;
  color: #f1f5f9;
  font-size: 14px;
}

.user-role {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.dropdown-divider {
  height: 1px;
  background: #334155;
  margin: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  text-align: left;
}

.dropdown-item:hover {
  background: rgba(99, 102, 241, 0.1);
  color: #f1f5f9;
}

.item-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.icon {
  width: 18px;
  height: 18px;
}

/* Light theme adjustments */
:global(.light) .header-action-btn {
  border-color: #e2e8f0;
  color: #64748b;
}

:global(.light) .header-action-btn:hover {
  background: rgba(99, 102, 241, 0.05);
  border-color: #6366f1;
  color: #6366f1;
}

:global(.light) .user-dropdown {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

:global(.light) .dropdown-header {
  background: rgba(99, 102, 241, 0.05);
  border-bottom-color: #e2e8f0;
}

:global(.light) .username {
  color: #1e293b;
}

:global(.light) .user-role {
  color: #64748b;
}

:global(.light) .dropdown-divider {
  background: #e2e8f0;
}

:global(.light) .dropdown-item {
  color: #64748b;
}

:global(.light) .dropdown-item:hover {
  background: rgba(99, 102, 241, 0.05);
  color: #6366f1;
}
</style>
