# Playwright E2E Testing Suite

This directory contains the comprehensive end-to-end testing suite for the Space Analyzer application using Playwright.

## 📁 Directory Structure

```
tests/
├── e2e/                          # E2E test files
│   ├── enhanced-app-startup.spec.ts
│   ├── enhanced-user-flow.spec.ts
│   ├── ai-analysis.spec.ts
│   ├── 3d-browser.spec.ts
│   ├── performance-metrics.spec.ts
│   └── ...
├── utils/                        # Test utilities and helpers
│   ├── test-helpers.ts           # Common test helper functions
│   ├── page-objects.ts           # Page object model classes
│   ├── test-assertions.ts        # Custom assertion methods
│   ├── test-fixtures.ts          # Test data fixtures and mocks
│   ├── test-runner.ts            # Test runner utilities
│   ├── test-environment.ts       # Environment management
│   └── logger.ts                 # Test logging utilities
├── fixtures/                     # Test fixtures and data
├── global-setup.ts              # Global test setup
├── global-teardown.ts           # Global test teardown
└── README.md                    # This file
```

## 🚀 Quick Start

### Running Tests

```bash
# Run all tests
npm run test:e2e

# Run specific test categories
npm run test:e2e:smoke
npm run test:e2e:regression
npm run test:e2e:accessibility
npm run test:e2e:performance
npm run test:e2e:mobile
npm run test:e2e:security

# Run tests with specific browser
npm run test:e2e:firefox
npm run test:e2e:webkit

# Run tests in headed mode
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug
```

### Advanced Usage

```bash
# Custom test runner with options
node scripts/run-playwright-tests.js --browser firefox --reporter list --workers 4

# Run tests matching pattern
node scripts/run-playwright-tests.js --grep "smoke" --timeout 60000

# Run tests in debug mode
node scripts/run-playwright-tests.js --debug --test-dir tests/e2e/smoke

# Run tests in shards
node scripts/run-playwright-tests.js --shard "1/3" --project chromium
```

## 🏗️ Test Architecture

### Page Object Model

The test suite uses the Page Object Model pattern for better maintainability:

```typescript
// Example usage
import { LandingPage } from '../utils/page-objects';

test('should load landing page', async ({ page }) => {
  const landingPage = new LandingPage(page);
  await landingPage.navigateTo();
  await landingPage.waitForPageLoad();
  const elements = await landingPage.validatePageElements();
  expect(elements.landingPage).toBe(true);
});
```

### Test Fixtures and Mocks

Comprehensive test data fixtures and API mocking:

```typescript
import { TestEnvironment, TestDataFactory } from '../utils/test-fixtures';

test('should handle API responses', async ({ page }) => {
  await TestEnvironment.setup(page, { mockAPI: true });
  // Test with mocked API responses
});
```

### Custom Assertions

Reusable assertion methods for common test scenarios:

```typescript
import { TestAssertions } from '../utils/test-assertions';

test('should validate page elements', async ({ page }) => {
  await TestAssertions.assertElementVisible(page, '[data-testid="landing-page"]');
  await TestAssertions.assertNoConsoleErrors(page);
  await TestAssertions.assertAccessibilityBasics(page);
});
```

## 📊 Test Categories

### Smoke Tests
- Basic application functionality
- Core user flows
- Critical path testing

### Regression Tests
- Full feature coverage
- Cross-browser compatibility
- End-to-end user journeys

### Accessibility Tests
- WCAG compliance
- Screen reader compatibility
- Keyboard navigation
- ARIA standards

### Performance Tests
- Load time metrics
- Memory usage
- Network performance
- Rendering performance

### Mobile Tests
- Responsive design
- Touch interactions
- Mobile-specific features
- Device compatibility

### Security Tests
- Authentication flows
- Data protection
- Input validation
- Security headers

## 🛠️ Configuration

### Playwright Config

The `playwright.config.ts` file contains comprehensive configuration:

- Multiple browser support (Chrome, Firefox, Safari)
- Mobile and tablet testing
- CI/CD optimization
- Reporting and artifacts
- Performance monitoring

### Environment Management

Test environments are managed through `TestEnvironmentOrchestrator`:

- Development environment
- Test environment
- CI environment
- Mobile/tablet environments

### Test Data Management

Test data is generated using `TestDataFactory`:

- Mock file system data
- Analysis results
- Backend status
- AI models
- User data

## 📈 Reporting

### HTML Reports
Comprehensive HTML reports with:
- Test results and status
- Screenshots and videos
- Error details and stack traces
- Performance metrics

### JSON Reports
Machine-readable reports for CI/CD integration:
- Test results
- Performance data
- Error information
- Coverage metrics

### JUnit Reports
XML reports for test management systems:
- Test case results
- Execution time
- Failure details
- Test statistics

## 🔧 Development

### Adding New Tests

1. Create test file in `tests/e2e/`
2. Use page objects for element interactions
3. Use custom assertions for validations
4. Add proper logging and error handling
5. Include performance and accessibility checks

### Test Structure

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
  });

  test('should do something', async ({ page }) => {
    // Test implementation
  });

  test.afterEach(async ({ page }) => {
    // Cleanup
  });
});
```

### Best Practices

1. **Use Page Objects**: Separate element locators and interactions
2. **Custom Assertions**: Use `TestAssertions` for consistent validations
3. **Test Data**: Use `TestDataFactory` for consistent test data
4. **Error Handling**: Include proper error handling and logging
5. **Performance**: Monitor and assert performance thresholds
6. **Accessibility**: Include accessibility checks in tests
7. **Cleanup**: Ensure proper cleanup after each test

## 🐛 Debugging

### Debug Mode
```bash
npm run test:e2e:debug
```

### Headed Mode
```bash
npm run test:e2e:headed
```

### VS Code Integration
Install Playwright extension for VS Code for better debugging experience.

### Trace Viewer
```bash
npx playwright show-trace test-results/trace.zip
```

## 🚀 CI/CD Integration

### GitHub Actions
The `.github/workflows/playwright-tests.yml` file contains:
- Multi-browser testing
- Parallel execution
- Artifact collection
- Test reporting
- Performance monitoring

### Environment Variables
- `CI`: Set to true in CI environments
- `NODE_ENV`: Set to 'test' for testing
- `TEST_BASE_URL`: Base URL for tests
- `TEST_BACKEND_URL`: Backend URL for tests

## 📝 Test Documentation

### Test Documentation
Each test file includes:
- Test purpose and scope
- Test scenarios covered
- Prerequisites and setup
- Expected outcomes
- Performance requirements

### API Documentation
Test utilities are documented with JSDoc comments for better IDE support.

## 🔍 Test Coverage

### Current Coverage
- ✅ Application startup
- ✅ User authentication
- ✅ File analysis
- ✅ AI features
- ✅ Reporting
- ✅ Navigation
- ✅ Error handling
- ✅ Accessibility
- ✅ Performance
- ✅ Mobile responsiveness

### Planned Coverage
- 🔄 Advanced AI features
- 🔄 3D visualization
- 🔄 Data export
- 🔄 User settings
- 🔄 Integration testing
- 🔄 Load testing

## 🤝 Contributing

When adding new tests:

1. Follow the existing test structure
2. Use page objects and custom assertions
3. Include performance and accessibility checks
4. Add proper documentation
5. Update this README if needed
6. Run tests locally before submitting

## 📞 Support

For test-related issues:
1. Check the test logs
2. Review the Playwright documentation
3. Examine the test configuration
4. Check the application logs
5. Contact the development team

---

**Note**: This test suite is continuously evolving. Check back regularly for updates and improvements.