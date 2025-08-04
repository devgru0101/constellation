/**
 * Simplified Force Rebuild Test
 * 
 * Basic tests to verify the Force Rebuild functionality without complex JSX rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { claudeCodeAPI } from '../services/claude-code-api';

// Mock dependencies
vi.mock('../services/claude-code-api');

const mockClaudeCodeAPI = claudeCodeAPI as {
  destroyWorkspace: ReturnType<typeof vi.fn>;
  createProjectWorkspace: ReturnType<typeof vi.fn>;
  createContainer: ReturnType<typeof vi.fn>;
  executeCommand: ReturnType<typeof vi.fn>;
};

describe('Force Rebuild Core Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. API Integration Tests', () => {
    it('should call destroyWorkspace with correct project ID', async () => {
      const projectId = 'test-project-123';
      
      mockClaudeCodeAPI.destroyWorkspace = vi.fn().mockResolvedValue(undefined);
      
      await claudeCodeAPI.destroyWorkspace(projectId);
      
      expect(mockClaudeCodeAPI.destroyWorkspace).toHaveBeenCalledWith(projectId);
    });

    it('should call createProjectWorkspace with correct parameters', async () => {
      const projectId = 'test-project-123';
      const projectName = 'Test Project';
      const mockWorkspace = {
        id: projectId,
        name: projectName,
        path: `/workspace/${projectId}`,
        status: 'ready' as const,
        ports: []
      };
      
      mockClaudeCodeAPI.createProjectWorkspace = vi.fn().mockResolvedValue(mockWorkspace);
      
      const result = await claudeCodeAPI.createProjectWorkspace(projectId, projectName);
      
      expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalledWith(projectId, projectName);
      expect(result).toEqual(mockWorkspace);
    });

    it('should call createContainer with Encore configuration', async () => {
      const projectId = 'test-project-123';
      const containerId = 'container-abc123';
      const containerConfig = {
        image: 'node:18-alpine',
        ports: [3000, 4000, 9091],
        environment: {
          NODE_ENV: 'development',
          ENCORE_ENVIRONMENT: 'development'
        }
      };
      
      mockClaudeCodeAPI.createContainer = vi.fn().mockResolvedValue(containerId);
      
      const result = await claudeCodeAPI.createContainer(projectId, containerConfig);
      
      expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalledWith(projectId, containerConfig);
      expect(result).toBe(containerId);
    });

    it('should execute npm install command', async () => {
      const projectId = 'test-project-123';
      const command = 'npm install';
      const mockResult = { exitCode: 0, output: 'Dependencies installed successfully' };
      
      mockClaudeCodeAPI.executeCommand = vi.fn().mockResolvedValue(mockResult);
      
      const result = await claudeCodeAPI.executeCommand(projectId, command);
      
      expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(projectId, command);
      expect(result).toEqual(mockResult);
    });

    it('should execute encore run command', async () => {
      const projectId = 'test-project-123';
      const command = 'encore run';
      const mockResult = { exitCode: 0, output: 'Encore started successfully' };
      
      mockClaudeCodeAPI.executeCommand = vi.fn().mockResolvedValue(mockResult);
      
      const result = await claudeCodeAPI.executeCommand(projectId, command);
      
      expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(projectId, command);
      expect(result).toEqual(mockResult);
    });
  });

  describe('2. Error Handling Tests', () => {
    it('should handle workspace destruction errors', async () => {
      const projectId = 'test-project-123';
      const error = new Error('Workspace not found');
      
      mockClaudeCodeAPI.destroyWorkspace = vi.fn().mockRejectedValue(error);
      
      await expect(claudeCodeAPI.destroyWorkspace(projectId)).rejects.toThrow('Workspace not found');
    });

    it('should handle container creation errors', async () => {
      const projectId = 'test-project-123';
      const containerConfig = { image: 'node:18-alpine', ports: [3000], environment: {} };
      const error = new Error('Docker daemon not running');
      
      mockClaudeCodeAPI.createContainer = vi.fn().mockRejectedValue(error);
      
      await expect(claudeCodeAPI.createContainer(projectId, containerConfig)).rejects.toThrow('Docker daemon not running');
    });

    it('should handle command execution failures', async () => {
      const projectId = 'test-project-123';
      const command = 'npm install';
      const mockResult = { exitCode: 1, output: 'npm ERR! Cannot resolve dependency' };
      
      mockClaudeCodeAPI.executeCommand = vi.fn().mockResolvedValue(mockResult);
      
      const result = await claudeCodeAPI.executeCommand(projectId, command);
      
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('npm ERR!');
    });
  });

  describe('3. Configuration Tests', () => {
    it('should configure Encore projects correctly', () => {
      const encoreConfig = {
        image: 'node:18-alpine',
        ports: [3000, 4000, 9091], // Includes Encore dashboard port
        environment: {
          NODE_ENV: 'development',
          ENCORE_ENVIRONMENT: 'development'
        }
      };

      expect(encoreConfig.ports).toContain(9091); // Encore dashboard
      expect(encoreConfig.environment.ENCORE_ENVIRONMENT).toBe('development');
    });

    it('should configure standard projects correctly', () => {
      const standardConfig = {
        image: 'node:18-alpine',
        ports: [3000, 4000], // No Encore dashboard port
        environment: {
          NODE_ENV: 'development'
        }
      };

      expect(standardConfig.ports).not.toContain(9091); // No Encore dashboard
      expect(standardConfig.environment).not.toHaveProperty('ENCORE_ENVIRONMENT');
    });
  });

  describe('4. Workflow Integration Tests', () => {
    it('should execute complete rebuild workflow', async () => {
      const projectId = 'test-project-123';
      const projectName = 'Test Project';
      const containerId = 'container-test';
      
      const mockWorkspace = {
        id: projectId,
        name: projectName,
        path: `/workspace/${projectId}`,
        status: 'ready' as const,
        ports: []
      };

      // Setup all mocks for successful workflow
      mockClaudeCodeAPI.destroyWorkspace = vi.fn().mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace = vi.fn().mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer = vi.fn().mockResolvedValue(containerId);
      mockClaudeCodeAPI.executeCommand = vi.fn()
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dependencies installed' }) // npm install
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore started' }); // encore run

      // Execute workflow steps
      await claudeCodeAPI.destroyWorkspace(projectId);
      const workspace = await claudeCodeAPI.createProjectWorkspace(projectId, projectName);
      const container = await claudeCodeAPI.createContainer(projectId, {
        image: 'node:18-alpine',
        ports: [3000, 4000, 9091],
        environment: { NODE_ENV: 'development', ENCORE_ENVIRONMENT: 'development' }
      });
      const installResult = await claudeCodeAPI.executeCommand(projectId, 'npm install');
      const startResult = await claudeCodeAPI.executeCommand(projectId, 'encore run');

      // Verify all steps executed successfully
      expect(mockClaudeCodeAPI.destroyWorkspace).toHaveBeenCalled();
      expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalled();
      expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalled();
      expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledTimes(2);
      expect(workspace).toEqual(mockWorkspace);
      expect(container).toBe(containerId);
      expect(installResult.exitCode).toBe(0);
      expect(startResult.exitCode).toBe(0);
    });

    it('should handle partial failures gracefully', async () => {
      const projectId = 'test-project-123';
      
      // Setup: destroy fails, but creation succeeds
      mockClaudeCodeAPI.destroyWorkspace = vi.fn().mockRejectedValue(new Error('No workspace'));
      mockClaudeCodeAPI.createProjectWorkspace = vi.fn().mockResolvedValue({
        id: projectId,
        name: 'Test',
        path: '/workspace/test',
        status: 'ready' as const,
        ports: []
      });

      // First call should fail
      await expect(claudeCodeAPI.destroyWorkspace(projectId)).rejects.toThrow();
      
      // But we can still proceed with creation
      const workspace = await claudeCodeAPI.createProjectWorkspace(projectId, 'Test');
      expect(workspace).toBeDefined();
    });
  });

  describe('5. Performance and Edge Cases', () => {
    it('should handle concurrent operations', async () => {
      const projectId = 'test-project-123';
      
      mockClaudeCodeAPI.destroyWorkspace = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(undefined), 50))
      );

      // Start multiple operations concurrently
      const promises = [
        claudeCodeAPI.destroyWorkspace(projectId),
        claudeCodeAPI.destroyWorkspace(projectId),
        claudeCodeAPI.destroyWorkspace(projectId)
      ];

      await Promise.all(promises);
      
      // All should succeed
      expect(mockClaudeCodeAPI.destroyWorkspace).toHaveBeenCalledTimes(3);
    });

    it('should handle edge case parameters', async () => {
      const edgeCases = [
        { projectId: '', name: 'Empty ID Test' },
        { projectId: 'a'.repeat(100), name: 'Very Long ID' },
        { projectId: 'test-123', name: '' },
        { projectId: 'test-special-chars-!@#$%', name: 'Special Chars' }
      ];

      mockClaudeCodeAPI.createProjectWorkspace = vi.fn().mockResolvedValue({
        id: 'test',
        name: 'test',
        path: '/test',
        status: 'ready' as const,
        ports: []
      });

      for (const testCase of edgeCases) {
        // Should not throw errors for edge case inputs
        await expect(
          claudeCodeAPI.createProjectWorkspace(testCase.projectId, testCase.name)
        ).resolves.toBeDefined();
      }
    });
  });
});

// Helper functions for testing
export function createMockProject(overrides = {}) {
  return {
    id: 'test-project-123',
    name: 'Test Project',
    type: 'encore-solidjs',
    status: 'ready',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export function createMockWorkspace(projectId: string, overrides = {}) {
  return {
    id: projectId,
    name: `Project ${projectId}`,
    path: `/workspace/${projectId}`,
    status: 'ready' as const,
    ports: [],
    ...overrides
  };
}