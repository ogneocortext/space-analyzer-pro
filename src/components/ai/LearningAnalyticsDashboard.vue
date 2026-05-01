<template>
  <div class="learning-analytics-dashboard" role="main" aria-label="learning-analytics Dashboard">
    <div class="dashboard-header">
      <h3>📊 Learning Analytics Dashboard</h3>
      <div class="header-controls">
        <select v-model="selectedTimeRange" @change="refreshData" class="time-range-select">
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        <button aria-label="Refresh" @click="refreshData" class="btn btn-primary" tabindex="0">
          🔄 Refresh
        </button>
        <button aria-label="Export" @click="exportData" class="btn btn-outline" tabindex="0">
          📥 Export
        </button>
      </div>
    </div>

    <div class="analytics-grid">
      <!-- Overview Cards -->
      <div class="overview-section">
        <div class="metric-card">
          <h4>🧠 Learning Status</h4>
          <div class="metric-value">
            <span :class="['status-indicator', learningStatus]"></span>
            {{ learningStatusText }}
          </div>
          <div class="metric-detail">Active for {{ formatDuration(activeLearningTime) }}</div>
        </div>

        <div class="metric-card">
          <h4>📈 Patterns Detected</h4>
          <div class="metric-value">{{ totalPatterns }}</div>
          <div class="metric-detail">{{ highConfidencePatterns }} high confidence</div>
        </div>

        <div class="metric-card">
          <h4>🎯 Model Accuracy</h4>
          <div class="metric-value">{{ Math.round(modelAccuracy * 100) }}%</div>
          <div class="metric-detail">{{ totalRecommendations }} recommendations tested</div>
        </div>

        <div class="metric-card">
          <h4>⚡ Learning Rate</h4>
          <div class="metric-value">{{ currentLearningRate.toFixed(2) }}x</div>
          <div class="metric-detail">
            {{ learningRateTrend > 0 ? "↑" : "↓" }} {{ Math.abs(learningRateTrend).toFixed(2) }}%
            from last period
          </div>
        </div>
      </div>

      <!-- Pattern Analysis Chart -->
      <div class="chart-section">
        <h4>📊 Pattern Detection Over Time</h4>
        <div class="chart-container">
          <canvas ref="patternChart" class="analytics-chart"></canvas>
        </div>
      </div>

      <!-- Recommendation Performance -->
      <div class="chart-section">
        <h4>🎯 Recommendation Performance</h4>
        <div class="performance-grid">
          <div class="performance-item">
            <span class="label">Acceptance Rate:</span>
            <span class="value">{{ Math.round(acceptanceRate * 100) }}%</span>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${acceptanceRate * 100}%` }"></div>
            </div>
          </div>
          <div class="performance-item">
            <span class="label">Dismissal Rate:</span>
            <span class="value">{{ Math.round(dismissalRate * 100) }}%</span>
            <div class="progress-bar">
              <div
                class="progress-fill dismissal"
                :style="{ width: `${dismissalRate * 100}%` }"
              ></div>
            </div>
          </div>
          <div class="performance-item">
            <span class="label">Avg. Response Time:</span>
            <span class="value">{{ avgResponseTime.toFixed(1) }}s</span>
          </div>
        </div>
      </div>

      <!-- Pattern Types Distribution -->
      <div class="chart-section">
        <h4>🔍 Pattern Types Distribution</h4>
        <div class="pattern-types-grid">
          <div v-for="type in patternTypes" :key="type.name" class="pattern-type-item">
            <div class="type-header">
              <span class="type-icon">{{ type.icon }}</span>
              <span class="type-name">{{ type.name }}</span>
            </div>
            <div class="type-stats">
              <span class="count">{{ type.count }}</span>
              <span class="percentage">{{ Math.round(type.percentage) }}%</span>
            </div>
            <div class="confidence-bar">
              <div class="confidence-fill" :style="{ width: `${type.avgConfidence * 100}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Learning Timeline -->
      <div class="chart-section">
        <h4>⏰ Learning Timeline</h4>
        <div class="timeline-container">
          <div class="timeline-events">
            <div v-for="event in recentLearningEvents" :key="event.id" class="timeline-event">
              <div class="event-time">{{ formatTime(event.timestamp) }}</div>
              <div class="event-content">
                <span class="event-type">{{ event.type }}</span>
                <span class="event-description">{{ event.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- A/B Test Results -->
      <div class="chart-section" v-if="abTestResults.length > 0">
        <h4>🧪 A/B Test Results</h4>
        <div class="ab-test-grid">
          <div v-for="test in abTestResults" :key="test.id" class="ab-test-item">
            <div class="test-header">
              <span class="test-name">{{ test.name }}</span>
              <span :class="['test-status', test.status]">{{ test.status }}</span>
            </div>
            <div class="test-metrics">
              <div class="metric">
                <span class="label">Variant A:</span>
                <span class="value">{{ Math.round(test.variantA.conversion * 100) }}%</span>
              </div>
              <div class="metric">
                <span class="label">Variant B:</span>
                <span class="value">{{ Math.round(test.variantB.conversion * 100) }}%</span>
              </div>
              <div class="metric">
                <span class="label">Significance:</span>
                <span class="value">{{ test.significance }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feedback Analysis -->
      <div class="chart-section">
        <h4>💬 User Feedback Analysis</h4>
        <div class="feedback-summary">
          <div class="feedback-metric">
            <span class="label">Average Rating:</span>
            <div class="rating-display">
              <span class="rating-value">{{ averageRating.toFixed(1) }}</span>
              <div class="rating-stars">
                <span v-for="i in 5" :key="i" :class="['star', i <= averageRating ? 'filled' : '']"
                  >★</span
                >
              </div>
            </div>
          </div>
          <div class="feedback-metric">
            <span class="label">Total Feedback:</span>
            <span class="value">{{ totalFeedback }}</span>
          </div>
          <div class="feedback-metric">
            <span class="label">Response Rate:</span>
            <span class="value">{{ Math.round(feedbackResponseRate * 100) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Real-time Updates -->
    <div class="real-time-indicator" v-if="isRealTimeActive">
      <span class="pulse"></span>
      Real-time updates active
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useSelfLearningStore } from "@/store/selfLearning";
import { indexedDBPersistence } from "@/store/indexedDBPersistence";

interface AnalyticsData {
  totalPatterns: number;
  highConfidencePatterns: number;
  modelAccuracy: number;
  totalRecommendations: number;
  currentLearningRate: number;
  learningRateTrend: number;
  acceptanceRate: number;
  dismissalRate: number;
  avgResponseTime: number;
  patternTypes: PatternTypeData[];
  recentLearningEvents: LearningEvent[];
  abTestResults: ABTestResult[];
  averageRating: number;
  totalFeedback: number;
  feedbackResponseRate: number;
}

interface PatternTypeData {
  name: string;
  icon: string;
  count: number;
  percentage: number;
  avgConfidence: number;
}

interface LearningEvent {
  id: string;
  timestamp: Date;
  type: string;
  description: string;
}

interface ABTestResult {
  id: string;
  name: string;
  status: "running" | "completed" | "paused";
  variantA: { conversion: number };
  variantB: { conversion: number };
  significance: string;
}

const selfLearningStore = useSelfLearningStore();

// Reactive state
const selectedTimeRange = ref("24h");
const isRealTimeActive = ref(false);
const activeLearningTime = ref(0);
const learningStartTime = ref<Date | null>(null);

// Analytics data
const analyticsData = ref<AnalyticsData>({
  totalPatterns: 0,
  highConfidencePatterns: 0,
  modelAccuracy: 0.5,
  totalRecommendations: 0,
  currentLearningRate: 1.0,
  learningRateTrend: 0,
  acceptanceRate: 0,
  dismissalRate: 0,
  avgResponseTime: 0,
  patternTypes: [],
  recentLearningEvents: [],
  abTestResults: [],
  averageRating: 0,
  totalFeedback: 0,
  feedbackResponseRate: 0,
});

// Chart references
const patternChart = ref<HTMLCanvasElement>();

// Computed properties
const learningStatus = computed(() => {
  return selfLearningStore.isLearning ? "active" : "inactive";
});

const learningStatusText = computed(() => {
  return learningStatus.value === "active" ? "Learning Active" : "Learning Inactive";
});

const totalPatterns = computed(() => selfLearningStore.patterns.length);
const highConfidencePatterns = computed(
  () => selfLearningStore.patterns.filter((p) => p.confidence > 0.8).length
);
const modelAccuracy = computed(() => selfLearningStore.getModelAccuracy());

// Real-time updates
let updateInterval: NodeJS.Timeout | null = null;

onMounted(async () => {
  await refreshData();
  startRealTimeUpdates();
});

onUnmounted(() => {
  stopRealTimeUpdates();
});

const refreshData = async () => {
  try {
    // Load analytics data from IndexedDB
    const analyticsRecords = await indexedDBPersistence.loadAnalyticsData("learning", 100);

    // Calculate metrics
    await calculateAnalyticsMetrics(analyticsRecords);

    // Update charts
    updateCharts();
  } catch (error) {
    console.error("Failed to refresh analytics data:", error);
  }
};

const calculateAnalyticsMetrics = async (records: any[]) => {
  // Calculate pattern types distribution
  const patternTypes = await calculatePatternTypesDistribution();

  // Calculate learning events timeline
  const recentEvents = await getRecentLearningEvents();

  // Get A/B test results
  const abTestResults = await getABTestResults();

  // Get feedback analysis
  const feedbackAnalysis = await getFeedbackAnalysis();

  // Update analytics data
  analyticsData.value = {
    totalPatterns: totalPatterns.value,
    highConfidencePatterns: highConfidencePatterns.value,
    modelAccuracy: modelAccuracy.value,
    totalRecommendations: records.filter((r) => r.type === "recommendation").length,
    currentLearningRate: calculateCurrentLearningRate(),
    learningRateTrend: calculateLearningRateTrend(records),
    acceptanceRate: calculateAcceptanceRate(records),
    dismissalRate: calculateDismissalRate(records),
    avgResponseTime: calculateAvgResponseTime(records),
    patternTypes,
    recentLearningEvents: recentEvents,
    abTestResults,
    averageRating: feedbackAnalysis.averageRating,
    totalFeedback: feedbackAnalysis.totalFeedback,
    feedbackResponseRate: feedbackAnalysis.responseRate,
  };
};

const calculatePatternTypesDistribution = async (): Promise<PatternTypeData[]> => {
  const patterns = selfLearningStore.patterns;
  const typeGroups = patterns.reduce(
    (groups, pattern) => {
      if (!groups[pattern.type]) {
        groups[pattern.type] = {
          name: pattern.type,
          icon: getPatternIcon(pattern.type),
          count: 0,
          totalConfidence: 0,
        };
      }
      groups[pattern.type].count++;
      groups[pattern.type].totalConfidence += pattern.confidence;
      return groups;
    },
    {} as Record<string, any>
  );

  const total = patterns.length;
  return Object.entries(typeGroups).map(([type, data]) => ({
    name: formatPatternName(type),
    icon: data.icon,
    count: data.count,
    percentage: total > 0 ? (data.count / total) * 100 : 0,
    avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
  }));
};

const getRecentLearningEvents = async (): Promise<LearningEvent[]> => {
  const events = await indexedDBPersistence.loadUsageEvents(50);
  return events.slice(0, 10).map((event) => ({
    id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    description: generateEventDescription(event),
  }));
};

const getABTestResults = async (): Promise<ABTestResult[]> => {
  // Mock A/B test results - would be loaded from actual A/B testing system
  return [
    {
      id: "1",
      name: "Recommendation Algorithm A vs B",
      status: "completed",
      variantA: { conversion: 0.35 },
      variantB: { conversion: 0.42 },
      significance: "95%",
    },
    {
      id: "2",
      name: "UI Layout Test",
      status: "running",
      variantA: { conversion: 0.28 },
      variantB: { conversion: 0.31 },
      significance: "Insufficient data",
    },
  ];
};

const getFeedbackAnalysis = async () => {
  // Mock feedback analysis - would be loaded from actual feedback system
  return {
    averageRating: 4.2,
    totalFeedback: 156,
    responseRate: 0.67,
  };
};

const calculateCurrentLearningRate = (): number => {
  // Calculate learning rate based on recent pattern detection
  const recentPatterns = selfLearningStore.patterns.slice(-10);
  if (recentPatterns.length === 0) return 1.0;

  const avgConfidence =
    recentPatterns.reduce((sum, p) => sum + p.confidence, 0) / recentPatterns.length;
  return avgConfidence * 2; // Scale to 0-2 range
};

const calculateLearningRateTrend = (records: any[]): number => {
  // Calculate trend based on historical data
  if (records.length < 2) return 0;

  const recent = records.slice(-10);
  const older = records.slice(-20, -10);

  const recentAvg = recent.reduce((sum, r) => sum + (r.learningRate || 1), 0) / recent.length;
  const olderAvg = older.reduce((sum, r) => sum + (r.learningRate || 1), 0) / older.length;

  return ((recentAvg - olderAvg) / olderAvg) * 100;
};

const calculateAcceptanceRate = (records: any[]): number => {
  const recommendationEvents = records.filter((r) => r.type === "recommendation-feedback");
  if (recommendationEvents.length === 0) return 0;

  const accepted = recommendationEvents.filter((r) => r.action === "accepted").length;
  return accepted / recommendationEvents.length;
};

const calculateDismissalRate = (records: any[]): number => {
  const recommendationEvents = records.filter((r) => r.type === "recommendation-feedback");
  if (recommendationEvents.length === 0) return 0;

  const dismissed = recommendationEvents.filter((r) => r.action === "dismissed").length;
  return dismissed / recommendationEvents.length;
};

const calculateAvgResponseTime = (records: any[]): number => {
  const feedbackEvents = records.filter((r) => r.responseTime);
  if (feedbackEvents.length === 0) return 0;

  const totalTime = feedbackEvents.reduce((sum, r) => sum + r.responseTime, 0);
  return totalTime / feedbackEvents.length;
};

const startRealTimeUpdates = () => {
  isRealTimeActive.value = true;
  learningStartTime.value = new Date();

  updateInterval = setInterval(() => {
    if (learningStartTime.value) {
      activeLearningTime.value = Date.now() - learningStartTime.value.getTime();
    }
    refreshData();
  }, 5000); // Update every 5 seconds
};

const stopRealTimeUpdates = () => {
  isRealTimeActive.value = false;
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
};

const updateCharts = () => {
  // Update pattern chart
  if (patternChart.value) {
    updatePatternChart();
  }
};

const updatePatternChart = () => {
  const canvas = patternChart.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw simple chart (would use Chart.js in production)
  drawSimpleChart(ctx, canvas.width, canvas.height, analyticsData.value.patternTypes);
};

const drawSimpleChart = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: PatternTypeData[]
) => {
  const barWidth = width / (data.length * 2);
  const maxValue = Math.max(...data.map((d) => d.count));

  data.forEach((item, index) => {
    const barHeight = (item.count / maxValue) * (height - 40);
    const x = index * barWidth * 2 + barWidth / 2;
    const y = height - barHeight - 20;

    // Draw bar
    ctx.fillStyle = "#4a90e2";
    ctx.fillRect(x, y, barWidth, barHeight);

    // Draw label
    ctx.fillStyle = "#333";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(item.icon, x + barWidth / 2, height - 5);
  });
};

const exportData = async () => {
  try {
    const data = await indexedDBPersistence.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `learning-analytics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export analytics data:", error);
  }
};

// Utility functions
const getPatternIcon = (type: string): string => {
  const icons: Record<string, string> = {
    "file-access": "📄",
    "directory-preference": "📁",
    "time-pattern": "⏰",
    "cleanup-habit": "🧹",
  };
  return icons[type] || "📊";
};

const formatPatternName = (type: string): string => {
  const names: Record<string, string> = {
    "file-access": "File Access",
    "directory-preference": "Directory Preference",
    "time-pattern": "Time Pattern",
    "cleanup-habit": "Cleanup Habit",
  };
  return names[type] || type;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const generateEventDescription = (event: any): string => {
  switch (event.type) {
    case "file-access":
      return `Accessed ${event.data.extension || "file"}`;
    case "directory-navigation":
      return `Navigated to ${event.data.path || "directory"}`;
    case "cleanup-action":
      return `Performed ${event.data.action || "cleanup"}`;
    default:
      return `${event.type} activity`;
  }
};

// Watch for time range changes
watch(selectedTimeRange, () => {
  refreshData();
});
</script>

<style scoped>
.learning-analytics-dashboard {
  padding: 1rem;
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
  margin: 1rem 0;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.time-range-select {
  padding: 0.5rem;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 4px;
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-primary, #ffffff);
}

.analytics-grid {
  display: grid;
  gap: 2rem;
}

.overview-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.metric-card {
  background: var(--bg-elevated, #1a1a1e);
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #2a2a2e);
  text-align: center;
}

.metric-card h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
  font-weight: 500;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-indicator.active {
  background: var(--accent-emerald, #32d583);
}

.status-indicator.inactive {
  background: var(--text-tertiary, #71717a);
}

.metric-detail {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.chart-section {
  background: var(--bg-elevated, #1a1a1e);
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #2a2a2e);
}

.chart-section h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #111827);
  font-size: 1.125rem;
}

.chart-container {
  height: 300px;
  position: relative;
}

.analytics-chart {
  width: 100%;
  height: 100%;
}

.performance-grid {
  display: grid;
  gap: 1rem;
}

.performance-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 4px;
}

.performance-item .label {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.performance-item .value {
  font-weight: 600;
  color: var(--text-primary, #ffffff);
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-elevated-hover, #222226);
  border-radius: 3px;
  margin: 0 1rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-emerald, #32d583);
  transition: width 0.3s ease;
}

.progress-fill.dismissal {
  background: var(--accent-coral, #e85a4f);
}

.pattern-types-grid {
  display: grid;
  gap: 1rem;
}

.pattern-type-item {
  padding: 1rem;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 6px;
  border-left: 4px solid var(--accent-indigo, #6366f1);
}

.type-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.type-icon {
  font-size: 1.25rem;
}

.type-name {
  font-weight: 600;
  color: var(--text-primary, #ffffff);
}

.type-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.type-stats .count {
  font-weight: 600;
  color: var(--accent-indigo, #6366f1);
}

.type-stats .percentage {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.confidence-bar {
  height: 4px;
  background: var(--bg-elevated-hover, #222226);
  border-radius: 2px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--accent-emerald, #32d583);
  transition: width 0.3s ease;
}

.timeline-container {
  max-height: 300px;
  overflow-y: auto;
}

.timeline-events {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-event {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 4px;
}

.event-time {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
  min-width: 60px;
}

.event-content {
  flex: 1;
}

.event-type {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: var(--accent-indigo, #6366f1);
  color: var(--text-inverse, #0b0b0e);
  border-radius: 3px;
  font-size: 0.75rem;
  margin-right: 0.5rem;
}

.event-description {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.ab-test-grid {
  display: grid;
  gap: 1rem;
}

.ab-test-item {
  padding: 1rem;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 6px;
  border: 1px solid var(--border-subtle, #2a2a2e);
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.test-name {
  font-weight: 600;
  color: var(--text-primary, #ffffff);
}

.test-status {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
}

.test-status.running {
  background: var(--accent-indigo, #6366f1);
  color: var(--text-inverse, #0b0b0e);
}

.test-status.completed {
  background: var(--accent-emerald, #32d583);
  color: var(--text-inverse, #0b0b0e);
}

.test-status.paused {
  background: var(--accent-amber, #ffb547);
  color: var(--text-inverse, #0b0b0e);
}

.test-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.test-metrics .metric {
  text-align: center;
}

.test-metrics .label {
  display: block;
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.75rem;
}

.test-metrics .value {
  font-weight: 600;
  color: var(--text-primary, #ffffff);
}

.feedback-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.feedback-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 4px;
}

.feedback-metric .label {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.rating-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rating-value {
  font-weight: 600;
  color: var(--text-primary, #ffffff);
}

.rating-stars {
  display: flex;
  gap: 0.25rem;
}

.star {
  color: var(--text-tertiary, #71717a);
  font-size: 1rem;
}

.star.filled {
  color: var(--accent-amber, #ffb547);
}

.real-time-indicator {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--accent-emerald, #32d583);
  color: var(--text-inverse, #0b0b0e);
  border-radius: 20px;
  font-size: 0.875rem;
  box-shadow: 0 4px 12px rgba(50, 213, 131, 0.3);
}

.pulse {
  width: 8px;
  height: 8px;
  background: var(--text-primary, #ffffff);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-outline {
  background: transparent;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-outline:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* Responsive Design */
@media (max-width: 768px) {
  .analytics-data-visualization,
  .learning-analytics-dashboard,
  .ab-test-analysis-report,
  .user-feedback-collection {
    padding: 0.5rem;
  }

  .metrics-grid,
  .analytics-grid,
  .summary-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .visualization-controls,
  .header-controls {
    flex-direction: column;
    gap: 0.5rem;
  }

  .chart-canvas {
    height: 200px;
  }
}

@media (max-width: 480px) {
  .metric-card,
  .summary-card,
  .variant-metrics {
    padding: 0.75rem;
  }

  .action-buttons,
  .export-section {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
