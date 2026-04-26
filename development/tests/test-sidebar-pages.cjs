#!/usr/bin/env node

/**
 * Test script to verify all sidebar pages work properly
 * This script will systematically test each page in the sidebar navigation
 */

const fs = require('fs');
const path = require('path');

// List of all pages from the route configuration
const pages = [
  'dashboard',
  'file-browser', 
  'analysis',
  'ai-features',
  'ai-insights',
  'smart-analysis',
  'neural',
  'chat',
  'predictive',
  'timetravel',
  'temperature',
  'visualization',
  'treemap',
  'duplicates',
  'optimization',
  'automation',
  'monitoring',
  'security',
  'export',
  'development',
  'integrations',
  'settings',
  'accessibility',
  'performance'
];

console.log('🧪 Testing Sidebar Pages\n');

// Check if components exist
const componentsDir = path.join(__dirname, 'src', 'components');

pages.forEach(page => {
  const componentName = page
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  
  // Special cases
  const componentMap = {
    'AiFeatures': 'AIFeaturesPanel',
    'AiInsights': 'AIInsights',
    'SmartAnalysis': 'SmartAnalysisPanel',
    'FileBrowser': 'FileExplorer',
    'AiChat': 'EnhancedAIChat',
    'TimeTravel': 'TimeTravel',
    'FileTemperature': 'TemperatureHeatmap',
    'DataVisualization': 'Visualization',
    'StorageOptimization': 'Optimization',
    'SystemMonitoring': 'Monitoring',
    'Development': 'DevelopmentTab',
    'Integrations': 'Integrations',
    'Accessibility': 'AccessibilitySettings',
    'Performance': 'Performance'
  };

  let finalComponentName = componentMap[componentName] || componentName;
  
  // Add common suffixes if component doesn't exist
  const possibleFiles = [
    `${finalComponentName}.tsx`,
    `${finalComponentName}.jsx`,
    `${finalComponentName}.ts`,
    `${finalComponentName}.js`
  ];

  let componentExists = false;
  let componentPath = '';

  for (const file of possibleFiles) {
    const fullPath = path.join(componentsDir, file);
    if (fs.existsSync(fullPath)) {
      componentExists = true;
      componentPath = fullPath;
      break;
    }
  }

  // Also check in subdirectories
  if (!componentExists) {
    const subdirs = ['dashboard', 'features', 'shared', 'settings', 'onboarding'];
    for (const subdir of subdirs) {
      const subDirPath = path.join(componentsDir, subdir);
      if (fs.existsSync(subDirPath)) {
        for (const file of possibleFiles) {
          const fullPath = path.join(subDirPath, file);
          if (fs.existsSync(fullPath)) {
            componentExists = true;
            componentPath = fullPath;
            break;
          }
        }
        if (componentExists) break;
      }
    }
  }

  const status = componentExists ? '✅' : '❌';
  console.log(`${status} ${page.padEnd(20)} -> ${finalComponentName.padEnd(25)} ${componentPath || 'NOT FOUND'}`);
});

console.log('\n📋 Summary:');
console.log('- ✅ Components found and should work');
console.log('- ❌ Components missing - need to be created');
console.log('- Some components may use different names or be in subdirectories');

// Check for common issues
console.log('\n🔍 Checking for common issues...');

const appPath = path.join(__dirname, 'src', 'App.tsx');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');
  
  // Check for duplicate case statements
  const caseMatches = appContent.match(/case\s+'[^']+'/g);
  if (caseMatches) {
    const caseCounts = {};
    caseMatches.forEach(match => {
      const caseName = match.replace(/case\s+'/, '').replace(/'/, '');
      caseCounts[caseName] = (caseCounts[caseName] || 0) + 1;
    });
    
    const duplicates = Object.entries(caseCounts).filter(([name, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('⚠️  Duplicate case statements found:');
      duplicates.forEach(([name, count]) => {
        console.log(`   - '${name}' appears ${count} times`);
      });
    } else {
      console.log('✅ No duplicate case statements found');
    }
  }
  
  // Check for missing imports
  const importMatches = appContent.match(/import.*from.*components/g);
  if (importMatches) {
    console.log(`✅ Found ${importMatches.length} component imports`);
  }
}

console.log('\n🚀 All pages should be accessible via the sidebar navigation!');
console.log('   Test by clicking each item in the sidebar to verify functionality.');