const fetch = require('node-fetch');

async function testScan() {
    const directory = "D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio";
    const url = 'http://localhost:3001/api/smart-analyze';

    console.log(`🔍 Testing scan for: ${directory}`);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                directory: directory,
                options: { ai: true, media: true }
            })
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Scan successful!');
            console.log('📊 Result Summary:', JSON.stringify(data.result.summary, null, 2));
            console.log('🛠️ Tools Used:', data.result.tools);
            console.log('🔧 Strategy:', data.result.strategy);
            console.log('💡 Insights:', data.result.insights);
            
            if (data.result.results.rust) {
                console.log('🦀 Rust Scanner Results:', {
                    mediaFiles: data.result.results.rust.mediaFiles,
                    aiFiles: data.result.results.rust.aiFiles
                });
            }
        } else {
            console.error('❌ Scan failed:', data.error);
        }
    } catch (error) {
        console.error('❌ Error calling API:', error.message);
    }
}

testScan();
