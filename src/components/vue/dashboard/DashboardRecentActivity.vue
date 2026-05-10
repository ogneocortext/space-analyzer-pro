<!--
  Dashboard Recent Activity Widget
  Displays recent system activity and events
-->
<template>
  <div class="recent-activity">
    <div class="section-header">
      <h2 class="section-title">Recent Activity</h2>
      <div class="header-actions">
        <button 
          @click="$emit('refresh-activity')"
          :disabled="isRefreshing"
          class="refresh-btn"
          aria-label="Refresh activity"
        >
          <RefreshCw :class="{ 'animate-spin': isRefreshing }" class="w-4 h-4" />
        </button>
        <button 
          @click="showFilters = !showFilters"
          class="filter-btn"
          aria-label="Toggle filters"
        >
          <Filter class="w-4 h-4" />
        </button>
      </div>
    </div>
    
    <!-- Activity Filters -->
    <div v-if="showFilters" class="activity-filters">
      <div class="filter-group">
        <label class="filter-label">Status:</label>
        <div class="filter-options">
          <button 
            v-for="status in statusOptions"
            :key="status.value"
            :class="['filter-option', { active: selectedStatus === status.value }]"
            @click="selectedStatus = status.value"
          >
            <component :is="status.icon" class="w-3 h-3" />
            <span>{{ status.label }}</span>
          </button>
        </div>
      </div>
      
      <div class="filter-group">
        <label class="filter-label">Category:</label>
        <div class="filter-options">
          <button 
            v-for="category in categoryOptions"
            :key="category.value"
            :class="['filter-option', { active: selectedCategory === category.value }]"
            @click="selectedCategory = category.value"
          >
            <component :is="category.icon" class="w-3 h-3" />
            <span>{{ category.label }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Activity List -->
    <div class="activity-list">
      <div 
        v-for="activity in filteredActivity"
        :key="activity.id"
        :class="['activity-item', `status-${activity.status}`]"
      >
        <div class="activity-icon">
          <component :is="getActivityIcon(activity.status)" class="w-5 h-5" />
        </div>
        <div class="activity-content">
          <p class="activity-action">{{ activity.action }}</p>
          <div class="activity-meta">
            <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
            <span v-if="activity.category" class="activity-category">
              {{ formatCategoryName(activity.category) }}
            </span>
          </div>
          <div v-if="activity.details" class="activity-details">
            <component :is="getDetailsComponent(activity.category)" :details="activity.details" />
          </div>
        </div>
        <div class="activity-actions">
          <button 
            @click="showActivityDetails(activity)"
            class="activity-action-btn"
            aria-label="View details"
          >
            <Info class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-if="filteredActivity.length === 0" class="empty-state">
      <div class="empty-icon">
        <Clock class="w-8 h-8" />
      </div>
      <h3>No recent activity</h3>
      <p>{{ hasActiveFilters ? 'No activity matches your filters' : 'No activity recorded yet' }}</p>
      <button v-if="hasActiveFilters" @click="clearFilters" class="clear-btn">
        Clear filters
      </button>
    </div>
    
    <!-- Load More -->
    <div v-if="filteredActivity.length > 0 && hasMore" class="load-more">
      <button 
        @click="$emit('load-more')"
        :disabled="isLoadingMore"
        class="load-more-btn"
      >
        <Loader2 v-if="isLoadingMore" class="w-4 h-4 animate-spin" />
        <span v-else>Load More</span>
      </button>
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
  Filter, 
  Info, 
  Clock,
  Loader2,
  BarChart3,
  BrainCircuit,
  Folder,
  Settings,
  Cpu
} from 'lucide-vue-next';
import type { ActivityItem } from '../../../services/DashboardService';

interface Props {
  activities: ActivityItem[];
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

interface Emits {
  (e: 'refresh-activity'): void;
  (e: 'load-more'): void;
  (e: 'view-details', activity: ActivityItem): void;
}

const props = withDefaults(defineProps<Props>(), {
  isRefreshing: false,
  isLoadingMore: false,
  hasMore: false,
});

const emit = defineEmits<Emits>();

const showFilters = ref(false);
const selectedStatus = ref<string | null>(null);
const selectedCategory = ref<string | null>(null);

const statusOptions = [
  { value: null, label: 'All', icon: Clock },
  { value: 'success', label: 'Success', icon: CheckCircle },
  { value: 'warning', label: 'Warning', icon: AlertTriangle },
  { value: 'error', label: 'Error', icon: XCircle },
];

const categoryOptions = computed(() => {
  const categories = new Set(props.activities.map(a => a.category).filter(Boolean));
  const categoryMap: Record<string, { label: string; icon: any }> = {
    analysis: { label: 'Analysis', icon: BarChart3 },
    ai: { label: 'AI', icon: BrainCircuit },
    'file-management': { label: 'Files', icon: Folder },
    settings: { label: 'Settings', icon: Settings },
    system: { label: 'System', icon: Cpu },
  };
  
  return [
    { value: null, label: 'All', icon: Clock },
    ...Array.from(categories).map(cat => ({
      value: cat,
      ...categoryMap[cat as string],
    })),
  ];
});

const filteredActivity = computed(() => {
  let activities = props.activities;
  
  if (selectedStatus.value) {
    activities = activities.filter(a => a.status === selectedStatus.value);
  }
  
  if (selectedCategory.value) {
    activities = activities.filter(a => a.category === selectedCategory.value);
  }
  
  return activities;
});

const hasActiveFilters = computed(() => 
  selectedStatus.value !== null || selectedCategory.value !== null
);

const getActivityIcon = (status: string) => {
  switch (status) {
    case 'success': return CheckCircle;
    case 'warning': return AlertTriangle;
    case 'error': return XCircle;
    default: return Info;
  }
};

const getDetailsComponent = (category?: string) => {
  // This would return different detail components based on category
  // For now, we'll use a simple display
  return 'ActivityDetails';
};

const formatTime = (timestamp: Date): string => {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
};

const formatCategoryName = (category: string): string => {
  return category.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const showActivityDetails = (activity: ActivityItem) => {
  emit('view-details', activity);
};

const clearFilters = () => {
  selectedStatus.value = null;
  selectedCategory.value = null;
};
</script>

<style scoped>
.recent-activity {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.refresh-btn,
.filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.375rem;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover,
.filter-btn:hover {
  background: #4b5563;
  color: #d1d5db;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.activity-filters {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #111827;
  border-radius: 0.5rem;
  border: 1px solid #374151;
}

.filter-group {
  margin-bottom: 1rem;
}

.filter-group:last-child {
  margin-bottom: 0;
}

.filter-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #d1d5db;
  margin-bottom: 0.5rem;
}

.filter-options {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.375rem;
  color: #9ca3af;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-option:hover {
  background: #4b5563;
  color: #d1d5db;
}

.filter-option.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #111827;
  border-radius: 0.5rem;
  border: 1px solid #374151;
  transition: all 0.2s ease;
}

.activity-item:hover {
  background: #1f2937;
  border-color: #4b5563;
}

.activity-item.status-success .activity-icon {
  color: #22c55e;
}

.activity-item.status-warning .activity-icon {
  color: #f59e0b;
}

.activity-item.status-error .activity-icon {
  color: #ef4444;
}

.activity-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-action {
  font-weight: 500;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
}

.activity-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.activity-category {
  background: #374151;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.activity-details {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #1f2937;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.activity-actions {
  flex-shrink: 0;
}

.activity-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 0.375rem;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
}

.activity-action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #d1d5db;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: #6b7280;
}

.empty-icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #9ca3af;
}

.empty-state p {
  margin: 0 0 1.5rem 0;
  color: #6b7280;
}

.clear-btn,
.load-more-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  border: none;
  border-radius: 0.5rem;
  color: #ffffff;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn:hover,
.load-more-btn:hover {
  background: #2563eb;
}

.load-more {
  display: flex;
  justify-content: center;
  padding-top: 1rem;
  border-top: 1px solid #374151;
}

.load-more-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .recent-activity {
    padding: 1rem;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .filter-options {
    flex-direction: column;
  }
  
  .activity-item {
    padding: 0.5rem;
  }
  
  .activity-meta {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>