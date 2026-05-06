/* Responsive Design Hook for Space Analyzer */

import { ref, computed, onMounted, onUnmounted } from "vue";

export interface Breakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface UseResponsiveDesignReturn {
  currentBreakpoint: keyof Breakpoints;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  windowWidth: number;
  windowHeight: number;
  updateBreakpoints: (newBreakpoints: Partial<Breakpoints>) => void;
}

export const useResponsiveDesign = (customBreakpoints: Partial<Breakpoints> = {}): UseResponsiveDesignReturn => {
  const defaultBreakpoints: Breakpoints = {
    xs: 320,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    ...customBreakpoints
  };

  const windowWidth = ref(window.innerWidth);
  const windowHeight = ref(window.innerHeight);
  const breakpoints = ref<Breakpoints>(defaultBreakpoints);

  const currentBreakpoint = computed((): keyof Breakpoints => {
    const width = windowWidth.value;
    if (width < breakpoints.value.sm) return 'xs';
    if (width < breakpoints.value.md) return 'sm';
    if (width < breakpoints.value.lg) return 'md';
    if (width < breakpoints.value.xl) return 'lg';
    return 'xl';
  });

  const isMobile = computed(() => ['xs', 'sm'].includes(currentBreakpoint.value));
  const isTablet = computed(() => currentBreakpoint.value === 'md');
  const isDesktop = computed(() => ['lg', 'xl'].includes(currentBreakpoint.value));

  const updateBreakpoints = (newBreakpoints: Partial<Breakpoints>) => {
    breakpoints.value = { ...breakpoints.value, ...newBreakpoints };
  };

  const handleResize = () => {
    windowWidth.value = window.innerWidth;
    windowHeight.value = window.innerHeight;
  };

  onMounted(() => {
    window.addEventListener('resize', handleResize);
    handleResize();
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });

  return {
    currentBreakpoint,
    isMobile,
    isTablet,
    isDesktop,
    windowWidth,
    windowHeight,
    updateBreakpoints,
  };
};
