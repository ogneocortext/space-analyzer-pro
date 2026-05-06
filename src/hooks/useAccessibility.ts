/* Accessibility Hook for Space Analyzer */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-useless-assignment */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, onMounted, onUnmounted } from "vue";

interface AccessibilitySettings {
  fontSize: number;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  focusVisible: boolean;
}

interface UseAccessibilityReturn {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  announceToScreenReader: (message: string) => void;
  setFocus: (element: HTMLElement) => void;
  trapFocus: (container: HTMLElement) => void;
  getAccessibleColor: (color: string) => string;
  checkAccessibility: () => AccessibilityScore;
}

interface AccessibilityScore {
  overall: number;
  colorContrast: number;
  keyboardNavigation: number;
  screenReader: boolean;
  focusManagement: number;
  recommendations: string[];
}

export const useAccessibility = (initialSettings: Partial<AccessibilitySettings> = {}): UseAccessibilityReturn => {
  const settings = ref<AccessibilitySettings>({
    fontSize: 16,
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: true,
    focusVisible: true,
    ...initialSettings
  });

  const announcementQueue = ref<string[]>([]);
  const focusHistory = ref<HTMLElement[]>([]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    settings.value = { ...settings.value, ...newSettings };
    
    // Apply settings to DOM
    applyAccessibilitySettings(settings.value);
  };

  const applyAccessibilitySettings = (settings: AccessibilitySettings) => {
    const root = document.documentElement;
    
    // Font size
    root.style.fontSize = `${settings.fontSize}px`;
    
    // High contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
    
    // Save to localStorage
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  };

  const announceToScreenReader = (message: string) => {
    if (!settings.value.screenReader) return;
    
    announcementQueue.value.push(message);
    
    // Process announcements with delay to avoid overwhelming screen reader
    setTimeout(() => {
      if (announcementQueue.value.length > 0) {
        const announcement = announcementQueue.value.shift();
        
        // Create or use existing live region
        let liveRegion = document.getElementById('accessibility-live-region');
        if (!liveRegion) {
          liveRegion = document.createElement('div');
          liveRegion.id = 'accessibility-live-region';
          liveRegion.setAttribute('aria-live', 'polite');
          liveRegion.setAttribute('aria-atomic', 'true');
          liveRegion.className = 'sr-only';
          document.body.appendChild(liveRegion);
        }
        
        liveRegion.textContent = announcement;
        
        // Clear after announcement
        setTimeout(() => {
          liveRegion.textContent = '';
        }, 1000);
      }
    }, 100);
  };

  const setFocus = (element: HTMLElement) => {
    if (!element) return;
    
    element.focus();
    focusHistory.value.push(element);
    
    // Announce focus change
    const tagName = element.tagName.toLowerCase();
    const textContent = element.textContent?.trim() || '';
    
    if (textContent) {
      announceToScreenReader(`Focused on ${tagName}: ${textContent.substring(0, 50)}`);
    }
  };

  const trapFocus = (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift+Tab - go backwards
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          // Tab - go forwards
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    
    // Cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  };

  const getAccessibleColor = (color: string): string => {
    if (!settings.value.highContrast) return color;
    
    // Simple high contrast transformations
    const colorMap: Record<string, string> = {
      '#ffffff': '#000000',
      '#000000': '#ffffff',
      '#f0f0f0': '#0f0f0f',
      '#d0d0d0': '#f0f0f0',
      '#888888': '#ffffff',
      '#666666': '#ffffff',
    };
    
    return colorMap[color.toLowerCase()] || color;
  };

  const checkAccessibility = (): AccessibilityScore => {
    const score: AccessibilityScore = {
      overall: 0,
      colorContrast: 0,
      keyboardNavigation: 0,
      screenReader: settings.value.screenReader ? 100 : 0,
      focusManagement: 0,
      recommendations: []
    };
    
    // Check color contrast
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
    let contrastScore = 0;
    let elementsChecked = 0;
    
    textElements.forEach((element: Element) => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Simple contrast check (would need proper library for production)
      if (color && backgroundColor) {
        contrastScore += 50; // Assume decent contrast
        elementsChecked++;
      }
    });
    
    score.colorContrast = elementsChecked > 0 ? Math.round(contrastScore / elementsChecked) : 0;
    
    // Check keyboard navigation
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      score.keyboardNavigation = 100;
    }
    
    // Check focus management
    const hasFocusIndicators = document.querySelectorAll('[data-focus-visible]');
    if (hasFocusIndicators.length > 0) {
      score.focusManagement = 80;
    }
    
    // Calculate overall score
    score.overall = Math.round(
      (score.colorContrast * 0.3) +
      (score.keyboardNavigation * 0.3) +
      (score.screenReader * 0.2) +
      (score.focusManagement * 0.2)
    );
    
    // Generate recommendations
    if (score.colorContrast < 70) {
      score.recommendations.push('Improve color contrast ratios');
    }
    if (score.keyboardNavigation < 100) {
      score.recommendations.push('Ensure all interactive elements are keyboard accessible');
    }
    if (!settings.value.screenReader) {
      score.recommendations.push('Enable screen reader support');
    }
    
    return score;
  };

  // Load settings from localStorage on mount
  onMounted(() => {
    const savedSettings = localStorage.getItem('accessibility-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        updateSettings(parsed);
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      }
    }
    
    applyAccessibilitySettings(settings.value);
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
