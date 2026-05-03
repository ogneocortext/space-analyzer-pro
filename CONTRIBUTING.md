# Contributing to Space Analyzer Pro

Thank you for your interest in contributing to Space Analyzer Pro! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork locally**
3. **Install dependencies**
4. **Create a feature branch**
5. **Make your changes**
6. **Test your changes**
7. **Submit a pull request**

## 📋 Prerequisites

- **Node.js 18+** - Required for the frontend and backend
- **npm 9+** - Package manager
- **Python 3.8+** - For the AI service (optional)
- **Rust 1.70+** - For the native scanner (optional)
- **Git** - Version control

## 🛠️ Development Setup

### 1. Clone and Install

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/space-analyzer-pro.git
cd space-analyzer-pro

# Install Node.js dependencies
npm install

# Install Python AI service dependencies (optional)
cd ai-service
pip install -r requirements.txt
cd ..

# Build native scanner (optional)
cd native/scanner
cargo build --release
cd ../..
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Default values work for local development
```

### 3. Start Development

```bash
# Start frontend dev server
npm run dev

# Start backend server (in another terminal)
npm run server

# Start Python AI service (in another terminal, optional)
npm run ai:start
```

## 🏗️ Project Structure

```
space-analyzer-pro/
├── src/                    # Vue 3 frontend source
│   ├── components/         # Vue components
│   ├── views/             # Page views
│   ├── services/          # API services
│   └── stores/            # Pinia stores
├── server/                # Node.js backend
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   └── services/         # Backend services
├── ai-service/            # Python ML service
│   ├── main.py           # FastAPI application
│   ├── models/           # ML model files
│   └── requirements.txt  # Python dependencies
├── native/scanner/        # Rust native scanner
└── docs/                 # Documentation
```

## 🎯 How to Contribute

### Bug Reports

1. **Search existing issues** - Check if the bug is already reported
2. **Create a new issue** - Use the bug report template
3. **Provide details**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment information
   - Screenshots if applicable

### Feature Requests

1. **Check roadmap** - See if the feature is planned
2. **Create an issue** - Describe the feature and use case
3. **Discuss implementation** - Get feedback before coding

### Code Contributions

1. **Choose an issue** - Pick a good first issue or create one
2. **Create a branch** - Use descriptive branch names
3. **Follow coding standards** - See below
4. **Test thoroughly** - Ensure your changes work
5. **Submit PR** - Include tests and documentation

## 📝 Coding Standards

### JavaScript/TypeScript

- **Use TypeScript** - All new code should be typed
- **Follow ESLint rules** - Run `npm run lint` to check
- **Use Prettier** - Run `npm run lint:fix` to format
- **Vue 3 Composition API** - Prefer over Options API
- **Descriptive names** - Use clear variable and function names

### Python (AI Service)

- **PEP 8 compliant** - Follow Python style guide
- **Type hints** - Add type annotations
- **Docstrings** - Document functions and classes
- **Error handling** - Handle exceptions gracefully

### Rust (Native Scanner)

- **rustfmt** - Format code with rustfmt
- **Clippy** - Run clippy for linting
- **Documentation** - Add comments for complex logic
- **Safety** - Prefer safe Rust over unsafe

## 🧪 Testing

### Frontend Tests

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### Backend Tests

```bash
# Run backend tests
cd server
npm test
```

### Python AI Service Tests

```bash
# Run AI service tests
cd ai-service
python test_api.py
```

## 📊 Performance Guidelines

- **Lazy loading** - Load components and routes as needed
- **Virtual scrolling** - For large file lists
- **Caching** - Use appropriate caching strategies
- **Memory management** - Clean up resources properly
- **Async operations** - Use async/await for I/O operations

## 🎨 UI/UX Guidelines

- **Responsive design** - Support different screen sizes
- **Accessibility** - Follow WCAG guidelines
- **Consistent styling** - Use Tailwind CSS classes
- **Loading states** - Show progress indicators
- **Error handling** - Display user-friendly error messages

## 🚀 Submitting Changes

### 1. Pull Request Process

1. **Update documentation** - README, comments, etc.
2. **Add tests** - Cover new functionality
3. **Run linting** - `npm run lint`
4. **Run tests** - `npm run test`
5. **Commit changes** - Use conventional commit messages
6. **Push branch** - Push to your fork
7. **Create PR** - Fill out the PR template

### 2. Commit Message Format

```
type(scope): description

feat(ui): add file categorization badges
fix(scanner): handle empty directories correctly
docs(readme): update installation instructions
test(ai): add unit tests for categorization
```

### 3. PR Template

- **Description** - What changes were made
- **Testing** - How changes were tested
- **Screenshots** - For UI changes
- **Breaking changes** - Any breaking changes
- **Dependencies** - New dependencies added

## 🏷️ Labels and Milestones

- **bug** - Bug fixes
- **enhancement** - New features
- **documentation** - Documentation updates
- **performance** - Performance improvements
- **ai/ml** - AI/ML related changes
- **ui** - UI changes
- **backend** - Backend changes
- **good first issue** - Suitable for newcomers

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** - Treat everyone with respect
- **Be inclusive** - Welcome all contributors
- **Be constructive** - Provide helpful feedback
- **Be patient** - Help others learn and grow

### Getting Help

- **GitHub Issues** - For bugs and feature requests
- **Discussions** - For general questions and ideas
- **Documentation** - Check existing docs first

## 📚 Resources

- [Vue 3 Documentation](https://vuejs.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/)
- [Node.js Documentation](https://nodejs.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Tailwind CSS](https://tailwindcss.com/)

## 🎉 Recognition

Contributors will be recognized in:
- **README.md** - Contributors section
- **CHANGELOG.md** - Feature credits
- **Release notes** - Major contributions

## 📞 Contact

- **Maintainer**: ogneocortext
- **Email**: [GitHub email]
- **Issues**: [GitHub Issues]

---

Thank you for contributing to Space Analyzer Pro! 🚀
