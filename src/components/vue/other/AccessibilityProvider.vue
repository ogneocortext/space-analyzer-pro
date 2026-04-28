<template>
  <slot />
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, watch } from "vue";

type FontSize = "small" | "medium" | "large";
type FocusMode = "none" | "minimal" | "adhd" | "cognitive";

interface AccessibilityContextType {
  isHighContrast: any;
  isReducedMotion: any;
  fontSize: any;
  focusMode: any;
  cognitiveSimplify: any;
  antiFlash: any;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  toggleFocusMode: (mode: FocusMode) => void;
  toggleCognitiveSimplify: () => void;
  toggleAntiFlash: () => void;
  resetSettings: () => void;
}

const ACCESSIBILITY_KEY = "accessibility" as const;

const isHighContrast = ref(false);
const isReducedMotion = ref(false);
const fontSize = ref<FontSize>("medium");
const focusMode = ref<FocusMode>("none");
const cognitiveSimplify = ref(false);
const antiFlash = ref(false);

// Load settings from localStorage on mount
onMounted(() => {
  const saved = localStorage.getItem("space-analyzer-accessibility");
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      isHighContrast.value = settings.isHighContrast || false;
      isReducedMotion.value = settings.isReducedMotion || false;
      fontSize.value = settings.fontSize || "medium";
      focusMode.value = settings.focusMode || "none";
      cognitiveSimplify.value = settings.cognitiveSimplify || false;
      antiFlash.value = settings.antiFlash || false;
    } catch (e) {
      console.warn("Failed to parse accessibility settings:", e);
    }
  }

  // Check system preferences
  const mediaQuery = window.matchMedia("(prefers-contrast: high)");
  isHighContrast.value = mediaQuery.matches;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  isReducedMotion.value = motionQuery.matches;

  const handleContrastChange = (e: MediaQueryListEvent) => {
    isHighContrast.value = e.matches;
  };

  const handleMotionChange = (e: MediaQueryListEvent) => {
    isReducedMotion.value = e.matches;
  };

  mediaQuery.addEventListener("change", handleContrastChange);
  motionQuery.addEventListener("change", handleMotionChange);

  onUnmounted(() => {
    mediaQuery.removeEventListener("change", handleContrastChange);
    motionQuery.removeEventListener("change", handleMotionChange);
  });
});

// Apply styles to document root
const applyStyles = () => {
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
  if (antiFlash.value) {
    root.classList.add("anti-flash-mode");
    body.classList.add("anti-flash-mode");
    root.style.setProperty("--animation-duration", "0s");
    root.style.setProperty("--transition-duration", "0.1s");
  }

  // Apply focus mode
  switch (focusMode.value) {
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
      cognitiveSimplify.value = true;
      break;
  }

  // Apply cognitive simplify separately
  if (cognitiveSimplify.value && focusMode.value !== "cognitive") {
    root.classList.add("cognitive-simplify");
    body.classList.add("cognitive-simplify");
  }

  // High contrast mode
  if (isHighContrast.value) {
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
  if (isReducedMotion.value) {
    root.style.setProperty("--animation-duration", "0s");
    root.style.setProperty("--transition-duration", "0s");
    root.style.setProperty("--reduced-motion", "reduce");
  } else {
    root.style.removeProperty("--animation-duration");
    root.style.removeProperty("--transition-duration");
    root.style.removeProperty("--reduced-motion");
  }

  // Font size
  const fontSizes: Record<FontSize, string> = {
    small: "14px",
    medium: "16px",
    large: "18px",
  };
  root.style.fontSize = fontSizes[fontSize.value];
  root.style.setProperty(
    "--font-scale",
    fontSize.value === "small" ? "0.875" : fontSize.value === "large" ? "1.125" : "1"
  );

  // Save to localStorage
  const settings = {
    isHighContrast: isHighContrast.value,
    isReducedMotion: isReducedMotion.value,
    fontSize: fontSize.value,
    focusMode: focusMode.value,
    cognitiveSimplify: cognitiveSimplify.value,
    antiFlash: antiFlash.value,
  };
  localStorage.setItem("space-analyzer-accessibility", JSON.stringify(settings));
};

// Watch for changes and apply styles
watch(
  [isHighContrast, isReducedMotion, fontSize, focusMode, cognitiveSimplify, antiFlash],
  applyStyles,
  { immediate: true }
);

const increaseFontSize = () => {
  switch (fontSize.value) {
    case "small":
      fontSize.value = "medium";
      break;
    case "medium":
      fontSize.value = "large";
      break;
    case "large":
      fontSize.value = "large";
      break;
    default:
      fontSize.value = "medium";
  }
};

const decreaseFontSize = () => {
  switch (fontSize.value) {
    case "small":
      fontSize.value = "small";
      break;
    case "medium":
      fontSize.value = "small";
      break;
    case "large":
      fontSize.value = "medium";
      break;
    default:
      fontSize.value = "medium";
  }
};

const toggleHighContrast = () => {
  isHighContrast.value = !isHighContrast.value;
};

const toggleReducedMotion = () => {
  isReducedMotion.value = !isReducedMotion.value;
};

const toggleFocusMode = (mode: FocusMode) => {
  focusMode.value = focusMode.value === mode ? "none" : mode;
};

const toggleCognitiveSimplify = () => {
  cognitiveSimplify.value = !cognitiveSimplify.value;
};

const toggleAntiFlash = () => {
  antiFlash.value = !antiFlash.value;
};

const resetSettings = () => {
  isHighContrast.value = false;
  isReducedMotion.value = false;
  fontSize.value = "medium";
  focusMode.value = "none";
  cognitiveSimplify.value = false;
  antiFlash.value = false;
};

const accessibilityContext: AccessibilityContextType = {
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

provide(ACCESSIBILITY_KEY, accessibilityContext);
</script>

<script lang="ts">
import { inject } from "vue";

const ACCESSIBILITY_KEY = "accessibility" as const;

export const useAccessibility = () => {
  const context = inject(ACCESSIBILITY_KEY);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context as any;
};
</script>
