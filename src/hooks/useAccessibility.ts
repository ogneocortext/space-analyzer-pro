/* Accessibility Hook for Space Analyzer */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AriaProps, KeyboardNavigation, AppConfig } from '../types/frontend';

export interface AccessibilityState {
  isHighContrast: boolean;
  isReducedMotion: boolean;
  isScreenReader: boolean;
  isKeyboardNavigation: boolean;
  focusMode: 'normal' | 'focus' | 'minimal' | 'anti-flash';
  fontSize: 'small' | 'medium' | 'large';
  colorScheme: 'light' | 'dark' | 'system';
}

export interface AccessibilityActions {
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  toggleScreenReader: () => void;
  toggleKeyboardNavigation: () => void;
  setFocusMode: (mode: AccessibilityState['focusMode']) => void;
  setFontSize: (size: AccessibilityState['fontSize']) => void;
  setColorScheme: (scheme: AccessibilityState['colorScheme']) => void;
  focusElement: (element: HTMLElement | string) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

export const useAccessibility = (initialConfig?: Partial<AppConfig>) => {
  const [state, setState] = useState<AccessibilityState>({
    isHighContrast: false,
    isReducedMotion: false,
    isScreenReader: false,
    isKeyboardNavigation: true,
    focusMode: 'normal',
    fontSize: 'medium',
    colorScheme: 'dark'
  });

  const liveRegionRef = useRef<HTMLDivElement>(null);
  const focusHistoryRef = useRef<string[]>([]);
  const lastAnnouncementRef = useRef<number>(0);

  // Detect system preferences
  const detectSystemPreferences = useCallback(() => {
    // High contrast detection
    const isHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    // Reduced motion detection
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Color scheme detection
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Screen reader detection (basic heuristic)
    const isScreenReader = 'speechSynthesis' in window && 
      window.speechSynthesis.getVoices().length > 0;

    setState(prev => ({
      ...prev,
      isHighContrast,
      isReducedMotion,
      isScreenReader,
      colorScheme: isDarkMode ? 'dark' : 'light'
    }));

    // Apply system preferences to document
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    if (isReducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
  }, []);

  // Toggle functions
  const toggleHighContrast = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, isHighContrast: !prev.isHighContrast };
      document.documentElement.classList.toggle('high-contrast', newState.isHighContrast);
      return newState;
    });
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, isReducedMotion: !prev.isReducedMotion };
      document.documentElement.classList.toggle('reduced-motion', newState.isReducedMotion);
      return newState;
    });
  }, []);

  const toggleScreenReader = useCallback(() => {
    setState(prev => ({ ...prev, isScreenReader: !prev.isScreenReader }));
  }, []);

  const toggleKeyboardNavigation = useCallback(() => {
    setState(prev => ({ ...prev, isKeyboardNavigation: !prev.isKeyboardNavigation }));
  }, []);

  const setFocusMode = useCallback((mode: AccessibilityState['focusMode']) => {
    // Remove all focus mode classes
    document.documentElement.classList.remove(
      'focus-mode',
      'focus-mode-minimal',
      'anti-flash-mode'
    );

    // Add new focus mode class
    if (mode === 'focus') {
      document.documentElement.classList.add('focus-mode');
    } else if (mode === 'minimal') {
      document.documentElement.classList.add('focus-mode-minimal');
    } else if (mode === 'anti-flash') {
      document.documentElement.classList.add('anti-flash-mode');
    }

    setState(prev => ({ ...prev, focusMode: mode }));
  }, []);

  const setFontSize = useCallback((size: AccessibilityState['fontSize']) => {
    // Remove existing font size classes
    document.documentElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    
    // Add new font size class
    document.documentElement.classList.add(`font-size-${size}`);

    setState(prev => ({ ...prev, fontSize: size }));
  }, []);

  const setColorScheme = useCallback((scheme: AccessibilityState['colorScheme']) => {
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${scheme}-theme`);
    
    setState(prev => ({ ...prev, colorScheme: scheme }));
  }, []);

  // Focus management
  const focusElement = useCallback((element: HTMLElement | string) => {
    let targetElement: HTMLElement | null = null;

    if (typeof element === 'string') {
      targetElement = document.querySelector(element);
    } else {
      targetElement = element;
    }

    if (targetElement) {
      // Save current focus for history
      const currentFocus = document.activeElement as HTMLElement;
      if (currentFocus) {
        focusHistoryRef.current.push(currentFocus.tagName);
      }

      // Focus the element
      targetElement.focus({ preventScroll: false });

      // Ensure it's visible
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Screen reader announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const now = Date.now();
    
    // Prevent spam announcements
    if (now - lastAnnouncementRef.current < 1000) {
      return;
    }
    lastAnnouncementRef.current = now;

    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', priority);
      liveRegionRef.current.textContent = message;
      
      // Clear after a short delay
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }

    // Also try speech synthesis if available
    if ('speechSynthesis' in window && state.isScreenReader) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  }, [state.isScreenReader]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!state.isKeyboardNavigation) return;

    const { key, ctrlKey, shiftKey, altKey } = event;

    // Skip if typing in input/textarea
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && 
        (activeElement.tagName === 'INPUT' || 
         activeElement.tagName === 'TEXTAREA' || 
         activeElement.tagName === 'SELECT')) {
      return;
    }

    switch (key) {
      case 'Tab':
        // Enhanced tab navigation
        if (ctrlKey && shiftKey) {
          // Go to previous major section
          event.preventDefault();
          const sections = document.querySelectorAll('main, nav, aside, header, footer');
          const currentIndex = Array.from(sections).findIndex(s => s.contains(activeElement));
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : sections.length - 1;
          (sections[prevIndex] as HTMLElement)?.focus();
        } else if (ctrlKey) {
          // Go to next major section
          event.preventDefault();
          const sections = document.querySelectorAll('main, nav, aside, header, footer');
          const currentIndex = Array.from(sections).findIndex(s => s.contains(activeElement));
          const nextIndex = currentIndex < sections.length - 1 ? currentIndex + 1 : 0;
          (sections[nextIndex] as HTMLElement)?.focus();
        }
        break;

      case 'Escape':
        // Close modals, dropdowns, etc.
        const openDialogs = document.querySelectorAll('[role="dialog"][aria-hidden="false"]');
        if (openDialogs.length > 0) {
          event.preventDefault();
          (openDialogs[0] as HTMLElement).setAttribute('aria-hidden', 'true');
          announce('Dialog closed');
        }
        break;

      case 'Enter':
      case ' ':
        // Activate focused element
        if (activeElement && activeElement.click) {
          event.preventDefault();
          activeElement.click();
        }
        break;

      case '/':
        // Focus search
        if (!ctrlKey) {
          event.preventDefault();
          const searchInput = document.querySelector('input[type="search"], [role="searchbox"]') as HTMLElement;
          if (searchInput) {
            searchInput.focus();
          }
        }
        break;

      case 'k':
      case 'j':
        // Navigate lists (like in many web apps)
        if (ctrlKey) {
          event.preventDefault();
          const listItems = document.querySelectorAll('[role="listitem"], .list-item');
          const currentIndex = Array.from(listItems).findIndex(item => item === activeElement);
          
          if (key === 'k' && currentIndex > 0) {
            (listItems[currentIndex - 1] as HTMLElement)?.focus();
          } else if (key === 'j' && currentIndex < listItems.length - 1) {
            (listItems[currentIndex + 1] as HTMLElement)?.focus();
          }
        }
        break;
    }
  }, [state.isKeyboardNavigation, announce]);

  // ARIA live region setup
  useEffect(() => {
    // Create live region if it doesn't exist
    let liveRegion = document.getElementById('accessibility-live-region');
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'accessibility-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }

    (liveRegionRef.current as any) = liveRegion;
  }, []);

  // Apply accessibility classes to document
  useEffect(() => {
    const { isHighContrast, isReducedMotion, focusMode, fontSize, colorScheme } = state;

    // High contrast
    document.documentElement.classList.toggle('high-contrast', isHighContrast);

    // Reduced motion
    document.documentElement.classList.toggle('reduced-motion', isReducedMotion);

    // Focus mode
    document.documentElement.classList.remove('focus-mode', 'focus-mode-minimal', 'anti-flash-mode');
    if (focusMode !== 'normal') {
      document.documentElement.classList.add(focusMode === 'minimal' ? 'focus-mode-minimal' : 
                                            focusMode === 'anti-flash' ? 'anti-flash-mode' : 'focus-mode');
    }

    // Font size
    document.documentElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    document.documentElement.classList.add(`font-size-${fontSize}`);

    // Color scheme
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${colorScheme}-theme`);

    // Store preferences
    localStorage.setItem('accessibility-config', JSON.stringify(state));
  }, [state]);

  // Listen for system preference changes
  useEffect(() => {
    detectSystemPreferences();

    const mediaQueryLists = [
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-color-scheme: dark)')
    ];

    const handleChange = () => detectSystemPreferences();
    
    mediaQueryLists.forEach(mql => mql.addEventListener('change', handleChange));

    return () => {
      mediaQueryLists.forEach(mql => mql.removeEventListener('change', handleChange));
    };
  }, [detectSystemPreferences]);

  // Keyboard event listener
  useEffect(() => {
    if (state.isKeyboardNavigation) {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [state.isKeyboardNavigation, handleKeyDown]);

  // Load saved preferences
  useEffect(() => {
    const savedConfig = localStorage.getItem('accessibility-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setState(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.warn('Failed to load accessibility config:', e);
      }
    }
  }, []);

  return {
    state,
    actions: {
      toggleHighContrast,
      toggleReducedMotion,
      toggleScreenReader,
      toggleKeyboardNavigation,
      setFocusMode,
      setFontSize,
      setColorScheme,
      focusElement,
      announce
    }
  };
};

// Hook for focus management
export const useFocusManagement = () => {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<HTMLElement | null>(null);

  const trapFocus = useCallback((container: HTMLElement) => {
    focusTrapRef.current = container;
    previousFocusRef.current = document.activeElement as HTMLElement;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        } else if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else if (e.key === 'Escape') {
        releaseFocus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, []);

  const releaseFocus = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
    focusTrapRef.current = null;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, []);

  return {
    trapFocus,
    releaseFocus,
    restoreFocus
  };
};

// Hook for screen reader support
export const useScreenReaderSupport = () => {
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!isScreenReaderActive) return;

    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', priority);
      liveRegionRef.current.textContent = message;
      
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }
  }, [isScreenReaderActive]);

  const describeElement = useCallback((element: HTMLElement, description: string) => {
    if (!isScreenReaderActive) return;

    const id = `sr-description-${Math.random().toString(36).substr(2, 9)}`;
    element.setAttribute('aria-describedby', id);
    
    const descriptionElement = document.createElement('div');
    descriptionElement.id = id;
    descriptionElement.className = 'sr-only';
    descriptionElement.textContent = description;
    document.body.appendChild(descriptionElement);
  }, [isScreenReaderActive]);

  useEffect(() => {
    // Check if screen reader is likely active
    const checkScreenReader = () => {
      const isUsingScreenReader = 'speechSynthesis' in window && 
        window.speechSynthesis.getVoices().length > 0;
      
      setIsScreenReaderActive(isUsingScreenReader);
    };

    checkScreenReader();
    window.addEventListener('load', checkScreenReader);
    
    return () => window.removeEventListener('load', checkScreenReader);
  }, []);

  return {
    isScreenReaderActive,
    announce,
    describeElement
  };
};