import { ref, computed, onMounted, onUnmounted } from "vue";

interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  items: any[];
}

interface VirtualScrollResult {
  visibleItems: any[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  scrollToItem: (index: number) => void;
  updateItems: (newItems: any[]) => void;
}

export const useVirtualScroll = (options: VirtualScrollOptions): VirtualScrollResult => {
  const { itemHeight, containerHeight, overscan = 5, items } = options;

  const scrollTop = ref(0);
  const startIndex = ref(0);
  const containerRef = ref<HTMLElement | null>(null);

  const visibleItems = computed(() => {
    const start = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const end = Math.min(start + visibleCount, items.length);

    startIndex.value = start;
    return items.slice(start, end);
  });

  const endIndex = computed(() => {
    return Math.min(
      startIndex.value + Math.ceil(containerHeight / itemHeight) + overscan * 2,
      items.length
    );
  });

  const totalHeight = computed(() => {
    return items.length * itemHeight;
  });

  const scrollToItem = (index: number) => {
    if (containerRef.value) {
      const targetScrollTop = index * itemHeight;
      containerRef.value.scrollTop = targetScrollTop;
      scrollTop.value = targetScrollTop;
    }
  };

  const updateItems = (newItems: any[]) => {
    // Items will be updated reactively through the computed
  };

  const handleScroll = () => {
    if (containerRef.value) {
      scrollTop.value = containerRef.value.scrollTop;
    }
  };

  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener("scroll", handleScroll, { passive: true });
    }
  });

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener("scroll", handleScroll);
    }
  });

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    scrollToItem,
    updateItems,
  };
};
