<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2 flex items-center gap-3">
        <Code class="w-8 h-8 text-indigo-400" />
        Development Analysis
      </h1>
      <p class="text-slate-400 text-lg">
        Code-specific analysis and tools for development projects
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Code class="w-6 h-6 text-indigo-400" />
          <h3 class="text-lg font-semibold text-white">Code Files</h3>
        </div>
        <div class="text-3xl font-bold text-indigo-400 mb-2">1,247</div>
        <p class="text-slate-400 text-sm">Source code files detected</p>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <GitBranch class="w-6 h-6 text-green-400" />
          <h3 class="text-lg font-semibold text-white">Languages</h3>
        </div>
        <div class="text-3xl font-bold text-green-400 mb-2">8</div>
        <p class="text-slate-400 text-sm">Programming languages</p>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Bug class="w-6 h-6 text-red-400" />
          <h3 class="text-lg font-semibold text-white">Issues</h3>
        </div>
        <div class="text-3xl font-bold text-red-400 mb-2">23</div>
        <p class="text-slate-400 text-sm">Code quality issues</p>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Cpu class="w-6 h-6 text-blue-400" />
          <h3 class="text-lg font-semibold text-white">Complexity</h3>
        </div>
        <div class="text-2xl font-bold text-blue-400 mb-2">Medium</div>
        <p class="text-slate-400 text-sm">Average code complexity</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <FileText class="w-5 h-5 text-indigo-400" />
          Language Breakdown
        </h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 bg-blue-400 rounded-full" />
              <span class="text-white">TypeScript</span>
            </div>
            <span class="text-blue-400 font-medium">45.2%</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 bg-green-400 rounded-full" />
              <span class="text-white">Python</span>
            </div>
            <span class="text-green-400 font-medium">28.7%</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 bg-purple-400 rounded-full" />
              <span class="text-white">JavaScript</span>
            </div>
            <span class="text-purple-400 font-medium">15.6%</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 bg-orange-400 rounded-full" />
              <span class="text-white">Other</span>
            </div>
            <span class="text-orange-400 font-medium">10.5%</span>
          </div>
        </div>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Terminal class="w-5 h-5 text-green-400" />
          Code Quality Metrics
        </h2>
        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-2">
              <span class="text-slate-300">Test Coverage</span>
              <span class="text-green-400">78%</span>
            </div>
            <div class="w-full bg-slate-700 rounded-full h-2">
              <div class="bg-green-400 h-2 rounded-full" style="width: 78%" />
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-2">
              <span class="text-slate-300">Documentation</span>
              <span class="text-blue-400">65%</span>
            </div>
            <div class="w-full bg-slate-700 rounded-full h-2">
              <div class="bg-blue-400 h-2 rounded-full" style="width: 65%" />
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-2">
              <span class="text-slate-300">Code Health</span>
              <span class="text-purple-400">82%</span>
            </div>
            <div class="w-full bg-slate-700 rounded-full h-2">
              <div class="bg-purple-400 h-2 rounded-full" style="width: 82%" />
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-2">
              <span class="text-slate-300">Security Score</span>
              <span class="text-orange-400">91%</span>
            </div>
            <div class="w-full bg-slate-700 rounded-full h-2">
              <div class="bg-orange-400 h-2 rounded-full" style="width: 91%" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-white mb-4">Development Insights</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <AlertTriangle class="w-5 h-5 text-red-400 mt-1 shrink-0" />
            <div>
              <h4 class="text-red-400 font-medium mb-1">High Complexity Functions</h4>
              <p class="text-slate-300 text-sm">
                5 functions exceed recommended complexity limits. Consider refactoring.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <CheckCircle class="w-5 h-5 text-yellow-400 mt-1 shrink-0" />
            <div>
              <h4 class="text-yellow-400 font-medium mb-1">Missing Tests</h4>
              <p class="text-slate-300 text-sm">
                23 functions lack unit tests. Coverage could be improved to 85%.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <Code class="w-5 h-5 text-blue-400 mt-1 shrink-0" />
            <div>
              <h4 class="text-blue-400 font-medium mb-1">Code Duplication</h4>
              <p class="text-slate-300 text-sm">
                Found 8 duplicate code blocks. Consider extracting common functions.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <GitBranch class="w-5 h-5 text-green-400 mt-1 shrink-0" />
            <div>
              <h4 class="text-green-400 font-medium mb-1">Good Architecture</h4>
              <p class="text-slate-300 text-sm">
                Clean separation of concerns and modular design patterns detected.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <FileText class="w-5 h-5 text-purple-400 mt-1 shrink-0" />
            <div>
              <h4 class="text-purple-400 font-medium mb-1">Documentation Gaps</h4>
              <p class="text-slate-300 text-sm">
                12 public APIs lack proper documentation. Consider adding JSDoc comments.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <Terminal class="w-5 h-5 text-indigo-400 mt-1 shrink-0" />
            <div>
              <h4 class="text-indigo-400 font-medium mb-1">Performance Opportunities</h4>
              <p class="text-slate-300 text-sm">
                3 functions could benefit from optimization. Potential 40% speed improvement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Code, FileText, GitBranch, Terminal, Bug, CheckCircle, AlertTriangle, Cpu } from 'lucide-vue-next';

interface DevelopmentProps {
  analysisData?: any;
}

defineProps<DevelopmentProps>();
</script>
