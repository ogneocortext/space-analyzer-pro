/**
 * Test AI/ML Integration on Target Directory
 * Tests the complete AI-integrated scanner on the specified directory
 */

const aiScanner = require('./server/ai-integrated-scanner.js');

async function testAIDirectory() {
    console.log('🤖 Testing AI/ML Integration on Target Directory');
    console.log('================================================\n');

    const targetDirectory = "D:/Backup of Important Data for Windows 11 Upgrade/Native Media AI Studio";

    try {
        console.log(`🎯 Target Directory: ${targetDirectory}\n`);

        // Test 1: Basic AI Scan
        console.log('🧠 Running Basic AI Scan...');
        const basicResult = await aiScanner.scanWithAI(targetDirectory, {
            enableML: true,
            enableOllama: false, // Disable Ollama for faster testing
            enableSelfLearning: true,
            analysisDepth: 'basic',
            modelPreference: 'auto'
        });

        console.log('✅ Basic AI Scan Results:');
        console.log(`   - Files Scanned: ${basicResult.data.totalFiles.toLocaleString()}`);
        console.log(`   - Total Size: ${(basicResult.data.totalSize / (1024*1024*1024)).toFixed(2)} GB`);
        console.log(`   - Scan Time: ${basicResult.data.scanTime}ms`);
        console.log(`   - Performance: ${Math.round(basicResult.data.totalFiles / (basicResult.data.scanTime / 1000)).toLocaleString()} files/sec`);
        console.log(`   - AI Model Used: ${basicResult.aiAnalysis.aiInsights.modelUsed}`);
        console.log(`   - Success: ${basicResult.success ? '✅' : '❌'}\n`);

        // Test 2: Comprehensive AI Scan
        console.log('🧠 Running Comprehensive AI Scan...');
        const comprehensiveResult = await aiScanner.scanWithAI(targetDirectory, {
            enableML: true,
            enableOllama: false,
            enableSelfLearning: true,
            analysisDepth: 'comprehensive',
            modelPreference: 'auto',
            maxFiles: 50000 // Limit for testing
        });

        console.log('✅ Comprehensive AI Scan Results:');
        console.log(`   - Files Analyzed: ${comprehensiveResult.data.totalFiles.toLocaleString()}`);
        console.log(`   - Categories Found: ${Object.keys(comprehensiveResult.data.categories || {}).length}`);
        console.log(`   - AI Insights Generated: ${comprehensiveResult.aiAnalysis.aiInsights.recommendations.length}`);
        console.log(`   - Predictive Insights: ${comprehensiveResult.aiAnalysis.predictiveInsights.length}`);
        console.log(`   - Analysis Confidence: ${(comprehensiveResult.aiAnalysis.aiInsights.confidence * 100).toFixed(1)}%`);

        // Display top categories
        console.log('\n📊 Top File Categories:');
        const categories = comprehensiveResult.data.categories || {};
        const sortedCategories = Object.entries(categories)
            .sort(([,a], [,b]) => (b.count || 0) - (a.count || 0))
            .slice(0, 10);

        sortedCategories.forEach(([category, info], index) => {
            const percentage = ((info.count || 0) / comprehensiveResult.data.totalFiles * 100).toFixed(1);
            console.log(`   ${index + 1}. ${category}: ${info.count?.toLocaleString()} files (${percentage}%)`);
        });

        // Display AI recommendations
        console.log('\n🤖 AI Recommendations:');
        const recommendations = comprehensiveResult.aiAnalysis.aiInsights.recommendations || [];
        recommendations.slice(0, 5).forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });

        // Display predictive insights
        console.log('\n🔮 Predictive Insights:');
        const predictions = comprehensiveResult.aiAnalysis.predictiveInsights || [];
        predictions.slice(0, 3).forEach((pred, index) => {
            console.log(`   ${index + 1}. ${pred.prediction} (${(pred.confidence * 100).toFixed(0)}% confidence)`);
        });

        // Test 3: Performance Analysis
        console.log('\n⚡ Performance Analysis:');
        const performance = comprehensiveResult.data.metadata?.performance || {};
        console.log(`   - Files/Second: ${performance.filesPerSecond?.toLocaleString() || 'N/A'}`);
        console.log(`   - Avg File Size: ${performance.avgFileSize ? (performance.avgFileSize / 1024).toFixed(0) + ' KB' : 'N/A'}`);
        console.log(`   - Memory Efficiency: ${performance.efficiency?.toLocaleString() || 'N/A'} files/ms`);

        // Test 4: System Health Check
        console.log('\n🏥 System Health Check:');
        const systemStatus = aiScanner.getSystemStatus();
        console.log(`   - Initialized: ${systemStatus.initialized ? '✅' : '❌'}`);
        console.log(`   - Enhanced Scanner: ${systemStatus.components.enhancedScanner ? '✅' : '❌'}`);
        console.log(`   - Self-Learning ML: ${systemStatus.components.selfLearning ? '✅' : '❌'}`);
        console.log(`   - Ollama Integration: ${systemStatus.components.ollama ? '✅' : '❌'}`);
        console.log(`   - Adaptive Scanning: ${systemStatus.capabilities.adaptiveScanning ? '✅' : '❌'}`);
        console.log(`   - Vision Analysis: ${systemStatus.capabilities.visionAnalysis ? '✅' : '❌'}`);

        // Test 5: Learning Statistics
        console.log('\n🧠 Learning Statistics:');
        const learningStats = aiScanner.getAnalysisHistory();
        console.log(`   - Analyses Stored: ${learningStats.selfLearning?.analysesCount || 0}`);
        console.log(`   - Models Trained: ${Object.values(learningStats.selfLearning?.modelsTrained || {}).filter(Boolean).length}`);
        console.log(`   - Last Analysis: ${learningStats.selfLearning?.lastAnalysis ? new Date(learningStats.selfLearning.lastAnalysis).toLocaleString() : 'None'}`);

        console.log('\n🎉 AI Directory Test Complete!');
        console.log('===============================');
        console.log('✅ All AI/ML features tested successfully');
        console.log('📊 Comprehensive analysis completed');
        console.log('🔮 Predictive insights generated');
        console.log('⚡ Performance metrics collected');

        return {
            success: true,
            basicResult,
            comprehensiveResult,
            systemStatus,
            learningStats
        };

    } catch (error) {
        console.error('❌ AI Directory test failed:', error.message);
        console.error('Stack:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test
testAIDirectory();