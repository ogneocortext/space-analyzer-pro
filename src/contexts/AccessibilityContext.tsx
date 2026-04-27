import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";

// Constants for accessibility settings
export const FONT_SIZES = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
} as const;

export type FontSizeType = (typeof FONT_SIZES)[keyof typeof FONT_SIZES];

export const FOCUS_MODES = {
  NONE: "none",
  MINIMAL: "minimal",
  ADHD: "adhd",
  COGNITIVE: "cognitive",
} as const;

export type FocusModeType = (typeof FOCUS_MODES)[keyof typeof FOCUS_MODES];

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  focusVisible: boolean;
  fontSize?: FontSizeType;
  focusMode?: FocusModeType;
  cognitiveSimplify?: boolean;
  antiFlash?: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
  resetSettings: () => void;
  announceToScreenReader: (message: string) => void;
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  screenReaderOptimized: true,
  keyboardNavigation: true,
  focusVisible: true,
  fontSize: FONT_SIZES.MEDIUM,
  focusMode: FOCUS_MODES.NONE,
  cognitiveSimplify: false,
  antiFlash: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);

  const updateSettings = useCallback((updates: Partial<AccessibilitySettings>) => {
    // Validate fontSize if provided
    if (updates.fontSize && !Object.values(FONT_SIZES).includes(updates.fontSize)) {
      console.warn(`Invalid fontSize: ${updates.fontSize}. Using default.`);
      updates.fontSize = FONT_SIZES.MEDIUM;
    }

    // Validate focusMode if provided
    if (updates.focusMode && !Object.values(FOCUS_MODES).includes(updates.focusMode)) {
      console.warn(`Invalid focusMode: ${updates.focusMode}. Using default.`);
      updates.focusMode = FOCUS_MODES.NONE;
    }

    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  const announceToScreenReader = useCallback(
    (message: string) => {
      if (settings.screenReaderOptimized) {
        const announcement = document.createElement("div");
        announcement.setAttribute("aria-live", "polite");
        announcement.setAttribute("aria-atomic", "true");
        announcement.className = "sr-only";
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => {
          if (document.body.contains(announcement)) {
            document.body.removeChild(announcement);
          }
        }, 1000);
      }
    },
    [settings.screenReaderOptimized]
  );

  // Apply accessibility settings to document root
  useEffect(() => {
    const root = document.documentElement;

    // Apply high contrast
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    // Apply large text
    if (settings.largeText) {
      root.classList.add("large-text");
    } else {
      root.classList.remove("large-text");
    }

    // Apply reduced motion
    if (settings.reducedMotion) {
      root.classList.add("reduced-motion");
    } else {
      root.classList.remove("reduced-motion");
    }

    // Apply font size
    if (settings.fontSize) {
      root.setAttribute("data-font-size", settings.fontSize);
    }

    // Apply focus mode
    if (settings.focusMode) {
      root.setAttribute("data-focus-mode", settings.focusMode);
    }
  }, [settings]);

  // Check system preferences
  useEffect(() => {
    const checkSystemPreferences = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        updateSettings({ reducedMotion: true });
      }

      if (window.matchMedia("(prefers-contrast: high)").matches) {
        updateSettings({ highContrast: true });
      }
    };

    checkSystemPreferences();

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    mediaQuery.addEventListener("change", checkSystemPreferences);

    return () => {
      mediaQuery.removeEventListener("change", checkSystemPreferences);
    };
  }, [updateSettings]);

  const value = {
    settings,
    updateSettings,
    resetSettings,
    announceToScreenReader,
  };

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
};

export const AccessibilityControls: React.FC = () => {
  const { settings, updateSettings } = useAccessibility();

  return (
    <div className="accessibility-controls p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Accessibility Settings</h3>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={(e) => updateSettings({ highContrast: e.target.checked })}
            className="rounded"
          />
          <span>High Contrast</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={settings.largeText}
            onChange={(e) => updateSettings({ largeText: e.target.checked })}
            className="rounded"
          />
          <span>Large Text</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
            className="rounded"
          />
          <span>Reduced Motion</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={settings.keyboardNavigation}
            onChange={(e) => updateSettings({ keyboardNavigation: e.target.checked })}
            className="rounded"
          />
          <span>Keyboard Navigation</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={settings.focusVisible}
            onChange={(e) => updateSettings({ focusVisible: e.target.checked })}
            className="rounded"
          />
          <span>Focus Visible</span>
        </label>
      </div>
    </div>
  );
};

export default AccessibilityContext;
