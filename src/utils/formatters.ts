/**
 * Optimized utility functions for formatting data
 * Features:
 * - File size formatting with caching
 * - Date formatting with internationalization
 * - Number formatting with performance optimization
 * - Memory efficient string operations
 */

// Cache for frequently used formatters
const formatters = {
  fileSize: new Map<number, string>(),
  date: new Map<string, string>(),
  number: new Map<number, string>(),
};

// File size units
const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

/**
 * Format file size with caching for performance
 */
export const formatFileSize = (bytes: number): string => {
  // Return early for zero or negative values
  if (bytes <= 0) return "0 B";

  // Check cache first
  if (formatters.fileSize.has(bytes)) {
    return formatters.fileSize.get(bytes)!;
  }

  // Calculate size
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  const unit = FILE_SIZE_UNITS[i];

  const result = `${size} ${unit}`;

  // Cache result (limit cache size to prevent memory leaks)
  if (formatters.fileSize.size >= 1000) {
    // Remove oldest entries when cache gets too large
    const firstKey = formatters.fileSize.keys().next().value;
    if (firstKey !== undefined) {
      formatters.fileSize.delete(firstKey);
    }
  }

  formatters.fileSize.set(bytes, result);
  return result;
};

/**
 * Format date with internationalization support
 */
export const formatDate = (date: Date | string | number): string => {
  const dateObj = new Date(date);

  // Check cache first
  const cacheKey = dateObj.getTime().toString();
  if (formatters.date.has(cacheKey)) {
    return formatters.date.get(cacheKey)!;
  }

  // Use Intl.DateTimeFormat for better performance and i18n
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const result = formatter.format(dateObj);

  // Cache result
  if (formatters.date.size >= 500) {
    const firstKey = formatters.date.keys().next().value;
    if (firstKey !== undefined) {
      formatters.date.delete(firstKey);
    }
  }

  formatters.date.set(cacheKey, result);
  return result;
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: Date | string | number): string => {
  const dateObj = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  } else {
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years} year${years > 1 ? "s" : ""} ago`;
  }
};

/**
 * Format number with locale-specific formatting
 */
export const formatNumber = (num: number, options: Intl.NumberFormatOptions = {}): string => {
  // Check cache first
  const cacheKey = `${num}-${JSON.stringify(options)}`;
  if (formatters.number.has(cacheKey as any)) {
    return formatters.number.get(cacheKey as any)!;
  }

  // Use Intl.NumberFormat for better performance and i18n
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    ...options,
  });

  const result = formatter.format(num);

  // Cache result
  if (formatters.number.size >= 500) {
    const firstKey = formatters.number.keys().next().value;
    formatters.number.delete(firstKey as any);
  }

  formatters.number.set(cacheKey as any, result);
  return result;
};

/**
 * Format percentage with optional decimal places
 */
export const formatPercentage = (value: number, decimals = 1): string => {
  const percentage = value * 100;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Format file extension with proper casing
 */
export const formatFileExtension = (extension: string): string => {
  if (!extension) return "";

  // Remove dot if present
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;

  // Convert to lowercase and capitalize first letter
  return ext.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};

/**
 * Format file name with truncation for display
 */
export const formatFileName = (name: string, maxLength = 50): string => {
  if (name.length <= maxLength) return name;

  const extension = name.split(".").pop();
  const baseName = name.substring(0, name.length - (extension ? extension.length + 1 : 0));

  const availableLength = maxLength - (extension ? extension.length + 4 : 3); // 3 for "..."

  if (availableLength <= 0) {
    return `...${extension ? "." + extension : ""}`;
  }

  return `${baseName.substring(0, availableLength)}...${extension ? "." + extension : ""}`;
};

/**
 * Format path with truncation for display
 */
export const formatPath = (path: string, maxLength = 60): string => {
  if (path.length <= maxLength) return path;

  const parts = path.split(/[/\\]/);
  const ellipsis = "...";

  if (parts.length <= 2) {
    // For short paths, just truncate from the end
    return `${path.substring(0, maxLength - 3)}...`;
  }

  // For longer paths, show beginning and end
  const firstPart = parts[0];
  const lastPart = parts[parts.length - 1];
  const middleLength = maxLength - firstPart.length - lastPart.length - ellipsis.length - 2;

  if (middleLength <= 0) {
    return `${firstPart}...${lastPart}`;
  }

  const middlePart = parts.slice(1, -1).join("/").substring(0, middleLength);

  return `${firstPart}/${middlePart}.../${lastPart}`;
};

/**
 * Format memory usage in human-readable format
 */
export const formatMemoryUsage = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
};

/**
 * Format duration in human-readable format
 */
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${milliseconds} ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)} s`;
  } else if (milliseconds < 3600000) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")} min`;
  } else {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    return `${hours}:${minutes.toString().padStart(2, "0")} h`;
  }
};

/**
 * Format speed in human-readable format
 */
export const formatSpeed = (bytesPerSecond: number): string => {
  const size = formatFileSize(bytesPerSecond);
  return `${size}/s`;
};

/**
 * Format count with appropriate suffix (K, M, B)
 */
export const formatCount = (count: number): string => {
  if (count < 1000) {
    return count.toString();
  } else if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}K`;
  } else if (count < 1000000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else {
    return `${(count / 1000000000).toFixed(1)}B`;
  }
};

/**
 * Format file type description
 */
export const formatFileType = (type: string, extension?: string): string => {
  const typeMap: Record<string, string> = {
    directory: "Folder",
    file: "File",
    image: "Image",
    video: "Video",
    audio: "Audio",
    document: "Document",
    archive: "Archive",
    code: "Code",
    system: "System File",
  };

  const description = typeMap[type] || type;

  if (extension) {
    return `${description} (${extension})`;
  }

  return description;
};

/**
 * Format checksum or hash with truncation
 */
export const formatChecksum = (checksum: string, maxLength = 16): string => {
  if (!checksum) return "";

  if (checksum.length <= maxLength) {
    return checksum;
  }

  return `${checksum.substring(0, maxLength)}...`;
};

/**
 * Format error message with context
 */
export const formatErrorMessage = (error: Error | string, context?: string): string => {
  const message = typeof error === "string" ? error : error.message;

  if (context) {
    return `${context}: ${message}`;
  }

  return message;
};

/**
 * Clear all formatter caches
 */
export const clearFormatterCaches = (): void => {
  formatters.fileSize.clear();
  formatters.date.clear();
  formatters.number.clear();
};

/**
 * Get cache statistics for debugging
 */
export const getCacheStats = (): Record<string, number> => {
  return {
    fileSize: formatters.fileSize.size,
    date: formatters.date.size,
    number: formatters.number.size,
  };
};

export default {
  formatFileSize,
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatPercentage,
  formatFileExtension,
  formatFileName,
  formatPath,
  formatMemoryUsage,
  formatDuration,
  formatSpeed,
  formatCount,
  formatFileType,
  formatChecksum,
  formatErrorMessage,
  clearFormatterCaches,
  getCacheStats,
};
