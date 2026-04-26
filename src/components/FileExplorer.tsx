import React, { useState, useMemo, FC, useCallback, memo } from 'react';
import { FileExplorerControls } from './FileExplorerControls';
import { FileExplorerList } from './FileExplorerList';
import { FileExplorerPagination } from './FileExplorerPagination';
import { buildFileTree, filterAndSortFiles, useDebouncedValue } from '../utils/fileUtils';
import { AnalysisBridge } from '../services/AnalysisBridge';

// Sort type constants
export const SORT_TYPES = {
  NAME: 'name',
  SIZE: 'size',
  CATEGORY: 'category'
} as const;

export type SortTypeType = typeof SORT_TYPES[keyof typeof SORT_TYPES];

// File category constants
export const FILE_CATEGORIES = {
  ALL: 'All',
  DOCUMENTS: 'Documents',
  IMAGES: 'Images',
  VIDEOS: 'Videos',
  AUDIO: 'Audio',
  CODE: 'Code'
} as const;

export type FileCategoryType = typeof FILE_CATEGORIES[keyof typeof FILE_CATEGORIES];

interface FileExplorerProps {
  result: any;
  onFolderSelect?: (path: string) => void;
}

const FileExplorer: FC<FileExplorerProps> = memo(({ result, onFolderSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategoryType>(FILE_CATEGORIES.ALL);
  const [sortBy, setSortBy] = useState<SortTypeType>(SORT_TYPES.NAME);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);

  // Use debounced search term for filtering
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  // Memoized file tree - prevents unnecessary recalculations
  const fileTree = useMemo(() => {
    return result?.files ? buildFileTree(result.files) : {};
  }, [result]);

  // Memoized filtered and sorted files
  const { filteredFiles, totalFilteredCount } = useMemo(() => {
    if (!result?.files) return { filteredFiles: [], totalFilteredCount: 0 };

    const filtered = filterAndSortFiles(result.files, debouncedSearchTerm, selectedCategory, sortBy);
    const totalFilteredCount = filtered.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedFiles = filtered.slice(startIndex, startIndex + itemsPerPage);

    return { filteredFiles: paginatedFiles, totalFilteredCount };
  }, [result, debouncedSearchTerm, selectedCategory, sortBy, currentPage]);

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  // Memoized categories list
  const categories = useMemo(() => {
    if (!result?.categories) return ['All'];
    return ['All', ...Object.keys(result.categories)];
  }, [result]);

  // Event handlers
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  const handleCategoryChange = useCallback((category: FileCategoryType) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page on filter
  }, []);

  const handleSortChange = useCallback((sort: SortTypeType) => {
    setSortBy(sort);
    setCurrentPage(1); // Reset to first page on sort
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleFileClick = useCallback((file: any) => {
    // Handle file click - could open file details or preview
    console.log('File clicked:', file);
  }, []);

  const handleFolderSelect = useCallback(async (path: string) => {
    if (!path) return;

    setIsSelectingFolder(true);
    
    try {
      console.log('Selected folder path:', path);
      
      // Call the parent callback if provided
      if (onFolderSelect) {
        onFolderSelect(path);
      }
    } catch (error) {
      console.error('Error handling folder selection:', error);
    } finally {
      setIsSelectingFolder(false);
    }
  }, [onFolderSelect]);

  return (
    <div className="space-y-6">
      {/* Controls Component */}
      <FileExplorerControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        categories={categories}
        totalFiles={result?.total_files || 0}
        filteredCount={totalFilteredCount}
      />

      {/* File List Component */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <FileExplorerList
            files={filteredFiles}
            onFileClick={handleFileClick}
            onFolderSelect={handleFolderSelect}
          />
        </div>

        {/* Pagination Component */}
        <FileExplorerPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalFiles={totalFilteredCount}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Loading indicator for folder selection */}
      {isSelectingFolder && (
        <div className="flex items-center justify-center p-4 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mr-3"></div>
          Opening Windows Explorer...
        </div>
      )}
    </div>
  );
});

export default FileExplorer;