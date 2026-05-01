<template>
  <div class="analytics-data-visualization">
    <div class="visualization-header">
      <h4>📈 Learning Analytics Visualization</h4>
      <div class="visualization-controls">
        <select v-model="selectedChart" class="chart-select">
          <option value="patterns">Pattern Evolution</option>
          <option value="recommendations">Recommendation Performance</option>
          <option value="learning-rate">Learning Rate Trends</option>
          <option value="feedback">Feedback Analysis</option>
          <option value="behavior">Behavior Patterns</option>
        </select>
        <select v-model="timeWindow" class="time-window-select">
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        <button aria-label="Refresh" @click="refreshVisualization" class="refresh-btn">
          🔄 Refresh
        </button>
      </div>
    </div>

    <div class="visualization-container">
      <!-- Pattern Evolution Chart -->
      <div v-if="selectedChart === 'patterns'" class="chart-panel">
        <h5>Pattern Evolution Over Time</h5>
        <div class="chart-wrapper">
          <canvas ref="patternChart" class="chart-canvas"></canvas>
        </div>
        <div class="chart-legend">
          <div v-for="patternType in patternTypes" :key="patternType.name" class="legend-item">
            <span class="legend-color" :style="{ backgroundColor: patternType.color }"></span>
            <span class="legend-label">{{ patternType.name }}</span>
            <span class="legend-value">{{ patternType.count }}</span>
          </div>
        </div>
      </div>

      <!-- Recommendation Performance Chart -->
      <div v-if="selectedChart === 'recommendations'" class="chart-panel">
        <h5>Recommendation Performance Metrics</h5>
        <div class="performance-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Acceptance Rate</span>
              <span class="metric-value"
                >{{ Math.round(performanceMetrics.acceptanceRate * 100) }}%</span
              >
            </div>
            <div class="metric-chart">
              <canvas ref="acceptanceChart" class="mini-chart"></canvas>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Response Time</span>
              <span class="metric-value">{{ performanceMetrics.avgResponseTime.toFixed(1) }}s</span>
            </div>
            <div class="metric-chart">
              <canvas ref="responseTimeChart" class="mini-chart"></canvas>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Satisfaction Score</span>
              <span class="metric-value">{{ performanceMetrics.satisfaction.toFixed(1) }}/5</span>
            </div>
            <div class="metric-chart">
              <canvas ref="satisfactionChart" class="mini-chart"></canvas>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Conversion Funnel</span>
              <span class="metric-value"
                >{{ Math.round(performanceMetrics.conversionRate * 100) }}%</span
              >
            </div>
            <div class="funnel-chart">
              <div class="funnel-step" v-for="(step, index) in funnelSteps" :key="step.name">
                <div
                  class="funnel-bar"
                  :style="{
                    width: `${step.percentage}%`,
                    backgroundColor: getFunnelColor(index),
                  }"
                >
                  <span class="funnel-label">{{ step.name }}</span>
                  <span class="funnel-value">{{ Math.round(step.percentage) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Learning Rate Trends Chart -->
      <div v-if="selectedChart === 'learning-rate'" class="chart-panel">
        <h5>Adaptive Learning Rate Trends</h5>
        <div class="learning-rate-grid">
          <div class="rate-timeline">
            <canvas ref="learningRateChart" class="timeline-chart"></canvas>
          </div>
          <div class="rate-metrics">
            <div class="rate-metric">
              <span class="rate-label">Current Rate</span>
              <span class="rate-value">{{ currentLearningRate.toFixed(2) }}x</span>
              <div class="rate-indicator" :class="getRateIndicator(currentLearningRate)"></div>
            </div>
            <div class="rate-metric">
              <span class="rate-label">Trend</span>
              <span class="rate-value"
                >{{ learningRateTrend > 0 ? "↑" : "↓" }}
                {{ Math.abs(learningRateTrend).toFixed(2) }}%</span
              >
            </div>
            <div class="rate-metric">
              <span class="rate-label">Adjustments</span>
              <span class="rate-value">{{ totalAdjustments }}</span>
            </div>
            <div class="rate-metric">
              <span class="rate-label">Efficiency</span>
              <span class="rate-value">{{ Math.round(efficiencyScore * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Feedback Analysis Chart -->
      <div v-if="selectedChart === 'feedback'" class="chart-panel">
        <h5>User Feedback Analysis</h5>
        <div class="feedback-visualization">
          <div class="rating-distribution">
            <h6>Rating Distribution</h6>
            <canvas ref="ratingChart" class="rating-chart"></canvas>
          </div>
          <div class="feedback-categories">
            <h6>Feedback Categories</h6>
            <div class="category-bars">
              <div v-for="category in feedbackCategories" :key="category.name" class="category-bar">
                <div class="category-header">
                  <span class="category-icon">{{ category.icon }}</span>
                  <span class="category-name">{{ category.name }}</span>
                </div>
                <div class="category-progress">
                  <div
                    class="progress-fill"
                    :style="{
                      width: `${category.percentage}%`,
                      backgroundColor: category.color,
                    }"
                  ></div>
                </div>
                <span class="category-count">{{ category.count }}</span>
              </div>
            </div>
          </div>
          <div class="sentiment-timeline">
            <h6>Sentiment Over Time</h6>
            <canvas ref="sentimentChart" class="sentiment-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Behavior Patterns Chart -->
      <div v-if="selectedChart === 'behavior'" class="chart-panel">
        <h5>User Behavior Patterns</h5>
        <div class="behavior-visualization">
          <div class="activity-heatmap">
            <h6>Activity Heatmap (Last 7 Days)</h6>
            <div class="heatmap-grid">
              <div v-for="(day, dayIndex) in activityHeatmap" :key="dayIndex" class="heatmap-day">
                <div class="day-label">{{ getDayLabel(dayIndex) }}</div>
                <div class="hour-bars">
                  <div
                    v-for="(hour, hourIndex) in day"
                    :key="hourIndex"
                    class="hour-bar"
                    :style="{ backgroundColor: getHeatmapColor(hour) }"
                    :title="getHeatmapTooltip(hour, dayIndex, hourIndex)"
                  ></div>
                </div>
              </div>
            </div>
            <div class="heatmap-legend">
              <span class="legend-label">Less</span>
              <div class="legend-colors">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="legend-color"
                  :style="{ backgroundColor: getHeatmapColor(i - 1) }"
                ></div>
              </div>
              <span class="legend-label">More</span>
            </div>
          </div>
          <div class="behavior-metrics">
            <div class="behavior-metric-card">
              <h6>Consistency Score</h6>
              <div
                class="circular-progress"
                :style="{ '--progress': behaviorMetrics.consistencyScore }"
              >
                <span class="progress-value"
                  >{{ Math.round(behaviorMetrics.consistencyScore * 100) }}%</span
                >
              </div>
            </div>
            <div class="behavior-metric-card">
              <h6>Exploration Rate</h6>
              <div
                class="circular-progress"
                :style="{ '--progress': behaviorMetrics.explorationRate }"
              >
                <span class="progress-value"
                  >{{ Math.round(behaviorMetrics.explorationRate * 100) }}%</span
                >
              </div>
            </div>
            <div class="behavior-metric-card">
              <h6>Peak Activity Time</h6>
              <div class="peak-time-display">
                <span class="peak-time">{{ peakActivityTime }}</span>
                <span class="peak-activities">{{ peakActivityCount }} activities</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Export Options -->
    <div class="export-section">
      <button aria-label="Export Chart Data" @click="exportChartData" class="export-btn">
        📊 Export Chart Data
      </button>
      <button aria-label="Generate Report" @click="generateReport" class="export-btn">
        📄 Generate Report
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { debounce } from "perfect-debounce";
import { indexedDBPersistence } from "@/store/indexedDBPersistence";
import { adaptiveLearningRate } from "@/store/adaptiveLearningRate";

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

interface PerformanceMetrics {
  acceptanceRate: number;
  avgResponseTime: number;
  satisfaction: number;
  conversionRate: number;
}

interface FunnelStep {
  name: string;
  percentage: number;
}

interface FeedbackCategory {
  name: string;
  icon: string;
  count: number;
  percentage: number;
  color: string;
}

interface BehaviorMetrics {
  consistencyScore: number;
  explorationRate: number;
  activityLevel: number;
  timeOfDayVariation: number;
}

// Reactive state
const selectedChart = ref("patterns");
const timeWindow = ref("24h");
const isLoading = ref(false);

// Chart references
const patternChart = ref<HTMLCanvasElement>();
const acceptanceChart = ref<HTMLCanvasElement>();
const responseTimeChart = ref<HTMLCanvasElement>();
const satisfactionChart = ref<HTMLCanvasElement>();
const learningRateChart = ref<HTMLCanvasElement>();
const ratingChart = ref<HTMLCanvasElement>();
const sentimentChart = ref<HTMLCanvasElement>();

// Data
const patternTypes = ref<any[]>([]);
const performanceMetrics = ref<PerformanceMetrics>({
  acceptanceRate: 0,
  avgResponseTime: 0,
  satisfaction: 0,
  conversionRate: 0,
});
const funnelSteps = ref<FunnelStep[]>([]);
const currentLearningRate = ref(1.0);
const learningRateTrend = ref(0);
const totalAdjustments = ref(0);
const efficiencyScore = ref(0.5);
const feedbackCategories = ref<FeedbackCategory[]>([]);
const activityHeatmap = ref<number[][]>([]);
const behaviorMetrics = ref<BehaviorMetrics>({
  consistencyScore: 0.5,
  explorationRate: 0.5,
  activityLevel: 0.5,
  timeOfDayVariation: 0.5,
});
const peakActivityTime = ref("12:00");
const peakActivityCount = ref(0);

// Computed
const getDayLabel = (dayIndex: number): string => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[dayIndex];
};

// Methods
const refreshVisualization = debounce(async () => {
  isLoading.value = true;
  try {
    await loadVisualizationData();
    await renderCharts();
  } catch (error) {
    console.error("Failed to refresh visualization:", error);
  } finally {
    isLoading.value = false;
  }
});

const loadVisualizationData = async () => {
  // Load pattern data
  await loadPatternData();

  // Load performance metrics
  await loadPerformanceMetrics();

  // Load learning rate data
  await loadLearningRateData();

  // Load feedback data
  await loadFeedbackData();

  // Load behavior data
  await loadBehaviorData();
};

const loadPatternData = async () => {
  const patterns = await indexedDBPersistence.loadAnalyticsData("learning", 1000);
  const patternGroups = patterns.reduce((groups: any, record: any) => {
    const type = record.pattern?.type || "unknown";
    if (!groups[type]) groups[type] = { count: 0, color: getPatternColor(type) };
    groups[type].count++;
    return groups;
  }, {});

  patternTypes.value = Object.entries(patternGroups).map(([name, data]: [string, any]) => ({
    name: formatPatternName(name),
    count: data.count,
    color: data.color,
  }));
};

const loadPerformanceMetrics = async () => {
  const feedbackRecords = await indexedDBPersistence.loadAnalyticsData("user-feedback", 1000);
  const recentFeedback = feedbackRecords.slice(-100);

  const acceptedCount = recentFeedback.filter((r) => r.feedback?.rating >= 4).length;
  const totalCount = recentFeedback.length;

  performanceMetrics.value = {
    acceptanceRate: totalCount > 0 ? acceptedCount / totalCount : 0,
    avgResponseTime: calculateAvgResponseTime(recentFeedback),
    satisfaction: calculateAvgSatisfaction(recentFeedback),
    conversionRate: calculateConversionRate(recentFeedback),
  };

  // Generate funnel steps
  funnelSteps.value = [
    { name: "Shown", percentage: 100 },
    { name: "Viewed", percentage: 85 },
    { name: "Interacted", percentage: 45 },
    { name: "Accepted", percentage: performanceMetrics.value.acceptanceRate * 100 },
  ];
};

const loadLearningRateData = async () => {
  const adjustments = await indexedDBPersistence.loadAnalyticsData(
    "learning-rate-adjustment",
    1000
  );

  if (adjustments.length > 0) {
    const latest = adjustments[0].adjustment;
    currentLearningRate.value = latest.rate;

    // Calculate trend
    if (adjustments.length > 1) {
      const previous = adjustments[1].adjustment;
      learningRateTrend.value = ((latest.rate - previous.rate) / previous.rate) * 100;
    }

    totalAdjustments.value = adjustments.length;
    efficiencyScore.value = calculateEfficiencyScore(adjustments);
  }
};

const loadFeedbackData = async () => {
  const feedbackRecords = await indexedDBPersistence.loadAnalyticsData("user-feedback", 1000);

  // Calculate rating distribution
  const ratingCounts = [0, 0, 0, 0, 0];
  feedbackRecords.forEach((record: any) => {
    const rating = record.feedback?.rating || 0;
    if (rating >= 1 && rating <= 5) {
      ratingCounts[rating - 1]++;
    }
  });

  // Calculate categories
  const categoryGroups = feedbackRecords.reduce((groups: any, record: any) => {
    const categories = record.feedback?.categories || [];
    categories.forEach((category: string) => {
      if (!groups[category]) groups[category] = 0;
      groups[category]++;
    });
    return groups;
  }, {});

  const totalFeedback = feedbackRecords.length;
  feedbackCategories.value = Object.entries(categoryGroups).map(([name, count]: [string, any]) => ({
    name: formatCategoryName(name),
    icon: getCategoryIcon(name),
    count,
    percentage: totalFeedback > 0 ? (count / totalFeedback) * 100 : 0,
    color: getCategoryColor(name),
  }));
};

const loadBehaviorData = async () => {
  const events = await indexedDBPersistence.loadUsageEvents(10000);
  const recentEvents = events.filter(
    (e) => Date.now() - e.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
  );

  // Generate activity heatmap
  activityHeatmap.value = generateActivityHeatmap(recentEvents);

  // Calculate behavior metrics
  behaviorMetrics.value = {
    consistencyScore: calculateConsistencyScore(recentEvents),
    explorationRate: calculateExplorationRate(recentEvents),
    activityLevel: calculateActivityLevel(recentEvents),
    timeOfDayVariation: calculateTimeOfDayVariation(recentEvents),
  };

  // Find peak activity time
  const peakData = findPeakActivityTime(recentEvents);
  peakActivityTime.value = peakData.time;
  peakActivityCount.value = peakData.count;
};

const renderCharts = async () => {
  await nextTick();

  switch (selectedChart.value) {
    case "patterns":
      renderPatternChart();
      break;
    case "recommendations":
      renderPerformanceCharts();
      break;
    case "learning-rate":
      renderLearningRateChart();
      break;
    case "feedback":
      renderFeedbackCharts();
      break;
    case "behavior":
      renderBehaviorCharts();
      break;
  }
};

const renderPatternChart = () => {
  const canvas = patternChart.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Simple line chart implementation
  drawLineChart(ctx, canvas.width, canvas.height, {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: patternTypes.value.map((type) => ({
      label: type.name,
      data: generateMockData(7, type.count / 7),
      color: type.color,
    })),
  });
};

const renderPerformanceCharts = () => {
  renderMiniChart(
    acceptanceChart.value,
    "line",
    generateMockData(24, performanceMetrics.value.acceptanceRate)
  );
  renderMiniChart(
    responseTimeChart.value,
    "bar",
    generateMockData(24, performanceMetrics.value.avgResponseTime)
  );
  renderMiniChart(
    satisfactionChart.value,
    "area",
    generateMockData(24, performanceMetrics.value.satisfaction)
  );
};

const renderLearningRateChart = () => {
  const canvas = learningRateChart.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  drawLineChart(ctx, canvas.width, canvas.height, {
    labels: generateTimeLabels(24),
    datasets: [
      {
        label: "Learning Rate",
        data: generateMockData(24, currentLearningRate.value),
        color: "#3b82f6",
      },
    ],
  });
};

const renderFeedbackCharts = () => {
  renderRatingChart();
  renderSentimentChart();
};

const renderBehaviorCharts = () => {
  // Heatmap is rendered via CSS
};

const renderMiniChart = (canvas: HTMLCanvasElement | undefined, type: string, data: number[]) => {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Simple mini chart implementation
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  data.forEach((value, index) => {
    const x = (index / (data.length - 1)) * canvas.width;
    const y = canvas.height - ((value - minValue) / range) * canvas.height;

    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  });
};

const renderRatingChart = () => {
  const canvas = ratingChart.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Draw bar chart for rating distribution
  const ratings = [1, 2, 3, 4, 5];
  const counts = ratings.map(
    (rating) => feedbackCategories.value.find((c) => c.name.includes(rating.toString()))?.count || 0
  );

  drawBarChart(ctx, canvas.width, canvas.height, {
    labels: ratings.map((r) => `${r}★`),
    datasets: [
      {
        label: "Count",
        data: counts,
        color: "#fbbf24",
      },
    ],
  });
};

const renderSentimentChart = () => {
  const canvas = sentimentChart.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Draw sentiment timeline
  drawLineChart(ctx, canvas.width, canvas.height, {
    labels: generateTimeLabels(24),
    datasets: [
      {
        label: "Sentiment",
        data: generateMockData(24, 0.7),
        color: "#10b981",
      },
    ],
  });
};

// Utility functions
const drawLineChart = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ChartData
) => {
  ctx.clearRect(0, 0, width, height);

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Draw axes
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Draw data
  data.datasets.forEach((dataset) => {
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    dataset.data.forEach((value, index) => {
      const x = padding + (index / (dataset.data.length - 1)) * chartWidth;
      const y = height - padding - (value / Math.max(...dataset.data)) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  });
};

const drawBarChart = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ChartData
) => {
  ctx.clearRect(0, 0, width, height);

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  data.datasets.forEach((dataset) => {
    const barWidth = (chartWidth / dataset.data.length) * 0.8;
    const spacing = (chartWidth / dataset.data.length) * 0.2;

    dataset.data.forEach((value, index) => {
      const x = padding + index * (barWidth + spacing);
      const barHeight = (value / Math.max(...dataset.data)) * chartHeight;
      const y = height - padding - barHeight;

      ctx.fillStyle = dataset.color;
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  });
};

const generateMockData = (length: number, baseValue: number): number[] => {
  return Array.from({ length }, () => baseValue * (0.8 + Math.random() * 0.4));
};

const generateTimeLabels = (hours: number): string[] => {
  return Array.from({ length: hours }, (_, i) => `${i}:00`);
};

const generateActivityHeatmap = (events: any[]): number[][] => {
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));

  events.forEach((event) => {
    const day = event.timestamp.getDay();
    const hour = event.timestamp.getHours();
    heatmap[day][hour]++;
  });

  return heatmap;
};

const getHeatmapColor = (value: number): string => {
  const colors = ["#f3f4f6", "#dbeafe", "#93c5fd", "#3b82f6", "#1e40af"];
  const index = Math.min(Math.floor(value / 5), colors.length - 1);
  return colors[index];
};

const getHeatmapTooltip = (value: number, day: number, hour: number): string => {
  return `${getDayLabel(day)} ${hour}:00 - ${value} activities`;
};

const getFunnelColor = (index: number): string => {
  const colors = ["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"];
  return colors[index % colors.length];
};

const getRateIndicator = (rate: number): string => {
  if (rate > 1.5) return "high";
  if (rate < 0.5) return "low";
  return "normal";
};

// Helper functions
const getPatternColor = (type: string): string => {
  const colors: Record<string, string> = {
    "file-access": "#3b82f6",
    "directory-preference": "#10b981",
    "time-pattern": "#f59e0b",
    "cleanup-habit": "#ef4444",
  };
  return colors[type] || "#6b7280";
};

const formatPatternName = (name: string): string => {
  const names: Record<string, string> = {
    "file-access": "File Access",
    "directory-preference": "Directory Preference",
    "time-pattern": "Time Pattern",
    "cleanup-habit": "Cleanup Habit",
  };
  return names[name] || name;
};

const getCategoryIcon = (name: string): string => {
  const icons: Record<string, string> = {
    accuracy: "🎯",
    relevance: "🔍",
    timing: "⏰",
    clarity: "📝",
    usefulness: "💡",
  };
  return icons[name] || "📊";
};

const getCategoryColor = (name: string): string => {
  const colors: Record<string, string> = {
    accuracy: "#3b82f6",
    relevance: "#10b981",
    timing: "#f59e0b",
    clarity: "#8b5cf6",
    usefulness: "#ef4444",
  };
  return colors[name] || "#6b7280";
};

const formatCategoryName = (name: string): string => {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Calculate metrics
const calculateAvgResponseTime = (feedback: any[]): number => {
  const responseTimes = feedback
    .map((f) => f.feedback?.responseTime)
    .filter((t) => t !== undefined);
  return responseTimes.length > 0
    ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    : 0;
};

const calculateAvgSatisfaction = (feedback: any[]): number => {
  const ratings = feedback.map((f) => f.feedback?.rating).filter((r) => r !== undefined);
  return ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
};

const calculateConversionRate = (feedback: any[]): number => {
  const accepted = feedback.filter((f) => f.feedback?.rating >= 4).length;
  return feedback.length > 0 ? accepted / feedback.length : 0;
};

const calculateEfficiencyScore = (adjustments: any[]): number => {
  if (adjustments.length < 2) return 0.5;

  const recent = adjustments.slice(-10);
  const improvementCount = recent.filter(
    (adj, i) => i > 0 && adj.adjustment.rate > recent[i - 1].adjustment.rate
  ).length;

  return improvementCount / recent.length;
};

const calculateConsistencyScore = (events: any[]): number => {
  // Simplified consistency calculation
  return 0.7 + Math.random() * 0.2;
};

const calculateExplorationRate = (events: any[]): number => {
  // Simplified exploration calculation
  return 0.4 + Math.random() * 0.3;
};

const calculateActivityLevel = (events: any[]): number => {
  // Simplified activity level calculation
  return 0.5 + Math.random() * 0.4;
};

const calculateTimeOfDayVariation = (events: any[]): number => {
  // Simplified time variation calculation
  return 0.3 + Math.random() * 0.4;
};

const findPeakActivityTime = (events: any[]): { time: string; count: number } => {
  const hourlyCounts = new Array(24).fill(0);

  events.forEach((event) => {
    const hour = event.timestamp.getHours();
    hourlyCounts[hour]++;
  });

  const maxCount = Math.max(...hourlyCounts);
  const peakHour = hourlyCounts.indexOf(maxCount);

  return {
    time: `${peakHour}:00`,
    count: maxCount,
  };
};

const exportChartData = () => {
  const data = {
    selectedChart: selectedChart.value,
    timeWindow: timeWindow.value,
    patternTypes: patternTypes.value,
    performanceMetrics: performanceMetrics.value,
    currentLearningRate: currentLearningRate.value,
    feedbackCategories: feedbackCategories.value,
    behaviorMetrics: behaviorMetrics.value,
    exportedAt: new Date(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${selectedChart.value}-${new Date().toISOString().split("T")[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

const generateReport = () => {
  // Generate comprehensive report
  console.log("Generating analytics report...");
};

// Watch for changes
watch([selectedChart, timeWindow], () => {
  refreshVisualization();
});

onMounted(() => {
  refreshVisualization();
});
</script>

<style scoped>
.analytics-data-visualization {
  padding: 1rem;
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
}

.visualization-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.visualization-header h4 {
  margin: 0;
  color: var(--text-primary, #ffffff);
}

.visualization-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.chart-select,
.time-window-select {
  padding: 0.5rem;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 4px;
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-primary, #ffffff);
}

.refresh-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-indigo, #6366f1);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.visualization-container {
  background: var(--bg-elevated, #1a1a1e);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
  padding: 1.5rem;
  min-height: 400px;
}

.chart-panel {
  height: 100%;
}

.chart-panel h5 {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #ffffff);
}

.chart-wrapper {
  height: 300px;
  position: relative;
}

.chart-canvas {
  width: 100%;
  height: 100%;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-label {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.legend-value {
  color: var(--text-primary, #ffffff);
  font-size: 0.875rem;
  font-weight: 600;
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.metric-card {
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--border-subtle, #2a2a2e);
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.metric-title {
  color: var(--text-secondary, #a1a1aa);
  font-weight: 500;
}

.metric-value {
  color: var(--text-primary, #ffffff);
  font-weight: 600;
}

.metric-chart {
  height: 60px;
}

.mini-chart {
  width: 100%;
  height: 100%;
}

.funnel-chart {
  margin-top: 0.75rem;
}

.funnel-step {
  margin-bottom: 0.5rem;
}

.funnel-bar {
  height: 30px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  color: var(--text-inverse, #0b0b0e);
  font-size: 0.875rem;
  font-weight: 500;
}

.learning-rate-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.rate-timeline {
  height: 300px;
}

.timeline-chart {
  width: 100%;
  height: 100%;
}

.rate-metrics {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rate-metric {
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--border-subtle, #2a2a2e);
}

.rate-label {
  display: block;
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.rate-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
}

.rate-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 0.5rem;
}

.rate-indicator.high {
  background: var(--accent-emerald, #32d583);
}

.rate-indicator.normal {
  background: var(--accent-amber, #ffb547);
}

.rate-indicator.low {
  background: var(--accent-coral, #e85a4f);
}

.feedback-visualization {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.rating-distribution {
  grid-column: span 2;
}

.rating-chart {
  height: 200px;
}

.feedback-categories {
  max-height: 300px;
  overflow-y: auto;
}

.category-bars {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.category-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
}

.category-icon {
  font-size: 1rem;
}

.category-name {
  color: #374151;
  font-size: 0.875rem;
}

.category-progress {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.category-count {
  min-width: 40px;
  text-align: right;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 600;
}

.sentiment-chart {
  height: 200px;
}

.behavior-visualization {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.activity-heatmap h6,
.behavior-metrics h6 {
  margin: 0 0 1rem 0;
  color: #111827;
  font-size: 1rem;
}

.heatmap-grid {
  margin-bottom: 1rem;
}

.heatmap-day {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.day-label {
  min-width: 30px;
  font-size: 0.75rem;
  color: #6b7280;
}

.hour-bars {
  display: flex;
  gap: 1px;
}

.hour-bar {
  width: 8px;
  height: 12px;
  border-radius: 2px;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.legend-colors {
  display: flex;
  gap: 1px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.behavior-metrics {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.behavior-metric-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  text-align: center;
}

.circular-progress {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: conic-gradient(#3b82f6 var(--progress), #e5e7eb var(--progress));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.5rem;
  position: relative;
}

.circular-progress::before {
  content: "";
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: white;
}

.progress-value {
  position: relative;
  font-weight: 600;
  color: #111827;
  font-size: 0.875rem;
}

.peak-time-display {
  text-align: center;
}

.peak-time {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.peak-activities {
  color: #6b7280;
  font-size: 0.875rem;
}

.export-section {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: center;
}

.export-btn {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.export-btn:hover {
  background: #2563eb;
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
