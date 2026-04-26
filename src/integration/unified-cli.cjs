#!/usr/bin/env node

/**
 * Unified CLI - Single entry point for all Space Analyzer tools
 * Integrates C++, Rust, and Node.js components
 */

const CLIBridge = require('./cli-bridge.cjs');
const SmartOrchestrator = require('./smart-orchestrator.cjs');
const path = require('path');
const { Command } = require('commander');

const program = new Command();

class UnifiedCLI {
    constructor() {
        this.bridge = new CLIBridge();
        this.orchestrator = new SmartOrchestrator();
        this.setupCommands();
    }

    setupCommands() {
        program
            .name('space-analyzer')
            .description('Unified Space Analyzer CLI - Integrates C++, Rust, and Node.js tools')
            .version('3.0.0');

        // Smart Analyze command (NEW - optimized tool coordination)
        program
            .command('smart-analyze')
            .description('Smart analysis with optimized tool coordination and redundancy reduction')
            .argument('<directory>', 'Directory to analyze')
            .option('--ai', 'Use AI-enhanced analysis')
            .option('--media', 'Focus on media file analysis')
            .option('--fast', 'Prioritize speed over features')
            .option('-j, --json', 'Output in JSON format')
            .option('-o, --output <file>', 'Output file path')
            .action(async (directory, options) => {
                try {
                    await this.handleSmartAnalyze(directory, options);
                } catch (error) {
                    console.error('Smart analysis failed:', error.message);
                    process.exit(1);
                }
            });

        // Analyze command (LEGACY - kept for compatibility)
        program
            .command('analyze')
            .description('Analyze directory structure')
            .argument('<directory>', 'Directory to analyze')
            .option('-t, --tool <tool>', 'Preferred tool (cpp, rust, node)', 'auto')
            .option('-p, --parallel', 'Enable parallel processing')
            .option('-j, --json', 'Output in JSON format')
            .option('-o, --output <file>', 'Output file path')
            .option('--compare', 'Run comparative analysis with all available tools')
            .action(async (directory, options) => {
                try {
                    await this.handleAnalyze(directory, options);
                } catch (error) {
                    console.error('Analysis failed:', error.message);
                    process.exit(1);
                }
            });

        // Status command
        program
            .command('status')
            .description('Show status of all CLI tools')
            .action(async () => {
                try {
                    await this.handleStatus();
                } catch (error) {
                    console.error('Status check failed:', error.message);
                    process.exit(1);
                }
            });

        // Screenshot command (Rust tool)
        program
            .command('screenshot')
            .description('Take screenshot of web application')
            .argument('[url]', 'URL to screenshot', 'http://localhost:3000')
            .option('-o, --output <file>', 'Output file path', 'screenshot.png')
            .action(async (url, options) => {
                try {
                    await this.handleScreenshot(url, options);
                } catch (error) {
                    console.error('Screenshot failed:', error.message);
                    process.exit(1);
                }
            });

        // AI Analysis command (Node.js tool)
        program
            .command('ai-analyze')
            .description('Run AI-powered analysis')
            .argument('<directory>', 'Directory to analyze')
            .option('--advanced', 'Use advanced AI features')
            .option('--predictive', 'Enable predictive analytics')
            .option('--visualization', 'Generate visualizations')
            .action(async (directory, options) => {
                try {
                    await this.handleAIAnalyze(directory, options);
                } catch (error) {
                    console.error('AI analysis failed:', error.message);
                    process.exit(1);
                }
            });
    }

    async handleSmartAnalyze(directory, options) {
        console.log('🎯 Starting smart analysis...');
        console.log('📁 Directory:', directory);
        
        try {
            const result = await this.orchestrator.analyzeDirectory(directory, options);
            
            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                this.displaySmartResults(result);
            }
            
            if (options.output) {
                require('fs').writeFileSync(options.output, JSON.stringify(result, null, 2));
                console.log(`\n📄 Results saved to: ${options.output}`);
            }
        } catch (error) {
            console.error('❌ Smart analysis failed:', error.message);
            throw error;
        }
    }

    displaySmartResults(result) {
        console.log('\n🎯 Smart Analysis Results:');
        console.log('─'.repeat(50));
        console.log(`📁 Directory: ${result.directory}`);
        console.log(`🔧 Strategy: ${result.description}`);
        console.log(`🛠️ Tools Used: ${result.tools.join(', ')}`);
        console.log(`📊 Files: ${result.summary.totalFiles.toLocaleString()}`);
        console.log(`💾 Size: ${(result.summary.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        console.log(`⏱️ Time: ${result.summary.analysisTime}ms`);
        
        // Show tool-specific results
        Object.entries(result.results).forEach(([tool, toolResult]) => {
            console.log(`\n🔧 ${tool.toUpperCase()} Results:`);
            
            if (toolResult.mediaFiles) {
                console.log(`  🎬 Media Files: ${toolResult.mediaFiles.toLocaleString()}`);
            }
            if (toolResult.aiFiles) {
                console.log(`  🤖 AI Files: ${toolResult.aiFiles.toLocaleString()}`);
            }
            if (toolResult.aiInsights) {
                console.log('  🧠 AI Insights:');
                toolResult.aiInsights.forEach(insight => {
                    console.log(`    • ${insight}`);
                });
            }
        });
        
        // Show orchestrator insights
        if (result.insights.length > 0) {
            console.log('\n💡 Orchestration Insights:');
            result.insights.forEach(insight => {
                console.log(`  • ${insight}`);
            });
        }
        
        console.log('\n✅ Smart analysis complete!');
    }

    async handleAnalyze(directory, options) {
        console.log('🚀 Starting Space Analyzer...');
        console.log(`📁 Directory: ${directory}`);
        
        // Initialize bridge
        await this.bridge.initializeTools();
        
        const analyzeOptions = {
            parallel: options.parallel,
            outputFormat: options.json ? 'json' : 'text',
            outputFile: options.output,
            forceTool: options.tool !== 'auto' ? options.tool : null
        };

        let result;
        
        if (options.compare) {
            console.log('🔄 Running comparative analysis...');
            result = await this.bridge.runComparativeAnalysis(directory, analyzeOptions);
            this.displayComparativeResults(result);
        } else {
            console.log(`🔍 Analyzing with ${options.tool} tool...`);
            result = await this.bridge.analyzeDirectory(directory, analyzeOptions);
            this.displayAnalysisResults(result);
        }

        if (options.output && options.json) {
            await this.saveResults(result, options.output);
            console.log(`💾 Results saved to: ${options.output}`);
        }
    }

    async handleStatus() {
        console.log('🔧 Checking CLI tools status...');
        
        await this.bridge.initializeTools();
        const status = this.bridge.getToolStatus();
        
        console.log('\n📊 Tool Status:');
        console.log('─'.repeat(30));
        
        Object.entries(status).forEach(([tool, available]) => {
            if (tool !== 'summary') {
                const icon = available ? '✅' : '❌';
                const name = tool.toUpperCase().padEnd(6);
                console.log(`${icon} ${name}: ${available ? 'Available' : 'Not Available'}`);
            }
        });
        
        console.log(`\n${status.summary}`);
    }

    async handleScreenshot(url, options) {
        console.log('📸 Taking screenshot...');
        
        const screenshotOptions = {
            url,
            outputPath: options.output
        };

        try {
            await this.bridge.initializeTools();
            const result = await this.bridge.analyzeWithRust('.', screenshotOptions);
            
            console.log(`✅ Screenshot saved to: ${result.screenshotPath}`);
            console.log(`🌐 URL: ${result.url}`);
        } catch (error) {
            console.error('❌ Screenshot failed:', error.message);
            throw error;
        }
    }

    async handleAIAnalyze(directory, options) {
        console.log('🧠 Starting AI analysis...');
        
        const aiOptions = {
            needAI: true,
            needVisualization: options.visualization,
            advanced: options.advanced,
            predictive: options.predictive
        };

        try {
            await this.bridge.initializeTools();
            const result = await this.bridge.analyzeWithNode(directory, aiOptions);
            
            this.displayAIResults(result);
        } catch (error) {
            console.error('❌ AI analysis failed:', error.message);
            throw error;
        }
    }

    displayAnalysisResults(result) {
        console.log('\n📊 Analysis Results:');
        console.log('─'.repeat(40));
        console.log(`🔧 Tool: ${result.tool.toUpperCase()}`);
        console.log(`📁 Total Files: ${result.totalFiles?.toLocaleString() || 'N/A'}`);
        console.log(`💾 Total Size: ${this.formatSize(result.totalSize || 0)}`);
        console.log(`📂 Directories: ${result.totalDirectories?.toLocaleString() || 'N/A'}`);
        
        if (result.analysisTime) {
            console.log(`⏱️  Analysis Time: ${result.analysisTime}ms`);
        }
        
        if (result.fileTypes && Object.keys(result.fileTypes).length > 0) {
            console.log('\n📋 File Types:');
            Object.entries(result.fileTypes).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
            });
        }
        
        if (result.largestFiles && result.largestFiles.length > 0) {
            console.log('\n🔍 Largest Files:');
            result.largestFiles.slice(0, 5).forEach((file, index) => {
                const size = this.formatSize(file.size || 0);
                const name = path.basename(file.path || file.name || 'unknown');
                console.log(`  ${index + 1}. ${name} (${size})`);
            });
        }
    }

    displayComparativeResults(result) {
        console.log('\n🔄 Comparative Analysis Results:');
        console.log('─'.repeat(50));
        
        Object.entries(result.results).forEach(([tool, data]) => {
            console.log(`\n🔧 ${tool.toUpperCase()} Results:`);
            
            if (data.error) {
                console.log(`  ❌ Error: ${data.error}`);
            } else {
                console.log(`  📁 Files: ${data.totalFiles?.toLocaleString() || 'N/A'}`);
                console.log(`  💾 Size: ${this.formatSize(data.totalSize || 0)}`);
                console.log(`  ⏱️  Time: ${data.executionTime}ms`);
            }
        });
        
        if (result.comparison && result.comparison.recommendations) {
            console.log('\n💡 Recommendations:');
            result.comparison.recommendations.forEach(rec => {
                console.log(`  • ${rec.message}`);
            });
        }
    }

    displayAIResults(result) {
        console.log('\n🧠 AI Analysis Results:');
        console.log('─'.repeat(40));
        
        if (result.summary) {
            console.log(`📊 Summary: ${result.summary}`);
        }
        
        if (result.insights && result.insights.length > 0) {
            console.log('\n💡 AI Insights:');
            result.insights.forEach(insight => {
                console.log(`  • ${insight}`);
            });
        }
        
        if (result.recommendations && result.recommendations.length > 0) {
            console.log('\n🎯 Recommendations:');
            result.recommendations.forEach(rec => {
                console.log(`  • ${rec}`);
            });
        }
        
        if (result.visualizations) {
            console.log('\n📈 Visualizations generated');
        }
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    async saveResults(result, filename) {
        const fs = require('fs').promises;
        await fs.writeFile(filename, JSON.stringify(result, null, 2));
    }

    async run() {
        await program.parseAsync(process.argv);
    }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
    const cli = new UnifiedCLI();
    cli.run().catch(error => {
        console.error('CLI error:', error);
        process.exit(1);
    });
}

module.exports = UnifiedCLI;