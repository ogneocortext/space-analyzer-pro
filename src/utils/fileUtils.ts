/**
 * File utility functions for the File Explorer component
 * Following January 2026 best practices for React icon implementation
 */

/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Get category color class for styling
 */
export const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    'Code': 'text-blue-400',
    'Images': 'text-green-400',
    'Documents': 'text-yellow-400',
    'Videos': 'text-red-400',
    'Audio': 'text-purple-400',
    'Other': 'text-gray-400',
  };
  return colors[category] || 'text-gray-400';
};

/**
 * Get file icon based on file extension
 * Returns Lucide React icon names for proper React icon implementation (2026 best practices)
 * Uses tree-shaking friendly individual imports and avoids problematic emoji characters
 */
export const getFileIcon = (fileName: string, isDirectory?: boolean): string => {
  if (isDirectory) return 'Folder';

  const ext = fileName.split('.').pop()?.toLowerCase();

  const iconMap: { [key: string]: string } = {
    // Code files - use Code icon for all programming languages (tree-shaking friendly)
    'js': 'Code', 'jsx': 'Code', 'ts': 'Code', 'tsx': 'Code', 'py': 'Code',
    'java': 'Code', 'cpp': 'Code', 'c': 'Code', 'cs': 'Code', 'php': 'Code',
    'rb': 'Code', 'go': 'Code', 'rs': 'Code', 'swift': 'Code', 'kt': 'Code',
    'r': 'Code', 'scala': 'Code', 'dart': 'Code', 'lua': 'Code', 'perl': 'Code',
    'sh': 'Code', 'bash': 'Code', 'zsh': 'Code', 'ps1': 'Code', 'bat': 'Code',

    // Web files - use Globe for HTML, Palette for stylesheets
    'html': 'Globe', 'htm': 'Globe', 'xhtml': 'Globe',
    'css': 'Palette', 'scss': 'Palette', 'sass': 'Palette', 'less': 'Palette',
    'styl': 'Palette', 'pcss': 'Palette',

    // Documents - use FileText for all text-based documents
    'txt': 'FileText', 'md': 'FileText', 'markdown': 'FileText', 'rst': 'FileText',
    'pdf': 'FileText', 'doc': 'FileText', 'docx': 'FileText', 'rtf': 'FileText',
    'odt': 'FileText', 'pages': 'FileText', 'tex': 'FileText', 'latex': 'FileText',

    // Images - use Image for all image formats
    'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'svg': 'Image',
    'webp': 'Image', 'bmp': 'Image', 'tiff': 'Image', 'tif': 'Image', 'ico': 'Image',
    'heic': 'Image', 'heif': 'Image', 'avif': 'Image', 'raw': 'Image',

    // Videos - use Video for all video formats
    'mp4': 'Video', 'avi': 'Video', 'mkv': 'Video', 'mov': 'Video', 'wmv': 'Video',
    'flv': 'Video', 'webm': 'Video', 'm4v': 'Video', '3gp': 'Video', 'mpg': 'Video',
    'mpeg': 'Video', 'ogv': 'Video', 'asf': 'Video',

    // Audio - use Music for all audio formats
    'mp3': 'Music', 'wav': 'Music', 'flac': 'Music', 'aac': 'Music', 'ogg': 'Music',
    'wma': 'Music', 'm4a': 'Music', 'opus': 'Music', 'aiff': 'Music', 'au': 'Music',

    // Archives - use Archive for all archive formats
    'zip': 'Archive', 'rar': 'Archive', '7z': 'Archive', 'tar': 'Archive', 'gz': 'Archive',
    'bz2': 'Archive', 'xz': 'Archive', 'tgz': 'Archive', 'tbz2': 'Archive', 'txz': 'Archive',
    'iso': 'Disc', 'dmg': 'Disc', 'img': 'Disc',

    // Config/Data files - use Settings for configuration
    'json': 'Settings', 'xml': 'Settings', 'yaml': 'Settings', 'yml': 'Settings',
    'ini': 'Settings', 'cfg': 'Settings', 'conf': 'Settings', 'config': 'Settings',
    'toml': 'Settings', 'properties': 'Settings', 'env': 'Lock', 'dotenv': 'Lock',

    // Executables - use Settings for executables
    'exe': 'Settings', 'msi': 'Archive', 'app': 'Smartphone', 'deb': 'Archive',
    'rpm': 'Archive', 'apk': 'Smartphone', 'jar': 'Archive', 'war': 'Archive',
    'ear': 'Archive',

    // Databases - use Database for database files
    'db': 'Database', 'sqlite': 'Database', 'sql': 'Database', 'mdb': 'Database',
    'accdb': 'Database', 'sqlite3': 'Database', 'db3': 'Database',

    // Logs and backups - use FileText and HardDrive
    'log': 'FileText', 'bak': 'HardDrive', 'backup': 'HardDrive', 'old': 'HardDrive',
    'tmp': 'Folder', 'temp': 'Folder', 'cache': 'Folder',

    // Other common file types
    'csv': 'Table', 'tsv': 'Table', 'xlsx': 'Table', 'xls': 'Table', 'ods': 'Table',
    'ppt': 'Presentation', 'pptx': 'Presentation', 'odp': 'Presentation',
    'key': 'Presentation', 'numbers': 'Table'
  };

  return iconMap[ext || ''] || 'File';
};

// Define proper interfaces for type safety
interface FileNode {
  name: string;
  path: string;
  size?: number;
  category?: string;
  extension?: string;
  isDirectory?: boolean;
  children?: FileNode[];
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
  category?: string;
}

/**
 * Build file tree structure from flat file list
 */
export const buildFileTree = (files: FileInfo[]): Record<string, FileNode> => {
  const tree: Record<string, FileNode> = {};

  files.forEach((file) => {
    const pathParts = file.path.split(/[/\\]/);
    let currentPath = '';

    pathParts.forEach((part: string, index: number) => {
      if (!part) return;

      const fullPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === pathParts.length - 1;

      if (!tree[fullPath]) {
        tree[fullPath] = {
          name: part,
          path: fullPath,
          size: isFile ? file.size : 0,
          category: isFile ? (file.category || 'Unknown') : 'Directory',
          extension: isFile ? file.extension : '',
          isDirectory: !isFile,
          children: []
        };
      }

      // Add to parent
      if (currentPath && tree[currentPath]) {
        tree[currentPath].children = tree[currentPath].children || [];
        tree[currentPath].children.push(tree[fullPath]);
        if (tree[currentPath].size !== undefined && file.size !== undefined) {
          tree[currentPath].size += file.size;
        }
      }

      currentPath = fullPath;
    });
  });

  return tree;
};

/**
 * Filter and sort files based on search term, category, and sort criteria
 */
export const filterAndSortFiles = (
  files: Array<{name: string, path: string, category: string, size: number}>,
  searchTerm: string,
  selectedCategory: string,
  sortBy: 'name' | 'size' | 'category'
) => {
  const filteredFiles = files.filter((file) => {
    const matchesSearch = !searchTerm ||
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.path.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || file.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Sort files
  filteredFiles.sort((a, b) => {
    switch (sortBy) {
      case 'size':
        return b.size - a.size;
      case 'category':
        return a.category.localeCompare(b.category);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return filteredFiles;
};

/**
 * Custom hook for debounced search
 */
import { useState, useEffect } from 'react';

export const useDebouncedValue = (value: string, delay: number): string => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};