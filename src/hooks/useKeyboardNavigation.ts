import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useUIStore, useErrorStore } from "../store";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardNavigation = () => {
  const router = useRouter();
  const uiStore = useUIStore();
  const errorStore = useErrorStore();

  const shortcuts = ref<KeyboardShortcut[]>([
    {
      key: 'n',
      ctrl: true,
      action: () => {
        // Navigate to next file
        console.log('Navigate to next file');
      },
      description: 'Next file'
    },
    {
      key: 'p',
      ctrl: true,
      action: () => {
        // Navigate to previous file
        console.log('Navigate to previous file');
      },
      description: 'Previous file'
    },
    {
      key: 'f',
      ctrl: true,
      action: () => {
        // Focus search
        console.log('Focus search');
      },
      description: 'Focus search'
    },
    {
      key: 'Escape',
      action: () => {
        // Cancel current operation
        console.log('Cancel operation');
      },
      description: 'Cancel operation'
    }
  ]);

  const handleKeyDown = (event: KeyboardEvent) => {
    const { key, ctrlKey, altKey, shiftKey } = event;
    
    const shortcut = shortcuts.value.find(s => 
      s.key.toLowerCase() === key.toLowerCase() &&
      !!s.ctrl === ctrlKey &&
      !!s.alt === altKey &&
      !!s.shift === shiftKey
    );

    if (shortcut) {
      event.preventDefault();
      try {
        shortcut.action();
      } catch (error) {
        errorStore.addError({
          message: `Keyboard shortcut failed: ${shortcut.description}`,
          type: 'error'
        });
      }
    }
  };

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return {
    shortcuts: shortcuts.value,
    addShortcut: (shortcut: KeyboardShortcut) => {
      shortcuts.value.push(shortcut);
    },
    removeShortcut: (key: string) => {
      const index = shortcuts.value.findIndex(s => s.key === key);
      if (index > -1) {
        shortcuts.value.splice(index, 1);
      }
    }
  };
};
