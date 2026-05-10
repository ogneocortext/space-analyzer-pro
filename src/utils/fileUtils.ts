/**
 * File Utilities - Common file operations and formatting
 * Extracted from various components for reusability
 */

export interface FileSizeOptions {
  precision?: number;
  useBinary?: boolean;
  includeBytes?: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: "file" | "directory";
  extension?: string;
  lastModified?: Date;
  children?: FileInfo[];
}

/**
 * File Size Formatter
 */
export class FileSizeFormatter {
  private static readonly BINARY_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  private static readonly DECIMAL_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB"];

  /**
   * Format file size in human-readable format
   */
  static format(bytes: number, options: FileSizeOptions = {}): string {
    const { precision = 1, useBinary = true, includeBytes = false } = options;

    if (bytes === 0) return "0 B";

    const units = useBinary ? this.BINARY_UNITS : this.DECIMAL_UNITS;
    const base = useBinary ? 1024 : 1000;

    let size = bytes;
    let unitIndex = 0;

    while (size >= base && unitIndex < units.length - 1) {
      size /= base;
      unitIndex++;
    }

    const formatted = size.toFixed(precision);
    const unit = units[unitIndex];

    if (includeBytes && unitIndex > 0) {
      return `${formatted} ${unit} (${bytes.toLocaleString()} B)`;
    }

    return `${formatted} ${unit}`;
  }

  /**
   * Parse human-readable file size back to bytes
   */
  static parse(sizeString: string): number {
    const match = sizeString.match(/^([\d.,]+)\s*([KMGT]?B?)$/i);
    if (!match) return 0;

    const [, sizeStr, unit] = match;
    const size = parseFloat(sizeStr.replace(",", ""));

    const unitMap: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
      PB: 1024 ** 5,
      K: 1024,
      M: 1024 ** 2,
      G: 1024 ** 3,
      T: 1024 ** 4,
      P: 1024 ** 5,
    };

    return Math.floor(size * (unitMap[unit.toUpperCase()] || 1));
  }

  /**
   * Get appropriate unit for a given size
   */
  static getUnit(bytes: number, useBinary = true): string {
    const units = useBinary ? this.BINARY_UNITS : this.DECIMAL_UNITS;
    const base = useBinary ? 1024 : 1000;

    let size = bytes;
    let unitIndex = 0;

    while (size >= base && unitIndex < units.length - 1) {
      size /= base;
      unitIndex++;
    }

    return units[unitIndex];
  }
}

/**
 * File Path Utilities
 */
export class FilePathUtils {
  /**
   * Get file extension from path
   */
  static getExtension(path: string): string {
    const lastDot = path.lastIndexOf(".");
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

    if (lastDot > lastSlash && lastDot > -1) {
      return path.slice(lastDot + 1).toLowerCase();
    }

    return "";
  }

  /**
   * Get filename from path
   */
  static getFileName(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return lastSlash > -1 ? path.slice(lastSlash + 1) : path;
  }

  /**
   * Get directory from path
   */
  static getDirectory(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return lastSlash > -1 ? path.slice(0, lastSlash) : "";
  }

  /**
   * Join path segments
   */
  static join(...segments: string[]): string {
    return segments
      .filter(Boolean)
      .map((segment, index) => {
        if (index === 0) return segment.replace(/[\/\\]+$/, "");
        return segment.replace(/^[\/\\]+/, "").replace(/[\/\\]+$/, "");
      })
      .join("/");
  }

  /**
   * Normalize path separators
   */
  static normalize(path: string): string {
    return path.replace(/[\/\\]+/g, "/");
  }

  /**
   * Check if path is absolute
   */
  static isAbsolute(path: string): boolean {
    return /^[a-zA-Z]:/.test(path) || path.startsWith("/");
  }

  /**
   * Get relative path from base
   */
  static relative(from: string, to: string): string {
    const fromParts = from.split(/[\/\\]/);
    const toParts = to.split(/[\/\\]/);

    // Find common prefix
    let commonLength = 0;
    while (
      commonLength < fromParts.length &&
      commonLength < toParts.length &&
      fromParts[commonLength] === toParts[commonLength]
    ) {
      commonLength++;
    }

    // Go up from common directory
    const upLevels = fromParts.length - commonLength;
    const relativeParts = Array(upLevels).fill("..").concat(toParts.slice(commonLength));

    return relativeParts.join("/");
  }
}

/**
 * File Type Detection
 */
export class FileTypeDetector {
  private static readonly FILE_TYPES = {
    // Images
    image: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico", "tiff", "psd"],
    // Videos
    video: ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v", "3gp", "mpg", "mpeg"],
    // Audio
    audio: ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a", "opus", "aiff"],
    // Documents
    document: ["pdf", "doc", "docx", "txt", "rtf", "odt", "pages"],
    // Spreadsheets
    spreadsheet: ["xls", "xlsx", "csv", "ods", "numbers"],
    // Presentations
    presentation: ["ppt", "pptx", "odp", "key"],
    // Archives
    archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "z"],
    // Code
    code: [
      "js",
      "ts",
      "html",
      "css",
      "py",
      "java",
      "cpp",
      "c",
      "h",
      "cs",
      "php",
      "rb",
      "go",
      "rs",
      "swift",
    ],
    // Executables
    executable: ["exe", "msi", "dmg", "pkg", "deb", "rpm", "appimage"],
  };

  /**
   * Get file type from extension
   */
  static getType(extension: string): string {
    const ext = extension.toLowerCase();

    for (const [type, extensions] of Object.entries(this.FILE_TYPES)) {
      if (extensions.includes(ext)) {
        return type;
      }
    }

    return "unknown";
  }

  /**
   * Check if file is media (image/video/audio)
   */
  static isMedia(extension: string): boolean {
    const type = this.getType(extension);
    return ["image", "video", "audio"].includes(type);
  }

  /**
   * Check if file is document
   */
  static isDocument(extension: string): boolean {
    const type = this.getType(extension);
    return ["document", "spreadsheet", "presentation"].includes(type);
  }

  /**
   * Check if file is archive
   */
  static isArchive(extension: string): boolean {
    return this.getType(extension) === "archive";
  }

  /**
   * Check if file is code
   */
  static isCode(extension: string): boolean {
    return this.getType(extension) === "code";
  }

  /**
   * Get icon name for file type
   */
  static getIcon(extension: string): string {
    const type = this.getType(extension);

    const iconMap: Record<string, string> = {
      image: "Image",
      video: "Video",
      audio: "Music",
      document: "FileText",
      spreadsheet: "FileSpreadsheet",
      presentation: "FilePresentation",
      archive: "Archive",
      code: "Code",
      executable: "Terminal",
      unknown: "File",
    };

    return iconMap[type] || "File";
  }

  /**
   * Get color for file type
   */
  static getColor(extension: string): string {
    const type = this.getType(extension);

    const colorMap: Record<string, string> = {
      image: "#10b981",
      video: "#ef4444",
      audio: "#3b82f6",
      document: "#8b5cf6",
      spreadsheet: "#22c55e",
      presentation: "#f59e0b",
      archive: "#6b7280",
      code: "#06b6d4",
      executable: "#dc2626",
      unknown: "#6b7280",
    };

    return colorMap[type] || "#6b7280";
  }
}

/**
 * File Analysis Utilities
 */
export class FileAnalysisUtils {
  /**
   * Calculate directory size recursively
   */
  static calculateDirectorySize(files: FileInfo[]): number {
    return files.reduce((total, file) => {
      if (file.type === "file") {
        return total + file.size;
      } else if (file.children) {
        return total + this.calculateDirectorySize(file.children);
      }
      return total;
    }, 0);
  }

  /**
   * Get file count by type
   */
  static getFileCountByType(files: FileInfo[]): Record<string, number> {
    const counts: Record<string, number> = {};

    files.forEach((file) => {
      if (file.type === "file") {
        const extension = FilePathUtils.getExtension(file.name);
        const fileType = FileTypeDetector.getType(extension);
        counts[fileType] = (counts[fileType] || 0) + 1;
      } else if (file.children) {
        const childCounts = this.getFileCountByType(file.children);
        Object.entries(childCounts).forEach(([type, count]) => {
          counts[type] = (counts[type] || 0) + count;
        });
      }
    });

    return counts;
  }

  /**
   * Get largest files
   */
  static getLargestFiles(files: FileInfo[], limit = 10): FileInfo[] {
    const allFiles: FileInfo[] = [];

    const collectFiles = (fileList: FileInfo[]) => {
      fileList.forEach((file) => {
        if (file.type === "file") {
          allFiles.push(file);
        } else if (file.children) {
          collectFiles(file.children);
        }
      });
    };

    collectFiles(files);

    return allFiles.sort((a, b) => b.size - a.size).slice(0, limit);
  }

  /**
   * Find duplicate files (by name and size)
   */
  static findDuplicates(files: FileInfo[]): FileInfo[][] {
    const groups: Record<string, FileInfo[]> = {};

    const collectFiles = (fileList: FileInfo[]) => {
      fileList.forEach((file) => {
        if (file.type === "file") {
          const key = `${file.name}_${file.size}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(file);
        } else if (file.children) {
          collectFiles(file.children);
        }
      });
    };

    collectFiles(files);

    return Object.values(groups).filter((group) => group.length > 1);
  }

  /**
   * Get file age distribution
   */
  static getFileAgeDistribution(files: FileInfo[]): Record<string, number> {
    const now = Date.now();
    const distribution: Record<string, number> = {
      "Less than 1 day": 0,
      "1-7 days": 0,
      "1-4 weeks": 0,
      "1-3 months": 0,
      "3-6 months": 0,
      "6-12 months": 0,
      "1-2 years": 0,
      "More than 2 years": 0,
    };

    const categorizeFile = (file: FileInfo) => {
      if (file.lastModified) {
        const ageMs = now - file.lastModified.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        if (ageDays < 1) distribution["Less than 1 day"]++;
        else if (ageDays < 7) distribution["1-7 days"]++;
        else if (ageDays < 30) distribution["1-4 weeks"]++;
        else if (ageDays < 90) distribution["1-3 months"]++;
        else if (ageDays < 180) distribution["3-6 months"]++;
        else if (ageDays < 365) distribution["6-12 months"]++;
        else if (ageDays < 730) distribution["1-2 years"]++;
        else distribution["More than 2 years"]++;
      }

      if (file.children) {
        file.children.forEach(categorizeFile);
      }
    };

    files.forEach(categorizeFile);

    return distribution;
  }
}

// Export utility functions for easy use
export const formatFileSize = FileSizeFormatter.format;
export const parseFileSize = FileSizeFormatter.parse;
export const getFileExtension = FilePathUtils.getExtension;
export const getFileName = FilePathUtils.getFileName;
export const getFileType = FileTypeDetector.getType;
export const isMediaFile = FileTypeDetector.isMedia;
export const getFileIcon = FileTypeDetector.getIcon;
export const getFileColor = FileTypeDetector.getColor;
