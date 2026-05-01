/**
 * Simple Scan Test Controller
 * Direct test of scanning functionality without complex routing
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

class ScanTestController {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Simple test scan endpoint
    this.router.post("/test-scan", async (req, res) => {
      try {
        console.log("🔍 Test scan request received:", req.body);

        const { directoryPath, options = {} } = req.body;

        if (!directoryPath) {
          return res.status(400).json({
            success: false,
            error: "Directory path is required",
          });
        }

        // Validate path exists
        try {
          const stats = await fs.promises.stat(directoryPath);
          if (!stats.isDirectory()) {
            return res.status(400).json({
              success: false,
              error: "Path is not a directory",
            });
          }
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: "Directory does not exist",
          });
        }

        console.log(`📁 Starting scan of: ${directoryPath}`);

        // Use Node.js scanner for testing
        const results = await this.scanWithNodeJS(directoryPath, options);

        console.log(`✅ Scan completed: ${results.files.length} files found`);

        res.json({
          success: true,
          results: {
            totalFiles: results.files.length,
            totalSize: results.totalSize,
            files: results.files.slice(0, 10), // Return first 10 files for testing
            categories: results.categories,
            scanTime: results.scanTime,
          },
        });
      } catch (error) {
        console.error("❌ Scan error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Test native scanner availability
    this.router.get("/test-native", async (req, res) => {
      try {
        console.log("🔧 Testing native scanner availability...");

        let rustAvailable = false;
        let cppAvailable = false;

        // Test Rust scanner
        try {
          const rustPath = path.join(
            __dirname,
            "../../native/scanner/target/release/space_scanner.dll"
          );
          rustAvailable = fs.existsSync(rustPath);
        } catch (e) {
          console.log("Rust scanner not available:", e.message);
        }

        // Test C++ scanner
        try {
          const cppPath = path.join(
            __dirname,
            "../../src/cpp/native-scanner/build/native_scanner.lib"
          );
          cppAvailable = fs.existsSync(cppPath);
        } catch (e) {
          console.log("C++ scanner not available:", e.message);
        }

        res.json({
          success: true,
          nativeScanners: {
            rust: rustAvailable,
            cpp: cppAvailable,
          },
          nodejs: true, // Always available
          recommendation: rustAvailable ? "rust" : cppAvailable ? "cpp" : "nodejs",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
  }

  async scanWithNodeJS(directoryPath, options) {
    const startTime = Date.now();
    const results = {
      files: [],
      categories: {},
      totalSize: 0,
      scanTime: 0,
    };

    const maxDepth = options.maxDepth || 3;
    const includeHidden = options.includeHidden || false;
    const self = this; // Store reference to this

    async function scanDirectory(dirPath, currentDepth = 0) {
      if (currentDepth >= maxDepth) return;

      try {
        const items = await fs.promises.readdir(dirPath);

        for (const item of items) {
          // Skip hidden files if not included
          if (!includeHidden && item.startsWith(".")) {
            continue;
          }

          const fullPath = path.join(dirPath, item);

          try {
            const stats = await fs.promises.stat(fullPath);

            if (stats.isDirectory()) {
              await scanDirectory(fullPath, currentDepth + 1);
            } else {
              // Process file
              const fileInfo = {
                name: item,
                path: fullPath,
                size: stats.size,
                extension: path.extname(item).toLowerCase(),
                modified: stats.mtime,
                isDirectory: false,
              };

              // Categorize file
              const category = ScanTestController.categorizeFile(item, fileInfo.extension);
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

    await scanDirectory(directoryPath);
    results.scanTime = Date.now() - startTime;

    return results;
  }

  static categorizeFile(fileName, extension) {
    const name = fileName.toLowerCase();

    // Documents
    if ([".pdf", ".doc", ".docx", ".txt", ".rtf", ".md"].includes(extension)) {
      return "Documents";
    }

    // Images
    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"].includes(extension)) {
      return "Images";
    }

    // Videos
    if ([".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv"].includes(extension)) {
      return "Videos";
    }

    // Audio
    if ([".mp3", ".wav", ".flac", ".aac", ".ogg"].includes(extension)) {
      return "Audio";
    }

    // Code
    if (
      [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".cs",
        ".php",
        ".rb",
        ".go",
        ".rs",
      ].includes(extension)
    ) {
      return "Code";
    }

    // Archives
    if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(extension)) {
      return "Archives";
    }

    // Executables
    if ([".exe", ".msi", ".deb", ".rpm", ".dmg"].includes(extension)) {
      return "Executables";
    }

    return "Other";
  }

  getRouter() {
    return this.router;
  }
}

module.exports = ScanTestController;
