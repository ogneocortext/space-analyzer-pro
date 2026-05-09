<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-slate-100 mb-2">Export Data</h1>
        <p class="text-slate-400 mb-6">Export your analysis results in various formats</p>
      </div>

      <!-- Export Options -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <!-- JSON Export -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center mb-4">
            <FileJson class="w-8 h-8 text-blue-400 mr-3" />
            <h3 class="text-lg font-semibold text-white">JSON Export</h3>
          </div>
          <p class="text-slate-300 mb-4">
            Export complete analysis data as JSON file with all file details, categories, and
            metadata.
          </p>
          <button
            :disabled="!hasAnalysisData"
            class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            @click="exportAsJSON"
          >
            <Download class="w-4 h-4 mr-2" />
            Export as JSON
          </button>
        </div>

        <!-- CSV Export -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center mb-4">
            <FileSpreadsheet class="w-8 h-8 text-green-400 mr-3" />
            <h3 class="text-lg font-semibold text-white">CSV Export</h3>
          </div>
          <p class="text-slate-300 mb-4">
            Export file list as CSV spreadsheet for use in Excel or other spreadsheet applications.
          </p>
          <button
            :disabled="!hasAnalysisData"
            class="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            @click="exportAsCSV"
          >
            <Download class="w-4 h-4 mr-2" />
            Export as CSV
          </button>
        </div>

        <!-- PDF Report -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center mb-4">
            <FileText class="w-8 h-8 text-red-400 mr-3" />
            <h3 class="text-lg font-semibold text-white">PDF Report</h3>
          </div>
          <p class="text-slate-300 mb-4">
            Generate comprehensive PDF report with charts, analysis, and recommendations.
          </p>
          <button
            :disabled="!hasAnalysisData"
            class="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            @click="generatePDFReport"
          >
            <FileText class="w-4 h-4 mr-2" />
            Generate PDF Report
          </button>
        </div>
      </div>

      <!-- Recent Exports -->
      <div
        v-if="recentExports.length > 0"
        class="bg-slate-800 rounded-lg p-6 border border-slate-700"
      >
        <h3 class="text-lg font-semibold text-white mb-4">Recent Exports</h3>
        <div class="space-y-2">
          <div
            v-for="exportItem in recentExports"
            :key="exportItem.id"
            class="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
          >
            <div class="flex items-center">
              <component
                :is="getExportIcon(exportItem.format)"
                class="w-4 h-4 text-slate-400 mr-3"
              />
              <div>
                <div class="font-medium text-white">
                  {{ exportItem.filename }}
                </div>
                <div class="text-sm text-slate-400">
                  {{ formatDate(exportItem.timestamp) }}
                </div>
              </div>
            </div>
            <div class="text-slate-400 text-sm">
              {{ formatBytes(exportItem.size) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAnalysisStore } from "@/store";
import {
  FileJsonIcon as FileJson,
  FileSpreadsheetIcon as FileSpreadsheet,
  FileTextIcon as FileText,
  Download,
  RefreshCw,
} from "lucide-vue-next";

interface ExportItem {
  id: string;
  filename: string;
  format: "json" | "csv" | "pdf";
  timestamp: Date;
  size: number;
}

const analysisStore = useAnalysisStore();

const hasAnalysisData = computed(() => {
  return (
    analysisStore.analysisResult &&
    analysisStore.analysisResult.file_analysis &&
    analysisStore.analysisResult.file_analysis.files &&
    analysisStore.analysisResult.file_analysis.files.length > 0
  );
});

const recentExports = ref<ExportItem[]>([]);

const exportAsJSON = () => {
  if (!analysisStore.analysisResult) return;

  const data = analysisStore.analysisResult;
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `space-analyzer-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);

  addToRecentExports("space-analyzer.json", "json", data.summary?.total_size || 0);
};

const exportAsCSV = () => {
  if (!analysisStore.analysisResult?.file_analysis?.files) return;

  const files = analysisStore.analysisResult.file_analysis.files;
  const csvContent = [
    "Name,Path,Size,Modified,Category,Description",
    ...files.map(
      (file) =>
        `"${file.name}","${file.path}","${file.size}","${new Date(file.modified).toISOString()}","${file.category || "Unknown"}","${file.description || ""}"`
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `space-analyzer-files-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  addToRecentExports(
    "space-analyzer-files.csv",
    "csv",
    files.reduce((acc, file) => acc + file.size, 0)
  );
};

const generatePDFReport = () => {
  if (!analysisStore.analysisResult) return;

  // For now, we'll create a simple text-based report
  // In a real implementation, you'd use a PDF library like jsPDF
  const reportContent = generateReportContent(analysisStore.analysisResult);
  const blob = new Blob([reportContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `space-analyzer-report-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);

  addToRecentExports(
    "space-analyzer-report.txt",
    "pdf",
    analysisStore.analysisResult.summary?.total_size || 0
  );
};

const getExportIcon = (format: string) => {
  switch (format) {
    case "json":
      return FileJson;
    case "csv":
      return FileSpreadsheet;
    case "pdf":
      return FileText;
    default:
      return FileText;
  }
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const m = k * 1024;
  const g = m * 1024;
  if (bytes < k) return bytes + " B";
  if (bytes < m) return (bytes / k).toFixed(1) + " KB";
  if (bytes < g) return (bytes / m).toFixed(1) + " MB";
  return (bytes / g).toFixed(1) + " GB";
};

const generateReportContent = (data: any) => {
  return `
SPACE ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}

SUMMARY
Total Files: ${data.file_analysis?.files?.length || 0}
Total Size: ${formatBytes(data.summary?.total_size || 0)}
Categories: ${Object.keys(data.file_analysis?.categories || {}).length}

TOP 10 LARGEST FILES
${data.file_analysis?.files
  ?.slice(0, 10)
  .map((file, index) => `${index + 1}. ${file.name} - ${formatBytes(file.size)}`)
  .join("\n")}

CATEGORIES BREAKDOWN
${Object.entries(data.file_analysis?.categories || {})
  .map(
    ([category, info]: [string, any]) =>
      `${category}: ${info.count} files (${formatBytes(info.size)})`
  )
  .join("\n")}
  `.trim();
};

const addToRecentExports = (filename: string, format: string, size: number) => {
  const exportItem: ExportItem = {
    id: Date.now().toString(),
    filename,
    format: format as "json" | "csv" | "pdf",
    timestamp: new Date(),
    size,
  };

  recentExports.value.unshift(exportItem);
  if (recentExports.value.length > 10) {
    recentExports.value = recentExports.value.slice(0, 10);
  }
};

onMounted(() => {
  // Load recent exports from localStorage
  const saved = localStorage.getItem("recent-exports");
  if (saved) {
    recentExports.value = JSON.parse(saved);
  }
});

// Save recent exports to localStorage when they change
watch(
  recentExports,
  (newExports) => {
    localStorage.setItem("recent-exports", JSON.stringify(newExports));
  },
  { deep: true }
);
</script>
