import { ref, computed, onMounted, onUnmounted } from "vue";
import { fileCache } from "../services/cache/APICache";
import {
  transformFileData,
  filterFiles,
  sortFiles,
  TransformedFileData,
} from "../utils/dataTransformers";

interface FileOperationsOptions {
  initialFiles?: any[];
  enableCache?: boolean;
  defaultSort?: 'name' | 'size' | 'date' | 'type';
}

interface UseFileOperationsReturn {
  files: Ref<TransformedFileData[]>;
  filteredFiles: Ref<TransformedFileData[]>;
  selectedFiles: Ref<string[]>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  searchTerm: Ref<string>;
  sortBy: Ref<string>;
  filterType: Ref<string>;
  selectFile: (fileId: string) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  deleteFiles: (fileIds: string[]) => Promise<void>;
  moveFiles: (fileIds: string[], targetPath: string) => Promise<void>;
  updateSearchTerm: (term: string) => void;
  updateSortBy: (sort: string) => void;
  updateFilterType: (type: string) => void;
  refreshFiles: () => Promise<void>;
}

export const useFileOperations = (options: FileOperationsOptions = {}): UseFileOperationsReturn => {
  const { initialFiles = [], enableCache = true, defaultSort = 'name' } = options;
  
  const files = ref<TransformedFileData[]>([]);
  const filteredFiles = ref<TransformedFileData[]>([]);
  const selectedFiles = ref<string[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const searchTerm = ref('');
  const sortBy = ref(defaultSort);
  const filterType = ref('all');

  // Computed filtered and sorted files
  const processedFiles = computed(() => {
    let result = [...files.value];
    
    // Apply search filter
    if (searchTerm.value) {
      result = result.filter(file => 
        file.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
        file.path.toLowerCase().includes(searchTerm.value.toLowerCase())
      );
    }
    
    // Apply type filter
    if (filterType.value !== 'all') {
      result = result.filter(file => file.type === filterType.value);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy.value) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'date':
          return new Date(b.modified).getTime() - new Date(a.modified).getTime();
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    
    return result;
  });

  filteredFiles.value = processedFiles;

  const selectFile = (fileId: string) => {
    const index = selectedFiles.value.indexOf(fileId);
    if (index > -1) {
      selectedFiles.value.splice(index, 1);
    } else {
      selectedFiles.value.push(fileId);
    }
  };

  const selectAllFiles = () => {
    const allFileIds = filteredFiles.value.map(file => file.id);
    selectedFiles.value = allFileIds;
  };

  const deselectAllFiles = () => {
    selectedFiles.value = [];
  };

  const deleteFiles = async (fileIds: string[]): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    
    try {
      // Delete files logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // Remove from files array
      files.value = files.value.filter(file => !fileIds.includes(file.id));
      
      // Clear selection
      selectedFiles.value = selectedFiles.value.filter(id => !fileIds.includes(id));
      
      // Clear cache entries
      if (enableCache) {
        fileIds.forEach(id => fileCache.delete(id));
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete files';
    } finally {
      isLoading.value = false;
    }
  };

  const moveFiles = async (fileIds: string[], targetPath: string): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    
    try {
      // Move files logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // Update file paths in files array
      files.value = files.value.map(file => {
        if (fileIds.includes(file.id)) {
          return {
            ...file,
            path: `${targetPath}/${file.name}`,
            modified: new Date().toISOString()
          };
        }
        return file;
      });
      
      // Clear selection
      selectedFiles.value = selectedFiles.value.filter(id => !fileIds.includes(id));
      
      // Clear cache entries
      if (enableCache) {
        fileIds.forEach(id => fileCache.delete(id));
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to move files';
    } finally {
      isLoading.value = false;
    }
  };

  const updateSearchTerm = (term: string) => {
    searchTerm.value = term;
  };

  const updateSortBy = (sort: string) => {
    sortBy.value = sort;
  };

  const updateFilterType = (type: string) => {
    filterType.value = type;
  };

  const refreshFiles = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    
    try {
      // Refresh files logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      // This would typically fetch fresh file data from the backend
    } catch (err: any) {
      error.value = err.message || 'Failed to refresh files';
    } finally {
      isLoading.value = false;
    }
  };

  // Initialize with provided files
  if (initialFiles.length > 0) {
    files.value = initialFiles.map(transformFileData);
  }

  return {
    files,
    filteredFiles,
    selectedFiles,
    isLoading,
    error,
    searchTerm,
    sortBy,
    filterType,
    selectFile,
    selectAllFiles,
    deselectAllFiles,
    deleteFiles,
    moveFiles,
    updateSearchTerm,
    updateSortBy,
    updateFilterType,
    refreshFiles,
  };
};
