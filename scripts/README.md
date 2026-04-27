# Scripts

This directory contains utility scripts for the Space Analyzer project.

## Available Scripts

### Service Management

- **start-all.js** - Starts both frontend and backend services concurrently
  ```bash
  npm run start
  ```

- **launch-services.js** - Launches services with configuration options
  ```bash
  npm run launch              # Launch all services
  npm run launch --frontend-only  # Launch only frontend
  npm run launch --backend-only   # Launch only backend
  ```

### Testing

- **direct-vision-test.js** - Tests vision analysis capabilities (placeholder)
  ```bash
  npm run vision-test
  ```

- **test-all-models.js** - Tests all available AI models (placeholder)
  ```bash
  npm run model-test
  ```

- **integrated-ollama-puppeteer-test.cjs** - Tests Ollama integration with Puppeteer (placeholder)
  ```bash
  npm run google-test
  ```

### Port Configuration

- **port-config.js** - Manages port conflicts and configuration
  ```bash
  npm run port:detect   # Detect port conflicts
  npm run port:update   # Update port configuration
  npm run port:status   # Show port status
  npm run port:clear    # Clear port configuration
  ```

## Adding New Scripts

1. Create the script file in this directory
2. Add a corresponding npm script in `package.json`
3. Update this README with documentation
