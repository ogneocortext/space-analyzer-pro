/**
 * Optimized Scan Controller
 * Addresses performance and reliability issues
 */

const express = require("express");
const path = require("path");
const fs = require("fs");

class OptimizedScanController {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Fast scan endpoint with timeout and error handling
    this.router.post("/fast-scan", async (req, res) => {
      const scanId = `scan_${Date.now()}`;
      console.log(`🚀 Starting fast scan ${scanId}`);
      
      try {
        const { directoryPath, options = {} } = req.body;
        
        if (!directoryPath) {
          return res.status(400).json({ 
            success: false, 
            error: "Directory path is required" 
          });
        }

        // Validate path quickly
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
            error: "Directory does not exist or is inaccessible" 
          });
        }

        // Set timeout for scan
        const timeout = setTimeout(() => {
          console.log(`⏰ Scan ${scanId} timed out`);
          res.status(408).json({ 
            success: false, 
            error: "Scan timed out - directory may be too large" 
          });
        }, 30000); // 30 second timeout

        // Perform optimized scan
        const results = await this.performOptimizedScan(directoryPath, options);
        clearTimeout(timeout);

        console.log(`✅ Fast scan ${scanId} completed: ${results.files.length} files`);
        
        res.json({
          success: true,
          scanId,
          results: {
            totalFiles: results.files.length,
            totalSize: results.totalSize,
            categories: results.categories,
            scanTime: results.scanTime,
            files: results.files.slice(0, 10), // Return first 10 files
            performance: {
              filesPerSecond: Math.round(results.files.length / (results.scanTime / 1000)),
              avgFileSize: results.files.length > 0 ? Math.round(results.totalSize / results.files.length) : 0
            }
          }
        });
        
      } catch (error) {
        console.error(`❌ Fast scan ${scanId} error:`, error.message);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Test scan with safe directory
    this.router.post("/test-scan", async (req, res) => {
      try {
        // Use a safe, small directory for testing
        const testDir = path.join(__dirname, "../../../public");
        console.log(`🧪 Test scan: ${testDir}`);
        
        const results = await this.performOptimizedScan(testDir, { maxDepth: 2 });
        
        res.json({
          success: true,
          results: {
            totalFiles: results.files.length,
            totalSize: results.totalSize,
            categories: results.categories,
            scanTime: results.scanTime,
            files: results.files
          }
        });
        
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // System scan status
    this.router.get("/status", (req, res) => {
      res.json({
        success: true,
        status: "ready",
        capabilities: {
          fastScan: true,
          optimizedScan: true,
          errorHandling: true,
          timeout: true
        }
      });
    });
  }

  async performOptimizedScan(directoryPath, options = {}) {
    const startTime = Date.now();
    const results = {
      files: [],
      categories: {},
      totalSize: 0,
      scanTime: 0,
      errors: []
    };

    const maxDepth = options.maxDepth || 2; // Limit depth for performance
    const includeHidden = options.includeHidden || false;
    const maxFiles = options.maxFiles || 1000; // Limit file count
    const excludedDirs = new Set([
      'node_modules', '.git', '.vscode', '.idea', 
      'target', 'build', 'dist', '__pycache__',
      'Windows', 'System32', 'Program Files', 'Program Files (x86)',
      'AppData', 'Local', 'Roaming', 'Microsoft'
    ]);

    try {
      await this.scanDirectoryOptimized(
        directoryPath, 
        results, 
        maxDepth, 
        includeHidden, 
        maxFiles, 
        excludedDirs, 
        0
      );
    } catch (error) {
      results.errors.push(error.message);
      console.error('Scan error:', error);
    }

    results.scanTime = Date.now() - startTime;
    return results;
  }

  async scanDirectoryOptimized(dirPath, results, maxDepth, includeHidden, maxFiles, excludedDirs, currentDepth) {
    if (currentDepth >= maxDepth || results.files.length >= maxFiles) {
      return;
    }

    try {
      const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        // Stop if we've reached max files
        if (results.files.length >= maxFiles) break;

        // Skip hidden files if not included
        if (!includeHidden && item.name.startsWith('.')) {
          continue;
        }

        // Skip excluded directories
        if (excludedDirs.has(item.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, item.name);
        
        try {
          if (item.isDirectory()) {
            // Recursively scan subdirectories
            await this.scanDirectoryOptimized(
              fullPath, 
              results, 
              maxDepth, 
              includeHidden, 
              maxFiles, 
              excludedDirs, 
              currentDepth + 1
            );
          } else if (item.isFile()) {
            // Process file
            const stats = await fs.promises.stat(fullPath);
            
            // Skip very large files (>100MB) for performance
            if (stats.size > 100 * 1024 * 1024) {
              continue;
            }

            const fileInfo = {
              name: item.name,
              path: fullPath,
              size: stats.size,
              extension: path.extname(item.name).toLowerCase(),
              modified: stats.mtime,
              isDirectory: false
            };

            // Categorize file
            const category = this.categorizeFileOptimized(item.name, fileInfo.extension);
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
          // Skip inaccessible files/directories
          results.errors.push(`Cannot access ${fullPath}: ${fileError.message}`);
        }
      }
    } catch (dirError) {
      // Skip inaccessible directories
      results.errors.push(`Cannot read directory ${dirPath}: ${dirError.message}`);
    }
  }

  categorizeFileOptimized(fileName, extension) {
    // Optimized categorization with early returns
    const ext = extension;
    
    // Most common file types first
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) return "Images";
    if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'].includes(ext)) return "Videos";
    if (['.mp3', '.wav', '.flac', '.aac', '.ogg'].includes(ext)) return "Audio";
    
    // Documents
    if (['.pdf', '.doc', '.docx', '.txt', '.rtf', '.md'].includes(ext)) return "Documents";
    
    // Code
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h'].includes(ext)) return "Code";
    
    // Web
    if (['.html', '.htm', '.css', '.scss', '.json', '.xml'].includes(ext)) return "Web";
    
    // Archives
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return "Archives";
    
    // Executables
    if (['.exe', '.msi', '.app', '.dmg', '.deb', '.rpm'].includes(ext)) return "Executables";
    
    return "Other";
  }

  getRouter() {
    return this.router;
  }
}

module.exports = OptimizedScanController;
