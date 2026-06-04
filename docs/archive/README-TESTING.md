# Space Analyzer Pro - Testing & Error Tracking Guide

## 🚀 Quick Start

### 1. Start All Services
```bash
# Linux/macOS
./scripts/start-all-services.sh

# Windows (PowerShell)
.\scripts\start-all-services.ps1
```

### 2. Run Full System Test
```bash
# Linux/macOS
./scripts/run-full-system-test.sh

# Windows (PowerShell)
.\scripts\run-full-system-test.ps1
```

### 3. Access Services
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **AI Service**: http://localhost:5000
- **Error Logs**: http://localhost:5173/admin/error-logs

## 📊 Testing Components

### 🔧 Service Startup Script
**File**: `scripts/start-all-services.sh`

**Features**:
- ✅ Starts all services in correct order
- ✅ Health checks for each service
- ✅ Port conflict detection
- ✅ Dependency verification
- ✅ Automatic cleanup on exit
- ✅ Real-time service monitoring
- ✅ Log file management

**Usage**:
```bash
./scripts/start-all-services.sh
```

### 🧪 Page Testing System
**File**: `scripts/test-all-pages.js`

**Features**:
- ✅ Automated browser testing with Playwright
- ✅ Tests all major pages (Home, Scanner, Dashboard, Browser, Treemap, Reports, Settings)
- ✅ Console error detection
- ✅ Element presence validation
- ✅ Functionality testing
- ✅ Performance monitoring
- ✅ Detailed error reporting

**Usage**:
```bash
# Install Playwright first
npx playwright install chromium

# Run page tests
node scripts/test-all-pages.js
```

### 📋 Error Tracking System
**File**: `src/utils/errorTracker.ts`

**Features**:
- ✅ Global error handling (uncaught exceptions, promise rejections)
- ✅ Network request monitoring
- ✅ API error tracking
- ✅ Component-specific error tracking
- ✅ Performance error detection
- ✅ Real-time error reporting
- ✅ Error categorization and severity levels
- ✅ Duplicate error detection
- ✅ Local storage persistence
- ✅ Export functionality

**Error Types**:
- JavaScript errors
- Network errors
- API errors
- Component errors
- Routing errors
- Storage errors
- Permission errors
- Validation errors
- Performance errors

**Severity Levels**:
- Low: Minor issues, validation errors
- Medium: API errors, component failures
- High: Network errors, permission issues
- Critical: Security issues, system failures

### 📊 Enhanced Error Log Viewer
**File**: `src/views/admin/ErrorLogView.vue`

**Features**:
- ✅ Real-time error monitoring
- ✅ Advanced filtering (source, type, severity, search)
- ✅ Auto-refresh capability
- ✅ Error categorization
- ✅ Detailed error information
- ✅ Stack trace visualization
- ✅ Export functionality
- ✅ Error resolution tracking
- ✅ Statistics and trends

**Filtering Options**:
- Source: frontend, backend, ai-service, system, user
- Type: javascript, network, api, component, routing, storage, permission, validation, performance
- Severity: low, medium, high, critical
- Search: message, component, action, URL

### 🔍 Full System Testing
**File**: `scripts/run-full-system-test.sh`

**Features**:
- ✅ Dependency verification
- ✅ Service health checks
- ✅ Page testing integration
- ✅ API endpoint testing
- ✅ Integration testing
- ✅ Performance testing
- ✅ Error handling testing
- ✅ Basic security testing
- ✅ Data validation testing
- ✅ Comprehensive reporting
- ✅ Markdown report generation

**Test Categories**:
1. **Dependency Check**: Node.js, npm, Python, curl
2. **Service Health**: Backend, Frontend, AI Service
3. **Page Testing**: All pages with Playwright
4. **API Testing**: All endpoints
5. **Integration Testing**: Cross-service communication
6. **Performance Testing**: Response times
7. **Error Handling**: 404s, malformed requests
8. **Security Testing**: Basic security checks
9. **Data Validation**: Valid/invalid data handling

## 📈 Error Tracking Integration

### Frontend Integration
```typescript
import { useErrorTracker } from '@/utils/errorTracker';

const { trackError, trackComponentError, trackApiError } = useErrorTracker();

// Track general errors
trackError({
  message: 'Something went wrong',
  type: ErrorType.JAVASCRIPT,
  severity: ErrorSeverity.MEDIUM
});

// Track component errors
trackComponentError('MyComponent', error, 'onClick');

// Track API errors
trackApiError('/api/scan', 500, 'Internal Server Error', 'POST');
```

### Automatic Error Tracking
The system automatically captures:
- Uncaught JavaScript errors
- Unhandled promise rejections
- Network request failures
- API HTTP errors
- Performance issues

### Error Reporting
Errors are automatically:
- Logged to local storage
- Sent to backend endpoint (`/api/errors/report`)
- Categorized by type and severity
- Deduplicated and counted
- Made available in the error log viewer

## 🔧 Configuration

### Environment Variables
```bash
# Service ports
FRONTEND_PORT=5173
BACKEND_PORT=8080
AI_SERVICE_PORT=5000

# Error tracking
ERROR_TRACKING_ENABLED=true
MAX_STORED_ERRORS=1000
ERROR_REPORT_ENDPOINT=/api/errors/report
```

### Error Tracker Settings
```typescript
// Enable/disable tracking
errorTracker.setTracking(true);

// Set user ID for tracking
errorTracker.setUserId('user-123');

// Export all errors
const exportData = errorTracker.exportErrors();
```

## 📊 Test Results

### Report Location
Test reports are generated in:
```
test-results/system-test-report-YYYYMMDD_HHMMSS.md
```

### Report Contents
- Test summary with pass/fail counts
- Detailed test results
- Performance metrics
- Error logs
- Recommendations
- Next steps

### Sample Test Output
```
🚀 Space Analyzer Pro - Complete System Test
==================================================
Timestamp: 2026-05-03 12:30:00
Test ID: 20260503_123000

✅ All dependencies are available
✅ All services are healthy
✅ Page Tests passed
✅ API Tests passed
✅ Integration Tests passed
✅ Performance Tests passed
✅ Error Handling Tests passed
✅ Security Tests passed
✅ Data Validation Tests passed

📊 Test Complete!
==================================
📄 Report: test-results/system-test-report-20260503_123000.md
📁 Results: test-results/
📈 Success Rate: 100%
🎉 All tests passed! System is ready.
```

## 🛠️ Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill processes using ports
lsof -ti:5173,8080,5000 | xargs kill -9

# Or use different ports
FRONTEND_PORT=5174 ./scripts/start-all-services.sh
```

**Playwright Not Installed**
```bash
npx playwright install chromium --with-deps
```

**Python Dependencies Missing**
```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Permission Denied (Linux/macOS)**
```bash
chmod +x scripts/*.sh
```

### Debug Mode
For detailed debugging, enable debug logging:
```bash
DEBUG=true ./scripts/run-full-system-test.sh
```

### Manual Testing
If automated tests fail, test manually:
1. Start services: `./scripts/start-all-services.sh`
2. Open browser: http://localhost:5173
3. Test each page manually
4. Check error logs: http://localhost:5173/admin/error-logs
5. Monitor console errors in browser dev tools

## 📝 Development Workflow

### Daily Development
1. Start services: `./scripts/start-all-services.sh`
2. Run tests: `./scripts/run-full-system-test.sh`
3. Check error logs regularly
4. Fix any issues found

### Before Committing
1. Run full system test
2. Review test report
3. Fix any failing tests
4. Check error log viewer for new issues

### Production Deployment
1. Run comprehensive tests
2. Verify all services healthy
3. Check error tracking is working
4. Monitor error reports after deployment

## 🎯 Best Practices

### Error Handling
- Use the error tracker for all error scenarios
- Provide meaningful error messages
- Include context information
- Set appropriate severity levels

### Testing
- Run tests before committing changes
- Test both happy path and error scenarios
- Verify error tracking captures issues
- Monitor performance impact

### Monitoring
- Check error logs regularly
- Set up alerts for critical errors
- Track error trends over time
- Address recurring issues promptly

## 📞 Support

If you encounter issues:
1. Check the test report for details
2. Review service logs in `logs/` directory
3. Check browser console for errors
4. Verify all dependencies are installed
5. Try running tests individually

For additional help, review the generated test reports and error logs for specific guidance.
