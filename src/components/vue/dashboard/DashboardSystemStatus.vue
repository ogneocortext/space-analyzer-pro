<!--
  Dashboard System Status Widget
  Displays system health and status information
-->
<template>
  <div 
    :class="[
      'system-status',
      `status-${systemStatus?.status || 'unknown'}`
    ]"
  >
    <div class="status-header">
      <div class="status-indicator">
        <component :is="getStatusIcon(systemStatus?.status)" class="status-icon" />
      </div>
      <div class="status-info">
        <p class="status-message">{{ systemStatus?.message || 'Status unknown' }}</p>
        <p class="status-time">
          Last checked: {{ formatTime(systemStatus?.lastCheck || new Date()) }}
        </p>
      </div>
      <div class="status-actions">
        <button 
          @click="$emit('refresh-status')"
          :disabled="isRefreshing"
          class="refresh-btn"
          aria-label="Refresh status"
        >
          <RefreshCw :class="{ 'animate-spin': isRefreshing }" class="w-4 h-4" />
        </button>
        <button 
          @click="showDetails = !showDetails"
          class="details-btn"
          aria-label="Toggle details"
        >
          <ChevronDown :class="{ 'rotate-180': showDetails }" class="w-4 h-4" />
        </button>
      </div>
    </div>
    
    <!-- Detailed Status Information -->
    <div v-if="showDetails && systemStatus?.details" class="status-details">
      <div class="details-grid">
        <div class="detail-item">
          <div class="detail-header">
            <Cpu class="w-4 h-4" />
            <span>CPU Usage</span>
          </div>
          <div class="detail-value">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ 
                  width: `${systemStatus.details.cpuUsage || 0}%`,
                  backgroundColor: getProgressColor(systemStatus.details.cpuUsage || 0)
                }"
              ></div>
            </div>
            <span>{{ Math.round(systemStatus.details.cpuUsage || 0) }}%</span>
          </div>
        </div>
        
        <div class="detail-item">
          <div class="detail-header">
            <Database class="w-4 h-4" />
            <span>Memory Usage</span>
          </div>
          <div class="detail-value">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ 
                  width: `${systemStatus.details.memoryUsage || 0}%`,
                  backgroundColor: getProgressColor(systemStatus.details.memoryUsage || 0)
                }"
              ></div>
            </div>
            <span>{{ Math.round(systemStatus.details.memoryUsage || 0) }}%</span>
          </div>
        </div>
        
        <div class="detail-item">
          <div class="detail-header">
            <HardDrive class="w-4 h-4" />
            <span>Disk Usage</span>
          </div>
          <div class="detail-value">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ 
                  width: `${systemStatus.details.diskUsage || 0}%`,
                  backgroundColor: getProgressColor(systemStatus.details.diskUsage || 0)
                }"
              ></div>
            </div>
            <span>{{ Math.round(systemStatus.details.diskUsage || 0) }}%</span>
          </div>
        </div>
        
        <div class="detail-item">
          <div class="detail-header">
            <Wifi class="w-4 h-4" />
            <span>Network</span>
          </div>
          <div class="detail-value">
            <div :class="[
              'network-status',
              `network-${systemStatus.details.networkStatus || 'unknown'}`
            ]">
              <div class="network-indicator"></div>
              <span>{{ formatNetworkStatus(systemStatus.details.networkStatus) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ChevronDown,
  Cpu,
  Database,
  HardDrive,
  Wifi
} from 'lucide-vue-next';
import type { SystemStatus } from '../../../services/DashboardService';

interface Props {
  systemStatus?: SystemStatus | null;
  isRefreshing?: boolean;
}

interface Emits {
  (e: 'refresh-status'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isRefreshing: false,
});

const emit = defineEmits<Emits>();

const showDetails = ref(false);

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'healthy': return CheckCircle;
    case 'warning': return AlertTriangle;
    case 'error': return XCircle;
    default: return AlertTriangle;
  }
};

const getProgressColor = (percentage: number): string => {
  if (percentage >= 90) return '#ef4444'; // red
  if (percentage >= 75) return '#f59e0b'; // yellow
  if (percentage >= 50) return '#3b82f6'; // blue
  return '#22c55e'; // green
};

const formatTime = (date: Date): string => {
  return date.toLocaleString();
};

const formatNetworkStatus = (status?: string): string => {
  switch (status) {
    case 'online': return 'Connected';
    case 'offline': return 'Offline';
    case 'limited': return 'Limited';
    default: return 'Unknown';
  }
};
</script>

<style scoped>
.system-status {
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid;
  margin-bottom: 1.5rem;
  transition: all 0.2s ease;
}

.system-status.status-healthy {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

.system-status.status-warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.system-status.status-error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.system-status.status-unknown {
  background: rgba(107, 114, 128, 0.1);
  border-color: rgba(107, 114, 128, 0.3);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-indicator {
  flex-shrink: 0;
}

.status-icon {
  width: 20px;
  height: 20px;
}

.system-status.status-healthy .status-icon {
  color: #22c55e;
}

.system-status.status-warning .status-icon {
  color: #f59e0b;
}

.system-status.status-error .status-icon {
  color: #ef4444;
}

.system-status.status-unknown .status-icon {
  color: #6b7280;
}

.status-info {
  flex: 1;
  min-width: 0;
}

.status-message {
  font-weight: 500;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
}

.status-time {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
}

.status-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.refresh-btn,
.details-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.375rem;
  color: #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover,
.details-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #d1d5db;
}

.detail-value {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.detail-value span {
  font-size: 0.875rem;
  color: #9ca3af;
  min-width: 40px;
  text-align: right;
}

.network-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.network-status.network-online {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.network-status.network-offline {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.network-status.network-limited {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.network-status.network-unknown {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
}

.network-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.rotate-180 {
  transform: rotate(180deg);
}

@media (max-width: 768px) {
  .status-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .status-info {
    order: 2;
    width: 100%;
  }
  
  .status-actions {
    order: 3;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>