// Data transformation utilities for Space Analyzer

export interface RawFileData {
  name: string;
  path: string;
  size: number;
  modified: string | Date;
  type: string;
  category?: string;
  [key: string]: unknown;
}

export interface TransformedFileData {
  id: string;
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  modified: Date;
  formattedModified: string;
  type: string;
  category: string;
  categoryColor: string;
  extension: string;
  isDirectory: boolean;
  depth: number;
}

export interface AnalysisSummary {
  totalSize: number;
  totalFiles: number;
  totalDirectories: number;
  categories: Record<string, { count: number; size: number; percentage: number }>;
  largestFiles: Array<{ name: string; size: number; path: string }>;
  oldestFiles: Array<{ name: string; modified: Date; path: string }>;
  newestFiles: Array<{ name: string; modified: Date; path: string }>;
  extensions: Record<string, number>;
  depthStats: { min: number; max: number; avg: number };
}

/**
 * Transform raw file data into standardized format
 */
export const transformFileData = (rawFiles: RawFileData[]): TransformedFileData[] => {
  return rawFiles.map((file, index) => {
    const modified = new Date(file.modified);
    const extension = getFileExtension(file.name);
    const category = categorizeFile(file.name, file.type);
    const isDirectory = file.type === 'directory' || file.type.includes('folder');

    return {
      id: generateFileId(file.path, file.name, index),
      name: file.name,
      path: file.path,
      size: file.size || 0,
      formattedSize: formatFileSize(file.size || 0),
      modified,
      formattedModified: modified.toLocaleDateString(),
      type: file.type,
      category,
      categoryColor: getCategoryColor(category),
      extension,
      isDirectory,
      depth: calculatePathDepth(file.path)
    };
  });
};

/**
 * Generate summary statistics from file data
 */
export const generateAnalysisSummary = (files: TransformedFileData[]): AnalysisSummary => {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalFiles = files.filter(f => !f.isDirectory).length;
  const totalDirectories = files.filter(f => f.isDirectory).length;

  // Category breakdown
  const categories = files.reduce((acc, file) => {
    const cat = file.category;
    if (!acc[cat]) {
      acc[cat] = { count: 0, size: 0, percentage: 0 };
    }
    acc[cat].count++;
    acc[cat].size += file.size;
    return acc;
  }, {} as Record<string, { count: number; size: number; percentage: number }>);

  // Calculate percentages
  Object.keys(categories).forEach(cat => {
    categories[cat].percentage = (categories[cat].size / totalSize) * 100;
  });

  // Largest files
  const largestFiles = [...files]
    .filter(f => !f.isDirectory)
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map(f => ({ name: f.name, size: f.size, path: f.path }));

  // Oldest and newest files
  const sortedByDate = [...files]
    .filter(f => !f.isDirectory)
    .sort((a, b) => a.modified.getTime() - b.modified.getTime());

  const oldestFiles = sortedByDate
    .slice(0, 5)
    .map(f => ({ name: f.name, modified: f.modified, path: f.path }));

  const newestFiles = sortedByDate
    .slice(-5)
    .reverse()
    .map(f => ({ name: f.name, modified: f.modified, path: f.path }));

  // Extension breakdown
  const extensions = files
    .filter(f => !f.isDirectory && f.extension)
    .reduce((acc, file) => {
      acc[file.extension] = (acc[file.extension] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Depth statistics
  const depths = files.map(f => f.depth);
  const depthStats = {
    min: Math.min(...depths),
    max: Math.max(...depths),
    avg: depths.reduce((sum, d) => sum + d, 0) / depths.length
  };

  return {
    totalSize,
    totalFiles,
    totalDirectories,
    categories,
    largestFiles,
    oldestFiles,
    newestFiles,
    extensions,
    depthStats
  };
};

/**
 * Group files by category
 */
export const groupByCategory = (files: TransformedFileData[]) => {
  return files.reduce((acc, file) => {
    const category = file.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(file);
    return acc;
  }, {} as Record<string, TransformedFileData[]>);
};

/**
 * Group files by directory
 */
export const groupByDirectory = (files: TransformedFileData[]) => {
  return files.reduce((acc, file) => {
    const dir = getParentDirectory(file.path);
    if (!acc[dir]) {
      acc[dir] = [];
    }
    acc[dir].push(file);
    return acc;
  }, {} as Record<string, TransformedFileData[]>);
};

/**
 * Filter files based on criteria
 */
export const filterFiles = (
  files: TransformedFileData[],
  filters: {
    search?: string;
    categories?: string[];
    sizeRange?: [number, number];
    dateRange?: [Date, Date];
    extensions?: string[];
  }
): TransformedFileData[] => {
  return files.filter(file => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!file.name.toLowerCase().includes(searchLower) &&
          !file.path.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(file.category)) {
        return false;
      }
    }

    // Size range filter
    if (filters.sizeRange) {
      const [min, max] = filters.sizeRange;
      if (file.size < min || file.size > max) {
        return false;
      }
    }

    // Date range filter
    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      if (file.modified < start || file.modified > end) {
        return false;
      }
    }

    // Extension filter
    if (filters.extensions && filters.extensions.length > 0) {
      if (!filters.extensions.includes(file.extension)) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Sort files by various criteria
 */
export const sortFiles = (
  files: TransformedFileData[],
  sortBy: 'name' | 'size' | 'modified' | 'type' | 'path',
  direction: 'asc' | 'desc' = 'asc'
): TransformedFileData[] => {
  return [...files].sort((a, b) => {
    let aValue: string | number, bValue: string | number;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'size':
        aValue = a.size;
        bValue = b.size;
        break;
      case 'modified':
        aValue = a.modified.getTime();
        bValue = b.modified.getTime();
        break;
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
        break;
      case 'path':
        aValue = a.path.toLowerCase();
        bValue = b.path.toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

// Helper functions

const generateFileId = (path: string, name: string, index: number): string => {
  return btoa(`${path}/${name}_${index}`).replace(/[^a-zA-Z0-9]/g, '');
};

const getFileExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext;
};

const categorizeFile = (filename: string, type: string): string => {
  if (type === 'directory' || type.includes('folder')) return 'Directory';

  const extension = getFileExtension(filename);

  const categories = {
    'Image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'ico'],
    'Video': ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'],
    'Audio': ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'],
    'Document': ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'],
    'Code': ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'less', 'php', 'py', 'java', 'cpp', 'c', 'cs', 'rb', 'go', 'rs', 'swift', 'kt'],
    'Archive': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
    'Executable': ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'app'],
    'System': ['dll', 'so', 'dylib', 'sys', 'drv'],
    'Configuration': ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'properties']
  };

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }

  return 'Other';
};

const getCategoryColor = (category: string): string => {
  const colors = {
    'Directory': '#3b82f6',
    'Image': '#10b981',
    'Video': '#f59e0b',
    'Audio': '#8b5cf6',
    'Document': '#ef4444',
    'Code': '#06b6d4',
    'Archive': '#84cc16',
    'Executable': '#f97316',
    'System': '#6b7280',
    'Configuration': '#ec4899',
    'Other': '#6b7280'
  };

  return colors[category as keyof typeof colors] || colors.Other;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const calculatePathDepth = (path: string): number => {
  // Normalize path separators and count directories
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/').filter(part => part.length > 0);
  return parts.length;
};

const getParentDirectory = (path: string): string => {
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  parts.pop(); // Remove filename
  return parts.join('/') || '/';
};