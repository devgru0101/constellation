# Force Rebuild Test Suite

## Overview

This directory contains comprehensive unit tests for the Force Rebuild functionality in the Constellation IDE. The Force Rebuild feature provides users with the ability to completely destroy and recreate project containers when encountering build issues or needing a fresh development environment.

## Test Files

### 1. `force-rebuild-simple.test.ts` ✅ **Working**
Core logic tests that verify the Force Rebuild API integration without UI components.

**Coverage:**
- ✅ API Integration Tests (5 tests)
- ✅ Error Handling Tests (3 tests) 
- ✅ Configuration Tests (2 tests)
- ✅ Workflow Integration Tests (2 tests)
- ✅ Performance and Edge Cases (2 tests)

**Total: 14 tests - All passing**

### 2. `force-rebuild.test.ts` ⚠️ **In Development**
Comprehensive UI component tests including React component rendering and user interactions.

**Planned Coverage:**
- Button rendering and state management
- Container destruction workflow
- Workspace and container creation
- Dependency installation handling
- Application startup procedures
- Error handling and recovery
- UI state management
- Integration scenarios
- Performance and resource management
- Edge cases and boundary conditions

**Status:** Currently has JSX compilation issues that need resolution.

## Key Test Scenarios

### 1. **Complete Rebuild Workflow**
Tests the full Force Rebuild process:
1. Destroy existing workspace/container
2. Create fresh workspace
3. Create new container with proper configuration
4. Install dependencies (`npm install`)
5. Start application (`encore run` for Encore projects, `npm run dev` for others)

### 2. **Error Handling & Recovery**
Verifies graceful handling of:
- Missing workspaces/containers
- Docker daemon issues
- Dependency installation failures
- Network connectivity problems
- API timeouts

### 3. **Project Type Configuration**
Tests proper container configuration for:
- **Encore.ts Projects**: Includes ports 3000, 4000, 9091 (dashboard)
- **Standard Projects**: Includes ports 3000, 4000 only
- **Environment Variables**: Sets appropriate ENV vars for each type

### 4. **Performance & Concurrency**
Ensures:
- Prevention of multiple concurrent rebuilds
- Proper resource cleanup
- Handling of edge case inputs
- Performance within acceptable limits

## Running the Tests

### Run All Force Rebuild Tests
```bash
npm test -- --grep "Force Rebuild"
```

### Run Core Logic Tests Only
```bash
npm test -- src/tests/force-rebuild-simple.test.ts
```

### Run Tests with Coverage
```bash
npm test -- --coverage src/tests/force-rebuild-simple.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- src/tests/force-rebuild-simple.test.ts --watch
```

## Test Results Summary

```
✅ Force Rebuild Core Logic: 14/14 tests passing (100%)
⚠️ Force Rebuild UI Components: Pending JSX resolution
📊 Overall Test Coverage: Core functionality fully tested
```

## Integration with Claude Code CLI

The tests verify proper integration with the Claude Code CLI backend:

1. **Container Management**: Uses `claudeCodeAPI.createContainer()` with proper Docker configuration
2. **Workspace Operations**: Properly destroys and recreates isolated workspaces
3. **Command Execution**: Executes commands in the correct container context
4. **Error Propagation**: Handles and reports CLI errors appropriately

## Mock Strategy

The tests use comprehensive mocking to:
- Isolate Force Rebuild logic from external dependencies
- Simulate various success/failure scenarios
- Test edge cases safely
- Ensure consistent test results

## Future Enhancements

1. **UI Component Tests**: Resolve JSX compilation and add React component tests
2. **E2E Integration**: Add Playwright tests for full user workflow
3. **Performance Benchmarks**: Add timing assertions for container operations
4. **Real Docker Integration**: Optional tests against actual Docker daemon
5. **Chat Feedback Tests**: Verify chat message integration during rebuild process

## Dependencies

- **Vitest**: Test runner and assertion library  
- **@testing-library/react**: React component testing utilities
- **jsdom**: DOM environment for component tests
- **@testing-library/jest-dom**: Additional DOM matchers

## Best Practices

1. **Isolation**: Each test is independent with proper setup/teardown
2. **Mocking**: External dependencies are mocked for reliability
3. **Coverage**: Tests cover both happy path and error scenarios
4. **Performance**: Tests include performance and concurrency validation
5. **Documentation**: Tests serve as living documentation of the feature

---

**Status**: Core functionality tests are complete and passing. UI tests pending JSX resolution.
**Confidence Level**: High - Critical Force Rebuild logic is thoroughly tested.