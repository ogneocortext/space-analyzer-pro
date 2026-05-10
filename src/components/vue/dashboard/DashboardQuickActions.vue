<!--
  Dashboard Quick Actions Widget
  Displays quick action buttons for common tasks
-->
<template>
  <div class="quick-actions">
    <div class="section-header">
      <h2 class="section-title">Quick Actions</h2>
      <div class="category-filter" v-if="categories.length > 1">
        <button 
          v-for="category in categories"
          :key="category"
          :class="['category-btn', { active: selectedCategory === category }]"
          @click="$emit('filter-category', category)"
        >
          <component :is="getCategoryIcon(category)" class="w-4 h-4" />
          <span>{{ formatCategoryName(category) }}</span>
        </button>
        <button 
          :class="['category-btn', { active: selectedCategory === null }]"
          @click="$emit('filter-category', null)"
        >
          <Grid3X3 class="w-4 h-4" />
          <span>All</span>
        </button>
      </div>
    </div>
    
    <div class="actions-grid">
      <button
        v-for="action in filteredActions"
        :key="action.id"
        :disabled="action.disabled || isLoading"
        :class="[
          'action-btn',
          { 
            'action-disabled': action.disabled,
            'action-loading': isLoading && selectedActionId === action.id
          }
        ]"
        @click="handleActionClick(action)"
      >
        <div class="action-icon">
          <component :is="getActionIcon(action.icon)" class="w-5 h-5" />
        </div>
        <div class="action-content">
          <p class="action-label">{{ action.label }}</p>
          <p class="action-description">{{ action.description }}</p>
        </div>
        <div class="action-badges">
          <span v-if="action.beta" class="badge badge-beta">Beta</span>
          <span v-if="action.requiresData && !hasAnalysisData" class="badge badge-warning">Needs Data</span>
        </div>
        <div v-if="isLoading && selectedActionId === action.id" class="action-loading-spinner">
          <Loader2 class="w-4 h-4 animate-spin" />
        </div>
      </button>
    </div>
    
    <!-- Empty State -->
    <div v-if="filteredActions.length === 0" class="empty-state">
      <div class="empty-icon">
        <Zap class="w-8 h-8" />
      </div>
      <h3>No actions available</h3>
      <p>{{ selectedCategory ? 'No actions in this category' : 'No actions match your search' }}</p>
      <button v-if="selectedCategory || searchQuery" @click="$emit('clear-filters')" class="clear-btn">
        Clear filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  Play, 
  BrainCircuit, 
  Folder, 
  Settings, 
  FileText, 
  Database, 
  Activity, 
  TrendingUp,
  Loader2,
  Zap,
  Grid3X3
} from 'lucide-vue-next';
import type { QuickAction } from '../../../services/DashboardService';

interface Props {
  actions: QuickAction[];
  selectedCategory?: string | null;
  searchQuery?: string;
  isLoading?: boolean;
  hasAnalysisData?: boolean;
}

interface Emits {
  (e: 'execute-action', action: QuickAction): void;
  (e: 'filter-category', category: string | null): void;
  (e: 'clear-filters'): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectedCategory: null,
  searchQuery: '',
  isLoading: false,
  hasAnalysisData: false,
});

const emit = defineEmits<Emits>();

const selectedActionId = ref<string | null>(null);

const categories = computed(() => {
  const cats = new Set(props.actions.map(action => action.category));
  return Array.from(cats);
});

const filteredActions = computed(() => {
  let actions = props.actions;
  
  // Filter by category
  if (props.selectedCategory) {
    actions = actions.filter(action => action.category === props.selectedCategory);
  }
  
  // Filter by search query
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase();
    actions = actions.filter(action =>
      action.label.toLowerCase().includes(query) ||
      action.description.toLowerCase().includes(query)
    );
  }
  
  return actions;
});

const handleActionClick = async (action: QuickAction) => {
  if (action.disabled || props.isLoading) return;
  
  selectedActionId.value = action.id;
  
  try {
    emit('execute-action', action);
  } finally {
    selectedActionId.value = null;
  }
};

const getActionIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    Play,
    BrainCircuit,
    Folder,
    Settings,
    FileText,
    Database,
    Activity,
    TrendingUp,
  };
  return icons[iconName] || Zap;
};

const getCategoryIcon = (category: string) => {
  const icons: Record<string, any> = {
    analysis: Activity,
    ai: BrainCircuit,
    'file-management': Folder,
    settings: Settings,
  };
  return icons[category] || Grid3X3;
};

const formatCategoryName = (category: string): string => {
  return category.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};
</script>

<style scoped>
.quick-actions {
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.category-filter {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.category-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-btn:hover {
  background: #4b5563;
  border-color: #6b7280;
  color: #d1d5db;
}

.category-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.action-btn:hover:not(.action-disabled) {
  background: #111827;
  border-color: #4b5563;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-btn.action-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #1f2937;
  border-color: #374151;
  color: #6b7280;
}

.action-btn.action-loading {
  pointer-events: none;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #374151;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.action-content {
  flex: 1;
  text-align: left;
  min-width: 0;
}

.action-label {
  font-weight: 500;
  margin: 0 0 0.25rem 0;
  color: #ffffff;
}

.action-description {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
  line-height: 1.4;
}

.action-badges {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.25rem;
  text-transform: uppercase;
}

.badge-beta {
  background: #3b82f6;
  color: #ffffff;
}

.badge-warning {
  background: #f59e0b;
  color: #ffffff;
}

.action-loading-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(31, 41, 55, 0.9);
  border-radius: 0.5rem;
  padding: 0.5rem;
  color: #ffffff;
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

.clear-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  border: none;
  border-radius: 0.5rem;
  color: #ffffff;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: #2563eb;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .category-filter {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .action-btn {
    padding: 0.75rem;
  }
  
  .action-icon {
    width: 32px;
    height: 32px;
  }
}
</style>