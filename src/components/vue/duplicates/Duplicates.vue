<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2 flex items-center gap-3">
        <Copy class="w-8 h-8 text-orange-400" />
        Duplicate File Detection
      </h1>
      <p class="text-slate-400 text-lg">
        Identify and manage duplicate files to reclaim storage space
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Copy class="w-6 h-6 text-orange-400" />
          <h3 class="text-lg font-semibold text-white">Total Duplicates</h3>
        </div>
        <div class="text-3xl font-bold text-orange-400 mb-2">47</div>
        <p class="text-slate-400 text-sm">Duplicate file groups found</p>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <HardDrive class="w-6 h-6 text-red-400" />
          <h3 class="text-lg font-semibold text-white">Space Wasted</h3>
        </div>
        <div class="text-3xl font-bold text-red-400 mb-2">8.7 GB</div>
        <p class="text-slate-400 text-sm">Storage space recoverable</p>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <CheckCircle class="w-6 h-6 text-green-400" />
          <h3 class="text-lg font-semibold text-white">Auto-cleanable</h3>
        </div>
        <div class="text-3xl font-bold text-green-400 mb-2">32</div>
        <p class="text-slate-400 text-sm">Safe to auto-remove</p>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <AlertTriangle class="w-6 h-6 text-yellow-400" />
          <h3 class="text-lg font-semibold text-white">Needs Review</h3>
        </div>
        <div class="text-3xl font-bold text-yellow-400 mb-2">15</div>
        <p class="text-slate-400 text-sm">Requires manual review</p>
      </div>
    </div>

    <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold text-white mb-4">Largest Duplicate Groups</h2>
      <div class="space-y-4">
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-white font-medium">Video Files (15 duplicates)</h4>
            <span class="text-red-400 font-medium">6.2 GB wasted</span>
          </div>
          <div class="space-y-2 text-sm text-slate-300">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>vacation_video_2023.mp4 (3 copies)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>wedding_ceremony.mp4 (2 copies)</span>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">
              Review All
            </button>
            <button class="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded">
              Auto Clean
            </button>
          </div>
        </div>

        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-white font-medium">Document Files (8 duplicates)</h4>
            <span class="text-orange-400 font-medium">1.8 GB wasted</span>
          </div>
          <div class="space-y-2 text-sm text-slate-300">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>project_proposal_v1.pdf (4 copies)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span>annual_report_2023.docx (3 copies)</span>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">
              Review All
            </button>
            <button class="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded">
              Auto Clean
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-white mb-4">Actions</h2>
      <div class="flex gap-4">
        <button class="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
          <Trash2 class="w-5 h-5" />
          <span>Delete All Duplicates</span>
        </button>
        <button class="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Copy class="w-5 h-5" />
          <span>Export Report</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Copy, Trash2, CheckCircle, AlertTriangle, HardDrive } from 'lucide-vue-next';

interface DuplicatesProps {
  analysisData?: any;
}

defineProps<DuplicatesProps>();
</script>
