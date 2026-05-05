import { onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useTauriDesktop } from "./useTauriDesktop";
import { useDebugLogger } from "@/services/DebugLogger";

const logger = useDebugLogger("KeyboardShortcuts");

interface Shortcut {
  keys: string[];
  action: () => void;
  description: string;
  global?: boolean;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const route = useRoute();
  const { isTauri, selectDirectory, analyzeDirectoryWithProgress, cancelAnalysis } =
    useTauriDesktop();

  const shortcuts: Shortcut[] = [
    // Navigation
    {
      keys: ["Ctrl", "H"],
      action: () => router.push("/"),
      description: "Go to Dashboard",
    },
    {
      keys: ["Ctrl", "B"],
      action: () => router.push("/browser"),
      description: "Go to File Browser",
    },
    {
      keys: ["Ctrl", "S"],
      action: () => router.push("/scan"),
      description: "Go to Scan",
    },
    {
      keys: ["Ctrl", "R"],
      action: () => router.push("/reports"),
      description: "Go to Reports",
    },
    {
      keys: ["Ctrl", ","],
      action: () => router.push("/settings"),
      description: "Go to Settings",
    },

    // File Operations
    {
      keys: ["Ctrl", "O"],
      action: async () => {
        if (isTauri.value) {
          const path = await selectDirectory();
          if (path) {
            router.push(`/scan?path=${encodeURIComponent(path)}`);
          }
        }
      },
      description: "Open Folder",
    },
    {
      keys: ["Ctrl", "N"],
      action: () => router.push("/scan"),
      description: "New Scan",
    },
    {
      keys: ["Ctrl", "F"],
      action: () => router.push("/search"),
      description: "Search Files",
    },

    // Analysis Actions
    {
      keys: ["F1"],
      action: async () => {
        if (isTauri.value) {
          const path = await selectDirectory();
          if (path) {
            await analyzeDirectoryWithProgress(path);
          }
        }
      },
      description: "Quick Scan",
    },
    {
      keys: ["F5"],
      action: () => window.location.reload(),
      description: "Refresh",
    },
    {
      keys: ["Escape"],
      action: () => {
        if (isTauri.value) {
          cancelAnalysis();
        }
      },
      description: "Cancel Operation",
    },

    // Window Management
    {
      keys: ["F11"],
      action: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      },
      description: "Toggle Fullscreen",
    },
    {
      keys: ["Ctrl", "Shift", "C"],
      action: () => {
        // Toggle sidebar collapse
        const sidebar = document.querySelector(".desktop-sidebar");
        if (sidebar) {
          sidebar.classList.toggle("collapsed");
        }
      },
      description: "Toggle Sidebar",
    },

    // Quick Actions
    {
      keys: ["Ctrl", "K"],
      action: () => {
        // Focus search input in titlebar
        const searchInput = document.querySelector(".search-box input") as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: "Global Search",
    },
    {
      keys: ["Ctrl", "1"],
      action: () => router.push("/"),
      description: "Dashboard Tab",
    },
    {
      keys: ["Ctrl", "2"],
      action: () => router.push("/browser"),
      description: "Files Tab",
    },
    {
      keys: ["Ctrl", "3"],
      action: () => router.push("/scan"),
      description: "Scan Tab",
    },
    {
      keys: ["Ctrl", "4"],
      action: () => router.push("/reports"),
      description: "Reports Tab",
    },

    // Help
    {
      keys: ["F1", "Shift"],
      action: () => {
        // Show keyboard shortcuts help
        showShortcutsHelp();
      },
      description: "Show Help",
    },
  ];

  function handleKeydown(event: KeyboardEvent) {
    const pressedKeys: string[] = [];

    if (event.ctrlKey) pressedKeys.push("Ctrl");
    if (event.shiftKey) pressedKeys.push("Shift");
    if (event.altKey) pressedKeys.push("Alt");
    if (event.metaKey) pressedKeys.push("Meta");

    // Add the actual key
    if (event.key && !["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
      pressedKeys.push(event.key);
    }

    // Find matching shortcut
    const shortcut = shortcuts.find((s) => {
      if (s.keys.length !== pressedKeys.length) return false;
      return s.keys.every((key) => pressedKeys.includes(key));
    });

    if (shortcut) {
      // Prevent default behavior for our shortcuts
      event.preventDefault();
      event.stopPropagation();

      try {
        shortcut.action();
      } catch (error) {
        logger.error("Shortcut action failed", { error });
      }
    }
  }

  function showShortcutsHelp() {
    // Create a modal or overlay showing all shortcuts
    const shortcutsHtml = shortcuts
      .map((s) => {
        const keys = s.keys.join(" + ");
        return `<div class="shortcut-item">
          <kbd>${keys}</kbd>
          <span>${s.description}</span>
        </div>`;
      })
      .join("");

    const modal = document.createElement("div");
    modal.className = "shortcuts-modal";
    modal.innerHTML = `
      <div class="shortcuts-overlay">
        <div class="shortcuts-content">
          <div class="shortcuts-header">
            <h2>Keyboard Shortcuts</h2>
            <button class="close-btn">&times;</button>
          </div>
          <div class="shortcuts-list">
            ${shortcutsHtml}
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement("style");
    style.textContent = `
      .shortcuts-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
      }

      .shortcuts-content {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
      }

      .shortcuts-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid #334155;
      }

      .shortcuts-header h2 {
        margin: 0;
        color: #f1f5f9;
        font-size: 20px;
        font-weight: 600;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f1f5f9;
      }

      .shortcuts-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .shortcut-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(51, 65, 85, 0.5);
      }

      .shortcut-item:last-child {
        border-bottom: none;
      }

      .shortcut-item kbd {
        background: rgba(100, 116, 139, 0.2);
        color: #94a3b8;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        border: 1px solid #334155;
      }

      .shortcut-item span {
        color: #cbd5e1;
        font-size: 14px;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = modal.querySelector(".close-btn");
    const overlay = modal.querySelector(".shortcuts-overlay");

    const closeModal = () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
    };

    closeBtn?.addEventListener("click", closeModal);
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  function getShortcutForAction(actionName: string): Shortcut | undefined {
    return shortcuts.find((s) => s.description.toLowerCase().includes(actionName.toLowerCase()));
  }

  function getAllShortcuts(): Shortcut[] {
    return [...shortcuts];
  }

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });

  return {
    shortcuts,
    getShortcutForAction,
    getAllShortcuts,
    showShortcutsHelp,
  };
}
