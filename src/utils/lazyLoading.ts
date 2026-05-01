/**
 * Lazy Loading Utilities
 * Implements code splitting and lazy loading for better performance
 */

// Vue-compatible lazy loading utilities

// Lazy component wrapper for Vue
export const LazyComponent = <T extends any>(loaderFunc: () => Promise<{ default: T }>) => {
  // In Vue, we use defineAsyncComponent instead of React.lazy
  return loaderFunc;
};

// Preload important components
export const preloadComponents = async () => {
  try {
    // Preload dashboard components with correct paths
    const { default: DashboardView } = await import("../components/vue/SpaceAnalyzerDashboard.vue");
    const { default: AnalysisResults } =
      await import("../components/vue/analysis/AnalysisResults.vue");
    const { default: FileExplorer } = await import("../components/vue/browser/FileExplorer.vue");

    return {
      DashboardView,
      AnalysisResults,
      FileExplorer,
    };
  } catch (error) {
    console.warn("Some components could not be preloaded:", error);
    return {
      DashboardView: null,
      AnalysisResults: null,
      FileExplorer: null,
    };
  }
};

// Intersection Observer for lazy loading - Vue version
export const useIntersectionObserver = (
  element: HTMLElement,
  onIntersect: () => void,
  options?: IntersectionObserverInit
) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        onIntersect();
      }
    });
  }, options);

  if (element) {
    observer.observe(element);
  }

  const cleanup = () => {
    if (element) {
      observer.unobserve(element);
    }
    observer.disconnect();
  };

  return cleanup;
};

// Dynamic import helper
export const dynamicImport = async <T>(importFunc: () => Promise<T>): Promise<T> => {
  try {
    return await importFunc();
  } catch (error) {
    console.error("Failed to load component:", error);
    throw error;
  }
};
