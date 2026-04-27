import { useCallback, useRef, useMemo, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualScrollOptions {
  items: any[];
  estimateSize?: (index: number) => number;
  overscan?: number;
  enableDynamicSizing?: boolean;
  bufferSize?: number;
}

interface FilterOptions {
  types?: string[];
  frameworks?: string[];
  status?: string[];
  minAccuracy?: number;
  maxGpuMemory?: number;
  tags?: string[];
}

interface PerformanceMetrics {
  renderTime: number;
  filterTime: number;
  scrollTime: number;
  memoryUsage: number;
  itemCount: number;
}

export const useEnhancedVirtualScroll = ({
  items,
  estimateSize = () => 80,
  overscan = 10,
  enableDynamicSizing = true,
  bufferSize = 1000,
}: VirtualScrollOptions) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    filterTime: 0,
    scrollTime: 0,
    memoryUsage: 0,
    itemCount: items.length,
  });

  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({});
  const [filteredItems, setFilteredItems] = useState(items);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    enabled: enableDynamicSizing,
  });

  // Performance monitoring
  const measurePerformance = useCallback((operation: string, fn: () => void) => {
    const start = performance.now();
    fn();
    const end = performance.now();

    setPerformanceMetrics((prev) => ({
      ...prev,
      [operation === "render"
        ? "renderTime"
        : operation === "filter"
          ? "filterTime"
          : "scrollTime"]: end - start,
    }));
  }, []);

  // Advanced filtering with metadata
  const filterByMetadata = useCallback(
    (filterOptions: FilterOptions) => {
      const startTime = performance.now();

      const filtered = items.filter((item) => {
        // Type filter
        if (filterOptions.types && filterOptions.types.length > 0) {
          if (!filterOptions.types.includes(item.type)) return false;
        }

        // Framework filter
        if (filterOptions.frameworks && filterOptions.frameworks.length > 0) {
          if (!filterOptions.frameworks.includes(item.framework)) return false;
        }

        // Status filter
        if (filterOptions.status && filterOptions.status.length > 0) {
          if (!filterOptions.status.includes(item.status)) return false;
        }

        // Accuracy filter
        if (filterOptions.minAccuracy !== undefined) {
          if (item.accuracy < filterOptions.minAccuracy) return false;
        }

        // GPU Memory filter
        if (filterOptions.maxGpuMemory !== undefined && filterOptions.maxGpuMemory < Infinity) {
          if (item.gpuMemory > filterOptions.maxGpuMemory) return false;
        }

        // Tags filter
        if (filterOptions.tags && filterOptions.tags.length > 0) {
          const hasMatchingTag = filterOptions.tags.some(
            (tag) => item.tags && item.tags.includes(tag)
          );
          if (!hasMatchingTag) return false;
        }

        return true;
      });

      const endTime = performance.now();

      setFilteredItems(filtered);
      setPerformanceMetrics((prev) => ({
        ...prev,
        filterTime: endTime - startTime,
        itemCount: filtered.length,
      }));

      return filtered;
    },
    [items]
  );

  // Scroll handling with debouncing
  const handleScroll = useCallback(() => {
    setIsScrolling(true);

    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    const timeout = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    setScrollTimeout(timeout);
  }, [scrollTimeout]);

  // Batch selection
  const batchSelectItems = useCallback(
    (startIndex: number, endIndex: number, selected: Set<string>) => {
      const newSelection = new Set(selected);

      for (let i = startIndex; i <= endIndex && i < filteredItems.length; i++) {
        const item = filteredItems[i];
        if (item) {
          if (newSelection.has(item.path || item.id)) {
            newSelection.delete(item.path || item.id);
          } else {
            newSelection.add(item.path || item.id);
          }
        }
      }

      return newSelection;
    },
    [filteredItems]
  );

  // Scroll to specific item
  const scrollToItem = useCallback(
    (index: number, alignment: "start" | "center" | "end" = "start") => {
      // @ts-ignore - alignment property
      virtualizer.scrollToIndex(index, { alignment });
    },
    [virtualizer]
  );

  // Get visible range
  const visibleRange = useMemo(() => {
    // @ts-ignore - getRange method
    const range = virtualizer.getRange();
    return {
      start: range.startIndex,
      end: range.endIndex,
      count: range.endIndex - range.startIndex,
    };
  }, [virtualizer]);

  // Check if item is visible
  const isItemVisible = useCallback(
    (index: number) => {
      return index >= visibleRange.start && index <= visibleRange.end;
    },
    [visibleRange]
  );

  // Memory usage estimation
  useEffect(() => {
    const estimateMemoryUsage = () => {
      const itemSize = 200; // Estimated bytes per item
      const totalMemory = filteredItems.length * itemSize;
      const visibleMemory = visibleRange.count * itemSize;

      setPerformanceMetrics((prev) => ({
        ...prev,
        memoryUsage: totalMemory + visibleMemory,
      }));
    };

    estimateMemoryUsage();
  }, [filteredItems.length, visibleRange.count]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [scrollTimeout]);

  // Update filtered items when filters change
  useEffect(() => {
    filterByMetadata(filters);
  }, [filters, filterByMetadata]);

  return {
    parentRef,
    virtualizer,
    filteredItems,
    visibleRange,
    isScrolling,
    performanceMetrics,
    filterByMetadata,
    scrollToItem,
    batchSelectItems,
    handleScroll,
    isItemVisible,
    setFilters,
  };
};
