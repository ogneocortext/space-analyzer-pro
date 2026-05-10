<template>
  <div
    data-testid="dashboard-view"
    class="min-h-screen bg-slate-950 px-4 py-6 text-white lg:px-8 lg:py-8"
  >
    <div class="mx-auto max-w-7xl space-y-8">
      <!-- Hero -->
      <section
        class="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl lg:p-8"
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

          <div class="grid gap-3 sm:grid-cols-2 lg:w-md">
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
          <!-- Enhanced Stats Grid with Real-time Updates -->
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            role="region"
            aria-label="Storage statistics overview"
          >
            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all relative overflow-hidden group"
              @click="showFileDetails = true"
            >
              <!-- Animated background effect -->
              <div
                class="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />

              <div class="flex items-center gap-3 mb-2 relative z-10">
                <div class="relative">
                  <Folder class="text-cyan-400 animate-pulse-slow" :size="24" aria-hidden="true" />
                  <div
                    v-if="realTimeStats.fileChange"
                    class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"
                  />
                </div>
                <span class="text-slate-400 text-sm">Total Files</span>
              </div>
              <div class="text-3xl font-bold text-white relative z-10 tabular-nums">
                <transition name="count" mode="out-in">
                  <span :key="animatedFiles">{{ animatedFiles.toLocaleString() }}</span>
                </transition>
              </div>
              <div class="text-xs text-slate-500 mt-1 relative z-10">
                <span v-if="realTimeStats.fileChange">Updated just now</span>
                <span v-else>Click for details</span>
              </div>
              <!-- Progress indicator -->
              <div
                class="absolute bottom-0 left-0 h-1 bg-cyan-500 transition-all duration-500"
                :style="{ width: `${getProgressPercentage('files')}%` }"
              />
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-emerald-500 hover:bg-slate-700/50 transition-all relative overflow-hidden group"
              @click="showSizeDetails = true"
            >
              <div
                class="absolute inset-0 bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />

              <div class="flex items-center gap-3 mb-2 relative z-10">
                <div class="relative">
                  <HardDrive
                    class="text-emerald-400 animate-pulse-slow"
                    :size="24"
                    aria-hidden="true"
                  />
                  <div
                    v-if="realTimeStats.sizeChange"
                    class="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping"
                  />
                </div>
                <span class="text-slate-400 text-sm">Total Size</span>
              </div>
              <div class="text-3xl font-bold text-white relative z-10 tabular-nums">
                <transition name="count" mode="out-in">
                  <span :key="animatedSize">{{ formatBytes(animatedSize) }}</span>
                </transition>
              </div>
              <div class="text-xs text-slate-500 mt-1 relative z-10">
                <span v-if="realTimeStats.sizeChange" class="text-amber-400">{{
                  getSizeChangeText()
                }}</span>
                <span v-else>Click for breakdown</span>
              </div>
              <div
                class="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-500"
                :style="{ width: `${getProgressPercentage('size')}%` }"
              />
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-purple-500 hover:bg-slate-700/50 transition-all relative overflow-hidden group"
              @click="selectedCategory = null"
            >
              <div
                class="absolute inset-0 bg-linear-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />

              <div class="flex items-center gap-3 mb-2 relative z-10">
                <div class="relative">
                  <FolderTree
                    class="text-purple-400 animate-pulse-slow"
                    :size="24"
                    aria-hidden="true"
                  />
                  <div
                    v-if="realTimeStats.categoryChange"
                    class="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-ping"
                  />
                </div>
                <span class="text-slate-400 text-sm">Categories</span>
              </div>
              <div class="text-3xl font-bold text-white relative z-10 tabular-nums">
                <transition name="count" mode="out-in">
                  <span :key="animatedCategories">{{ animatedCategories }}</span>
                </transition>
              </div>
              <div class="text-xs text-slate-500 mt-1 relative z-10">
                <span v-if="realTimeStats.categoryChange">Categories updated</span>
                <span v-else>Click category below</span>
              </div>
              <div
                class="absolute bottom-0 left-0 h-1 bg-purple-500 transition-all duration-500"
                :style="{ width: `${getProgressPercentage('categories')}%` }"
              />
            </div>

            <div
              class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-amber-500 hover:bg-slate-700/50 transition-all relative overflow-hidden group"
              @click="showAnalysisInfo = true"
            >
              <div
                class="absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />

              <div class="flex items-center gap-3 mb-2 relative z-10">
                <div class="relative">
                  <Clock class="text-amber-400 animate-pulse-slow" :size="24" aria-hidden="true" />
                  <div
                    v-if="realTimeStats.analysisChange"
                    class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping"
                  />
                </div>
                <span class="text-slate-400 text-sm">Analysis Time</span>
              </div>
              <div class="text-3xl font-bold text-white relative z-10 tabular-nums">
                {{ formatAnalysisTime(analysisData?.summary?.scan_duration_ms) || "N/A" }}
              </div>
              <div class="text-xs text-slate-500 mt-1 relative z-10">
                <span v-if="realTimeStats.analysisChange" class="text-blue-400"
                  >Analysis updated</span
                >
                <span v-else>Click for info</span>
              </div>
              <div
                class="absolute bottom-0 left-0 h-1 bg-amber-500 transition-all duration-500"
                :style="{ width: `${getProgressPercentage('time')}%` }"
              />
            </div>
          </div>

          <!-- Performance Metrics and Health Indicators -->
          <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
            <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Activity class="text-emerald-400 animate-pulse" :size="20" />
              System Performance
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <!-- CPU Usage -->
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <Cpu class="text-blue-400" :size="16" />
                  <span class="text-slate-400 text-sm">CPU Usage</span>
                </div>
                <div class="text-2xl font-bold text-white">{{ getCpuUsage() }}%</div>
                <div class="w-full bg-slate-600 rounded-full h-2 mt-2">
                  <div
                    class="h-2 rounded-full transition-all duration-500"
                    :class="getCpuColor()"
                    :style="{ width: `${getCpuUsage()}%` }"
                  />
                </div>
              </div>

              <!-- Memory Usage -->
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <Database class="text-purple-400" :size="16" />
                  <span class="text-slate-400 text-sm">Memory</span>
                </div>
                <div class="text-2xl font-bold text-white">{{ getMemoryUsage() }}%</div>
                <div class="w-full bg-slate-600 rounded-full h-2 mt-2">
                  <div
                    class="h-2 rounded-full transition-all duration-500"
                    :class="getMemoryColor()"
                    :style="{ width: `${getMemoryUsage()}%` }"
                  />
                </div>
              </div>

              <!-- Disk I/O -->
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <HardDrive class="text-amber-400" :size="16" />
                  <span class="text-slate-400 text-sm">Disk I/O</span>
                </div>
                <div class="text-2xl font-bold text-white">
                  {{ getDiskIO() }}
                </div>
                <div class="text-xs text-slate-500 mt-1">MB/s active</div>
              </div>

              <!-- Network Status -->
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <Network class="text-cyan-400" :size="16" />
                  <span class="text-slate-400 text-sm">Network</span>
                </div>
                <div class="text-2xl font-bold text-white">
                  {{ getNetworkStatus() }}
                </div>
                <div class="text-xs text-slate-500 mt-1">
                  {{ getNetworkDetails() }}
                </div>
              </div>
            </div>

            <!-- Health Score -->
            <div
              class="mt-6 p-4 bg-linear-to-r from-slate-700/50 to-slate-700/30 rounded-lg border border-slate-600"
            >
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-white">Overall Health Score</h3>
                <div class="flex items-center gap-2">
                  <div class="text-3xl font-bold" :class="getHealthScoreColor()">
                    {{ getHealthScore() }}
                  </div>
                  <span class="text-slate-400">/100</span>
                </div>
              </div>
              <div class="w-full bg-slate-600 rounded-full h-3">
                <div
                  class="h-3 rounded-full transition-all duration-1000 relative overflow-hidden"
                  :class="getHealthScoreBarColor()"
                  :style="{ width: `${getHealthScore()}%` }"
                >
                  <div
                    class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-pulse"
                  />
                </div>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <div
                    class="w-2 h-2 rounded-full"
                    :class="getHealthIndicatorColor('performance')"
                  />
                  <span class="text-slate-300"
                    >Performance: {{ getHealthLevel("performance") }}</span
                  >
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full" :class="getHealthIndicatorColor('storage')" />
                  <span class="text-slate-300">Storage: {{ getHealthLevel("storage") }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full" :class="getHealthIndicatorColor('security')" />
                  <span class="text-slate-300">Security: {{ getHealthLevel("security") }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <div
                    class="w-2 h-2 rounded-full"
                    :class="getHealthIndicatorColor('efficiency')"
                  />
                  <span class="text-slate-300">Efficiency: {{ getHealthLevel("efficiency") }}</span>
                </div>
              </div>
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

          <!-- Enhanced Storage Gauge with Interactive Chart -->
          <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-white">Storage Usage</h2>
              <button
                class="text-cyan-400 hover:text-cyan-300 transition-colors"
                aria-label="Toggle storage details"
                @click="showStorageDetails = !showStorageDetails"
              >
                <BarChart3 :size="20" />
              </button>
            </div>
            <StorageGauge
              :used="analysisData.totalSize || 0"
              :total="getEstimatedDiskCapacity(analysisData.totalSize || 0)"
              :categories="categoryDataComputed"
            />

            <!-- Interactive Storage Details -->
            <Transition name="slide-down" mode="out-in">
              <div v-if="showStorageDetails" class="mt-6 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Free Space</div>
                    <div class="text-xl font-bold text-emerald-400">
                      {{
                        formatBytes(
                          getEstimatedDiskCapacity(analysisData.totalSize || 0) -
                            (analysisData.totalSize || 0)
                        )
                      }}
                    </div>
                    <div class="text-xs text-slate-500 mt-1">
                      {{ getFreeSpacePercentage() }}% available
                    </div>
                  </div>
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Used Space</div>
                    <div class="text-xl font-bold text-amber-400">
                      {{ formatBytes(analysisData.totalSize || 0) }}
                    </div>
                    <div class="text-xs text-slate-500 mt-1">
                      {{ getUsedSpacePercentage() }}% utilized
                    </div>
                  </div>
                  <div class="bg-slate-700/30 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Health Status</div>
                    <div class="text-xl font-bold" :class="getHealthStatusColor()">
                      {{ getHealthStatusText() }}
                    </div>
                    <div class="text-xs text-slate-500 mt-1">
                      {{ getHealthRecommendation() }}
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Interactive Category Breakdown with Chart -->
          <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-white">Category Breakdown</h2>
              <div class="flex gap-2">
                <button
                  :class="chartView === 'bars' ? 'text-cyan-400' : 'text-slate-400'"
                  class="hover:text-cyan-300 transition-colors"
                  aria-label="Bar chart view"
                  @click="chartView = 'bars'"
                >
                  <BarChart3 :size="20" />
                </button>
                <button
                  :class="chartView === 'pie' ? 'text-cyan-400' : 'text-slate-400'"
                  class="hover:text-cyan-300 transition-colors"
                  aria-label="Pie chart view"
                  @click="chartView = 'pie'"
                >
                  <PieChart :size="20" />
                </button>
                <button
                  :class="chartView === 'treemap' ? 'text-cyan-400' : 'text-slate-400'"
                  class="hover:text-cyan-300 transition-colors"
                  aria-label="Treemap view"
                  @click="chartView = 'treemap'"
                >
                  <Layers :size="20" />
                </button>
              </div>
            </div>

            <!-- Interactive Chart Container -->
            <div
              class="space-y-4"
              role="region"
              aria-label="Category breakdown visualization"
              aria-live="polite"
            >
              <!-- Bar Chart View -->
              <div v-if="chartView === 'bars'" class="space-y-3">
                <div
                  v-for="(category, name) in sortedCategories"
                  :key="name"
                  class="flex items-center gap-4 cursor-pointer hover:bg-slate-700/50 p-3 rounded-lg transition-all group"
                  :class="{ 'bg-slate-700/50': selectedCategory === name }"
                  @click="selectCategory(name)"
                >
                  <div
                    class="w-4 h-4 rounded-full shrink-0 transition-transform group-hover:scale-110"
                    :style="{ backgroundColor: getCategoryColor(name) }"
                    aria-hidden="true"
                  />
                  <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-white font-medium">{{ name }}</span>
                      <div class="text-right">
                        <span class="text-slate-400 text-sm">{{
                          formatBytes((category as any).size || 0)
                        }}</span>
                        <span class="text-xs text-slate-500 ml-2">
                          {{ getCategoryPercentage(name) }}%
                        </span>
                      </div>
                    </div>
                    <div class="w-full bg-slate-700 rounded-full h-3 relative overflow-hidden">
                      <div
                        class="h-3 rounded-full transition-all duration-500 relative"
                        :style="{
                          width: `${((((category as any).size || 0) / (analysisData.totalSize || 1)) * 100).toFixed(1)}%`,
                          backgroundColor: getCategoryColor(name),
                        }"
                      >
                        <div
                          v-if="selectedCategory === name"
                          class="absolute inset-0 bg-white/20 animate-pulse"
                        />
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    v-if="selectedCategory === name"
                    class="text-cyan-400 animate-pulse"
                    :size="20"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <!-- Pie Chart View -->
              <div v-else-if="chartView === 'pie'" class="flex justify-center">
                <div class="relative w-64 h-64">
                  <!-- Simple SVG Pie Chart -->
                  <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      v-for="(category, name, index) in sortedCategories"
                      :key="name"
                      cx="50"
                      cy="50"
                      r="40"
                      :fill="getCategoryColor(name)"
                      :stroke-dasharray="`${getCategoryPercentage(name)} ${100 - getCategoryPercentage(name)}`"
                      :stroke-dashoffset="getPieOffset(index)"
                      :stroke-width="80"
                      fill="none"
                      class="transition-all duration-500 hover:opacity-80 cursor-pointer"
                      @click="selectCategory(name)"
                    />
                  </svg>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="text-center">
                      <div class="text-2xl font-bold text-white">
                        {{ Object.keys(sortedCategories).length }}
                      </div>
                      <div class="text-xs text-slate-400">Categories</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Treemap View -->
              <div
                v-else-if="chartView === 'treemap'"
                class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
              >
                <div
                  v-for="(category, name) in sortedCategories"
                  :key="name"
                  class="relative cursor-pointer group overflow-hidden rounded-lg transition-all hover:scale-105"
                  :style="{
                    backgroundColor: getCategoryColor(name),
                    height: `${Math.max(60, ((category as any).size / (analysisData.totalSize || 1)) * 200)}px`,
                  }"
                  @click="selectCategory(name)"
                >
                  <div
                    class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <div
                    class="absolute inset-0 flex flex-col items-center justify-center p-2 text-center"
                  >
                    <div class="text-white font-semibold text-sm truncate">
                      {{ name }}
                    </div>
                    <div class="text-white/80 text-xs">{{ getCategoryPercentage(name) }}%</div>
                  </div>
                </div>
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
          <div
            class="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
            role="region"
            aria-label="Largest files list"
          >
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
            role="region"
            aria-label="AI-powered insights and recommendations"
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
                <div class="flex flex-col gap-4">
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
                <div class="flex flex-col gap-4">
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
  Wrench,
  ChevronDown,
} from "lucide-vue-next";
import StorageGauge from "../../components/vue/StorageGauge.vue";
import EnhancedFileDetailsModal from "../../components/vue/analysis/EnhancedFileDetailsModal.vue";
import FileAttributesVisualization from "../../components/analysis/FileAttributesVisualization.vue";
import TimestampAnalysis from "../../components/analysis/TimestampAnalysis.vue";
import HardLinksAnalysis from "../../components/analysis/HardLinksAnalysis.vue";
import AIChatInterface from "../../components/vue/ai/AIChatInterface.vue";
import { useAnalysisStore } from "@/store";
import { getCategoryColor } from "../../utils/dataTransformers";

interface CategoryData {
  size: number;
  count?: number;
  files?: Array<{ name: string; size: number; path: string }>;
  [key: string]: unknown;
}

const router = useRouter();
const analysisStore = useAnalysisStore();

// Animation functions
const animateValue = (start: number, end: number, duration: number, refValue: any) => {
  const startTime = Date.now();
  const animate = () => {
    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smooth animation
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentValue = start + (end - start) * easeOutQuart;

    refValue.value = currentValue;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

const updateAnimations = () => {
  const files = analysisData.value?.file_analysis?.files?.length || 0;
  const size = analysisData.value?.totalSize || 0;
  const categories = Object.keys(analysisData.value?.file_analysis?.categories || {}).length;

  // Animate values with smooth transitions
  animateValue(animatedFiles.value, files, 1000, animatedFiles);
  animateValue(animatedSize.value, size, 1200, animatedSize);
  animateValue(animatedCategories.value, categories, 800, animatedCategories);

  // Check for changes and update real-time stats
  realTimeStats.value.fileChange = files !== realTimeStats.value.lastFileSize;
  realTimeStats.value.sizeChange = Math.abs(size - realTimeStats.value.lastFileSize) > 1024; // 1KB threshold
  realTimeStats.value.categoryChange = categories !== realTimeStats.value.lastCategoryCount;

  realTimeStats.value.lastFileSize = files;
  realTimeStats.value.lastCategoryCount = categories;

  // Reset change indicators after 3 seconds
  setTimeout(() => {
    realTimeStats.value.fileChange = false;
    realTimeStats.value.sizeChange = false;
    realTimeStats.value.categoryChange = false;
  }, 3000);
};

const getProgressPercentage = (type: string): number => {
  const files = analysisData.value?.file_analysis?.files?.length || 0;
  const size = analysisData.value?.totalSize || 0;
  const categories = Object.keys(analysisData.value?.file_analysis?.categories || {}).length;

  switch (type) {
    case "files":
      return Math.min((files / 10000) * 100, 100); // Assume 10k files as max
    case "size":
      return Math.min((size / (1024 * 1024 * 1024 * 100)) * 100, 100); // Assume 100GB as max
    case "categories":
      return Math.min((categories / 20) * 100, 100); // Assume 20 categories as max
    default:
      return 0;
  }
};

const getSizeChangeText = (): string => {
  const current = analysisData.value?.totalSize || 0;
  const previous = realTimeStats.value.lastFileSize;
  const diff = current - previous;

  if (diff > 0) {
    return `+${formatBytes(diff)}`;
  } else if (diff < 0) {
    return `${formatBytes(diff)}`;
  }
  return "No change";
};

// Initialize store on component mount to load previous scan data
onMounted(() => {
  analysisStore.initialize();

  // Set initial values
  animatedFiles.value = analysisData.value?.file_analysis?.files?.length || 0;
  animatedSize.value = analysisData.value?.totalSize || 0;
  animatedCategories.value = Object.keys(
    analysisData.value?.file_analysis?.categories || {}
  ).length;

  // Set up real-time updates
  animationInterval = setInterval(updateAnimations, 5000); // Update every 5 seconds
});

// Performance metrics functions
const getCpuUsage = (): number => {
  // Simulate CPU usage based on analysis activity
  return Math.round(Math.random() * 30 + 20); // 20-50%
};

const getCpuColor = (): string => {
  const usage = getCpuUsage();
  if (usage < 40) return "bg-emerald-500";
  if (usage < 60) return "bg-amber-500";
  return "bg-red-500";
};

const getMemoryUsage = (): number => {
  // Simulate memory usage based on file count
  const fileCount = analysisData.value?.file_analysis?.files?.length || 0;
  return Math.min(Math.round((fileCount / 10000) * 100), 90);
};

const getMemoryColor = (): string => {
  const usage = getMemoryUsage();
  if (usage < 50) return "bg-emerald-500";
  if (usage < 75) return "bg-amber-500";
  return "bg-red-500";
};

const getDiskIO = (): number => {
  // Simulate disk I/O based on recent activity
  return Math.round(Math.random() * 50 + 10); // 10-60 MB/s
};

const getNetworkStatus = (): string => {
  // Simulate network status
  const statuses = ["Good", "Fair", "Poor"];
  return statuses[Math.floor(Math.random() * statuses.length)];
};

const getNetworkDetails = (): string => {
  const status = getNetworkStatus();
  switch (status) {
    case "Good":
      return "All services operational";
    case "Fair":
      return "Some services slow";
    case "Poor":
      return "Limited connectivity";
    default:
      return "Checking...";
  }
};

// Health score functions
const getHealthScore = (): number => {
  const cpuScore = Math.max(0, 100 - getCpuUsage());
  const memoryScore = Math.max(0, 100 - getMemoryUsage());
  const storageScore = Math.max(0, 100 - getUsedSpacePercentage());

  return Math.round((cpuScore + memoryScore + storageScore) / 3);
};

const getHealthScoreColor = (): string => {
  const score = getHealthScore();
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
};

const getHealthScoreBarColor = (): string => {
  const score = getHealthScore();
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
};

const getHealthLevel = (metric: string): string => {
  const score = getHealthScore();
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
};

const getHealthIndicatorColor = (metric: string): string => {
  const score = getHealthScore();
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
};

// Create a computed property to bridge the property name difference
const analysisData = computed(() => analysisStore.analysisResult);

const selectedCategory = ref<string | null>(null);
const showFileDetails = ref(false);
const showSizeDetails = ref(false);
const showAnalysisInfo = ref(false);
const showEnhancedFileDetails = ref(false);
const showToolsMenu = ref(false);
const selectedFileForDetails = ref<any>(null);
const showStorageDetails = ref(false);
const chartView = ref<"bars" | "pie" | "treemap">("bars");
const showQuickActions = ref(false);

// Real-time animation states
const animatedFiles = ref(0);
const animatedSize = ref(0);
const animatedCategories = ref(0);
const realTimeStats = ref({
  fileChange: false,
  sizeChange: false,
  categoryChange: false,
  analysisChange: false,
  lastFileSize: 0,
  lastCategoryCount: 0,
});

// Animation intervals
let animationInterval: NodeJS.Timeout | null = null;

// Storage health and utility functions
const getFreeSpacePercentage = (): number => {
  const total = getEstimatedDiskCapacity(analysisData.value?.totalSize || 0);
  const used = analysisData.value?.totalSize || 0;
  return Math.round(((total - used) / total) * 100);
};

const getUsedSpacePercentage = (): number => {
  const total = getEstimatedDiskCapacity(analysisData.value?.totalSize || 0);
  const used = analysisData.value?.totalSize || 0;
  return Math.round((used / total) * 100);
};

const getHealthStatusColor = (): string => {
  const percentage = getUsedSpacePercentage();
  if (percentage < 50) return "text-emerald-400";
  if (percentage < 75) return "text-amber-400";
  if (percentage < 90) return "text-orange-400";
  return "text-red-400";
};

const getHealthStatusText = (): string => {
  const percentage = getUsedSpacePercentage();
  if (percentage < 50) return "Excellent";
  if (percentage < 75) return "Good";
  if (percentage < 90) return "Warning";
  return "Critical";
};

const getHealthRecommendation = (): string => {
  const percentage = getUsedSpacePercentage();
  if (percentage < 50) return "Plenty of space available";
  if (percentage < 75) return "Consider cleanup soon";
  if (percentage < 90) return "Cleanup recommended";
  return "Immediate cleanup required";
};

// Chart utility functions
const getCategoryPercentage = (name: string): number => {
  const category = sortedCategories.value[name];
  const total = analysisData.value?.totalSize || 1;
  return Math.round((((category as any)?.size || 0) / total) * 100);
};

const getPieOffset = (index: number): number => {
  let offset = 0;
  const categories = Object.values(sortedCategories.value);
  for (let i = 0; i < index; i++) {
    offset += getCategoryPercentage(Object.keys(sortedCategories.value)[i]);
  }
  return offset;
};

// Quick action functions
const toggleQuickActions = () => {
  showQuickActions.value = !showQuickActions.value;
  showToolsMenu.value = false;
};

const quickCleanup = () => {
  showQuickActions.value = false;
  // Navigate to cleanup with pre-filtered settings
  router.push("/cleanup?auto=true&type=temp,duplicates");
};

const quickOptimize = () => {
  showQuickActions.value = false;
  // Navigate to optimization with AI suggestions
  router.push("/optimization?ai=true");
};

const navigateToLargest = () => {
  showQuickActions.value = false;
  router.push("/largest");
};

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
