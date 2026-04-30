<template>
  <div class="agent-health">
    <h3>🤖 Agent Health & Circuit Breaker Status</h3>

    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card total">
        <div class="summary-value">{{ summary.total }}</div>
        <div class="summary-label">Total Agents</div>
      </div>
      <div class="summary-card available">
        <div class="summary-value">{{ summary.available }}</div>
        <div class="summary-label">Available</div>
      </div>
      <div class="summary-card busy">
        <div class="summary-value">{{ summary.busy }}</div>
        <div class="summary-label">Busy</div>
      </div>
      <div class="summary-card unhealthy">
        <div class="summary-value">{{ summary.unhealthy }}</div>
        <div class="summary-label">Unhealthy</div>
      </div>
    </div>

    <!-- Agent Details -->
    <div class="agents-list">
      <h4>Agent Details</h4>
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="agent-card"
        :class="{
          'is-available': agent.isAvailable,
          'is-busy': agent.state === 'BUSY',
          'is-unhealthy': agent.circuitBreaker.state === 'OPEN'
        }"
      >
        <div class="agent-header">
          <div class="agent-name">
            <span class="agent-icon">{{ agent.type === 'process' ? '⚙️' : '🔧' }}</span>
            {{ agent.name }}
          </div>
          <div class="agent-badges">
            <span class="badge state" :class="agent.state.toLowerCase()">
              {{ agent.state }}
            </span>
            <span
              class="badge circuit-breaker"
              :class="agent.circuitBreaker.state.toLowerCase()"
            >
              {{ agent.circuitBreaker.state }}
            </span>
            <span v-if="agent.isAvailable" class="badge available">✅ Ready</span>
          </div>
        </div>

        <!-- Circuit Breaker Details -->
        <div class="circuit-breaker-details">
          <div class="cb-metric">
            <span class="cb-label">Failure Count:</span>
            <span
              class="cb-value"
              :class="{ 'text-danger': agent.circuitBreaker.failureCount > 2 }"
            >
              {{ agent.circuitBreaker.failureCount }}
            </span>
          </div>
          <div class="cb-metric">
            <span class="cb-label">Failure Rate:</span>
            <span
              class="cb-value"
              :class="{ 'text-danger': agent.circuitBreaker.failureRate > 0.5 }"
            >
              {{ (agent.circuitBreaker.failureRate * 100).toFixed(1) }}%
            </span>
          </div>
          <div v-if="agent.circuitBreaker.lastFailure" class="cb-metric">
            <span class="cb-label">Last Failure:</span>
            <span class="cb-value">{{ formatTime(agent.circuitBreaker.lastFailure) }}</span>
          </div>
        </div>

        <!-- Metrics -->
        <div class="agent-metrics">
          <div class="metric">
            <span class="metric-label">Completed:</span>
            <span class="metric-value">{{ agent.metrics.tasksCompleted }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Failed:</span>
            <span class="metric-value" :class="{ 'text-danger': agent.metrics.tasksFailed > 0 }">
              {{ agent.metrics.tasksFailed }}
            </span>
          </div>
          <div class="metric">
            <span class="metric-label">Avg Time:</span>
            <span class="metric-value">{{ agent.metrics.avgExecutionTime }}ms</span>
          </div>
          <div v-if="agent.lastUsed" class="metric">
            <span class="metric-label">Last Used:</span>
            <span class="metric-value">{{ formatTime(agent.lastUsed) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Circuit Breaker Legend -->
    <div class="legend">
      <h4>Circuit Breaker States</h4>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-dot closed"></span>
          <span>CLOSED - Normal operation</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot open"></span>
          <span>OPEN - Circuit broken, agent unavailable</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot half-open"></span>
          <span>HALF_OPEN - Testing recovery</span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { AnalysisBridge } from '@/services/AnalysisBridge';

interface Agent {
  id: string;
  name: string;
  type: string;
  state: string;
  circuitBreaker: {
    state: string;
    failureCount: number;
    lastFailure: string | null;
    failureRate: number;
  };
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    avgExecutionTime: number;
    lastUsed: string | null;
  };
  isAvailable: boolean;
  lastUsed: string | null;
}

// Props
const props = defineProps<{
  autoRefresh?: boolean;
  refreshInterval?: number;
}>();

// State
const analysisBridge = new AnalysisBridge();
const agents = ref<Agent[]>([]);
const summary = ref({
  total: 0,
  available: 0,
  busy: 0,
  unhealthy: 0,
  idle: 0
});
const error = ref<string | null>(null);
let refreshTimer: number | null = null;

// Methods
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const fetchHealth = async () => {
  try {
    error.value = null;
    const health = await analysisBridge.getAgentHealth();
    agents.value = health.agents;
    summary.value = health.summary;
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch agent health';
  }
};

// Lifecycle
onMounted(() => {
  fetchHealth();
  if (props.autoRefresh) {
    refreshTimer = window.setInterval(fetchHealth, props.refreshInterval || 5000);
  }
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.agent-health {
  padding: 20px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 12px;
}

h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary, #333);
  font-size: 1.5rem;
}

h4 {
  margin: 20px 0 12px 0;
  color: var(--text-secondary, #666);
  font-size: 1.1rem;
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #ddd;
}

.summary-card.total { border-left-color: #007acc; }
.summary-card.available { border-left-color: #28a745; }
.summary-card.busy { border-left-color: #ffc107; }
.summary-card.unhealthy { border-left-color: #dc3545; }

.summary-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.summary-label {
  font-size: 0.9rem;
  color: var(--text-secondary, #666);
}

/* Agent Cards */
.agents-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #ddd;
}

.agent-card.is-available { border-left-color: #28a745; }
.agent-card.is-busy { border-left-color: #ffc107; }
.agent-card.is-unhealthy { border-left-color: #dc3545; background: #fff5f5; }

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.agent-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary, #333);
}

.agent-icon {
  margin-right: 8px;
}

.agent-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge.state.idle { background: #e7f3ff; color: #007acc; }
.badge.state.busy { background: #fff3cd; color: #856404; }

.badge.circuit-breaker.closed { background: #d4edda; color: #155724; }
.badge.circuit-breaker.open { background: #f8d7da; color: #721c24; }
.badge.circuit-breaker.half-open { background: #fff3cd; color: #856404; }

.badge.available { background: #d4edda; color: #155724; }

/* Circuit Breaker Details */
.circuit-breaker-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 12px;
}

.cb-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cb-label {
  font-size: 0.85rem;
  color: #666;
}

.cb-value {
  font-weight: 600;
  color: #333;
}

.cb-value.text-danger { color: #dc3545; }

/* Agent Metrics */
.agent-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.metric-label {
  font-size: 0.8rem;
  color: #666;
}

.metric-value {
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
}

.metric-value.text-danger { color: #dc3545; }

/* Legend */
.legend {
  margin-top: 24px;
  padding: 16px;
  background: #e7f3ff;
  border-radius: 8px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.closed { background: #28a745; }
.legend-dot.open { background: #dc3545; }
.legend-dot.half-open { background: #ffc107; }

/* Error */
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 6px;
}
</style>
