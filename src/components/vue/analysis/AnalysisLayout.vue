<!--
  Analysis Layout Component
  Provides layout structure for analysis views
-->
<template>
  <div class="analysis-layout">
    <!-- Analysis Header -->
    <header class="analysis-header">
      <div class="header-content">
        <div class="header-left">
          <button 
            @click="$emit('toggle-sidebar')"
            class="sidebar-toggle"
            aria-label="Toggle sidebar"
          >
            <Menu class="w-5 h-5" />
          </button>
          <div class="header-title">
            <h1>Analysis Center</h1>
            <p>Comprehensive file analysis and insights</p>
          </div>
        </div>
        
        <div class="header-right">
          <!-- Analysis Controls -->
          <div class="analysis-controls">
            <button 
              @click="$emit('start-analysis')"
              :disabled="isAnalysisRunning"
              class="control-btn primary"
              aria-label="Start analysis"
            >
              <Play class="w-4 h-4" />
              <span v-if="!isAnalysisRunning">Start Analysis</span>
              <span v-else>Running...</span>
            </button>
            
            <button 
              @click="$emit('cancel-analysis')"
              :disabled="!isAnalysisRunning"
              class="control-btn cancel"
              aria-label="Cancel analysis"
            >
              <X class="w-4 h-4" />
              <span>Cancel</span>
            </button>
            
            <button 
              @click="$emit('export-results')"
              :disabled="!hasResults"
              class="control-btn secondary"
              aria-label="Export results"
            >
              <Download class="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
          
          <!-- Quick Actions -->
          <div class="quick-actions">
            <button 
              @click="$emit('view-analyzers')"
              class="quick-action-btn"
              aria-label="Configure analyzers"
            >
              <Settings class="w-4 h-4" />
              <span>Analyzers</span>
            </button>
            
            <button 
              @click="$emit('view-history')"
              class="quick-action-btn"
              aria-label="View analysis history"
            >
              <Clock class="w-4 h-4" />
              <span>History</span>
            </button>
            
            <button 
              @click="$emit('view-settings')"
              class="quick-action-btn"
              aria-label="Analysis settings"
            >
              <Sliders class="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="analysis-main">
      <!-- Sidebar -->
      <aside v-if="!sidebarCollapsed" class="analysis-sidebar">
        <nav class="sidebar-nav">
          <!-- Analysis Overview -->
          <div class="nav-section">
            <h3 class="nav-section-title">Analysis</h3>
            <ul class="nav-list">
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'overview' }]"
                  @click="navigateTo('overview')"
                >
                  <BarChart3 class="w-4 h-4" />
                  <span>Overview</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'progress' }]"
                  @click="navigateTo('progress')"
                >
                  <Activity class="w-4 h-4" />
                  <span>Progress</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'results' }]"
                  @click="navigateTo('results')"
                >
                  <CheckCircle class="w-4 h-4" />
                  <span>Results</span>
                </button>
              </li>
            </ul>
          </div>
          
          <!-- Analyzer Categories -->
          <div class="nav-section">
            <h3 class="nav-section-title">Analyzers</h3>
            <ul class="nav-list">
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'code' }]"
                  @click="navigateTo('code')"
                >
                  <Code class="w-4 h-4" />
                  <span>Code</span>
                  <span class="badge">{{ analyzerCountByCategory.code }}</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'security' }]"
                  @click="navigateTo('security')"
                >
                  <Shield class="w-4 h-4" />
                  <span>Security</span>
                  <span class="badge">{{ analyzerCountByCategory.security }}</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'performance' }]"
                  @click="navigateTo('performance')"
                >
                  <Zap class="w-4 h-4" />
                  <span>Performance</span>
                  <span class="badge">{{ analyzerCountByCategory.performance }}</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'storage' }]"
                  @click="navigateTo('storage')"
                >
                  <Database class="w-4 h-4" />
                  <span>Storage</span>
                  <span class="badge">{{ analyzerCountByCategory.storage }}</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'general' }]"
                  @click="navigateTo('general')"
                >
                  <Settings class="w-4 h-4" />
                  <span>General</span>
                  <span class="badge">{{ analyzerCountByCategory.general }}</span>
                </button>
              </li>
            </ul>
          </div>
          
          <!-- Tools -->
          <div class="nav-section">
            <h3 class="nav-section-title">Tools</h3>
            <ul class="nav-list">
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'file-browser' }]"
                  @click="navigateTo('file-browser')"
                >
                  <Folder class="w-4 h-4" />
                  <span>File Browser</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'duplicate-finder' }]"
                  @click="navigateTo('duplicate-finder')"
                >
                  <Copy class="w-4 h-4" />
                  <span>Duplicates</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'size-analyzer' }]"
                  @click="navigateTo('size-analyzer')"
                >
                  <TrendingUp class="w-4 h-4" />
                  <span>Size Analysis</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      <!-- Content Area -->
      <div class="analysis-content">
        <!-- Breadcrumbs -->
        <nav v-if="breadcrumbs.length > 0" class="breadcrumbs">
          <ol class="breadcrumb-list">
            <li v-for="(crumb, index) in breadcrumbs" :key="index">
              <button 
                v-if="index < breadcrumbs.length - 1"
                @click="navigateTo(crumb.path)"
                class="breadcrumb-link"
              >
                {{ crumb.label }}
              </button>
              <span v-else class="breadcrumb-current">{{ crumb.label }}</span>
              <ChevronRight v-if="index < breadcrumbs.length - 1" class="breadcrumb-separator" />
            </li>
          </ol>
        </nav>

        <!-- Content Slot -->
        <div class="content-area">
          <slot />
        </div>
      </div>
    </main>

    <!-- Analysis Status Banner -->
    <div v-if="showStatusBanner" class="status-banner">
      <div class="status-content">
        <div class="status-icon">
          <component :is="getStatusIcon()" class="w-5 h-5" />
        </div>
        <div class="status-message">
          <p>{{ statusMessage }}</p>
          <p class="status-details">{{ statusDetails }}</p>
        </div>
        <button 
          @click="dismissStatusBanner"
          class="status-close"
          aria-label="Dismiss status"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Floating Action Button -->
    <div v-if="showFloatingAction" class="floating-action">
      <button 
        @click="$emit('start-analysis')"
        class="floating-btn"
        :class="{ 'running': isAnalysisRunning }"
        aria-label="Start analysis"
      >
        <Play v-if="!isAnalysisRunning" class="w-6 h-6" />
        <Loader2 v-else class="w-6 h-6 animate-spin" />
      </button>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <Loader2 class="w-8 h-8 animate-spin" />
        <p>{{ loadingMessage }}</p>
      </div>
    </div>

    <!-- Error Overlay -->
    <div v-if="error" class="error-overlay">
      <div class="error-content">
        <AlertTriangle class="w-8 h-8" />
        <div class="error-message">
          <h3>Analysis Error</h3>
          <p>{{ error }}</p>
        </div>
        <button 
          @click="$emit('clear-error')"
          class="error-close"
          aria-label="Clear error"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Menu,
  Play,
  X,
  Download,
  Settings,
  Clock,
  Sliders,
  BarChart3,
  Activity,
  CheckCircle,
  Code,
  Shield,
  Zap,
  Database,
  Folder,
  Copy,
  TrendingUp,
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-vue-next';
import type { AnalyzerDefinition } from '../../../services/AnalysisService';

interface Breadcrumb {
  label: string;
  path: string;
}

interface Props {
  sidebarCollapsed?: boolean;
  isAnalysisRunning?: boolean;
  hasResults?: boolean;
  isLoading?: boolean;
  error?: string | null;
  loadingMessage?: string;
  statusMessage?: string;
  statusDetails?: string;
  showStatusBanner?: boolean;
  showFloatingAction?: boolean;
  activeSection?: string;
  breadcrumbs?: Breadcrumb[];
  availableAnalyzers?: AnalyzerDefinition[];
}

interface Emits {
  (e: 'toggle-sidebar'): void;
  (e: 'start-analysis'): void;
  (e: 'cancel-analysis'): void;
  (e: 'export-results'): void;
  (e: 'view-analyzers'): void;
  (e: 'view-history'): void;
  (e: 'view-settings'): void;
  (e: 'navigate'): void;
  (e: 'clear-error'): void;
}

const props = withDefaults(defineProps<Props>(), {
  sidebarCollapsed: false,
  isAnalysisRunning: false,
  hasResults: false,
  isLoading: false,
  loadingMessage: 'Loading...',
  statusMessage: '',
  statusDetails: '',
  showStatusBanner: false,
  showFloatingAction: true,
  activeSection: 'overview',
  breadcrumbs: () => [],
  availableAnalyzers: () => [],
});

const emit = defineEmits<Emits>();

// Computed properties
const analyzerCountByCategory = computed(() => {
  const counts: Record<string, number> = {};
  props.availableAnalyzers.forEach(analyzer => {
    counts[analyzer.category] = (counts[analyzer.category] || 0) + 1;
  });
  return counts;
});

const getStatusIcon = () => {
  if (props.isAnalysisRunning) return Loader2;
  if (props.hasResults) return CheckCircle;
  if (props.error) return AlertTriangle;
  return Circle;
};

const dismissStatusBanner = () => {
  emit('clear-error');
};
</script>

<style scoped>
.analysis-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #ffffff;
}

.analysis-header {
  background: #1e293b;
  border-bottom: 1px solid #334155;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  color: #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-toggle:hover {
  background: #4b5563;
  color: #ffffff;
}

.header-title h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
  color: #ffffff;
}

.header-title p {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.analysis-controls {
  display: flex;
  gap: 0.75rem;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.control-btn.primary:hover:not(:disabled) {
  background: #2563eb;
}

.control-btn.cancel {
  background: #374151;
  border-color: #4b5563;
  color: #ef4444;
}

.control-btn.cancel:hover:not(:disabled) {
  background: #4b5563;
  color: #f87171;
}

.control-btn.secondary {
  background: #6b7280;
  border-color: #6b7280;
  color: #ffffff;
}

.control-btn.secondary:hover:not(:disabled) {
  background: #4b5563;
  color: #ffffff;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.375rem;
  color: #d1d5db;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

.badge {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.analysis-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.analysis-sidebar {
  width: 280px;
  background: #1e293b;
  border-right: 1px solid #334155;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.sidebar-nav {
  padding: 1rem;
}

.nav-section {
  margin-bottom: 2rem;
}

.nav-section:last-child {
  margin-bottom: 0;
}

.nav-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem 0;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  background: none;
  border: none;
  border-radius: 0.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #374151;
  color: #d1d5db;
}

.nav-item.active {
  background: #3b82f6;
  color: #ffffff;
}

.analysis-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.breadcrumbs {
  margin-bottom: 1.5rem;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
}

.breadcrumb-link {
  color: #3b82f6;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-link:hover {
  color: #2563eb;
}

.breadcrumb-current {
  color: #9ca3af;
}

.breadcrumb-separator {
  width: 16px;
  height: 16px;
  color: #6b7280;
}

.content-area {
  min-height: 0;
  animation: fadeIn 0.3s ease-out;
}

.status-banner {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 100;
  max-width: 400px;
}

.status-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(239, 68, 68, 0.2);
  border-radius: 50%;
  color: #ef4444;
  flex-shrink: 0;
}

.status-message {
  flex: 1;
  min-width: 0;
}

.status-message h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
}

.status-message p {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.status-details {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
}

.status-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background 0.2s ease;
}

.status-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
}

.floating-action {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 40;
}

.floating-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: #3b82f6;
  border: none;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all 0.2s ease;
}

.floating-btn:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.floating-btn.running {
  background: #ef4444;
  cursor: not-allowed;
}

.loading-overlay,
.error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 2rem;
}

.loading-overlay {
  background: rgba(0, 0, 0, 0.8);
}

.error-overlay {
  background: rgba(239, 68, 68, 0.8);
}

.loading-content,
.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.loading-content p,
.error-content p {
  color: #e5e7eb;
  text-align: center;
  margin: 0;
}

.error-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
}

.error-content p {
  color: #fca5a5;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.error-close {
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background 0.2s ease;
}

.error-close:hover {
  background: rgba(252, 165, 165, 0.2);
  color: #ffffff;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .header-right {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .analysis-controls {
    width: 100%;
    justify-content: stretch;
  }
  
  .quick-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .control-btn {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .analysis-sidebar {
    position: fixed;
    top: 0;
    left: -280px;
    height: 100vh;
    z-index: 40;
    transition: left 0.3s ease;
  }
  
  .analysis-layout:not(.sidebar-collapsed) .analysis-sidebar {
    left: 0;
  }
  
  .analysis-content {
    padding: 1rem;
  }
  
  .header-content {
    padding: 0.75rem 1rem;
  }
  
  .header-left {
    order: 2;
  }
  
  .header-right {
    order: 1;
    width: 100%;
  }
  
  .analysis-controls {
    order: 3;
  }
  
  .quick-actions {
    order: 4;
  }
  
  .floating-action {
    bottom: 1rem;
    right: 1rem;
  }
}

@media (max-width: 640px) {
  .header-content {
    padding: 0.5rem 1rem;
  }
  
  .header-title h1 {
    font-size: 1.25rem;
  }
  
  .header-title p {
    font-size: 0.75rem;
  }
  
  .control-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }
  
  .quick-action-btn {
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
  }
  
  .floating-action {
    bottom: 0.5rem;
    right: 0.5rem;
  }
  
  .floating-btn {
    width: 48px;
    height: 48px;
  }
  
  .floating-btn .w-6,
  .floating-btn .w-4 {
    width: 16px;
    height: 16px;
  }
  
  .analysis-content {
    padding: 0.75rem;
  }
}
</style>