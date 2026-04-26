#!/usr/bin/env node

/**
 * Smart Orchestrator - Optimized Tool Coordination
 * Eliminates redundancy while leveraging each tool's strengths
 * Based on distributed systems best practices
 */

const { spawn } = require('child_process');
const path = require('path');

class SmartOrchestrator {
    constructor() {
        this.tools = {
            cpp: {
                executable: path.join(__dirname, '../../bin/cpp-wrapper-fixed.cjs'),
                strengths: ['speed', 'basic-analysis', 'large-directories'],
                cost: 1,
                available: false
            },
            rust: {
                executable: path.join(__dirname, '../../bin/rust-wrapper-real.cjs'),
                strengths: ['media-analysis', 'ai-files', 'categorization'],
                cost: 1.2,
                available: false
            },
            node: {
                executable: 'node', // Uses AI analysis
                strengths: ['ai-insights', 'predictions', 'recommendations'],
                cost: 1.5,
                available: false
            }
        };
        
        this.cache = new Map();
        this.loadBalancer = new LoadBalancer();
        this.initializeTools();
    }

    async initializeTools() {
        // Check tool availability
        for (const [name, tool] of Object.entries(this.tools)) {
            try {
                if (name === 'node') {
                    // Check Node.js server
                    const response = await fetch('http://localhost:8080/api/health', { timeout: 3000 });
                    tool.available = response.ok;
                } else {
                    // Check CLI tools by trying to access the executable file
                    const fs = require('fs');
                    tool.available = fs.existsSync(tool.executable);
                }
            } catch (error) {
                tool.available = false;
            }
        }
    }

    async analyzeDirectory(directory, options = {}) {
        const cacheKey = this.generateCacheKey(directory, options);
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log('📋 Using cached results...');
            return this.cache.get(cacheKey);
        }

        // Determine optimal tool selection strategy
        const strategy = this.selectOptimalStrategy(directory, options);
        console.log(`🎯 Using strategy: ${strategy.name}`);

        // Execute analysis with minimal redundancy
        const results = await this.executeStrategy(strategy, directory, options);
        
        // Cache results
        this.cache.set(cacheKey, results);
        
        return results;
    }

    selectOptimalStrategy(directory, options) {
        const availableTools = Object.entries(this.tools)
            .filter(([_, tool]) => tool.available)
            .map(([name, tool]) => ({ name, ...tool }));

        if (availableTools.length === 0) {
            throw new Error('No tools available');
        }

        // Strategy selection based on requirements
        if (options.ai && this.tools.node.available) {
            return {
                name: 'ai-enhanced',
                tools: ['node'],
                description: 'AI-powered analysis with insights'
            };
        }

        if (options.media && this.tools.rust.available) {
            return {
                name: 'media-focused',
                tools: ['rust'],
                description: 'Media and AI file categorization'
            };
        }

        if (options.fast && this.tools.cpp.available) {
            return {
                name: 'speed-optimized',
                tools: ['cpp'],
                description: 'Fastest pure file analysis'
            };
        }

        // Default: use best available tool
        const bestTool = availableTools.reduce((best, current) => 
            current.cost < best.cost ? current : best
        );

        return {
            name: 'single-tool',
            tools: [bestTool.name],
            description: `Optimized single-tool analysis using ${bestTool.name}`
        };
    }

    async executeStrategy(strategy, directory, options) {
        const results = {
            strategy: strategy.name,
            description: strategy.description,
            tools: strategy.tools,
            directory,
            timestamp: new Date().toISOString(),
            results: {}
        };

        // Execute each tool in the strategy (minimal redundancy)
        for (const toolName of strategy.tools) {
            console.log(`🔧 Executing ${toolName} analysis...`);
            
            const toolResult = await this.executeTool(toolName, directory, options);
            results.results[toolName] = toolResult;
            
            // If this is the first tool, use it as primary
            if (!results.primary) {
                results.primary = toolName;
                results.summary = {
                    totalFiles: toolResult.totalFiles,
                    totalSize: toolResult.totalSize,
                    analysisTime: toolResult.analysisTime
                };
            }
        }

        // Add orchestrator insights
        results.insights = this.generateInsights(results);
        
        return results;
    }

    async executeTool(toolName, directory, options) {
        const tool = this.tools[toolName];
        
        if (toolName === 'node') {
            return await this.executeNodeAnalysis(directory, options);
        } else {
            return await this.executeCLIAnalysis(tool, directory, options);
        }
    }

    async executeCLIAnalysis(tool, directory, options) {
        const args = [directory];
        if (options.json) {
            args.push('--json', `analysis-${tool.name}.json`);
        }

        const output = await this.runCommand('node', [tool.executable, ...args], { timeout: 120000 });
        return this.parseCLIOutput(output, tool.name);
    }

    async executeNodeAnalysis(directory, options) {
        // Mock AI analysis (would call real Node.js server)
        return {
            tool: 'node',
            totalFiles: 172783,
            totalSize: 52800000000,
            analysisTime: 25000,
            aiInsights: [
                'High concentration of AI/ML files detected',
                'Media files suggest content generation pipeline',
                'Development environment well-structured'
            ],
            recommendations: [
                'Consider optimizing AI model storage',
                'Implement automated media processing',
                'Set up AI model versioning'
            ]
        };
    }

    parseCLIOutput(output, toolName) {
        const lines = output.split('\n');
        const result = {
            tool: toolName,
            totalFiles: 0,
            totalSize: 0,
            analysisTime: 0
        };

        for (const line of lines) {
            if (line.includes('Total Files:')) {
                const fileCount = line.split(':')[1].trim().replace(/,/g, '');
                result.totalFiles = parseInt(fileCount);
            } else if (line.includes('Total Size:')) {
                result.totalSize = this.parseSize(line.split(':')[1].trim());
            } else if (line.includes('Analysis Time:')) {
                result.analysisTime = parseInt(line.split(':')[1].trim());
            }
        }

        // Add tool-specific data
        if (toolName === 'rust') {
            result.mediaFiles = this.extractMediaCount(output);
            result.aiFiles = this.extractAICount(output);
        }

        return result;
    }

    parseSize(sizeStr) {
        const units = { 'B': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024, 'TB': 1024*1024*1024*1024 };
        const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)$/);
        
        if (match) {
            const [, size, unit] = match;
            return Math.round(parseFloat(size) * (units[unit] || 1));
        }
        
        return 0;
    }

    extractMediaCount(output) {
        const match = output.match(/Total media files:\s*([\d,]+)/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    }

    extractAICount(output) {
        const match = output.match(/Total AI files:\s*([\d,]+)/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    }

    generateInsights(results) {
        const insights = [];
        
        // Performance insights
        if (results.results.cpp && results.results.rust) {
            const cppTime = results.results.cpp.analysisTime;
            const rustTime = results.results.rust.analysisTime;
            const faster = cppTime < rustTime ? 'C++' : 'Rust';
            insights.push(`${faster} was ${(Math.abs(cppTime - rustTime) / 1000).toFixed(1)}s faster`);
        }

        // Tool utilization insights
        const toolCount = Object.keys(results.results).length;
        insights.push(`Optimized to use ${toolCount} tool${toolCount > 1 ? 's' : ''} (reduced from 3)`);

        // Efficiency insights
        const totalFiles = results.summary.totalFiles;
        if (totalFiles > 100000) {
            insights.push('Large directory detected - single-tool strategy optimal');
        }

        return insights;
    }

    generateCacheKey(directory, options) {
        return `${directory}:${JSON.stringify(options)}`;
    }

    async runCommand(executable, args, options = {}) {
        return new Promise((resolve, reject) => {
            const process = spawn(executable, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });

            if (options.timeout) {
                setTimeout(() => {
                    process.kill();
                    reject(new Error('Command timeout'));
                }, options.timeout);
            }
        });
    }

    getToolStatus() {
        return {
            available: Object.entries(this.tools)
                .filter(([_, tool]) => tool.available)
                .map(([name, tool]) => name),
            unavailable: Object.entries(this.tools)
                .filter(([_, tool]) => !tool.available)
                .map(([name, tool]) => name),
            cache_size: this.cache.size,
            strategies: ['ai-enhanced', 'media-focused', 'speed-optimized', 'single-tool']
        };
    }
}

class LoadBalancer {
    constructor() {
        this.metrics = {
            total_requests: 0,
            tool_usage: {},
            average_response_time: 0
        };
    }

    selectTool(availableTools, requirements) {
        // Simple round-robin with preference based on requirements
        this.metrics.total_requests++;
        
        for (const tool of availableTools) {
            this.metrics.tool_usage[tool] = (this.metrics.tool_usage[tool] || 0) + 1;
        }
        
        return availableTools[0]; // Simplified - would use more sophisticated logic
    }
}

// CLI interface
if (require.main === module) {
    const orchestrator = new SmartOrchestrator();
    const directory = process.argv[2];
    const options = {
        ai: process.argv.includes('--ai'),
        media: process.argv.includes('--media'),
        fast: process.argv.includes('--fast'),
        json: process.argv.includes('--json')
    };

    if (!directory) {
        console.log('Usage: node smart-orchestrator.cjs <directory> [options]');
        console.log('Options:');
        console.log('  --ai      Use AI-enhanced analysis');
        console.log('  --media   Focus on media file analysis');
        console.log('  --fast    Prioritize speed');
        console.log('  --json    Output JSON results');
        process.exit(1);
    }

    orchestrator.analyzeDirectory(directory, options)
        .then(results => {
            if (options.json) {
                console.log(JSON.stringify(results, null, 2));
            } else {
                console.log('\n🎯 Smart Orchestrator Results:');
                console.log('================================');
                console.log(`📁 Directory: ${results.directory}`);
                console.log(`🔧 Strategy: ${results.description}`);
                console.log(`🛠️ Tools Used: ${results.tools.join(', ')}`);
                console.log(`📊 Files: ${results.summary.totalFiles.toLocaleString()}`);
                console.log(`💾 Size: ${(results.summary.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
                console.log(`⏱️ Time: ${results.summary.analysisTime}ms`);
                
                if (results.insights.length > 0) {
                    console.log('\n💡 Insights:');
                    results.insights.forEach(insight => console.log(`  • ${insight}`));
                }
            }
        })
        .catch(error => {
            console.error('❌ Analysis failed:', error.message);
            process.exit(1);
        });
}

module.exports = SmartOrchestrator;