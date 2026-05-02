<template>
  <div class="space-y-6">
    <!-- Hard Links Overview -->
    <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Hard Links Analysis</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-slate-700/50 rounded-lg p-4 text-center">
          <div class="text-3xl font-bold text-blue-400">{{ hardLinkStats.totalLinks.toLocaleString() }}</div>
          <div class="text-sm text-slate-400 mt-1">Total Hard Links</div>
        </div>
        
        <div class="bg-slate-700/50 rounded-lg p-4 text-center">
          <div class="text-3xl font-bold text-emerald-400">{{ hardLinkStats.uniqueFiles.toLocaleString() }}</div>
          <div class="text-sm text-slate-400 mt-1">Unique Files</div>
        </div>
        
        <div class="bg-slate-700/50 rounded-lg p-4 text-center">
          <div class="text-3xl font-bold text-amber-400">{{ formatBytes(hardLinkStats.spaceSavings) }}</div>
          <div class="text-sm text-slate-400 mt-1">Space Saved</div>
        </div>
        
        <div class="bg-slate-700/50 rounded-lg p-4 text-center">
          <div class="text-3xl font-bold text-purple-400">{{ hardLinkStats.avgLinksPerFile }}</div>
          <div class="text-sm text-slate-400 mt-1">Avg Links/File</div>
        </div>
      </div>

      <!-- Hard Links Distribution -->
      <div class="bg-slate-700/30 rounded-lg p-4">
        <h3 class="text-white font-medium mb-4">Hard Links Distribution</h3>
        <div class="space-y-3">
          <div v-for="(count, range) in hardLinksByRange" :key="range" class="flex items-center gap-4">
            <span class="text-slate-400 text-sm w-24">{{ range }}</span>
            <div class="flex-1 bg-slate-800 rounded-full h-6 relative overflow-hidden">
              <div
                class="h-full bg-blue-500 rounded-full transition-all duration-500"
                :style="{ width: `${((count / hardLinkStats.totalLinks) * 100).toFixed(1)}%` }"
              >
                <span class="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                  {{ count.toLocaleString() }} ({{ ((count / hardLinkStats.totalLinks) * 100).toFixed(1) }}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hard Link Groups -->
    <div v-if="hardLinkGroups.length > 0" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Hard Link Groups</h2>
      
      <div class="space-y-4">
        <div
          v-for="group in hardLinkGroups.slice(0, 10)"
          :key="group.hash"
          class="bg-slate-700/30 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <LinkIcon class="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h4 class="text-white font-medium">{{ group.baseName }}</h4>
                <p class="text-slate-400 text-sm">{{ group.links.length }} links • {{ formatBytes(group.fileSize) }}</p>
              </div>
            </div>
            <div class="text-right">
              <div class="text-emerald-400 font-medium">{{ formatBytes(group.spaceSaved) }} saved</div>
              <div class="text-slate-400 text-xs">{{ (group.spaceSaved / group.fileSize * 100).toFixed(1) }}% reduction</div>
            </div>
          </div>
          
          <div class="space-y-2">
            <div
              v-for="link in group.links"
              :key="link.path"
              class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
            >
              <div class="w-2 h-2 rounded-full bg-blue-400 shrink-0"></div>
              <span class="text-white truncate flex-1">{{ link.path }}</span>
              <span class="text-slate-400 text-xs">{{ formatDate(link.modified) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Space Saving Files -->
    <div v-if="topSpaceSavers.length > 0" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Top Space Saving Files</h2>
      
      <div class="space-y-3">
        <div
          v-for="file in topSpaceSavers"
          :key="file.path"
          class="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg"
        >
          <div class="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <HardDrive class="w-5 h-5 text-emerald-400" />
          </div>
          <div class="flex-1">
            <div class="text-white font-medium">{{ file.name }}</div>
            <div class="text-slate-400 text-sm truncate">{{ file.path }}</div>
            <div class="flex items-center gap-4 mt-1 text-xs">
              <span class="text-blue-400">{{ file.linkCount }} links</span>
              <span class="text-slate-400">{{ formatBytes(file.fileSize) }}</span>
              <span class="text-emerald-400">{{ formatBytes(file.spaceSaved) }} saved</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-emerald-400 font-medium">{{ (file.spaceSaved / file.fileSize * 100).toFixed(1) }}%</div>
            <div class="text-slate-400 text-xs">reduction</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hard Links by Directory -->
    <div v-if="Object.keys(hardLinksByDirectory).length > 0" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Hard Links by Directory</h2>
      
      <div class="space-y-3">
        <div
          v-for="(stats, dir) in hardLinksByDirectory"
          :key="dir"
          class="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg"
        >
          <div class="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Folder class="w-5 h-5 text-blue-400" />
          </div>
          <div class="flex-1">
            <div class="text-white font-medium truncate">{{ dir }}</div>
            <div class="flex items-center gap-4 mt-1 text-sm">
              <span class="text-blue-400">{{ stats.linkCount }} links</span>
              <span class="text-emerald-400">{{ formatBytes(stats.spaceSaved) }} saved</span>
              <span class="text-slate-400">{{ stats.fileCount }} files</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-emerald-400 font-medium">{{ (stats.spaceSaved / stats.totalSize * 100).toFixed(1) }}%</div>
            <div class="text-slate-400 text-xs">of directory size</div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Hard Links Message -->
    <div v-if="hardLinkStats.totalLinks === 0" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
      <div class="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
        <LinkIcon class="w-8 h-8 text-slate-500" />
      </div>
      <h3 class="text-xl font-medium text-white mb-2">No Hard Links Found</h3>
      <p class="text-slate-400">This analysis didn't detect any hard links in the scanned directory.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { LinkIcon, HardDrive, Folder } from 'lucide-vue-next';

interface FileWithHardLink {
  name: string;
  path: string;
  size: number;
  is_hard_link: boolean;
  hard_link_count?: number;
  file_hash?: string;
  modified?: string;
}

const props = defineProps<{
  files: FileWithHardLink[];
  hardLinkCount?: number;
  hardLinkSavings?: number;
}>();

// Hard link statistics
const hardLinkStats = computed(() => {
  const hardLinkedFiles = props.files.filter(f => f.is_hard_link);
  const totalLinks = hardLinkedFiles.reduce((acc, f) => acc + (f.hard_link_count || 1), 0);
  const uniqueFiles = hardLinkedFiles.length;
  const spaceSavings = props.hardLinkSavings || 0;
  const avgLinksPerFile = uniqueFiles > 0 ? (totalLinks / uniqueFiles).toFixed(1) : '0';

  return {
    totalLinks,
    uniqueFiles,
    spaceSavings,
    avgLinksPerFile
  };
});

// Hard links distribution by link count
const hardLinksByRange = computed(() => {
  const ranges = {
    '2 links': 0,
    '3-5 links': 0,
    '6-10 links': 0,
    '11+ links': 0
  };

  props.files.forEach(file => {
    if (file.is_hard_link && file.hard_link_count) {
      const count = file.hard_link_count;
      if (count === 2) ranges['2 links']++;
      else if (count >= 3 && count <= 5) ranges['3-5 links']++;
      else if (count >= 6 && count <= 10) ranges['6-10 links']++;
      else if (count >= 11) ranges['11+ links']++;
    }
  });

  return ranges;
});

// Hard link groups (files with same hash)
const hardLinkGroups = computed(() => {
  const groups: Record<string, any> = {};
  
  props.files.forEach(file => {
    if (file.is_hard_link && file.file_hash) {
      if (!groups[file.file_hash]) {
        groups[file.file_hash] = {
          hash: file.file_hash,
          baseName: file.name,
          fileSize: file.size,
          links: []
        };
      }
      groups[file.file_hash].links.push({
        path: file.path,
        modified: file.modified
      });
    }
  });

  // Calculate space savings for each group
  return Object.values(groups)
    .map((group: any) => ({
      ...group,
      spaceSaved: group.fileSize * (group.links.length - 1)
    }))
    .sort((a, b) => b.spaceSaved - a.spaceSaved);
});

// Top space saving files
const topSpaceSavers = computed(() => {
  return hardLinkGroups.value
    .map((group: any) => ({
      name: group.baseName,
      path: group.links[0]?.path || '',
      fileSize: group.fileSize,
      linkCount: group.links.length,
      spaceSaved: group.spaceSaved
    }))
    .sort((a, b) => b.spaceSaved - a.spaceSaved)
    .slice(0, 10);
});

// Hard links by directory
const hardLinksByDirectory = computed(() => {
  const dirStats: Record<string, any> = {};
  
  props.files.forEach(file => {
    if (file.is_hard_link) {
      const dir = getDirectoryName(file.path);
      if (!dirStats[dir]) {
        dirStats[dir] = {
          linkCount: 0,
          spaceSaved: 0,
          totalSize: 0,
          fileCount: 0
        };
      }
      
      dirStats[dir].linkCount += (file.hard_link_count || 1);
      dirStats[dir].spaceSaved += file.size * ((file.hard_link_count || 1) - 1);
      dirStats[dir].totalSize += file.size;
      dirStats[dir].fileCount++;
    }
  });

  return Object.fromEntries(
    Object.entries(dirStats)
      .sort(([, a], [, b]) => (b as any).spaceSaved - (a as any).spaceSaved)
      .slice(0, 15)
  );
});

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
}

function getDirectoryName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts.slice(0, -1).join('/') || 'Root';
}
</script>
