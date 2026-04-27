import { useCallback, useEffect, useRef } from "react";
// @ts-ignore - react-router-dom may not be installed
import { useNavigate } from "react-router-dom";
import { useUIStore, useErrorStore } from "../store";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

export const useKeyboardNavigation = () => {
  const navigate = useNavigate();
  const { openModal, closeModal, toggleSidebar, theme, setTheme } = useUIStore();
  const { addError } = useErrorStore();

  const shortcuts = useRef<KeyboardShortcut[]>([
    // Navigation shortcuts
    {
      key: "d",
      ctrl: true,
      description: "Go to Dashboard",
      action: () => navigate("/"),
    },
    {
      key: "n",
      ctrl: true,
      description: "Go to Neural View",
      action: () => navigate("/neural"),
    },
    {
      key: "a",
      ctrl: true,
      description: "Open AI Assistant",
      action: () => openModal("aiChat"),
    },
    {
      key: "v",
      ctrl: true,
      description: "Go to Visualizations",
      action: () => navigate("/treemap"),
    },
    {
      key: "f",
      ctrl: true,
      description: "Open File Browser",
      action: () => openModal("fileBrowser"),
    },
    {
      key: "e",
      ctrl: true,
      description: "Open Export",
      action: () => openModal("export"),
    },
    {
      key: "s",
      ctrl: true,
      description: "Open Settings",
      action: () => openModal("settings"),
    },

    // UI shortcuts
    {
      key: "k",
      ctrl: true,
      description: "Focus Search",
      action: () => {
        const searchInput = document.querySelector(
          'input[placeholder*="Search"]'
        ) as HTMLInputElement;
        if (searchInput) searchInput.focus();
      },
    },
    {
      key: "b",
      ctrl: true,
      description: "Toggle Sidebar",
      action: toggleSidebar,
    },
    {
      key: "t",
      ctrl: true,
      description: "Toggle Theme",
      action: () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
      },
    },
    {
      key: "Escape",
      description: "Close Modal",
      action: () => {
        closeModal("aiChat");
        closeModal("fileBrowser");
        closeModal("settings");
        closeModal("export");
      },
    },

    // System shortcuts
    {
      key: "r",
      ctrl: true,
      description: "Refresh Analysis",
      action: () => {
        // Trigger analysis refresh
        window.dispatchEvent(new CustomEvent("refresh-analysis"));
      },
    },
    {
      key: "h",
      ctrl: true,
      description: "Show Help",
      action: () => {
        openModal("settings"); // Could open a help modal instead
      },
    },
  ]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Check for matching shortcuts
      const matchingShortcut = shortcuts.current.find((shortcut) => {
        return (
          shortcut.key.toLowerCase() === event.key.toLowerCase() &&
          (!shortcut.ctrl || event.ctrlKey) &&
          (!shortcut.alt || event.altKey) &&
          (!shortcut.shift || event.shiftKey) &&
          (!shortcut.meta || event.metaKey)
        );
      });

      if (matchingShortcut) {
        event.preventDefault();
        event.stopPropagation();
        try {
          matchingShortcut.action();
        } catch (error) {
          addError({
            message: `Keyboard shortcut error: ${error instanceof Error ? error.message : "Unknown error"}`,
            type: "error",
          });
        }
      }
    },
    [navigate, openModal, closeModal, toggleSidebar, setTheme, addError]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Get all available shortcuts for help display
  const getShortcuts = useCallback(() => {
    return shortcuts.current;
  }, []);

  // Get shortcuts by category
  const getShortcutsByCategory = useCallback(() => {
    const categories = {
      navigation: shortcuts.current.filter(
        (s) => s.description.includes("Go to") || s.description.includes("Open")
      ),
      ui: shortcuts.current.filter(
        (s) => s.description.includes("Toggle") || s.description.includes("Focus")
      ),
      system: shortcuts.current.filter(
        (s) => s.description.includes("Refresh") || s.description.includes("Help")
      ),
    };
    return categories;
  }, []);

  return {
    handleKeyDown,
    getShortcuts,
    getShortcutsByCategory,
  };
};

// Hook for global keyboard shortcuts that work across the app
export const useGlobalShortcuts = () => {
  const { addError } = useErrorStore();

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      // Global shortcuts that should work everywhere
      if (event.ctrlKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        // Print current page
        window.print();
      }

      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        // Save current state
        window.dispatchEvent(new CustomEvent("save-state"));
      }

      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        // Undo action
        window.dispatchEvent(new CustomEvent("undo-action"));
      }

      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        // Redo action
        window.dispatchEvent(new CustomEvent("redo-action"));
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [addError]);
};

// Hook for accessibility keyboard navigation
export const useAccessibilityNavigation = () => {
  useEffect(() => {
    const handleAccessibilityKeys = (event: KeyboardEvent) => {
      // Enhanced keyboard navigation for accessibility
      if (event.key === "Tab") {
        // Enhance tab navigation
        const focusableElements = document.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        // Add visual indicators for focus
        document.addEventListener(
          "focus",
          (e) => {
            if (e.target instanceof HTMLElement) {
              e.target.style.outline = "2px solid #3b82f6";
              e.target.style.outlineOffset = "2px";
            }
          },
          true
        );

        document.addEventListener(
          "blur",
          (e) => {
            if (e.target instanceof HTMLElement) {
              e.target.style.outline = "";
            }
          },
          true
        );
      }

      // Arrow key navigation for lists and menus
      if (event.key.startsWith("Arrow")) {
        const activeElement = document.activeElement;
        if (activeElement) {
          // Handle arrow navigation in custom components
          window.dispatchEvent(
            new CustomEvent("arrow-navigation", {
              detail: { key: event.key, element: activeElement },
            })
          );
        }
      }
    };

    window.addEventListener("keydown", handleAccessibilityKeys);
    return () => {
      window.removeEventListener("keydown", handleAccessibilityKeys);
    };
  }, []);
};

// Hook for command palette functionality
export const useCommandPalette = () => {
  const navigate = useNavigate();
  const { openModal } = useUIStore();

  const commands = [
    { id: "dashboard", label: "Go to Dashboard", action: () => navigate("/") },
    { id: "neural", label: "Go to Neural View", action: () => navigate("/neural") },
    { id: "ai-chat", label: "Open AI Assistant", action: () => openModal("aiChat") },
    { id: "file-browser", label: "Open File Browser", action: () => openModal("fileBrowser") },
    { id: "settings", label: "Open Settings", action: () => openModal("settings") },
    { id: "export", label: "Open Export", action: () => openModal("export") },
    {
      id: "refresh",
      label: "Refresh Analysis",
      action: () => window.dispatchEvent(new CustomEvent("refresh-analysis")),
    },
    { id: "print", label: "Print Page", action: () => window.print() },
    {
      id: "theme",
      label: "Toggle Theme",
      action: () => {
        const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        document.documentElement.classList.toggle("dark");
      },
    },
  ];

  const executeCommand = useCallback(
    (commandId: string) => {
      const command = commands.find((c) => c.id === commandId);
      if (command) {
        try {
          command.action();
        } catch (error) {
          console.error("Command execution failed:", error);
        }
      }
    },
    [commands]
  );

  return {
    commands,
    executeCommand,
  };
};
