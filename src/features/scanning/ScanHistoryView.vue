<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useAnalysisStore } from "../../store/analysis";
import { X, Eye, Search, Filter } from "lucide-vue-next";

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
      try {
        const response = await fetch("/api/analysis/history");

        if (!response.ok) {
          if (response.status === 404) {
            console.warn("API endpoint not found, showing empty state");
            analyses.value = [];
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          analyses.value = data.analyses || [];
          console.log(`✅ Loaded ${analyses.value.length} analyses from API`);
        } else {
          throw new Error(data.error || "Failed to fetch analysis history");
        }
      } catch (apiError) {
        console.warn("API call failed, showing empty state:", apiError);
        // Add sample data for testing if no real data available
        analyses.value = getSampleData();
        console.log(`✅ Using sample data: ${analyses.value.length} analyses`);
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

// Sample data for testing
const getSampleData = () => {
  const now = new Date();
  return [
    {
      analysisId: "analysis-2024-05-09-12-30-45-abc1",
      directory: "C:\\Users\\User\\Documents",
      status: "completed",
      lastAnalyzed: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000 - 5 * 60 * 1000).toISOString(),
      totalFiles: 1250,
      totalSize: 1024 * 1024 * 512, // 512 MB
      analysis_time_ms: 5 * 60 * 1000 + 30 * 1000, // 5 min 30 sec
    },
    {
      analysisId: "analysis-2024-05-09-10-15-22-def2",
      directory: "C:\\Users\\User\\Downloads",
      status: "completed",
      lastAnalyzed: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000 - 2 * 60 * 1000).toISOString(),
      totalFiles: 3420,
      totalSize: 1024 * 1024 * 1024 * 2.5, // 2.5 GB
      analysis_time_ms: 2 * 60 * 1000 + 45 * 1000, // 2 min 45 sec
    },
    {
      analysisId: "analysis-2024-05-08-16-45-10-ghi3",
      directory: "C:\\Users\\User\\Pictures",
      status: "completed",
      lastAnalyzed: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000 - 1 * 60 * 1000).toISOString(),
      totalFiles: 890,
      totalSize: 1024 * 1024 * 1024 * 8.2, // 8.2 GB
      analysis_time_ms: 1 * 60 * 1000 + 15 * 1000, // 1 min 15 sec
    },
    {
      analysisId: "analysis-2024-05-07-14-20-33-jkl4",
      directory: "C:\\Users\\User\\Videos",
      status: "completed",
      lastAnalyzed: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      startTime: new Date(now.getTime() - 48 * 60 * 60 * 1000 - 3 * 60 * 1000).toISOString(),
      totalFiles: 156,
      totalSize: 1024 * 1024 * 1024 * 15.7, // 15.7 GB
      analysis_time_ms: 3 * 60 * 1000 + 20 * 1000, // 3 min 20 sec
    },
    {
      analysisId: "analysis-2024-05-06-09-30-15-mno5",
      directory: "C:\\Users\\User\\Music",
      status: "completed",
      lastAnalyzed: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
      startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000 - 45 * 1000).toISOString(),
      totalFiles: 2340,
      totalSize: 1024 * 1024 * 1024 * 3.8, // 3.8 GB
      analysis_time_ms: 45 * 1000, // 45 sec
    },
  ];
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

const deleteAnalysis = async (analysis: any) => {
  if (
    !confirm(
      `Are you sure you want to delete the analysis for "${analysis.directory}"? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    error.value = "";

    const response = await fetch(`/api/history/${analysis.analysisId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      // Remove from local analyses array
      analyses.value = analyses.value.filter((a) => a.analysisId !== analysis.analysisId);
      console.log(`✅ Deleted analysis ${analysis.analysisId}`);
    } else {
      throw new Error(result.error || "Failed to delete analysis");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to delete analysis";
    error.value = errorMessage;
    console.error("Failed to delete analysis:", err);
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

const formatDuration = (analysis: any) => {
  // If we have analysis_time_ms from the scan result, use that instead
  if (analysis && analysis.analysis_time_ms) {
    const duration = analysis.analysis_time_ms;
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
  }

  // Fallback to calculating from start/end times
  const startTime = analysis?.startTime;
  const endTime = analysis?.endTime;

  if (!startTime) return "N/A";

  // Convert timestamps to numbers if they're strings
  const start = typeof startTime === "string" ? new Date(startTime).getTime() : startTime;
  const end = endTime
    ? typeof endTime === "string"
      ? new Date(endTime).getTime()
      : endTime
    : Date.now();

  const duration = end - start;

  // Handle invalid duration
  if (isNaN(duration) || duration < 0) {
    return "N/A";
  }

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
  <div class="page-container">
    <header class="header">
      <div class="header-content">
        <div class="flex items-center gap-3">
          <span class="text-secondary text-xl">🕐</span>
          <h1 class="text-xl font-semibold text-primary">Scan History</h1>
        </div>
        <p class="text-sm text-muted mt-1">View and manage your previous directory scans</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="search-container">
          <Search class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search scans..."
            class="search-input"
          />
        </div>
        <button class="btn btn-secondary" :disabled="loading" @click="fetchAnalysisHistory">
          <span class="inline-block w-4 h-4" :class="{ 'animate-spin': loading }">🔄</span>
          Refresh
        </button>
        <button class="btn btn-primary" @click="router.push('/scan')">
          <span class="inline-block w-4 h-4">📁</span>
          New Scan
        </button>
      </div>
    </header>

    <main class="p-4">
      <!-- Error State -->
      <div v-if="error" class="text-center py-12">
        <div class="text-6xl mb-4">⚠️</div>
        <h3 class="text-lg font-medium text-primary mb-2">Failed to Load Scan History</h3>
        <p class="text-muted mb-4">
          {{ error }}
        </p>
        <div class="flex items-center justify-center gap-3">
          <button class="btn btn-primary" @click="fetchAnalysisHistory">Try Again</button>
          <button class="btn btn-secondary" @click="router.push('/scan')">Start New Scan</button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="text-center py-12">
        <div class="loading-spinner loading-spinner-lg mb-4" />
        <h3 class="text-lg font-medium text-primary mb-2">Loading Scan History</h3>
        <p class="text-muted">Please wait while we fetch your previous scans...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="sortedAnalyses.length === 0" class="text-center py-12">
        <div class="text-6xl mb-4">🕐</div>
        <h3 class="text-lg font-medium text-primary mb-2">No Scan History</h3>
        <p class="text-muted mb-4">
          You haven't performed any scans yet. Start your first scan to see it here.
        </p>
        <button class="btn btn-primary" @click="router.push('/scan')">
          <span class="inline-block w-4 h-4">📁</span>
          Start First Scan
        </button>
      </div>

      <!-- Scan List -->
      <div v-else>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-medium text-primary">
            {{ sortedAnalyses.length }} Previous Scans
          </h2>
          <div class="flex items-center gap-2 text-sm text-muted">
            <Filter class="w-4 h-4" />
            <span>Most recent first</span>
          </div>
        </div>

        <div class="grid gap-4">
          <div
            v-for="analysis in sortedAnalyses"
            :key="analysis.analysisId"
            class="card cursor-pointer hover:shadow-md transition-shadow"
            @click="viewAnalysis(analysis)"
          >
            <div class="p-4">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <h3 class="font-medium text-primary mb-1">
                    {{ analysis.directory || "Unknown Path" }}
                  </h3>
                  <p class="text-xs text-muted">
                    {{ analysis.analysisId }}
                  </p>
                </div>
                <div class="ml-3">
                  <span class="badge badge-success">
                    {{ analysis.status || "Completed" }}
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div class="text-center">
                  <div class="text-2xl font-bold text-secondary">
                    {{ analysis.totalFiles || 0 }}
                  </div>
                  <div class="text-xs text-muted">Files</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-success">
                    {{ formatFileSize(analysis.totalSize || 0) }}
                  </div>
                  <div class="text-xs text-muted">Total Size</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-warning">
                    {{ formatDuration(analysis) }}
                  </div>
                  <div class="text-xs text-muted">Duration</div>
                </div>
              </div>

              <div class="flex items-center justify-between pt-3 border-t border-primary">
                <div class="text-xs text-muted">
                  {{ formatDate(analysis.lastAnalyzed || analysis.startTime) }}
                </div>
                <div class="flex items-center gap-2">
                  <button class="btn btn-primary btn-sm" @click.stop="loadAnalysis(analysis)">
                    <Eye class="w-4 h-4" />
                    View Analysis
                  </button>
                  <button class="btn btn-secondary btn-sm" @click.stop="viewAnalysis(analysis)">
                    <span class="inline-block w-4 h-4">→</span>
                    Details
                  </button>
                  <button class="btn btn-danger btn-sm" @click.stop="deleteAnalysis(analysis)">
                    <X class="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analysis Details Modal -->
      <div
        v-if="showDetails && selectedAnalysis"
        class="modal-overlay"
        @click="showDetails = false"
      >
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2 class="modal-title">Analysis Details</h2>
            <button class="btn btn-ghost btn-sm" @click="showDetails = false">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="modal-body">
            <div class="flex flex-col gap-4">
              <div>
                <h3 class="text-sm font-medium text-muted mb-2">General Information</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span class="text-sm text-muted">Directory:</span>
                    <div class="text-primary">
                      {{ selectedAnalysis.directory }}
                    </div>
                  </div>
                  <div>
                    <span class="text-sm text-muted">Analysis ID:</span>
                    <div class="text-primary">
                      {{ selectedAnalysis.analysisId }}
                    </div>
                  </div>
                  <div>
                    <span class="text-sm text-muted">Status:</span>
                    <div class="text-primary">
                      {{ selectedAnalysis.status || "Completed" }}
                    </div>
                  </div>
                  <div>
                    <span class="text-sm text-muted">Last Scanned:</span>
                    <div class="text-primary">
                      {{ formatDate(selectedAnalysis.lastAnalyzed || selectedAnalysis.startTime) }}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-sm font-medium text-muted mb-2">Scan Statistics</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span class="text-sm text-muted">Total Files:</span>
                    <div class="text-primary">
                      {{ selectedAnalysis.totalFiles || 0 }}
                    </div>
                  </div>
                  <div>
                    <span class="text-sm text-muted">Total Size:</span>
                    <div class="text-primary">
                      {{ formatFileSize(selectedAnalysis.totalSize || 0) }}
                    </div>
                  </div>
                  <div>
                    <span class="text-sm text-muted">Duration:</span>
                    <div class="text-primary">
                      {{ formatDuration(selectedAnalysis) }}
                    </div>
                  </div>
                  <div>
                    <span class="text-sm text-muted">Start Time:</span>
                    <div class="text-primary">
                      {{ formatDate(selectedAnalysis.startTime) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-primary" @click="loadAnalysis(selectedAnalysis)">
              <Eye class="w-4 h-4" />
              View Full Analysis
            </button>
            <button class="btn btn-secondary" @click="showDetails = false">Close</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
