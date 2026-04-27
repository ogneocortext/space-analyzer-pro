# Contributing to Space Analyzer

Thank you for your interest in contributing to Space Analyzer! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/space-analyzer-pro.git
   cd space-analyzer-pro
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
5. Configure your environment variables in `.env`
6. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```

2. Make your changes following the coding standards

3. Test your changes thoroughly

4. Commit your changes following the commit guidelines

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a pull request

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for new code
- Follow existing code style
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Keep functions small and focused

### Vue Components

- Use Composition API
- Follow the existing component structure
- Use TypeScript for props and emits
- Add proper type definitions

### CSS/Styling

- Use Tailwind CSS for styling
- Follow the existing design system
- Keep styles component-specific
- Use utility classes when possible

## Commit Guidelines

### Commit Message Format

Follow the conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```
feat(scanner): add support for nested directory scanning

fix(ui): resolve memory leak in treemap component

docs(readme): update installation instructions
```

## Pull Request Process

1. Ensure your code follows the coding standards
2. Update documentation if needed
3. Add tests for new features
4. Ensure all tests pass
5. Update the CHANGELOG.md
6. Submit a pull request with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots for UI changes (if applicable)

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Commit messages follow guidelines
- [ ] No merge conflicts

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.spec.ts

# Run tests in watch mode
npm test -- --watch
```

### Writing Tests

- Write tests for new features
- Maintain test coverage above 80%
- Use descriptive test names
- Test edge cases and error conditions

## Documentation

### Code Documentation

- Add JSDoc comments for complex functions
- Document component props and events
- Explain non-obvious logic

### Project Documentation

- Update README.md for user-facing changes
- Update docs/ for developer-facing changes
- Keep documentation in sync with code changes

## Questions?

If you have questions about contributing, please:
- Open an issue with your question
- Check existing documentation
- Review previous pull requests for examples

## License

By contributing to Space Analyzer, you agree that your contributions will be licensed under the same license as the project.
