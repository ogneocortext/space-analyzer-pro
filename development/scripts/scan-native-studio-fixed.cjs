#!/usr/bin/env node

/**
 * Scan Native Media AI Studio directory for improvements
 */

const http = require('http');

async function scanDirectory() {
    const directoryPath = 'D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio';
    
    console.log('🔍 Starting analysis of Native Media AI Studio...');
    console.log(`📂 Directory: ${directoryPath}`);
    
    try {
        const postData = JSON.stringify({
            directoryPath: directoryPath,
            options: {
                forceRustCLI: false,
                deepAnalysis: true,
                includeHidden: false
            }
        });
        
        console.log('📤 Sending analysis request...');
        
        const response = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: 8081,
                path: '/api/analyze',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            console.error('❌ Failed to parse response:', data);
                            reject(e);
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            req.on('error', (err) => {
                console.error('❌ Request error:', err.message);
                reject(err);
            });
            req.write(postData);
            req.end();
        });
        
        console.log('\n✅ Analysis completed!');
        console.log('\n📊 Results:');
        console.log(`   Total Files: ${response.data.totalFiles}`);
        console.log(`   Total Size: ${formatBytes(response.data.totalSize)}`);
        console.log(`   Analysis Time: ${response.data.analysisTime}ms`);
        
        console.log('\n📁 Categories:');
        Object.entries(response.data.categories).forEach(([category, stats]) => {
            console.log(`   ${category}: ${stats.count} files (${formatBytes(stats.size)})`);
        });
        
        console.log('\n💡 AI Insights:');
        if (response.data.ai_insights && response.data.ai_insights.optimization_suggestions) {
            response.data.ai_insights.optimization_suggestions.forEach(suggestion => {
                console.log(`   • ${suggestion}`);
            });
        }
        
        console.log('\n📝 Recommendations:');
        if (response.data.recommendations && response.data.recommendations.length > 0) {
            response.data.recommendations.forEach(rec => {
                console.log(`   • ${rec.title || rec.description}`);
            });
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
        throw error;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

scanDirectory().then(() => {
    console.log('\n🎉 Scan completed successfully!');
    process.exit(0);
}).catch(() => {
    process.exit(1);
});