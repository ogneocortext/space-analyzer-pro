import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useUIStore, useErrorStore } from "../store";
import { ROUTES } from "../config/routes";

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
    // Navigation shortcuts based on ROUTES configuration
    ...ROUTES.filter((route) => route.shortcut && route.enabled).map((route) => {
      const shortcutParts = route.shortcut.toLowerCase().split("+");
      const key = shortcutParts.pop() || "";
      const ctrl = shortcutParts.includes("ctrl");
      const alt = shortcutParts.includes("alt");
      const shift = shortcutParts.includes("shift");

      return {
        key,
        ctrl,
        alt,
        shift,
        action: () => {
          router.push(route.path);
        },
        description: `Navigate to ${route.title}`,
      };
    }),

    // Additional utility shortcuts
    {
      key: "n",
      ctrl: true,
      action: () => {
        // Navigate to next file (if in file browser)
        console.log("Navigate to next file");
      },
      description: "Next file",
    },
    {
      key: "p",
      ctrl: true,
      action: () => {
        // Navigate to previous file (if in file browser)
        console.log("Navigate to previous file");
      },
      description: "Previous file",
    },
    {
      key: "Escape",
      action: () => {
        // Cancel current operation or close modals
        const modals = document.querySelectorAll('[role="dialog"]');
        if (modals.length > 0) {
          (modals[modals.length - 1] as HTMLElement).click();
        }
        // Close sidebar on mobile
        const sidebar = document.querySelector("[data-sidebar]");
        if (sidebar && window.innerWidth < 768) {
          (sidebar as HTMLElement).setAttribute("data-state", "closed");
        }
      },
      description: "Cancel operation / Close modal",
    },
  ]);

  const handleKeyDown = (event: KeyboardEvent) => {
    const { key, ctrlKey, altKey, shiftKey } = event;

    const shortcut = shortcuts.value.find(
      (s) =>
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
          type: "error",
        });
      }
    }
  };

  onMounted(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  return {
    shortcuts: shortcuts.value,
    addShortcut: (shortcut: KeyboardShortcut) => {
      shortcuts.value.push(shortcut);
    },
    removeShortcut: (key: string) => {
      const index = shortcuts.value.findIndex((s) => s.key === key);
      if (index > -1) {
        shortcuts.value.splice(index, 1);
      }
    },
  };
};
