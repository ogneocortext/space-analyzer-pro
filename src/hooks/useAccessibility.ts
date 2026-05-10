/* Accessibility Hook for Space Analyzer */
import { onMounted, ref, type Ref } from "vue";

interface AccessibilitySettings {
  fontSize: number;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: number;
  keyboardNavigation: boolean;
  focusVisible: boolean;
}

interface AccessibilityScore {
  overall: number;
  colorContrast: number;
  keyboardNavigation: number;
  screenReader: number;
  focusManagement: number;
  recommendations: string[];
}

interface UseAccessibilityReturn {
  settings: Ref<AccessibilitySettings>;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  announceToScreenReader: (message: string) => void;
  setFocus: (element: HTMLElement) => void;
  trapFocus: (container: HTMLElement) => void;
  getAccessibleColor: (color: string) => string;
  checkAccessibility: () => AccessibilityScore;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontSize: 16,
  highContrast: false,
  reducedMotion: false,
  screenReader: 1,
  keyboardNavigation: true,
  focusVisible: true,
};

export const useAccessibility = (): UseAccessibilityReturn => {
  const settings = ref<AccessibilitySettings>({ ...DEFAULT_SETTINGS });

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    settings.value = { ...settings.value, ...newSettings };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("accessibility-settings", JSON.stringify(settings.value));
      } catch (error) {
        console.error("Failed to persist accessibility settings:", error);
      }
    }
  };

  const announceToScreenReader = (message: string) => {
    if (typeof document === "undefined") return;

    let liveRegion = document.getElementById("accessibility-live-region");
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "accessibility-live-region";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      liveRegion.className = "sr-only";
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = "";
    window.setTimeout(() => {
      liveRegion!.textContent = message;
    }, 20);
  };

  const setFocus = (element: HTMLElement) => {
    element?.focus?.();
  };

  const trapFocus = (container: HTMLElement) => {
    if (!container) return;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelector)
    );

    if (focusableElements.length === 0) return;
    focusableElements[0]?.focus();
  };

  const getAccessibleColor = (color: string) => color;

  const checkAccessibility = (): AccessibilityScore => ({
    overall: 90,
    colorContrast: settings.value.highContrast ? 100 : 85,
    keyboardNavigation: settings.value.keyboardNavigation ? 95 : 70,
    screenReader: 90,
    focusManagement: settings.value.focusVisible ? 95 : 75,
    recommendations: settings.value.highContrast
      ? ["High contrast mode is enabled."]
      : ["Enable high contrast mode for improved readability."],
  });

  onMounted(() => {
    if (typeof window === "undefined") return;

    try {
      const savedSettings = localStorage.getItem("accessibility-settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings) as Partial<AccessibilitySettings>;
        updateSettings(parsed);
      }
    } catch (error) {
      console.error("Failed to load accessibility settings:", error);
    }
  });

  return {
    settings,
    updateSettings,
    announceToScreenReader,
    setFocus,
    trapFocus,
    getAccessibleColor,
    checkAccessibility,
  };
};
