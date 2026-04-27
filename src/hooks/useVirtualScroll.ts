import { useState, useEffect, useCallback, useMemo } from "react";

interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  items: any[];
}

interface VirtualScrollResult {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
  visibleItems: any[];
}

export const useVirtualScroll = ({
  itemHeight,
  containerHeight,
  overscan = 5,
  items,
}: VirtualScrollOptions): VirtualScrollResult => {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount + overscan, items.length);

    return {
      start: Math.max(0, start - overscan),
      end,
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange]);

  const offsetY = visibleRange.start * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleRange,
    totalHeight,
    offsetY,
    visibleItems,
  };
};

// Performance monitoring hook
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    memoryUsage: 0,
    fps: 60,
  });

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measurePerformance = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

        // Get memory usage if available
        const memory = (performance as any).memory;
        const memoryUsage = memory ? memory.usedJSHeapSize / 1048576 : 0; // MB

        setMetrics({
          renderTime: currentTime - lastTime,
          memoryUsage,
          fps,
        });

        frameCount = 0;
        lastTime = currentTime;
      }

      animationId = requestAnimationFrame(measurePerformance);
    };

    animationId = requestAnimationFrame(measurePerformance);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return metrics;
};

// Debounced search hook for better performance
export const useDebouncedSearch = (searchTerm: string, delay: number = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(searchTerm);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, delay]);

  return debouncedValue;
};

// Lazy loading hook for large datasets
export const useLazyLoad = (items: any[], batchSize: number = 50) => {
  const [loadedItems, setLoadedItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);

    // Simulate async loading (replace with actual API call)
    setTimeout(() => {
      const currentLength = loadedItems.length;
      const nextBatch = items.slice(currentLength, currentLength + batchSize);

      if (nextBatch.length === 0) {
        setHasMore(false);
      } else {
        setLoadedItems((prev) => [...prev, ...nextBatch]);
      }

      setIsLoading(false);
    }, 100);
  }, [items, loadedItems.length, batchSize, isLoading, hasMore]);

  // Initial load
  useEffect(() => {
    if (items.length > 0 && loadedItems.length === 0) {
      loadMore();
    }
  }, [items, loadMore, loadedItems.length]);

  // Reset when items change
  useEffect(() => {
    setLoadedItems([]);
    setHasMore(true);
    setIsLoading(false);
  }, [items]);

  return {
    loadedItems,
    hasMore,
    isLoading,
    loadMore,
  };
};

// Memoized expensive computations
export const useMemoizedAnalysis = (data: any, dependencies: any[] = []) => {
  return useMemo(() => {
    if (!data) return null;

    // Expensive computation that should be memoized
    const stats = {
      totalFiles: data.totalFiles || 0,
      totalSize: data.totalSize || 0,
      categories: Object.keys(data.categories || {}),
      largestFiles: (data.files || [])
        .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
        .slice(0, 10),
      fileTypes: (data.files || []).reduce((acc: any, file: any) => {
        const ext = file.name?.split(".").pop()?.toLowerCase() || "no-ext";
        acc[ext] = (acc[ext] || 0) + 1;
        return acc;
      }, {}),
      sizeDistribution: (data.files || []).reduce(
        (acc: any, file: any) => {
          const size = file.size || 0;
          if (size < 1024 * 1024) acc.small++;
          else if (size < 100 * 1024 * 1024) acc.medium++;
          else acc.large++;
          return acc;
        },
        { small: 0, medium: 0, large: 0 }
      ),
    };

    return stats;
  }, [data, ...dependencies]);
};
