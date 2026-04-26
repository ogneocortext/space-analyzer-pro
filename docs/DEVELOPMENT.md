# 🔧 Development Documentation

## 📋 Overview

This document provides comprehensive guidelines for developing the refactored Space Analyzer with its **modular architecture**, **ML-powered capabilities**, and **self-learning features**.

---

## 🎯 Development Environment Setup

### **Prerequisites:**
- **Node.js** 18+ for frontend and backend development
- **Python** 3.9+ for ML services development
- **Docker** for containerization and testing
- **Git** for version control
- **VS Code** or similar IDE (recommended)

### **Required Tools:**
- **Node.js**: JavaScript runtime
- **npm**: Package manager
- **Python**: ML services runtime
- **pip**: Python package manager
- **Docker**: Containerization platform
- **Kubernetes** (optional): Container orchestration

---

## 🏗️ Project Structure

### **Repository Structure:**
```
space-analyzer/
├── docs/                    # Documentation
├── frontend/               # Frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ThreeDVisualization/
│   │   │   └── [Other Components...]
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── backend/                # Backend application
│   ├── src/
│   │   ├── services/
│   │   │   ├── DependencyVisualizationService/
│   │   │   ├── CustomWorkflowService/
│   │   │   └── [Other Services...]
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── utils/
│   │   └── types/
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── ml-services/            # ML services
│   ├── src/
│   │   ├── models/
│   │   ├── training/
│   │   ├── inference/
│   │   └── utils/
│   ├── tests/
│   ├── requirements.txt
│   └── setup.py
├── tests/                  # Integration tests
├── docker/                 # Docker configurations
├── k8s/                    # Kubernetes configurations
├── scripts/                # Build and deployment scripts
├── .github/               # GitHub Actions workflows
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 🔧 Development Setup

### **1. Clone the Repository:**
```bash
git clone https://github.com/your-org/space-analyzer.git
cd space-analyzer
```

### **2. Install Frontend Dependencies:**
```bash
cd frontend
npm install
```

### **3. Install Backend Dependencies:**
```bash
cd backend
npm install
```

### **4. Install ML Services Dependencies:**
```bash
cd ml-services
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### **5. Set Up Development Environment:**
```bash
# Copy environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp ml-services/.env.example ml-services/.env

# Edit environment variables as needed
```

---

## 🚀 Running the Application

### **Development Mode:**

#### **Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will be available at http://localhost:3000

#### **Backend:**
```bash
cd backend
npm run dev
```
Backend API will be available at http://localhost:3001

#### **ML Services:**
```bash
cd ml-services
source venv/bin/activate  # On Windows: venv\Scripts\activate
python app.py
```
ML Services API will be available at http://localhost:8000

### **Production Mode:**
```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd backend
npm run build

# Run backend in production
npm start
```

---

## 🧪 Testing

### **Testing Strategy:**
- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete workflows
- **ML Tests**: Test ML models and predictions

### **Frontend Testing:**
```bash
cd frontend
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:integration    # Run integration tests
npm run test:e2e           # Run end-to-end tests
npm run test:coverage      # Run tests with coverage
```

### **Backend Testing:**
```bash
cd backend
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:integration    # Run integration tests
npm run test:e2e           # Run end-to-end tests
npm run test:coverage      # Run tests with coverage
```

### **ML Services Testing:**
```bash
cd ml-services
source venv/bin/activate  # On Windows: venv\Scripts\activate
python -m pytest tests/     # Run all tests
python -m pytest tests/unit/  # Run unit tests only
python -m pytest tests/integration/  # Run integration tests
python -m pytest tests/ml/  # Run ML tests only
```

---

## 📝 Code Style

### **Frontend Code Style:**
- **TypeScript**: Strong typing for better code quality
- **ESLint**: Consistent code formatting and linting
- **Prettier**: Code formatting and style
- **Husky**: Git hooks for code quality

### **ESLint Configuration:**
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

### **Prettier Configuration:**
```json
{
  "semi": true,
  "trailingComma": true,
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### **Backend Code Style:**
- **TypeScript**: Strong typing for better code quality
- **ESLint**: Consistent code formatting and linting
- **Prettier**: Code formatting and style
- **Husky**: Git hooks for code quality

### **Python Code Style:**
- **Black**: Code formatting
- **Flake8**: Code linting
- **isort**: Import sorting
- **mypy**: Type checking

### **Python Configuration:**
```toml
[tool.black]
line-length = 88
target-version = ['py39']

[tool.flake8]
max-line-length = 88
extend-ignore = ["E203", "W503"]

[tool.isort]
profile = "black"

[tool.mypy]
python_version = "3.9"
warn_return_any = true
warn_unused_configs = true
```

---

## 🔧 Component Development

### **Frontend Component Development:**
```typescript
// Example: Creating a new component
import React from 'react';
import { ComponentProps } from './types';

interface NewComponentProps extends ComponentProps {
  title: string;
  data: any[];
  onAction?: (data: any) => void;
}

export const NewComponent: React.FC<NewComponentProps> = ({
  title,
  data,
  onAction
}) => {
  return (
    <div className="new-component">
      <h2>{title}</h2>
      {/* Component implementation */}
    </div>
  );
};

export default NewComponent;
```

### **Backend Service Development:**
```typescript
// Example: Creating a new service
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

@Injectable()
export class NewService {
  constructor(
    private repository: Repository<any>
  ) {}

  async findAll(): Promise<any[]> {
    return this.repository.find();
  }

  async create(data: any): Promise<any> {
    return this.repository.save(data);
  }
}
```

### **ML Model Development:**
```python
# Example: Creating a new ML model
import numpy as np
from sklearn.base import BaseEstimator

class NewModel(BaseEstimator):
    def __init__(self, hyperparameters=None):
        self.hyperparameters = hyperparameters or {}
        self.model = None

    def fit(self, X, y):
        # Model training logic
        self.model = self._build_model(X.shape[1])
        self.model.fit(X, y)
        return self

    def predict(self, X):
        # Prediction logic
        return self.model.predict(X)

    def _build_model(self, input_shape):
        # Model architecture
        return Sequential([
            Dense(64, activation='relu', input_shape=input_shape),
            Dense(32, activation='relu'),
            Dense(1, activation='sigmoid')
        ])
```

---

## 🔄 Git Workflow

### **Branch Strategy:**
- **main**: Production-ready code
- **develop**: Development branch
- **feature/**: Feature branches
- **hotfix/**: Hotfix branches

### **Commit Convention:**
```
type(scope): description

Examples:
feat(components): add new visualization component
fix(api): fix authentication bug
docs(readme): update documentation
test(e2e): add end-to-end tests
```

### **Git Hooks:**
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm test",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

---

## 🐳 Docker Development

### **Development Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### **Multi-stage Dockerfile:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### **Docker Compose:**
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./frontend:/app
      - /app/node_modules

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: space_analyzer
      POSTGRES_USER: space_analyzer
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 🔧 Debugging

### **Frontend Debugging:**
```typescript
// Debug configuration in package.json
{
  "scripts": {
    "dev": "react-scripts start",
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### **Backend Debugging:**
```typescript
// Debug configuration in package.json
{
  "scripts": {
    "dev": "nest start --debug",
    "start": "nest start",
    "build": "nest build",
    "test": "nest test",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

### **ML Services Debugging:**
```python
# Debug configuration in app.py
import debug
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.route('/debug')
def debug_endpoint():
    logger.debug("Debug endpoint called")
    return {"status": "debug"}
```

---

## 📊 Performance Monitoring

### **Frontend Performance:**
- **React DevTools**: Browser developer tools
- **Lighthouse**: Performance auditing
- **Bundle Analyzer**: Bundle size analysis
- **React Profiler**: Component performance profiling

### **Backend Performance:**
- **NestJS Profiler**: Application profiling
- **Database Query Analyzer**: Query performance analysis
- **Memory Profiling**: Memory usage analysis
- **API Performance**: API response time monitoring

### **ML Services Performance:**
- **Model Profiling**: ML model performance analysis
- **Inference Time**: Prediction latency monitoring
- **Training Time**: Training time monitoring
- **Resource Usage**: CPU and memory usage monitoring

---

## 🔒 Security

### **Frontend Security:**
- **Input Validation**: Validate all user inputs
- **XSS Prevention**: Prevent cross-site scripting
- **CSRF Protection**: Prevent cross-site request forgery
- **Content Security Policy**: Content security policy headers

### **Backend Security:**
- **Authentication**: Secure user authentication
- **Authorization**: Role-based access control
- **Input Validation**: Validate all inputs
- **SQL Injection Prevention**: Prevent SQL injection attacks

### **ML Services Security:**
- **Model Security**: Secure ML models and data
- **Data Privacy**: Protect sensitive data
- **Access Control**: Control access to ML models
- **Audit Logging**: Log all ML model access

---

## 📚 Documentation

### **Documentation Guidelines:**
- **Code Comments**: Add meaningful comments to code
- **API Documentation**: Document all API endpoints
- **Component Documentation**: Document all components
- **ML Model Documentation**: Document ML models and their usage

### **Documentation Tools:**
- **TypeDoc**: TypeScript documentation
- **Sphinx**: Python documentation
- **Swagger**: API documentation
- **JSDoc**: JavaScript documentation

---

## 🧪 Testing Guidelines

### **Unit Testing:**
- **Test Coverage**: Aim for 80%+ coverage
- **Test Structure**: Organize tests logically
- **Test Data**: Use realistic test data
- **Test Assertions**: Use meaningful assertions

### **Integration Testing:**
- **API Testing**: Test all API endpoints
- **Database Testing**: Test database operations
- **Service Testing**: Test service interactions
- **Component Testing**: Test component integration

### **End-to-End Testing:**
- **User Workflows**: Test complete user workflows
- **Browser Testing**: Test in multiple browsers
- **Mobile Testing**: Test on mobile devices
- **Performance Testing**: Test performance under load

---

## 🔄 Continuous Integration

### **GitHub Actions:**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run linting
        run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build application
        run: npm run build
      - name: Build Docker images
        run: docker build -t space-analyzer:latest .

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: kubectl apply -f k8s/
```

---

## 🎯 Development Best Practices

### **Code Quality:**
- **Type Safety**: Use TypeScript for type safety
- **Code Reviews**: Peer review all code changes
- **Static Analysis**: Use static analysis tools
- **Code Coverage**: Maintain high test coverage

### **Performance:**
- **Lazy Loading**: Load components on-demand
- **Caching**: Implement intelligent caching
- **Optimization**: Optimize for performance
- **Monitoring**: Monitor performance metrics

### **Security:**
- **Input Validation**: Validate all inputs
- **Authentication**: Secure authentication
- **Authorization**: Implement proper authorization
- **Audit Logging**: Log all security events

---

## 🚀 Deployment Guidelines

### **Development Deployment:**
- **Local Development**: Use Docker Compose
- **Staging**: Deploy to staging environment
- **Production**: Deploy to production environment
- **Rollback**: Implement rollback procedures

### **Environment Management:**
- **Configuration**: Use environment variables
- **Secrets**: Use secrets management
- **Monitoring**: Monitor deployment health
- **Logging**: Implement comprehensive logging

---

## 🎯 Troubleshooting

### **Common Issues:**
- **Build Failures**: Check dependencies and configurations
- **Test Failures**: Check test setup and data
- **Runtime Errors**: Check logs and error messages
- **Performance Issues**: Profile and optimize

### **Debugging Tools:**
- **Browser DevTools**: Frontend debugging
- **Node.js Debugger**: Backend debugging
- **Python Debugger**: ML services debugging
- **Docker Logs**: Container debugging

---

## 📚 Resources

### **Documentation:**
- [Architecture Documentation](./ARCHITECTURE.md)
- [Component Documentation](./COMPONENTS.md)
- [ML Integration Documentation](./ML_INTEGRATION.md)
- [Deployment Documentation](./DEPLOYMENT.md)

### **Tools:**
- [TypeScript](https://www.typescriptlang.org/)
- [React](https://reactjs.org/)
- [NestJS](https://nestjs.com/)
- [Python](https://www.python.org/)
- [Docker](https://www.docker.com/)
- [Kubernetes](https://kubernetes.io/)

### **Learning Resources:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://reactjs.org/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Python Documentation](https://docs.python.org/3/)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

---

## 🎯 Conclusion

This development guide provides comprehensive guidelines for developing the refactored Space Analyzer. Following these guidelines will ensure **high-quality code**, **consistent development practices**, and **smooth collaboration**.

The **modular architecture** makes it easy to develop, test, and maintain individual components, while the **ML integration** provides **intelligent insights** and **automated recommendations**.

Whether you're a **new developer** joining the team or an **experienced developer** looking to contribute, this guide provides all the information you need to get started and be productive.

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](../CONTRIBUTING.md) for more information on how to contribute to the Space Analyzer.

---

## 📞 Support

If you have any questions or need help with development, please don't hesitate to reach out to our community:

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Join community discussions
- **Email**: Contact the development team

---

## 🎉 Happy Coding!

Thank you for contributing to the Space Analyzer! We're excited to see what you'll build with our **powerful code analysis and refactoring tool**.

**Happy coding and happy refactoring!** 🚀