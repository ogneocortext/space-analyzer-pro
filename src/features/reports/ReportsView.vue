<template>
  <div class="reports-view">
    <header class="page-header">
      <div class="header-content">
        <h1>
          <span class="icon">📊</span>
          PDF Reports
        </h1>
        <p class="subtitle">Generate and view professional PDF analysis reports</p>
      </div>
      <div class="header-actions">
        <button @click="refreshReports" :disabled="loading" class="btn btn-secondary">
          <span v-if="loading" class="spinner"></span>
          <span v-else>🔄 Refresh</span>
        </button>
      </div>
    </header>

    <!-- Generate Report Section -->
    <section class="generate-section">
      <h2>Generate New Report</h2>
      <div class="generate-cards">
        <div class="generate-card" v-if="currentAnalysis">
          <h3>📁 Analysis Report</h3>
          <p>Generate a comprehensive PDF report of your current directory analysis</p>
          <div class="analysis-info">
            <span class="badge">{{ formatBytes(currentAnalysis.totalSize) }}</span>
            <span class="badge">{{ currentAnalysis.totalFiles?.toLocaleString() }} files</span>
          </div>
          <button
            @click="generateAnalysisReport"
            :disabled="generating.analysis"
            class="btn btn-primary"
          >
            <span v-if="generating.analysis" class="spinner"></span>
            <span v-else>Generate Report</span>
          </button>
        </div>

        <div class="generate-card" v-if="currentAnalysis?.directory">
          <h3>🔍 Complexity Report</h3>
          <p>Generate a code complexity analysis report for code files</p>
          <div class="analysis-info">
            <span class="badge">Code Analysis</span>
            <span class="badge">Complexity Metrics</span>
          </div>
          <button
            @click="generateComplexityReport"
            :disabled="generating.complexity"
            class="btn btn-primary"
          >
            <span v-if="generating.complexity" class="spinner"></span>
            <span v-else>Generate Report</span>
          </button>
        </div>

        <div class="generate-card empty" v-if="!currentAnalysis">
          <h3>⚠️ No Analysis Available</h3>
          <p>Please run a directory analysis first to generate reports</p>
          <router-link to="/" class="btn btn-secondary">Go to Analysis</router-link>
        </div>
      </div>
    </section>

    <!-- PDF Viewer Section -->
    <section class="viewer-section" v-if="currentReport">
      <div class="viewer-header">
        <h2>📄 Report Viewer</h2>
        <div class="viewer-actions">
          <a
            :href="currentReport.viewUrl"
            target="_blank"
            class="btn btn-secondary"
          >
            Open in New Tab
          </a>
          <a
            :href="currentReport.downloadUrl"
            download
            class="btn btn-primary"
          >
            ⬇️ Download PDF
          </a>
          <button @click="currentReport = null" class="btn btn-icon">✕</button>
        </div>
      </div>
      <div class="pdf-container">
        <iframe
          v-if="currentReport"
          :src="currentReport.viewUrl"
          class="pdf-iframe"
          frameborder="0"
          title="PDF Report Viewer"
        ></iframe>
      </div>
    </section>

    <!-- Reports List -->
    <section class="reports-list">
      <h2>Generated Reports</h2>

      <div v-if="loading && !reports.length" class="loading-state">
        <div class="spinner large"></div>
        <p>Loading reports...</p>
      </div>

      <div v-else-if="!reports.length" class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>No Reports Yet</h3>
        <p>Generate your first report above to see it here</p>
      </div>

      <div v-else class="reports-grid">
        <div
          v-for="report in reports"
          :key="report.reportId"
          class="report-card"
          :class="{ active: currentReport?.reportId === report.reportId }"
          @click="viewReport(report)"
        >
          <div class="report-icon">📄</div>
          <div class="report-info">
            <h4>{{ report.filename }}</h4>
            <p class="report-meta">
              <span>{{ formatBytes(report.size) }}</span>
              <span>•</span>
              <span>{{ formatDate(report.createdAt) }}</span>
            </p>
          </div>
          <div class="report-actions">
            <button
              @click.stop="viewReport(report)"
              class="btn btn-sm btn-secondary"
              title="View"
            >
              👁️
            </button>
            <a
              :href="report.downloadUrl"
              download
              @click.stop
              class="btn btn-sm btn-secondary"
              title="Download"
            >
              ⬇️
            </a>
            <button
              @click.stop="deleteReport(report)"
              class="btn btn-sm btn-danger"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Status Messages -->
    <div v-if="message" :class="['status-message', message.type]">
      {{ message.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

// State
const loading = ref(false);
const reports = ref([]);
const currentReport = ref(null);
const currentAnalysis = ref(null);
const message = ref(null);
const generating = ref({
  analysis: false,
  complexity: false,
});

// API Base URL
const API_BASE = "http://localhost:8080/api";

// Fetch reports list
const fetchReports = async () => {
  loading.value = true;
  try {
    const response = await fetch(`${API_BASE}/reports`);
    const data = await response.json();
    if (data.success) {
      reports.value = data.reports;
    }
  } catch (error) {
    showMessage("Failed to fetch reports", "error");
  } finally {
    loading.value = false;
  }
};

// Refresh reports
const refreshReports = () => {
  fetchReports();
  fetchCurrentAnalysis();
};

// Fetch current analysis
const fetchCurrentAnalysis = async () => {
  try {
    // Try to get from localStorage or state management
    const saved = localStorage.getItem("currentAnalysis");
    if (saved) {
      currentAnalysis.value = JSON.parse(saved);
      return;
    }

    // Otherwise fetch from API
    const response = await fetch(`${API_BASE}/analysis/history`);
    const data = await response.json();
    if (data.success && data.analyses?.length > 0) {
      currentAnalysis.value = data.analyses[0];
    }
  } catch (error) {
    console.error("Failed to fetch current analysis:", error);
  }
};

// Generate analysis report
const generateAnalysisReport = async () => {
  if (!currentAnalysis.value?.analysisId) {
    showMessage("No analysis selected", "error");
    return;
  }

  generating.value.analysis = true;
  try {
    const response = await fetch(`${API_BASE}/reports/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: currentAnalysis.value.analysisId,
        title: `Analysis Report - ${currentAnalysis.value.directory || "Unknown"}`,
        includeFiles: true,
        fileLimit: 100,
      }),
    });

    const data = await response.json();
    if (data.success) {
      reports.value.unshift(data.report);
      currentReport.value = data.report;
      showMessage("Analysis report generated successfully!", "success");
    } else {
      showMessage(data.error || "Failed to generate report", "error");
    }
  } catch (error) {
    showMessage("Failed to generate report", "error");
  } finally {
    generating.value.analysis = false;
  }
};

// Generate complexity report
const generateComplexityReport = async () => {
  if (!currentAnalysis.value?.directory) {
    showMessage("No directory selected", "error");
    return;
  }

  generating.value.complexity = true;
  try {
    const response = await fetch(`${API_BASE}/reports/complexity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directory: currentAnalysis.value.directory,
        title: `Complexity Analysis - ${currentAnalysis.value.directory}`,
        fileLimit: 50,
      }),
    });

    const data = await response.json();
    if (data.success) {
      reports.value.unshift(data.report);
      currentReport.value = data.report;
      showMessage("Complexity report generated successfully!", "success");
    } else {
      showMessage(data.error || "Failed to generate report", "error");
    }
  } catch (error) {
    showMessage("Failed to generate report", "error");
  } finally {
    generating.value.complexity = false;
  }
};

// View report
const viewReport = (report: any) => {
  currentReport.value = report;
};

// Delete report
const deleteReport = async (report: any) => {
  if (!confirm(`Delete report "${report.filename}"?`)) return;

  try {
    const response = await fetch(`${API_BASE}/reports/${report.filename}`, {
      method: "DELETE",
    });

    const data = await response.json();
    if (data.success) {
      reports.value = reports.value.filter((r) => r.reportId !== report.reportId);
      if (currentReport.value?.reportId === report.reportId) {
        currentReport.value = null;
      }
      showMessage("Report deleted", "success");
    } else {
      showMessage(data.error || "Failed to delete report", "error");
    }
  } catch (error) {
    showMessage("Failed to delete report", "error");
  }
};

// Format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// Show message
const showMessage = (text: string, type: "success" | "error") => {
  message.value = { text, type };
  setTimeout(() => {
    message.value = null;
  }, 3000);
};

// Initialize
onMounted(() => {
  fetchReports();
  fetchCurrentAnalysis();
});
</script>

<style scoped>
.reports-view {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border-color, #e5e7eb);
}

.header-content h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary, #1f2937);
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px 0;
}

.icon {
  font-size: 32px;
}

.subtitle {
  color: var(--text-secondary, #6b7280);
  margin: 0;
}

/* Generate Section */
.generate-section {
  margin-bottom: 32px;
}

.generate-section h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  margin-bottom: 16px;
}

.generate-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.generate-card {
  background: var(--card-bg, white);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 24px;
  transition: box-shadow 0.2s;
}

.generate-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.generate-card.empty {
  background: var(--bg-secondary, #f9fafb);
  text-align: center;
}

.generate-card h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary, #1f2937);
}

.generate-card p {
  color: var(--text-secondary, #6b7280);
  margin: 0 0 16px 0;
  font-size: 14px;
}

.analysis-info {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.badge {
  background: var(--badge-bg, #e5e7eb);
  color: var(--badge-text, #374151);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

/* Viewer Section */
.viewer-section {
  margin-bottom: 32px;
  background: var(--card-bg, white);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-secondary, #f9fafb);
}

.viewer-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.viewer-actions {
  display: flex;
  gap: 8px;
}

.pdf-container {
  height: 800px;
  background: #525659;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Reports List */
.reports-list h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  margin-bottom: 16px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 64px 24px;
  color: var(--text-secondary, #6b7280);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.report-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--card-bg, white);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.report-card:hover {
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.report-card.active {
  border-color: var(--primary-color, #3b82f6);
  background: var(--primary-light, #eff6ff);
}

.report-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.report-info {
  flex: 1;
  min-width: 0;
}

.report-info h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text-primary, #1f2937);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-meta {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  margin: 0;
  display: flex;
  gap: 8px;
}

.report-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.report-card:hover .report-actions {
  opacity: 1;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover, #2563eb);
}

.btn-secondary {
  background: var(--secondary-bg, #e5e7eb);
  color: var(--secondary-text, #374151);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--secondary-hover, #d1d5db);
}

.btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.btn-danger:hover {
  background: #fecaca;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-icon {
  padding: 8px 12px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
}

.btn-icon:hover {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner.large {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Status Message */
.status-message {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

.status-message.success {
  background: #d1fae5;
  color: #065f46;
}

.status-message.error {
  background: #fee2e2;
  color: #991b1b;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
