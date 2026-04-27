import React, { createContext, useContext, useEffect, useState } from "react";
import type { FC, ReactNode } from "react";

interface AccessibilityContextType {
  isHighContrast: boolean;
  isReducedMotion: boolean;
  fontSize: "small" | "medium" | "large";
  focusMode: "none" | "minimal" | "adhd" | "cognitive";
  cognitiveSimplify: boolean;
  antiFlash: boolean;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  toggleFocusMode: (mode: AccessibilityContextType["focusMode"]) => void;
  toggleCognitiveSimplify: () => void;
  toggleAntiFlash: () => void;
  resetSettings: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
};

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: FC<AccessibilityProviderProps> = ({ children }) => {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [focusMode, setFocusMode] = useState<"none" | "minimal" | "adhd" | "cognitive">("none");
  const [cognitiveSimplify, setCognitiveSimplify] = useState(false);
  const [antiFlash, setAntiFlash] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("space-analyzer-accessibility");
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setIsHighContrast(settings.isHighContrast || false);
        setIsReducedMotion(settings.isReducedMotion || false);
        setFontSize(settings.fontSize || "medium");
        setFocusMode(settings.focusMode || "none");
        setCognitiveSimplify(settings.cognitiveSimplify || false);
        setAntiFlash(settings.antiFlash || false);
      } catch (e) {
        console.warn("Failed to parse accessibility settings:", e);
      }
    }
  }, []);

  // Check system preferences on mount
  useEffect(() => {
    // Check for high contrast preference
    const mediaQuery = window.matchMedia("(prefers-contrast: high)");
    setIsHighContrast(mediaQuery.matches);

    // Check for reduced motion preference
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(motionQuery.matches);

    // Listen for changes
    const handleContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleContrastChange);
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      mediaQuery.removeEventListener("change", handleContrastChange);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  // Apply styles to document root
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Clear all classes first
    root.classList.remove(
      "focus-mode-minimal",
      "high-contrast",
      "adhd-focus-mode",
      "cognitive-simplify",
      "anti-flash-mode"
    );
    body.classList.remove(
      "focus-mode-minimal",
      "high-contrast",
      "adhd-focus-mode",
      "cognitive-simplify",
      "anti-flash-mode"
    );

    // Apply anti-flash mode
    if (antiFlash) {
      root.classList.add("anti-flash-mode");
      body.classList.add("anti-flash-mode");
      root.style.setProperty("--animation-duration", "0s");
      root.style.setProperty("--transition-duration", "0.1s");
    }

    // Apply focus mode
    switch (focusMode) {
      case "minimal":
        root.classList.add("focus-mode-minimal");
        body.classList.add("focus-mode-minimal");
        break;
      case "adhd":
        root.classList.add("adhd-focus-mode");
        body.classList.add("adhd-focus-mode");
        break;
      case "cognitive":
        root.classList.add("cognitive-simplify");
        body.classList.add("cognitive-simplify");
        setCognitiveSimplify(true);
        break;
    }

    // Apply cognitive simplify separately
    if (cognitiveSimplify && focusMode !== "cognitive") {
      root.classList.add("cognitive-simplify");
      body.classList.add("cognitive-simplify");
    }

    // High contrast mode
    if (isHighContrast) {
      root.classList.add("high-contrast");
      body.classList.add("high-contrast");
      root.style.setProperty("--contrast-level", "high");
      root.style.setProperty("--text-color", "#ffffff");
      root.style.setProperty("--background-color", "#000000");
      root.style.setProperty("--border-color", "#ffffff");
      root.style.setProperty("--accent-color", "#ffff00");
      root.style.setProperty("--muted-color", "#ffff00");
    } else {
      root.classList.remove("high-contrast");
      body.classList.remove("high-contrast");
      root.style.removeProperty("--contrast-level");
      root.style.removeProperty("--text-color");
      root.style.removeProperty("--background-color");
      root.style.removeProperty("--border-color");
      root.style.removeProperty("--accent-color");
      root.style.removeProperty("--muted-color");
    }

    // Reduced motion
    if (isReducedMotion) {
      root.style.setProperty("--animation-duration", "0s");
      root.style.setProperty("--transition-duration", "0s");
      root.style.setProperty("--reduced-motion", "reduce");
    } else {
      root.style.removeProperty("--animation-duration");
      root.style.removeProperty("--transition-duration");
      root.style.removeProperty("--reduced-motion");
    }

    // Font size
    const fontSizes = {
      small: "14px",
      medium: "16px",
      large: "18px",
    };
    root.style.fontSize = fontSizes[fontSize];
    root.style.setProperty(
      "--font-scale",
      fontSize === "small" ? "0.875" : fontSize === "large" ? "1.125" : "1"
    );

    // Save to localStorage
    const settings = {
      isHighContrast,
      isReducedMotion,
      fontSize,
      focusMode,
      cognitiveSimplify,
      antiFlash,
    };
    localStorage.setItem("space-analyzer-accessibility", JSON.stringify(settings));
  }, [isHighContrast, isReducedMotion, fontSize, focusMode, cognitiveSimplify, antiFlash]);

  const increaseFontSize = () => {
    setFontSize((prev) => {
      switch (prev) {
        case "small":
          return "medium";
        case "medium":
          return "large";
        case "large":
          return "large";
        default:
          return "medium";
      }
    });
  };

  const decreaseFontSize = () => {
    setFontSize((prev) => {
      switch (prev) {
        case "small":
          return "small";
        case "medium":
          return "small";
        case "large":
          return "medium";
        default:
          return "medium";
      }
    });
  };

  const toggleHighContrast = () => {
    setIsHighContrast(!isHighContrast);
  };

  const toggleReducedMotion = () => {
    setIsReducedMotion(!isReducedMotion);
  };

  const toggleFocusMode = (mode: "none" | "minimal" | "adhd" | "cognitive") => {
    setFocusMode((prev) => (prev === mode ? "none" : mode));
  };

  const toggleCognitiveSimplify = () => {
    setCognitiveSimplify(!cognitiveSimplify);
  };

  const toggleAntiFlash = () => {
    setAntiFlash(!antiFlash);
  };

  const resetSettings = () => {
    setIsHighContrast(false);
    setIsReducedMotion(false);
    setFontSize("medium");
    setFocusMode("none");
    setCognitiveSimplify(false);
    setAntiFlash(false);
  };

  const value: AccessibilityContextType = {
    isHighContrast,
    isReducedMotion,
    fontSize,
    focusMode,
    cognitiveSimplify,
    antiFlash,
    increaseFontSize,
    decreaseFontSize,
    toggleHighContrast,
    toggleReducedMotion,
    toggleFocusMode,
    toggleCognitiveSimplify,
    toggleAntiFlash,
    resetSettings,
  };

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
};

// Enhanced Accessibility controls component with 2026 design
export const AccessibilityControls: FC = () => {
  const {
    isHighContrast,
    isReducedMotion,
    fontSize,
    focusMode,
    cognitiveSimplify,
    antiFlash,
    increaseFontSize,
    decreaseFontSize,
    toggleHighContrast,
    toggleReducedMotion,
    toggleFocusMode,
    toggleCognitiveSimplify,
    toggleAntiFlash,
    resetSettings,
  } = useAccessibility();

  return (
    <div className="accessibility-controls fixed bottom-4 right-4 z-50 soft-ui-card p-3 border border-white/10">
      <div className="flex flex-col gap-2 min-w-48">
        <div className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-2">
          <span>Accessibility</span>
          <button
            onClick={resetSettings}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Reset all settings"
          >
            Reset
          </button>
        </div>

        {/* Focus Mode Controls */}
        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">Focus Mode</div>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => toggleFocusMode("minimal")}
              className={`px-2 py-1 text-xs rounded transition-all ${
                focusMode === "minimal"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
              title="Minimal mode - reduce visual clutter"
            >
              Minimal
            </button>
            <button
              onClick={() => toggleFocusMode("adhd")}
              className={`px-2 py-1 text-xs rounded transition-all ${
                focusMode === "adhd"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
              title="ADHD focus mode - reduce distractions"
            >
              ADHD
            </button>
            <button
              onClick={() => toggleFocusMode("cognitive")}
              className={`px-2 py-1 text-xs rounded transition-all col-span-2 ${
                focusMode === "cognitive"
                  ? "bg-green-600 text-white shadow-lg shadow-green-500/20"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
              title="Cognitive simplify - reduce mental load"
            >
              Cognitive
            </button>
          </div>
        </div>

        {/* Font Size Controls */}
        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-400">Font Size</div>
          <div className="flex gap-1">
            <button
              onClick={decreaseFontSize}
              className={`px-2 py-1 text-xs rounded transition-all ${
                fontSize === "small"
                  ? "bg-green-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
              aria-label="Decrease font size"
            >
              A-
            </button>
            <div className="flex-1 text-xs text-slate-300 text-center py-1">
              {fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}
            </div>
            <button
              onClick={increaseFontSize}
              className={`px-2 py-1 text-xs rounded transition-all ${
                fontSize === "large"
                  ? "bg-green-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
        </div>

        {/* Toggle Controls */}
        <div className="flex flex-col gap-1">
          <button
            onClick={toggleHighContrast}
            className={`px-2 py-1 text-xs rounded transition-all text-left ${
              isHighContrast
                ? "bg-yellow-600 text-white shadow-lg shadow-yellow-500/20"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {isHighContrast ? "✓ " : ""}High Contrast
          </button>

          <button
            onClick={toggleReducedMotion}
            className={`px-2 py-1 text-xs rounded transition-all text-left ${
              isReducedMotion
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {isReducedMotion ? "✓ " : ""}Reduced Motion
          </button>

          <button
            onClick={toggleCognitiveSimplify}
            className={`px-2 py-1 text-xs rounded transition-all text-left ${
              cognitiveSimplify
                ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {cognitiveSimplify ? "✓ " : ""}Simplify UI
          </button>

          <button
            onClick={toggleAntiFlash}
            className={`px-2 py-1 text-xs rounded transition-all text-left ${
              antiFlash
                ? "bg-red-600 text-white shadow-lg shadow-red-500/20"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {antiFlash ? "✓ " : ""}Anti-Flash
          </button>
        </div>
      </div>
    </div>
  );
};
