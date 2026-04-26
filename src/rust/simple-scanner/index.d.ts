/**
 * High-performance Rust native file scanner
 * 
 * Built with NAPI-RS for maximum performance.
 * Optimized for Windows x64 with SIMD and parallel processing.
 */

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  extension: string;
  category: string;
}

export interface ScanResult {
  files: FileInfo[];
  categories: Record<string, number>;
  extensionStats: Record<string, number>;
  totalFiles: number;
  totalSize: number;
  scanTime: number;
}

export interface ScanOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
  maxConcurrentTasks?: number;
}

export interface PerformanceMetrics {
  uptimeMs: number;
  totalOperations: number;
  operationsPerSecond: number;
  memoryUsageMb: number;
  cacheEfficiency: number;
}

/**
 * Native scanner instance with optimized file scanning
 */
export class NativeScanner {
  constructor();
  
  /**
   * Scan a directory and return file information
   * @param path - Directory path to scan
   * @param options - Scan configuration options
   * @returns Scan results with files, categories, and statistics
   */
  scan(path: string, options?: ScanOptions): Promise<ScanResult>;
  
  /**
   * Categorize a single file by its name
   * @param filename - File name to categorize
   * @returns Category string (e.g., "JavaScript/TypeScript", "Images", etc.)
   */
  categorizeFile(filename: string): string;
  
  /**
   * Get performance metrics from the scanner
   * @returns Current performance metrics
   */
  getMetrics(): PerformanceMetrics;
}

/**
 * Quick scan a directory without creating a scanner instance
 * @param path - Directory path to scan
 * @param options - Scan configuration options
 * @returns Scan results
 */
export function scan(path: string, options?: ScanOptions): Promise<ScanResult>;

/**
 * Categorize a single file
 * @param filename - File name to categorize
 * @returns Category string
 */
export function categorizeFile(filename: string): string;

/**
 * Get scanner performance metrics
 * @returns Current performance metrics
 */
export function getMetrics(): PerformanceMetrics;

/**
 * Internal: Path where the native module was loaded from
 */
export const _loadedPath: string | undefined;
