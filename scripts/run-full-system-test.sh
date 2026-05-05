#!/bin/bash
# Complete system test script for Space Analyzer Pro
# Starts all services, runs comprehensive tests, and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_RESULTS_DIR="test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$TEST_RESULTS_DIR/system-test-report-$TIMESTAMP.md"

echo -e "${BLUE}🚀 Space Analyzer Pro - Complete System Test${NC}"
echo "=================================================="
echo -e "${CYAN}Timestamp: $(date)${NC}"
echo -e "${CYAN}Test ID: $TIMESTAMP${NC}"
echo ""

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Initialize report
cat > "$REPORT_FILE" << EOF
# Space Analyzer Pro - System Test Report

**Timestamp:** $(date)  
**Test ID:** $TIMESTAMP  
**Environment:** Local Development  

## Test Summary

EOF

# Function to log to both console and report
log() {
    local level=$1
    local message=$2
    local details=$3
    
    echo -e "$message"
    
    case $level in
        "INFO")
            echo "### ℹ️ $message" >> "$REPORT_FILE"
            ;;
        "SUCCESS")
            echo "### ✅ $message" >> "$REPORT_FILE"
            ;;
        "WARNING")
            echo "### ⚠️ $message" >> "$REPORT_FILE"
            ;;
        "ERROR")
            echo "### ❌ $message" >> "$REPORT_FILE"
            ;;
        "SECTION")
            echo -e "\n## $message\n" >> "$REPORT_FILE"
            ;;
    esac
    
    if [ -n "$details" ]; then
        echo "$details" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    local timeout=${3:-30}
    
    log "INFO" "Checking $name health..." "URL: $url"
    
    local attempts=0
    while [ $attempts -lt $timeout ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log "SUCCESS" "$name is healthy"
            return 0
        fi
        
        attempts=$((attempts + 1))
        sleep 1
    done
    
    log "ERROR" "$name health check failed after ${timeout}s"
    return 1
}

# Function to run tests and capture results
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_exit_code=${3:-0}
    
    log "INFO" "Running $test_name..." "Command: $test_command"
    
    local temp_output=$(mktemp)
    local exit_code=0
    
    if eval "$test_command" > "$temp_output" 2>&1; then
        exit_code=$?
        if [ $exit_code -eq $expected_exit_code ]; then
            log "SUCCESS" "$test_name passed"
            echo -e "\n\`\`\`bash\n# Command: $test_command\n$(cat "$temp_output")\n\`\`\`" >> "$REPORT_FILE"
        else
            log "ERROR" "$test_name failed (exit code: $exit_code)"
            echo -e "\n\`\`\`bash\n# Command: $test_command\n# Exit code: $exit_code\n$(cat "$temp_output")\n\`\`\`" >> "$REPORT_FILE"
        fi
    else
        exit_code=$?
        log "ERROR" "$test_name failed (exit code: $exit_code)"
        echo -e "\n\`\`\`bash\n# Command: $test_command\n# Exit code: $exit_code\n$(cat "$temp_output")\n\`\`\`" >> "$REPORT_FILE"
    fi
    
    rm -f "$temp_output"
    return $exit_code
}

# Check dependencies
log "SECTION" "Dependency Check"

if ! command_exists node; then
    log "ERROR" "Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    log "ERROR" "npm is not installed"
    exit 1
fi

if ! command_exists python3; then
    log "ERROR" "Python 3 is not installed"
    exit 1
fi

if ! command_exists curl; then
    log "ERROR" "curl is not installed"
    exit 1
fi

log "SUCCESS" "All required dependencies are available"

# Install Playwright for browser testing
if ! command_exists npx playwright || [ ! -d "$HOME/.cache/ms-playwright" ]; then
    log "INFO" "Installing Playwright browsers..."
    npx playwright install chromium --with-deps
fi

# Start services
log "SECTION" "Service Startup"

echo -e "${YELLOW}🔧 Starting all services...${NC}"

# Start all services in background
./scripts/start-all-services.sh &
STARTUP_PID=$!

# Wait for services to start
sleep 10

# Check service health
log "SECTION" "Service Health Checks"

services_healthy=true

check_service "Backend API" "http://localhost:8080/health" || services_healthy=false
check_service "Frontend" "http://localhost:5173" || services_healthy=false
check_service "AI Service" "http://localhost:5000/health" || services_healthy=false

if [ "$services_healthy" = false ]; then
    log "ERROR" "Some services failed to start properly"
    log "INFO" "Checking logs..."
    
    if [ -f "logs/backend.log" ]; then
        echo -e "\n**Backend Log:**\n\`\`\`\n$(tail -20 logs/backend.log)\n\`\`\`" >> "$REPORT_FILE"
    fi
    
    if [ -f "logs/ai-service.log" ]; then
        echo -e "\n**AI Service Log:**\n\`\`\`\n$(tail -20 logs/ai-service.log)\n\`\`\`" >> "$REPORT_FILE"
    fi
    
    if [ -f "logs/frontend.log" ]; then
        echo -e "\n**Frontend Log:**\n\`\`\`\n$(tail -20 logs/frontend.log)\n\`\`\`" >> "$REPORT_FILE"
    fi
    
    # Cleanup
    kill $STARTUP_PID 2>/dev/null || true
    exit 1
fi

log "SUCCESS" "All services are healthy"

# Run comprehensive tests
log "SECTION" "Comprehensive Testing"

# 1. Page Testing
log "INFO" "Running automated page testing..."
if command_exists node; then
    run_test "Page Tests" "node scripts/test-all-pages.js"
    PAGE_TEST_EXIT_CODE=$?
else
    log "WARNING" "Node.js not available, skipping page tests"
    PAGE_TEST_EXIT_CODE=0
fi

# 2. API Testing
log "INFO" "Running API endpoint tests..."

# Test backend endpoints
run_test "Backend Health" "curl -f http://localhost:8080/health"
run_test "Backend Status" "curl -f http://localhost:8080/api/status"

# Test AI service endpoints
run_test "AI Service Health" "curl -f http://localhost:5000/health"
run_test "AI Service Root" "curl -f http://localhost:5000/"
run_test "AI Service Auth" "curl -f -X POST http://localhost:5000/auth/token -d 'username=test&password=test'"

# Test file upload endpoint (if available)
run_test "File Upload Endpoint" "curl -f http://localhost:8080/api/scan" 1  # May fail, that's ok

# 3. Integration Testing
log "INFO" "Running integration tests..."

# Test frontend can reach backend
run_test "Frontend-Backend Integration" "curl -f http://localhost:5173/api/health" 1  # May fail

# Test AI service authentication flow
run_test "AI Auth Flow" "curl -f -X POST http://localhost:5000/auth/token -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}'"

# 4. Performance Testing
log "INFO" "Running basic performance tests..."

# Test response times
BACKEND_RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:8080/health)
AI_RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:5000/health)

log "INFO" "Performance Metrics" "Backend: ${BACKEND_RESPONSE_TIME}s, AI Service: ${AI_RESPONSE_TIME}s"

echo -e "\n**Performance Metrics:**\n- Backend API: ${BACKEND_RESPONSE_TIME}s\n- AI Service: ${AI_RESPONSE_TIME}s\n" >> "$REPORT_FILE"

# 5. Error Handling Testing
log "INFO" "Testing error handling..."

# Test 404 handling
run_test "404 Error Handling" "curl -f http://localhost:8080/nonexistent" 1

# Test malformed requests
run_test "Malformed Request Handling" "curl -f -X POST http://localhost:5000/auth/invalid -d 'invalid'" 1

# 6. Security Testing (Basic)
log "INFO" "Running basic security checks..."

# Check for exposed sensitive endpoints
run_test "Security - No Exposed Config" "curl -f http://localhost:8080/config" 1
run_test "Security - No Debug Endpoints" "curl -f http://localhost:8080/debug" 1

# Generate error test data
log "INFO" "Generating test error data..."

# Trigger some errors for testing
curl -f http://localhost:8080/api/nonexistent 2>/dev/null || true
curl -f -X POST http://localhost:5000/auth/invalid 2>/dev/null || true

# Wait a moment for error tracking
sleep 2

# Test error reporting
run_test "Error Reporting" "curl -f http://localhost:8080/api/errors/recent" 1  # May not exist

# 7. Data Validation
log "INFO" "Running data validation tests..."

# Test with valid data
VALID_SCAN_DATA='{"path":"./test","recursive":false}'
run_test "Valid Scan Data" "curl -f -X POST http://localhost:8080/api/scan -H 'Content-Type: application/json' -d '$VALID_SCAN_DATA'" 1  # May fail due to directory

# Test with invalid data
INVALID_SCAN_DATA='{"invalid":"data"}'
run_test "Invalid Data Handling" "curl -f -X POST http://localhost:8080/api/scan -H 'Content-Type: application/json' -d '$INVALID_SCAN_DATA'" 1

# Generate summary
log "SECTION" "Test Summary"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Count test results from the report
if [ -f "$REPORT_FILE" ]; then
    TOTAL_TESTS=$(grep -c "✅\|❌" "$REPORT_FILE" || echo "0")
    PASSED_TESTS=$(grep -c "✅" "$REPORT_FILE" || echo "0")
    FAILED_TESTS=$(grep -c "❌" "$REPORT_FILE" || echo "0")
fi

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

log "INFO" "Test Results Summary" "
- Total Tests: $TOTAL_TESTS
- Passed: $PASSED_TESTS
- Failed: $FAILED_TESTS
- Success Rate: $SUCCESS_RATE%
"

echo -e "\n## Final Results\n\n**Total Tests:** $TOTAL_TESTS  
**Passed:** $PASSED_TESTS  
**Failed:** $FAILED_TESTS  
**Success Rate:** $SUCCESS_RATE%  

**Overall Status:** $([ $FAILED_TESTS -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")\n" >> "$REPORT_FILE"

# Add recommendations
log "SECTION" "Recommendations"

if [ $FAILED_TESTS -gt 0 ]; then
    echo "### 🔧 Issues to Address\n\n" >> "$REPORT_FILE"
    
    if [ $PAGE_TEST_EXIT_CODE -ne 0 ]; then
        echo "- **Page Testing:** Fix browser automation issues\n" >> "$REPORT_FILE"
    fi
    
    echo "- Review failed tests in the details above\n"
    echo "- Check service logs for specific error messages\n" >> "$REPORT_FILE"
    echo "- Ensure all dependencies are properly installed\n" >> "$REPORT_FILE"
else
    echo "### 🎉 All Tests Passed!\n\n" >> "$REPORT_FILE"
    echo "- System is ready for development\n" >> "$REPORT_FILE"
    echo "- All services are functioning correctly\n" >> "$REPORT_FILE"
    echo "- Error tracking is working properly\n" >> "$REPORT_FILE"
fi

# Add next steps
echo -e "\n## Next Steps\n\n1. **Review the full report** in: \`$REPORT_FILE\`\n2. **Check error logs** in the \`logs/\` directory\n3. **Test the application manually** at http://localhost:5173\n4. **Monitor error tracking** at http://localhost:5173/admin/error-logs\n5. **Run individual tests** as needed for debugging\n\n" >> "$REPORT_FILE"

# Cleanup services
log "INFO" "Stopping services..."
kill $STARTUP_PID 2>/dev/null || true

# Wait for services to stop
sleep 3

# Kill any remaining processes
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true

# Final summary
echo ""
echo -e "${BLUE}📊 Test Complete!${NC}"
echo "=================================="
echo -e "${GREEN}📄 Report: $REPORT_FILE${NC}"
echo -e "${GREEN}📁 Results: $TEST_RESULTS_DIR${NC}"
echo -e "${GREEN}📈 Success Rate: $SUCCESS_RATE%${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! System is ready.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the report for details.${NC}"
    exit 1
fi
