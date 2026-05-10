import { ref, computed, onMounted, onUnmounted, Ref } from "vue";

interface VirtualScrollOptions {
  items: any[];
  estimateSize?: (index: number) => number;
  overscan?: number;
  enableDynamicSizing?: boolean;
  bufferSize?: number;
}

interface VirtualScrollReturn {
  visibleItems: any[];
  totalSize: number;
  scrollElement: Ref<HTMLElement | null>;
  scrollToIndex: (index: number) => void;
  scrollToOffset: (offset: number) => void;
}

export const useEnhancedVirtualScroll = (options: VirtualScrollOptions): VirtualScrollReturn => {
  const {
    items,
    estimateSize = () => 50,
    overscan = 5,
    _enableDynamicSizing = false,
    bufferSize = 10,
  } = options;

  const containerRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const containerHeight = ref(0);
  const startIndex = ref(0);
  const endIndex = ref(0);

  const visibleItems = computed(() => {
    return items.slice(startIndex.value, endIndex.value);
  });

  const totalSize = computed(() => {
    return items.reduce((sum, _item, index) => {
      return sum + (estimateSize ? estimateSize(index) : 50);
    }, 0);
  });

  const updateVisibleRange = () => {
    if (!containerRef.value) return;

    const height = containerRef.value.clientHeight;
    containerHeight.value = height;

    let accumulatedHeight = 0;
    let start = startIndex.value;
    let end = endIndex.value;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const itemHeight = estimateSize ? estimateSize(i) : 50;
      if (accumulatedHeight >= scrollTop.value - overscan) {
        start = i;
        break;
      }
      accumulatedHeight += itemHeight;
    }

    // Find end index
    accumulatedHeight = 0;
    for (let i = start; i < items.length; i++) {
      const itemHeight = estimateSize ? estimateSize(i) : 50;
      if (accumulatedHeight > scrollTop.value + height + overscan) {
        end = i;
        break;
      }
      accumulatedHeight += itemHeight;
    }

    startIndex.value = start;
    endIndex.value = Math.min(end + bufferSize, items.length);
  };

  const scrollToIndex = (index: number) => {
    if (!containerRef.value) return;

    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += estimateSize ? estimateSize(i) : 50;
    }

    containerRef.value.scrollTop = offset;
  };

  const scrollToOffset = (offset: number) => {
    if (containerRef.value) {
      containerRef.value.scrollTop = offset;
    }
  };

  const handleScroll = () => {
    scrollTop.value = containerRef.value?.scrollTop || 0;
    updateVisibleRange();
  };

  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener("scroll", handleScroll, { passive: true });
      updateVisibleRange();
    }
  });

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener("scroll", handleScroll);
    }
  });

  return {
    visibleItems: visibleItems.value,
    totalSize: totalSize.value,
    scrollElement: containerRef,
    scrollToIndex,
    scrollToOffset,
  };
};
