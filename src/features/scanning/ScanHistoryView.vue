<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useAnalysisStore } from "../../store/analysis";
import {
  Clock,
  FolderOpen,
  HardDrive,
  FileText,
  Calendar,
  X,
  Eye,
  Download,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
} from "lucide-vue-next";
import { Card, Button } from "../../design-system/components";

const router = useRouter();
const store = useAnalysisStore();
const analyses = ref<any[]>([]);
const loading = ref(true);
const error = ref("");
const searchQuery = ref("");
const selectedAnalysis = ref<any | null>(null);
const showDetails = ref(false);

// Computed properties
const filteredAnalyses = computed(() => {
  if (!searchQuery.value) return analyses.value;

  const query = searchQuery.value.toLowerCase();
  return analyses.value.filter(
    (analysis) =>
      analysis.directory?.toLowerCase().includes(query) ||
      analysis.analysisId?.toLowerCase().includes(query)
  );
});

const sortedAnalyses = computed(() => {
  return filteredAnalyses.value.sort((a, b) => {
    const dateA = new Date(a.lastAnalyzed || a.startTime || 0);
    const dateB = new Date(b.lastAnalyzed || b.startTime || 0);
    return dateB.getTime() - dateA.getTime(); // Most recent first
  });
});

// Methods
const fetchAnalysisHistory = async () => {
  try {
    loading.value = true;
    error.value = "";

    // Try store method first, fallback to direct API call
    try {
      if (typeof store.getAnalysisHistory === "function") {
        analyses.value = await store.getAnalysisHistory();
        console.log(`✅ Loaded ${analyses.value.length} analyses from store`);
      } else {
        throw new Error("Store method not available");
      }
    } catch (storeError) {
      console.warn("Store method failed, using direct API call:", storeError);
      const response = await fetch("/api/analysis/history");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        analyses.value = data.analyses || [];
        console.log(`✅ Loaded ${analyses.value.length} analyses from API`);
      } else {
        throw new Error(data.error || "Failed to fetch analysis history");
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to connect to backend";
    error.value = errorMessage;
    console.error("Failed to fetch analysis history:", err);
    analyses.value = []; // Clear analyses on error
  } finally {
    loading.value = false;
  }
};

const viewAnalysis = (analysis: any) => {
  selectedAnalysis.value = analysis;
  showDetails.value = true;
};

const loadAnalysis = async (analysis: any) => {
  try {
    error.value = "";

    // Set the analysis data in store for the scan view to use
    if (analysis && analysis.directory) {
      // Navigate to scan view with the analysis data
      await router.push({
        name: "scan",
        query: {
          path: analysis.directory,
          analysisId: analysis.analysisId,
        },
      });
    } else {
      throw new Error("Invalid analysis data");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to load analysis";
    error.value = errorMessage;
    console.error("Failed to load analysis:", err);
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const formatDuration = (startTime: number, endTime?: number) => {
  const end = endTime || Date.now();
  const duration = end - startTime;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

// Initialize
onMounted(() => {
  fetchAnalysisHistory();
});
</script>

<template>
  <div class="scan-history-view">
    <div class="header">
      <div class="header-content">
        <div class="flex items-center gap-3">
          <Clock class="w-6 h-6 text-blue-400" />
          <h1 class="text-2xl font-bold text-slate-100">Scan History</h1>
        </div>
        <p class="text-slate-400 mt-1">View and manage your previous directory scans</p>
      </div>

      <div class="header-actions">
        <div class="search-box">
          <Search class="w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search scans..."
            class="search-input"
          />
        </div>
        <Button @click="fetchAnalysisHistory" :disabled="loading" variant="secondary">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
          Refresh
        </Button>
        <Button @click="router.push('/scan')" variant="primary">
          <FolderOpen class="w-4 h-4" />
          New Scan
        </Button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-state">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h3>Failed to Load Scan History</h3>
        <p class="error-message">{{ error }}</p>
        <div class="error-actions">
          <Button @click="fetchAnalysisHistory" variant="primary">Try Again</Button>
          <Button @click="router.push('/scan')" variant="secondary">Start New Scan</Button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="loading-state">
      <div class="loading-content">
        <RefreshCw class="w-8 h-8 animate-spin text-blue-400" />
        <h3>Loading Scan History</h3>
        <p>Please wait while we fetch your previous scans...</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="sortedAnalyses.length === 0" class="empty-state">
      <div class="empty-content">
        <Clock class="w-16 h-16 text-slate-600" />
        <h3>No Scan History</h3>
        <p>You haven't performed any scans yet. Start your first scan to see it here.</p>
        <Button @click="router.push('/scan')" variant="primary">
          <FolderOpen class="w-4 h-4" />
          Start First Scan
        </Button>
      </div>
    </div>

    <!-- Scan List -->
    <div v-else class="scan-list">
      <div class="list-header">
        <h2>{{ sortedAnalyses.length }} Previous Scans</h2>
        <div class="filter-controls">
          <Filter class="w-4 h-4 text-slate-400" />
          <span class="text-sm text-slate-400">Most recent first</span>
        </div>
      </div>

      <div class="analyses-grid">
        <Card
          v-for="analysis in sortedAnalyses"
          :key="analysis.analysisId"
          class="analysis-card"
          @click="viewAnalysis(analysis)"
        >
          <div class="card-header">
            <div class="analysis-info">
              <h3 class="analysis-path">{{ analysis.directory || "Unknown Path" }}</h3>
              <p class="analysis-id">{{ analysis.analysisId }}</p>
            </div>
            <div class="analysis-status">
              <span class="status-badge" :class="analysis.status || 'completed'">
                {{ analysis.status || "Completed" }}
              </span>
            </div>
          </div>

          <div class="card-content">
            <div class="stats-grid">
              <div class="stat-item">
                <FileText class="w-4 h-4 text-blue-400" />
                <span class="stat-value">{{ analysis.totalFiles || 0 }}</span>
                <span class="stat-label">Files</span>
              </div>
              <div class="stat-item">
                <HardDrive class="w-4 h-4 text-green-400" />
                <span class="stat-value">{{ formatFileSize(analysis.totalSize || 0) }}</span>
                <span class="stat-label">Total Size</span>
              </div>
              <div class="stat-item">
                <Calendar class="w-4 h-4 text-purple-400" />
                <span class="stat-value">{{
                  formatDate(analysis.lastAnalyzed || analysis.startTime)
                }}</span>
                <span class="stat-label">Last Scanned</span>
              </div>
            </div>

            <div class="card-actions">
              <Button @click.stop="loadAnalysis(analysis)" variant="primary" size="sm">
                <Eye class="w-4 h-4" />
                View Analysis
              </Button>
              <Button @click.stop="viewAnalysis(analysis)" variant="secondary" size="sm">
                <ChevronRight class="w-4 h-4" />
                Details
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- Analysis Details Modal -->
    <div v-if="showDetails && selectedAnalysis" class="modal-overlay" @click="showDetails = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Analysis Details</h2>
          <Button @click="showDetails = false" variant="ghost" size="sm">
            <X class="w-4 h-4" />
          </Button>
        </div>

        <div class="modal-body">
          <div class="detail-section">
            <h3>General Information</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Directory:</span>
                <span class="detail-value">{{ selectedAnalysis.directory }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Analysis ID:</span>
                <span class="detail-value">{{ selectedAnalysis.analysisId }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value">{{ selectedAnalysis.status || "Completed" }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Last Scanned:</span>
                <span class="detail-value">{{
                  formatDate(selectedAnalysis.lastAnalyzed || selectedAnalysis.startTime)
                }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>Scan Statistics</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Total Files:</span>
                <span class="detail-value">{{ selectedAnalysis.totalFiles || 0 }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Total Size:</span>
                <span class="detail-value">{{
                  formatFileSize(selectedAnalysis.totalSize || 0)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Duration:</span>
                <span class="detail-value">{{
                  formatDuration(selectedAnalysis.startTime, selectedAnalysis.endTime)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <Button @click="loadAnalysis(selectedAnalysis)" variant="primary">
            <Eye class="w-4 h-4" />
            View Full Analysis
          </Button>
          <Button @click="showDetails = false" variant="secondary"> Close </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scan-history-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
}

.header-content h1 {
  margin: 0;
}

.header-content p {
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  min-width: 250px;
}

.search-input {
  background: none;
  border: none;
  color: white;
  outline: none;
  width: 100%;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.error-state,
.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.error-content,
.loading-content,
.empty-content {
  text-align: center;
  padding: 2rem;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-content h3,
.loading-content h3,
.empty-content h3 {
  margin: 0 0 1rem 0;
  color: #f8fafc;
  font-size: 1.5rem;
}

.error-content p,
.loading-content p,
.empty-content p {
  margin: 0 0 2rem 0;
  color: #94a3b8;
  font-size: 1rem;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.error-message {
  color: #ef4444;
  margin-bottom: 1rem;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.list-header h2 {
  margin: 0;
  color: #f8fafc;
  font-size: 1.25rem;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.analyses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.analysis-card {
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.analysis-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.analysis-info h3 {
  margin: 0;
  font-size: 1rem;
  color: #f8fafc;
  word-break: break-all;
}

.analysis-path {
  font-weight: 600;
}

.analysis-id {
  font-size: 0.875rem;
  color: #94a3b8;
  margin: 0.25rem 0 0 0;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.completed {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-badge.scanning {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.status-badge.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.status-badge.running {
  background: rgba(251, 191, 36, 0.2);
  color: #f59e0b;
}

.status-badge.cancelled {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f8fafc;
  margin: 0.25rem 0;
}

.stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-header h2 {
  margin: 0;
}

.detail-section {
  margin-bottom: 2rem;
}

.detail-section h3 {
  margin: 0 0 1rem 0;
  color: #f8fafc;
}

.detail-grid {
  display: grid;
  gap: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
}

.detail-label {
  color: #94a3b8;
  font-weight: 500;
}

.detail-value {
  color: #f8fafc;
  word-break: break-all;
}

.modal-footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  border-top: 1px solid #334155;
  padding-top: 1.5rem;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .scan-history-view {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .header-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-box {
    min-width: auto;
    width: 100%;
  }

  .analyses-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .card-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .modal-content {
    width: 95%;
    margin: 1rem;
    max-height: 90vh;
  }

  .modal-footer {
    flex-direction: column;
    gap: 0.75rem;
  }

  .error-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .error-actions .btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .scan-history-view {
    padding: 0.5rem;
  }

  .header-content h1 {
    font-size: 1.5rem;
  }

  .analysis-card {
    padding: 1rem;
  }

  .analysis-path {
    font-size: 0.875rem;
  }

  .analysis-id {
    font-size: 0.75rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .stat-label {
    font-size: 0.625rem;
  }
}
</style>
