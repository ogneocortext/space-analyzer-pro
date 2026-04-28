<template>
  <div v-if="!analysis" class="dependency-impact-panel">
    <div class="dependency-impact-header">
      <div class="dependency-impact-title">
        <GitBranch :size="48" class="dependency-impact-icon" />
        <h3 class="dependency-impact-title">Dependency Impact Analysis</h3>
      </div>
    </div>
  </div>

  <div v-else class="dependency-impact-container">
    <!-- Risk Overview -->
    <div
      class="glass-panel"
      :style="{
        background: getRiskBackground(analysis.overallRisk),
        borderLeft: `4px solid ${getRiskColor(analysis.overallRisk)}`,
      }"
    >
      <div class="risk-overview-header">
        <component :is="getRiskIconComponent(analysis.overallRisk)" />
        <div class="risk-overview-content">
          <h3>
            {{ analysis.action.charAt(0).toUpperCase() + analysis.action.slice(1) }} Impact Analysis
          </h3>
          <p>
            {{ analysis.targetFiles.length }} target files • {{ totalAffectedFiles }} total affected
          </p>
        </div>
        <div class="risk-badge">
          <div
            :style="{
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              background: getRiskColor(analysis.overallRisk),
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }"
          >
            {{ analysis.overallRisk }}
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="quick-stats">
        <div class="quick-stat-item">
          <div class="quick-stat-label">Critical Impacts</div>
          <div class="quick-stat-value">{{ criticalImpacts }}</div>
        </div>
        <div class="quick-stat-item">
          <div class="quick-stat-label">High Impacts</div>
          <div class="quick-stat-value">{{ highImpacts }}</div>
        </div>
        <div class="quick-stat-item">
          <div class="quick-stat-label">Direct Impacts</div>
          <div class="quick-stat-value">{{ analysis.directImpacts.length }}</div>
        </div>
        <div class="quick-stat-item">
          <div class="quick-stat-label">Cascading Impacts</div>
          <div class="quick-stat-value">{{ analysis.cascadingImpacts.length }}</div>
        </div>
      </div>
    </div>

    <!-- Recommendations -->
    <div v-if="analysis.recommendations.length > 0" class="glass-panel recommendations">
      <h4 class="recommendation-title">Recommendations</h4>
      <div class="recommendation-list">
        <div
          v-for="(rec, index) in analysis.recommendations"
          :key="index"
          class="recommendation-item"
        >
          <div class="recommendation-header">
            <div class="recommendation-title">{{ rec }}</div>
          </div>
          <div class="recommendation-description">{{ rec }}</div>
        </div>
      </div>
    </div>

    <!-- Alternative Actions -->
    <div v-if="analysis.alternativeActions.length > 0" class="glass-panel alternative-actions">
      <h4 class="alternative-action-title">Safer Alternatives</h4>
      <div class="alternative-action-list">
        <div
          v-for="(alt, index) in analysis.alternativeActions"
          :key="index"
          class="alternative-action-item"
        >
          <div class="alternative-action-header">
            <div class="alternative-action-title">
              {{ alt.action.charAt(0).toUpperCase() + alt.action.slice(1) }}
            </div>
            <div class="alternative-action-risk-level">
              <span :class="['risk-level', getRiskColor(alt.risk)]">
                {{ alt.risk.toUpperCase() }}
              </span>
            </div>
          </div>
          <div class="alternative-action-description">{{ alt.description }}</div>
          <div class="alternative-action-benefits">
            <span
              v-for="(benefit, benefitIndex) in alt.benefits"
              :key="benefitIndex"
              class="benefit"
            >
              {{ benefit }}
            </span>
          </div>
          <button
            @click="$emit('executeAction', alt.action)"
            :disabled="loading"
            :class="['execute-action-btn', loading ? 'loading' : '']"
          >
            <Zap :size="14" />
            {{ loading ? 'Processing...' : `Execute ${alt.action}` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Impact Details -->
    <div class="glass-panel">
      <div class="impact-details-header">
        <h4 class="impact-details-title">Impact Details</h4>
        <button
          @click="showDetails = !showDetails"
          :class="['show-details-btn', showDetails ? 'active' : '']"
        >
          <EyeOff v-if="showDetails" :size="14" />
          <Eye v-else :size="14" />
          {{ showDetails ? 'Hide' : 'Show' }} Details
        </button>
      </div>

      <div v-if="showDetails" class="impact-details-content">
        <!-- Direct Impacts -->
        <div v-if="analysis.directImpacts.length > 0">
          <h5 class="impact-type-title">
            Direct Impacts ({{ analysis.directImpacts.length }})
          </h5>
          <div class="impact-list">
            <ImpactCard
              v-for="(impact, index) in analysis.directImpacts"
              :key="index"
              :impact="impact"
              :selected="selectedImpact?.file === impact.file"
              @select="selectedImpact = impact"
            />
          </div>
        </div>

        <!-- Cascading Impacts -->
        <div v-if="analysis.cascadingImpacts.length > 0">
          <h5 class="impact-type-title">
            Cascading Impacts ({{ analysis.cascadingImpacts.length }})
          </h5>
          <div class="impact-list">
            <ImpactCard
              v-for="(impact, index) in analysis.cascadingImpacts"
              :key="index"
              :impact="impact"
              :selected="selectedImpact?.file === impact.file"
              :is-cascading="true"
              @select="selectedImpact = impact"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Impact Detail -->
    <div v-if="selectedImpact" class="glass-panel selected-impact-detail">
      <div class="selected-impact-header">
        <FileText :size="16" class="selected-impact-icon" />
        <h4 class="selected-impact-title">{{ selectedImpact.file.split(/[/\\]/).pop() }}</h4>
        <div class="selected-impact-actions">
          <component :is="getImpactIconComponent(selectedImpact.impact)" />
          <span class="selected-impact-risk-level">
            {{ selectedImpact.impact.toUpperCase() }}
          </span>
        </div>
      </div>

      <div class="selected-impact-content">
        <div class="selected-impact-reason">
          <div class="selected-impact-reason-title">Reason</div>
          <div class="selected-impact-reason-text">{{ selectedImpact.reason }}</div>
        </div>

        <div v-if="selectedImpact.consequences.length > 0" class="selected-impact-consequences">
          <div class="selected-impact-consequences-title">Potential Consequences</div>
          <div class="selected-impact-consequences-list">
            <div
              v-for="(consequence, index) in selectedImpact.consequences"
              :key="index"
              class="consequence"
            >
              <AlertTriangle :size="12" class="consequence-icon" />
              {{ consequence }}
            </div>
          </div>
        </div>

        <div v-if="selectedImpact.benefits.length > 0" class="selected-impact-benefits">
          <div class="selected-impact-benefits-title">Benefits</div>
          <div class="selected-impact-benefits-list">
            <div
              v-for="(benefit, index) in selectedImpact.benefits"
              :key="index"
              class="benefit"
            >
              <CheckCircle :size="12" class="benefit-icon" />
              {{ benefit }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Execute Action Button -->
    <div class="execute-action-container">
      <button
        @click="$emit('executeAction', analysis.action)"
        :disabled="loading || analysis.overallRisk === 'critical'"
        :class="[
          'execute-action-btn',
          loading || analysis.overallRisk === 'critical' ? 'disabled' : ''
        ]"
      >
        <template v-if="loading">
          <div class="loading-spinner" />
          Processing...
        </template>
        <template v-else>
          <Zap :size="16" />
          Execute {{ analysis.action.charAt(0).toUpperCase() + analysis.action.slice(1) }}
        </template>
      </button>

      <div v-if="analysis.overallRisk === 'critical'" class="critical-risk-warning">
        <XCircle :size="16" class="critical-risk-icon" />
        Critical risk detected - consider alternatives
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  GitBranch,
  FileText,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-vue-next';

interface DependencyImpact {
  file: string;
  impact: 'critical' | 'high' | 'medium' | 'low' | 'none';
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  reason: string;
  consequences: string[];
  benefits: string[];
  affectedFiles: string[];
}

interface AlternativeAction {
  action: string;
  risk: 'critical' | 'high' | 'medium' | 'low' | 'none';
  description: string;
  benefits: string[];
}

interface PredictiveDependencyAnalysis {
  action: string;
  targetFiles: string[];
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'none';
  directImpacts: DependencyImpact[];
  cascadingImpacts: DependencyImpact[];
  recommendations: string[];
  alternativeActions: AlternativeAction[];
}

interface DependencyImpactAnalyzerProps {
  analysis: PredictiveDependencyAnalysis | null;
  loading?: boolean;
}

const props = withDefaults(defineProps<DependencyImpactAnalyzerProps>(), {
  loading: false,
});

defineEmits<{
  executeAction: [action: string];
}>();

const showDetails = ref(false);
const selectedImpact = ref<DependencyImpact | null>(null);

const totalAffectedFiles = computed(() => {
  if (!props.analysis) return 0;
  return props.analysis.directImpacts.length + props.analysis.cascadingImpacts.length;
});

const criticalImpacts = computed(() => {
  if (!props.analysis) return 0;
  return [...props.analysis.directImpacts, ...props.analysis.cascadingImpacts].filter(
    (i) => i.riskLevel === 'critical'
  ).length;
});

const highImpacts = computed(() => {
  if (!props.analysis) return 0;
  return [...props.analysis.directImpacts, ...props.analysis.cascadingImpacts].filter(
    (i) => i.riskLevel === 'high'
  ).length;
});

const getRiskColor = (risk: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
  switch (risk) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#f59e0b';
    case 'medium':
      return '#3b82f6';
    case 'low':
      return '#22c55e';
    case 'none':
      return '#6b7280';
    default:
      return '#6b7280';
  }
};

const getRiskBackground = (risk: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
  switch (risk) {
    case 'critical':
      return 'rgba(239, 68, 68, 0.1)';
    case 'high':
      return 'rgba(245, 158, 11, 0.1)';
    case 'medium':
      return 'rgba(59, 130, 246, 0.1)';
    case 'low':
      return 'rgba(34, 197, 94, 0.1)';
    case 'none':
      return 'rgba(107, 114, 128, 0.1)';
    default:
      return 'rgba(107, 114, 128, 0.1)';
  }
};

const getRiskIconComponent = (risk: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
  switch (risk) {
    case 'critical':
      return XCircle;
    case 'high':
      return AlertTriangle;
    case 'medium':
      return Info;
    case 'low':
      return CheckCircle;
    case 'none':
      return CheckCircle;
    default:
      return Info;
  }
};

const getImpactIconComponent = (impact: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
  switch (impact) {
    case 'critical':
      return XCircle;
    case 'high':
      return AlertTriangle;
    case 'medium':
      return Info;
    case 'low':
      return CheckCircle;
    case 'none':
      return CheckCircle;
    default:
      return Info;
  }
};
</script>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'DependencyImpactAnalyzer',
  components: {
    ImpactCard: defineComponent({
      name: 'ImpactCard',
      props: {
        impact: {
          type: Object as () => DependencyImpact,
          required: true,
        },
        selected: {
          type: Boolean,
          default: false,
        },
        isCascading: {
          type: Boolean,
          default: false,
        },
      },
      emits: ['select'],
      template: `
        <div
          @click="$emit('select', impact)"
          :class="['impact-card', selected ? 'selected' : '']"
        >
          <div class="impact-card-header">
            <ArrowRight v-if="isCascading" :size="14" class="impact-card-arrow" />
            <component :is="getImpactIconComponent(impact.impact)" />
            <span class="impact-card-title">{{ impact.file.split(/[/\\\\]/).pop() }}</span>
            <span :class="['impact-card-risk-level', getRiskColor(impact.riskLevel)]">
              {{ impact.riskLevel.toUpperCase() }}
            </span>
          </div>
          <div class="impact-card-reason">
            {{ impact.reason }}
          </div>
          <div class="impact-card-stats">
            <span>{{ impact.affectedFiles.length }} affected files</span>
            <span v-if="impact.consequences.length > 0">{{ impact.consequences.length }} consequences</span>
            <span v-if="impact.benefits.length > 0">{{ impact.benefits.length }} benefits</span>
          </div>
        </div>
      `,
      setup() {
        const getRiskColor = (risk: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
          switch (risk) {
            case 'critical':
              return '#ef4444';
            case 'high':
              return '#f59e0b';
            case 'medium':
              return '#3b82f6';
            case 'low':
              return '#22c55e';
            case 'none':
              return '#6b7280';
            default:
              return '#6b7280';
          }
        };

        const getImpactIconComponent = (impact: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
          switch (impact) {
            case 'critical':
              return XCircle;
            case 'high':
              return AlertTriangle;
            case 'medium':
              return Info;
            case 'low':
              return CheckCircle;
            case 'none':
              return CheckCircle;
            default:
              return Info;
          }
        };

        return { getRiskColor, getImpactIconComponent };
      },
    }),
  },
});
</script>

<style scoped>
.dependency-impact-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dependency-impact-panel {
  padding: 2rem;
}

.dependency-impact-header {
  text-align: center;
}

.dependency-impact-icon {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.dependency-impact-title {
  color: var(--text-primary);
  margin: 0;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.risk-overview-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.risk-overview-content h3 {
  margin: 0;
  color: var(--text-primary);
}

.risk-overview-content p {
  margin: 0.25rem 0 0 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.quick-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.quick-stat-item {
  text-align: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.quick-stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.quick-stat-value {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--text-primary);
}

.recommendations,
.alternative-actions {
  margin-top: 1rem;
}

.recommendation-title,
.alternative-action-title {
  color: var(--text-primary);
  margin-bottom: 1rem;
  font-size: 1rem;
}

.recommendation-list,
.alternative-action-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recommendation-item,
.alternative-action-item {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.recommendation-header,
.alternative-action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.recommendation-title,
.alternative-action-title {
  color: var(--text-primary);
  font-weight: 500;
}

.recommendation-description,
.alternative-action-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.alternative-action-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.benefit {
  padding: 0.25rem 0.5rem;
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border-radius: 4px;
  font-size: 0.75rem;
}

.risk-level {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.impact-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.impact-details-title {
  color: var(--text-primary);
  margin: 0;
}

.show-details-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s;
}

.show-details-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.show-details-btn.active {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.impact-details-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.impact-type-title {
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.impact-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.impact-card {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  border: 2px solid transparent;
}

.impact-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.impact-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.impact-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.impact-card-arrow {
  color: #f59e0b;
}

.impact-card-title {
  flex: 1;
  color: var(--text-primary);
  font-weight: 500;
}

.impact-card-risk-level {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.impact-card-reason {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}

.impact-card-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.selected-impact-detail {
  margin-top: 1rem;
}

.selected-impact-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.selected-impact-icon {
  color: var(--primary-color);
}

.selected-impact-title {
  flex: 1;
  color: var(--text-primary);
  margin: 0;
}

.selected-impact-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.selected-impact-risk-level {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.selected-impact-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.selected-impact-reason,
.selected-impact-consequences,
.selected-impact-benefits {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.selected-impact-reason-title,
.selected-impact-consequences-title,
.selected-impact-benefits-title {
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.selected-impact-reason-text {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.selected-impact-consequences-list,
.selected-impact-benefits-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.consequence,
.benefit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.consequence-icon {
  color: #f59e0b;
}

.benefit-icon {
  color: #22c55e;
}

.execute-action-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.execute-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.execute-action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.execute-action-btn:disabled,
.execute-action-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.critical-risk-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.875rem;
}

.critical-risk-icon {
  flex-shrink: 0;
}
</style>
