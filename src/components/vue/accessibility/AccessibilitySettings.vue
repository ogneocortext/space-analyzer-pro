<template>
  <div :class="['accessibility-settings', className]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
          <Eye class="w-5 h-5" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-white">Accessibility Settings</h2>
          <p class="text-sm text-slate-400">Customize your viewing experience</p>
        </div>
      </div>
      <button
        v-if="onBack"
        @click="onBack"
        class="text-slate-400 hover:text-white transition-colors focus-enhanced"
        aria-label="Go back to previous page"
      >
        <X class="w-5 h-5" />
      </button>
    </div>

    <!-- Settings Categories -->
    <div class="space-y-6">
      <div
        v-for="category in settingsCategories"
        :key="category.title"
        class="content-section polished-card"
      >
        <div class="flex items-center gap-3 mb-4">
          <component :is="category.icon" class="w-5 h-5 text-blue-400" />
          <h3 class="content-section-title">{{ category.title }}</h3>
        </div>

        <div class="space-y-3">
          <div
            v-for="setting in category.settings"
            :key="setting.key"
            class="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <div class="flex items-center gap-3">
              <component :is="setting.icon" class="w-4 h-4 text-slate-400" />
              <div>
                <div class="font-medium text-white">{{ setting.label }}</div>
                <div class="text-xs text-slate-400">
                  {{ getSettingDescription(setting.key) }}
                </div>
              </div>
            </div>

            <button
              @click="toggleSetting(setting.key)"
              :class="[
                'relative w-12 h-6 rounded-full transition-colors focus-enhanced',
                settings[setting.key] ? 'bg-blue-600' : 'bg-slate-600'
              ]"
              role="switch"
              :aria-checked="settings[setting.key] ? 'true' : 'false'"
              :aria-label="`Toggle ${setting.label}`"
            >
              <div
                :class="[
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  settings[setting.key] ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
              <Check v-if="settings[setting.key]" class="absolute top-1 right-1 w-2 h-2 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="mt-6 p-4 bg-slate-800/50 rounded-lg">
      <h4 class="font-medium text-white mb-3">Quick Actions</h4>
      <div class="flex flex-wrap gap-2">
        <button
          @click="resetSettings"
          class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors focus-enhanced"
        >
          Reset to Defaults
        </button>
        <button
          @click="applyVisualPreset"
          class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors focus-enhanced"
        >
          Visual Preset
        </button>
        <button
          @click="applyMotorPreset"
          class="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors focus-enhanced"
        >
          Motor Preset
        </button>
      </div>
    </div>

    <!-- Info Section -->
    <div class="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
      <div class="flex items-start gap-3">
        <Eye class="w-5 h-5 text-blue-400 mt-1 shrink-0" />
        <div>
          <h4 class="font-semibold text-white mb-1">Accessibility Information</h4>
          <p class="text-sm text-slate-300 mb-2">
            These settings help customize Space Analyzer for different accessibility needs.
            Changes are saved automatically and will persist across sessions.
          </p>
          <div class="text-xs text-slate-400">
            <p>• Settings are stored locally in your browser</p>
            <p>• Some changes may require a page refresh to take full effect</p>
            <p>• Keyboard shortcuts: Tab to navigate, Enter to toggle</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import {
  Eye,
  EyeOff,
  Type,
  Palette,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  MousePointer,
  Keyboard,
  Zap,
  Check,
  X,
} from 'lucide-vue-next';

interface AccessibilitySettingsProps {
  onBack?: () => void;
  className?: string;
}

const props = withDefaults(defineProps<AccessibilitySettingsProps>(), {
  className: '',
});

const settings = ref({
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  screenReader: false,
  keyboardNavigation: true,
  focusVisible: true,
  darkMode: true,
  soundEffects: false,
  visualIndicators: true,
  tooltipsEnabled: true,
});

const defaultSettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  screenReader: false,
  keyboardNavigation: true,
  focusVisible: true,
  darkMode: true,
  soundEffects: false,
  visualIndicators: true,
  tooltipsEnabled: true,
};

const settingsCategories = [
  {
    title: 'Visual',
    icon: Eye,
    settings: [
      { key: 'highContrast' as keyof typeof settings.value, label: 'High Contrast', icon: Palette },
      { key: 'largeText' as keyof typeof settings.value, label: 'Large Text', icon: Type },
      { key: 'darkMode' as keyof typeof settings.value, label: 'Dark Mode', icon: Moon },
      {
        key: 'visualIndicators' as keyof typeof settings.value,
        label: 'Visual Indicators',
        icon: Monitor,
      },
    ],
  },
  {
    title: 'Interaction',
    icon: MousePointer,
    settings: [
      { key: 'reducedMotion' as keyof typeof settings.value, label: 'Reduced Motion', icon: Zap },
      {
        key: 'keyboardNavigation' as keyof typeof settings.value,
        label: 'Keyboard Navigation',
        icon: Keyboard,
      },
      { key: 'focusVisible' as keyof typeof settings.value, label: 'Focus Indicators', icon: Eye },
      { key: 'tooltipsEnabled' as keyof typeof settings.value, label: 'Tooltips', icon: EyeOff },
    ],
  },
  {
    title: 'Assistive',
    icon: Volume2,
    settings: [
      {
        key: 'screenReader' as keyof typeof settings.value,
        label: 'Screen Reader Mode',
        icon: Volume2,
      },
      { key: 'soundEffects' as keyof typeof settings.value, label: 'Sound Effects', icon: VolumeX },
    ],
  },
];

const getSettingDescription = (key: string) => {
  const descriptions: Record<string, string> = {
    highContrast: 'Increase contrast for better visibility',
    largeText: 'Increase font size for readability',
    darkMode: 'Switch between light and dark themes',
    visualIndicators: 'Show visual feedback for actions',
    reducedMotion: 'Minimize animations and transitions',
    keyboardNavigation: 'Enable keyboard shortcuts',
    focusVisible: 'Show focus indicators',
    tooltipsEnabled: 'Display helpful tooltips',
    screenReader: 'Optimize for screen readers',
    soundEffects: 'Enable audio feedback',
  };
  return descriptions[key] || '';
};

const toggleSetting = (key: keyof typeof settings.value) => {
  settings.value[key] = !settings.value[key];
};

const resetSettings = () => {
  settings.value = { ...defaultSettings };
};

const applyVisualPreset = () => {
  settings.value = {
    ...settings.value,
    highContrast: true,
    largeText: true,
    visualIndicators: true,
    focusVisible: true,
  };
};

const applyMotorPreset = () => {
  settings.value = {
    ...settings.value,
    reducedMotion: true,
    keyboardNavigation: true,
    focusVisible: true,
    tooltipsEnabled: true,
  };
};

const applySettingsToDocument = () => {
  const root = document.documentElement;

  // High contrast
  if (settings.value.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }

  // Reduced motion
  if (settings.value.reducedMotion) {
    root.classList.add('reduced-motion');
  } else {
    root.classList.remove('reduced-motion');
  }

  // Large text
  if (settings.value.largeText) {
    root.classList.add('large-text');
  } else {
    root.classList.remove('large-text');
  }

  // Dark mode
  if (settings.value.darkMode) {
    root.classList.add('dark-mode');
  } else {
    root.classList.remove('dark-mode');
  }

  // Focus visible
  if (settings.value.focusVisible) {
    root.classList.add('focus-visible-enabled');
  } else {
    root.classList.remove('focus-visible-enabled');
  }
};

onMounted(() => {
  const savedSettings = localStorage.getItem('accessibility-settings');
  if (savedSettings) {
    try {
      settings.value = JSON.parse(savedSettings);
    } catch (error) {
      console.error('Failed to load accessibility settings:', error);
    }
  }
  applySettingsToDocument();
});

watch(
  settings,
  (newSettings) => {
    localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
    applySettingsToDocument();
  },
  { deep: true }
);
</script>

<style scoped>
.accessibility-settings {
  @apply p-6;
}

.content-section {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-4;
}

.polished-card {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-4;
}

.content-section-title {
  @apply text-lg font-semibold text-white;
}

.focus-enhanced {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900;
}
</style>
