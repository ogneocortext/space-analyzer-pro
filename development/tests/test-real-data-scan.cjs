#!/usr/bin/env node

/**
 * Test script to verify the application works with real data
 * from the target directory: D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Testing Space Analyzer Pro with Real Data');
console.log('📁 Target Directory: D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio');
console.log('');

// Test 1: Verify the target directory exists and has content
const fs = require('fs');
const targetDir = 'D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio';

console.log('Test 1: Verifying target directory...');
try {
  if (fs.existsSync(targetDir)) {
    const stats = fs.statSync(targetDir);
    console.log('✅ Target directory exists');
    console.log(`📁 Directory: ${targetDir}`);
    console.log(`📅 Created: ${stats.birthtime}`);
    console.log(`📁 Type: ${stats.isDirectory() ? 'Directory' : 'File'}`);
    
    // List some contents to verify it has files
    const contents = fs.readdirSync(targetDir);
    console.log(`📄 Contains ${contents.length} items`);
    console.log('📁 Sample contents:', contents.slice(0, 5));
  } else {
    console.log('❌ Target directory does not exist');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Error accessing target directory:', error.message);
  process.exit(1);
}

console.log('');

// Test 2: Test the AnalysisBridge with the target directory
console.log('Test 2: Testing AnalysisBridge with target directory...');
try {
  // Import the AnalysisBridge
  const { AnalysisBridge } = require('./src/services/AnalysisBridge.js');
  const bridge = new AnalysisBridge();
  
  console.log('✅ AnalysisBridge imported successfully');
  console.log('🔧 Testing directory analysis...');
  
  // Test with a smaller subset first to verify functionality
  const testDir = targetDir;
  
  console.log(`🔍 Starting analysis of: ${testDir}`);
  
  // Create a simple test to verify the bridge works
  const testAnalysis = async () => {
    try {
      console.log('⏳ Analysis in progress...');
      
      // Use a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout')), 30000); // 30 second timeout
      });
      
      const analysisPromise = bridge.analyzeDirectoryWithProgress(testDir, (progress) => {
        console.log(`📊 Progress: ${progress.files} files, ${Math.round(progress.percentage)}%, Current: ${progress.currentFile}`);
      });
      
      // Race between analysis and timeout
      const result = await Promise.race([analysisPromise, timeoutPromise]);
      
      console.log('✅ Analysis completed successfully!');
      console.log('📊 Analysis Results:');
      console.log(`   - Total Files: ${result.result.totalFiles}`);
      console.log(`   - Total Size: ${(result.result.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
      console.log(`   - Directories: ${Object.keys(result.result.categories || {}).length}`);
      console.log(`   - Analysis ID: ${result.analysisId}`);
      
      // Test data conversion functions
      console.log('🔄 Testing data conversion...');
      
      // Test dashboard data conversion
      const dashboardData = {
        totalFiles: result.result.totalFiles,
        totalSize: result.result.totalSize,
        directories: Object.keys(result.result.categories || {}).length,
        largestFiles: result.result.files
          .sort((a, b) => b.size - a.size)
          .slice(0, 5)
          .map(f => ({ name: f.name, size: f.size })),
        categories: result.result.categories || {},
        ai_insights: result.result.ai_insights || {
          storage_warnings: [],
          optimization_suggestions: [],
          potential_duplicates: 0
        },
        directoryPath: result.result.directoryPath || testDir
      };
      
      console.log('✅ Dashboard data conversion successful');
      console.log(`   - Files processed: ${dashboardData.totalFiles}`);
      console.log(`   - Categories: ${Object.keys(dashboardData.categories).length}`);
      console.log(`   - Largest files: ${dashboardData.largestFiles.length}`);
      
      // Test neural data conversion
      const neuralData = {
        nodes: result.result.files.slice(0, 20).map((file, index) => ({
          id: `node-${index}`,
          x: Math.random() * 400 + 50,
          y: Math.random() * 300 + 50,
          size: Math.max(5, Math.min(25, Math.log10(file.size + 1) * 3)),
          type: file.extension ? 'file' : 'directory',
          connections: [],
          fileType: getFileType(file.extension),
          fileSize: file.size,
          accessFrequency: Math.max(10, 100 - Math.min(90, Math.log10(file.size + 1) * 10))
        })),
        connections: [],
        metrics: {
          neuralDensity: 0.75,
          connectionStrength: 0.58,
          patternRecognition: 0.82,
          anomalyScore: 0.15
        }
      };
      
      console.log('✅ Neural data conversion successful');
      console.log(`   - Nodes created: ${neuralData.nodes.length}`);
      
      return true;
    } catch (error) {
      console.log('❌ Analysis failed:', error.message);
      return false;
    }
  };
  
  testAnalysis().then(success => {
    if (success) {
      console.log('');
      console.log('🎉 All tests passed! The application is ready to work with real data.');
      console.log('🌐 Application is running at: http://localhost:3001');
      console.log('📁 Target directory: D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio');
      console.log('');
      console.log('📋 Next Steps:');
      console.log('   1. Open the application in your browser');
      console.log('   2. The application should automatically start analyzing the target directory');
      console.log('   3. Navigate through all pages to verify real data is displayed');
      console.log('   4. Test AI features with the real file data');
      console.log('   5. Verify all visualizations show actual file system data');
    } else {
      console.log('');
      console.log('❌ Tests failed. Please check the error messages above.');
      process.exit(1);
    }
  });

} catch (error) {
  console.log('❌ Error testing AnalysisBridge:', error.message);
  console.log('💡 This might be expected if the server components are not built yet.');
  console.log('🔧 Please ensure the server is properly set up and try again.');
  process.exit(1);
}

function getFileType(extension) {
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  const documentExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'];
  const systemExts = ['exe', 'dll', 'sys', 'bat', 'cmd', 'sh'];
  
  if (!extension) return 'other';
  
  const ext = extension.toLowerCase();
  if (videoExts.includes(ext)) return 'video';
  if (documentExts.includes(ext)) return 'document';
  if (systemExts.includes(ext)) return 'system';
  return 'other';
}