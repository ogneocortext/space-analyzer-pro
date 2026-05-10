#!/usr/bin/env node

/**
 * Cleanup Results Script
 * Cleans up and organizes results folder by date
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "..", "results");

const args = process.argv.slice(2);
const daysToKeep = parseInt(args[0]) || 7;

console.log("🧹 Cleaning up results folder...\n");

// Ensure results directory exists
if (!fs.existsSync(resultsDir)) {
  console.log("Results folder does not exist. Creating it...");
  fs.mkdirSync(resultsDir, { recursive: true });
  process.exit(0);
}

// Get all files in results directory with safety checks
let files;
try {
  files = fs.readdirSync(resultsDir);
} catch (error) {
  console.error("❌ Error reading results directory:", error.message);
  process.exit(1);
}

if (files.length === 0) {
  console.log("✅ Results folder is already clean");
  process.exit(0);
}

console.log(`Found ${files.length} files in results folder\n`);

// Organize by date
const today = new Date();
const dateFolder = path.join(resultsDir, today.toISOString().split("T")[0]);

if (!fs.existsSync(dateFolder)) {
  try {
    fs.mkdirSync(dateFolder, { recursive: true });
    console.log(`📁 Created date folder: ${dateFolder}`);
  } catch (error) {
    console.error("❌ Error creating date folder:", error.message);
    process.exit(1);
  }
}

// Move files to date folder with validation
let movedCount = 0;
const maxFileSize = 100 * 1024 * 1024; // 100MB limit

files.forEach((file) => {
  // Skip hidden files and directories
  if (file.startsWith(".") || file === path.basename(dateFolder)) {
    return;
  }

  const srcPath = path.join(resultsDir, file);
  const destPath = path.join(dateFolder, file);

  try {
    const stats = fs.statSync(srcPath);

    // Skip if it's a directory or too large
    if (stats.isDirectory()) {
      console.log(`  Skipping directory: ${file}`);
      return;
    }

    if (stats.size > maxFileSize) {
      console.log(`  Skipping large file: ${file} (${Math.round(stats.size / 1024 / 1024)}MB)`);
      return;
    }

    fs.renameSync(srcPath, destPath);
    console.log(`  Moved: ${file}`);
    movedCount++;
  } catch (error) {
    console.error(`  Error moving ${file}:`, error.message);
  }
});

console.log(`\n✅ Moved ${movedCount} files to ${dateFolder}`);

// Clean up old date folders (older than daysToKeep)
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

let folders = [];
try {
  folders = fs.readdirSync(resultsDir).filter((f) => {
    const fPath = path.join(resultsDir, f);
    try {
      return fs.statSync(fPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
    } catch (e) {
      return false;
    }
  });
} catch (error) {
  console.error("⚠️  Error reading results directory:", error.message);
}

let deletedCount = 0;
folders.forEach((folder) => {
  try {
    // Parse date safely
    const [year, month, day] = folder.split("-").map(Number);
    const folderDate = new Date(year, month - 1, day); // month is 0-indexed

    // Validate date is valid before comparing
    if (!isNaN(folderDate.getTime()) && folderDate < cutoffDate) {
      const folderPath = path.join(resultsDir, folder);
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`  Deleted old folder: ${folder}`);
      deletedCount++;
    }
  } catch (error) {
    console.warn(`⚠️  Could not process folder ${folder}:`, error.message);
  }
});

if (deletedCount > 0) {
  console.log(`\n🗑️  Deleted ${deletedCount} old date folders (older than ${daysToKeep} days)`);
}

console.log("\n✅ Cleanup complete");
