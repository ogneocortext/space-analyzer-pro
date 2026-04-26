console.log('🔬 SCANNER PERFORMANCE COMPARISON');
console.log('==================================');

const rustScannerPath = 'E:/Self Built Web and Mobile Apps/Space Analyzer/src/rust/simple-scanner/scanner.node';
const cppScannerPath = 'E:/Self Built Web and Mobile Apps/Space Analyzer/src/cpp/native-scanner/build/Release/native_scanner.node';

const testDir = "D:/Backup of Important Data for Windows 11 Upgrade/Native Media AI Studio";
const testLimit = 5000;

try {
    const rustScanner = require(rustScannerPath);
    const cppScanner = require(cppScannerPath);
    
    console.log('✅ Both scanners loaded successfully');
    
    // Test C++ Scanner
    console.log('\n🚀 Testing C++ Scanner...');
    const cppStart = Date.now();
    const cppResult = cppScanner.scanDirectory(testDir, testLimit);
    const cppEnd = Date.now();
    
    // Test Rust Scanner  
    console.log('\n🦀 Testing Rust Scanner...');
    const rustStart = Date.now();
    const rustResult = rustScanner.scanDirectorySimple(testDir);
    const rustEnd = Date.now();
    
    // Performance Comparison
    console.log('\n📊 PERFORMANCE COMPARISON');
    console.log('==========================');
    
    console.log('\n🚀 C++ Scanner Results:');
    console.log(`- Files Processed: ${Number(cppResult.totalFiles).toLocaleString()}`);
    console.log(`- Files Returned: ${cppResult.files ? cppResult.files.length.toLocaleString() : 0}`);
    console.log(`- Total Size: ${(Number(cppResult.totalSize) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Scan Time: ${Number(cppResult.scanTimeMs)}ms`);
    console.log(`- Actual Time: ${cppEnd - cppStart}ms`);
    console.log(`- Throughput: ${Math.round(Number(cppResult.totalFiles) / (Number(cppResult.scanTimeMs) / 1000)).toLocaleString()} files/sec`);
    console.log(`- Categories: ${Object.keys(cppResult.categories || {}).length}`);
    
    console.log('\n🦀 Rust Scanner Results:');
    console.log(`- Files Processed: ${rustResult.totalFiles.toLocaleString()}`);
    console.log(`- Files Returned: ${rustResult.files ? rustResult.files.length.toLocaleString() : 0}`);
    console.log(`- Total Size: ${(rustResult.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Scan Time: ${rustResult.scanTimeMs}ms`);
    console.log(`- Actual Time: ${rustEnd - rustStart}ms`);
    console.log(`- Throughput: ${Math.round(rustResult.totalFiles / (rustResult.scanTimeMs / 1000)).toLocaleString()} files/sec`);
    console.log(`- Categories: ${Object.keys(rustResult.categories || {}).length}`);
    
    // Category Comparison
    console.log('\n📋 CATEGORY COMPARISON');
    console.log('========================');
    
    const cppCategories = cppResult.categories || {};
    const rustCategories = rustResult.categories || {};
    
    console.log('\n🚀 C++ Categories:');
    Object.entries(cppCategories).forEach(([cat, info]) => {
        console.log(`- ${cat}: ${Number(info.count).toLocaleString()} files, ${(Number(info.size) / 1024).toFixed(1)} KB`);
    });
    
    console.log('\n🦀 Rust Categories:');
    Object.entries(rustCategories).forEach(([cat, info]) => {
        console.log(`- ${cat}: ${info.count.toLocaleString()} files, ${(info.size / 1024).toFixed(1)} KB`);
    });
    
    // Summary
    console.log('\n🎯 SUMMARY');
    console.log('===========');
    
    const cppThroughput = Math.round(Number(cppResult.totalFiles) / (Number(cppResult.scanTimeMs) / 1000));
    const rustThroughput = Math.round(rustResult.totalFiles / (rustResult.scanTimeMs / 1000));
    
    console.log(`📈 Performance Winner: ${rustThroughput > cppThroughput ? '🦀 Rust' : '🚀 C++'}`);
    console.log(`📊 Rust Throughput: ${rustThroughput.toLocaleString()} files/sec`);
    console.log(`📊 C++ Throughput: ${cppThroughput.toLocaleString()} files/sec`);
    console.log(`📈 Performance Ratio: ${(rustThroughput / cppThroughput).toFixed(2)}x`);
    
    console.log('\n✅ Scanner Comparison Complete!');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
}
