<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const selectedStrategy = ref<"date" | "project" | "type" | "size">("date");
const isAnalyzing = ref(false);
const suggestions = ref<any[]>([]);

// Generate organization suggestions based on current scan data
const generateSuggestions = () => {
  isAnalyzing.value = true;
  
  setTimeout(() => {
    const files = store.analysisResult?.files || [];
    const newSuggestions: any[] = [];
    
    // Strategy: Date-based organization
    if (selectedStrategy.value === "date") {
      const byYear: Record<string, number> = {};
      const byMonth: Record<string, number> = {};
      
      files.forEach((f: any) => {
        const date = new Date(f.modified);
        const year = date.getFullYear().toString();
        const month = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        byYear[year] = (byYear[year] || 0) + 1;
        byMonth[month] = (byMonth[month] || 0) + 1;
      });
      
      // Find years with most files
      const sortedYears = Object.entries(byYear).sort((a, b) => b[1] - a[1]);
      
      if (sortedYears.length > 1) {
        newSuggestions.push({
          type: "date",
          title: "Organize by Year",
          description: `Create folders for ${sortedYears.length} different years (${sortedYears.slice(0, 3).map(x => x[0]).join(', ')}...)`,
          impact: "high",
          fileCount: files.length,
          preview: sortedYears.slice(0, 5).map(([year, count]) => ({ name: year, count, size: 0 })),
        });
      }
      
      // Find scattered recent files
      const currentYear = new Date().getFullYear();
      const oldFiles = files.filter((f: any) => new Date(f.modified).getFullYear() < currentYear - 2);
      
      if (oldFiles.length > 10) {
        newSuggestions.push({
          type: "archive",
          title: "Archive Old Files",
          description: `${oldFiles.length} files are older than 2 years. Move to Archive/ folder?`,
          impact: "medium",
          fileCount: oldFiles.length,
          preview: [{ name: "Archive", count: oldFiles.length, size: oldFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0) }],
        });
      }
    }
    
    // Strategy: Project-based organization
    if (selectedStrategy.value === "project") {
      // Detect potential project groups by common prefixes
      const prefixes: Record<string, number> = {};
      
      files.forEach((f: any) => {
        const name = f.name;
        // Look for common patterns like "ProjectX-File.txt" or "Client-Document.pdf"
        const match = name.match(/^([A-Z][a-z]+|[a-z]+)[-_]/);
        if (match) {
          const prefix = match[1];
          if (prefix.length > 2) {
            prefixes[prefix] = (prefixes[prefix] || 0) + 1;
          }
        }
      });
      
      const sortedPrefixes = Object.entries(prefixes)
        .filter(([_, count]) => count >= 5)
        .sort((a, b) => b[1] - a[1]);
      
      if (sortedPrefixes.length > 0) {
        newSuggestions.push({
          type: "project",
          title: `Organize by ${sortedPrefixes.length} Detected Projects`,
          description: `Found potential project prefixes: ${sortedPrefixes.slice(0, 3).map(x => x[0]).join(', ')}`,
          impact: "high",
          fileCount: sortedPrefixes.reduce((sum, [_, count]) => sum + count, 0),
          preview: sortedPrefixes.slice(0, 5).map(([name, count]) => ({ name, count, size: 0 })),
        });
      }
    }
    
    // Strategy: Type-based organization
    if (selectedStrategy.value === "type") {
      const byCategory: Record<string, { count: number; size: number }> = {};
      
      files.forEach((f: any) => {
        const cat = f.category || "Other";
        if (!byCategory[cat]) {
          byCategory[cat] = { count: 0, size: 0 };
        }
        byCategory[cat].count += 1;
        byCategory[cat].size += f.size || 0;
      });
      
      const sorted = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count);
      
      if (sorted.length > 2) {
        newSuggestions.push({
          type: "type",
          title: "Organize by File Type",
          description: `Create folders for ${sorted.length} categories (${sorted.map(x => x[0]).join(', ')})`,
          impact: "high",
          fileCount: files.length,
          preview: sorted.slice(0, 5).map(([name, stats]) => ({ 
            name, 
            count: stats.count, 
            size: stats.size 
          })),
        });
      }
    }
    
    // Strategy: Size-based organization
    if (selectedStrategy.value === "size") {
      const largeFiles = files.filter((f: any) => (f.size || 0) > 100 * 1024 * 1024); // > 100MB
      
      if (largeFiles.length > 5) {
        newSuggestions.push({
          type: "size",
          title: "Separate Large Files",
          description: `${largeFiles.length} files are over 100MB. Move to LargeFiles/ folder?`,
          impact: "medium",
          fileCount: largeFiles.length,
          preview: largeFiles.slice(0, 5).map((f: any) => ({ 
            name: f.name.substring(0, 30), 
            count: 1, 
            size: f.size 
          })),
        });
      }
    }
    
    // Generic suggestion: Find duplicates to clean up
    if (store.analysisResult?.duplicate_groups?.length > 0) {
      const dupGroups = store.analysisResult.duplicate_groups;
      newSuggestions.unshift({
        type: "cleanup",
        title: "Clean Up Duplicates First",
        description: `${dupGroups.length} duplicate groups found. Clean these before reorganizing.`,
        impact: "high",
        fileCount: store.analysisResult.duplicate_count || 0,
        potentialSavings: store.analysisResult.duplicate_size || 0,
        preview: dupGroups.slice(0, 3).map((g: any) => ({ 
          name: g.hash.substring(0, 8) + "...", 
          count: g.file_count, 
          size: g.wasted_space 
        })),
      });
    }
    
    suggestions.value = newSuggestions;
    isAnalyzing.value = false;
  }, 800); // Simulate AI processing time
};

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case "high": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "medium": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    default: return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  }
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    date: "📅",
    project: "📁",
    type: "📄",
    size: "📊",
    archive: "📦",
    cleanup: "🧹",
  };
  return icons[type] || "💡";
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">AI Auto-Organization</h1>
        <p class="text-slate-400 mt-1">Smart suggestions for organizing your files</p>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else>
      <!-- Strategy Selection -->
      <Card title="Organization Strategy">
        <div class="grid grid-cols-4 gap-3">
          <button
            v-for="strategy in ['date', 'project', 'type', 'size'] as const"
            :key="strategy"
            :class="[
              'p-4 rounded-lg border transition-all text-left',
              selectedStrategy === strategy
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750',
            ]"
            @click="selectedStrategy = strategy"
          >
            <div class="text-2xl mb-2">
              {{ strategy === 'date' ? '📅' : strategy === 'project' ? '📁' : strategy === 'type' ? '📄' : '📊' }}
            </div>
            <div class="font-medium capitalize">{{ strategy }}</div>
            <div class="text-xs text-slate-500 mt-1">
              {{ strategy === 'date' ? 'By year/month' : strategy === 'project' ? 'Detect projects' : strategy === 'type' ? 'By category' : 'By file size' }}
            </div>
          </button>
        </div>
        
        <div class="mt-4 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            :loading="isAnalyzing"
            @click="generateSuggestions"
          >
            <span class="flex items-center gap-2">
              <span>🤖</span>
              <span>Analyze with AI</span>
            </span>
          </Button>
        </div>
      </Card>

      <!-- Suggestions -->
      <div v-if="suggestions.length > 0" class="space-y-4">
        <h2 class="text-lg font-semibold text-slate-200">
          💡 {{ suggestions.length }} Organization Suggestions
        </h2>
        
        <Card
          v-for="(suggestion, index) in suggestions"
          :key="index"
          :title="`${getTypeIcon(suggestion.type)} ${suggestion.title}`"
        >
          <div class="space-y-4">
            <!-- Description -->
            <p class="text-slate-300">{{ suggestion.description }}</p>
            
            <!-- Impact Badge -->
            <div class="flex items-center gap-3">
              <span
                class="px-3 py-1 rounded-full text-sm font-medium border"
                :class="getImpactColor(suggestion.impact)"
              >
                {{ suggestion.impact.toUpperCase() }} IMPACT
              </span>
              <span class="text-slate-400">
                {{ suggestion.fileCount }} files affected
              </span>
              <span v-if="suggestion.potentialSavings" class="text-emerald-400">
                {{ formatSize(suggestion.potentialSavings) }} potential savings
              </span>
            </div>
            
            <!-- Preview -->
            <div v-if="suggestion.preview?.length > 0" class="mt-4">
              <div class="text-sm text-slate-500 mb-2">Preview:</div>
              <div class="space-y-1">
                <div
                  v-for="item in suggestion.preview"
                  :key="item.name"
                  class="flex items-center justify-between p-2 bg-slate-800/50 rounded"
                >
                  <span class="text-slate-300">📁 {{ item.name }}</span>
                  <div class="text-right">
                    <div class="text-sm text-slate-400">{{ item.count }} files</div>
                    <div v-if="item.size > 0" class="text-xs text-slate-500">{{ formatSize(item.size) }}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center gap-3 pt-2">
              <Button variant="secondary" size="sm">
                Preview Changes
              </Button>
              <Button variant="primary" size="sm">
                Apply Organization
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <!-- Tips -->
      <div class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h3 class="font-medium text-blue-400 mb-2">💡 Organization Tips</h3>
        <ul class="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li><strong>Date-based:</strong> Best for photos, documents, and downloads</li>
          <li><strong>Project-based:</strong> Groups files with common naming patterns</li>
          <li><strong>Type-based:</strong> Separates images, videos, documents, code</li>
          <li><strong>Size-based:</strong> Isolates large files for separate storage</li>
          <li>Always backup before bulk reorganization</li>
        </ul>
      </div>
    </template>
  </div>
</template>
