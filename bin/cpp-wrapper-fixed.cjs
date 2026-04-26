#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Real file scanning function with better error handling
function scanDirectory(dirPath, files = [], depth = 0) {
    // Prevent infinite recursion
    if (depth > 100) {
        console.warn(`Max depth reached at: ${dirPath}`);
        return files;
    }
    
    try {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            
            try {
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath, files, depth + 1);
                } else {
                    files.push({
                        name: item,
                        path: fullPath,
                        size: stat.size,
                        extension: path.extname(item).toLowerCase(),
                        modified: stat.mtime
                    });
                }
            } catch (statError) {
                console.warn(`Cannot stat ${fullPath}: ${statError.message}`);
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}: ${error.message}`);
    }
    
    return files;
}

const directory = process.argv[2];
const options = process.argv.slice(3);

console.log('🚀 Space Analyzer C++ CLI v3.0 (Fixed Scanner)');
console.log('==========================================');
console.log(`📁 Analyzing: ${directory}`);

// Perform real file scan
const startTime = Date.now();
const files = scanDirectory(directory);
const endTime = Date.now();

// Calculate statistics
const totalFiles = files.length;
const totalSize = files.reduce((sum, file) => sum + file.size, 0);
const directories = new Set(files.map(f => path.dirname(f.path))).size;

// File type analysis
const fileTypes = {};
files.forEach(file => {
    const ext = file.extension || 'no-extension';
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
});

console.log('\n📊 Fixed Analysis Results:');
console.log('===============================');
console.log(`📁 Total Files: ${totalFiles.toLocaleString()}`);
console.log(`💾 Total Size: ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
console.log(`📂 Directories: ${directories}`);
console.log(`⏱️  Analysis Time: ${endTime - startTime}ms`);

// Show top file types
const sortedTypes = Object.entries(fileTypes)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

if (sortedTypes.length > 0) {
    console.log('\n📋 Top File Types:');
    sortedTypes.forEach(([ext, count]) => {
        console.log(`  ${ext}: ${count.toLocaleString()} files`);
    });
}

// Show largest files
const largestFiles = files
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

if (largestFiles.length > 0) {
    console.log('\n📦 Largest Files:');
    largestFiles.forEach(file => {
        const sizeGB = file.size / (1024 * 1024 * 1024);
        console.log(`  ${file.name}: ${sizeGB.toFixed(3)} GB`);
    });
}

// JSON output if requested
if (options.includes('--json')) {
    const outputFile = options[options.indexOf('--json') + 1] || 'cpp-analysis.json';
    const result = {
        tool: 'cpp',
        totalFiles,
        totalSize,
        directories,
        analysisTime: endTime - startTime,
        fileTypes,
        largestFiles: files
            .sort((a, b) => b.size - a.size)
            .slice(0, 20)
            .map(f => ({ name: f.name, path: f.path, size: f.size }))
    };
    
    require('fs').writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n📄 Results saved to: ${outputFile}`);
}

console.log('\n✅ Fixed analysis complete!');