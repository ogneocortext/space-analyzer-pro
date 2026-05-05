<script setup lang="ts">
import { ref } from "vue";
import { Card, Button } from "../../design-system/components";

const scanDepth = ref(10);
const includeHidden = ref(false);
const useAI = ref(true);
const theme = ref("dark");

function saveSettings() {
  localStorage.setItem(
    "settings",
    JSON.stringify({
      scanDepth: scanDepth.value,
      includeHidden: includeHidden.value,
      useAI: useAI.value,
      theme: theme.value,
    })
  );
  alert("Settings saved!");
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-slate-100">Settings</h1>

    <!-- Scan Settings -->
    <Card title="Scan Options">
      <form class="settings-form space-y-4">
        <div class="space-y-4">
          <div>
            <label for="scan-depth" class="block text-sm text-slate-300 mb-2"
              >Scan Depth (directory levels)</label
            >
            <input
              id="scan-depth"
              v-model="scanDepth"
              type="range"
              min="1"
              max="20"
              class="w-full"
              aria-describedby="scan-depth-value"
            />
            <input type="checkbox" class="toggle" v-model="includeHidden" style="display: none" />
            <p id="scan-depth-value" class="text-sm text-slate-400 mt-1">{{ scanDepth }} levels</p>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-slate-200">Include hidden files</span>
            <button
              :class="[
                'w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 toggle',
                includeHidden ? 'bg-blue-600' : 'bg-slate-500',
              ]"
              @click="includeHidden = !includeHidden"
              aria-label="Toggle include hidden files"
              role="switch"
              :aria-checked="includeHidden"
            >
              <span
                :class="[
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md border border-slate-300',
                  includeHidden ? 'translate-x-7' : 'translate-x-1',
                ]"
              />
            </button>
          </div>
        </div>
      </form>
    </Card>

    <!-- AI Settings -->
    <Card title="AI Features">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-slate-200">Enable AI Analysis</p>
          <p class="text-sm text-slate-400">Get insights and recommendations</p>
        </div>
        <button
          :class="[
            'w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
            useAI ? 'bg-blue-600' : 'bg-slate-500',
          ]"
          @click="useAI = !useAI"
          aria-label="Toggle AI analysis"
          role="switch"
          :aria-checked="useAI"
        >
          <span
            :class="[
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md border border-slate-300',
              useAI ? 'translate-x-7' : 'translate-x-1',
            ]"
          />
        </button>
      </div>
    </Card>

    <!-- Appearance -->
    <Card title="Appearance">
      <div class="flex gap-2">
        <button
          :class="[
            'px-4 py-2 rounded-lg transition-colors',
            theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300',
          ]"
          @click="theme = 'dark'"
        >
          Dark
        </button>
        <button
          :class="[
            'px-4 py-2 rounded-lg transition-colors',
            theme === 'light' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300',
          ]"
          @click="theme = 'light'"
        >
          Light
        </button>
      </div>
    </Card>

    <!-- Save -->
    <div class="flex justify-end">
      <Button variant="primary" data-action="save" type="submit" @click="saveSettings">
        Save Settings
      </Button>
    </div>
  </div>
</template>
