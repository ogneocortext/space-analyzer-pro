/**
 * Lazy Loading Utilities
 * Implements code splitting and lazy loading for better performance
 */

import * as React from "react";
import { lazy } from "react";
import type { ComponentType } from "react";

// Lazy component wrapper with loading state
export const LazyComponent = <T extends ComponentType<any>>(
  loaderFunc: () => Promise<{ default: T }>,
  fallback: any = () => (React as any).createElement("div", null, "Loading...")
) => {
  const LazyComponent = lazy(loaderFunc);

  return LazyComponent;
};

// Preload important components
export const preloadComponents = async () => {
  // Preload dashboard components
  const { default: DashboardView } = await import("../components/SpaceAnalyzerDashboard");
  const { default: AnalysisResults } = await import("../components/AnalysisResults");
  const { default: FileExplorer } = await import("../components/FileExplorer");

  return {
    DashboardView,
    AnalysisResults,
    FileExplorer,
  };
};

// Intersection Observer for lazy loading
export const useIntersectionObserver = (
  ref: any,
  onIntersect: () => void,
  options?: IntersectionObserverInit
) => {
  React.useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onIntersect();
        }
      });
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
      observer.disconnect();
    };
  }, [ref, onIntersect, options]);
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
