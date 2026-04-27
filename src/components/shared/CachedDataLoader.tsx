import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnalysisResult } from "../../services/AnalysisBridge";

interface CachedDataLoaderProps {
  queryKey: string[];
  children: (data: any, isLoading: boolean, isStale: boolean) => React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that provides cached data to children while showing loading states
 * This helps with perceived performance by showing stale data immediately
 */
export const CachedDataLoader: React.FC<CachedDataLoaderProps> = ({
  queryKey,
  children,
  fallback,
}) => {
  const queryClient = useQueryClient();

  // Get cached data immediately (even if stale)
  const cachedData = queryClient.getQueryData(queryKey);

  // Check if data is stale
  const queryState = queryClient.getQueryState(queryKey);
  // @ts-ignore - isStale property
  const isStale = queryState?.isStale ?? true;
  // @ts-ignore - status comparison
  const isLoading = queryState?.status === "loading" || queryState?.fetchStatus === "fetching";

  // If we have cached data, show it immediately with a stale indicator
  if (cachedData) {
    return (
      <>
        {children(cachedData, isLoading, isStale)}
        {isStale && !isLoading && (
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              right: "20px",
              background: "rgba(59, 130, 246, 0.9)",
              color: "white",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              zIndex: 1000,
              animation: "fadeIn 0.3s ease",
            }}
          >
            🔄 Data refreshing...
          </div>
        )}
      </>
    );
  }

  // Show fallback while loading
  return <>{fallback || <div>Loading...</div>}</>;
};

// Hook version for functional components
export const useCachedData = (queryKey: string[]) => {
  const queryClient = useQueryClient();

  const cachedData = queryClient.getQueryData(queryKey);
  const queryState = queryClient.getQueryState(queryKey);

  return {
    data: cachedData,
    // @ts-ignore - isStale property
    isStale: queryState?.isStale ?? true,
    // @ts-ignore - status comparison
    isLoading: queryState?.status === "loading" || queryState?.fetchStatus === "fetching",
    hasData: !!cachedData,
  };
};

// Specialized hook for analysis data
export const useCachedAnalysis = (directoryPath: string | null) => {
  const queryKey = ["analysis", directoryPath];
  const { data, isStale, isLoading, hasData } = useCachedData(queryKey);

  return {
    analysisData: data as AnalysisResult | null,
    isStale,
    isLoading,
    hasData,
    // Computed values for performance
    totalFiles: (data as AnalysisResult)?.totalFiles || 0,
    totalSize: (data as AnalysisResult)?.totalSize || 0,
    fileCount: (data as AnalysisResult)?.files?.length || 0,
    hasInsights: !!(
      (data as AnalysisResult)?.ai_insights?.storage_warnings?.length ||
      (data as AnalysisResult)?.ai_insights?.optimization_suggestions?.length
    ),
  };
};

// Prefetch hook to warm up cache
export const usePrefetchAnalysis = () => {
  const queryClient = useQueryClient();

  const prefetch = async (directoryPath: string) => {
    const queryKey = ["analysis", directoryPath];

    // Only prefetch if not already cached or if stale
    const existingData = queryClient.getQueryData(queryKey);
    // @ts-ignore - isStale property
    const isStale = queryClient.getQueryState(queryKey)?.isStale ?? true;

    if (!existingData || isStale) {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: async (): Promise<AnalysisResult | null> => {
          const { AnalysisBridge } = await import("../../services/AnalysisBridge");
          const bridge = new AnalysisBridge();
          const result = await bridge.analyzeDirectory(directoryPath);
          return result;
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
      });
    }
  };

  return { prefetch };
};

// Cache status indicator component
export const CacheStatusIndicator: React.FC<{
  isStale: boolean;
  isLoading: boolean;
  lastUpdated?: Date;
}> = ({ isStale, isLoading, lastUpdated }) => {
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            border: "2px solid #e2e8f0",
            borderTop: "2px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        Updating...
      </div>
    );
  }

  if (isStale) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#f59e0b",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            background: "#f59e0b",
            borderRadius: "50%",
          }}
        />
        Data may be outdated
        {lastUpdated && <span>(updated {new Date(lastUpdated).toLocaleTimeString()})</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        color: "#10b981",
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          background: "#10b981",
          borderRadius: "50%",
        }}
      />
      Up to date
      {lastUpdated && <span>(updated {new Date(lastUpdated).toLocaleTimeString()})</span>}
    </div>
  );
};
