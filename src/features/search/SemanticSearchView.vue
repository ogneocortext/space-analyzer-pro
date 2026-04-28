<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const searchQuery = ref("");
const isSearching = ref(false);
const searchResults = ref<any[]>([]);
const searchHistory = ref<string[]>([]);

// Example natural language queries
const exampleQueries = [
  "Find all photos from last summer",
  "Show me large video files over 1GB",
  "Find duplicate documents",
  "Show files I haven't opened this year",
  "Find all JavaScript files modified recently",
];

// Mock AI-powered search results
async function performSemanticSearch() {
  if (!searchQuery.value.trim() || !store.analysisResult) return;

  isSearching.value = true;
  searchHistory.value.unshift(searchQuery.value);
  if (searchHistory.value.length > 5) searchHistory.value.pop();

  // Simulate AI processing delay
  await new Promise(r => setTimeout(r, 800));

  const files = store.analysisResult.files || [];
  const query = searchQuery.value.toLowerCase();

  // Simple semantic matching (production would use embeddings)
  searchResults.value = files
    .filter((f: any) => {
      const text = `${f.name} ${f.path} ${f.category}`.toLowerCase();
      
      // Handle different query types
      if (query.includes("large") || query.includes("big")) {
        return f.size > 100 * 1024 * 1024; // > 100MB
      }
      if (query.includes("video") || query.includes("photo") || query.includes("image")) {
        return f.category === "media" || f.category === "images" || f.category === "videos";
      }
      if (query.includes("old") || query.includes("last year")) {
        const age = Date.now() - new Date(f.modified).getTime();
        return age > 365 * 24 * 60 * 60 * 1000;
      }
      if (query.includes("recent") || query.includes("new")) {
        const age = Date.now() - new Date(f.modified).getTime();
        return age < 30 * 24 * 60 * 60 * 1000;
      }
      
      return text.includes(query);
    })
    .slice(0, 20)
    .map((f: any) => ({
      ...f,
      relevance: Math.random() * 100, // Mock relevance score
    }));

  isSearching.value = false;
}

function useExample(query: string) {
  searchQuery.value = query;
  performSemanticSearch();
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-100">Semantic Search</h1>
      <p class="text-slate-400 mt-1">Search files using natural language</p>
    </div>

    <!-- Search Box -->
    <div class="flex gap-2">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="e.g., 'Find large video files from last month'"
        class="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        @keyup.enter="performSemanticSearch"
      />
      <Button
        variant="primary"
        :loading="isSearching"
        @click="performSemanticSearch"
      >
        {{ isSearching ? "Searching..." : "Search" }}
      </Button>
    </div>

    <!-- Example Queries -->
    <div v-if="!searchQuery" class="space-y-2">
      <p class="text-sm text-slate-500">Try these examples:</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="example in exampleQueries"
          :key="example"
          class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm rounded-full transition-colors"
          @click="useExample(example)"
        >
          {{ example }}
        </button>
      </div>
    </div>

    <!-- Search History -->
    <div v-if="searchHistory.length > 0 && !searchQuery" class="space-y-2">
      <p class="text-sm text-slate-500">Recent searches:</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="query in searchHistory"
          :key="query"
          class="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm rounded-full transition-colors"
          @click="useExample(query)"
        >
          {{ query }}
        </button>
      </div>
    </div>

    <!-- Results -->
    <div v-if="searchResults.length > 0" class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-200">
          Found {{ searchResults.length }} results
        </h2>
        <span class="text-sm text-slate-500">AI-powered relevance scoring</span>
      </div>

      <div class="space-y-2">
        <div
          v-for="file in searchResults"
          :key="file.path"
          class="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between hover:bg-slate-800 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 truncate">{{ file.name }}</p>
            <p class="text-sm text-slate-500 truncate">{{ file.path }}</p>
            <div class="flex gap-3 mt-1 text-xs text-slate-400">
              <span>{{ formatSize(file.size) }}</span>
              <span>{{ file.category }}</span>
              <span>{{ new Date(file.modified).toLocaleDateString() }}</span>
            </div>
          </div>
          <div class="text-right ml-4">
            <div class="text-sm font-medium" :class="file.relevance > 80 ? 'text-emerald-400' : 'text-yellow-400'">
              {{ file.relevance.toFixed(0) }}% match
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Results -->
    <div v-if="searchQuery && !isSearching && searchResults.length === 0" class="p-8 text-center">
      <p class="text-slate-400">No files match your search.</p>
      <p class="text-sm text-slate-500 mt-2">Try different keywords or check if you have scan data.</p>
    </div>
  </div>
</template>
