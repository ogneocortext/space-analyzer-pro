/* Responsive Design Hook for Space Analyzer */

import { useCallback, useEffect, useState, useRef } from 'react';

export interface Breakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

export interface ScreenSize {
  width: number;
  height: number;
  breakpoint: keyof Breakpoints;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
}

export interface ResponsiveConfig {
  breakpoints: Breakpoints;
  debounceMs: number;
  enableOrientation: boolean;
  enablePixelRatio: boolean;
}

export const DEFAULT_BREAKPOINTS: Breakpoints = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
};

export const useResponsiveDesign = (config?: Partial<ResponsiveConfig>) => {
  const finalConfig = {
    breakpoints: DEFAULT_BREAKPOINTS,
    debounceMs: 250,
    enableOrientation: true,
    enablePixelRatio: true,
    ...config
  };

  const timeoutRef = useRef<number | undefined>(undefined);

  const getBreakpoint = useCallback((width: number, breakpoints: Breakpoints): keyof Breakpoints => {
    if (width < breakpoints.sm) return 'xs';
    if (width < breakpoints.md) return 'sm';
    if (width < breakpoints.lg) return 'md';
    if (width < breakpoints.xl) return 'lg';
    if (width < breakpoints['2xl']) return 'xl';
    return '2xl';
  }, []);

  const [screenSize, setScreenSize] = useState<ScreenSize>(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const breakpoint = getBreakpoint(width, finalConfig.breakpoints);
    
    return {
      width,
      height,
      breakpoint,
      isMobile: width < finalConfig.breakpoints.md,
      isTablet: width >= finalConfig.breakpoints.md && width < finalConfig.breakpoints.lg,
      isDesktop: width >= finalConfig.breakpoints.lg,
      isLargeDesktop: width >= finalConfig.breakpoints['2xl'],
      orientation: width > height ? 'landscape' : 'portrait',
      pixelRatio: window.devicePixelRatio || 1
    };
  });

  const updateScreenSize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const breakpoint = getBreakpoint(width, finalConfig.breakpoints);

    setScreenSize({
      width,
      height,
      breakpoint,
      isMobile: width < finalConfig.breakpoints.md,
      isTablet: width >= finalConfig.breakpoints.md && width < finalConfig.breakpoints.lg,
      isDesktop: width >= finalConfig.breakpoints.lg,
      isLargeDesktop: width >= finalConfig.breakpoints['2xl'],
      orientation: finalConfig.enableOrientation ? (width > height ? 'landscape' : 'portrait') : 'landscape',
      pixelRatio: finalConfig.enablePixelRatio ? window.devicePixelRatio || 1 : 1
    });
  }, [getBreakpoint, finalConfig.breakpoints, finalConfig.enableOrientation, finalConfig.enablePixelRatio]);

  const debounceUpdate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = window.setTimeout(updateScreenSize, finalConfig.debounceMs);
  }, [updateScreenSize, finalConfig.debounceMs]);

  // Canvas responsive sizing
  const getCanvasSize = useCallback((containerWidth: number, containerHeight: number) => {
    const { isMobile, isTablet, isDesktop } = screenSize;
    
    let width = containerWidth;
    let height = containerHeight;

    // Adjust canvas size based on screen size
    if (isMobile) {
      // Mobile: prioritize height for better touch interaction
      height = Math.min(containerHeight, 400);
      width = containerWidth;
    } else if (isTablet) {
      // Tablet: balanced approach
      height = Math.min(containerHeight, 500);
      width = containerWidth;
    } else if (isDesktop) {
      // Desktop: larger canvas for detailed visualization
      height = Math.min(containerHeight, 600);
      width = containerWidth;
    }

    return { width, height };
  }, [screenSize]);

  // Font size scaling
  const getResponsiveFontSize = useCallback((baseSize: number) => {
    const { isMobile, isTablet, isDesktop } = screenSize;
    
    if (isMobile) {
      return baseSize * 0.9; // Slightly smaller on mobile
    } else if (isTablet) {
      return baseSize * 0.95; // Slightly smaller on tablet
    } else {
      return baseSize; // Full size on desktop
    }
  }, [screenSize]);

  // Spacing scaling
  const getResponsiveSpacing = useCallback((baseSpacing: number) => {
    const { isMobile, isTablet, isDesktop } = screenSize;
    
    if (isMobile) {
      return baseSpacing * 0.8; // Compact spacing on mobile
    } else if (isTablet) {
      return baseSpacing * 0.9; // Slightly compact on tablet
    } else {
      return baseSpacing; // Full spacing on desktop
    }
  }, [screenSize]);

  // Component visibility based on screen size
  const shouldShowComponent = useCallback((component: 'sidebar' | 'header' | 'footer' | 'toolbar') => {
    const { isMobile, isTablet, isDesktop } = screenSize;
    
    switch (component) {
      case 'sidebar':
        return isDesktop || isTablet; // Hide sidebar on mobile
      case 'header':
        return true; // Always show header
      case 'footer':
        return isDesktop; // Hide footer on mobile and tablet
      case 'toolbar':
        return isDesktop; // Hide toolbar on mobile
      default:
        return true;
    }
  }, [screenSize]);

  // Touch target sizing
  const getTouchTargetSize = useCallback(() => {
    const { isMobile, isTablet } = screenSize;
    
    if (isMobile) {
      return 44; // Minimum touch target size for mobile
    } else if (isTablet) {
      return 40; // Slightly smaller for tablet
    } else {
      return 32; // Standard size for desktop
    }
  }, [screenSize]);

  // Animation duration scaling
  const getResponsiveAnimationDuration = useCallback((baseDuration: number) => {
    const { isMobile, isTablet } = screenSize;
    
    if (isMobile) {
      return baseDuration * 0.8; // Faster animations on mobile
    } else if (isTablet) {
      return baseDuration * 0.9; // Slightly faster on tablet
    } else {
      return baseDuration; // Standard duration on desktop
    }
  }, [screenSize]);

  // Image quality scaling
  const getResponsiveImageQuality = useCallback(() => {
    const { isMobile, isTablet, isDesktop, pixelRatio } = screenSize;
    
    if (isMobile) {
      return Math.min(0.7, 1 / pixelRatio); // Lower quality on mobile
    } else if (isTablet) {
      return Math.min(0.85, 1 / pixelRatio); // Medium quality on tablet
    } else {
      return 1; // Full quality on desktop
    }
  }, [screenSize]);

  // Grid columns calculation
  const getGridColumns = useCallback((baseColumns: number) => {
    const { isMobile, isTablet, isDesktop } = screenSize;
    
    if (isMobile) {
      return Math.min(1, baseColumns); // Single column on mobile
    } else if (isTablet) {
      return Math.min(2, baseColumns); // Up to 2 columns on tablet
    } else {
      return baseColumns; // Full columns on desktop
    }
  }, [screenSize]);

  // Chart dimensions
  const getChartDimensions = useCallback((containerWidth: number, containerHeight: number) => {
    const { isMobile, isTablet, isDesktop } = screenSize;
    
    let width = containerWidth;
    let height = containerHeight;

    if (isMobile) {
      height = Math.min(containerHeight, 300);
      width = containerWidth;
    } else if (isTablet) {
      height = Math.min(containerHeight, 400);
      width = containerWidth;
    } else {
      height = Math.min(containerHeight, 500);
      width = containerWidth;
    }

    return { width, height };
  }, [screenSize]);

  // Initialize and cleanup
  useEffect(() => {
    updateScreenSize();

    const handleResize = () => {
      debounceUpdate();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [updateScreenSize, debounceUpdate]);

  return {
    screenSize,
    getCanvasSize,
    getResponsiveFontSize,
    getResponsiveSpacing,
    shouldShowComponent,
    getTouchTargetSize,
    getResponsiveAnimationDuration,
    getResponsiveImageQuality,
    getGridColumns,
    getChartDimensions,
    config: finalConfig
  };
};

// Hook for viewport units
export const useViewportUnits = () => {
  const [viewport, setViewport] = useState({
    vw: 0,
    vh: 0,
    vmin: 0,
    vmax: 0
  });

  const updateViewport = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vmin = Math.min(vw, vh);
    const vmax = Math.max(vw, vh);

    setViewport({ vw, vh, vmin, vmax });
  }, []);

  useEffect(() => {
    updateViewport();

    const handleResize = () => {
      updateViewport();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [updateViewport]);

  return viewport;
};

// Hook for CSS-in-JS responsive styles
export const useResponsiveStyles = () => {
  const { screenSize } = useResponsiveDesign();

  const getResponsiveStyle = useCallback((styles: Record<string, any>) => {
    const { isMobile, isTablet, isDesktop } = screenSize;
    
    const baseStyle = styles.base || {};
    const mobileStyle = styles.mobile || {};
    const tabletStyle = styles.tablet || {};
    const desktopStyle = styles.desktop || {};

    if (isMobile) {
      return { ...baseStyle, ...mobileStyle };
    } else if (isTablet) {
      return { ...baseStyle, ...tabletStyle };
    } else {
      return { ...baseStyle, ...desktopStyle };
    }
  }, [screenSize]);

  return { getResponsiveStyle };
};

// Hook for responsive typography
export const useResponsiveTypography = () => {
  const { screenSize } = useResponsiveDesign();

  const getFontSize = useCallback((size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl') => {
    const baseSizes = {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36
    };

    const baseSize = baseSizes[size];
    const { isMobile, isTablet } = screenSize;

    if (isMobile) {
      return baseSize * 0.9;
    } else if (isTablet) {
      return baseSize * 0.95;
    } else {
      return baseSize;
    }
  }, [screenSize]);

  const getLineHeight = useCallback((fontSize: number) => {
    const { isMobile } = screenSize;
    
    if (isMobile) {
      return fontSize * 1.6; // More line height on mobile for readability
    } else {
      return fontSize * 1.4;
    }
  }, [screenSize]);

  return { getFontSize, getLineHeight };
};