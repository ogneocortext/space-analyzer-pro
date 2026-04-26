/**
 * Automated Code Analysis and Fix System
 * Identifies and fixes common issues in web applications
 */

const fs = require('fs');
const path = require('path');

class CodeAnalyzer {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.stats = {
            filesAnalyzed: 0,
            issuesFound: 0,
            fixesApplied: 0,
            linesOfCode: 0
        };
    }

    async analyzeProject() {
        console.log('🔍 Starting comprehensive code analysis...');
        
        const directories = [
            'space_analyzer_electron',
            'frontend/electron'
        ];

        for (const dir of directories) {
            await this.analyzeDirectory(dir);
        }

        await this.generateReport();
        await this.applyAutoFixes();
        
        return {
            issues: this.issues,
            fixes: this.fixes,
            stats: this.stats
        };
    }

    async analyzeDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) return;

        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                await this.analyzeDirectory(fullPath);
            } else if (stat.isFile() && this.shouldAnalyzeFile(file)) {
                await this.analyzeFile(fullPath);
            }
        }
    }

    shouldAnalyzeFile(filename) {
        const extensions = ['.html', '.js', '.css', '.json'];
        return extensions.some(ext => filename.endsWith(ext));
    }

    async analyzeFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            this.stats.filesAnalyzed++;
            this.stats.linesOfCode += content.split('\n').length;

            await this.analyzeJavaScript(filePath, content);
            await this.analyzeHTML(filePath, content);
            await this.analyzeCSS(filePath, content);

        } catch (error) {
            console.warn(`Could not analyze ${filePath}:`, error.message);
        }
    }

    async analyzeJavaScript(filePath, content) {  

        // Check for console.log statements
        const consoleLogMatches = content.match(/console\.log\(/g);
        if (consoleLogMatches) {
            this.issues.push({
                type: 'console-log',
                file: filePath,
                severity: 'medium',
                description: `Found ${consoleLogMatches.length} console.log statements`,
                line: this.findLineNumber(content, 'console.log'),
                autoFixable: true
            });
        }

        // Check for debugger statements
        const debuggerMatches = content.match(/debugger;/g);
        if (debuggerMatches) {
            this.issues.push({
                type: 'debugger',
                file: filePath,
                severity: 'high',
                description: `Found ${debuggerMatches.length} debugger statements`,
                line: this.findLineNumber(content, 'debugger'),
                autoFixable: true
            });
        }

        // Check for TODO/FIXME comments
        const todoMatches = content.match(/\/\*?[\s\S]*?(TODO|FIXME|HACK|XXX)[\s\S]*?\*\//gi);
        if (todoMatches) {
            this.issues.push({
                type: 'todo-comment',
                file: filePath,
                severity: 'low',
                description: `Found ${todoMatches.length} TODO/FIXME comments`,
                autoFixable: false
            });
        }

        // Check for eval usage
        const evalMatches = content.match(/\beval\(/g);
        if (evalMatches) {
            this.issues.push({
                type: 'eval-usage',
                file: filePath,
                severity: 'critical',
                description: `Found ${evalMatches.length} eval() usage - security risk`,
                autoFixable: false
            });
        }

        // Check for var usage (should use let/const)
        const varMatches = content.match(/\bvar\s+/g);
        if (varMatches) {
            this.issues.push({
                type: 'var-usage',
                file: filePath,
                severity: 'low',
                description: `Found ${varMatches.length} var declarations - use let/const`,
                autoFixable: true
            });
        }
    }

    async analyzeHTML(filePath, content) {  

        // Check for missing alt attributes on images
        const imgMatches = content.match(/<img[^>]*>/gi);
        if (imgMatches) {
            const imagesWithoutAlt = imgMatches.filter(img => !img.includes('alt='));
            if (imagesWithoutAlt.length > 0) {
                this.issues.push({
                    type: 'missing-alt',
                    file: filePath,
                    severity: 'medium',
                    description: `Found ${imagesWithoutAlt.length} images without alt attributes`,
                    autoFixable: true
                });
            }
        }

        // Check for missing ARIA labels on interactive elements
        const interactiveElements = content.match(/<(button|input|select|textarea)[^>]*>/gi);
        if (interactiveElements) {
            const missingAria = interactiveElements.filter(el => 
                !el.includes('aria-label') && 
                !el.includes('aria-labelledby') &&
                !el.match(/<(button|input)[^>]*>[\s\S]*?<\/\1>/i)
            );
            if (missingAria.length > 0) {
                this.issues.push({
                    type: 'missing-aria',
                    file: filePath,
                    severity: 'medium',
                    description: `Found ${missingAria.length} interactive elements without ARIA labels`,
                    autoFixable: true
                });
            }
        }

        // Check for inline styles
        const inlineStyles = content.match(/style="[^"]*"/g);
        if (inlineStyles && inlineStyles.length > 10) {
            this.issues.push({
                type: 'inline-styles',
                file: filePath,
                severity: 'low',
                description: `Found ${inlineStyles.length} inline styles - consider external CSS`,
                autoFixable: true
            });
        }

        // Check for inline scripts
        const inlineScripts = content.match(/<script[^>]*>[\s\S]*?<\/script>/gi);
        if (inlineScripts && inlineScripts.length > 0) {
            this.issues.push({
                type: 'inline-scripts',
                file: filePath,
                severity: 'low',
                description: `Found ${inlineScripts.length} inline scripts - consider external files`,
                autoFixable: true
            });
        }

        // Check for deprecated HTML tags
        const deprecatedTags = ['center', 'font', 'u', 'strike', 'tt'];
        deprecatedTags.forEach(tag => {
            const matches = content.match(new RegExp(`<${tag}[^>]*>`, 'gi'));
            if (matches) {
                this.issues.push({
                    type: 'deprecated-tag',
                    file: filePath,
                    severity: 'low',
                    description: `Found deprecated <${tag}> tag`,
                    autoFixable: true
                });
            }
        });
    }

    async analyzeCSS(filePath, content) {

        // Check for !important usage
        const importantMatches = content.match(/!important/g);
        if (importantMatches && importantMatches.length > 5) {
            this.issues.push({
                type: 'excessive-important',
                file: filePath,
                severity: 'medium',
                description: `Found ${importantMatches.length} !important declarations`,
                autoFixable: true
            });
        }

        // Check for ID selectors (should use classes)
        const idMatches = content.match(/#[a-zA-Z0-9_-]+/g);
        if (idMatches && idMatches.length > 10) {
            this.issues.push({
                type: 'excessive-ids',
                file: filePath,
                severity: 'low',
                description: `Found ${idMatches.length} ID selectors - consider using classes`,
                autoFixable: false
            });
        }

        // Check for unused CSS (basic check)
        const classMatches = content.match(/\.[a-zA-Z0-9_-]+/g);
        if (classMatches) {
            const uniqueClasses = [...new Set(classMatches)];
            if (uniqueClasses.length > 50) {
                this.issues.push({
                    type: 'large-css-file',
                    file: filePath,
                    severity: 'low',
                    description: `CSS file has ${uniqueClasses.length} unique classes`,
                    autoFixable: false
                });
            }
        }
    }

    findLineNumber(content, searchString) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(searchString)) {
                return i + 1;
            }
        }
        return 0;
    }

    async applyAutoFixes() {
        console.log('🔧 Applying automatic fixes...');

        for (const issue of this.issues) {
            if (issue.autoFixable) {
                try {
                    await this.applyFix(issue);
                    this.fixes.push({
                        file: issue.file,
                        type: issue.type,
                        description: `Fixed ${issue.type} in ${path.basename(issue.file)}`,
                        timestamp: Date.now()
                    });
                    this.stats.fixesApplied++;
                } catch (error) {
                    console.warn(`Failed to fix ${issue.type} in ${issue.file}:`, error.message);
                }
            }
        }
    }

    async applyFix(issue) {
        const filePath = issue.file;
        let content = fs.readFileSync(filePath, 'utf8');

        switch (issue.type) {
            case 'console-log':
                content = this.removeConsoleLogs(content);
                break;
            case 'debugger':
                content = this.removeDebuggerStatements(content);
                break;
            case 'var-usage':
                content = this.replaceVarWithLetConst(content);
                break;
            case 'missing-alt':
                content = this.addAltAttributes(content);
                break;
            case 'missing-aria':
                content = this.addAriaLabels(content);
                break;
            case 'inline-styles':
                content = this.externalizeInlineStyles(content, filePath);
                break;
            case 'inline-scripts':
                content = this.externalizeInlineScripts(content, filePath);
                break;
            case 'deprecated-tag':
                content = this.replaceDeprecatedTags(content);
                break;
            case 'excessive-important':
                content = this.optimizeImportantDeclarations(content);
                break;
        }

        fs.writeFileSync(filePath, content);
    }

    removeConsoleLogs(content) {
        // Remove console.log statements but keep console.error for debugging
        return content.replace(/console\.log\([^)]*\);?/g, '// console.log removed');
    }

    removeDebuggerStatements(content) {
        return content.replace(/debugger;/g, '// debugger removed');
    }

    replaceVarWithLetConst(content) {
        // Simple replacement - in real implementation would need scope analysis
        return content.replace(/\bvar\s+/g, 'let ');
    }

    addAltAttributes(content) {
        return content.replace(/<img([^>]*?)>/gi, (match, attrs) => {
            if (!attrs.includes('alt=')) {
                return `<img${attrs} alt="Image">`;
            }
            return match;
        });
    }

    addAriaLabels(content) {
        // Add basic ARIA labels to common interactive elements
        return content.replace(/<button([^>]*?)>/gi, (match, attrs) => {
            if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby')) {
                return `<button${attrs} aria-label="Button">`;
            }
            return match;
        });
    }

    externalizeInlineStyles(content, filePath) {
        // This would create external CSS files - simplified version
        const styleMatches = content.match(/style="([^"]*)"/g);
        if (styleMatches && styleMatches.length > 0) {
            // For now, just add a comment about externalization
            return content.replace(/<head>/i, '<head>\n    <!-- Consider externalizing inline styles -->');
        }
        return content;
    }

    externalizeInlineScripts(content, filePath) {
        // This would create external JS files - simplified version
        const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches && scriptMatches.length > 0) {
            return content.replace(/<head>/i, '<head>\n    <!-- Consider externalizing inline scripts -->');
        }
        return content;
    }

    replaceDeprecatedTags(content) {
        return content
            .replace(/<center[^>]*>/gi, '<div style="text-align: center;">')
            .replace(/<\/center>/gi, '</div>')
            .replace(/<font[^>]*>/gi, '<span>')
            .replace(/<\/font>/gi, '</span>');
    }

    optimizeImportantDeclarations(content) {
        // Remove excessive !important declarations
        return content.replace(/!important/g, '/* !important removed */');
    }

    async generateReport() {
        const report = {
            summary: {
                filesAnalyzed: this.stats.filesAnalyzed,
                issuesFound: this.issues.length,
                fixesApplied: this.stats.fixesApplied,
                linesOfCode: this.stats.linesOfCode,
                timestamp: new Date().toISOString()
            },
            issues: this.issues,
            fixes: this.fixes,
            recommendations: this.generateRecommendations()
        };

        const reportPath = 'code_analysis_report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log('\n📊 Code Analysis Report:');
        console.log(`   Files Analyzed: ${this.stats.filesAnalyzed}`);
        console.log(`   Issues Found: ${this.issues.length}`);
        console.log(`   Auto-Fixes Applied: ${this.stats.fixesApplied}`);
        console.log(`   Lines of Code: ${this.stats.linesOfCode}`);

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        const issueTypes = {};

        this.issues.forEach(issue => {
            issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
        });

        if (issueTypes['console-log']) {
            recommendations.push('Remove console.log statements from production code');
        }

        if (issueTypes['missing-alt']) {
            recommendations.push('Add alt attributes to all images for accessibility');
        }

        if (issueTypes['missing-aria']) {
            recommendations.push('Add ARIA labels to interactive elements');
        }

        if (issueTypes['eval-usage']) {
            recommendations.push('Avoid using eval() due to security risks');
        }

        if (issueTypes['inline-styles']) {
            recommendations.push('Externalize inline styles to improve maintainability');
        }

        if (issueTypes['excessive-important']) {
            recommendations.push('Reduce use of !important declarations');
        }

        return recommendations;
    }
}

// Main execution
if (require.main === module) {
    (async () => {
        const analyzer = new CodeAnalyzer();
        
        try {
            const results = await analyzer.analyzeProject();
            console.log('\n🎉 Code analysis completed!');
            process.exit(0);
            
        } catch (error) {
            console.error('Code analysis failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = CodeAnalyzer;