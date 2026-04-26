#!/usr/bin/env node

/**
 * Execute AI recommendations for Native Media AI Studio cleanup
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = 'D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio';

console.log('🚀 Starting AI-powered cleanup execution...\n');

// Track results
const results = {
  directoriesCleaned: 0,
  filesDeleted: 0,
  spaceFreed: 0,
  operations: []
};

// Calculate directory size
function getDirSize(dirPath) {
  let total = 0;
  try {
    const items = fs.readdirSync(dirPath);
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          total += getDirSize(fullPath);
        } else {
          total += stat.size;
        }
      } catch (e) {
        // Skip inaccessible files
      }
    });
  } catch (e) {
    console.warn(`⚠️ Could not read directory: ${dirPath}`, e.message);
  }
  return total;
}

// Delete directory recursively
async function deleteDirectory(dirPath) {
  try {
    console.log(`🗑️  Deleting: ${dirPath}`);
    
    // Get size before deletion
    const sizeBefore = getDirSize(dirPath);
    
    // Use fs.rmSync for recursive deletion (Node.js 14.14.0+)
    fs.rmSync(dirPath, { recursive: true, force: true });
    
    results.directoriesCleaned++;
    results.spaceFreed += sizeBefore;
    results.operations.push({
      type: 'delete_directory',
      path: dirPath,
      size: sizeBefore,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Deleted: ${dirPath} (${formatBytes(sizeBefore)})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete ${dirPath}:`, error.message);
    return false;
  }
}

// Delete file
function deleteFile(filePath) {
  try {
    console.log(`🗑️  Deleting file: ${filePath}`);
    
    const stat = fs.statSync(filePath);
    const size = stat.size;
    
    fs.unlinkSync(filePath);
    
    results.filesDeleted++;
    results.spaceFreed += size;
    results.operations.push({
      type: 'delete_file',
      path: filePath,
      size: size,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Deleted file: ${filePath} (${formatBytes(size)})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete file ${filePath}:`, error.message);
    return false;
  }
}

// Format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main execution
async function executeRecommendations() {
  console.log('📋 AI Recommendations Execution Plan\n');
  console.log('📂 Target Directory:', TARGET_DIR);
  console.log('💡 Following AI recommendations from analysis...\n');
  
  // 1. Clean node_modules directories (recursively)
  console.log('🔹 Phase 1: Cleaning node_modules directories...\n');
  
  try {
    // Find all node_modules directories recursively
    const findNodeModules = (dir) => {
      const nodeModulesList = [];
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            if (item.name === 'node_modules') {
              nodeModulesList.push(fullPath);
            }
            // Recursively search subdirectories
            nodeModulesList.push(...findNodeModules(fullPath));
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
      return nodeModulesList;
    };
    
    const allNodeModules = findNodeModules(TARGET_DIR);
    
    for (const nodeModulesPath of allNodeModules) {
      const size = getDirSize(nodeModulesPath);
      
      if (size > 0) {
        console.log(`📦 Found node_modules: ${nodeModulesPath}`);
        console.log(`   Size: ${formatBytes(size)}`);
        
        const confirm = await askConfirmation(
          `Delete node_modules at ${nodeModulesPath} (${formatBytes(size)})?`
        );
        
        if (confirm) {
          await deleteDirectory(nodeModulesPath);
        }
      } else {
        console.log(`📦 Found empty node_modules: ${nodeModulesPath}`);
        console.log(`   Skipping (already empty)\n`);
      }
    }
    
    if (allNodeModules.length === 0) {
      console.log('✅ No node_modules directories found.\n');
    }
  } catch (error) {
    console.error('❌ Error scanning for node_modules:', error.message);
  }
  
  // 2. Clean build artifacts
  console.log('\n🔹 Phase 2: Cleaning build artifacts...\n');
  
  const buildDirs = ['dist', 'build', '.artifacts', 'output', 'target'];
  
  for (const dirName of buildDirs) {
    const buildPath = path.join(TARGET_DIR, dirName);
    
    if (fs.existsSync(buildPath)) {
      const size = getDirSize(buildPath);
      
      console.log(`📦 Found build directory: ${buildPath}`);
      console.log(`   Size: ${formatBytes(size)}`);
      
      const confirm = await askConfirmation(
        `Delete build directory ${buildPath} (${formatBytes(size)})?`
      );
      
      if (confirm) {
        deleteDirectory(buildPath);
      }
    }
  }
  
  // 3. Clean cache directories
  console.log('\n🔹 Phase 3: Cleaning cache directories...\n');
  
  const cacheDirs = ['.cache', 'node_modules/.cache', 'cache', 'cache_system'];
  
  for (const dirName of cacheDirs) {
    const cachePath = path.join(TARGET_DIR, dirName);
    
    if (fs.existsSync(cachePath)) {
      const size = getDirSize(cachePath);
      
      console.log(`📦 Found cache directory: ${cachePath}`);
      console.log(`   Size: ${formatBytes(size)}`);
      
      const confirm = await askConfirmation(
        `Delete cache directory ${cachePath} (${formatBytes(size)})?`
      );
      
      if (confirm) {
        deleteDirectory(cachePath);
      }
    }
  }
  
  // 4. Clean temporary files
  console.log('\n🔹 Phase 4: Cleaning temporary files...\n');
  
  try {
    const items = fs.readdirSync(TARGET_DIR, { withFileTypes: true });
    
    const tempExtensions = ['.tmp', '.log', '.swp', '.bak', '.old'];
    const tempPatterns = ['.DS_Store', 'Thumbs.db', 'desktop.ini'];
    
    let tempFilesFound = 0;
    
    for (const item of items) {
      if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        const baseName = path.basename(item.name, ext).toLowerCase();
        
        if (tempExtensions.includes(ext) || tempPatterns.includes(item.name)) {
          tempFilesFound++;
          const filePath = path.join(TARGET_DIR, item.name);
          const size = fs.statSync(filePath).size;
          
          console.log(`📄 Found temp file: ${item.name}`);
          console.log(`   Size: ${formatBytes(size)}`);
          
          const confirm = await askConfirmation(
            `Delete temporary file ${item.name} (${formatBytes(size)})?`
          );
          
          if (confirm) {
            deleteFile(filePath);
          }
        }
      }
    }
    
    if (tempFilesFound === 0) {
      console.log('✅ No temporary files found.\n');
    }
  } catch (error) {
    console.error('❌ Error scanning for temporary files:', error.message);
  }
  
  // Summary
  console.log('\n📊 Execution Summary\n');
  console.log(`📦 Directories cleaned: ${results.directoriesCleaned}`);
  console.log(`📄 Files deleted: ${results.filesDeleted}`);
  console.log(`💾 Space freed: ${formatBytes(results.spaceFreed)}`);
  console.log(`⏰ Operations executed: ${results.operations.length}`);
  
  console.log('\n✅ AI recommendations execution completed!');
  console.log('\n💡 Recommendations:');
  console.log('   - Consider implementing automated cleanup scripts');
  console.log('   - Set up regular maintenance schedule');
  console.log('   - Review .gitignore to prevent re-adding build artifacts');
  
  // Save operation log
  try {
    const logPath = path.join(__dirname, 'cleanup-log.json');
    fs.writeFileSync(logPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Operation log saved to: ${logPath}`);
  } catch (error) {
    console.error('❌ Failed to save operation log:', error.message);
  }
}

// Ask for confirmation
function askConfirmation(message) {
  // Auto-confirm for non-interactive execution (as requested in task)
  // This matches the task requirement to "Execute AI Recommendations Now"
  return Promise.resolve(true);
}

// Execute
executeRecommendations().catch(error => {
  console.error('❌ Execution failed:', error);
  process.exit(1);
});