# Space Analyzer Test Automation

A comprehensive automation system for testing C++ GUI applications with full user interaction simulation. This system coordinates all testing aspects of the Space Analyzer application and provides detailed reporting and performance monitoring.

## 🚀 Features

### Core Automation
- **Master Coordination**: Orchestrates all existing test scripts and GUI applications
- **Full User Interaction Simulation**: Simulates complete user workflows through GUI automation
- **Performance Monitoring**: Real-time monitoring of CPU, memory, and execution metrics
- **Comprehensive Reporting**: Generates detailed JSON and Markdown reports

### Testing Capabilities
- **GUI Application Testing**: Automated testing of Qt6 GUI applications
- **End-to-End Testing**: Complete workflow validation
- **Performance Benchmarking**: Memory and CPU usage analysis
- **Error Handling**: Robust error detection and recovery
- **Screenshot Capture**: Automated screenshot collection during testing

### Infrastructure Management
- **Environment Setup**: Automatic configuration of Qt6 and testing environments
- **Process Management**: Smart process lifecycle management with timeouts
- **Artifact Collection**: Automatic collection of test results, logs, and screenshots
- **Cleanup Procedures**: Configurable cleanup and maintenance

## 📁 Project Structure

```
Space Analyzer Test Automation/
├── space_analyzer_test_automation.py    # Master automation script
├── test_automation_config.json          # Configuration file
├── automated_gui_test.py               # Existing GUI test
├── comprehensive_gui_test.js           # Existing comprehensive test
├── e2e_test.js                         # Existing end-to-end test
├── test_screenshots/                   # Screenshot collection directory
├── test_reports/                       # Generated test reports
├── logs/                              # Log files
└── docs/                              # Documentation
```

## 🛠 Installation & Setup

### Prerequisites
```bash
# Install required Python packages
pip install psutil

# Install Node.js dependencies (for JavaScript tests)
npm install puppeteer
```

### Configuration
1. Copy the default configuration:
```bash
cp test_automation_config.json.example test_automation_config.json
```

2. Modify `test_automation_config.json` to match your environment:

```json
{
  "test_suites": [
    {
      "name": "Basic Qt6 Functionality",
      "script_path": "automated_gui_test.py",
      "timeout": 30,
      "priority": 1
    }
  ],
  "gui_applications": [
    {
      "name": "Space Analyzer GUI",
      "executable_path": "build_enhanced_gui/bin/space_analyzer_neural_gui.exe",
      "test_scenarios": [
        {
          "name": "Directory Analysis",
          "test_data_path": "test_data/sample_directories",
          "expected_output_files": ["analysis_results.json"]
        }
      ]
    }
  ],
  "performance_thresholds": {
    "max_test_duration": 600,
    "max_memory_usage": 1024,
    "max_cpu_usage": 80
  }
}
```

## 🎯 Usage

### Quick Start
Run all tests with default configuration:
```bash
python space_analyzer_test_automation.py
```

### Advanced Usage

#### Run Specific Test Suites
```bash
# Run only specific test suites
python space_analyzer_test_automation.py --test-suite "Basic Qt6 Functionality" --test-suite "GUI Test"
```

#### Custom Configuration
```bash
# Use custom configuration file
python space_analyzer_test_automation.py --config my_config.json
```

#### Verbose Output
```bash
# Enable detailed logging
python space_analyzer_test_automation.py --verbose
```

#### Skip Cleanup
```bash
# Keep all artifacts after testing
python space_analyzer_test_automation.py --no-cleanup
```

## 📊 Test Execution Flow

### 1. Environment Setup
- Creates necessary directories
- Configures logging system
- Sets up Qt6 environment variables
- Prepares test data directories

### 2. Test Suite Execution
- Runs tests in priority order
- Monitors process performance
- Captures stdout/stderr output
- Handles timeouts and errors

### 3. GUI Application Testing
- Detects available GUI executables
- Simulates user interactions
- Monitors resource usage
- Captures screenshots and artifacts

### 4. Report Generation
- Creates comprehensive JSON report
- Generates human-readable Markdown report
- Provides performance analysis
- Includes recommendations

### 5. Cleanup
- Removes temporary files (configurable)
- Terminates lingering processes
- Archives important artifacts

## 📈 Performance Monitoring

### Metrics Collected
- **Execution Time**: Duration for each test
- **Memory Usage**: Peak and average memory consumption
- **CPU Usage**: Average and peak CPU utilization
- **Exit Codes**: Process termination status
- **Error Rates**: Failure and timeout analysis

### Thresholds
Configure performance thresholds in `test_automation_config.json`:

```json
{
  "performance_thresholds": {
    "max_test_duration": 600,      # Maximum test duration in seconds
    "max_memory_usage": 1024,      # Maximum memory in MB
    "max_cpu_usage": 80           # Maximum CPU usage percentage
  }
}
```

## 📄 Generated Reports

### Markdown Report (`test_report_YYYYMMDD_HHMMSS.md`)
```markdown
# Space Analyzer - Comprehensive Test Report

## Test Summary
| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 8 |
| ❌ Failed | 2 |
| ⚠️ Errors | 0 |
| ⏰ Timeouts | 0 |

## Performance Analysis
- **Average Duration:** 45.2 seconds
- **Maximum Memory:** 512.3 MB
- **Average CPU:** 23.5%

## Recommendations
1. Optimize memory usage in GUI interactions
2. Consider increasing timeout for large directory tests
```

### JSON Report (`comprehensive_test_report_YYYYMMDD_HHMMSS.json`)
```json
{
  "test_summary": {
    "total_tests": 10,
    "passed": 8,
    "failed": 2,
    "total_duration": 452.3
  },
  "test_results": [...],
  "performance_analysis": {...},
  "recommendations": [...]
}
```

## 🔧 Customization

### Adding New Test Suites
Add to `test_automation_config.json`:
```json
{
  "test_suites": [
    {
      "name": "Custom Performance Test",
      "script_path": "custom_performance_test.py",
      "timeout": 120,
      "priority": 4,
      "environment_vars": {
        "CUSTOM_ENV_VAR": "value"
      }
    }
  ]
}
```

### Adding GUI Test Scenarios
```json
{
  "gui_applications": [
    {
      "name": "Space Analyzer GUI",
      "executable_path": "path/to/executable.exe",
      "test_scenarios": [
        {
          "name": "Large Directory Stress Test",
          "test_data_path": "test_data/stress_test",
          "timeout": 600,
          "environment_vars": {
            "QT_QPA_PLATFORM": "offscreen"
          }
        }
      ]
    }
  ]
}
```

## 🛠 Integration with CI/CD

### GitHub Actions Example
```yaml
name: Space Analyzer Test Automation

on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    steps:
    - uses: actions/checkout@v2
    - name: Setup Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.9'
    - name: Install Dependencies
      run: |
        pip install psutil
    - name: Run Test Automation
      run: python space_analyzer_test_automation.py
    - name: Upload Reports
      uses: actions/upload-artifact@v2
      with:
        name: test-reports
        path: test_reports/
```

### Jenkins Pipeline Example
```groovy
pipeline {
    agent any
    stages {
        stage('Setup') {
            steps {
                bat 'pip install psutil'
            }
        }
        stage('Test') {
            steps {
                bat 'python space_analyzer_test_automation.py'
            }
        }
        stage('Archive') {
            steps {
                archiveArtifacts artifacts: 'test_reports/**/*', fingerprint: true
            }
        }
    }
}
```

## 🔍 Troubleshooting

### Common Issues

#### Qt6 Libraries Not Found
```bash
# Add Qt6 to PATH
set PATH=C:\Qt\6.10.1\msvc2022_64\bin;%PATH%
```

#### Permission Errors
```bash
# Ensure execution permissions
chmod +x space_analyzer_test_automation.py
```

#### Process Hanging
```bash
# Run with verbose logging to identify hanging processes
python space_analyzer_test_automation.py --verbose
```

### Debug Mode
Enable debug logging by setting environment variable:
```bash
set PYTHONPATH=.
python space_analyzer_test_automation.py --verbose
```

## 📋 Best Practices

### Test Data Management
- Keep test data separate from source code
- Use relative paths in configuration
- Clean up large test datasets regularly

### Performance Optimization
- Monitor memory usage during development
- Set appropriate timeouts for different test types
- Use offscreen rendering for GUI tests when possible

### Reporting
- Review reports after each test run
- Track performance trends over time
- Archive important test results

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

## 📜 License

This project is part of the Space Analyzer development suite. See main project license for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review generated log files
3. Create an issue with detailed information

---

**Space Analyzer Test Automation v1.0**  
*Comprehensive testing for GUI applications*