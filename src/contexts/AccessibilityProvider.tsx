import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Keyboard,
  Monitor,
  Palette,
  Contrast,
  Type,
} from "lucide-react";

interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  fontSize: "small" | "medium" | "large" | "extra-large";
  colorBlindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";
  keyboardNavigation: boolean;
  announcements: boolean;
}

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

interface AccessibilityControlsProps {
  className?: string;
  showToggle?: boolean;
}

const AccessibilityContext = React.createContext<{
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  announce: (message: string) => void;
}>({
  settings: {
    highContrast: false,
    reducedMotion: false,
    screenReaderMode: false,
    fontSize: "medium",
    colorBlindMode: "none",
    keyboardNavigation: false,
    announcements: true,
  },
  updateSettings: () => {},
  announce: () => {},
});

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    reducedMotion: false,
    screenReaderMode: false,
    fontSize: "medium",
    colorBlindMode: "none",
    keyboardNavigation: false,
    announcements: true,
  });

  const [announcement, setAnnouncement] = useState("");

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("accessibility-settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error("Failed to load accessibility settings:", error);
      }
    }

    // Detect system preferences
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prefersHighContrast = window.matchMedia("(prefers-contrast: high)").matches;

    if (prefersReducedMotion) {
      setSettings((prev) => ({ ...prev, reducedMotion: true }));
    }

    if (prefersHighContrast) {
      setSettings((prev) => ({ ...prev, highContrast: true }));
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("accessibility-settings", JSON.stringify(settings));
  }, [settings]);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply font size
    const fontSizes = {
      small: "14px",
      medium: "16px",
      large: "18px",
      "extra-large": "20px",
    };
    root.style.fontSize = fontSizes[settings.fontSize];

    // Apply high contrast
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    // Apply reduced motion
    if (settings.reducedMotion) {
      root.style.setProperty("--motion-duration", "0s");
      root.classList.add("reduced-motion");
    } else {
      root.style.setProperty("--motion-duration", "");
      root.classList.remove("reduced-motion");
    }

    // Apply color blind mode
    root.classList.remove(
      "colorblind-protanopia",
      "colorblind-deuteranopia",
      "colorblind-tritanopia"
    );
    if (settings.colorBlindMode !== "none") {
      root.classList.add(`colorblind-${settings.colorBlindMode}`);
    }

    // Apply screen reader mode
    if (settings.screenReaderMode) {
      root.setAttribute("aria-live", "polite");
      root.classList.add("screen-reader-mode");
    } else {
      root.removeAttribute("aria-live");
      root.classList.remove("screen-reader-mode");
    }

    // Apply keyboard navigation
    if (settings.keyboardNavigation) {
      root.classList.add("keyboard-nav");
    } else {
      root.classList.remove("keyboard-nav");
    }
  }, [settings]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setSettings((prev) => ({ ...prev, keyboardNavigation: true }));
      }
    };

    const handleMouseDown = () => {
      setSettings((prev) => ({ ...prev, keyboardNavigation: false }));
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const announce = useCallback(
    (message: string) => {
      if (!settings.announcements) return;

      setAnnouncement(message);

      // Create screen reader announcement
      const announcementElement = document.createElement("div");
      announcementElement.setAttribute("aria-live", "polite");
      announcementElement.setAttribute("aria-atomic", "true");
      announcementElement.className = "sr-only";
      announcementElement.textContent = message;

      document.body.appendChild(announcementElement);

      setTimeout(() => {
        document.body.removeChild(announcementElement);
      }, 1000);
    },
    [settings.announcements]
  );

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings, announce }}>
      {children}

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </AccessibilityContext.Provider>
  );
};

export const AccessibilityControls: React.FC<AccessibilityControlsProps> = ({
  className = "",
  showToggle = true,
}) => {
  const { settings, updateSettings } = React.useContext(AccessibilityContext);
  const [isOpen, setIsOpen] = useState(false);

  const toggleSetting = (key: keyof AccessibilitySettings) => {
    updateSettings({ [key]: !settings[key] });
  };

  const setFontSize = (size: AccessibilitySettings["fontSize"]) => {
    updateSettings({ fontSize: size });
  };

  const setColorBlindMode = (mode: AccessibilitySettings["colorBlindMode"]) => {
    updateSettings({ colorBlindMode: mode });
  };

  return (
    <div className={`fixed top-4 left-4 z-50 ${className}`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 mb-4 w-80"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Accessibility Settings
            </h3>

            <div className="space-y-4">
              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <label className="text-gray-300 text-sm flex items-center">
                  <Contrast className="w-4 h-4 mr-2" />
                  High Contrast
                </label>
                <button
                  onClick={() => toggleSetting("highContrast")}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.highContrast ? "bg-blue-600" : "bg-gray-600"
                  }`}
                  aria-label={`High contrast ${settings.highContrast ? "enabled" : "disabled"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.highContrast ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <label className="text-gray-300 text-sm flex items-center">
                  <Monitor className="w-4 h-4 mr-2" />
                  Reduced Motion
                </label>
                <button
                  onClick={() => toggleSetting("reducedMotion")}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.reducedMotion ? "bg-blue-600" : "bg-gray-600"
                  }`}
                  aria-label={`Reduced motion ${settings.reducedMotion ? "enabled" : "disabled"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.reducedMotion ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Screen Reader Mode */}
              <div className="flex items-center justify-between">
                <label className="text-gray-300 text-sm flex items-center">
                  <Volume2 className="w-4 h-4 mr-2" />
                  Screen Reader Mode
                </label>
                <button
                  onClick={() => toggleSetting("screenReaderMode")}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.screenReaderMode ? "bg-blue-600" : "bg-gray-600"
                  }`}
                  aria-label={`Screen reader mode ${settings.screenReaderMode ? "enabled" : "disabled"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.screenReaderMode ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Font Size */}
              <div>
                <label className="text-gray-300 text-sm flex items-center mb-2">
                  <Type className="w-4 h-4 mr-2" />
                  Font Size
                </label>
                <div className="flex space-x-2">
                  {(["small", "medium", "large", "extra-large"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        settings.fontSize === size
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                      aria-label={`Set font size to ${size}`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1).replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Blind Mode */}
              <div>
                <label className="text-gray-300 text-sm flex items-center mb-2">
                  <Palette className="w-4 h-4 mr-2" />
                  Color Blind Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["none", "protanopia", "deuteranopia", "tritanopia"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setColorBlindMode(mode)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        settings.colorBlindMode === mode
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                      aria-label={`Set color blind mode to ${mode}`}
                    >
                      {mode === "none" ? "None" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyboard Navigation Indicator */}
              <div className="flex items-center justify-between">
                <label className="text-gray-300 text-sm flex items-center">
                  <Keyboard className="w-4 h-4 mr-2" />
                  Keyboard Navigation
                </label>
                <div
                  className={`px-2 py-1 rounded text-xs ${
                    settings.keyboardNavigation
                      ? "bg-green-600 text-white"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  {settings.keyboardNavigation ? "Active" : "Inactive"}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      {showToggle && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:bg-gray-800 transition-colors"
          aria-label={isOpen ? "Close accessibility settings" : "Open accessibility settings"}
          aria-expanded={isOpen}
        >
          {settings.highContrast ? (
            <Eye className="w-5 h-5 text-yellow-400" />
          ) : (
            <Eye className="w-5 h-5 text-gray-400" />
          )}
        </button>
      )}
    </div>
  );
};

// Hook for using accessibility context
export const useAccessibility = () => {
  const context = React.useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return context;
};

// Screen reader helper component
export const ScreenReaderAnnouncement: React.FC<{
  message: string;
  priority?: "polite" | "assertive";
}> = ({ message, priority = "polite" }) => {
  const { announce } = useAccessibility();

  useEffect(() => {
    announce(message);
  }, [message, announce]);

  return (
    <div aria-live={priority} aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
};

// Focus trap hook for modals
export const useFocusTrap = (isActive: boolean) => {
  const { announce } = useAccessibility();

  useEffect(() => {
    if (!isActive) return;

    const handleFocus = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        // Focus trap logic would go here
        announce("Modal is open, use Tab to navigate");
      }
    };

    document.addEventListener("keydown", handleFocus);
    return () => document.removeEventListener("keydown", handleFocus);
  }, [isActive, announce]);
};

export default AccessibilityProvider;
