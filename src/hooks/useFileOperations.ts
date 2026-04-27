import { useState, useCallback, useEffect, useMemo } from "react";
import { useMemoizedCallback } from "../utils/memoization";
import { fileCache } from "../services/cache/APICache";
import {
  transformFileData,
  filterFiles,
  sortFiles,
  TransformedFileData,
} from "../utils/dataTransformers";

export interface FileOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface FileFilters {
  search?: string;
  categories?: string[];
  sizeRange?: [number, number];
  dateRange?: [Date, Date];
  extensions?: string[];
}

export interface FileSortOptions {
  sortBy: "name" | "size" | "modified" | "type" | "path";
  direction: "asc" | "desc";
}

export const useFileOperations = (initialPath?: string) => {
  // Core state
  const [files, setFiles] = useState<TransformedFileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState(initialPath || "");

  // Filtering and sorting state
  const [filters, setFilters] = useState<FileFilters>({});
  const [sortOptions, setSortOptions] = useState<FileSortOptions>({
    sortBy: "name",
    direction: "asc",
  });

  // Computed filtered and sorted files
  const processedFiles = useMemo(() => {
    let result = files;

    // Apply filters
    if (Object.keys(filters).length > 0) {
      result = filterFiles(result, filters);
    }

    // Apply sorting
    result = sortFiles(result, sortOptions.sortBy, sortOptions.direction);

    return result;
  }, [files, filters, sortOptions]);

  // Load files from directory
  const loadFiles = useCallback(
    async (path: string = currentPath): Promise<FileOperationResult> => {
      setLoading(true);
      setError(null);

      try {
        // Check cache first
        const cacheKey = `files_${path}`;
        const cachedData = fileCache.get<TransformedFileData[]>(cacheKey);

        if (cachedData) {
          setFiles(cachedData);
          setCurrentPath(path);
          setLoading(false);
          return { success: true, data: cachedData };
        }

        // In a real implementation, this would call your file system service
        // For now, we'll simulate the API call
        const rawFileData = await simulateFileSystemCall(path);

        // Transform the data
        const transformedData = transformFileData(rawFileData);

        // Cache the result
        fileCache.set(cacheKey, transformedData, 10 * 60 * 1000); // 10 minutes

        setFiles(transformedData);
        setCurrentPath(path);
        setLoading(false);

        return { success: true, data: transformedData };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load files";
        setError(errorMessage);
        setLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    [currentPath]
  );

  // Search files
  const searchFiles = useMemoizedCallback((query: string) => {
    setFilters((prev) => ({ ...prev, search: query }));
  }, []);

  // Filter by category
  const filterByCategory = useMemoizedCallback((categories: string[]) => {
    setFilters((prev) => ({ ...prev, categories }));
  }, []);

  // Filter by size range
  const filterBySize = useMemoizedCallback((minSize?: number, maxSize?: number) => {
    const sizeRange =
      minSize !== undefined && maxSize !== undefined ? [minSize, maxSize] : undefined;
    setFilters((prev) => ({ ...prev, sizeRange: sizeRange as [number, number] }));
  }, []);

  // Filter by date range
  const filterByDate = useMemoizedCallback((startDate?: Date, endDate?: Date) => {
    const dateRange = startDate && endDate ? [startDate, endDate] : undefined;
    setFilters((prev) => ({ ...prev, dateRange: dateRange as [Date, Date] }));
  }, []);

  // Sort files
  const sortFilesBy = useMemoizedCallback(
    (sortBy: FileSortOptions["sortBy"], direction?: FileSortOptions["direction"]) => {
      setSortOptions((prev) => ({
        sortBy,
        direction:
          direction || (prev.sortBy === sortBy && prev.direction === "asc" ? "desc" : "asc"),
      }));
    },
    []
  );

  // Clear all filters
  const clearFilters = useMemoizedCallback(() => {
    setFilters({});
    setSortOptions({ sortBy: "name", direction: "asc" });
  }, []);

  // File selection operations
  const selectFile = useMemoizedCallback((fileId: string) => {
    setSelectedFiles((prev) => new Set([...prev, fileId]));
  }, []);

  const deselectFile = useMemoizedCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
  }, []);

  const toggleFileSelection = useMemoizedCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  }, []);

  const selectAllFiles = useMemoizedCallback(() => {
    setSelectedFiles(new Set(processedFiles.map((f) => f.id)));
  }, [processedFiles]);

  const clearSelection = useMemoizedCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  // Bulk operations
  const deleteSelectedFiles = useMemoizedCallback(async (): Promise<FileOperationResult> => {
    if (selectedFiles.size === 0) {
      return { success: false, error: "No files selected" };
    }

    try {
      // In a real implementation, this would call your file system service
      const selectedFileIds = Array.from(selectedFiles);
      await simulateBulkDelete(selectedFileIds);

      // Remove from local state
      setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.id)));

      // Clear selection
      clearSelection();

      // Invalidate cache
      fileCache.invalidate(`files_${currentPath}`);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete files";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [selectedFiles, currentPath]);

  const moveSelectedFiles = useMemoizedCallback(
    async (destinationPath: string): Promise<FileOperationResult> => {
      if (selectedFiles.size === 0) {
        return { success: false, error: "No files selected" };
      }

      try {
        // In a real implementation, this would call your file system service
        const selectedFileIds = Array.from(selectedFiles);
        await simulateBulkMove(selectedFileIds, destinationPath);

        // Remove from current directory
        setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.id)));

        // Clear selection
        clearSelection();

        // Invalidate caches
        fileCache.invalidate(`files_${currentPath}`);
        fileCache.invalidate(`files_${destinationPath}`);

        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to move files";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [selectedFiles, currentPath]
  );

  // Navigation
  const navigateToDirectory = useMemoizedCallback(
    async (path: string): Promise<FileOperationResult> => {
      return await loadFiles(path);
    },
    [loadFiles]
  );

  const goUpDirectory = useMemoizedCallback(async (): Promise<FileOperationResult> => {
    const parentPath = getParentDirectory(currentPath);
    if (parentPath !== currentPath) {
      return await loadFiles(parentPath);
    }
    return { success: false, error: "Already at root directory" };
  }, [currentPath, loadFiles]);

  // Refresh current directory
  const refresh = useMemoizedCallback(async (): Promise<FileOperationResult> => {
    fileCache.delete(`files_${currentPath}`);
    return await loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  // Statistics
  const statistics = useMemo(() => {
    const selectedFileObjects = processedFiles.filter((f) => selectedFiles.has(f.id));
    const totalSelectedSize = selectedFileObjects.reduce((sum, f) => sum + f.size, 0);

    return {
      totalFiles: processedFiles.length,
      selectedFiles: selectedFiles.size,
      totalSize: processedFiles.reduce((sum, f) => sum + f.size, 0),
      selectedSize: totalSelectedSize,
      directories: processedFiles.filter((f) => f.isDirectory).length,
      categories: [...new Set(processedFiles.map((f) => f.category))],
    };
  }, [processedFiles, selectedFiles]);

  // Initialize with default path
  useEffect(() => {
    if (initialPath && files.length === 0 && !loading) {
      loadFiles(initialPath);
    }
  }, [initialPath, files.length, loading, loadFiles]);

  return {
    // Data
    files: processedFiles,
    selectedFiles,
    currentPath,
    loading,
    error,

    // Statistics
    statistics,

    // Filtering and sorting
    filters,
    sortOptions,

    // Operations
    loadFiles,
    searchFiles,
    filterByCategory,
    filterBySize,
    filterByDate,
    sortFilesBy,
    clearFilters,

    // Selection
    selectFile,
    deselectFile,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,

    // Bulk operations
    deleteSelectedFiles,
    moveSelectedFiles,

    // Navigation
    navigateToDirectory,
    goUpDirectory,
    refresh,
  };
};

// Helper functions (would be replaced with real file system calls)
async function simulateFileSystemCall(path: string) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock data - in real implementation, this would call your file system service
  return [
    {
      name: "Documents",
      path: `${path}/Documents`,
      size: 0,
      modified: new Date(),
      type: "directory",
    },
    {
      name: "Images",
      path: `${path}/Images`,
      size: 0,
      modified: new Date(),
      type: "directory",
    },
    {
      name: "app.js",
      path: `${path}/app.js`,
      size: 1024,
      modified: new Date(),
      type: "file",
    },
    {
      name: "styles.css",
      path: `${path}/styles.css`,
      size: 2048,
      modified: new Date(),
      type: "file",
    },
  ];
}

async function simulateBulkDelete(fileIds: string[]) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.warn("Deleted files:", fileIds);
}

async function simulateBulkMove(fileIds: string[], destination: string) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.warn("Moved files:", fileIds, "to:", destination);
}

function getParentDirectory(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length > 0 ? "/" + parts.join("/") : "/";
}
