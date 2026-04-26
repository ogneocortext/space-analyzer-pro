import { apiCache, fileCache, analysisCache } from '../cache/APICache';
import { transformFileData, generateAnalysisSummary, TransformedFileData, AnalysisSummary } from '../../utils/dataTransformers';

export interface FileAPIOptions {
  useCache?: boolean;
  cacheTTL?: number;
  timeout?: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

export class FileAPIService {
  private baseURL: string;
  private defaultTimeout = 30000; // 30 seconds

  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  /**
   * Get files from a directory with caching
   */
  async getFiles(
    path: string,
    options: FileAPIOptions = {}
  ): Promise<APIResponse<TransformedFileData[]>> {
    const {
      useCache = true,
      cacheTTL = 10 * 60 * 1000, // 10 minutes
      timeout = this.defaultTimeout
    } = options;

    const cacheKey = `files_${path}`;

    // Check cache first
    if (useCache) {
      const cachedData = fileCache.get<TransformedFileData[]>(cacheKey);
      if (cachedData) {
        return { success: true, data: cachedData, cached: true };
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseURL}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();

      // Transform the data
      const transformedData = transformFileData(rawData);

      // Cache the result
      if (useCache) {
        fileCache.set(cacheKey, transformedData, cacheTTL);
      }

      return { success: true, data: transformedData };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch files';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get analysis summary for a directory
   */
  async getAnalysisSummary(
    path: string,
    options: FileAPIOptions = {}
  ): Promise<APIResponse<AnalysisSummary>> {
    const {
      useCache = true,
      cacheTTL = 15 * 60 * 1000, // 15 minutes
      timeout = this.defaultTimeout
    } = options;

    const cacheKey = `analysis_${path}`;

    // Check cache first
    if (useCache) {
      const cachedData = analysisCache.get<AnalysisSummary>(cacheKey);
      if (cachedData) {
        return { success: true, data: cachedData, cached: true };
      }
    }

    try {
      // First get the files
      const filesResponse = await this.getFiles(path, { useCache: false });
      if (!filesResponse.success || !filesResponse.data) {
        return { success: false, error: filesResponse.error };
      }

      // Generate analysis summary
      const summary = generateAnalysisSummary(filesResponse.data);

      // Cache the result
      if (useCache) {
        analysisCache.set(cacheKey, summary, cacheTTL);
      }

      return { success: true, data: summary };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate analysis';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete files
   */
  async deleteFiles(
    fileIds: string[],
    options: { timeout?: number } = {}
  ): Promise<APIResponse<void>> {
    const { timeout = this.defaultTimeout } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseURL}/files/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Invalidate related caches
      fileCache.invalidate(/^files_/);
      analysisCache.invalidate(/^analysis_/);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete files';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Move files to a new location
   */
  async moveFiles(
    fileIds: string[],
    destinationPath: string,
    options: { timeout?: number } = {}
  ): Promise<APIResponse<void>> {
    const { timeout = this.defaultTimeout } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseURL}/files/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds, destinationPath }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Invalidate related caches
      fileCache.invalidate(/^files_/);
      analysisCache.invalidate(/^analysis_/);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to move files';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Search files
   */
  async searchFiles(
    query: string,
    path?: string,
    options: FileAPIOptions = {}
  ): Promise<APIResponse<TransformedFileData[]>> {
    const {
      useCache = true,
      cacheTTL = 5 * 60 * 1000, // 5 minutes
      timeout = this.defaultTimeout
    } = options;

    const cacheKey = `search_${query}_${path || 'root'}`;

    // Check cache first
    if (useCache) {
      const cachedData = apiCache.get<TransformedFileData[]>(cacheKey);
      if (cachedData) {
        return { success: true, data: cachedData, cached: true };
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseURL}/files/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, path }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      const transformedData = transformFileData(rawData);

      // Cache the result
      if (useCache) {
        apiCache.set(cacheKey, transformedData, cacheTTL);
      }

      return { success: true, data: transformedData };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search files';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(
    path: string,
    options: FileAPIOptions = {}
  ): Promise<APIResponse<{
    totalFiles: number;
    totalSize: number;
    categories: Record<string, number>;
    lastModified: Date;
  }>> {
    const {
      useCache = true,
      cacheTTL = 5 * 60 * 1000, // 5 minutes
      timeout = this.defaultTimeout
    } = options;

    const cacheKey = `stats_${path}`;

    // Check cache first
    if (useCache) {
      const cachedData = apiCache.get(cacheKey);
      if (cachedData) {
        return { success: true, data: cachedData as any, cached: true };
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseURL}/files/stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const stats = await response.json();

      // Cache the result
      if (useCache) {
        apiCache.set(cacheKey, stats, cacheTTL);
      }

      return { success: true, data: stats };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get file statistics';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    apiCache.invalidate();
    fileCache.invalidate();
    analysisCache.invalidate();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      api: apiCache.getStats(),
      files: fileCache.getStats(),
      analysis: analysisCache.getStats()
    };
  }
}

// Export singleton instance
export const fileAPIService = new FileAPIService();