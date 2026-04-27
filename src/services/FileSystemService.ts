/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

import { DebugLogger } from "./DebugLogger";
import { errorHandler } from "./ErrorHandler";

export interface FileItem {
  name: string;
  path: string;
  size: number;
  extension: string;
  category: string;
  isDirectory: boolean;
  lastModified: Date;
  permissions?: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export interface DirectoryInfo {
  path: string;
  name: string;
  totalFiles: number;
  totalSize: number;
  files: FileItem[];
  subdirectories: string[];
  lastScanned: Date;
}

export interface FileSystemOperation {
  type: "read" | "write" | "delete" | "rename" | "move";
  path: string;
  status: "pending" | "success" | "error";
  timestamp: Date;
  error?: string;
}

export class FileSystemService {
  private static instance: FileSystemService;
  private logger = DebugLogger.getInstance();
  private operationHistory: FileSystemOperation[] = [];
  private maxHistorySize = 50;

  private constructor() {}

  static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  // Enhanced directory selection with File System Access API
  async selectDirectory(): Promise<DirectoryInfo | null> {
    try {
      this.logger.info("FileSystemService", "Starting directory selection");

      // Check if File System Access API is available
      if ("showDirectoryPicker" in window) {
        return await this.selectDirectoryWithFileSystemAPI();
      } else {
        return await this.selectDirectoryWithFallback();
      }
    } catch (error) {
      errorHandler.handleFileSystemError(error as Error, {
        component: "FileSystemService",
        action: "selectDirectory",
      });
      return null;
    }
  }

  private async selectDirectoryWithFileSystemAPI(): Promise<DirectoryInfo | null> {
    try {
      this.logger.info("FileSystemService", "Using File System Access API");

      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });

      // Get directory name from handle
      const directoryName = directoryHandle.name || "Selected Directory";

      // Create a mock directory info for now (actual scanning will be done by backend)
      const directoryInfo: DirectoryInfo = {
        path: `[FILE_SYSTEM_API]${directoryName}`,
        name: directoryName,
        totalFiles: 0,
        totalSize: 0,
        files: [],
        subdirectories: [],
        lastScanned: new Date(),
      };

      this.logger.info("FileSystemService", "Directory selected with File System Access API", {
        name: directoryName,
        handle: "FileSystemDirectoryHandle",
      });

      return directoryInfo;
    } catch (error) {
      this.logger.error("FileSystemService", "File System Access API failed", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async selectDirectoryWithFallback(): Promise<DirectoryInfo | null> {
    try {
      this.logger.info("FileSystemService", "Using fallback directory selection");

      // Show a simple prompt for directory path
      const path = await this.promptForDirectoryPath();

      if (!path) {
        return null;
      }

      const directoryInfo: DirectoryInfo = {
        path: path,
        name: path.split(/[/\\]/).pop() || path,
        totalFiles: 0,
        totalSize: 0,
        files: [],
        subdirectories: [],
        lastScanned: new Date(),
      };

      this.logger.info("FileSystemService", "Directory selected with fallback", { path });

      return directoryInfo;
    } catch (error) {
      this.logger.error("FileSystemService", "Fallback directory selection failed", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async promptForDirectoryPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const dialog = document.createElement("div");
      dialog.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      `;

      dialog.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #333;">📁 Select Directory Path</h3>
        <p style="margin: 0 0 1rem 0; color: #666;">Enter a directory path or choose from common paths:</p>
        <div style="margin-bottom: 1rem;">
          <select id="path-select" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
            <option value="">Choose a common path...</option>
            <option value="C:\\Users\\Public\\Documents">C:\\Users\\Public\\Documents</option>
            <option value="D:\\Projects">D:\\Projects</option>
            <option value="E:\\Projects">E:\\Projects</option>
            <option value=".\\src">.\\src</option>
            <option value="..\\..\\cli">..\\..\\cli</option>
            <option value="..\\..\\src\\web">..\\..\\src\\web</option>
            <option value="..\\..">..\\.. (root)</option>
          </select>
          <input type="text" id="path-input" placeholder="Or enter custom path..." 
                 style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 1rem; font-size: 0.875rem; color: #666;">
          <strong>Examples:</strong><br>
          • C:\\Users\\YourName\\Documents<br>
          • D:\\MyProjects<br>
          • .\\current-folder
        </div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button id="cancel-btn" style="padding: 0.5rem 1rem; border: 1px solid #ccc; background: #f5f5f5; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ok-btn" style="padding: 0.5rem 1rem; border: none; background: #007acc; color: white; border-radius: 4px; cursor: pointer;">OK</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      const select = dialog.querySelector("#path-select") as HTMLSelectElement;
      const input = dialog.querySelector("#path-input") as HTMLInputElement;
      const okBtn = dialog.querySelector("#ok-btn") as HTMLButtonElement;
      const cancelBtn = dialog.querySelector("#cancel-btn") as HTMLButtonElement;

      const handleSelectChange = () => {
        if (select.value) {
          input.value = select.value;
        }
      };

      const handleOk = () => {
        const path = input.value.trim() || select.value;
        document.body.removeChild(modal);
        resolve(path || null);
      };

      const handleCancel = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      select.addEventListener("change", handleSelectChange);
      okBtn.addEventListener("click", handleOk);
      cancelBtn.addEventListener("click", handleCancel);
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleOk();
      });

      // Focus on input
      input.focus();
    });
  }

  // File operations
  async deleteFile(filePath: string): Promise<boolean> {
    const operation: FileSystemOperation = {
      type: "delete",
      path: filePath,
      status: "pending",
      timestamp: new Date(),
    };

    try {
      this.logger.info("FileSystemService", "Deleting file", { filePath });

      // This would need to be implemented via backend API
      // For now, just log the operation
      operation.status = "success";
      this.addToHistory(operation);

      return true;
    } catch (error) {
      operation.status = "error";
      operation.error = (error as Error).message;
      this.addToHistory(operation);

      errorHandler.handleFileSystemError(error as Error, {
        component: "FileSystemService",
        action: "deleteFile",
        additionalData: { filePath },
      });

      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    const operation: FileSystemOperation = {
      type: "rename",
      path: oldPath,
      status: "pending",
      timestamp: new Date(),
    };

    try {
      this.logger.info("FileSystemService", "Renaming file", { oldPath, newPath });

      // This would need to be implemented via backend API
      // For now, just log the operation
      operation.status = "success";
      this.addToHistory(operation);

      return true;
    } catch (error) {
      operation.status = "error";
      operation.error = (error as Error).message;
      this.addToHistory(operation);

      errorHandler.handleFileSystemError(error as Error, {
        component: "FileSystemService",
        action: "renameFile",
        additionalData: { oldPath, newPath },
      });

      return false;
    }
  }

  async moveFile(sourcePath: string, targetPath: string): Promise<boolean> {
    const operation: FileSystemOperation = {
      type: "move",
      path: sourcePath,
      status: "pending",
      timestamp: new Date(),
    };

    try {
      this.logger.info("FileSystemService", "Moving file", { sourcePath, targetPath });

      // This would need to be implemented via backend API
      // For now, just log the operation
      operation.status = "success";
      this.addToHistory(operation);

      return true;
    } catch (error) {
      operation.status = "error";
      operation.error = (error as Error).message;
      this.addToHistory(operation);

      errorHandler.handleFileSystemError(error as Error, {
        component: "FileSystemService",
        action: "moveFile",
        additionalData: { sourcePath, targetPath },
      });

      return false;
    }
  }

  private addToHistory(operation: FileSystemOperation) {
    this.operationHistory.push(operation);

    // Maintain history size
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift();
    }
  }

  // Get operation history
  getOperationHistory(): FileSystemOperation[] {
    return [...this.operationHistory];
  }

  // Clear operation history
  clearHistory(): void {
    this.operationHistory = [];
  }

  // Validate file path
  isValidPath(path: string): boolean {
    if (!path || typeof path !== "string") {
      return false;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(path)) {
      return false;
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    const fileName = path.split(/[/\\]/).pop() || "";
    if (reservedNames.test(fileName)) {
      return false;
    }

    return true;
  }

  // Get file extension
  getFileExtension(filePath: string): string {
    const parts = filePath.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
  }

  // Categorize file by extension
  categorizeFile(filePath: string): string {
    const extension = this.getFileExtension(filePath);

    const categories: { [key: string]: string[] } = {
      Documents: ["pdf", "doc", "docx", "txt", "rtf", "odt", "md"],
      Images: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico"],
      Videos: ["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"],
      Audio: ["mp3", "wav", "flac", "aac", "ogg", "wma"],
      Code: [
        "js",
        "ts",
        "jsx",
        "tsx",
        "html",
        "css",
        "scss",
        "less",
        "json",
        "xml",
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
      ],
      Archives: ["zip", "rar", "7z", "tar", "gz", "bz2"],
      Executables: ["exe", "msi", "dmg", "pkg", "deb", "rpm"],
      Spreadsheets: ["xls", "xlsx", "csv", "ods"],
      Presentations: ["ppt", "pptx", "odp"],
      Fonts: ["ttf", "otf", "woff", "woff2", "eot"],
      System: ["dll", "sys", "drv", "ini", "cfg", "conf"],
    };

    for (const [category, extensions] of Object.entries(categories)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }

    return "Other";
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// Export singleton instance
export const fileSystemService = FileSystemService.getInstance();
