<script setup lang="ts">
import { ref } from "vue";
import { exportAnalysis, ExportFormat } from "../../services/exportService";
import { exportToPDF } from "../../services/pdfExport";
import { Card, Button } from "../../design-system/components";

interface Props {
  data: any;
  selectedFiles?: any[];
}

const props = defineProps<Props>();
const isExporting = ref(false);
const showSuccess = ref(false);

async function handleExport(format: ExportFormat) {
  if (!props.data) return;

  isExporting.value = true;

  try {
    exportAnalysis(props.data, format, props.selectedFiles);
    showSuccess.value = true;
    setTimeout(() => (showSuccess.value = false), 2000);
  } catch (error) {
    console.error("Export failed:", error);
    alert("Export failed. Please try again.");
  } finally {
    isExporting.value = false;
  }
}

async function handlePDFExport() {
  if (!props.data) return;

  isExporting.value = true;

  try {
    exportToPDF(props.data);
    showSuccess.value = true;
    setTimeout(() => (showSuccess.value = false), 2000);
  } catch (error) {
    console.error("PDF Export failed:", error);
    alert("PDF Export failed. Please try again.");
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <Card title="Export Data">
    <div class="space-y-4">
      <p class="text-sm text-slate-400">
        Export your analysis results in various formats for sharing or further processing.
      </p>

      <div class="grid grid-cols-2 gap-3">
        <Button variant="secondary" :loading="isExporting" @click="handleExport('csv')">
          <span class="flex items-center gap-2">
            <span>📊</span>
            <span>Export CSV</span>
          </span>
        </Button>

        <Button variant="secondary" :loading="isExporting" @click="handleExport('json')">
          <span class="flex items-center gap-2">
            <span>📋</span>
            <span>Export JSON</span>
          </span>
        </Button>

        <Button variant="secondary" :loading="isExporting" @click="handleExport('txt')">
          <span class="flex items-center gap-2">
            <span>📝</span>
            <span>Text Report</span>
          </span>
        </Button>

        <Button variant="secondary" :loading="isExporting" @click="handlePDFExport">
          <span class="flex items-center gap-2">
            <span>📄</span>
            <span>Export PDF Report</span>
          </span>
        </Button>

        <Button
          v-if="selectedFiles && selectedFiles.length > 0"
          variant="secondary"
          :loading="isExporting"
          @click="handleExport('manifest')"
        >
          <span class="flex items-center gap-2">
            <span>📦</span>
            <span>Export Manifest ({{ selectedFiles.length }} files)</span>
          </span>
        </Button>
      </div>

      <div
        v-if="showSuccess"
        class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-sm"
      >
        ✅ Export successful! File downloaded.
      </div>

      <div class="text-xs text-slate-500 space-y-1">
        <p><strong>CSV:</strong> Open in Excel, Google Sheets, or any spreadsheet app</p>
        <p><strong>JSON:</strong> Raw data for developers and integrations</p>
        <p><strong>Text Report:</strong> Human-readable formatted summary</p>
        <p><strong>PDF:</strong> Professional report for sharing/printing</p>
      </div>
    </div>
  </Card>
</template>
