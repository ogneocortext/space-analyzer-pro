<template>
  <div
    data-testid="dashboard-view"
    class="min-h-screen bg-slate-950 px-4 py-6 text-white lg:px-8 lg:py-8"
  >
    <div class="mx-auto max-w-7xl space-y-8">
      <!-- Hero -->
      <section
        class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl lg:p-8"
      >
        <div class="absolute inset-0 opacity-30">
          <div class="absolute -left-16 top-0 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl" />
          <div class="absolute right-0 top-10 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>

        <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-2xl">
            <div
              class="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300"
            >
              <Sparkles :size="14" aria-hidden="true" />
              Storage intelligence at a glance
            </div>
            <h1 class="text-4xl font-semibold tracking-tight text-white lg:text-5xl">
              See what is taking space, and act on it faster.
            </h1>
            <p class="mt-4 max-w-xl text-base leading-7 text-slate-300 lg:text-lg">
              Start a scan, revisit the most recent results, and jump straight into the views that
              matter most.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <button
              class="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 hover:bg-cyan-400"
              aria-label="Start analysis"
              @click="navigateToLanding"
            >
              <Scan :size="16" aria-hidden="true" />
              Start New Scan
            </button>
            <button
              class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              aria-label="Browse files"
              @click="navigateToBrowser"
            >
              <FolderOpen :size="16" aria-hidden="true" />
              Browse Files
            </button>
            <button
              class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              aria-label="Export report"
              @click="exportReport"
            >
              <Download :size="16" aria-hidden="true" />
              Export Report
            </button>
            <div class="relative">
              <button
                class="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                aria-label="Tools menu"
                @click="toggleToolsMenu"
              >
                <Wrench :size="16" aria-hidden="true" />
                Tools
                <ChevronDown :size="14" aria-hidden="true" />
              </button>

              <div
                v-if="showToolsMenu"
                class="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
              >
                <button
                  class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/5"
                  @click="navigateToFileBrowser"
                >
                  <Folder :size="14" />
                  File Browser
                </button>
                <button
                  class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/5"
                  @click="navigateToExport"
                >
                  <FileText :size="14" />
                  Export Data
                </button>
                <button
                  class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/5"
                  @click="navigateToOptimization"
                >
                  <TrendingUp :size="14" />
                  Optimization
                </button>
                <button
                  class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/5"
                  @click="navigateToAutomation"
                >
                  <Cpu :size="14" />
                  Automation
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Empty State -->
      <div v-if="!analysisData" class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section class="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div class="flex items-start gap-4">
            <div class="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
              <FolderOpen :size="28" aria-hidden="true" />
            </div>
            <div>
              <h2 class="text-2xl font-semibold text-white">No data yet</h2>
              <p class="mt-2 max-w-xl text-slate-300">
                Run your first analysis to generate a storage map, cleanup recommendations, and
                AI-assisted insights.
              </p>
            </div>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="text-sm text-slate-400">Fast path</div>
              <div class="mt-1 font-semibold text-white">Scan a folder</div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="text-sm text-slate-400">Next step</div>
              <div class="mt-1 font-semibold text-white">Review largest files</div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="text-sm text-slate-400">Guidance</div>
              <div class="mt-1 font-semibold text-white">Ask the AI assistant</div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h3 class="text-xl font-semibold text-white">What you can do here</h3>
          <div class="mt-4 grid gap-3">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="text-sm font-semibold text-cyan-300">Discovery</div>
              <div class="mt-1 text-sm text-slate-300">
                Browse the file tree and jump into large-file, duplicate, and cleanup views.
              </div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="text-sm font-semibold text-emerald-300">Action</div>
              <div class="mt-1 text-sm text-slate-300">
                Export reports, review recommendations, and move straight into optimization.
              </div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="text-sm font-semibold text-violet-300">Assist</div>
              <div class="mt-1 text-sm text-slate-300">
                Use the AI assistant for storage questions and next-step suggestions.
              </div>
            </div>
          </div>
        </section>

        <div class="lg:col-span-2 w-full">
          <div class="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div class="mb-4">
              <h3 class="text-xl font-semibold text-white">AI Assistant</h3>
              <p class="mt-1 text-slate-400">
                Ask about cleanup, organization, or the best next step before you scan.
              </p>
            </div>
            <AIChatInterface :analysis-data="null" :files="[]" :categories="{}" />
          </div>
        </div>
      </div>
      <template v-else>
        <div class="space-y-8">
          <!-- Stats Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
              @click="showFileDetails = true"
            >
              <div class="flex items-center gap-3 mb-2">
                <Folder class="text-cyan-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">Total Files</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ analysisData?.file_analysis?.files?.length?.toLocaleString() || 0 }}
              </div>
              <div class="text-xs text-slate-500 mt-1">Click for details</div>
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
              @click="showSizeDetails = true"
            >
              <div class="flex items-center gap-3 mb-2">
                <HardDrive class="text-emerald-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">Total Size</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ formatBytes(analysisData.totalSize || 0) }}
              </div>
              <div class="text-xs text-slate-500 mt-1">Click for breakdown</div>
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
              @click="selectedCategory = null"
            >
              <div class="flex items-center gap-3 mb-2">
                <FolderTree class="text-purple-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">Categories</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ Object.keys(analysisData.file_analysis?.categories || {}).length }}
              </div>
              <div class="text-xs text-slate-500 mt-1">Click category below</div>
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
              @click="showAnalysisInfo = true"
            >
              <div class="flex items-center gap-3 mb-2">
                <Clock class="text-amber-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">Analysis Time</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ formatAnalysisTime(analysisData?.summary?.scan_duration_ms) || "N/A" }}
              </div>
              <div class="text-xs text-slate-500 mt-1">Click for info</div>
            </div>
          </div>

          <!-- Enhanced File Attributes Stats -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
              @click="showEnhancedFileDetails = true"
            >
              <div class="flex items-center gap-3 mb-2">
                <File class="text-blue-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">File Attributes</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ getFileAttributesCount() }}
              </div>
              <div class="text-xs text-slate-500 mt-1">Click for details</div>
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-emerald-500 hover:bg-slate-700/50 transition-all"
              @click="showEnhancedFileDetails = true"
            >
              <div class="flex items-center gap-3 mb-2">
                <HardDrive class="text-emerald-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">Compressed Files</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ getCompressedFilesCount() }}
              </div>
              <div class="text-xs text-slate-500 mt-1">
                {{ getCompressedSizeSavings() }}
              </div>
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-amber-500 hover:bg-slate-700/50 transition-all"
              @click="showEnhancedFileDetails = true"
            >
              <div class="flex items-center gap-3 mb-2">
                <FolderTree class="text-amber-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">Hard Links</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ analysisData?.file_analysis?.hard_link_count || 0 }}
              </div>
              <div class="text-xs text-slate-500 mt-1">
                {{ formatBytes(analysisData?.file_analysis?.hard_link_savings || 0) }}
              </div>
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-purple-500 hover:bg-slate-700/50 transition-all"
              @click="showEnhancedFileDetails = true"
            >
              <div class="flex items-center gap-3 mb-2">
                <File class="text-purple-400" :size="24" aria-hidden="true" />
                <span class="text-slate-400 text-sm">Special Files</span>
              </div>
              <div class="text-3xl font-bold text-white">
                {{ getSpecialFilesCount() }}
              </div>
              <div class="text-xs text-slate-500 mt-1">Sparse/Reparse/ADS</div>
            </div>
          </div>

          <!-- File Attributes Visualization -->
          <FileAttributesVisualization :files="analysisData?.file_analysis?.files || []" />

          <!-- Timestamp Analysis -->
          <TimestampAnalysis :files="analysisData?.file_analysis?.files || []" />

          <!-- Hard Links Analysis -->
          <HardLinksAnalysis
            :files="analysisData?.file_analysis?.files || []"
            :hard-link-count="analysisData?.file_analysis?.hard_link_count"
            :hard-link-savings="analysisData?.file_analysis?.hard_link_savings"
          />

          <!-- Storage Gauge -->
          <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 class="text-xl font-semibold text-white mb-4">Storage Usage</h2>
            <StorageGauge
              :used="analysisData.totalSize || 0"
              :total="getEstimatedDiskCapacity(analysisData.totalSize || 0)"
              :categories="categoryDataComputed"
            />
          </div>

          <!-- Category Breakdown -->
          <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 class="text-xl font-semibold text-white mb-4">Category Breakdown</h2>
            <div class="space-y-4">
              <div
                v-for="(category, name) in sortedCategories"
                :key="name"
                class="flex items-center gap-4 cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                :class="{ 'bg-slate-700/50': selectedCategory === name }"
                @click="selectCategory(name)"
              >
                <div
                  class="w-4 h-4 rounded-full shrink-0"
                  :style="{ backgroundColor: getCategoryColor(name) }"
                  aria-hidden="true"
                />
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-white font-medium">{{ name }}</span>
                    <span class="text-slate-400 text-sm">{{
                      formatBytes((category as any).size || 0)
                    }}</span>
                  </div>
                  <div class="w-full bg-slate-700 rounded-full h-2">
                    <div
                      class="h-2 rounded-full transition-all duration-300"
                      :style="{
                        width: `${((((category as any).size || 0) / (analysisData.totalSize || 1)) * 100).toFixed(1)}%`,
                        backgroundColor: getCategoryColor(name),
                      }"
                    />
                  </div>
                </div>
                <ChevronRight
                  v-if="selectedCategory === name"
                  class="text-cyan-400"
                  :size="20"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <!-- Category Detail Panel -->
          <Transition name="slide">
            <div
              v-if="selectedCategory"
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
            >
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-semibold text-white">{{ selectedCategory }} Details</h2>
                <button
                  class="text-slate-400 hover:text-white transition-colors"
                  aria-label="Close details"
                  @click="selectedCategory = null"
                >
                  <X :size="20" aria-hidden="true" />
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-slate-700/50 rounded-lg p-4">
                  <div class="text-slate-400 text-sm mb-1">File Count</div>
                  <div class="text-2xl font-bold text-white">
                    {{ analysisData.file_analysis?.categories?.[selectedCategory]?.count || 0 }}
                  </div>
                </div>
                <div class="bg-slate-700/50 rounded-lg p-4">
                  <div class="text-slate-400 text-sm mb-1">Total Size</div>
                  <div class="text-2xl font-bold text-white">
                    {{
                      formatBytes(
                        analysisData.file_analysis?.categories?.[selectedCategory]?.size || 0
                      )
                    }}
                  </div>
                </div>
                <div class="bg-slate-700/50 rounded-lg p-4">
                  <div class="text-slate-400 text-sm mb-1">Percentage</div>
                  <div class="text-2xl font-bold text-white">
                    {{ getCategoryPercentage(selectedCategory) }}%
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <h3 class="text-lg font-medium text-white mb-3">Sample Files</h3>
                <div
                  v-for="(file, index) in getCategoryFiles(selectedCategory)"
                  :key="index"
                  class="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg text-sm"
                >
                  <File class="text-slate-400" :size="16" aria-hidden="true" />
                  <span class="text-white truncate flex-1">{{ file.name }}</span>
                  <span class="text-slate-400">{{ formatBytes(file.size) }}</span>
                </div>
                <div
                  v-if="getCategoryFiles(selectedCategory).length === 0"
                  class="text-slate-400 text-sm"
                >
                  No individual file data available
                </div>
              </div>

              <div class="mt-6 flex gap-2">
                <button
                  class="bg-cyan-500 hover:bg-cyan-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
                  @click="navigateToBrowser"
                >
                  Browse {{ selectedCategory }} Files
                </button>
                <button
                  class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
                  @click="exportCategoryReport(selectedCategory)"
                >
                  Export Category Report
                </button>
              </div>
            </div>
          </Transition>

          <!-- Largest Files -->
          <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-white">Largest Files</h2>
              <button
                class="bg-cyan-500 hover:bg-cyan-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
                @click="navigateToBrowser"
              >
                Browse All Files
              </button>
            </div>

            <div v-if="largestFiles.length > 0" class="space-y-3">
              <div
                v-for="(file, index) in largestFiles"
                :key="index"
                class="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
                @click="
                  selectedFileForDetails = file;
                  showEnhancedFileDetails = true;
                "
              >
                <div
                  class="flex items-center justify-center w-8 h-8 bg-cyan-500/20 rounded-full text-cyan-400 font-semibold text-sm"
                >
                  {{ index + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <File class="text-slate-400" :size="16" aria-hidden="true" />
                    <span class="text-white font-medium truncate">{{ file.name }}</span>
                  </div>
                  <div class="text-slate-400 text-sm truncate">
                    {{ file.path }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-white font-semibold">
                    {{ formatBytes(file.size) }}
                  </div>
                  <div class="text-slate-400 text-xs">
                    {{ file.category }}
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-slate-400 text-center py-8">
              <File class="mx-auto mb-3 opacity-50" :size="48" />
              <p>No file data available</p>
              <p class="text-sm mt-2">Run a scan to see the largest files</p>
            </div>
          </div>

          <!-- AI Insights -->
          <div
            v-if="analysisData.ai_insights"
            class="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
          >
            <h2 class="text-xl font-semibold text-white mb-4">AI Insights</h2>
            <div class="space-y-3">
              <div
                v-if="analysisData.ai_insights.optimization_suggestions?.length"
                class="bg-slate-700/30 rounded-lg p-4"
              >
                <h3 class="text-cyan-400 font-medium mb-2">Optimization Suggestions</h3>
                <ul class="space-y-1">
                  <li
                    v-for="(
                      suggestion, index
                    ) in analysisData.ai_insights.optimization_suggestions.slice(0, 5)"
                    :key="index"
                    class="text-slate-300 text-sm flex items-start gap-2"
                  >
                    <span class="text-cyan-400">•</span>
                    {{ suggestion }}
                  </li>
                </ul>
              </div>

              <div
                v-if="analysisData.ai_insights.large_files?.length"
                class="bg-slate-700/30 rounded-lg p-4"
              >
                <h3 class="text-amber-400 font-medium mb-2">Large Files</h3>
                <ul class="space-y-1">
                  <li
                    v-for="(file, index) in analysisData.ai_insights.large_files.slice(0, 5)"
                    :key="index"
                    class="text-slate-300 text-sm"
                  >
                    {{ file }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- File Details Modal -->
          <Transition name="modal">
            <div
              v-if="showFileDetails"
              class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              @click.self="showFileDetails = false"
            >
              <div
                class="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700"
              >
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-xl font-semibold text-white">File Details</h2>
                  <button class="text-slate-400 hover:text-white" @click="showFileDetails = false">
                    <X :size="20" />
                  </button>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(file, index) in analysisData?.file_analysis?.files?.slice(0, 20)"
                    :key="index"
                    class="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg text-sm"
                  >
                    <File class="text-slate-400" :size="16" />
                    <span class="text-white truncate flex-1">{{ file.name }}</span>
                    <span class="text-slate-400">{{
                      formatBytes(
                        typeof file.size === "object" ? file.size?.bytes || 0 : file.size || 0
                      )
                    }}</span>
                  </div>
                  <div
                    v-if="!analysisData?.file_analysis?.files?.length"
                    class="text-slate-400 text-center py-4"
                  >
                    No file details available
                  </div>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Size Details Modal -->
          <Transition name="modal">
            <div
              v-if="showSizeDetails"
              class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              @click.self="showSizeDetails = false"
            >
              <div
                class="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700"
              >
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-xl font-semibold text-white">Size Breakdown</h2>
                  <button class="text-slate-400 hover:text-white" @click="showSizeDetails = false">
                    <X :size="20" />
                  </button>
                </div>
                <div class="space-y-4">
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Total Size</div>
                    <div class="text-2xl font-bold text-white">
                      {{ formatBytes(0) }}
                    </div>
                  </div>
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Average File Size</div>
                    <div class="text-2xl font-bold text-white">
                      {{
                        formatBytes(0 / Math.max(analysisData.file_analysis?.files?.length || 1, 1))
                      }}
                    </div>
                  </div>
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Largest File</div>
                    <div class="text-lg font-bold text-white">
                      {{
                        analysisData.file_analysis?.files?.sort(
                          (a: any, b: any) =>
                            (b.size?.bytes || b.size || 0) - (a.size?.bytes || a.size || 0)
                        )[0]?.name || "N/A"
                      }}
                    </div>
                    <div class="text-slate-400 text-sm">
                      {{
                        formatBytes(
                          analysisData.file_analysis?.files?.sort(
                            (a: any, b: any) =>
                              (b.size?.bytes || b.size || 0) - (a.size?.bytes || a.size || 0)
                          )[0]?.size?.bytes || 0
                        )
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Analysis Info Modal -->
          <Transition name="modal">
            <div
              v-if="showAnalysisInfo"
              class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              @click.self="showAnalysisInfo = false"
            >
              <div
                class="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700"
              >
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-xl font-semibold text-white">Analysis Information</h2>
                  <button class="text-slate-400 hover:text-white" @click="showAnalysisInfo = false">
                    <X :size="20" />
                  </button>
                </div>
                <div class="space-y-4">
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Analysis Time</div>
                    <div class="text-2xl font-bold text-white">
                      {{ formatAnalysisTime(analysisData?.summary?.scan_duration_ms) || "N/A" }}
                    </div>
                  </div>
                  <div v-if="analysisData.strategy" class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Strategy</div>
                    <div class="text-lg font-bold text-white">
                      {{ analysisData.strategy }}
                    </div>
                  </div>
                  <div v-if="analysisData.directoryPath" class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Directory</div>
                    <div class="text-sm text-white truncate">
                      {{ analysisData.directoryPath }}
                    </div>
                  </div>
                  <div v-if="analysisData.tools?.length" class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Tools Used</div>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="(tool, index) in analysisData.tools"
                        :key="index"
                        class="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded"
                      >
                        {{ tool }}
                      </span>
                    </div>
                  </div>
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Analysis Type</div>
                    <div class="text-lg font-bold text-white">
                      {{ analysisData?.scan_config?.path || "Unknown" || "Standard" }}
                    </div>
                  </div>
                  <div v-if="analysisData.dependencyGraph" class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Dependency Graph</div>
                    <div class="text-sm text-white">
                      {{ analysisData.dependencyGraph.nodes?.length || 0 }} nodes,
                      {{ analysisData.dependencyGraph.edges?.length || 0 }} edges
                    </div>
                  </div>

                  <!-- USN Journal Status -->
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">USN Journal</div>
                    <div class="text-sm text-white">
                      <div class="flex items-center gap-2 mb-1">
                        <div
                          class="w-2 h-2 rounded-full"
                          :class="
                            analysisData?.scan_config?.usn_journal_used
                              ? 'bg-emerald-500'
                              : 'bg-slate-500'
                          "
                        />
                        {{ analysisData?.scan_config?.usn_journal_used ? "Available" : "Not Used" }}
                      </div>
                      <div
                        v-if="analysisData?.scan_config?.usn_journal_used"
                        class="text-xs text-slate-400"
                      >
                        Journal ID: {{ analysisData?.scan_config?.usn_journal_id || "N/A" }}
                      </div>
                      <div
                        v-if="analysisData?.scan_config?.usn_journal_used"
                        class="text-xs text-slate-400"
                      >
                        Last USN: {{ analysisData?.scan_config?.last_usn || "N/A" }}
                      </div>
                    </div>
                  </div>

                  <!-- MFT Scanning Status -->
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">MFT Scanning</div>
                    <div class="text-sm text-white">
                      <div class="flex items-center gap-2 mb-1">
                        <div
                          class="w-2 h-2 rounded-full"
                          :class="
                            analysisData?.scan_config?.mft_scanning_enabled
                              ? 'bg-emerald-500'
                              : 'bg-slate-500'
                          "
                        />
                        {{
                          analysisData?.scan_config?.mft_scanning_enabled ? "Enabled" : "Disabled"
                        }}
                      </div>
                      <div class="flex items-center gap-2">
                        <div
                          class="w-2 h-2 rounded-full"
                          :class="
                            analysisData?.scan_config?.hard_links_enumerated
                              ? 'bg-emerald-500'
                              : 'bg-slate-500'
                          "
                        />
                        {{
                          analysisData?.scan_config?.hard_links_enumerated
                            ? "Hard Links Enumerated"
                            : "Hard Links Not Enumerated"
                        }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>

          <!-- AI Chat Interface - Available with Data -->
          <div class="mt-8">
            <div class="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <h3 class="text-xl font-semibold text-white mb-2">🤖 AI Storage Assistant</h3>
              <p class="text-slate-400 mb-4">
                Get personalized insights about your storage data and organization tips
              </p>
              <AIChatInterface
                :analysis-data="analysisData"
                :files="analysisData?.file_analysis?.files || []"
                :categories="
                  analysisData?.file_analysis?.categories || analysisData?.categories || {}
                "
              />
            </div>
          </div>

          <!-- Enhanced File Details Modal -->
          <EnhancedFileDetailsModal
            :show="showEnhancedFileDetails"
            :files="(analysisData?.file_analysis?.files || []) as any[]"
            :selected-file="selectedFileForDetails"
            @close="showEnhancedFileDetails = false"
            @file-selected="selectedFileForDetails = $event"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  File,
  X,
  Clock,
  ChevronRight,
  Folder,
  FolderOpen,
  HardDrive,
  FolderTree,
  Download,
  RefreshCw,
  Sparkles,
  Scan,
  FileText,
  TrendingUp,
  Cpu,
} from "lucide-vue-next";
import StorageGauge from "../../components/vue/StorageGauge.vue";
import EnhancedFileDetailsModal from "../../components/vue/analysis/EnhancedFileDetailsModal.vue";
import FileAttributesVisualization from "../../components/analysis/FileAttributesVisualization.vue";
import TimestampAnalysis from "../../components/analysis/TimestampAnalysis.vue";
import HardLinksAnalysis from "../../components/analysis/HardLinksAnalysis.vue";
import AIChatInterface from "../../components/vue/ai/AIChatInterface.vue";
import { useAnalysisStore } from "@/store";
import { getCategoryColor } from "../../utils/dataTransformers";
import { Wrench, ChevronDown } from "lucide-vue-next";

interface CategoryData {
  size: number;
  count?: number;
  files?: Array<{ name: string; size: number; path: string }>;
  [key: string]: unknown;
}

const router = useRouter();
const analysisStore = useAnalysisStore();

// Initialize store on component mount to load previous scan data
onMounted(() => {
  analysisStore.initialize();
});

// Create a computed property to bridge the property name difference
const analysisData = computed(() => analysisStore.analysisResult);

const selectedCategory = ref<string | null>(null);
const showFileDetails = ref(false);
const showSizeDetails = ref(false);
const showAnalysisInfo = ref(false);
const showEnhancedFileDetails = ref(false);
const showToolsMenu = ref(false);
const selectedFileForDetails = ref<any>(null);

const getEstimatedDiskCapacity = (usedSpace: number): number => {
  // If no used space, return a reasonable default (1GB)
  if (usedSpace === 0) return 1024 * 1024 * 1024; // 1GB in bytes

  // Estimate total capacity based on used space
  // Common disk sizes: 256GB, 512GB, 1TB, 2TB, 4TB
  const gbUsed = usedSpace / (1024 * 1024 * 1024);

  if (gbUsed <= 100) return 256 * 1024 * 1024 * 1024; // 256GB
  if (gbUsed <= 200) return 512 * 1024 * 1024 * 1024; // 512GB
  if (gbUsed <= 400) return 1024 * 1024 * 1024 * 1024; // 1TB
  if (gbUsed <= 800) return 2 * 1024 * 1024 * 1024 * 1024; // 2TB
  return 4 * 1024 * 1024 * 1024 * 1024; // 4TB
};

const navigateToBrowser = () => {
  router.push("/file-browser");
};

const navigateToLanding = () => {
  router.push("/scan");
};

const toggleToolsMenu = () => {
  showToolsMenu.value = !showToolsMenu.value;
};

const navigateToFileBrowser = () => {
  router.push("/file-browser");
  showToolsMenu.value = false;
};

const navigateToExport = () => {
  router.push("/export");
  showToolsMenu.value = false;
};

const navigateToOptimization = () => {
  router.push("/optimization");
  showToolsMenu.value = false;
};

const navigateToAutomation = () => {
  router.push("/automation");
  showToolsMenu.value = false;
};

const exportReport = () => {
  if (!analysisData.value) return;
  const dataStr = JSON.stringify(analysisData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `space-analyzer-report-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportCategoryReport = (category: string) => {
  if (!analysisData.value?.file_analysis?.categories) return;
  const categoryData = analysisData.value.file_analysis.categories[category];
  const dataStr = JSON.stringify({ category, data: categoryData }, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `category-${category}-${Date.now()}.json`;
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const selectCategory = (name: string) => {
  if (selectedCategory.value === name) {
    selectedCategory.value = null;
  } else {
    selectedCategory.value = name;
  }
};

const getCategoryPercentage = (category: string): string => {
  if (!analysisData.value?.file_analysis?.categories || !analysisData.value.totalSize) return "0";
  const categorySize = analysisData.value.file_analysis.categories[category]?.size || 0;
  return ((categorySize / analysisData.value.totalSize) * 100).toFixed(1);
};

const getCategoryFiles = (category: string): Array<{ name: string; size: number }> => {
  if (!analysisData.value?.file_analysis?.categories) return [];
  const categoryData = analysisData.value.file_analysis.categories[category] as CategoryData;
  if (categoryData.files && categoryData.files.length > 0) {
    return categoryData.files.slice(0, 10).map((f) => ({ name: f.name, size: f.size }));
  }
  // Generate sample files if no individual file data
  const count = categoryData.count || 0;
  const size = categoryData.size || 0;
  const sampleFiles: Array<{ name: string; size: number }> = [];
  for (let i = 0; i < Math.min(count, 10); i++) {
    sampleFiles.push({
      name: `${category.toLowerCase()}_file_${i + 1}`,
      size: size / Math.max(count, 1),
    });
  }
  return sampleFiles;
};

const categoryDataComputed = computed(() => {
  if (!analysisData.value?.file_analysis?.categories) return [];
  return Object.entries(analysisData.value.file_analysis.categories).map(
    ([name, data]: [string, any]) => ({
      name,
      size: (data as any).size || 0,
      color: getCategoryColor(name),
    })
  );
});

const sortedCategories = computed(() => {
  if (!analysisData.value?.file_analysis?.categories) return {};
  const categories = analysisData.value.file_analysis.categories;
  const sorted = Object.entries(categories).sort(
    ([, a]: [string, any], [, b]: [string, any]) => (b as any).size - (a as any).size
  );
  return Object.fromEntries(sorted);
});

const largestFiles = computed(() => {
  if (!analysisData.value?.file_analysis?.files) return [];

  const files = analysisData.value.file_analysis.files;
  const sorted = files
    .map((file: any) => ({
      name: file.name || file.path || "Unknown",
      size: file.size?.bytes || file.size || 0,
      path: file.path || file.name || "",
      category: file.category || "Unknown",
    }))
    .sort((a: any, b: any) => b.size - a.size)
    .slice(0, 10); // Top 10 largest files

  return sorted;
});

const formatBytes = (bytes: number) => {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatAnalysisTime = (ms: number | null | undefined): string => {
  if (!ms || isNaN(ms)) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const getFileAttributesCount = (): number => {
  if (!analysisData.value?.file_analysis?.files) return 0;
  return analysisData.value.file_analysis.files.filter(
    (file: any) =>
      file.attributes?.is_compressed ||
      file.attributes?.is_sparse ||
      file.attributes?.is_reparse_point ||
      file.attributes?.has_ads ||
      file.is_hard_link ||
      file.file_hash
  ).length;
};

const getCompressedFilesCount = (): number => {
  if (!analysisData.value?.file_analysis?.files) return 0;
  return analysisData.value.file_analysis.files.filter(
    (file: any) => file.attributes?.is_compressed
  ).length;
};

const getCompressedSizeSavings = (): string => {
  if (!analysisData.value?.file_analysis?.files) return "0 B";
  const compressedFiles = analysisData.value.file_analysis.files.filter(
    (file: any) => file.attributes?.is_compressed && file.compressed_size && file.size
  );
  const totalSavings = compressedFiles.reduce(
    (acc: number, file: any) =>
      acc +
      ((file.size?.bytes || file.size || 0) -
        (file.compressed_size?.bytes || file.compressed_size || 0)),
    0
  );
  return formatBytes(totalSavings);
};

const getSpecialFilesCount = (): number => {
  if (!analysisData.value?.file_analysis?.files) return 0;
  return analysisData.value.file_analysis.files.filter(
    (file: any) =>
      file.attributes?.is_sparse || file.attributes?.is_reparse_point || file.attributes?.has_ads
  ).length;
};
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
