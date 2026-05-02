<template>
  <div class="space-y-6">
    <!-- File Attributes Overview -->
    <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">File Attributes Analysis</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <!-- Compression Stats -->
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span class="text-slate-400 text-sm">Compressed</span>
          </div>
          <div class="text-2xl font-bold text-emerald-400">{{ compressedStats.count }}</div>
          <div class="text-xs text-slate-500">
            {{ formatBytes(compressedStats.totalSavings) }} saved
          </div>
        </div>

        <!-- Sparse Files -->
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-amber-500"></div>
            <span class="text-slate-400 text-sm">Sparse Files</span>
          </div>
          <div class="text-2xl font-bold text-amber-400">{{ sparseStats.count }}</div>
          <div class="text-xs text-slate-500">{{ formatBytes(sparseStats.totalSize) }}</div>
        </div>

        <!-- Reparse Points -->
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-purple-500"></div>
            <span class="text-slate-400 text-sm">Reparse Points</span>
          </div>
          <div class="text-2xl font-bold text-purple-400">{{ reparseStats.count }}</div>
          <div class="text-xs text-slate-500">{{ reparseStats.types.length }} types</div>
        </div>

        <!-- Alternate Data Streams -->
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-blue-500"></div>
            <span class="text-slate-400 text-sm">ADS Files</span>
          </div>
          <div class="text-2xl font-bold text-blue-400">{{ adsStats.count }}</div>
          <div class="text-xs text-slate-500">{{ adsStats.totalStreams }} streams</div>
        </div>
      </div>

      <!-- Attributes Distribution Chart -->
      <div class="bg-slate-700/30 rounded-lg p-4">
        <h3 class="text-white font-medium mb-4">Attributes Distribution</h3>
        <div class="space-y-3">
          <div v-for="(stat, type) in attributeStats" :key="type" class="flex items-center gap-4">
            <div class="w-24 text-sm text-slate-400">{{ type }}</div>
            <div class="flex-1 bg-slate-800 rounded-full h-6 relative overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="getAttributeColor(type)"
                :style="{ width: `${((stat.count / totalFiles) * 100).toFixed(1)}%` }"
              >
                <span
                  class="absolute inset-0 flex items-center justify-center text-xs text-white font-medium"
                >
                  {{ stat.count.toLocaleString() }} ({{
                    ((stat.count / totalFiles) * 100).toFixed(1)
                  }}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compression Analysis -->
    <div
      v-if="compressedStats.count > 0"
      class="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
    >
      <h2 class="text-xl font-semibold text-white mb-4">Compression Analysis</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Compression Savings</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-400">Files Compressed:</span>
              <span class="text-emerald-400">{{ compressedStats.count.toLocaleString() }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Original Size:</span>
              <span class="text-white">{{ formatBytes(compressedStats.originalSize) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Compressed Size:</span>
              <span class="text-emerald-400">{{
                formatBytes(compressedStats.compressedSize)
              }}</span>
            </div>
            <div class="flex justify-between font-medium">
              <span class="text-slate-400">Total Savings:</span>
              <span class="text-emerald-400">{{ formatBytes(compressedStats.totalSavings) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Compression Ratio:</span>
              <span class="text-emerald-400">{{ compressedStats.ratio }}%</span>
            </div>
          </div>
        </div>

        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Top Compressed Files</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div
              v-for="file in compressedStats.topFiles"
              :key="file.path"
              class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
            >
              <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
              <span class="text-white truncate flex-1">{{ file.name }}</span>
              <span class="text-emerald-400 text-xs">{{ formatBytes(file.savings) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sparse Files Analysis -->
    <div
      v-if="sparseStats.count > 0"
      class="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
    >
      <h2 class="text-xl font-semibold text-white mb-4">Sparse Files Analysis</h2>

      <div class="bg-slate-700/30 rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-amber-400">
              {{ sparseStats.count.toLocaleString() }}
            </div>
            <div class="text-sm text-slate-400">Sparse Files</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-amber-400">
              {{ formatBytes(sparseStats.totalSize) }}
            </div>
            <div class="text-sm text-slate-400">Total Size</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-amber-400">{{ sparseStats.avgSize }}</div>
            <div class="text-sm text-slate-400">Average Size</div>
          </div>
        </div>

        <h3 class="text-white font-medium mb-3">Largest Sparse Files</h3>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div
            v-for="file in sparseStats.largestFiles"
            :key="file.path"
            class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
          >
            <div class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></div>
            <span class="text-white truncate flex-1">{{ file.name }}</span>
            <span class="text-amber-400 text-xs">{{ formatBytes(file.size) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Reparse Points Analysis -->
    <div
      v-if="reparseStats.count > 0"
      class="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
    >
      <h2 class="text-xl font-semibold text-white mb-4">Reparse Points Analysis</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Reparse Types</h3>
          <div class="space-y-2">
            <div
              v-for="(count, type) in reparseStats.typeCounts"
              :key="type"
              class="flex justify-between text-sm"
            >
              <span class="text-slate-400">{{ type }}:</span>
              <span class="text-purple-400">{{ count.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Reparse Point Files</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div
              v-for="file in reparseStats.files"
              :key="file.path"
              class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
            >
              <div class="w-2 h-2 rounded-full bg-purple-400 shrink-0"></div>
              <span class="text-white truncate flex-1">{{ file.name }}</span>
              <span class="text-purple-400 text-xs">0x{{ file.reparse_tag?.toString(16) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Alternate Data Streams Analysis -->
    <div v-if="adsStats.count > 0" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Alternate Data Streams Analysis</h2>

      <div class="bg-slate-700/30 rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-400">
              {{ adsStats.count.toLocaleString() }}
            </div>
            <div class="text-sm text-slate-400">Files with ADS</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-400">
              {{ adsStats.totalStreams.toLocaleString() }}
            </div>
            <div class="text-sm text-slate-400">Total Streams</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-400">{{ adsStats.avgStreams }}</div>
            <div class="text-sm text-slate-400">Avg Streams/File</div>
          </div>
        </div>

        <h3 class="text-white font-medium mb-3">Files with Alternate Data Streams</h3>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div
            v-for="file in adsStats.files"
            :key="file.path"
            class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
          >
            <div class="w-2 h-2 rounded-full bg-blue-400 shrink-0"></div>
            <span class="text-white truncate flex-1">{{ file.name }}</span>
            <span class="text-blue-400 text-xs">{{ file.ads_count }} streams</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface FileAttributes {
  name: string;
  path: string;
  size: number;
  is_compressed: boolean;
  compressed_size: number | null;
  is_sparse: boolean;
  is_reparse_point: boolean;
  reparse_tag: number | null;
  has_ads: boolean;
  ads_count: number;
}

const props = defineProps<{
  files: FileAttributes[];
}>();

const totalFiles = computed(() => props.files.length);

// Compression statistics
const compressedStats = computed(() => {
  const compressedFiles = props.files.filter((f) => f.is_compressed && f.compressed_size);
  const originalSize = compressedFiles.reduce((acc, f) => acc + f.size, 0);
  const compressedSize = compressedFiles.reduce((acc, f) => acc + (f.compressed_size || 0), 0);
  const totalSavings = originalSize - compressedSize;
  const ratio = originalSize > 0 ? ((totalSavings / originalSize) * 100).toFixed(1) : "0";

  const topFiles = compressedFiles
    .map((f) => ({ ...f, savings: f.size - (f.compressed_size || 0) }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 10);

  return {
    count: compressedFiles.length,
    originalSize,
    compressedSize,
    totalSavings,
    ratio,
    topFiles,
  };
});

// Sparse files statistics
const sparseStats = computed(() => {
  const sparseFiles = props.files.filter((f) => f.is_sparse);
  const totalSize = sparseFiles.reduce((acc, f) => acc + f.size, 0);
  const avgSize = sparseFiles.length > 0 ? formatBytes(totalSize / sparseFiles.length) : "0 B";

  const largestFiles = sparseFiles.sort((a, b) => b.size - a.size).slice(0, 10);

  return {
    count: sparseFiles.length,
    totalSize,
    avgSize,
    largestFiles,
  };
});

// Reparse points statistics
const reparseStats = computed(() => {
  const reparseFiles = props.files.filter((f) => f.is_reparse_point);
  const typeCounts: Record<string, number> = {};

  reparseFiles.forEach((file) => {
    const tag = file.reparse_tag;
    if (tag) {
      const typeName = getReparseTypeName(tag);
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    }
  });

  return {
    count: reparseFiles.length,
    types: Object.keys(typeCounts),
    typeCounts,
    files: reparseFiles.slice(0, 10),
  };
});

// Alternate data streams statistics
const adsStats = computed(() => {
  const adsFiles = props.files.filter((f) => f.has_ads);
  const totalStreams = adsFiles.reduce((acc, f) => acc + (f.ads_count || 0), 0);
  const avgStreams = adsFiles.length > 0 ? (totalStreams / adsFiles.length).toFixed(1) : "0";

  return {
    count: adsFiles.length,
    totalStreams,
    avgStreams,
    files: adsFiles.slice(0, 10),
  };
});

// Overall attribute statistics
const attributeStats = computed(() => ({
  Compressed: { count: props.files.filter((f) => f.is_compressed).length },
  Sparse: { count: props.files.filter((f) => f.is_sparse).length },
  "Reparse Points": { count: props.files.filter((f) => f.is_reparse_point).length },
  ADS: { count: props.files.filter((f) => f.has_ads).length },
  "Hard Links": { count: props.files.filter((f) => f.is_hard_link).length },
}));

function formatBytes(bytes: number): string {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getReparseTypeName(tag: number): string {
  // Common Windows reparse point tags
  const tags: Record<number, string> = {
    0xa0000003: "Mount Point",
    0xa000000c: "Symlink",
    0x80000005: "HSM",
    0x80000006: "HSM2",
    0x80000007: "WIM",
    0x80000008: "CSV",
    0x80000009: "WOF",
    0x8000000a: "WOF_T",
    0x8000000b: "DFSR",
  };
  return tags[tag] || `Unknown (0x${tag.toString(16)})`;
}

function getAttributeColor(type: string): string {
  const colors: Record<string, string> = {
    Compressed: "bg-emerald-500",
    Sparse: "bg-amber-500",
    "Reparse Points": "bg-purple-500",
    ADS: "bg-blue-500",
    "Hard Links": "bg-cyan-500",
  };
  return colors[type] || "bg-slate-500";
}
</script>
