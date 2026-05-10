// Custom hook for managing file browser state
import { ref, computed } from "vue";

interface FileBrowserState {
  searchQuery: string;
  sortBy: "name" | "size" | "date";
  sortOrder: "asc" | "desc";
  filterType: string;
  pageSize: number;
  currentPage: number;
}

export interface UseFileBrowserStateReturn {
  state: FileBrowserState;
  updateSearchQuery: (query: string) => void;
  updateSortBy: (sortBy: string) => void;
  updateSortOrder: (order: "asc" | "desc") => void;
  updateFilterType: (type: string) => void;
  updatePageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  resetState: () => void;
}

export const useFileBrowserState = (
  initialState: Partial<FileBrowserState> = {}
): UseFileBrowserStateReturn => {
  const state = ref<FileBrowserState>({
    searchQuery: "",
    sortBy: "name",
    sortOrder: "asc",
    filterType: "all",
    pageSize: 50,
    currentPage: 1,
    ...initialState,
  });

  const totalPages = computed(() => Math.ceil(100 / state.value.pageSize)); // Assuming 100 total items

  const updateSearchQuery = (query: string) => {
    state.value.searchQuery = query;
    state.value.currentPage = 1; // Reset to first page when searching
  };

  const updateSortBy = (sortBy: "name" | "size" | "date") => {
    state.value.sortBy = sortBy;
  };

  const updateSortOrder = (order: "asc" | "desc") => {
    state.value.sortOrder = order;
  };

  const updateFilterType = (type: string) => {
    state.value.filterType = type;
  };

  const updatePageSize = (size: number) => {
    state.value.pageSize = size;
    state.value.currentPage = 1; // Reset to first page
  };

  const nextPage = () => {
    if (state.value.currentPage < totalPages.value) {
      state.value.currentPage++;
    }
  };

  const previousPage = () => {
    if (state.value.currentPage > 1) {
      state.value.currentPage--;
    }
  };

  const resetState = () => {
    state.value = {
      searchQuery: "",
      sortBy: "name",
      sortOrder: "asc",
      filterType: "all",
      pageSize: 50,
      currentPage: 1,
    };
  };

  return {
    state: state.value,
    updateSearchQuery,
    updateSortBy,
    updateSortOrder,
    updateFilterType,
    updatePageSize,
    nextPage,
    previousPage,
    resetState,
  };
};
