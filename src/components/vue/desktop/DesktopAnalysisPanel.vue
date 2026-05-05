<template>
  <div class="desktop-analysis-panel">
    <div class="panel-header">
      <h2>Desktop Analysis</h2>
      <div class="header-actions">
        <span v-if="isTauri" class="badge desktop">Desktop Mode</span>
        <span v-else class="badge web">Web Mode</span>
        <button @click="refreshDrives" class="btn-icon" title="Refresh drives">
          <RefreshCw class="icon-sm" />
        </button>
      </div>
    </div>

    <div v-if="isTauri" class="desktop-features">
      <!-- Directory Selection -->
      <div class="section">
        <button @click="selectAndAnalyze" :disabled="isScanning" class="btn-primary">
          <FolderOpenIcon class="icon" />
          {{ isScanning ? "Scanning..." : "Select Folder to Analyze" }}
        </button>
        <button v-if="isScanning" @click="cancelScan" class="btn-secondary">
          <XIcon class="icon" />
          Cancel
        </button>
      </div>

      <!-- Progress Display -->
      <div v-if="isScanning && progress" class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress.percentage}%` }"></div>
        </div>
        <div class="progress-stats">
          <span>{{ progress.percentage.toFixed(1) }}%</span>
          <span>{{ formatSize(progress.total_size) }}</span>
        </div>
        <div class="current-file">{{ progress.current_file }}</div>
      </div>

      <!-- System Info -->
      <div v-if="systemInfo" class="section system-info">
        <h3>System Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">OS:</span>
            <span>{{ systemInfo.os_name }} {{ systemInfo.os_version }}</span>
          </div>
          <div class="info-item">
            <span class="label">Memory:</span>
            <span
              >{{ formatSize(systemInfo.used_memory * 1024) }} /
              {{ formatSize(systemInfo.total_memory * 1024) }}</span
            >
          </div>
          <div class="info-item">
            <span class="label">CPUs:</span>
            <span>{{ systemInfo.cpu_count }}</span>
          </div>
          <div class="info-item">
            <span class="label">Host:</span>
            <span>{{ systemInfo.hostname }}</span>
          </div>
        </div>
      </div>

      <!-- Drives -->
      <div v-if="drives.length > 0" class="section drives">
        <h3>Available Drives</h3>
        <div class="drive-list">
          <div
            v-for="drive in drives"
            :key="drive.path"
            class="drive-card"
            @click="analyzeDrive(drive.path)"
            :class="{ removable: drive.is_removable }"
          >
            <HardDriveIcon class="drive-icon" />
            <div class="drive-info">
              <span class="drive-name">{{ drive.name }}</span>
              <div class="drive-space">
                <div class="space-bar">
                  <div
                    class="space-used"
                    :style="{ width: `${(drive.used_space / drive.total_space) * 100}%` }"
                  ></div>
                </div>
                <span class="space-text">
                  {{ formatSize(drive.used_space) }} / {{ formatSize(drive.total_space) }}
                </span>
              </div>
              <span class="drive-fs">{{ drive.filesystem }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-if="lastResult" class="section results">
        <h3>Last Analysis Result</h3>
        <div class="result-summary">
          <div class="stat">
            <span class="stat-value">{{ lastResult.total_files.toLocaleString() }}</span>
            <span class="stat-label">Files</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ lastResult.total_directories.toLocaleString() }}</span>
            <span class="stat-label">Directories</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ formatSize(lastResult.total_size) }}</span>
            <span class="stat-label">Total Size</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ lastResult.analysis_time_ms }}ms</span>
            <span class="stat-label">Analysis Time</span>
          </div>
        </div>

        <!-- File Types -->
        <div v-if="Object.keys(lastResult.file_types).length > 0" class="file-types">
          <h4>File Types</h4>
          <div class="type-list">
            <div v-for="(count, type) in sortedFileTypes" :key="type" class="type-item">
              <span class="type-name">{{ type }}</span>
              <span class="type-count">{{ count.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <!-- Largest Files -->
        <div v-if="lastResult.largest_files.length > 0" class="largest-files">
          <h4>Largest Files</h4>
          <div class="file-list">
            <div
              v-for="file in lastResult.largest_files.slice(0, 10)"
              :key="file.path"
              class="file-item"
            >
              <FileIcon class="file-icon" />
              <span class="file-name" :title="file.path">{{ file.name }}</span>
              <span class="file-size">{{ formatSize(file.size) }}</span>
              <button @click="openLocation(file.path)" class="btn-icon" title="Open in Explorer">
                <ExternalLinkIcon class="icon-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="web-notice">
      <p>This component is designed for the Tauri desktop app.</p>
      <p>Run <code>npm run tauri:dev</code> to use desktop features.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  FolderOpenIcon,
  XIcon,
  HardDriveIcon,
  FileIcon,
  ExternalLinkIcon,
  RefreshCw,
} from "lucide-vue-next";
import {
  useTauriDesktop,
  type DesktopAnalysisResult,
  type SystemInfo,
  type DriveInfo,
} from "@/composables/useTauriDesktop";

const {
  isTauri,
  progress,
  isScanning,
  selectDirectory,
  analyzeDirectoryWithProgress,
  cancelAnalysis,
  getSystemInfo,
  getDrives,
  openFileLocation,
} = useTauriDesktop();

const systemInfo = ref<SystemInfo | null>(null);
const drives = ref<DriveInfo[]>([]);
const lastResult = ref<DesktopAnalysisResult | null>(null);
const error = ref<string | null>(null);

const sortedFileTypes = computed(() => {
  if (!lastResult.value) return {};
  return Object.entries(lastResult.value.file_types)
    .sort(([, a], [, b]) => b - a)
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
});

onMounted(async () => {
  if (isTauri.value) {
    try {
      systemInfo.value = await getSystemInfo();
      drives.value = await getDrives();
    } catch (e) {
      error.value = String(e);
    }
  }
});

async function selectAndAnalyze() {
  try {
    error.value = null;
    const path = await selectDirectory();
    if (path) {
      lastResult.value = await analyzeDirectoryWithProgress(path);
    }
  } catch (e) {
    error.value = String(e);
  }
}

async function analyzeDrive(path: string) {
  try {
    error.value = null;
    lastResult.value = await analyzeDirectoryWithProgress(path);
  } catch (e) {
    error.value = String(e);
  }
}

async function cancelScan() {
  await cancelAnalysis();
}

async function openLocation(path: string) {
  await openFileLocation(path);
}

async function refreshDrives() {
  if (isTauri.value) {
    try {
      drives.value = await getDrives();
    } catch (e) {
      error.value = String(e);
    }
  }
}

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
</script>

<style scoped>
.desktop-analysis-panel {
  padding: 1.5rem;
  background: var(--surface-color, #1e293b);
  border-radius: 12px;
  color: var(--text-color, #f1f5f9);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge.desktop {
  background: #6366f1;
  color: white;
}

.badge.web {
  background: #64748b;
  color: white;
}

.section {
  margin-bottom: 1.5rem;
}

.section h3 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: #94a3b8;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #6366f1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #475569;
  color: white;
  margin-left: 0.5rem;
}

.btn-secondary:hover {
  background: #334155;
}

.icon {
  width: 1.25rem;
  height: 1.25rem;
}

.progress-section {
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;
  border-radius: 8px;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #94a3b8;
}

.current-file {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item .label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.drive-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.drive-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.drive-card:hover {
  background: rgba(0, 0, 0, 0.3);
}

.drive-card.removable {
  border: 1px solid #f59e0b;
}

.drive-icon {
  width: 2rem;
  height: 2rem;
  color: #6366f1;
}

.drive-info {
  flex: 1;
  min-width: 0;
}

.drive-name {
  font-weight: 600;
  display: block;
  margin-bottom: 0.25rem;
}

.space-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.space-used {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
}

.space-text {
  font-size: 0.75rem;
  color: #64748b;
}

.drive-fs {
  font-size: 0.75rem;
  color: #475569;
}

.result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat {
  text-align: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #6366f1;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.type-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 9999px;
  font-size: 0.875rem;
}

.type-name {
  text-transform: uppercase;
  font-weight: 600;
}

.type-count {
  color: #64748b;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.file-icon {
  width: 1rem;
  height: 1rem;
  color: #64748b;
}

.file-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
}

.file-size {
  font-size: 0.75rem;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.btn-icon {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}

.web-notice {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.web-notice code {
  background: rgba(0, 0, 0, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
}
</style>
