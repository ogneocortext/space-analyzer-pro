/**
 * Fixed Scan Controller
 * Addresses all identified scanning issues
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

class FixedScanController {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Fixed scan endpoint
    this.router.post("/scan", async (req, res) => {
      try {
        console.log('🔍 Starting fixed scan...');
        
        const { directoryPath, options = {} } = req.body;
        
        if (!directoryPath) {
          return res.status(400).json({ 
            success: false, 
            error: "Directory path is required" 
          });
        }

        // Validate path exists
        try {
          const stats = await fs.promises.stat(directoryPath);
          if (!stats.isDirectory()) {
            return res.status(400).json({ 
              success: false, 
              error: "Path is not a directory" 
            });
          }
        } catch (error) {
          return res.status(400).json({ 
            success: false, 
            error: "Directory does not exist" 
          });
        }

        console.log(`📁 Scanning: ${directoryPath}`);
        
        // Use fixed scanning method
        const results = await this.performScan(directoryPath, options);
        
        console.log(`✅ Scan complete: ${results.files.length} files, ${results.totalSize} bytes`);
        
        res.json({
          success: true,
          results: {
            totalFiles: results.files.length,
            totalSize: results.totalSize,
            categories: results.categories,
            scanTime: results.scanTime,
            files: results.files.slice(0, 20) // Return first 20 files
          }
        });
        
      } catch (error) {
        console.error('❌ Scan error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Quick scan test endpoint
    this.router.post("/quick-test", async (req, res) => {
      try {
        const { directoryPath = "C:\\Users" } = req.body;
        
        console.log(`🚀 Quick test scan: ${directoryPath}`);
        
        // Simple scan with limited depth
        const results = await this.quickScan(directoryPath);
        
        res.json({
          success: true,
          results: {
            totalFiles: results.files.length,
            totalSize: results.totalSize,
            categories: results.categories,
            scanTime: results.scanTime,
            sampleFiles: results.files.slice(0, 5)
          }
        });
        
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  }

  async performScan(directoryPath, options) {
    const startTime = Date.now();
    const results = {
      files: [],
      categories: {},
      totalSize: 0,
      scanTime: 0
    };

    const maxDepth = options.maxDepth || 3;
    const includeHidden = options.includeHidden || false;

    // Use async/await properly with proper error handling
    try {
      await this.scanDirectoryRecursive(directoryPath, results, maxDepth, includeHidden, 0);
    } catch (error) {
      console.error('Scan error:', error);
      throw error;
    }

    results.scanTime = Date.now() - startTime;
    return results;
  }

  async scanDirectoryRecursive(dirPath, results, maxDepth, includeHidden, currentDepth) {
    if (currentDepth >= maxDepth) return;

    try {
      const items = await fs.promises.readdir(dirPath);
      
      for (const item of items) {
        // Skip hidden files if not included
        if (!includeHidden && item.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dirPath, item);
        
        try {
          const stats = await fs.promises.stat(fullPath);
          
          if (stats.isDirectory()) {
            await this.scanDirectoryRecursive(fullPath, results, maxDepth, includeHidden, currentDepth + 1);
          } else {
            // Process file
            const fileInfo = {
              name: item,
              path: fullPath,
              size: stats.size,
              extension: path.extname(item).toLowerCase(),
              modified: stats.mtime,
              isDirectory: false
            };

            // Categorize file using static method
            const category = this.categorizeFileStatic(item, fileInfo.extension);
            fileInfo.category = category;

            results.files.push(fileInfo);
            results.totalSize += stats.size;

            // Update category stats
            if (!results.categories[category]) {
              results.categories[category] = { count: 0, size: 0 };
            }
            results.categories[category].count++;
            results.categories[category].size += stats.size;
          }
        } catch (fileError) {
          // Skip files that can't be accessed
          console.warn(`Warning: Cannot access ${fullPath}: ${fileError.message}`);
        }
      }
    } catch (dirError) {
      console.warn(`Warning: Cannot read directory ${dirPath}: ${dirError.message}`);
    }
  }

  async quickScan(directoryPath) {
    const startTime = Date.now();
    const results = {
      files: [],
      categories: {},
      totalSize: 0,
      scanTime: 0
    };

    try {
      const items = await fs.promises.readdir(directoryPath);
      
      // Only scan first level, limit to 50 files
      let fileCount = 0;
      for (const item of items) {
        if (fileCount >= 50) break;
        
        if (item.startsWith('.')) continue; // Skip hidden files

        const fullPath = path.join(directoryPath, item);
        
        try {
          const stats = await fs.promises.stat(fullPath);
          
          if (!stats.isDirectory()) {
            const fileInfo = {
              name: item,
              path: fullPath,
              size: stats.size,
              extension: path.extname(item).toLowerCase(),
              modified: stats.mtime,
              isDirectory: false
            };

            const category = this.categorizeFileStatic(item, fileInfo.extension);
            fileInfo.category = category;

            results.files.push(fileInfo);
            results.totalSize += stats.size;

            if (!results.categories[category]) {
              results.categories[category] = { count: 0, size: 0 };
            }
            results.categories[category].count++;
            results.categories[category].size += stats.size;
            
            fileCount++;
          }
        } catch (error) {
          // Skip inaccessible files
        }
      }
    } catch (error) {
      console.error('Quick scan error:', error);
    }

    results.scanTime = Date.now() - startTime;
    return results;
  }

  categorizeFileStatic(fileName, extension) {
    const name = fileName.toLowerCase();
    
    // Documents
    if ([".pdf", ".doc", ".docx", ".txt", ".rtf", ".md"].includes(extension)) {
      return "Documents";
    }
    
    // Images
    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico"].includes(extension)) {
      return "Images";
    }
    
    // Videos
    if ([".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm"].includes(extension)) {
      return "Videos";
    }
    
    // Audio
    if ([".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a"].includes(extension)) {
      return "Audio";
    }
    
    // Code
    if ([".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".h", ".hpp", 
         ".cs", ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".scala"].includes(extension)) {
      return "Code";
    }
    
    // Web files
    if ([".html", ".htm", ".css", ".scss", ".sass", ".less", ".xml", ".json", 
         ".yaml", ".yml", ".toml", ".ini"].includes(extension)) {
      return "Web";
    }
    
    // Archives
    if ([".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"].includes(extension)) {
      return "Archives";
    }
    
    // Executables
    if ([".exe", ".msi", ".app", ".dmg", ".deb", ".rpm", ".apk", ".bat", ".cmd", ".sh"].includes(extension)) {
      return "Executables";
    }
    
    // Databases
    if ([".db", ".sqlite", ".sqlite3", ".mdb", ".accdb"].includes(extension)) {
      return "Databases";
    }
    
    // Fonts
    if ([".ttf", ".otf", ".woff", ".woff2", ".eot"].includes(extension)) {
      return "Fonts";
    }
    
    // System files
    if ([".dll", ".so", ".sys", ".tmp", ".log", ".dat", ".reg"].includes(extension)) {
      return "System";
    }
    
    return "Other";
  }

  getRouter() {
    return this.router;
  }
}

module.exports = FixedScanController;
