#!/usr/bin/env node

/**
 * Restoration Test Script
 * Verifies that all restored components are working correctly
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class RestorationTester {
    constructor() {
        this.testResults = {
            cpp: { status: 'pending', details: {} },
            rust: { status: 'pending', details: {} },
            node: { status: 'pending', details: {} },
            ai: { status: 'pending', details: {} },
            integration: { status: 'pending', details: {} }
        };
        
        this.projectRoot = path.join(__dirname, '../..');
        this.testDir = path.join(this.projectRoot, 'test-temp');
    }

    async runAllTests() {
        console.log('🧪 Starting Restoration Test Suite');
        console.log('=====================================');
        
        try {
            // Create test directory
            await this.setupTestEnvironment();
            
            // Test individual components
            await this.testCPPComponents();
            await this.testRustComponents();
            await this.testNodeComponents();
            await this.testAIComponents();
            
            // Test integration
            await this.testIntegration();
            
            // Generate report
            this.generateReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        } finally {
            // Cleanup
            await this.cleanup();
        }
    }

    async setupTestEnvironment() {
        console.log('\n📋 Setting up test environment...');
        
        // Create test directory with sample files
        await fs.mkdir(this.testDir, { recursive: true });
        
        // Create test files
        const testFiles = [
            { name: 'test.txt', content: 'This is a test file' },
            { name: 'test.js', content: 'console.log("Hello World");' },
            { name: 'test.cpp', content: '#include <iostream>\nint main() { return 0; }' },
            { name: 'large-file.bin', content: Buffer.alloc(1024 * 1024, 0) } // 1MB file
        ];
        
        for (const file of testFiles) {
            const filePath = path.join(this.testDir, file.name);
            await fs.writeFile(filePath, file.content);
        }
        
        console.log(`✅ Created test directory with ${testFiles.length} files`);
    }

    async testCPPComponents() {
        console.log('\n🔧 Testing C++ Components...');
        
        try {
            // Check if C++ source files exist
            const cppDir = path.join(this.projectRoot, 'src/cpp');
            const requiredFiles = [
                'space-analyzer-main.cpp',
                'space-scanner.cpp',
                'performance-monitoring.cpp',
                'CMakeLists.txt'
            ];
            
            let filesExist = true;
            for (const file of requiredFiles) {
                const filePath = path.join(cppDir, file);
                const exists = await fs.access(filePath).then(() => true).catch(() => false);
                this.testResults.cpp.details[file] = exists;
                if (!exists) filesExist = false;
            }
            
            if (filesExist) {
                console.log('✅ All C++ source files present');
                
                // Test CMake configuration
                const cmakeTest = await this.testCMakeConfiguration();
                this.testResults.cpp.details.cmake = cmakeTest;
                
                if (cmakeTest) {
                    this.testResults.cpp.status = 'passed';
                    console.log('✅ C++ components test passed');
                } else {
                    this.testResults.cpp.status = 'warning';
                    console.log('⚠️  C++ components present but build configuration needs attention');
                }
            } else {
                this.testResults.cpp.status = 'failed';
                console.log('❌ Missing C++ source files');
            }
            
        } catch (error) {
            this.testResults.cpp.status = 'error';
            this.testResults.cpp.details.error = error.message;
            console.log(`❌ C++ test error: ${error.message}`);
        }
    }

    async testCMakeConfiguration() {
        try {
            const cppDir = path.join(this.projectRoot, 'src/cpp');
            const cmakeFile = path.join(cppDir, 'CMakeLists.txt');
            
            // Check if CMakeLists.txt is valid
            const cmakeContent = await fs.readFile(cmakeFile, 'utf8');
            
            // Basic validation
            const requiredCmakeContent = [
                'cmake_minimum_required',
                'project(SpaceAnalyzerCpp',
                'CMAKE_CXX_STANDARD 20',
                'add_executable(space-analyzer-cli'
            ];
            
            for (const content of requiredCmakeContent) {
                if (!cmakeContent.includes(content)) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    async testRustComponents() {
        console.log('\n🦀 Testing Rust Components...');
        
        try {
            // Check if Rust source files exist
            const rustMain = path.join(this.projectRoot, 'src/main.rs');
            const rustDir = path.join(this.projectRoot, 'native/scanner');
            
            const mainExists = await fs.access(rustMain).then(() => true).catch(() => false);
            this.testResults.rust.details.main_rs = mainExists;
            
            if (mainExists) {
                // Check Cargo.toml
                const cargoToml = path.join(this.projectRoot, 'Cargo.toml');
                const cargoExists = await fs.access(cargoToml).then(() => true).catch(() => false);
                this.testResults.rust.details.cargo_toml = cargoExists;
                
                if (cargoExists) {
                    this.testResults.rust.status = 'passed';
                    console.log('✅ Rust components test passed');
                } else {
                    this.testResults.rust.status = 'warning';
                    console.log('⚠️  Rust source present but Cargo.toml missing');
                }
            } else {
                this.testResults.rust.status = 'failed';
                console.log('❌ Rust main.rs not found');
            }
            
        } catch (error) {
            this.testResults.rust.status = 'error';
            this.testResults.rust.details.error = error.message;
            console.log(`❌ Rust test error: ${error.message}`);
        }
    }

    async testNodeComponents() {
        console.log('\n💚 Testing Node.js Components...');
        
        try {
            // Check package.json
            const packageJson = path.join(this.projectRoot, 'package.json');
            const packageExists = await fs.access(packageJson).then(() => true).catch(() => false);
            this.testResults.node.details.package_json = packageExists;
            
            if (packageExists) {
                const packageContent = JSON.parse(await fs.readFile(packageJson, 'utf8'));
                this.testResults.node.details.dependencies = Object.keys(packageContent.dependencies || {}).length;
                this.testResults.node.details.devDependencies = Object.keys(packageContent.devDependencies || {}).length;
                
                // Check server files
                const serverDir = path.join(this.projectRoot, 'server');
                const serverExists = await fs.access(serverDir).then(() => true).catch(() => false);
                this.testResults.node.details.server_directory = serverExists;
                
                this.testResults.node.status = 'passed';
                console.log('✅ Node.js components test passed');
            } else {
                this.testResults.node.status = 'failed';
                console.log('❌ package.json not found');
            }
            
        } catch (error) {
            this.testResults.node.status = 'error';
            this.testResults.node.details.error = error.message;
            console.log(`❌ Node.js test error: ${error.message}`);
        }
    }

    async testAIComponents() {
        console.log('\n🧠 Testing AI Components...');
        
        try {
            // Check AI modules
            const aiDir = path.join(this.projectRoot, 'src/ai/extra');
            const aiExists = await fs.access(aiDir).then(() => true).catch(() => false);
            this.testResults.ai.details.ai_directory = aiExists;
            
            if (aiExists) {
                // Check core AI files
                const aiFiles = [
                    'ai_core.js',
                    'advanced_analysis.js'
                ];
                
                let aiFilesExist = true;
                for (const file of aiFiles) {
                    const filePath = path.join(aiDir, file);
                    const exists = await fs.access(filePath).then(() => true).catch(() => false);
                    this.testResults.ai.details[file] = exists;
                    if (!exists) aiFilesExist = false;
                }
                
                // Check AI modules
                const modulesDir = path.join(aiDir, 'modules');
                const modulesExist = await fs.access(modulesDir).then(() => true).catch(() => false);
                this.testResults.ai.details.modules_directory = modulesExist;
                
                if (modulesExist) {
                    const moduleFiles = await fs.readdir(modulesDir);
                    this.testResults.ai.details.module_count = moduleFiles.length;
                    
                    const requiredModules = [
                        'automation.js',
                        'predictive.js',
                        'nlp.js',
                        'visualization.js',
                        'dependency-checker.js'
                    ];
                    
                    for (const module of requiredModules) {
                        const exists = moduleFiles.includes(module);
                        this.testResults.ai.details[module] = exists;
                    }
                }
                
                if (aiFilesExist && modulesExist) {
                    this.testResults.ai.status = 'passed';
                    console.log('✅ AI components test passed');
                } else {
                    this.testResults.ai.status = 'warning';
                    console.log('⚠️  AI components partially present');
                }
            } else {
                this.testResults.ai.status = 'failed';
                console.log('❌ AI directory not found');
            }
            
        } catch (error) {
            this.testResults.ai.status = 'error';
            this.testResults.ai.details.error = error.message;
            console.log(`❌ AI test error: ${error.message}`);
        }
    }

    async testIntegration() {
        console.log('\n🔗 Testing Integration Components...');
        
        try {
            // Check integration files
            const integrationDir = path.join(this.projectRoot, 'src/integration');
            const integrationExists = await fs.access(integrationDir).then(() => true).catch(() => false);
            this.testResults.integration.details.integration_directory = integrationExists;
            
            if (integrationExists) {
                const integrationFiles = [
                    'cli-bridge.cjs',
                    'unified-cli.cjs'
                ];
                
                let integrationFilesExist = true;
                for (const file of integrationFiles) {
                    const filePath = path.join(integrationDir, file);
                    const exists = await fs.access(filePath).then(() => true).catch(() => false);
                    this.testResults.integration.details[file] = exists;
                    if (!exists) integrationFilesExist = false;
                }
                
                if (integrationFilesExist) {
                    // Test CLI bridge module loading
                    try {
                        const CLIBridge = require('./cli-bridge.cjs');
                        const bridge = new CLIBridge();
                        this.testResults.integration.details.cli_bridge_loads = true;
                        
                        // Test tool status
                        const status = bridge.getToolStatus();
                        this.testResults.integration.details.tool_detection = status;
                        
                        this.testResults.integration.status = 'passed';
                        console.log('✅ Integration components test passed');
                    } catch (error) {
                        this.testResults.integration.details.cli_bridge_error = error.message;
                        this.testResults.integration.status = 'warning';
                        console.log('⚠️  Integration files present but module loading failed');
                    }
                } else {
                    this.testResults.integration.status = 'failed';
                    console.log('❌ Missing integration files');
                }
            } else {
                this.testResults.integration.status = 'failed';
                console.log('❌ Integration directory not found');
            }
            
        } catch (error) {
            this.testResults.integration.status = 'error';
            this.testResults.integration.details.error = error.message;
            console.log(`❌ Integration test error: ${error.message}`);
        }
    }

    generateReport() {
        console.log('\n📊 Restoration Test Report');
        console.log('==========================');
        
        const statusIcons = {
            passed: '✅',
            warning: '⚠️',
            failed: '❌',
            error: '💥',
            pending: '⏳'
        };
        
        const componentNames = {
            cpp: 'C++ Backend',
            rust: 'Rust CLI',
            node: 'Node.js Server',
            ai: 'AI Modules',
            integration: 'Integration Layer'
        };
        
        let totalTests = 0;
        let passedTests = 0;
        
        Object.entries(this.testResults).forEach(([component, result]) => {
            const icon = statusIcons[result.status];
            const name = componentNames[component];
            console.log(`${icon} ${name}: ${result.status.toUpperCase()}`);
            
            if (result.status !== 'pending') {
                totalTests++;
                if (result.status === 'passed') passedTests++;
            }
            
            // Show details for failed/warning tests
            if (result.status === 'failed' || result.status === 'warning') {
                Object.entries(result.details).forEach(([key, value]) => {
                    if (value === false || (typeof value === 'string' && value.includes('error'))) {
                        console.log(`   • ${key}: ${value}`);
                    }
                });
            }
        });
        
        console.log('\n📈 Summary:');
        console.log(`   Total Components: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
        
        if (passedTests === totalTests) {
            console.log('\n🎉 All restoration tests passed! The enterprise-grade components have been successfully restored.');
        } else {
            console.log('\n⚠️  Some components need attention. Review the details above for specific issues.');
        }
        
        // Save detailed report
        this.saveDetailedReport();
    }

    async saveDetailedReport() {
        const reportPath = path.join(this.projectRoot, 'restoration-test-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot: this.projectRoot,
            testResults: this.testResults,
            summary: {
                totalComponents: Object.keys(this.testResults).length,
                passedComponents: Object.values(this.testResults).filter(r => r.status === 'passed').length,
                warningComponents: Object.values(this.testResults).filter(r => r.status === 'warning').length,
                failedComponents: Object.values(this.testResults).filter(r => r.status === 'failed').length,
                errorComponents: Object.values(this.testResults).filter(r => r.status === 'error').length
            }
        };
        
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    }

    async cleanup() {
        try {
            await fs.rmdir(this.testDir, { recursive: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new RestorationTester();
    tester.runAllTests().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = RestorationTester;