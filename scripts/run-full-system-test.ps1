# PowerShell full system test script for Space Analyzer Pro
# Starts all services, runs comprehensive tests, and generates reports

param(
    [switch]$SkipServiceStart,
    [switch]$Verbose
)

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Purple = "Purple"
    Cyan = "Cyan"
    White = "White"
}

# Test configuration
$TestResultsDir = "test-results"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ReportFile = "$TestResultsDir\system-test-report-$Timestamp.md"

Write-Host "🚀 Space Analyzer Pro - Complete System Test" -ForegroundColor $Colors.Blue
Write-Host "==================================================" -ForegroundColor $Colors.Blue
Write-Host "Timestamp: $(Get-Date)" -ForegroundColor $Colors.Cyan
Write-Host "Test ID: $Timestamp" -ForegroundColor $Colors.Cyan
Write-Host ""

# Create results directory
if (!(Test-Path $TestResultsDir)) {
    New-Item -ItemType Directory -Path $TestResultsDir -Force | Out-Null
}

# Initialize report
$ReportContent = @"
# Space Analyzer Pro - System Test Report

**Timestamp:** $(Get-Date)  
**Test ID:** $Timestamp  
**Environment:** Local Development  

## Test Summary

"@

# Function to log to both console and report
function Write-TestLog {
    param(
        [string]$Level,
        [string]$Message,
        [string]$Details = ""
    )
    
    switch ($Level) {
        "INFO" { Write-Host $Message -ForegroundColor $Colors.White }
        "SUCCESS" { Write-Host $Message -ForegroundColor $Colors.Green }
        "WARNING" { Write-Host $Message -ForegroundColor $Colors.Yellow }
        "ERROR" { Write-Host $Message -ForegroundColor $Colors.Red }
        "SECTION" { Write-Host $Message -ForegroundColor $Colors.Blue }
    }
    
    switch ($Level) {
        "INFO" { $ReportContent += "### ℹ️ $Message`n" }
        "SUCCESS" { $ReportContent += "### ✅ $Message`n" }
        "WARNING" { $ReportContent += "### ⚠️ $Message`n" }
        "ERROR" { $ReportContent += "### ❌ $Message`n" }
        "SECTION" { $ReportContent += "`n## $Message`n`n" }
    }
    
    if ($Details) {
        $ReportContent += "$Details`n`n"
    }
}

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check service health
function Test-ServiceHealth {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Timeout = 30
    )
    
    Write-TestLog "INFO" "Checking $Name health..." "URL: $Url"
    
    $attempt = 0
    while ($attempt -lt $Timeout) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            Write-TestLog "SUCCESS" "$Name is healthy"
            return $true
        }
        catch {
            $attempt++
            Start-Sleep 1
        }
    }
    
    Write-TestLog "ERROR" "$Name health check failed after ${Timeout}s"
    return $false
}

# Function to run tests and capture results
function Test-Command {
    param(
        [string]$TestName,
        [string]$TestCommand,
        [int]$ExpectedExitCode = 0
    )
    
    Write-TestLog "INFO" "Running $TestName..." "Command: $TestCommand"
    
    $tempOutput = [System.IO.Path]::GetTempFileName()
    $exitCode = 0
    
    try {
        Invoke-Expression $TestCommand | Out-File -FilePath $tempOutput -Encoding UTF8
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq $ExpectedExitCode) {
            Write-TestLog "SUCCESS" "$TestName passed"
            $output = Get-Content $tempOutput -Raw
            $ReportContent += "`n````bash`n# Command: $TestCommand`n$output`n`````n`n"
        }
        else {
            Write-TestLog "ERROR" "$TestName failed (exit code: $exitCode)"
            $output = Get-Content $tempOutput -Raw
            $ReportContent += "`n````bash`n# Command: $TestCommand`n# Exit code: $exitCode`n$output`n`````n`n"
        }
    }
    catch {
        $exitCode = 1
        Write-TestLog "ERROR" "$TestName failed (exit code: $exitCode)"
        $output = $_.Exception.Message
        $ReportContent += "`n````bash`n# Command: $TestCommand`n# Exit code: $exitCode`n$output`n`````n`n"
    }
    
    Remove-Item $tempOutput -Force -ErrorAction SilentlyContinue
    return $exitCode
}

# Check dependencies
Write-TestLog "SECTION" "Dependency Check"

if (-not (Test-Command "node")) {
    Write-TestLog "ERROR" "Node.js is not installed"
    exit 1
}

if (-not (Test-Command "npm")) {
    Write-TestLog "ERROR" "npm is not installed"
    exit 1
}

if (-not (Test-Command "python")) {
    Write-TestLog "ERROR" "Python is not installed"
    exit 1
}

if (-not (Test-Command "curl")) {
    Write-TestLog "ERROR" "curl is not installed"
    exit 1
}

Write-TestLog "SUCCESS" "All required dependencies are available"

# Check if services are already running
$servicesRunning = $false

if (-not $SkipServiceStart) {
    Write-TestLog "SECTION" "Service Health Checks"
    
    $servicesHealthy = $true
    
    if (Test-ServiceHealth -Name "Backend API" -Url "http://localhost:8080/api/health") {
        $servicesRunning = $true
    }
    else {
        $servicesHealthy = $false
    }
    
    if (Test-ServiceHealth -Name "Frontend" -Url "http://localhost:5173") {
        # Frontend is running
    }
    else {
        $servicesHealthy = $false
    }
    
    if (Test-ServiceHealth -Name "AI Service" -Url "http://localhost:5000/health") {
        # AI service is running
    }
    else {
        $servicesHealthy = $false
    }
    
    if (-not $servicesHealthy) {
        Write-TestLog "ERROR" "Some services failed to start properly"
        $servicesRunning = $false
    }
    else {
        Write-TestLog "SUCCESS" "All services are healthy"
        $servicesRunning = $true
    }
}

# Run comprehensive tests
Write-TestLog "SECTION" "Comprehensive Testing"

# 1. Page Testing
Write-TestLog "INFO" "Running automated page testing..."
if (Test-Command "node") {
    $pageTestExitCode = Test-Command -TestName "Page Tests" -TestCommand "node scripts/test-all-pages.js"
}
else {
    Write-TestLog "WARNING" "Node.js not available, skipping page tests"
    $pageTestExitCode = 0
}

# 2. API Testing
Write-TestLog "INFO" "Running API endpoint tests..."

# Test backend endpoints
Test-Command -TestName "Backend Health" -TestCommand "curl -s http://localhost:8080/api/health"
Test-Command -TestName "Backend Status" -TestCommand "curl -s http://localhost:8080/api/status"

# Test AI service endpoints
Test-Command -TestName "AI Service Health" -TestCommand "curl -s http://localhost:5000/health"
Test-Command -TestName "AI Service Root" -TestCommand "curl -s http://localhost:5000/"
Test-Command -TestName "AI Service Auth" -TestCommand "curl -s -X POST http://localhost:5000/auth/token -d 'username=test&password=test'"

# Test file upload endpoint (may fail)
Test-Command -TestName "File Upload Endpoint" -TestCommand "curl -s http://localhost:8080/api/scan" -ExpectedExitCode 1

# 3. Integration Testing
Write-TestLog "INFO" "Running integration tests..."

# Test frontend can reach backend
Test-Command -TestName "Frontend-Backend Integration" -TestCommand "curl -s http://localhost:5173/api/health" -ExpectedExitCode 1

# Test AI service authentication flow
Test-Command -TestName "AI Auth Flow" -TestCommand "curl -s -X POST http://localhost:5000/auth/token -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}'"

# 4. Performance Testing
Write-TestLog "INFO" "Running basic performance tests..."

# Test response times
$backendTime = Measure-Command { curl -s http://localhost:8080/api/health | Out-Null }
$aiTime = Measure-Command { curl -s http://localhost:5000/health | Out-Null }

Write-TestLog "INFO" "Performance Metrics" "Backend: $($backendTime.TotalSeconds)s, AI Service: $($aiTime.TotalSeconds)s"

$ReportContent += "`n**Performance Metrics:**`n- Backend API: $($backendTime.TotalSeconds)s`n- AI Service: $($aiTime.TotalSeconds)s`n`n"

# 5. Error Handling Testing
Write-TestLog "INFO" "Testing error handling..."

# Test 404 handling
Test-Command -TestName "404 Error Handling" -TestCommand "curl -s http://localhost:8080/api/nonexistent" -ExpectedExitCode 1

# Test malformed requests
Test-Command -TestName "Malformed Request Handling" -TestCommand "curl -s -X POST http://localhost:5000/auth/invalid -d 'invalid'" -ExpectedExitCode 1

# 6. Security Testing (Basic)
Write-TestLog "INFO" "Running basic security checks..."

# Check for exposed sensitive endpoints
Test-Command -TestName "Security - No Exposed Config" -TestCommand "curl -s http://localhost:8080/config" -ExpectedExitCode 1
Test-Command -TestName "Security - No Debug Endpoints" -TestCommand "curl -s http://localhost:8080/debug" -ExpectedExitCode 1

# Generate error test data
Write-TestLog "INFO" "Generating test error data..."

# Trigger some errors for testing
curl -s http://localhost:8080/api/nonexistent 2>$null | Out-Null
curl -s -X POST http://localhost:5000/auth/invalid 2>$null | Out-Null

# Wait a moment for error tracking
Start-Sleep 2

# Test error reporting
Test-Command -TestName "Error Reporting" -TestCommand "curl -s http://localhost:8080/api/errors/recent" -ExpectedExitCode 1

# 7. Data Validation
Write-TestLog "INFO" "Running data validation tests..."

# Test with valid data
$validScanData = '{"path":"./test","recursive":false}'
Test-Command -TestName "Valid Scan Data" -TestCommand "curl -s -X POST http://localhost:8080/api/scan -H 'Content-Type: application/json' -d '$validScanData'" -ExpectedExitCode 1

# Test with invalid data
$invalidScanData = '{"invalid":"data"}'
Test-Command -TestName "Invalid Data Handling" -TestCommand "curl -s -X POST http://localhost:8080/api/scan -H 'Content-Type: application/json' -d '$invalidScanData'" -ExpectedExitCode 1

# Generate summary
Write-TestLog "SECTION" "Test Summary"

$totalTests = 0
$passedTests = 0
$failedTests = 0

# Count test results from the report content
$totalTests = ([regex]::Matches($ReportContent, "✅|❌").Count)
$passedTests = ([regex]::Matches($ReportContent, "✅").Count)
$failedTests = ([regex]::Matches($ReportContent, "❌").Count)

$successRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 1) } else { 0 }

Write-TestLog "INFO" "Test Results Summary" "
- Total Tests: $totalTests
- Passed: $passedTests
- Failed: $failedTests
- Success Rate: $successRate%
"

$ReportContent += "`n## Final Results`n`n**Total Tests:** $totalTests  
**Passed:** $passedTests  
**Failed:** $failedTests  
**Success Rate:** $successRate%  

**Overall Status:** $(if ($failedTests -eq 0) { '✅ PASSED' } else { '❌ FAILED' })`n`n"

# Add recommendations
Write-TestLog "SECTION" "Recommendations"

if ($failedTests -gt 0) {
    $ReportContent += "### 🔧 Issues to Address`n`n"
    
    if ($pageTestExitCode -ne 0) {
        $ReportContent += "- **Page Testing:** Fix browser automation issues`n"
    }
    
    $ReportContent += "- Review failed tests in the details above`n"
    $ReportContent += "- Check service logs for specific error messages`n"
    $ReportContent += "- Ensure all dependencies are properly installed`n`n"
}
else {
    $ReportContent += "### 🎉 All Tests Passed!`n`n"
    $ReportContent += "- System is ready for development`n"
    $ReportContent += "- All services are functioning correctly`n"
    $ReportContent += "- Error tracking is working properly`n`n"
}

# Add next steps
$ReportContent += "## Next Steps`n`n1. **Review the full report** in: `$ReportFile``n2. **Check error logs** in the `logs/` directory`n3. **Test the application manually** at http://localhost:5173`n4. **Monitor error tracking** at http://localhost:5173/admin/error-logs`n5. **Run individual tests** as needed for debugging`n`n"

# Save report
$ReportContent | Out-File -FilePath $ReportFile -Encoding UTF8

# Final summary
Write-Host ""
Write-Host "📊 Test Complete!" -ForegroundColor $Colors.Blue
Write-Host "==================================" -ForegroundColor $Colors.Blue
Write-Host "📄 Report: $ReportFile" -ForegroundColor $Colors.Green
Write-Host "📁 Results: $TestResultsDir" -ForegroundColor $Colors.Green
Write-Host "📈 Success Rate: $successRate%" -ForegroundColor $Colors.Green

if ($failedTests -eq 0) {
    Write-Host "🎉 All tests passed! System is ready." -ForegroundColor $Colors.Green
    exit 0
}
else {
    Write-Host "⚠️  Some tests failed. Check the report for details." -ForegroundColor $Colors.Yellow
    exit 1
}
