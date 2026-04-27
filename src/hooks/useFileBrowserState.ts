// Custom hook for managing file browser state
import { useState, useCallback } from "react";

interface FileBrowserState {
  searchQuery: string;
  sortBy: "name" | "size" | "date";
  sortOrder: "asc" | "desc";
  filterType: string;
  pageSize: number;
  currentPage: number;
}

export const useFileBrowserState = () => {
  const [state, setState] = useState<FileBrowserState>({
    searchQuery: "",
    sortBy: "name",
    sortOrder: "asc",
    filterType: "all",
    pageSize: 50,
    currentPage: 1,
  });

  const setSearchQuery = useCallback((searchQuery: string) => {
    setState((prev) => ({ ...prev, searchQuery }));
  }, []);

  const setSortBy = useCallback((sortBy: "name" | "size" | "date") => {
    setState((prev) => ({ ...prev, sortBy }));
  }, []);

  const setSortOrder = useCallback((sortOrder: "asc" | "desc") => {
    setState((prev) => ({ ...prev, sortOrder }));
  }, []);

  const setFilterType = useCallback((filterType: string) => {
    setState((prev) => ({ ...prev, filterType }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setState((prev) => ({ ...prev, pageSize, currentPage: 1 })); // Reset to first page
  }, []);

  const setCurrentPage = useCallback((currentPage: number) => {
    setState((prev) => ({ ...prev, currentPage }));
  }, []);

  const resetFilters = useCallback(() => {
    setState({
      searchQuery: "",
      sortBy: "name",
      sortOrder: "asc",
      filterType: "all",
      pageSize: 50,
      currentPage: 1,
    });
  }, []);

  return {
    ...state,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    setFilterType,
    setPageSize,
    setCurrentPage,
    resetFilters,
  };
};
