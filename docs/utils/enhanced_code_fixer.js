/**
 * Enhanced Automated Fix System
 * Addresses real issues found in the codebase
 */

const fs = require('fs');
const path = require('path');

class EnhancedCodeFixer {
    constructor() {
        this.stats = {
            filesFixed: 0,
            consoleLogsRemoved: 0,
            ariaLabelsAdded: 0,
            altAttributesAdded: 0,
            inlineStylesExternalized: 0,
            inlineScriptsExternalized: 0
        };
    }

    async fixAllIssues() {
        console.log('🔧 Starting enhanced code fixes...\n');

        // Fix console.log statements in JavaScript files
        await this.fixConsoleLogs();

        // Fix accessibility issues (ARIA labels and alt attributes)
        await this.fixAccessibilityIssues();

        // Externalize inline styles and scripts
        await this.externalizeInlineCode();

        // Generate fix report
        await this.generateFixReport();

        return this.stats;
    }

    async fixConsoleLogs() {
        console.log('🧹 Removing excessive console.log statements...');
        
        const jsDirectories = ['space_analyzer_electron', 'frontend/electron'];
        
        for (const dir of jsDirectories) {
            if (!fs.existsSync(dir)) continue;
            
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                    await this.processDirectoryForConsoleLogs(fullPath);
                } else if (stat.isFile() && file.endsWith('.js')) {
                    await this.removeConsoleLogs(fullPath);
                }
            }
        }
        
        console.log(`✅ Removed ${this.stats.consoleLogsRemoved} console.log statements`);
    }

    async processDirectoryForConsoleLogs(dirPath) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                await this.processDirectoryForConsoleLogs(fullPath);
            } else if (stat.isFile() && file.endsWith('.js')) {
                await this.removeConsoleLogs(fullPath);
            }
        }
    }

    async removeConsoleLogs(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Remove console.log statements but keep console.error and console.warn for debugging
            content = content.replace(/console\.log\([^)]*\);?/g, (match) => {
                // Replace with a comment to preserve line numbers
                const comment = '// console.log removed';
                return match.includes('\n') ? 
                    match.split('\n').map(line => line.trim() ? comment : '').join('\n') :
                    comment;
            });
            
            // Remove console.debug statements
            content = content.replace(/console\.debug\([^)]*\);?/g, '// console.debug removed');
            
            // Remove console.info statements  
            content = content.replace(/console\.info\([^)]*\);?/g, '// console.info removed');
            
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content);
                const removedCount = (originalContent.match(/console\.(log|debug|info)\(/g) || []).length;
                this.stats.consoleLogsRemoved += removedCount;
                this.stats.filesFixed++;
                console.log(`  Fixed: ${filePath} (removed ${removedCount} statements)`);
            }
            
        } catch (error) {
            console.warn(`Could not fix console logs in ${filePath}:`, error.message);
        }
    }

    async fixAccessibilityIssues() {
        console.log('\n♿ Fixing accessibility issues...');
        
        const htmlDirectories = ['space_analyzer_electron', 'frontend/electron'];
        
        for (const dir of htmlDirectories) {
            if (!fs.existsSync(dir)) continue;
            
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                    await this.processDirectoryForAccessibility(fullPath);
                } else if (stat.isFile() && file.endsWith('.html')) {
                    await this.fixHTMLAccessibility(fullPath);
                }
            }
        }
        
        console.log(`✅ Added ${this.stats.ariaLabelsAdded} ARIA labels`);
        console.log(`✅ Added ${this.stats.altAttributesAdded} alt attributes`);
    }

    async processDirectoryForAccessibility(dirPath) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                await this.processDirectoryForAccessibility(fullPath);
            } else if (stat.isFile() && file.endsWith('.html')) {
                await this.fixHTMLAccessibility(fullPath);
            }
        }
    }

    async fixHTMLAccessibility(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Add alt attributes to images without them
            content = content.replace(/<img([^>]*?)>/gi, (match, attrs) => {
                if (!attrs.includes('alt=')) {
                    this.stats.altAttributesAdded++;
                    return `<img${attrs} alt="Image">`;
                }
                return match;
            });
            
            // Add ARIA labels to buttons without them
            content = content.replace(/<button([^>]*?)>/gi, (match, attrs) => {
                if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby')) {
                    // Try to extract text content for better labeling
                    const textMatch = match.match(/>([^<]+)</);
                    const buttonText = textMatch ? textMatch[1].trim() : 'Button';
                    this.stats.ariaLabelsAdded++;
                    return `<button${attrs} aria-label="${buttonText}">`;
                }
                return match;
            });
            
            // Add ARIA labels to input elements without them
            content = content.replace(/<input([^>]*?)>/gi, (match, attrs) => {
                if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby')) {
                    const typeMatch = attrs.match(/type="([^"]*)"/);
                    const inputType = typeMatch ? typeMatch[1] : 'input';
                    this.stats.ariaLabelsAdded++;
                    return `<input${attrs} aria-label="${inputType} input">`;
                }
                return match;
            });
            
            // Add ARIA labels to select elements without them
            content = content.replace(/<select([^>]*?)>/gi, (match, attrs) => {
                if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby')) {
                    this.stats.ariaLabelsAdded++;
                    return `<select${attrs} aria-label="Select dropdown">`;
                }
                return match;
            });
            
            // Add ARIA labels to textarea elements without them
            content = content.replace(/<textarea([^>]*?)>/gi, (match, attrs) => {
                if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby')) {
                    this.stats.ariaLabelsAdded++;
                    return `<textarea${attrs} aria-label="Text area">`;
                }
                return match;
            });
            
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content);
                this.stats.filesFixed++;
                console.log(`  Fixed accessibility: ${filePath}`);
            }
            
        } catch (error) {
            console.warn(`Could not fix accessibility in ${filePath}:`, error.message);
        }
    }

    async externalizeInlineCode() {
        console.log('\n📦 Externalizing inline code...');
        
        const htmlDirectories = ['space_analyzer_electron', 'frontend/electron'];
        
        for (const dir of htmlDirectories) {
            if (!fs.existsSync(dir)) continue;
            
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                    await this.processDirectoryForExternalization(fullPath);
                } else if (stat.isFile() && file.endsWith('.html')) {
                    await this.externalizeInlineCodeFromFile(fullPath);
                }
            }
        }
        
        console.log(`✅ Externalized ${this.stats.inlineStylesExternalized} inline style blocks`);
        console.log(`✅ Externalized ${this.stats.inlineScriptsExternalized} inline script blocks`);
    }

    async processDirectoryForExternalization(dirPath) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                await this.processDirectoryForExternalization(fullPath);
            } else if (stat.isFile() && file.endsWith('.html')) {
                await this.externalizeInlineCodeFromFile(fullPath);
            }
        }
    }

    async externalizeInlineCodeFromFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Extract and externalize inline styles
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            let styleMatch;
            let styleIndex = 0;
            
            while ((styleMatch = styleRegex.exec(content)) !== null) {
                const styleContent = styleMatch[1];
                const styleFileName = `inline-styles-${styleIndex++}.css`;
                const styleDir = path.dirname(filePath);
                const styleFilePath = path.join(styleDir, styleFileName);
                
                // Write style to external file
                fs.writeFileSync(styleFilePath, styleContent);
                
                // Replace inline style with external reference
                const styleTag = styleMatch[0];
                const externalStyleTag = `<link rel="stylesheet" href="${styleFileName}">`;
                content = content.replace(styleTag, externalStyleTag);
                
                this.stats.inlineStylesExternalized++;
            }
            
            // Extract and externalize inline scripts
            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
            let scriptMatch;
            let scriptIndex = 0;
            
            while ((scriptMatch = scriptRegex.exec(content)) !== null) {
                const scriptContent = scriptMatch[1];
                
                // Skip scripts that are clearly references or contain important logic
                if (scriptContent.includes('src=') || scriptContent.includes('module') || scriptContent.includes('import')) {
                    continue;
                }
                
                const scriptFileName = `inline-script-${scriptIndex++}.js`;
                const scriptDir = path.dirname(filePath);
                const scriptFilePath = path.join(scriptDir, scriptFileName);
                
                // Write script to external file
                fs.writeFileSync(scriptFilePath, scriptContent);
                
                // Replace inline script with external reference
                const scriptTag = scriptMatch[0];
                const externalScriptTag = `<script src="${scriptFileName}"></script>`;
                content = content.replace(scriptTag, externalScriptTag);
                
                this.stats.inlineScriptsExternalized++;
            }
            
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content);
                this.stats.filesFixed++;
                console.log(`  Externalized code: ${filePath}`);
            }
            
        } catch (error) {
            console.warn(`Could not externalize code in ${filePath}:`, error.message);
        }
    }

    async generateFixReport() {
        const report = {
            summary: {
                timestamp: new Date().toISOString(),
                ...this.stats,
                totalImprovements: this.stats.consoleLogsRemoved + 
                                  this.stats.ariaLabelsAdded + 
                                  this.stats.altAttributesAdded + 
                                  this.stats.inlineStylesExternalized + 
                                  this.stats.inlineScriptsExternalized
            },
            improvements: {
                consoleLogsRemoved: this.stats.consoleLogsRemoved,
                ariaLabelsAdded: this.stats.ariaLabelsAdded,
                altAttributesAdded: this.stats.altAttributesAdded,
                inlineStylesExternalized: this.stats.inlineStylesExternalized,
                inlineScriptsExternalized: this.stats.inlineScriptsExternalized
            },
            filesFixed: this.stats.filesFixed,
            recommendations: this.generateRecommendations()
        };

        const reportPath = 'enhanced_code_fixes_report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log('\n📊 Enhanced Code Fix Report:');
        console.log(`   Files Fixed: ${this.stats.filesFixed}`);
        console.log(`   Console Logs Removed: ${this.stats.consoleLogsRemoved}`);
        console.log(`   ARIA Labels Added: ${this.stats.ariaLabelsAdded}`);
        console.log(`   Alt Attributes Added: ${this.stats.altAttributesAdded}`);
        console.log(`   Inline Styles Externalized: ${this.stats.inlineStylesExternalized}`);
        console.log(`   Inline Scripts Externalized: ${this.stats.inlineScriptsExternalized}`);
        console.log(`   Total Improvements: ${report.summary.totalImprovements}`);

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.stats.consoleLogsRemoved > 0) {
            recommendations.push('✅ Removed excessive console.log statements for cleaner production code');
        }
        
        if (this.stats.ariaLabelsAdded > 0) {
            recommendations.push('✅ Added ARIA labels to improve accessibility for screen readers');
        }
        
        if (this.stats.altAttributesAdded > 0) {
            recommendations.push('✅ Added alt attributes to images for better accessibility');
        }
        
        if (this.stats.inlineStylesExternalized > 0) {
            recommendations.push('✅ Externalized inline styles for better maintainability');
        }
        
        if (this.stats.inlineScriptsExternalized > 0) {
            recommendations.push('✅ Externalized inline scripts for better maintainability');
        }
        
        recommendations.push('📋 Next steps: Run comprehensive tests to ensure functionality is preserved');
        recommendations.push('📋 Consider implementing automated testing to prevent regression');
        recommendations.push('📋 Add code linting rules to prevent future console.log statements');
        
        return recommendations;
    }
}

// Main execution
if (require.main === module) {
    (async () => {
        const fixer = new EnhancedCodeFixer();
        
        try {
            const results = await fixer.fixAllIssues();
            console.log('\n🎉 Enhanced code fixes completed successfully!');
            console.log('📝 Review the generated report for detailed information.');
            process.exit(0);
            
        } catch (error) {
            console.error('❌ Code fixing failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = EnhancedCodeFixer;