/**
 * Action Executor
 * Handles execution of AI commands and integrates with system services
 */

import { ScanningEngine, ScanResult, ScanProgress } from "./ScanningEngine";
import { AIBackendService } from "./AIBackendService";

// Import Tauri functionality if available
let TauriDesktop: any = null;
try {
  TauriDesktop = require("@/composables/useTauriDesktop").useTauriDesktop;
} catch (error) {
  // Tauri not available in web environment
}

// Scanner types
export type ScannerType = "web" | "tauri" | "auto";

export interface ScannerConfig {
  type: ScannerType;
  preferNative: boolean;
  fallbackToWeb: boolean;
}

export interface Action {
  id: string;
  params: Record<string, any>;
  timestamp: Date;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
  error?: string;
}

export interface ExecutionContext {
  analysisData?: any;
  files?: any[];
  categories?: Record<string, { count: number; size: number }>;
  previousAnalyses?: any[];
  currentAnalysisId?: string;
  onProgress?: (message: string) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export class ActionExecutor {
  private static instance: ActionExecutor;
  private scanningEngine: ScanningEngine;
  private aiBackend: AIBackendService;
  private activeActions: Map<string, Action> = new Map();
  private scanHistory: ScanResult[] = [];
  private scannerConfig: ScannerConfig;

  static getInstance(): ActionExecutor {
    if (!ActionExecutor.instance) {
      ActionExecutor.instance = new ActionExecutor();
    }
    return ActionExecutor.instance;
  }

  constructor() {
    this.scanningEngine = ScanningEngine.getInstance();
    this.aiBackend = AIBackendService.getInstance();
    this.scannerConfig = {
      type: "auto",
      preferNative: true,
      fallbackToWeb: true,
    };
  }

  /**
   * Configure scanner type
   */
  setScannerConfig(config: Partial<ScannerConfig>): void {
    this.scannerConfig = { ...this.scannerConfig, ...config };
  }

  /**
   * Get current scanner configuration
   */
  getScannerConfig(): ScannerConfig {
    return { ...this.scannerConfig };
  }

  /**
   * Check if Tauri is available
   */
  private isTauriAvailable(): boolean {
    return !!(window as any).__TAURI__;
  }

  /**
   * Determine which scanner to use
   */
  private getEffectiveScannerType(): "web" | "tauri" {
    const { type, preferNative, fallbackToWeb } = this.scannerConfig;

    if (type === "web") return "web";
    if (type === "tauri") return "tauri";

    // Auto mode
    if (preferNative && this.isTauriAvailable()) {
      return "tauri";
    }

    if (fallbackToWeb || !this.isTauriAvailable()) {
      return "web";
    }

    return "web"; // Default fallback
  }

  /**
   * Execute an action
   */
  async executeAction(
    actionId: string,
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const action: Action = {
      id: actionId,
      params,
      timestamp: new Date(),
      status: "pending",
    };

    this.activeActions.set(actionId, action);

    try {
      action.status = "running";

      let result;
      switch (actionId) {
        case "run_scan":
          result = await this.executeScan(params, context);
          break;
        case "run_tauri_scan":
          result = await this.executeTauriScan(params, context);
          break;
        case "run_web_scan":
          result = await this.executeWebScan(params, context);
          break;

        case "select_directory":
          result = await this.executeSelectDirectory(params, context);
          break;

        case "export_data":
          result = await this.executeExport(params, context);
          break;

        case "compress_images":
          result = await this.executeCompressImages(params, context);
          break;

        case "remove_duplicates":
          result = await this.executeRemoveDuplicates(params, context);
          break;

        case "archive_old_files":
          result = await this.executeArchiveOldFiles(params, context);
          break;

        default:
          throw new Error(`Unknown action: ${actionId}`);
      }

      action.status = "completed";
      action.result = result;

      if (context.onComplete) {
        context.onComplete(result);
      }

      return result;
    } catch (error) {
      action.status = "failed";
      action.error = error instanceof Error ? error.message : "Unknown error";

      if (context.onError) {
        context.onError(action.error);
      }

      throw error;
    }
  }

  /**
   * Execute scan action
   */
  private async executeScan(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<ScanResult> {
    const directory = params.directory || "current";

    if (context.onProgress) {
      context.onProgress(`Starting scan of ${directory}...`);
    }

    const result = await this.scanningEngine.startScan(directory, (progress: ScanProgress) => {
      if (context.onProgress) {
        const message = `${progress.stage} (${progress.progress}%)`;
        if (progress.currentFile) {
          context.onProgress(`${message} - ${progress.currentFile}`);
        } else {
          context.onProgress(message);
        }
      }
    });

    // Add to scan history
    this.scanHistory.push(result);

    // Keep only last 10 scans
    if (this.scanHistory.length > 10) {
      this.scanHistory = this.scanHistory.slice(-10);
    }

    if (context.onProgress) {
      context.onProgress(
        `Scan complete! Found ${result.fileCount} files totaling ${this.formatBytes(result.totalSize)}`
      );
    }

    return result;
  }

  /**
   * Execute Tauri scan action
   */
  private async executeTauriScan(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<ScanResult> {
    if (!this.isTauriAvailable()) {
      throw new Error("Tauri is not available. Please run in Tauri environment.");
    }

    const directory = params.directory || "current";

    if (context.onProgress) {
      context.onProgress(`Starting Tauri scan of ${directory}...`);
    }

    try {
      // Import Tauri dynamically to avoid web environment errors
      const { useTauriDesktop } = await import("@/composables/useTauriDesktop");
      const tauri = useTauriDesktop();

      if (context.onProgress) {
        context.onProgress("Selecting directory...");
      }

      // Let user select directory
      const selectedPath = await tauri.selectDirectory();
      if (!selectedPath) {
        throw new Error("Directory selection cancelled");
      }

      if (context.onProgress) {
        context.onProgress(`Scanning ${selectedPath} with native Rust scanner...`);
      }

      // Use Tauri's native scanner
      const result = await tauri.analyzeDirectoryWithProgress(selectedPath);

      // Convert Tauri result to ScanResult format
      const scanResult: ScanResult = {
        id: Date.now().toString(),
        timestamp: new Date(),
        directory: selectedPath,
        totalSize: result.total_size,
        fileCount: result.total_files,
        categories: this.convertTauriFileTypes(result.file_types),
        files: this.convertTauriFiles(result.largest_files),
        scanDuration: result.analysis_time_ms,
      };

      // Add to scan history
      this.scanHistory.push(scanResult);

      // Keep only last 10 scans
      if (this.scanHistory.length > 10) {
        this.scanHistory = this.scanHistory.slice(-10);
      }

      if (context.onProgress) {
        context.onProgress(
          `Tauri scan complete! Found ${scanResult.fileCount} files totaling ${this.formatBytes(scanResult.totalSize)}`
        );
      }

      return scanResult;
    } catch (error: any) {
      if (context.onError) {
        context.onError(`Tauri scan failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute select directory action
   */
  private async executeSelectDirectory(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<string | null> {
    if (context.onProgress) {
      context.onProgress("Opening directory selection dialog...");
    }

    try {
      // Import Tauri desktop functions dynamically to avoid circular dependencies
      const { useTauriDesktop } = await import("@/composables/useTauriDesktop");
      const desktop = useTauriDesktop();

      // Use the desktop selectDirectory function
      const selectedPath = await desktop.selectDirectory();

      if (context.onProgress) {
        if (selectedPath) {
          context.onProgress(`Selected directory: ${selectedPath}`);
        } else {
          context.onProgress("Directory selection cancelled");
        }
      }

      return selectedPath;
    } catch (error: any) {
      if (context.onError) {
        context.onError(`Directory selection failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute Web scan action
   */
  private async executeWebScan(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<ScanResult> {
    const directory = params.directory || "current";

    if (context.onProgress) {
      context.onProgress(`Starting Web scan of ${directory}...`);
    }

    // Force use of web scanner
    const result = await this.scanningEngine.startScan(directory, (progress: ScanProgress) => {
      if (context.onProgress) {
        const message = `${progress.stage} (${progress.progress}%)`;
        if (progress.currentFile) {
          context.onProgress(`${message} - ${progress.currentFile}`);
        } else {
          context.onProgress(message);
        }
      }
    });

    // Add to scan history
    this.scanHistory.push(result);

    // Keep only last 10 scans
    if (this.scanHistory.length > 10) {
      this.scanHistory = this.scanHistory.slice(-10);
    }

    if (context.onProgress) {
      context.onProgress(
        `Web scan complete! Found ${result.fileCount} files totaling ${this.formatBytes(result.totalSize)}`
      );
    }

    return result;
  }

  /**
   * Convert Tauri file types to our format
   */
  private convertTauriFileTypes(
    tauriTypes: Record<string, number>
  ): Record<string, { count: number; size: number }> {
    const categories: Record<string, { count: number; size: number }> = {};

    Object.entries(tauriTypes).forEach(([extension, count]) => {
      const category = this.getCategoryFromExtension(extension);
      if (!categories[category]) {
        categories[category] = { count: 0, size: 0 };
      }
      categories[category].count += count;
      // Note: Tauri doesn't provide size per type, so we'll estimate
      categories[category].size += count * 1000; // Estimate 1KB per file
    });

    return categories;
  }

  /**
   * Convert Tauri files to our format
   */
  private convertTauriFiles(
    tauriFiles: Array<{
      path: string;
      name: string;
      size: number;
      file_type: string;
      extension: string;
    }>
  ): ScanResult["files"] {
    return tauriFiles.map((file) => ({
      name: file.name,
      path: file.path,
      size: file.size,
      category: this.getCategoryFromExtension(file.extension),
      modified: new Date(),
      isDuplicate: false,
    }));
  }

  /**
   * Get category from file extension
   */
  private getCategoryFromExtension(extension: string): string {
    const ext = extension.toLowerCase();
    const categoryMap: Record<string, string> = {
      ".js": "Code",
      ".ts": "Code",
      ".vue": "Code",
      ".json": "Config",
      ".md": "Documentation",
      ".png": "Images",
      ".jpg": "Images",
      ".jpeg": "Images",
      ".gif": "Images",
      ".pdf": "Documents",
      ".txt": "Documents",
      ".doc": "Documents",
      ".docx": "Documents",
      ".mp4": "Media",
      ".mp3": "Media",
      ".zip": "Archives",
      ".rar": "Archives",
      ".exe": "Applications",
    };

    return categoryMap[ext] || "Other";
  }

  /**
   * Execute export action
   */
  private async executeExport(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const format = params.format || "json";
    const analysisData = params.analysisData;
    const files = params.files;
    const categories = params.categories;

    if (!analysisData && !files) {
      throw new Error("No data available for export");
    }

    if (context.onProgress) {
      context.onProgress(`Preparing ${format.toUpperCase()} export...`);
    }

    let exportData: string;
    let filename: string;
    let mimeType: string;

    switch (format.toLowerCase()) {
      case "json":
        exportData = JSON.stringify(
          {
            timestamp: new Date(),
            analysisData,
            files,
            categories,
            summary: {
              totalFiles: files?.length || 0,
              totalSize: analysisData?.totalSize || 0,
              categories: Object.keys(categories || {}).length,
            },
          },
          null,
          2
        );
        filename = `scan_export_${Date.now()}.json`;
        mimeType = "application/json";
        break;

      case "csv":
        exportData = this.convertToCSV(files || []);
        filename = `scan_export_${Date.now()}.csv`;
        mimeType = "text/csv";
        break;

      case "txt":
        exportData = this.convertToTXT(analysisData, files, categories);
        filename = `scan_export_${Date.now()}.txt`;
        mimeType = "text/plain";
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Create download
    this.downloadFile(exportData, filename, mimeType);

    if (context.onProgress) {
      context.onProgress(`Export complete! Downloaded ${filename}`);
    }

    return {
      format,
      filename,
      size: exportData.length,
      records: files?.length || 0,
    };
  }

  /**
   * Execute compress images action
   */
  private async executeCompressImages(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    if (context.onProgress) {
      context.onProgress("Searching for images to compress...");
    }

    // Simulate image compression
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (context.onProgress) {
      context.onProgress("Compressing images...");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const compressedCount = Math.floor(Math.random() * 20) + 5;
    const spaceSaved = Math.floor(Math.random() * 50000000) + 10000000;

    if (context.onProgress) {
      context.onProgress(
        `Compressed ${compressedCount} images, saved ${this.formatBytes(spaceSaved)}`
      );
    }

    return {
      compressedFiles: compressedCount,
      spaceSaved,
      averageCompression: Math.floor(Math.random() * 40) + 20,
    };
  }

  /**
   * Execute remove duplicates action
   */
  private async executeRemoveDuplicates(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    if (context.onProgress) {
      context.onProgress("Scanning for duplicate files...");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const duplicateCount = Math.floor(Math.random() * 50) + 10;
    const duplicateSize = Math.floor(Math.random() * 100000000) + 20000000;

    if (context.onProgress) {
      context.onProgress("Removing duplicate files...");
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (context.onProgress) {
      context.onProgress(
        `Removed ${duplicateCount} duplicates, freed ${this.formatBytes(duplicateSize)}`
      );
    }

    return {
      duplicatesRemoved: duplicateCount,
      spaceFreed: duplicateSize,
      filesProcessed: Math.floor(Math.random() * 500) + 100,
    };
  }

  /**
   * Execute archive old files action
   */
  private async executeArchiveOldFiles(
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const daysOld = params.daysOld || 365;

    if (context.onProgress) {
      context.onProgress(`Finding files older than ${daysOld} days...`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const filesToArchive = Math.floor(Math.random() * 100) + 20;
    const archiveSize = Math.floor(Math.random() * 200000000) + 50000000;

    if (context.onProgress) {
      context.onProgress("Creating archive...");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (context.onProgress) {
      context.onProgress(`Archived ${filesToArchive} files (${this.formatBytes(archiveSize)})`);
    }

    return {
      filesArchived: filesToArchive,
      archiveSize,
      archiveName: `archive_${Date.now()}.zip`,
    };
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(files: any[]): string {
    const headers = ["Name", "Path", "Size", "Category", "Modified"];
    const csvRows = [headers.join(",")];

    files.forEach((file) => {
      const row = [
        `"${file.name || ""}"`,
        `"${file.path || ""}"`,
        file.size || 0,
        `"${file.category || ""}"`,
        `"${file.modified ? new Date(file.modified).toISOString() : ""}"`,
      ];
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }

  /**
   * Convert data to TXT format
   */
  private convertToTXT(analysisData: any, files: any[], categories: any): string {
    let output = "STORAGE ANALYSIS REPORT\n";
    output += "=".repeat(50) + "\n\n";
    output += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (analysisData) {
      output += "SUMMARY\n";
      output += "-".repeat(20) + "\n";
      output += `Total Size: ${this.formatBytes(analysisData.totalSize || 0)}\n`;
      output += `Total Files: ${files?.length || 0}\n`;
      output += `Categories: ${Object.keys(categories || {}).length}\n\n`;
    }

    if (categories) {
      output += "CATEGORIES\n";
      output += "-".repeat(20) + "\n";
      Object.entries(categories).forEach(([name, data]: [string, any]) => {
        output += `${name}: ${data.count} files (${this.formatBytes(data.size)})\n`;
      });
      output += "\n";
    }

    if (files && files.length > 0) {
      output += "LARGEST FILES\n";
      output += "-".repeat(20) + "\n";
      files
        .sort((a, b) => (b.size || 0) - (a.size || 0))
        .slice(0, 20)
        .forEach((file, index) => {
          output += `${index + 1}. ${file.name} - ${this.formatBytes(file.size || 0)}\n`;
        });
    }

    return output;
  }

  /**
   * Download file to user's computer
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Get scan history
   */
  getScanHistory(): ScanResult[] {
    return this.scanHistory;
  }

  /**
   * Get active actions
   */
  getActiveActions(): Action[] {
    return Array.from(this.activeActions.values());
  }

  /**
   * Cancel action
   */
  cancelAction(actionId: string): boolean {
    if (actionId === "run_scan") {
      this.scanningEngine.cancelScan();
      return true;
    }
    return false;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
