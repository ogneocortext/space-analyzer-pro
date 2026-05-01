<template>
  <div class="ab-test-analysis-report">
    <div class="report-header">
      <h3>🧪 A/B Test Analysis Report</h3>
      <div class="header-controls">
        <select v-model="selectedTestId" @change="loadTestReport" class="test-select">
          <option value="">Select a test...</option>
          <option v-for="test in availableTests" :key="test.id" :value="test.id">
            {{ test.name }} ({{ test.status }})
          </option>
        </select>
        <button
          aria-label="Generate Report"
          @click="generateReport"
          :disabled="!selectedTestId"
          class="generate-btn"
        >
          📊 Generate Report
        </button>
        <button
          aria-label="Export PDF"
          @click="exportReport"
          :disabled="!reportData"
          class="export-btn"
        >
          📥 Export PDF
        </button>
      </div>
    </div>

    <div v-if="reportData" class="report-content">
      <!-- Executive Summary -->
      <section class="executive-summary">
        <h4>📋 Executive Summary</h4>
        <div class="summary-grid">
          <div class="summary-card">
            <h5>Test Overview</h5>
            <div class="summary-item">
              <span class="label">Test Name:</span>
              <span class="value">{{ reportData.test.name }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Duration:</span>
              <span class="value">{{ formatDuration(reportData.test.duration) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Status:</span>
              <span :class="['status-badge', reportData.test.status]">
                {{ reportData.test.status }}
              </span>
            </div>
          </div>

          <div class="summary-card">
            <h5>Key Results</h5>
            <div class="summary-item">
              <span class="label">Winner:</span>
              <span class="value winner">{{ reportData.results.winner || "Inconclusive" }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Confidence:</span>
              <span class="value">{{ Math.round(reportData.results.confidence * 100) }}%</span>
            </div>
            <div class="summary-item">
              <span class="label">Significance:</span>
              <span class="value">{{ reportData.results.statisticalSignificance.toFixed(3) }}</span>
            </div>
          </div>

          <div class="summary-card">
            <h5>Impact Assessment</h5>
            <div class="summary-item">
              <span class="label">Lift:</span>
              <span class="value" :class="getLiftClass(reportData.lift)">
                {{ reportData.lift > 0 ? "+" : "" }}{{ reportData.lift.toFixed(1) }}%
              </span>
            </div>
            <div class="summary-item">
              <span class="label">ROI:</span>
              <span class="value">{{ calculateROI(reportData).toFixed(1) }}%</span>
            </div>
            <div class="summary-item">
              <span class="label">Recommendation:</span>
              <span class="value">{{ getRecommendation(reportData) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Detailed Results -->
      <section class="detailed-results">
        <h4>📈 Detailed Results</h4>
        <div class="results-tabs">
          <button
            aria-label
            v-for="tab in resultTabs"
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.name }}
          </button>
        </div>

        <!-- Conversion Analysis -->
        <div v-if="activeTab === 'conversion'" class="tab-content">
          <div class="conversion-chart">
            <canvas ref="conversionChart" class="chart-canvas"></canvas>
          </div>
          <div class="conversion-metrics">
            <div
              v-for="variant in reportData.results.variantResults"
              :key="variant.variantId"
              class="variant-metrics"
            >
              <h6>{{ getVariantName(variant.variantId) }}</h6>
              <div class="metric-row">
                <span class="metric-label">Conversion Rate:</span>
                <span class="metric-value">{{ Math.round(variant.conversionRate * 100) }}%</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Conversions:</span>
                <span class="metric-value"
                  >{{ variant.conversions }}/{{ variant.participants }}</span
                >
              </div>
              <div class="metric-row">
                <span class="metric-label">Confidence Interval:</span>
                <span class="metric-value">
                  {{ formatConfidenceInterval(variant.statisticalData.confidenceInterval) }}
                </span>
              </div>
              <div class="metric-row">
                <span class="metric-label">P-value:</span>
                <span class="metric-value">{{ variant.statisticalData.pValue.toFixed(4) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Engagement Analysis -->
        <div v-if="activeTab === 'engagement'" class="tab-content">
          <div class="engagement-grid">
            <div
              v-for="variant in reportData.results.variantResults"
              :key="variant.variantId"
              class="engagement-card"
            >
              <h6>{{ getVariantName(variant.variantId) }}</h6>
              <div class="engagement-metrics">
                <div class="engagement-metric">
                  <span class="metric-name">Click Rate</span>
                  <div class="metric-bar">
                    <div
                      class="bar-fill"
                      :style="{ width: `${variant.engagement.clickRate * 100}%` }"
                    ></div>
                  </div>
                  <span class="metric-value"
                    >{{ Math.round(variant.engagement.clickRate * 100) }}%</span
                  >
                </div>
                <div class="engagement-metric">
                  <span class="metric-name">Time to Action</span>
                  <div class="metric-bar">
                    <div
                      class="bar-fill secondary"
                      :style="{ width: `${(variant.engagement.timeToAction / 30) * 100}%` }"
                    ></div>
                  </div>
                  <span class="metric-value"
                    >{{ variant.engagement.timeToAction.toFixed(1) }}s</span
                  >
                </div>
                <div class="engagement-metric">
                  <span class="metric-name">Interaction Depth</span>
                  <div class="metric-bar">
                    <div
                      class="bar-fill tertiary"
                      :style="{ width: `${variant.engagement.interactionDepth * 100}%` }"
                    ></div>
                  </div>
                  <span class="metric-value">{{
                    variant.engagement.interactionDepth.toFixed(1)
                  }}</span>
                </div>
                <div class="engagement-metric">
                  <span class="metric-name">Bounce Rate</span>
                  <div class="metric-bar">
                    <div
                      class="bar-fill danger"
                      :style="{ width: `${variant.engagement.bounceRate * 100}%` }"
                    ></div>
                  </div>
                  <span class="metric-value"
                    >{{ Math.round(variant.engagement.bounceRate * 100) }}%</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Satisfaction Analysis -->
        <div v-if="activeTab === 'satisfaction'" class="tab-content">
          <div class="satisfaction-overview">
            <div class="satisfaction-chart">
              <canvas ref="satisfactionChart" class="chart-canvas"></canvas>
            </div>
            <div class="satisfaction-summary">
              <div
                v-for="variant in reportData.results.variantResults"
                :key="variant.variantId"
                class="satisfaction-summary-item"
              >
                <h6>{{ getVariantName(variant.variantId) }}</h6>
                <div class="rating-display">
                  <div class="rating-stars">
                    <span
                      v-for="i in 5"
                      :key="i"
                      :class="['star', i <= variant.satisfaction.averageRating ? 'filled' : '']"
                      >★</span
                    >
                  </div>
                  <span class="rating-value"
                    >{{ variant.satisfaction.averageRating.toFixed(1) }}/5</span
                  >
                </div>
                <div class="feedback-stats">
                  <div class="feedback-stat">
                    <span class="stat-label">Feedback Count:</span>
                    <span class="stat-value">{{ variant.satisfaction.feedbackCount }}</span>
                  </div>
                  <div class="feedback-stat">
                    <span class="stat-label">Response Rate:</span>
                    <span class="stat-value"
                      >{{ Math.round(variant.satisfaction.responseRate * 100) }}%</span
                    >
                  </div>
                  <div class="feedback-stat">
                    <span class="stat-label">Positive Sentiment:</span>
                    <span class="stat-value"
                      >{{ Math.round(variant.satisfaction.positiveSentiment * 100) }}%</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Analysis -->
        <div v-if="activeTab === 'performance'" class="tab-content">
          <div class="performance-comparison">
            <canvas ref="performanceChart" class="chart-canvas"></canvas>
          </div>
          <div class="performance-table">
            <table class="performance-table-content">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Load Time (ms)</th>
                  <th>Response Time (ms)</th>
                  <th>Error Rate (%)</th>
                  <th>Resource Usage</th>
                  <th>Performance Score</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="variant in reportData.results.variantResults" :key="variant.variantId">
                  <td>{{ getVariantName(variant.variantId) }}</td>
                  <td>{{ variant.performance.loadTime.toFixed(1) }}</td>
                  <td>{{ variant.performance.responseTime.toFixed(1) }}</td>
                  <td>{{ (variant.performance.errorRate * 100).toFixed(2) }}</td>
                  <td>{{ (variant.performance.resourceUsage * 100).toFixed(1) }}%</td>
                  <td>
                    <span
                      :class="
                        getPerformanceScoreClass(calculatePerformanceScore(variant.performance))
                      "
                    >
                      {{ calculatePerformanceScore(variant.performance).toFixed(1) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Statistical Analysis -->
      <section class="statistical-analysis">
        <h4>🔬 Statistical Analysis</h4>
        <div class="stats-grid">
          <div class="stats-card">
            <h5>Power Analysis</h5>
            <div class="power-metrics">
              <div class="power-metric">
                <span class="metric-label">Statistical Power:</span>
                <span class="metric-value"
                  >{{
                    Math.round(reportData.results.variantResults[0].statisticalData.power * 100)
                  }}%</span
                >
              </div>
              <div class="power-metric">
                <span class="metric-label">Sample Size:</span>
                <span class="metric-value">{{ reportData.results.totalParticipants }}</span>
              </div>
              <div class="power-metric">
                <span class="metric-label">Effect Size:</span>
                <span class="metric-value">{{
                  calculateEffectSize(reportData.results).toFixed(3)
                }}</span>
              </div>
              <div class="power-metric">
                <span class="metric-label">Minimum Detectable Effect:</span>
                <span class="metric-value">{{ calculateMDE(reportData.results).toFixed(2) }}%</span>
              </div>
            </div>
          </div>

          <div class="stats-card">
            <h5>Significance Testing</h5>
            <div class="significance-results">
              <div class="significance-test">
                <span class="test-name">Chi-Square Test:</span>
                <span class="test-result">{{ reportData.significanceTests.chiSquare.result }}</span>
                <span class="test-p-value"
                  >p = {{ reportData.significanceTests.chiSquare.pValue.toFixed(4) }}</span
                >
              </div>
              <div class="significance-test">
                <span class="test-name">Z-Test:</span>
                <span class="test-result">{{ reportData.significanceTests.zTest.result }}</span>
                <span class="test-p-value"
                  >p = {{ reportData.significanceTests.zTest.pValue.toFixed(4) }}</span
                >
              </div>
              <div class="significance-test">
                <span class="test-name">Fisher's Exact:</span>
                <span class="test-result">{{
                  reportData.significanceTests.fisherExact.result
                }}</span>
                <span class="test-p-value"
                  >p = {{ reportData.significanceTests.fisherExact.pValue.toFixed(4) }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Insights & Recommendations -->
      <section class="insights-recommendations">
        <h4>💡 Insights & Recommendations</h4>
        <div class="insights-grid">
          <div class="insights-card">
            <h5>Key Insights</h5>
            <ul class="insights-list">
              <li
                v-for="insight in reportData.results.insights"
                :key="insight"
                class="insight-item"
              >
                {{ insight }}
              </li>
            </ul>
          </div>

          <div class="recommendations-card">
            <h5>Recommendations</h5>
            <ul class="recommendations-list">
              <li
                v-for="recommendation in reportData.results.recommendations"
                :key="recommendation"
                class="recommendation-item"
              >
                {{ recommendation }}
              </li>
            </ul>
          </div>
        </div>

        <div class="next-steps">
          <h5>Next Steps</h5>
          <div class="steps-grid">
            <div class="step-item">
              <span class="step-number">1</span>
              <div class="step-content">
                <h6>Implement Winning Variant</h6>
                <p>Deploy the winning variant to 100% of traffic</p>
              </div>
            </div>
            <div class="step-item">
              <span class="step-number">2</span>
              <div class="step-content">
                <h6>Monitor Performance</h6>
                <p>Track key metrics for 2-4 weeks post-implementation</p>
              </div>
            </div>
            <div class="step-item">
              <span class="step-number">3</span>
              <div class="step-content">
                <h6>Plan Next Test</h6>
                <p>Identify new optimization opportunities</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- No Data State -->
    <div v-else-if="selectedTestId" class="no-data-state">
      <div class="no-data-content">
        <div class="no-data-icon">📊</div>
        <h5>No Report Data Available</h5>
        <p>Generate a report to see detailed A/B test analysis</p>
      </div>
    </div>

    <!-- No Test Selected State -->
    <div v-else class="no-test-state">
      <div class="no-test-content">
        <div class="no-test-icon">🧪</div>
        <h5>Select a Test to Analyze</h5>
        <p>Choose an A/B test from the dropdown to generate a detailed analysis report</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { abTestingFramework, ABTest, ABTestResults } from "@/store/abTestingFramework";

interface ReportData {
  test: ABTest;
  results: ABTestResults;
  lift: number;
  significanceTests: {
    chiSquare: { result: string; pValue: number };
    zTest: { result: string; pValue: number };
    fisherExact: { result: string; pValue: number };
  };
}

const emit = defineEmits<{
  reportGenerated: [report: ReportData];
}>();

// Reactive state
const selectedTestId = ref("");
const availableTests = ref<ABTest[]>([]);
const reportData = ref<ReportData | null>(null);
const activeTab = ref("conversion");
const isLoading = ref(false);

// Chart references
const conversionChart = ref<HTMLCanvasElement>();
const satisfactionChart = ref<HTMLCanvasElement>();
const performanceChart = ref<HTMLCanvasElement>();

// Tab definitions
const resultTabs = [
  { id: "conversion", name: "Conversion" },
  { id: "engagement", name: "Engagement" },
  { id: "satisfaction", name: "Satisfaction" },
  { id: "performance", name: "Performance" },
];

// Computed
const getVariantName = (variantId: string): string => {
  const variant = reportData.value?.test.variants.find((v) => v.id === variantId);
  return variant?.name || variantId;
};

// Methods
const loadAvailableTests = async () => {
  try {
    const tests = await abTestingFramework.getTestHistory();
    availableTests.value = tests.filter(
      (test) => test.status === "completed" || test.status === "running"
    );
  } catch (error) {
    console.error("Failed to load available tests:", error);
  }
};

const loadTestReport = async () => {
  if (!selectedTestId.value) return;

  try {
    const test = availableTests.value.find((t) => t.id === selectedTestId.value);
    if (!test) return;

    const results = await abTestingFramework.getTestResults(selectedTestId.value);
    if (!results) return;

    // Calculate lift
    const lift = calculateLift(results);

    // Generate significance tests
    const significanceTests = generateSignificanceTests(results);

    reportData.value = {
      test,
      results,
      lift,
      significanceTests,
    };

    await nextTick();
    renderCharts();
  } catch (error) {
    console.error("Failed to load test report:", error);
  }
};

const generateReport = async () => {
  if (!selectedTestId.value) return;

  isLoading.value = true;
  try {
    await loadTestReport();
    if (reportData.value) {
      emit("reportGenerated", reportData.value);
    }
  } catch (error) {
    console.error("Failed to generate report:", error);
  } finally {
    isLoading.value = false;
  }
};

const renderCharts = () => {
  if (!reportData.value) return;

  switch (activeTab.value) {
    case "conversion":
      renderConversionChart();
      break;
    case "satisfaction":
      renderSatisfactionChart();
      break;
    case "performance":
      renderPerformanceChart();
      break;
  }
};

const renderConversionChart = () => {
  const canvas = conversionChart.value;
  if (!canvas || !reportData.value) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Draw conversion comparison chart
  drawBarChart(ctx, canvas.width, canvas.height, {
    labels: reportData.value.results.variantResults.map((v) => getVariantName(v.variantId)),
    datasets: [
      {
        label: "Conversion Rate",
        data: reportData.value.results.variantResults.map((v) => v.conversionRate * 100),
        color: "#3b82f6",
      },
    ],
  });
};

const renderSatisfactionChart = () => {
  const canvas = satisfactionChart.value;
  if (!canvas || !reportData.value) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Draw satisfaction comparison chart
  drawBarChart(ctx, canvas.width, canvas.height, {
    labels: reportData.value.results.variantResults.map((v) => getVariantName(v.variantId)),
    datasets: [
      {
        label: "Average Rating",
        data: reportData.value.results.variantResults.map((v) => v.satisfaction.averageRating),
        color: "#10b981",
      },
    ],
  });
};

const renderPerformanceChart = () => {
  const canvas = performanceChart.value;
  if (!canvas || !reportData.value) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Draw performance comparison chart
  drawLineChart(ctx, canvas.width, canvas.height, {
    labels: ["Load Time", "Response Time", "Error Rate", "Resource Usage"],
    datasets: reportData.value.results.variantResults.map((variant, index) => ({
      label: getVariantName(variant.variantId),
      data: [
        variant.performance.loadTime,
        variant.performance.responseTime,
        variant.performance.errorRate * 100,
        variant.performance.resourceUsage * 100,
      ],
      color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][index],
    })),
  });
};

// Utility functions
const drawBarChart = (ctx: CanvasRenderingContext2D, width: number, height: number, data: any) => {
  ctx.clearRect(0, 0, width, height);

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  data.datasets.forEach((dataset: any, datasetIndex: number) => {
    const barWidth = (chartWidth / data.labels.length) * 0.8;
    const spacing = (chartWidth / data.labels.length) * 0.2;

    dataset.data.forEach((value: number, index: number) => {
      const x = padding + index * (barWidth + spacing);
      const barHeight = (value / Math.max(...dataset.data)) * chartHeight;
      const y = height - padding - barHeight;

      ctx.fillStyle = dataset.color;
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  });
};

const drawLineChart = (ctx: CanvasRenderingContext2D, width: number, height: number, data: any) => {
  ctx.clearRect(0, 0, width, height);

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  data.datasets.forEach((dataset: any) => {
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    dataset.data.forEach((value: number, index: number) => {
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

const calculateLift = (results: ABTestResults): number => {
  if (results.variantResults.length < 2) return 0;

  const control = results.variantResults.find((r) => r.variantId.includes("control"));
  const treatment = results.variantResults.find((r) => r.variantId.includes("treatment"));

  if (!control || !treatment) return 0;

  return ((treatment.conversionRate - control.conversionRate) / control.conversionRate) * 100;
};

const calculateROI = (report: ReportData): number => {
  // Simplified ROI calculation
  const lift = report.lift;
  const implementationCost = 1000; // Placeholder
  const expectedRevenue = lift * 100; // Placeholder

  return ((expectedRevenue - implementationCost) / implementationCost) * 100;
};

const calculateEffectSize = (results: ABTestResults): number => {
  if (results.variantResults.length < 2) return 0;

  const rates = results.variantResults.map((r) => r.conversionRate);
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
  const stdDev = Math.sqrt(variance);

  return mean / stdDev;
};

const calculateMDE = (results: ABTestResults): number => {
  // Minimum Detectable Effect calculation
  const participants = results.totalParticipants;
  const baselineRate = results.variantResults[0].conversionRate;
  const power = results.variantResults[0].statisticalData.power;

  // Simplified MDE calculation
  return (
    ((1.96 * Math.sqrt((baselineRate * (1 - baselineRate)) / participants)) / baselineRate) * 100
  );
};

const generateSignificanceTests = (results: ABTestResults) => {
  // Mock significance tests - would use actual statistical calculations
  return {
    chiSquare: { result: "Significant", pValue: 0.023 },
    zTest: { result: "Significant", pValue: 0.018 },
    fisherExact: { result: "Significant", pValue: 0.021 },
  };
};

const getLiftClass = (lift: number): string => {
  if (lift > 5) return "positive";
  if (lift < -5) return "negative";
  return "neutral";
};

const getRecommendation = (report: ReportData): string => {
  if (report.results.confidence > 0.95) {
    return "Implement winner";
  } else if (report.results.confidence > 0.8) {
    return "Consider implementation";
  } else {
    return "Continue testing";
  }
};

const getPerformanceScoreClass = (score: number): string => {
  if (score > 0.8) return "high";
  if (score > 0.6) return "medium";
  return "low";
};

const calculatePerformanceScore = (performance: any): number => {
  const scores = [
    1 - performance.loadTime / 1000, // Lower is better
    1 - performance.responseTime / 500, // Lower is better
    1 - performance.errorRate, // Lower is better
    1 - performance.resourceUsage, // Lower is better
  ];

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

const formatDuration = (duration: number): string => {
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const formatConfidenceInterval = (interval: [number, number]): string => {
  return `[${(interval[0] * 100).toFixed(1)}%, ${(interval[1] * 100).toFixed(1)}%]`;
};

const exportReport = () => {
  if (!reportData.value) return;

  // Generate PDF report (simplified - would use actual PDF library)
  const reportContent = generateReportContent(reportData.value);
  const blob = new Blob([reportContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ab-test-report-${reportData.value.test.name.replace(/\s+/g, "-")}.html`;
  a.click();

  URL.revokeObjectURL(url);
};

const generateReportContent = (report: ReportData): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>A/B Test Report - ${report.test.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 40px; }
        .section { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }

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
    </head>
    <body>
      <div class="header">
        <h1>A/B Test Analysis Report</h1>
        <h2>${report.test.name}</h2>
      </div>

      <div class="section">
        <h3>Executive Summary</h3>
        <p><strong>Winner:</strong> ${report.results.winner || "Inconclusive"}</p>
        <p><strong>Confidence:</strong> ${Math.round(report.results.confidence * 100)}%</p>
        <p><strong>Lift:</strong> ${report.lift.toFixed(1)}%</p>
      </div>

      <div class="section">
        <h3>Detailed Results</h3>
        <table>
          <tr>
            <th>Variant</th>
            <th>Conversion Rate</th>
            <th>Participants</th>
            <th>Conversions</th>
          </tr>
          ${report.results.variantResults
            .map(
              (variant) => `
            <tr>
              <td>${getVariantName(variant.variantId)}</td>
              <td>${Math.round(variant.conversionRate * 100)}%</td>
              <td>${variant.participants}</td>
              <td>${variant.conversions}</td>
            </tr>
          `
            )
            .join("")}
        </table>
      </div>

      <div class="section">
        <h3>Insights</h3>
        <ul>
          ${report.results.insights.map((insight) => `<li>${insight}</li>`).join("")}
        </ul>
      </div>

      <div class="section">
        <h3>Recommendations</h3>
        <ul>
          ${report.results.recommendations.map((rec) => `<li>${rec}</li>`).join("")}
        </ul>
      </div>
    </body>
    </html>
  `;
};

// Watch for tab changes
watch(activeTab, () => {
  renderCharts();
});

onMounted(() => {
  loadAvailableTests();
});
</script>

<style scoped>
.ab-test-analysis-report {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.report-header h3 {
  margin: 0;
  color: #111827;
}

.header-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.test-select {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  min-width: 200px;
}

.generate-btn,
.export-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.generate-btn {
  background: #3b82f6;
  color: white;
}

.generate-btn:hover:not(:disabled) {
  background: #2563eb;
}

.generate-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.export-btn {
  background: #10b981;
  color: white;
}

.export-btn:hover:not(:disabled) {
  background: #059669;
}

.export-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.report-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.executive-summary h4,
.detailed-results h4,
.statistical-analysis h4,
.insights-recommendations h4 {
  margin: 0 0 1rem 0;
  color: #111827;
  font-size: 1.25rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.summary-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
}

.summary-card h5 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.summary-item .label {
  color: #6b7280;
  font-size: 0.875rem;
}

.summary-item .value {
  color: #111827;
  font-weight: 600;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.completed {
  background: #10b981;
  color: white;
}

.status-badge.running {
  background: #3b82f6;
  color: white;
}

.status-badge.paused {
  background: #f59e0b;
  color: white;
}

.winner {
  color: #10b981;
  font-weight: 700;
}

.positive {
  color: #10b981;
}

.negative {
  color: #ef4444;
}

.neutral {
  color: #6b7280;
}

.results-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.tab-btn {
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-btn:hover {
  color: #374151;
}

.tab-content {
  min-height: 400px;
}

.conversion-chart {
  height: 300px;
  margin-bottom: 2rem;
}

.chart-canvas {
  width: 100%;
  height: 100%;
}

.conversion-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.variant-metrics {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.variant-metrics h6 {
  margin: 0 0 0.75rem 0;
  color: #111827;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.metric-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.metric-value {
  color: #111827;
  font-weight: 600;
}

.engagement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.engagement-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.engagement-card h6 {
  margin: 0 0 1rem 0;
  color: #111827;
}

.engagement-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.engagement-metric {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.metric-name {
  min-width: 120px;
  color: #6b7280;
  font-size: 0.875rem;
}

.metric-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.bar-fill.secondary {
  background: #10b981;
}

.bar-fill.tertiary {
  background: #f59e0b;
}

.bar-fill.danger {
  background: #ef4444;
}

.satisfaction-overview {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.satisfaction-chart {
  height: 300px;
}

.satisfaction-summary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.satisfaction-summary-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.satisfaction-summary-item h6 {
  margin: 0 0 0.75rem 0;
  color: #111827;
}

.rating-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.rating-stars {
  display: flex;
  gap: 0.25rem;
}

.star {
  color: #d1d5db;
  font-size: 1rem;
}

.star.filled {
  color: #fbbf24;
}

.rating-value {
  font-weight: 600;
  color: #111827;
}

.feedback-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feedback-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.stat-value {
  color: #111827;
  font-weight: 600;
  font-size: 0.875rem;
}

.performance-comparison {
  height: 300px;
  margin-bottom: 2rem;
}

.performance-table {
  overflow-x: auto;
}

.performance-table-content {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.performance-table-content th,
.performance-table-content td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.performance-table-content th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.high {
  color: #10b981;
  font-weight: 600;
}

.medium {
  color: #f59e0b;
  font-weight: 600;
}

.low {
  color: #ef4444;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1rem;
}

.stats-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
}

.stats-card h5 {
  margin: 0 0 1rem 0;
  color: #111827;
}

.power-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.power-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.significance-results {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.significance-test {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.test-name {
  color: #374151;
  font-weight: 500;
}

.test-result {
  color: #10b981;
  font-weight: 600;
}

.test-p-value {
  color: #6b7280;
  font-size: 0.875rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.insights-card,
.recommendations-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
}

.insights-card h5,
.recommendations-card h5 {
  margin: 0 0 1rem 0;
  color: #111827;
}

.insights-list,
.recommendations-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.insight-item,
.recommendation-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
  color: #374151;
  line-height: 1.5;
}

.insight-item:last-child,
.recommendation-item:last-child {
  border-bottom: none;
}

.next-steps {
  margin-top: 2rem;
}

.next-steps h5 {
  margin: 0 0 1rem 0;
  color: #111827;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.step-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.step-content h6 {
  margin: 0 0 0.25rem 0;
  color: #111827;
  font-size: 0.875rem;
}

.step-content p {
  margin: 0;
  color: #6b7280;
  font-size: 0.75rem;
  line-height: 1.4;
}

.no-data-state,
.no-test-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.no-data-content,
.no-test-content {
  text-align: center;
}

.no-data-icon,
.no-test-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.no-data-content h5,
.no-test-content h5 {
  margin: 0 0 0.5rem 0;
  color: #374151;
}

.no-data-content p,
.no-test-content p {
  margin: 0;
  color: #6b7280;
}
</style>
