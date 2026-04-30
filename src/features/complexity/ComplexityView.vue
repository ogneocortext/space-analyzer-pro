<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();

// State
const loading = ref(false);
const analyzing = ref(false);
const complexityData = ref<any[]>([]);
const summary = ref<any>(null);
const filesNeedingRefactoring = ref<any[]>([]);
const selectedLanguage = ref<string>("all");
const selectedGrade = ref<string>("all");
const sortBy = ref<"complexity" | "maintainability" | "lines" | "grade">("complexity");

// Load complexity data on mount
onMounted(async () => {
  if (store.analysisResult?.directory) {
    await loadComplexityData();
  }
});

// Load complexity data from API
async function loadComplexityData() {
  loading.value = true;
  try {
    const response = await fetch(
      `http://localhost:8080/api/complexity/summary?directory=${encodeURIComponent(store.analysisResult.directory)}`
    );
    
    if (response.ok) {
      const data = await response.json();
      summary.value = data.summary;
      filesNeedingRefactoring.value = data.filesNeedingRefactoring || [];
      
      // Load detailed metrics
      const metricsResponse = await fetch(
        `http://localhost:8080/api/complexity/metrics?directory=${encodeURIComponent(store.analysisResult.directory)}&limit=100`
      );
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        complexityData.value = metricsData.metrics || [];
      }
    }
  } catch (err) {
    console.error("Failed to load complexity data:", err);
  } finally {
    loading.value = false;
  }
}

// Run complexity analysis
async function analyzeComplexity() {
  analyzing.value = true;
  try {
    const response = await fetch('http://localhost:8080/api/complexity/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directory: store.analysisResult.directory,
        maxFiles: 100
      })
    });
    
    if (response.ok) {
      await loadComplexityData();
    }
  } catch (err) {
    console.error("Failed to analyze complexity:", err);
  } finally {
    analyzing.value = false;
  }
}

// Filtered and sorted files
const filteredFiles = computed(() => {
  let files = complexityData.value;
  
  // Filter by language
  if (selectedLanguage.value !== "all") {
    files = files.filter(f => f.language === selectedLanguage.value);
  }
  
  // Filter by grade
  if (selectedGrade.value !== "all") {
    files = files.filter(f => f.complexity_grade === selectedGrade.value);
  }
  
  // Sort
  return [...files].sort((a, b) => {
    switch (sortBy.value) {
      case "complexity":
        return b.cyclomatic_complexity - a.cyclomatic_complexity;
      case "maintainability":
        return a.maintainability_index - b.maintainability_index;
      case "lines":
        return b.lines_of_code - a.lines_of_code;
      case "grade":
        const gradeOrder = { F: 0, D: 1, C: 2, B: 3, A: 4 };
        return (gradeOrder[b.complexity_grade] || 0) - (gradeOrder[a.complexity_grade] || 0);
      default:
        return 0;
    }
  });
});

// Available languages
const languages = computed(() => {
  const langs = new Set(complexityData.value.map(f => f.language).filter(Boolean));
  return ["all", ...Array.from(langs).sort()];
});

// Grade distribution
const gradeDistribution = computed(() => {
  if (!summary.value) return {};
  return {
    A: summary.value.grade_a || 0,
    B: summary.value.grade_b || 0,
    C: summary.value.grade_c || 0,
    D: summary.value.grade_d || 0,
    F: summary.value.grade_f || 0
  };
});

// Priority distribution
const priorityDistribution = computed(() => {
  if (!summary.value) return {};
  return {
    critical: summary.value.critical_count || 0,
    high: summary.value.high_count || 0,
    medium: summary.value.medium_count || 0
  };
});

// Helper functions
function formatNumber(num: number): string {
  if (!num) return "0";
  return num.toLocaleString();
}

function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-blue-500",
    C: "bg-yellow-500",
    D: "bg-orange-500",
    F: "bg-red-500"
  };
  return colors[grade] || "bg-slate-500";
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: "text-red-400 bg-red-500/20",
    high: "text-orange-400 bg-orange-500/20",
    medium: "text-yellow-400 bg-yellow-500/20",
    low: "text-emerald-400 bg-emerald-500/20"
  };
  return colors[priority] || "text-slate-400 bg-slate-500/20";
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    critical: "Critical - Immediate Refactoring Needed",
    high: "High - Refactor Soon",
    medium: "Medium - Consider Refactoring",
    low: "Low - Good Code Quality"
  };
  return labels[priority] || priority;
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-100">Code Complexity Analysis</h1>
      <Button 
        variant="primary" 
        @click="analyzeComplexity"
        :disabled="analyzing || !store.analysisResult?.directory"
      >
        <span v-if="analyzing">Analyzing...</span>
        <span v-else>Run Analysis</span>
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full mb-4"></div>
      <p class="text-slate-400">Loading complexity data...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!summary" class="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-800">
      <svg class="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-slate-300 mb-2">No Complexity Data</h3>
      <p class="text-slate-500 mb-4">Run complexity analysis to see code quality metrics</p>
      <Button 
        variant="primary" 
        @click="analyzeComplexity"
        :disabled="analyzing || !store.analysisResult?.directory"
      >
        <span v-if="analyzing">Analyzing...</span>
        <span v-else>Analyze Code</span>
      </Button>
    </div>

    <!-- Summary Cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card padding="md" class="bg-slate-900 border-slate-800">
        <div class="text-center">
          <p class="text-sm text-slate-400 mb-1">Files Analyzed</p>
          <p class="text-3xl font-bold text-slate-100">{{ formatNumber(summary?.total_files) }}</p>
        </div>
      </Card>

      <Card padding="md" class="bg-slate-900 border-slate-800">
        <div class="text-center">
          <p class="text-sm text-slate-400 mb-1">Avg Complexity</p>
          <p class="text-3xl font-bold" :class="summary?.avg_complexity > 20 ? 'text-red-400' : 'text-slate-100'">
            {{ formatNumber(summary?.avg_complexity?.toFixed(1)) }}
          </p>
        </div>
      </Card>

      <Card padding="md" class="bg-slate-900 border-slate-800">
        <div class="text-center">
          <p class="text-sm text-slate-400 mb-1">Maintainability</p>
          <p class="text-3xl font-bold" :class="summary?.avg_maintainability < 50 ? 'text-red-400' : 'text-emerald-400'">
            {{ formatNumber(summary?.avg_maintainability?.toFixed(0)) }}
          </p>
        </div>
      </Card>

      <Card padding="md" class="bg-slate-900 border-slate-800">
        <div class="text-center">
          <p class="text-sm text-slate-400 mb-1">Need Refactoring</p>
          <p class="text-3xl font-bold" :class="(summary?.critical_count + summary?.high_count) > 0 ? 'text-red-400' : 'text-emerald-400'">
            {{ formatNumber((summary?.critical_count || 0) + (summary?.high_count || 0)) }}
          </p>
        </div>
      </Card>
    </div>

    <!-- Grade Distribution -->
    <div v-if="summary" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card padding="md" class="bg-slate-900 border-slate-800">
        <h3 class="text-lg font-semibold text-slate-200 mb-4">Complexity Grade Distribution</h3>
        <div class="space-y-3">
          <div v-for="(count, grade) in gradeDistribution" :key="grade" class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" 
                 :class="getGradeColor(grade)">
              {{ grade }}
            </div>
            <div class="flex-1">
              <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" 
                     :class="getGradeColor(grade)"
                     :style="{ width: `${(count / (summary?.total_files || 1)) * 100}%` }"></div>
              </div>
            </div>
            <span class="text-sm text-slate-400 w-12 text-right">{{ count }}</span>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
          <p>A: Excellent (0-10 CC) | B: Good (11-20 CC) | C: Fair (21-40 CC)</p>
          <p>D: Poor (41-60 CC) | F: Critical (>60 CC)</p>
        </div>
      </Card>

      <!-- Refactoring Priority -->
      <Card padding="md" class="bg-slate-900 border-slate-800">
        <h3 class="text-lg font-semibold text-slate-200 mb-4">Refactoring Priority</h3>
        <div class="space-y-3">
          <div v-for="(count, priority) in priorityDistribution" :key="priority" class="flex items-center gap-3">
            <span class="text-sm font-medium w-16 capitalize" :class="getPriorityColor(priority).split(' ')[0]">
              {{ priority }}
            </span>
            <div class="flex-1">
              <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" 
                     :class="getPriorityColor(priority).split(' ')[0].replace('text-', 'bg-')"
                     :style="{ width: `${(count / (summary?.total_files || 1)) * 100}%` }"></div>
              </div>
            </div>
            <span class="text-sm text-slate-400 w-12 text-right">{{ count }}</span>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
          <p>Critical: CC > 50 or MI < 30</p>
          <p>High: CC > 30 or MI < 50 | Medium: CC > 15 or MI < 70</p>
        </div>
      </Card>
    </div>

    <!-- Files Needing Refactoring -->
    <Card v-if="filesNeedingRefactoring.length > 0" padding="md" class="bg-slate-900 border-slate-800">
      <h3 class="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Files Needing Immediate Attention ({{ filesNeedingRefactoring.length }})
      </h3>
      <div class="space-y-2 max-h-64 overflow-y-auto">
        <div v-for="file in filesNeedingRefactoring.slice(0, 10)" :key="file.file_path"
             class="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 truncate">{{ file.file_path.split('/').pop() }}</p>
            <p class="text-xs text-slate-500 truncate">{{ file.file_path }}</p>
          </div>
          <div class="flex items-center gap-3 ml-4">
            <span class="px-2 py-1 rounded text-xs font-medium"
                  :class="getPriorityColor(file.refactoring_priority)">
              {{ file.refactoring_priority }}
            </span>
            <span class="text-sm text-slate-400">
              CC: {{ file.cyclomatic_complexity }}
            </span>
            <span class="text-sm text-slate-400">
              MI: {{ file.maintainability_index?.toFixed(0) }}
            </span>
          </div>
        </div>
      </div>
    </Card>

    <!-- Filters -->
    <Card v-if="complexityData.length > 0" padding="sm" class="bg-slate-900 border-slate-800">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-400">Language:</label>
          <select v-model="selectedLanguage" class="bg-slate-800 border-slate-700 rounded px-3 py-1 text-sm text-slate-200">
            <option v-for="lang in languages" :key="lang" :value="lang">
              {{ lang === 'all' ? 'All Languages' : lang }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-400">Grade:</label>
          <select v-model="selectedGrade" class="bg-slate-800 border-slate-700 rounded px-3 py-1 text-sm text-slate-200">
            <option value="all">All Grades</option>
            <option value="A">A (Excellent)</option>
            <option value="B">B (Good)</option>
            <option value="C">C (Fair)</option>
            <option value="D">D (Poor)</option>
            <option value="F">F (Critical)</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-400">Sort By:</label>
          <select v-model="sortBy" class="bg-slate-800 border-slate-700 rounded px-3 py-1 text-sm text-slate-200">
            <option value="complexity">Cyclomatic Complexity</option>
            <option value="maintainability">Maintainability Index</option>
            <option value="lines">Lines of Code</option>
            <option value="grade">Grade</option>
          </select>
        </div>

        <div class="ml-auto text-sm text-slate-400">
          Showing {{ filteredFiles.length }} of {{ complexityData.length }} files
        </div>
      </div>
    </Card>

    <!-- Complexity Table -->
    <Card v-if="filteredFiles.length > 0" padding="md" class="bg-slate-900 border-slate-800">
      <h3 class="text-lg font-semibold text-slate-200 mb-4">Detailed Complexity Metrics</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-800">
              <th class="text-left py-2 px-3 text-slate-400 font-medium">File</th>
              <th class="text-center py-2 px-3 text-slate-400 font-medium">Language</th>
              <th class="text-center py-2 px-3 text-slate-400 font-medium">Grade</th>
              <th class="text-center py-2 px-3 text-slate-400 font-medium">Complexity</th>
              <th class="text-center py-2 px-3 text-slate-400 font-medium">Maintainability</th>
              <th class="text-center py-2 px-3 text-slate-400 font-medium">Lines</th>
              <th class="text-center py-2 px-3 text-slate-400 font-medium">Functions</th>
              <th class="text-center py-2 px-3 text-slate-400 font-medium">Max Function</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in filteredFiles.slice(0, 50)" :key="file.file_path" 
                class="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td class="py-2 px-3">
                <p class="font-medium text-slate-200 truncate max-w-xs">{{ file.file_path.split('/').pop() }}</p>
                <p class="text-xs text-slate-500 truncate max-w-xs">{{ file.file_path }}</p>
              </td>
              <td class="py-2 px-3 text-center">
                <span class="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400 capitalize">
                  {{ file.language }}
                </span>
              </td>
              <td class="py-2 px-3 text-center">
                <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold text-white"
                      :class="getGradeColor(file.complexity_grade)">
                  {{ file.complexity_grade }}
                </span>
              </td>
              <td class="py-2 px-3 text-center">
                <span :class="file.cyclomatic_complexity > 30 ? 'text-red-400' : 'text-slate-300'">
                  {{ file.cyclomatic_complexity }}
                </span>
              </td>
              <td class="py-2 px-3 text-center">
                <span :class="file.maintainability_index < 50 ? 'text-red-400' : 'text-emerald-400'">
                  {{ file.maintainability_index?.toFixed(0) }}
                </span>
              </td>
              <td class="py-2 px-3 text-center text-slate-300">
                {{ formatNumber(file.lines_of_code) }}
              </td>
              <td class="py-2 px-3 text-center text-slate-300">
                {{ file.function_count }}
              </td>
              <td class="py-2 px-3 text-center">
                <span :class="file.max_function_length > 50 ? 'text-orange-400' : 'text-slate-300'">
                  {{ file.max_function_length }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filteredFiles.length > 50" class="mt-4 text-center text-sm text-slate-500">
        Showing first 50 files. Use filters to narrow results.
      </div>
    </Card>
  </div>
</template>
