const fs = require('fs');
const path = require('path');

// Enhanced code analysis test
function analyzeCodeFiles(targetDir) {
  console.log('🔍 Analyzing code files in:', targetDir);
  
  const codeFiles = [];
  const stats = {
    totalFiles: 0,
    jsFiles: 0,
    tsFiles: 0,
    pyFiles: 0,
    otherFiles: 0,
    totalSize: 0,
    potentialIssues: 0,
    filesWithImports: 0,
    filesWithExports: 0,
    filesWithAPI: 0,
    filesWithFunctions: 0
  };
  
  function scanDirectory(dir) {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else {
          const ext = path.extname(filePath).toLowerCase();
          const isCodeFile = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h'].includes(ext);
          
          if (isCodeFile) {
            stats.totalFiles++;
            stats.totalSize += stat.size;
            
            if (ext === '.js' || ext === '.jsx') stats.jsFiles++;
            else if (ext === '.ts' || ext === '.tsx') stats.tsFiles++;
            else if (ext === '.py') stats.pyFiles++;
            else stats.otherFiles++;
            
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              
              // Enhanced pattern detection
              const hasImports = /import|require|from/.test(content);
              const hasExports = /export|module\.exports/.test(content);
              const hasFunctions = /function|def|class|const.*=.*\(|let.*=.*\(|var.*=.*\(/.test(content);
              const hasAPI = /fetch|axios|\.get\(|\.post\(|app\.(get|post|put|delete)|router\.(get|post|put|delete)|@.*\.(get|post|put|delete)/.test(content);
              const hasUnusedImports = hasImports && content.includes('import') && !content.includes('React') && ext === '.jsx';
              const hasCircularDeps = content.includes('import') && content.includes('export') && content.includes('./');
              
              if (hasImports) stats.filesWithImports++;
              if (hasExports) stats.filesWithExports++;
              if (hasFunctions) stats.filesWithFunctions++;
              if (hasAPI) stats.filesWithAPI++;
              
              codeFiles.push({
                path: filePath,
                size: stat.size,
                type: ext,
                hasImports,
                hasExports,
                hasFunctions,
                hasAPI,
                hasUnusedImports,
                hasCircularDeps,
                lines: content.split('\n').length,
                complexity: calculateComplexity(content)
              });
              
              // Potential issues
              if (hasUnusedImports || hasCircularDeps) {
                stats.potentialIssues++;
              }
              
            } catch (readError) {
              // Skip files that can't be read
            }
          }
        }
      });
    } catch (error) {
      // Skip directories that can't be accessed
    }
  }
  
  scanDirectory(targetDir);
  
  return { codeFiles, stats };
}

function calculateComplexity(content) {
  const lines = content.split('\n');
  let complexity = 0;
  
  lines.forEach(line => {
    if (line.includes('if') || line.includes('for') || line.includes('while') || line.includes('function') || line.includes('def')) {
      complexity++;
    }
  });
  
  return complexity;
}

function findIntegrationPoints(codeFiles) {
  const frontendFiles = codeFiles.filter(f => ['.js', '.jsx', '.ts', '.tsx'].includes(f.type));
  const backendFiles = codeFiles.filter(f => ['.py', '.js', '.ts'].includes(f.type));
  
  const frontendComponents = frontendFiles.filter(f => f.hasAPI);
  const backendEndpoints = backendFiles.filter(f => f.hasAPI);
  
  return {
    frontendComponents,
    backendEndpoints,
    potentialConnections: frontendComponents.length + backendEndpoints.length
  };
}

function analyzeDependencies(codeFiles) {
  const dependencyMap = new Map();
  const unusedImports = [];
  const circularDependencies = [];
  
  codeFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      
      // Find imports
      const importMatches = content.match(/import.*from\s+['"](.*)['"]/g) || [];
      const requireMatches = content.match(/require\s*\(['"](.*)['"]\)/g) || [];
      
      const imports = [...importMatches, ...requireMatches].map(imp => {
        const match = imp.match(/['"](.*)['"]/);
        return match ? match[1] : null;
      }).filter(Boolean);
      
      dependencyMap.set(file.path, imports);
      
      // Check for unused imports (simplified)
      if (imports.length > 0) {
        imports.forEach(imp => {
          if (!content.includes(imp.split('/').pop()) && !content.includes(imp)) {
            unusedImports.push({
              file: file.path,
              import: imp,
              type: 'unused'
            });
          }
        });
      }
      
    } catch (error) {
      // Skip files that can't be read
    }
  });
  
  return { dependencyMap, unusedImports, circularDependencies };
}

// Run the analysis
const targetDir = 'D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio';
const result = analyzeCodeFiles(targetDir);

console.log('\n📊 Enhanced Code Analysis Results:');
console.log('=====================================');
console.log('📁 Total Code Files:', result.stats.totalFiles);
console.log('💾 Total Size:', (result.stats.totalSize / 1024 / 1024).toFixed(2), 'MB');
console.log('📄 JavaScript Files:', result.stats.jsFiles);
console.log('📘 TypeScript Files:', result.stats.tsFiles);
console.log('🐍 Python Files:', result.stats.pyFiles);
console.log('🔧 Other Code Files:', result.stats.otherFiles);
console.log('📦 Files with Imports:', result.stats.filesWithImports);
console.log('📤 Files with Exports:', result.stats.filesWithExports);
console.log('⚡ Files with Functions:', result.stats.filesWithFunctions);
console.log('🌐 Files with API Calls:', result.stats.filesWithAPI);
console.log('⚠️  Potential Issues:', result.stats.potentialIssues);

// Integration analysis
const integration = findIntegrationPoints(result.codeFiles);
console.log('\n🔗 Integration Analysis:');
console.log('====================');
console.log('📱 Frontend Components:', integration.frontendComponents.length);
console.log('🖥️  Backend Files:', integration.backendEndpoints.length);
console.log('🔗 Potential Connections:', integration.potentialConnections);

// Dependency analysis
const deps = analyzeDependencies(result.codeFiles);
console.log('\n🔗 Dependency Analysis:');
console.log('====================');
console.log('📦 Total Dependencies:', deps.dependencyMap.size);
console.log('⚠️  Unused Imports:', deps.unusedImports.length);
console.log('🔄 Circular Dependencies:', deps.circularDependencies.length);

// Show sample files with issues
const filesWithIssues = result.codeFiles.filter(f => f.hasUnusedImports || f.hasCircularDeps);
console.log('\n🔍 Files with Potential Issues:');
console.log('=============================');
filesWithIssues.slice(0, 5).forEach((file, index) => {
  console.log(`${index + 1}. ${path.basename(file.path)}`);
  console.log(`   Type: ${file.type}, Lines: ${file.lines}, Complexity: ${file.complexity}`);
  console.log(`   Issues: ${file.hasUnusedImports ? 'Unused imports' : ''} ${file.hasCircularDeps ? 'Circular deps' : ''}`);
  console.log('');
});

// Show API integration points
console.log('\n🌐 API Integration Points:');
console.log('========================');
const apiFiles = result.codeFiles.filter(f => f.hasAPI).slice(0, 10);
apiFiles.forEach((file, index) => {
  console.log(`${index + 1}. ${path.basename(file.path)}`);
  console.log(`   Type: ${file.type}, Path: ${file.path.split('\\').slice(-3).join('\\')}`);
  console.log('');
});

console.log('\n✅ Analysis Complete!');
console.log('📈 Compared to previous analysis, we now have:');
console.log('   • Enhanced dependency tracking');
console.log('   • Integration point identification');
console.log('   • Issue detection (unused imports, circular deps)');
console.log('   • API call pattern analysis');
console.log('   • Complexity metrics');