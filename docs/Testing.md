# Testing Documentation

This document outlines the testing strategy for the Azure SFTP Integration application.

## Overview

The application is tested using Jest, a JavaScript testing framework. The tests are organized into the following categories:

1. **Unit Tests**: Test individual functions and methods in isolation
2. **Integration Tests**: Test the interaction between components
3. **API Tests**: Test the REST API endpoints

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode (for development)

```bash
npm run test:watch
```

### Generate test coverage report

```bash
npm run test:coverage
```

The coverage report will be generated in the `coverage/` directory.

## Test Structure

The tests are organized into the following structure:

```
tests/
├── setup.js                 # Global test setup
├── api.test.js              # Tests for API endpoints
├── sftpService.test.js      # Tests for SFTP service
├── orchestrationService.test.js  # Tests for orchestration service
└── databaseService.test.js  # Tests for database service
```

## Mocking

The tests use Jest's mocking capabilities to isolate components:

- External dependencies like Azure services and SQL are mocked
- Services are mocked when testing other services that depend on them
- Config values are mocked to provide consistent test environments

## Environment

Tests run in a dedicated test environment defined in `config/test.json`. This ensures tests don't affect production or development environments.

## CI/CD Integration

The tests are integrated into the CI/CD pipeline. A GitHub Actions workflow runs the tests on every push and pull request.

## Adding New Tests

When adding new features or fixing bugs, follow these guidelines:

1. Create a new test file in the `tests/` directory if needed
2. Use descriptive test names that explain what's being tested
3. Group related tests using `describe` blocks
4. Mock external dependencies
5. Keep test isolation by clearing mocks between tests

## Code Coverage Targets

- Aim for at least 80% code coverage overall
- Critical components should have close to 100% coverage
- Infrastructure code (Bicep, deployment scripts) is excluded from coverage requirements
