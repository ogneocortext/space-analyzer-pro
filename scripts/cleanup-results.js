#!/usr/bin/env node

/**
 * Cleanup Results Script
 * Cleans up and organizes results folder by date
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, '..', 'results');

const args = process.argv.slice(2);
const daysToKeep = parseInt(args[0]) || 7;

console.log('🧹 Cleaning up results folder...\n');

// Ensure results directory exists
if (!fs.existsSync(resultsDir)) {
  console.log('Results folder does not exist. Creating it...');
  fs.mkdirSync(resultsDir, { recursive: true });
  process.exit(0);
}

// Get all files in results directory
const files = fs.readdirSync(resultsDir);

if (files.length === 0) {
  console.log('✅ Results folder is already clean');
  process.exit(0);
}

console.log(`Found ${files.length} files in results folder\n`);

// Organize by date
const today = new Date();
const dateFolder = path.join(resultsDir, today.toISOString().split('T')[0]);

if (!fs.existsSync(dateFolder)) {
  fs.mkdirSync(dateFolder, { recursive: true });
  console.log(`📁 Created date folder: ${dateFolder}`);
}

// Move files to date folder
let movedCount = 0;
files.forEach(file => {
  const srcPath = path.join(resultsDir, file);
  const destPath = path.join(dateFolder, file);
  
  // Skip if already in a date folder
  if (fs.existsSync(dateFolder) && file === path.basename(dateFolder)) return;
  
  try {
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

const folders = fs.readdirSync(resultsDir).filter(f => 
  fs.statSync(path.join(resultsDir, f)).isDirectory() && 
  /^\d{4}-\d{2}-\d{2}$/.test(f)
);

let deletedCount = 0;
folders.forEach(folder => {
  const folderDate = new Date(folder);
  if (folderDate < cutoffDate) {
    const folderPath = path.join(resultsDir, folder);
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log(`  Deleted old folder: ${folder}`);
    deletedCount++;
  }
});

if (deletedCount > 0) {
  console.log(`\n🗑️  Deleted ${deletedCount} old date folders (older than ${daysToKeep} days)`);
}

console.log('\n✅ Cleanup complete');
