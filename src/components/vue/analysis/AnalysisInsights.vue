<!--
  Analysis Insights Widget
  Displays analysis insights and recommendations
-->
<template>
  <div class="analysis-insights">
    <div class="insights-header">
      <h3 class="insights-title">Analysis Insights</h3>
      <div class="insights-filters">
        <button 
          v-for="type in insightTypes"
          :key="type.value"
          :class="['filter-btn', { active: selectedType === type.value }]"
          @click="selectedType = type.value"
        >
          <component :is="type.icon" class="w-4 h-4" />
          <span>{{ type.label }}</span>
          <span class="count">{{ getInsightCount(type.value) }}</span>
        </button>
      </div>
    </div>

    <!-- Insights List -->
    <div class="insights-list">
      <div 
        v-for="insight in filteredInsights"
        :key="insight.id"
        :class="['insight-item', `severity-${insight.severity}`]"
      >
        <div class="insight-header">
          <div class="insight-icon">
            <component :is="getInsightIcon(insight.type)" class="w-5 h-5" />
          </div>
          <div class="insight-title-section">
            <h4 class="insight-title">{{ insight.title }}</h4>
            <div class="insight-meta">
              <span :class="['severity-badge', insight.severity]">
                {{ insight.severity }}
              </span>
              <span class="insight-type">{{ formatType(insight.type) }}</span>
            </div>
          </div>
          <div class="insight-actions">
            <button 
              @click="showInsightDetails(insight)"
              class="action-btn"
              aria-label="View details"
            >
              <Info class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="insight-content">
          <p class="insight-description">{{ insight.description }}</p>
          <div v-if="insight.impact" class="insight-impact">
            <strong>Impact:</strong> {{ insight.impact }}
          </div>
          
          <!-- Affected Files -->
          <div v-if="insight.files.length > 0" class="affected-files">
            <div class="files-header">
              <span class="files-count">{{ insight.files.length }} affected files</span>
              <button 
                @click="toggleFilesVisibility(insight.id)"
                class="toggle-btn"
                aria-label="Toggle files visibility"
              >
                <ChevronDown 
                  :class="{ 'rotate-180': expandedFiles.has(insight.id) }" 
                  class="w-4 h-4" 
                />
              </button>
            </div>
            <div v-if="expandedFiles.has(insight.id)" class="files-list">
              <div 
                v-for="fileId in insight.files.slice(0, 10)"
                :key="fileId"
                class="file-item"
              >
                <FileText class="w-4 h-4" />
                <span>{{ getFileName(fileId) }}</span>
              </div>
              <div v-if="insight.files.length > 10" class="files-more">
                +{{ insight.files.length - 10 }} more files
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredInsights.length === 0" class="empty-state">
      <div class="empty-icon">
        <Eye class="w-8 h-8" />
      </div>
      <h3>No insights found</h3>
      <p>{{ selectedType ? 'No insights for this category' : 'No insights available' }}</p>
      <button v-if="selectedType" @click="selectedType = null" class="clear-btn">
        Clear filter
      </button>
    </div>

    <!-- Recommendations Section -->
    <div v-if="recommendations.length > 0" class="recommendations">
      <h4 class="section-title">Recommendations</h4>
      <div class="recommendations-list">
        <div 
          v-for="recommendation in recommendations"
          :key="recommendation.id"
          :class="['recommendation-item', `priority-${recommendation.priority}`]"
        >
          <div class="recommendation-header">
            <div class="recommendation-icon">
              <component :is="getRecommendationIcon(recommendation.category)" class="w-5 h-5" />
            </div>
            <div class="recommendation-content">
              <h5 class="recommendation-title">{{ recommendation.title }}</h5>
              <p class="recommendation-description">{{ recommendation.description }}</p>
              <div class="recommendation-meta">
                <span :class="['priority-badge', recommendation.priority]">
                  {{ recommendation.priority }} priority
                </span>
                <span :class="['effort-badge', recommendation.effort]">
                  {{ recommendation.effort }} effort
                </span>
                <span class="impact-badge">{{ recommendation.impact }}</span>
              </div>
            </div>
          </div>
          <div class="recommendation-actions">
            <button 
              @click="executeRecommendation(recommendation)"
              class="action-btn primary"
              aria-label="Execute recommendation"
            >
              <Play class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Insight Details Modal -->
    <div v-if="selectedInsight" class="modal-overlay" @click="closeInsightDetails">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Insight Details</h3>
          <button @click="closeInsightDetails" class="close-btn">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="modal-body">
          <div class="insight-details">
            <div class="detail-section">
              <h4>{{ selectedInsight.title }}</h4>
              <div class="detail-meta">
                <span :class="['severity-badge', selectedInsight.severity]">
                  {{ selectedInsight.severity }}
                </span>
                <span class="insight-type">{{ formatType(selectedInsight.type) }}</span>
              </div>
            </div>
            
            <div class="detail-section">
              <h5>Description</h5>
              <p>{{ selectedInsight.description }}</p>
            </div>
            
            <div class="detail-section">
              <h5>Impact</h5>
              <p>{{ selectedInsight.impact }}</p>
            </div>
            
            <div v-if="selectedInsight.metadata" class="detail-section">
              <h5>Additional Information</h5>
              <pre class="metadata-content">{{ JSON.stringify(selectedInsight.metadata, null, 2) }}</pre>
            </div>
            
            <div v-if="selectedInsight.files.length > 0" class="detail-section">
              <h5>Affected Files ({{ selectedInsight.files.length }})</h5>
              <div class="files-grid">
                <div 
                  v-for="fileId in selectedInsight.files"
                  :key="fileId"
                  class="file-item"
                >
                  <FileText class="w-4 h-4" />
                  <span>{{ getFileName(fileId) }}</span>
                </div>
              </div>
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
  Eye, 
  Info, 
  ChevronDown, 
  Play, 
  X, 
  FileText,
  AlertTriangle,
  Shield,
  Zap,
  Database,
  FolderOpen,
  Code,
  Settings
} from 'lucide-vue-next';
import type { AnalysisInsight, AnalysisRecommendation } from '../../../services/AnalysisService';

interface Props {
  insights: AnalysisInsight[];
  recommendations: AnalysisRecommendation[];
}

const props = defineProps<Props>();

const selectedType = ref<string | null>(null);
const selectedInsight = ref<AnalysisInsight | null>(null);
const expandedFiles = ref<Set<string>>(new Set());

const insightTypes = [
  { value: 'all', label: 'All', icon: Eye },
  { value: 'performance', label: 'Performance', icon: Zap },
  { value: 'organization', label: 'Organization', icon: FolderOpen },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'storage', label: 'Storage', icon: Database },
  { value: 'code_quality', label: 'Code Quality', icon: Code },
];

const filteredInsights = computed(() => {
  if (!selectedType.value || selectedType.value === 'all') {
    return props.insights;
  }
  return props.insights.filter(insight => insight.type === selectedType.value);
});

const getInsightCount = (type: string): number => {
  if (type === 'all') return props.insights.length;
  return props.insights.filter(insight => insight.type === type).length;
};

const getInsightIcon = (type: string) => {
  const icons: Record<string, any> = {
    performance: Zap,
    organization: FolderOpen,
    security: Shield,
    storage: Database,
    code_quality: Code,
  };
  return icons[type] || AlertTriangle;
};

const getRecommendationIcon = (category: string) => {
  const icons: Record<string, any> = {
    cleanup: Database,
    optimization: Zap,
    security: Shield,
    organization: FolderOpen,
  };
  return icons[category] || Settings;
};

const formatType = (type: string): string => {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const getFileName = (fileId: string): string => {
  // This would get the actual file name from the file ID
  // For now, we'll just return the ID
  return fileId.split('/').pop() || fileId;
};

const showInsightDetails = (insight: AnalysisInsight) => {
  selectedInsight.value = insight;
};

const closeInsightDetails = () => {
  selectedInsight.value = null;
};

const toggleFilesVisibility = (insightId: string) => {
  if (expandedFiles.value.has(insightId)) {
    expandedFiles.value.delete(insightId);
  } else {
    expandedFiles.value.add(insightId);
  }
};

const executeRecommendation = (recommendation: AnalysisRecommendation) => {
  // This would execute the recommendation
  console.log('Executing recommendation:', recommendation);
};
</script>

<style scoped>
.analysis-insights {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.insights-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.insights-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.insights-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
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

.filter-btn:hover {
  background: #4b5563;
  color: #d1d5db;
}

.filter-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.count {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-item {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.2s ease;
}

.insight-item:hover {
  background: #1f2937;
  border-color: #4b5563;
}

.insight-item.severity-low {
  border-left: 4px solid #22c55e;
}

.insight-item.severity-medium {
  border-left: 4px solid #f59e0b;
}

.insight-item.severity-high {
  border-left: 4px solid #ef4444;
}

.insight-item.severity-critical {
  border-left: 4px solid #dc2626;
}

.insight-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.insight-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 0.5rem;
  color: #3b82f6;
  flex-shrink: 0;
}

.insight-title-section {
  flex: 1;
  min-width: 0;
}

.insight-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
}

.insight-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.severity-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.severity-low {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.severity-medium {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.severity-high {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.severity-critical {
  background: rgba(220, 38, 38, 0.2);
  color: #dc2626;
}

.insight-type {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.insight-actions {
  flex-shrink: 0;
}

.action-btn {
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

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.action-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.action-btn.primary:hover {
  background: #2563eb;
}

.insight-content {
  color: #e5e7eb;
}

.insight-description {
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.insight-impact {
  margin-bottom: 0.75rem;
}

.insight-impact strong {
  color: #9ca3af;
}

.affected-files {
  margin-top: 0.75rem;
}

.files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.files-count {
  font-size: 0.875rem;
  color: #9ca3af;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 0.25rem;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #d1d5db;
}

.rotate-180 {
  transform: rotate(180deg);
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: #1f2937;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.files-more {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
  padding: 0.25rem 0.5rem;
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

.recommendations {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #374151;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 1rem 0;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.recommendation-item:hover {
  background: #1f2937;
  border-color: #4b5563;
}

.recommendation-item.priority-low {
  border-left: 4px solid #22c55e;
}

.recommendation-item.priority-medium {
  border-left: 4px solid #f59e0b;
}

.recommendation-item.priority-high {
  border-left: 4px solid #ef4444;
}

.recommendation-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.recommendation-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 0.5rem;
  color: #22c55e;
  flex-shrink: 0;
}

.recommendation-content {
  flex: 1;
  min-width: 0;
}

.recommendation-title {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
}

.recommendation-description {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.recommendation-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.priority-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.priority-low {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.priority-medium {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.priority-high {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.effort-badge {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.effort-easy {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.effort-medium {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.effort-hard {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.impact-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  max-width: 600px;
  max-height: 80vh;
  width: 100%;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #374151;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 0.375rem;
  color: #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.modal-body {
  padding: 1.5rem;
}

.insight-details {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-section h4,
.detail-section h5 {
  color: #ffffff;
  margin: 0;
}

.detail-section h4 {
  font-size: 1.125rem;
  font-weight: 600;
}

.detail-section h5 {
  font-size: 1rem;
  font-weight: 500;
}

.detail-section p {
  color: #e5e7eb;
  margin: 0;
  line-height: 1.5;
}

.metadata-content {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #d1d5db;
  overflow-x: auto;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .insights-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .insights-filters {
    width: 100%;
  }
  
  .recommendation-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .recommendation-content {
    width: 100%;
  }
  
  .modal-content {
    max-width: 95%;
    max-height: 90vh;
  }
}
</style>