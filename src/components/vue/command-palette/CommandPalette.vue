<template>
  <Transition name="backdrop">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      @click="onClose"
    >
      <Transition name="modal">
        <div
          v-if="isOpen"
          ref="paletteRef"
          class="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center gap-3 p-4 border-b border-gray-700">
            <Search class="w-5 h-5 text-gray-400" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :placeholder="placeholder"
              class="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400"
              @keydown="handleKeyDown"
            />
            <div class="flex items-center gap-2 text-xs text-gray-400">
              <kbd class="px-2 py-1 bg-gray-700 rounded">ESC</kbd>
              <span>to close</span>
            </div>
          </div>

          <!-- Commands List -->
          <div class="max-h-96 overflow-y-auto p-2">
            <div v-if="filteredCommands.length === 0" class="text-center py-8 text-gray-400">
              <Search class="w-12 h-12 mx-auto mb-4" />
              <p>No commands found</p>
            </div>

            <div v-else>
              <div
                v-for="(commands, category) in groupedCommands"
                :key="category"
                class="mb-4"
              >
                <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {{ category }}
                </div>
                <div class="space-y-1">
                  <button
                    v-for="(command, index) in commands"
                    :key="command.id"
                    @click="executeCommand(command)"
                    :class="[
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                      getGlobalIndex(command) === selectedIndex
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-700 text-gray-300'
                    ]"
                  >
                    <component :is="command.icon" class="w-5 h-5 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="font-medium truncate">{{ command.title }}</p>
                      <p class="text-xs opacity-70 truncate">{{ command.description }}</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-gray-700 rounded">↑↓</kbd>
                <span>to navigate</span>
              </div>
              <div class="flex items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-gray-700 rounded">↵</kbd>
                <span>to select</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 bg-gray-700 rounded">Ctrl+K</kbd>
              <span>to open</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import {
  Search,
  Command,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  X,
  BrainCircuit,
  FolderSearch,
  BarChart3,
  Zap,
} from 'lucide-vue-next';

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  placeholder?: string;
}

const props = withDefaults(defineProps<CommandPaletteProps>(), {
  placeholder: 'Search commands...',
});

const emit = defineEmits<{
  close: [];
}>();

const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const paletteRef = ref<HTMLDivElement | null>(null);

const filteredCommands = computed(() => {
  return props.commands.filter(
    (command) =>
      command.title.toLowerCase().includes(query.value.toLowerCase()) ||
      command.description.toLowerCase().includes(query.value.toLowerCase()) ||
      command.keywords?.some((keyword) =>
        keyword.toLowerCase().includes(query.value.toLowerCase())
      ) ||
      command.category.toLowerCase().includes(query.value.toLowerCase())
  );
});

const groupedCommands = computed(() => {
  return filteredCommands.value.reduce(
    (groups, command) => {
      const category = command.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(command);
      return groups;
    },
    {} as Record<string, CommandItem[]>
  );
});

const getGlobalIndex = (command: CommandItem): number => {
  let index = 0;
  for (const category in groupedCommands.value) {
    for (const cmd of groupedCommands.value[category]) {
      if (cmd.id === command.id) {
        return index;
      }
      index++;
    }
  }
  return -1;
};

const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex.value = selectedIndex.value < filteredCommands.value.length - 1 ? selectedIndex.value + 1 : selectedIndex.value;
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : selectedIndex.value;
      break;
    case 'Enter':
      e.preventDefault();
      if (filteredCommands.value[selectedIndex.value]) {
        filteredCommands.value[selectedIndex.value].action();
        props.onClose();
      }
      break;
    case 'Escape':
      e.preventDefault();
      props.onClose();
      break;
  }
};

const executeCommand = (command: CommandItem) => {
  command.action();
  props.onClose();
};

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (props.isOpen) {
      props.onClose();
    } else {
      // Open palette - this would need to be handled by parent
    }
  }
};

watch(
  () => query.value,
  () => {
    selectedIndex.value = 0;
  }
);

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      inputRef.value?.focus();
    }
  }
);

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<style scoped>
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
