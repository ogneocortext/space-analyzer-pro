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
        <button :disabled="loading" class="btn btn-secondary" @click="refreshReports">
          <span v-if="loading" class="spinner" />
          <span v-else>🔄 Refresh</span>
        </button>
      </div>
    </header>

    <!-- AI Summary -->
    <AIReportSummary
      v-if="currentAnalysis"
      :data="{
        totalFiles: currentAnalysis.totalFiles || 0,
        totalSize: currentAnalysis.totalSize || 0,
        categories: Object.keys(currentAnalysis.categories || {}).length,
        largeFiles: currentAnalysis.largeFiles?.length || 0,
      }"
    />

    <!-- Templates Section -->
    <section class="templates-section">
      <div class="section-header">
        <h2>📄 Report Templates</h2>
        <button class="btn btn-secondary" @click="showTemplateModal = true">+ New Template</button>
      </div>

      <div v-if="templates.length === 0" class="empty-state-small">
        <p>No custom templates yet. Create one to customize your report styles.</p>
      </div>

      <div v-else class="templates-grid">
        <div
          v-for="template in templates"
          :key="template.id"
          class="template-card"
          :class="{ default: template.is_default }"
        >
          <div class="template-header">
            <h4>{{ template.template_name }}</h4>
            <span v-if="template.is_default" class="default-badge">Default</span>
          </div>
          <p class="template-type">
            {{ template.template_type }}
          </p>
          <p class="template-desc">
            {{ template.description || "No description" }}
          </p>
          <div class="template-actions">
            <button class="btn btn-sm btn-primary" @click="useTemplate(template)">Use</button>
            <button class="btn btn-sm btn-secondary" @click="editTemplate(template)">Edit</button>
            <button class="btn btn-sm btn-secondary" @click="duplicateTemplate(template)">
              Copy
            </button>
            <button
              v-if="!template.is_default"
              class="btn btn-sm btn-danger"
              @click="deleteTemplate(template)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Generate Report Section -->
    <section class="generate-section report-generator">
      <h2>Generate New Report</h2>
      <div class="generate-cards">
        <div v-if="currentAnalysis" class="generate-card">
          <h3>📁 Analysis Report</h3>
          <p>Generate a comprehensive PDF report of your current directory analysis</p>
          <div class="analysis-info">
            <span class="badge">{{ formatBytes(currentAnalysis.totalSize) }}</span>
            <span class="badge">{{ currentAnalysis.totalFiles?.toLocaleString() }} files</span>
          </div>
          <div v-if="analysisTemplates.length > 0" class="template-select">
            <select v-model="selectedAnalysisTemplate" class="form-select">
              <option :value="null">Default Template</option>
              <option v-for="t in analysisTemplates" :key="t.id" :value="t.id">
                {{ t.template_name }}
              </option>
            </select>
          </div>
          <button
            :disabled="generating.analysis"
            class="btn btn-primary"
            data-action="generate"
            @click="generateAnalysisReport"
          >
            <span v-if="generating.analysis" class="spinner" />
            <span v-else>Generate Report</span>
          </button>
        </div>

        <div v-if="currentAnalysis?.directory" class="generate-card">
          <h3>🔍 Complexity Report</h3>
          <p>Generate a code complexity analysis report for code files</p>
          <div class="analysis-info">
            <span class="badge">Code Analysis</span>
            <span class="badge">Complexity Metrics</span>
          </div>
          <div v-if="complexityTemplates.length > 0" class="template-select">
            <select v-model="selectedComplexityTemplate" class="form-select">
              <option :value="null">Default Template</option>
              <option v-for="t in complexityTemplates" :key="t.id" :value="t.id">
                {{ t.template_name }}
              </option>
            </select>
          </div>
          <button
            :disabled="generating.complexity"
            class="btn btn-primary"
            @click="generateComplexityReport"
          >
            <span v-if="generating.complexity" class="spinner" />
            <span v-else>Generate Report</span>
          </button>
        </div>

        <div v-if="!currentAnalysis" class="generate-card empty">
          <h3>⚠️ No Analysis Available</h3>
          <p>Please run a directory analysis first to generate reports</p>
          <router-link to="/" class="btn btn-secondary"> Go to Analysis </router-link>
        </div>
      </div>
    </section>

    <!-- Batch Export Section -->
    <section class="batch-section export">
      <div class="section-header">
        <h2>🔄 Batch Export</h2>
        <button
          :disabled="!analysisHistory.length"
          class="btn btn-secondary"
          @click="showBatchModal = true"
        >
          + New Batch Job
        </button>
      </div>

      <div v-if="batchJobs.length === 0" class="empty-state-small">
        <p>No batch export jobs yet. Create one to export multiple analyses at once.</p>
      </div>

      <div v-else class="batch-jobs-list">
        <div v-for="job in batchJobs" :key="job.id" class="batch-job-card" :class="job.status">
          <div class="job-info">
            <h4>{{ job.job_name }}</h4>
            <div class="job-meta">
              <span class="badge" :class="job.status">{{ job.status }}</span>
              <span>{{ job.job_type.toUpperCase() }}</span>
              <span>{{ job.processed_items || 0 }} / {{ job.total_items }} items</span>
              <span>{{ formatDate(job.created_at) }}</span>
            </div>
            <div v-if="job.status === 'processing'" class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: (job.processed_items / job.total_items) * 100 + '%' }"
              />
            </div>
          </div>
          <div class="job-actions">
            <button
              v-if="job.status === 'pending' || job.status === 'processing'"
              class="btn btn-sm btn-danger"
              @click="cancelBatchJob(job.id)"
            >
              Cancel
            </button>
            <button
              v-if="job.status === 'completed' && job.output_files"
              class="btn btn-sm btn-primary"
              @click="downloadBatchResults(job)"
            >
              Download
            </button>
            <button class="btn btn-sm btn-secondary" @click="deleteBatchJob(job.id)">🗑️</button>
          </div>
        </div>
      </div>
    </section>

    <!-- PDF Viewer Section -->
    <section v-if="currentReport" class="viewer-section">
      <div class="viewer-header">
        <h2>📄 Report Viewer</h2>
        <div class="viewer-actions">
          <a :href="currentReport.viewUrl" target="_blank" class="btn btn-secondary">
            Open in New Tab
          </a>
          <a :href="currentReport.downloadUrl" download class="btn btn-primary">
            ⬇️ Download PDF
          </a>
          <button class="btn btn-icon" @click="currentReport = null">✕</button>
        </div>
      </div>
      <div class="pdf-container">
        <iframe
          v-if="currentReport"
          :src="currentReport.viewUrl"
          class="pdf-iframe"
          frameborder="0"
          title="PDF Report Viewer"
        />
      </div>
    </section>

    <!-- Reports List -->
    <section class="reports-list">
      <h2>Generated Reports</h2>

      <div v-if="loading && !reports.length" class="loading-state">
        <div class="spinner large" />
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
              class="btn btn-sm btn-secondary preview-btn"
              title="Preview"
              @click.stop="openPreview(report)"
            >
              🔍
            </button>
            <button class="btn btn-sm btn-secondary" title="View" @click.stop="viewReport(report)">
              👁️
            </button>
            <a
              :href="report.downloadUrl"
              download
              class="btn btn-sm btn-secondary"
              title="Download"
              @click.stop
            >
              ⬇️
            </a>
            <button class="btn btn-sm btn-danger" title="Delete" @click.stop="deleteReport(report)">
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

    <!-- Template Editor Modal -->
    <div v-if="showTemplateModal" class="modal-overlay" @click.self="closeTemplateModal">
      <div class="modal-container modal-large">
        <div class="modal-header">
          <h3>{{ editingTemplate?.id ? "Edit Template" : "Create New Template" }}</h3>
          <button class="btn btn-icon" @click="closeTemplateModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Template Name *</label>
            <input
              v-model="templateForm.templateName"
              type="text"
              class="form-input"
              placeholder="e.g., Executive Summary"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Template Type *</label>
              <select v-model="templateForm.templateType" class="form-input">
                <option value="analysis">Analysis Report</option>
                <option value="complexity">Complexity Report</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div class="form-group">
              <label>File Limit</label>
              <input
                v-model.number="templateForm.fileLimit"
                type="number"
                class="form-input"
                min="10"
                max="1000"
              />
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="templateForm.description"
              class="form-input"
              rows="2"
              placeholder="Brief description of this template..."
            />
          </div>
          <div class="form-group">
            <label>Include Sections</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input v-model="templateForm.includeSections" type="checkbox" value="summary" />
                Summary Cards
              </label>
              <label class="checkbox-label">
                <input v-model="templateForm.includeSections" type="checkbox" value="categories" />
                Categories Table
              </label>
              <label class="checkbox-label">
                <input v-model="templateForm.includeSections" type="checkbox" value="extensions" />
                Extensions Table
              </label>
              <label class="checkbox-label">
                <input v-model="templateForm.includeSections" type="checkbox" value="files" />
                File Listings
              </label>
              <label class="checkbox-label">
                <input v-model="templateForm.includeSections" type="checkbox" value="charts" />
                Charts/Visuals
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Color Scheme</label>
            <div class="color-picker-group">
              <div class="color-picker-item">
                <label>Primary</label>
                <input v-model="templateForm.colorScheme.primary" type="color" />
              </div>
              <div class="color-picker-item">
                <label>Secondary</label>
                <input v-model="templateForm.colorScheme.secondary" type="color" />
              </div>
              <div class="color-picker-item">
                <label>Accent</label>
                <input v-model="templateForm.colorScheme.accent" type="color" />
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Custom CSS (Optional)</label>
            <textarea
              v-model="templateForm.cssStyles"
              class="form-input code-input"
              rows="4"
              placeholder="/* Add custom CSS styles here */"
            />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="templateForm.isDefault" type="checkbox" />
              Set as default template for this type
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeTemplateModal">Cancel</button>
          <button
            :disabled="!templateForm.templateName || !templateForm.templateType"
            class="btn btn-primary"
            @click="saveTemplate"
          >
            {{ editingTemplate?.id ? "Update Template" : "Create Template" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Batch Job Modal -->
    <div v-if="showBatchModal" class="modal-overlay" @click.self="closeBatchModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>Create Batch Export Job</h3>
          <button class="btn btn-icon" @click="closeBatchModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Job Name</label>
            <input
              v-model="batchJobName"
              type="text"
              class="form-input"
              placeholder="e.g., Q4 Analysis Reports"
            />
          </div>
          <div class="form-group">
            <label>Export Type</label>
            <select v-model="batchJobType" class="form-input">
              <option value="pdf">PDF Reports</option>
              <option value="csv">CSV Data</option>
              <option value="json">JSON Data</option>
            </select>
          </div>
          <div class="form-group">
            <label>Select Analyses * ({{ selectedAnalysesForBatch.length }} selected)</label>
            <div class="analyses-list">
              <div
                v-for="analysis in analysisHistory"
                :key="analysis.analysisId"
                class="analysis-checkbox-item"
              >
                <label class="checkbox-label-row">
                  <input
                    v-model="selectedAnalysesForBatch"
                    type="checkbox"
                    :value="analysis.analysisId"
                  />
                  <div class="analysis-info-row">
                    <span class="analysis-path">{{ analysis.directory || "Unknown" }}</span>
                    <span class="analysis-meta">
                      {{ formatBytes(analysis.totalSize) }} •
                      {{ analysis.totalFiles?.toLocaleString() }} files
                    </span>
                  </div>
                </label>
              </div>
              <div v-if="analysisHistory.length === 0" class="empty-state-small">
                No analyses available. Run some analyses first.
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Template (Optional)</label>
            <select v-model="batchTemplateId" class="form-input">
              <option :value="null">Default Template</option>
              <option v-for="t in templates" :key="t.id" :value="t.id">
                {{ t.template_name }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeBatchModal">Cancel</button>
          <button
            :disabled="selectedAnalysesForBatch.length === 0"
            class="btn btn-primary"
            @click="createBatchJob"
          >
            Create Job ({{ selectedAnalysesForBatch.length }} items)
          </button>
        </div>
      </div>
    </div>

    <!-- Report Preview Modal -->
    <div v-if="showPreviewModal" class="modal-overlay" @click.self="closePreviewModal">
      <div class="modal-container modal-large">
        <div class="modal-header">
          <h3>Report Preview</h3>
          <button class="btn btn-icon" @click="closePreviewModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="previewLoading" class="preview-loading">
            <div class="spinner large" />
            <p>Generating preview...</p>
          </div>
          <div v-else-if="previewUrl" class="preview-container">
            <iframe :src="previewUrl" class="preview-iframe" frameborder="0" />
          </div>
          <div v-else-if="previewError" class="preview-error">
            <p>Failed to generate preview: {{ previewError }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closePreviewModal">Close</button>
          <a v-if="previewDownloadUrl" :href="previewDownloadUrl" download class="btn btn-primary">
            ⬇️ Download PDF
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import AIReportSummary from "../../components/ai/AIReportSummary.vue";

// State
const loading = ref(false);
const reports = ref<any[]>([]);
const currentReport = ref<any>(null);
const currentAnalysis = ref<any>(null);
const message = ref<{ text: string; type: "success" | "error" } | null>(null);
const generating = ref({
  analysis: false,
  complexity: false,
});

// Templates State
const templates = ref<any[]>([]);
const selectedAnalysisTemplate = ref<number | null>(null);
const selectedComplexityTemplate = ref<number | null>(null);
const showTemplateModal = ref(false);
const editingTemplate = ref<any>(null);

// Batch Export State
const batchJobs = ref<any[]>([]);
const analysisHistory = ref<any[]>([]);
const showBatchModal = ref(false);
const selectedAnalysesForBatch = ref<string[]>([]);
const batchJobName = ref("");
const batchJobType = ref("pdf");
const batchTemplateId = ref<number | null>(null);

// Template Form State
const templateForm = ref({
  templateName: "",
  templateType: "analysis",
  description: "",
  fileLimit: 100,
  includeSections: ["summary", "categories", "extensions", "files"],
  colorScheme: { primary: "#3b82f6", secondary: "#8b5cf6", accent: "#10b981" },
  cssStyles: "",
  isDefault: false,
});

// Preview State
const showPreviewModal = ref(false);
const previewLoading = ref(false);
const previewUrl = ref<string | null>(null);
const previewDownloadUrl = ref<string | null>(null);
const previewError = ref<string | null>(null);

// API Base URL
const API_BASE = "http://localhost:8080/api";

// Computed
const analysisTemplates = computed(() =>
  templates.value.filter((t) => t.template_type === "analysis")
);
const complexityTemplates = computed(() =>
  templates.value.filter((t) => t.template_type === "complexity")
);

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
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

// Show message
const showMessage = (text: string, type: "success" | "error") => {
  message.value = { text, type };
  setTimeout(() => {
    message.value = null;
  }, 3000);
};

// ============================================================
// Modal Methods
// ============================================================

const closeTemplateModal = () => {
  showTemplateModal.value = false;
  editingTemplate.value = null;
  resetTemplateForm();
};

const resetTemplateForm = () => {
  templateForm.value = {
    templateName: "",
    templateType: "analysis",
    description: "",
    fileLimit: 100,
    includeSections: ["summary", "categories", "extensions", "files"],
    colorScheme: { primary: "#3b82f6", secondary: "#8b5cf6", accent: "#10b981" },
    cssStyles: "",
    isDefault: false,
  };
};

const saveTemplate = async () => {
  if (!templateForm.value.templateName || !templateForm.value.templateType) {
    showMessage("Template name and type are required", "error");
    return;
  }

  try {
    const templateData = {
      templateName: templateForm.value.templateName,
      templateType: templateForm.value.templateType,
      description: templateForm.value.description,
      fileLimit: templateForm.value.fileLimit,
      includeSections: templateForm.value.includeSections,
      colorScheme: templateForm.value.colorScheme,
      cssStyles: templateForm.value.cssStyles,
      isDefault: templateForm.value.isDefault,
    };

    if (editingTemplate.value?.id) {
      // Update existing template
      const response = await fetch(`${API_BASE}/reports/templates/${editingTemplate.value.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData),
      });

      const data = await response.json();
      if (data.success) {
        showMessage("Template updated successfully!", "success");
        await fetchTemplates();
        closeTemplateModal();
      } else {
        showMessage(data.error || "Failed to update template", "error");
      }
    } else {
      // Create new template
      const response = await fetch(`${API_BASE}/reports/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData),
      });

      const data = await response.json();
      if (data.success) {
        templates.value.unshift(data.template);
        showMessage("Template created successfully!", "success");
        closeTemplateModal();
      } else {
        showMessage(data.error || "Failed to create template", "error");
      }
    }
  } catch (error) {
    showMessage("Failed to save template", "error");
  }
};

const closeBatchModal = () => {
  showBatchModal.value = false;
  selectedAnalysesForBatch.value = [];
  batchJobName.value = "";
  batchJobType.value = "pdf";
  batchTemplateId.value = null;
};

const closePreviewModal = () => {
  showPreviewModal.value = false;
  previewUrl.value = null;
  previewDownloadUrl.value = null;
  previewError.value = null;
  previewLoading.value = false;
};

const openPreview = async (report: any) => {
  showPreviewModal.value = true;
  previewLoading.value = true;
  previewError.value = null;

  try {
    const response = await fetch(`${API_BASE}/reports/preview/${report.filename}`);
    const data = await response.json();

    if (data.success && data.viewUrl) {
      previewUrl.value = data.viewUrl;
      previewDownloadUrl.value = data.downloadUrl || report.downloadUrl;
    } else {
      previewError.value = data.error || "Failed to load preview";
    }
  } catch (err) {
    previewError.value = "Failed to load preview";
  } finally {
    previewLoading.value = false;
  }
};

// ============================================================
// Templates Methods
// ============================================================

const fetchTemplates = async () => {
  try {
    const response = await fetch(`${API_BASE}/reports/templates`);
    const data = await response.json();
    if (data.success) {
      templates.value = data.templates;
    }
  } catch (error) {
    console.error("Failed to fetch templates:", error);
  }
};

const useTemplate = (template: any) => {
  if (template.template_type === "analysis") {
    selectedAnalysisTemplate.value = template.id;
  } else if (template.template_type === "complexity") {
    selectedComplexityTemplate.value = template.id;
  }
  showMessage(`Template "${template.template_name}" selected`, "success");
};

const editTemplate = (template: any) => {
  editingTemplate.value = { ...template };
  templateForm.value = {
    templateName: template.template_name || "",
    templateType: template.template_type || "analysis",
    description: template.description || "",
    fileLimit: template.file_limit || 100,
    includeSections: template.include_sections || ["summary", "categories", "extensions", "files"],
    colorScheme: template.color_scheme || {
      primary: "#3b82f6",
      secondary: "#8b5cf6",
      accent: "#10b981",
    },
    cssStyles: template.css_styles || "",
    isDefault: template.is_default || false,
  };
  showTemplateModal.value = true;
};

const duplicateTemplate = async (template: any) => {
  try {
    const response = await fetch(`${API_BASE}/reports/templates/${template.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newName: `${template.template_name} (Copy)` }),
    });

    const data = await response.json();
    if (data.success) {
      templates.value.unshift(data.template);
      showMessage("Template duplicated successfully!", "success");
    } else {
      showMessage(data.error || "Failed to duplicate template", "error");
    }
  } catch (error) {
    showMessage("Failed to duplicate template", "error");
  }
};

const deleteTemplate = async (template: any) => {
  if (!confirm(`Delete template "${template.template_name}"?`)) return;

  try {
    const response = await fetch(`${API_BASE}/reports/templates/${template.id}`, {
      method: "DELETE",
    });

    const data = await response.json();
    if (data.success) {
      templates.value = templates.value.filter((t) => t.id !== template.id);
      showMessage("Template deleted", "success");
    } else {
      showMessage(data.error || "Failed to delete template", "error");
    }
  } catch (error) {
    showMessage("Failed to delete template", "error");
  }
};

// ============================================================
// Batch Export Methods
// ============================================================

const fetchBatchJobs = async () => {
  try {
    const response = await fetch(`${API_BASE}/reports/batch`);
    const data = await response.json();
    if (data.success) {
      batchJobs.value = data.jobs;
    }
  } catch (error) {
    console.error("Failed to fetch batch jobs:", error);
  }
};

const fetchAnalysisHistory = async () => {
  try {
    const response = await fetch(`${API_BASE}/analysis/history`);
    const data = await response.json();
    if (data.success) {
      analysisHistory.value = data.analyses || [];
    }
  } catch (error) {
    console.error("Failed to fetch analysis history:", error);
  }
};

const createBatchJob = async () => {
  if (selectedAnalysesForBatch.value.length === 0) {
    showMessage("Please select at least one analysis", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/reports/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobName: batchJobName.value || `Batch Export ${new Date().toLocaleString()}`,
        jobType: "pdf",
        analysisIds: selectedAnalysesForBatch.value,
        exportOptions: { includeFiles: true, fileLimit: 100 },
      }),
    });

    const data = await response.json();
    if (data.success) {
      batchJobs.value.unshift(data.job);
      showMessage("Batch job created successfully!", "success");
      showBatchModal.value = false;
      batchJobName.value = "";
      selectedAnalysesForBatch.value = [];
    } else {
      showMessage(data.error || "Failed to create batch job", "error");
    }
  } catch (error) {
    showMessage("Failed to create batch job", "error");
  }
};

const cancelBatchJob = async (jobId: number) => {
  try {
    const response = await fetch(`${API_BASE}/reports/batch/${jobId}`, {
      method: "DELETE",
    });

    const data = await response.json();
    if (data.success) {
      const job = batchJobs.value.find((j) => j.id === jobId);
      if (job) job.status = "cancelled";
      showMessage("Batch job cancelled", "success");
    } else {
      showMessage(data.error || "Failed to cancel job", "error");
    }
  } catch (error) {
    showMessage("Failed to cancel batch job", "error");
  }
};

const deleteBatchJob = async (jobId: number) => {
  if (!confirm("Delete this batch job?")) return;

  try {
    const response = await fetch(`${API_BASE}/reports/batch/${jobId}`, {
      method: "DELETE",
    });

    const data = await response.json();
    if (data.success) {
      batchJobs.value = batchJobs.value.filter((j) => j.id !== jobId);
      showMessage("Batch job deleted", "success");
    } else {
      showMessage(data.error || "Failed to delete job", "error");
    }
  } catch (error) {
    showMessage("Failed to delete batch job", "error");
  }
};

const downloadBatchResults = (job: any) => {
  if (job.output_files && job.output_files.length > 0) {
    job.output_files.forEach((file: string) => {
      const filename = file.split("/").pop() || file.split("\\").pop() || file;
      const link = document.createElement("a");
      link.href = `/api/reports/download/${filename}`;
      link.download = filename;
      link.click();
    });
  }
};

// Initialize
onMounted(() => {
  fetchReports();
  fetchCurrentAnalysis();
  fetchTemplates();
  fetchBatchJobs();
  fetchAnalysisHistory();
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
  border-bottom: 2px solid var(--border-subtle, #2a2a2e);
}

.header-content h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary, #fafaf9);
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px 0;
}

.icon {
  font-size: 32px;
}

.subtitle {
  color: var(--text-secondary, #a1a1aa);
  margin: 0;
}

/* Generate Section */
.generate-section {
  margin-bottom: 32px;
}

.generate-section h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #fafaf9);
  margin-bottom: 16px;
}

.generate-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.generate-card {
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
  padding: 24px;
  transition: box-shadow 0.2s;
}

.generate-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-color: var(--border-strong, #3a3a40);
}

.generate-card.empty {
  background: var(--bg-elevated, #1a1a1e);
  text-align: center;
  border: 1px solid var(--border-subtle, #2a2a2e);
}

.generate-card.empty h3 {
  color: var(--text-primary, #fafaf9);
}

.generate-card.empty p {
  color: var(--text-secondary, #a1a1aa);
}

.generate-card h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary, #ffffff);
}

.generate-card p {
  color: var(--text-secondary, #a1a1aa);
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
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-secondary, #a1a1aa);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

/* Viewer Section */
.viewer-section {
  margin-bottom: 32px;
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-subtle, #2a2a2e);
  background: var(--bg-elevated, #1a1a1e);
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
  background: var(--bg-page, #0b0b0e);
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
  color: var(--text-primary, #ffffff);
  margin-bottom: 16px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 64px 24px;
  color: var(--text-secondary, #a1a1aa);
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
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.report-card:hover {
  border-color: var(--accent-indigo, #6366f1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.report-card.active {
  border-color: var(--accent-indigo, #6366f1);
  background: var(--accent-indigo-light, #6366f133);
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
  color: var(--text-primary, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-meta {
  font-size: 12px;
  color: var(--text-secondary, #a1a1aa);
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
  background: var(--accent-indigo, #6366f1);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-indigo-dark, #4f46e5);
}

.btn-secondary {
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-primary, #ffffff);
  border: 1px solid var(--border-strong, #3a3a40);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-elevated-hover, #222226);
  color: white;
}

.btn-danger {
  background: var(--accent-coral-light, #e85a4f33);
  color: var(--accent-coral, #e85a4f);
}

.btn-danger:hover {
  background: var(--accent-coral-light, #e85a4f33);
}

.btn-sm {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-icon {
  padding: 8px 12px;
  background: transparent;
  color: var(--text-secondary, #a1a1aa);
}

.btn-icon:hover {
  background: var(--bg-elevated-hover, #222226);
  color: var(--text-primary, #fafaf9);
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
  background: var(--accent-emerald-light, #32d58333);
  color: var(--accent-emerald-dark, #059669);
}

.status-message.error {
  background: var(--accent-coral-light, #e85a4f33);
  color: var(--accent-coral-dark, #dc2626);
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

/* Templates Section */
.templates-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #fafaf9);
  margin: 0;
}

.empty-state-small {
  padding: 24px;
  text-align: center;
  color: var(--text-primary, #fafaf9);
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #2a2a2e);
}

.empty-state-small p {
  color: var(--text-primary, #fafaf9);
  font-weight: 500;
  margin: 0;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.template-card {
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.template-card.default {
  border-color: var(--accent-indigo, #6366f1);
  background: var(--accent-indigo-light, #6366f133);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.template-header h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary, #fafaf9);
}

.default-badge {
  font-size: 11px;
  background: var(--accent-indigo, #6366f1);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
}

.template-type {
  font-size: 12px;
  color: var(--text-secondary, #6b6b70);
  text-transform: uppercase;
  margin: 0 0 8px 0;
}

.template-desc {
  font-size: 13px;
  color: var(--text-secondary, #6b6b70);
  margin: 0 0 12px 0;
  min-height: 36px;
}

.template-actions {
  display: flex;
  gap: 8px;
}

/* Batch Section */
.batch-section {
  margin-bottom: 32px;
}

.batch-jobs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.batch-job-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
}

.batch-job-card.pending {
  border-left: 4px solid var(--accent-amber, #ffb547);
}

.batch-job-card.processing {
  border-left: 4px solid var(--accent-indigo, #6366f1);
}

.batch-job-card.completed {
  border-left: 4px solid var(--accent-emerald, #32d583);
}

.batch-job-card.failed {
  border-left: 4px solid var(--accent-coral, #e85a4f);
}

.batch-job-card.cancelled {
  border-left: 4px solid var(--text-tertiary, #4a4a50);
}

.job-info {
  flex: 1;
}

.job-info h4 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.job-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary, #6b6b70);
  margin-bottom: 8px;
}

.job-meta .badge.pending {
  background: var(--accent-amber-light, #ffb54733);
  color: var(--accent-amber-dark, #f59e0b);
}

.job-meta .badge.processing {
  background: var(--accent-indigo-light, #6366f133);
  color: var(--accent-indigo, #6366f1);
}

.job-meta .badge.completed {
  background: var(--accent-emerald-light, #32d58333);
  color: var(--accent-emerald-dark, #059669);
}

.job-meta .badge.failed {
  background: var(--accent-coral-light, #e85a4f33);
  color: var(--accent-coral-dark, #dc2626);
}

.job-meta .badge.cancelled {
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-secondary, #6b6b70);
}

.progress-bar {
  height: 6px;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 3px;
  overflow: hidden;
  max-width: 300px;
}

.progress-fill {
  height: 100%;
  background: var(--accent-indigo, #6366f1);
  transition: width 0.3s ease;
}

.job-actions {
  display: flex;
  gap: 8px;
}

/* Form Select */
.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 6px;
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-primary, #fafaf9);
  font-size: 14px;
  margin-bottom: 12px;
}

.template-select {
  margin-top: 12px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-container {
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-container.modal-large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-subtle, #2a2a2e);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary, #fafaf9);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-elevated, #1a1a1e);
}

/* Form Styles */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #fafaf9);
  margin-bottom: 6px;
}

.form-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-primary, #fafaf9);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-indigo, #6366f1);
  box-shadow: 0 0 0 3px var(--accent-indigo-light, #6366f133);
}

.form-input.code-input {
  font-family: "Courier New", monospace;
  font-size: 13px;
}

/* Checkbox Styles */
.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary, #4b5563);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-color, #3b82f6);
}

.checkbox-label-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.checkbox-label-row:hover {
  background: var(--bg-elevated-hover, #222226);
}

/* Color Picker */
.color-picker-group {
  display: flex;
  gap: 16px;
}

.color-picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.color-picker-item label {
  font-size: 12px;
  color: var(--text-secondary, #6b6b70);
}

.color-picker-item input[type="color"] {
  width: 50px;
  height: 40px;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
  cursor: pointer;
  padding: 2px;
  background: var(--bg-elevated, #1a1a1e);
}

/* Analyses List */
.analyses-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
}

.analysis-checkbox-item {
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
  overflow: hidden;
}

.analysis-info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.analysis-path {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #fafaf9);
}

.analysis-meta {
  font-size: 12px;
  color: var(--text-secondary, #6b6b70);
}

/* Preview Modal */
.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px;
  gap: 16px;
  color: var(--text-secondary, #6b6b70);
}

.preview-container {
  height: 600px;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 8px;
  overflow: hidden;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-error {
  padding: 48px;
  text-align: center;
  color: #dc2626;
}

/* Preview Button for Report Cards */
.report-card .preview-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.report-card:hover .preview-btn {
  opacity: 1;
}
</style>
