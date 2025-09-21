# Contributing to AI-Driven Natural Disaster Alert System

Thank you for your interest in contributing to this project! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Documentation](#documentation)

## 🤝 Code of Conduct

This project follows a code of conduct that we expect all contributors to adhere to:

- **Be respectful** and inclusive in all interactions
- **Be constructive** in feedback and discussions
- **Be patient** with newcomers and different skill levels
- **Be collaborative** and help others learn and grow
- **Be professional** in all communications

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or later
- AWS CLI configured
- Git
- VS Code (recommended) or your preferred editor

### Setup Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/HackathonAWS.git
   cd HackathonAWS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run tests to verify setup**
   ```bash
   npm test
   ```

## 🔄 Development Workflow

### Branch Strategy

We use a **feature branch** workflow:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development branches
- `hotfix/*` - Critical bug fixes
- `docs/*` - Documentation updates

### Creating a Feature Branch

```bash
# Start from develop branch
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/your-feature-name

# Example: feature/add-weather-integration
# Example: feature/improve-error-handling
# Example: feature/add-unit-tests
```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

#### Examples:
```bash
feat(api): add weather data integration
fix(processing): resolve memory leak in image analysis
docs(readme): update installation instructions
test(handlers): add unit tests for processTweet
refactor(shared): extract common validation logic
```

## 📝 Coding Standards

### TypeScript Guidelines

- **Use TypeScript** for all new code
- **Strict mode** enabled - no `any` types without justification
- **Interface over type** for object shapes
- **Explicit return types** for public functions
- **JSDoc comments** for public APIs

```typescript
/**
 * Processes a social media post for disaster detection
 * @param post - The social media post to process
 * @returns Promise resolving to processed event data
 */
export async function processSocialMediaPost(
  post: SocialMediaPost
): Promise<ProcessedEvent> {
  // Implementation
}
```

### Code Style

- **Prettier** for code formatting
- **ESLint** for code quality
- **2 spaces** for indentation
- **Single quotes** for strings
- **Trailing commas** in objects and arrays
- **Semicolons** required

### File Organization

```
services/processing/src/
├── handlers/           # Lambda function handlers
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
├── constants/         # Application constants
└── __tests__/         # Test files
```

### Naming Conventions

- **camelCase** for variables and functions
- **PascalCase** for classes and interfaces
- **UPPER_SNAKE_CASE** for constants
- **kebab-case** for file names
- **Descriptive names** - avoid abbreviations

```typescript
// Good
const disasterEventProcessor = new DisasterEventProcessor();
const MAX_RETRY_ATTEMPTS = 3;

// Avoid
const dep = new DEP();
const maxRetry = 3;
```

## 🧪 Testing Guidelines

### Test Structure

- **Unit tests** for individual functions
- **Integration tests** for API endpoints
- **End-to-end tests** for critical workflows
- **Test coverage** minimum 80%

### Writing Tests

```typescript
// __tests__/handlers/processTweet.test.ts
import { handler } from '../processTweet';
import { mockEvent, mockContext } from '../../test-utils';

describe('processTweet handler', () => {
  beforeEach(() => {
    // Setup mocks
  });

  it('should process valid tweet successfully', async () => {
    // Arrange
    const event = mockEvent({ text: 'Flood in downtown area' });
    
    // Act
    const result = await handler(event, mockContext);
    
    // Assert
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('disaster');
  });

  it('should handle invalid input gracefully', async () => {
    // Test error handling
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- processTweet.test.ts
```

### Test Data

- Use **factory functions** for creating test data
- **Mock external services** (AWS, APIs)
- **Clean up** after each test
- **Isolate tests** - no shared state

## 🔀 Pull Request Process

### Before Submitting

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Run all tests** and ensure they pass
4. **Check code coverage** meets requirements
5. **Update CHANGELOG.md** if applicable

### PR Checklist

- [ ] Code follows project coding standards
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No console.log statements in production code
- [ ] No hardcoded credentials or sensitive data
- [ ] PR description explains changes clearly
- [ ] Linked to relevant issues

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Related Issues
Closes #123
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by at least one maintainer
3. **Address feedback** promptly
4. **Squash commits** if requested
5. **Merge** after approval

## 🐛 Issue Reporting

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for solutions
3. **Verify** the issue exists in the latest version

### Issue Template

```markdown
## Bug Report / Feature Request

### Description
Clear description of the issue or feature request

### Steps to Reproduce (for bugs)
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

### Expected Behavior
What you expected to happen

### Actual Behavior
What actually happened

### Environment
- OS: [e.g., Windows 10, macOS 12]
- Node.js version: [e.g., 20.5.0]
- AWS CLI version: [e.g., 2.0.0]

### Additional Context
Any other relevant information
```

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `priority: high` - Urgent issues
- `priority: low` - Nice to have

## 📚 Documentation

### Documentation Standards

- **Clear and concise** language
- **Code examples** where helpful
- **Keep up to date** with code changes
- **Use markdown** formatting
- **Include diagrams** for complex concepts

### Documentation Types

- **README.md** - Project overview and setup
- **API documentation** - Endpoint specifications
- **Architecture docs** - System design
- **Deployment guides** - Setup instructions
- **Troubleshooting** - Common issues and solutions

### Updating Documentation

1. **Update relevant files** when making changes
2. **Test documentation** by following it yourself
3. **Use clear headings** and structure
4. **Include examples** and code snippets
5. **Review for accuracy** before submitting

## 🏷️ Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- `MAJOR` - Breaking changes
- `MINOR` - New features (backward compatible)
- `PATCH` - Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Release notes prepared
- [ ] Tagged in git

## 🆘 Getting Help

### Resources

- **Documentation** - Check the docs/ folder
- **Issues** - Search existing issues
- **Discussions** - Use GitHub Discussions for questions
- **Code review** - Ask for help in PR comments

### Contact

- **Maintainers** - @maintainer-username
- **Discord/Slack** - [Link to community channel]
- **Email** - [Contact email]

## 🙏 Recognition

Contributors will be recognized in:
- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **GitHub contributors** page

Thank you for contributing to making disaster detection more accessible and effective! 🚨✨
