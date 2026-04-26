#!/usr/bin/env node

/**
 * Ollama Source Code Analyzer
 * Analyzes source code files using Ollama for code quality, improvements, and issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Source directories and file types to analyze
const SOURCE_DIRS = ['src', 'server'];
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.html'];
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '*.test.*',
  '*.spec.*',
  '*.min.*'
];

console.log('🔍 Starting Ollama Source Code Analysis...\n');

// Function to check if Ollama is running
function checkOllamaStatus() {
  try {
    console.log('🔍 Checking Ollama status...');
    const response = execSync('curl -s http://localhost:11434/api/tags', { encoding: 'utf8' });
    const data = JSON.parse(response);
    console.log(`✅ Ollama running with ${data.models?.length || 0} models available`);
    return true;
  } catch (error) {
    console.error('❌ Ollama not running. Please start Ollama with: ollama serve');
    process.exit(1);
  }
}

// Function to get all source files
function getSourceFiles() {
  const files = [];

  function shouldExclude(filePath) {
    return EXCLUDE_PATTERNS.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }

  function scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(process.cwd(), fullPath);

      if (shouldExclude(relativePath)) continue;

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (FILE_EXTENSIONS.includes(ext)) {
          files.push({
            path: fullPath,
            relativePath,
            name: item,
            extension: ext,
            size: stat.size,
            modified: stat.mtime
          });
        }
      }
    }
  }

  SOURCE_DIRS.forEach(dir => scanDirectory(dir));

  console.log(`📁 Found ${files.length} source files to analyze`);
  return files;
}

// Function to analyze code with Ollama
async function analyzeCodeWithOllama(filePath, content, fileInfo) {
  console.log(`🤖 Analyzing ${fileInfo.relativePath}...`);

  const prompt = `Please analyze this ${fileInfo.extension} file and provide detailed feedback on:

**Code Quality:**
- Code structure and organization
- Best practices adherence
- Naming conventions
- Error handling
- Performance considerations

**Potential Issues:**
- Bugs or logical errors
- Security vulnerabilities
- Code smells or anti-patterns
- Deprecated API usage

**Improvement Suggestions:**
- Code optimization opportunities
- Refactoring recommendations
- Documentation improvements
- Testing suggestions

**Specific Analysis:**
- For React/TypeScript files: Component structure, hooks usage, prop types
- For CSS files: Organization, performance, accessibility
- For JavaScript files: ES6+ usage, async/await patterns, error handling

File: ${fileInfo.relativePath}
Size: ${fileInfo.size} bytes
Modified: ${fileInfo.modified.toISOString()}

Content:
${content.substring(0, 8000)} // Limit content to avoid token limits

Provide specific, actionable recommendations with code examples where helpful.`;

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "codellama:7b-instruct-q4_0", // Use code-focused model
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    let analysis = '';
    if (result.message && result.message.content) {
      analysis = result.message.content;
    } else if (result.choices && result.choices[0] && result.choices[0].message) {
      analysis = result.choices[0].message.content;
    }

    if (!analysis || analysis.trim().length === 0) {
      throw new Error('Empty response from Ollama');
    }

    console.log(`✅ Analysis completed (${analysis.length} chars)`);
    return analysis;

  } catch (error) {
    console.error(`❌ Analysis failed for ${fileInfo.relativePath}:`, error.message);
    return `Analysis failed: ${error.message}`;
  }
}

// Main analysis function
async function runSourceCodeAnalysis() {
  // Check Ollama status
  checkOllamaStatus();

  // Get source files
  const sourceFiles = getSourceFiles();

  if (sourceFiles.length === 0) {
    console.log('❌ No source files found to analyze');
    return;
  }

  // Create analysis results directory
  const analysisDir = path.join(__dirname, 'code-analysis-results');
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }

  console.log('\n🚀 Starting comprehensive source code analysis...\n');

  const results = [];
  const startTime = Date.now();

  // Analyze files in batches to avoid overwhelming Ollama
  const batchSize = 3;
  for (let i = 0; i < sourceFiles.length; i += batchSize) {
    const batch = sourceFiles.slice(i, i + batchSize);
    console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sourceFiles.length/batchSize)} (${batch.length} files)`);

    const batchPromises = batch.map(async (fileInfo) => {
      try {
        const content = fs.readFileSync(fileInfo.path, 'utf8');

        // Skip files that are too large or empty
        if (content.length > 50000) {
          console.log(`⚠️  Skipping ${fileInfo.relativePath} (too large: ${content.length} chars)`);
          return {
            file: fileInfo,
            analysis: 'File too large for analysis (>50KB)',
            skipped: true
          };
        }

        if (content.trim().length === 0) {
          console.log(`⚠️  Skipping ${fileInfo.relativePath} (empty file)`);
          return {
            file: fileInfo,
            analysis: 'Empty file',
            skipped: true
          };
        }

        const analysis = await analyzeCodeWithOllama(fileInfo.path, content, fileInfo);

        // Save individual analysis
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const analysisPath = path.join(analysisDir, `${fileInfo.name}-analysis-${timestamp}.txt`);

        const analysisContent = `Source Code Analysis: ${fileInfo.relativePath}
${'='.repeat(60)}

File Info:
- Path: ${fileInfo.relativePath}
- Size: ${fileInfo.size} bytes
- Modified: ${fileInfo.modified.toISOString()}
- Extension: ${fileInfo.extension}

Analysis Results:
${'-'.repeat(20)}

${analysis}

${'-'.repeat(60)}
`;

        fs.writeFileSync(analysisPath, analysisContent);

        return {
          file: fileInfo,
          analysis,
          analysisPath,
          success: true
        };

      } catch (error) {
        console.error(`❌ Failed to analyze ${fileInfo.relativePath}:`, error.message);
        return {
          file: fileInfo,
          analysis: `Analysis failed: ${error.message}`,
          success: false,
          error: error.message
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Brief pause between batches to avoid overwhelming Ollama
    if (i + batchSize < sourceFiles.length) {
      console.log('⏳ Pausing between batches...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  // Generate comprehensive summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 SOURCE CODE ANALYSIS SUMMARY');
  console.log(`${'='.repeat(80)}\n`);

  const summaryPath = path.join(__dirname, `source-code-analysis-summary-${Date.now()}.txt`);

  let summaryContent = `Space Analyzer Source Code Analysis Summary
${'='.repeat(60)}

Analysis Date: ${new Date().toISOString()}
Duration: ${duration} seconds
Files Analyzed: ${results.length}
Successful Analyses: ${results.filter(r => r.success).length}
Failed Analyses: ${results.filter(r => !r.success && !r.skipped).length}
Skipped Files: ${results.filter(r => r.skipped).length}

${'-'.repeat(50)}

TOP ISSUES FOUND:
${'-'.repeat(20)}

`;

  // Analyze results for common issues
  const successfulResults = results.filter(r => r.success && r.analysis);
  const issuePatterns = {
    'TypeScript/React': [],
    'Performance': [],
    'Security': [],
    'Code Quality': [],
    'Accessibility': []
  };

  successfulResults.forEach(result => {
    const analysis = result.analysis.toLowerCase();

    if (analysis.includes('typescript') || analysis.includes('react') || analysis.includes('component')) {
      issuePatterns['TypeScript/React'].push(result.file.relativePath);
    }
    if (analysis.includes('performance') || analysis.includes('optimization') || analysis.includes('efficiency')) {
      issuePatterns['Performance'].push(result.file.relativePath);
    }
    if (analysis.includes('security') || analysis.includes('vulnerability') || analysis.includes('xss') || analysis.includes('injection')) {
      issuePatterns['Security'].push(result.file.relativePath);
    }
    if (analysis.includes('quality') || analysis.includes('best practices') || analysis.includes('naming') || analysis.includes('structure')) {
      issuePatterns['Code Quality'].push(result.file.relativePath);
    }
    if (analysis.includes('accessibility') || analysis.includes('a11y') || analysis.includes('screen reader') || analysis.includes('contrast')) {
      issuePatterns['Accessibility'].push(result.file.relativePath);
    }
  });

  Object.entries(issuePatterns).forEach(([category, files]) => {
    if (files.length > 0) {
      summaryContent += `${category} Issues (${files.length} files):\n`;
      files.slice(0, 5).forEach(file => {
        summaryContent += `  • ${file}\n`;
      });
      if (files.length > 5) {
        summaryContent += `  • ... and ${files.length - 5} more\n`;
      }
      summaryContent += '\n';
    }
  });

  summaryContent += `${'-'.repeat(50)}\n\n`;
  summaryContent += 'INDIVIDUAL FILE RESULTS:\n';
  summaryContent += `${'-'.repeat(25)}\n\n`;

  results.forEach(result => {
    const status = result.success ? '✅' : result.skipped ? '⚠️' : '❌';
    summaryContent += `${status} ${result.file.relativePath}\n`;

    if (result.analysis && result.analysis.length > 100) {
      summaryContent += `   Summary: ${result.analysis.substring(0, 100)}...\n`;
    } else if (result.analysis) {
      summaryContent += `   Summary: ${result.analysis}\n`;
    }

    summaryContent += '\n';
  });

  summaryContent += `${'='.repeat(60)}\n`;
  summaryContent += 'Analysis completed successfully!\n';
  summaryContent += 'Review individual analysis files for detailed feedback.\n';

  fs.writeFileSync(summaryPath, summaryContent);

  console.log(`✅ Analysis completed in ${duration} seconds!`);
  console.log(`📁 Analysis results saved in: ${analysisDir}`);
  console.log(`📊 Summary report: ${path.basename(summaryPath)}`);

  console.log('\n🎯 Quick Results:');
  console.log(`   ✅ Successful: ${results.filter(r => r.success).length}`);
  console.log(`   ❌ Failed: ${results.filter(r => !r.success && !r.skipped).length}`);
  console.log(`   ⚠️  Skipped: ${results.filter(r => r.skipped).length}`);

  // Show top issues
  console.log('\n🔍 Top Issue Categories:');
  Object.entries(issuePatterns).forEach(([category, files]) => {
    if (files.length > 0) {
      console.log(`   ${category}: ${files.length} files`);
    }
  });

  console.log('\n🚀 Next Steps:');
  console.log('   1. Review individual analysis files for detailed feedback');
  console.log('   2. Implement code improvements based on Ollama recommendations');
  console.log('   3. Re-run analysis to track improvements');
}

// Run the analysis
if (require.main === module) {
  runSourceCodeAnalysis().catch(console.error);
}

module.exports = { runSourceCodeAnalysis };