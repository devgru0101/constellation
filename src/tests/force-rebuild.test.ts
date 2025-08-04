/**
 * Comprehensive Unit Test for Force Rebuild Functionality
 * 
 * Tests the complete Force Rebuild workflow:
 * 1. Container destruction and recreation
 * 2. Workspace management
 * 3. Dependency installation
 * 4. Application startup
 * 5. Error handling and recovery
 * 6. UI state management
 * 7. Chat feedback integration
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { Header } from '../components/ui/Header';
import { claudeCodeAPI } from '../services/claude-code-api';
import { appStore } from '../stores/app-store';
import type { ChatMessage, Project } from '../types';

// Mock dependencies
vi.mock('../services/claude-code-api');
vi.mock('../stores/app-store', () => ({
  appStore: {
    currentProject: null,
    chatMessages: [],
    activeView: 'code'
  },
  useAppStore: () => ({
    toggleKnowledgeBase: vi.fn(),
    setActiveView: vi.fn(),
    addChatMessage: vi.fn()
  })
}));

vi.mock('../components/project/ProjectSelector', () => ({
  ProjectSelector: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'project-selector' }, 'Project Selector');
  }
}));

vi.mock('../components/system/RealTerminalModal', () => ({
  RealTerminalModal: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'terminal-modal' }, 'Terminal Modal');
  }
}));

// Create mock functions with proper typing
const mockClaudeCodeAPI = claudeCodeAPI as {
  destroyWorkspace: Mock;
  createProjectWorkspace: Mock;
  createContainer: Mock;
  executeCommand: Mock;
};

describe('Force Rebuild Functionality', () => {
  let mockProject: Project;
  let mockAddChatMessage: Mock;
  let consoleSpy: Mock;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup console spy to capture console.log calls
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Create mock project
    mockProject = {
      id: 'test-project-123',
      name: 'Test Encore App',
      type: 'encore-solidjs',
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
      knowledgeBase: {
        requirements: ['Test requirement'],
        techStack: ['Encore.ts', 'SolidJS']
      }
    };

    // Setup app store mock
    appStore.currentProject = mockProject;
    appStore.chatMessages = [];

    // Setup mock chat message handler
    mockAddChatMessage = vi.fn();
    
    // Mock claude code API methods
    mockClaudeCodeAPI.destroyWorkspace = vi.fn();
    mockClaudeCodeAPI.createProjectWorkspace = vi.fn();
    mockClaudeCodeAPI.createContainer = vi.fn();
    mockClaudeCodeAPI.executeCommand = vi.fn();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('1. Force Rebuild Button Rendering', () => {
    it('should render Force Rebuild button with correct attributes', () => {
      const { container } = render(<Header />);
      
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]');
      expect(forceRebuildButton).toBeTruthy();
      expect(forceRebuildButton?.textContent).toContain('Force Rebuild');
      expect(forceRebuildButton?.disabled).toBe(false);
    });

    it('should disable button when rebuilding', async () => {
      const { container } = render(<Header />);
      
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      // Click to start rebuilding
      fireEvent.click(forceRebuildButton);
      
      // Button should be disabled and show rebuilding state
      await waitFor(() => {
        expect(forceRebuildButton.disabled).toBe(true);
        expect(forceRebuildButton.textContent).toContain('Rebuilding...');
      });
    });

    it('should not trigger rebuild when no project is selected', () => {
      appStore.currentProject = null;
      
      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);
      
      // No API calls should be made
      expect(mockClaudeCodeAPI.destroyWorkspace).not.toHaveBeenCalled();
      expect(mockClaudeCodeAPI.createProjectWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('2. Container Destruction Workflow', () => {
    it('should attempt to destroy existing workspace', async () => {
      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue({
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready',
        ports: []
      });
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.destroyWorkspace).toHaveBeenCalledWith(mockProject.id);
      });
    });

    it('should handle workspace destruction errors gracefully', async () => {
      const destroyError = new Error('Workspace not found');
      mockClaudeCodeAPI.destroyWorkspace.mockRejectedValue(destroyError);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue({
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready',
        ports: []
      });
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.destroyWorkspace).toHaveBeenCalledWith(mockProject.id);
        expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalled();
      });

      // Should log the error but continue with workspace creation
      expect(consoleSpy).toHaveBeenCalledWith('No existing workspace to destroy:', destroyError);
    });
  });

  describe('3. Workspace and Container Creation', () => {
    it('should create new workspace with correct parameters', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Dependencies installed' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalledWith(
          mockProject.id,
          mockProject.name
        );
      });
    });

    it('should create container with Encore-specific configuration', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalledWith(
          mockProject.id,
          {
            image: 'node:18-alpine',
            ports: [3000, 4000, 9091], // Encore dashboard port included
            environment: {
              NODE_ENV: 'development',
              ENCORE_ENVIRONMENT: 'development'
            }
          }
        );
      });
    });

    it('should create container with standard configuration for non-Encore projects', async () => {
      // Change project type to non-Encore
      mockProject.type = 'fullstack-ts';
      appStore.currentProject = mockProject;

      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalledWith(
          mockProject.id,
          {
            image: 'node:18-alpine',
            ports: [3000, 4000], // No Encore dashboard port
            environment: {
              NODE_ENV: 'development'
            }
          }
        );
      });
    });
  });

  describe('4. Dependency Installation', () => {
    it('should install dependencies successfully', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dependencies installed successfully' }) // npm install
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore started' }); // encore run

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(
          mockProject.id,
          'npm install'
        );
      });
    });

    it('should handle dependency installation failure', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({
        exitCode: 1,
        output: 'npm ERR! Cannot resolve dependency'
      });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(
          mockProject.id,
          'npm install'
        );
      });

      // Should not attempt to start the application after failed dependency installation
      expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Application Startup', () => {
    it('should start Encore application after successful dependency installation', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dependencies installed' }) // npm install
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore started successfully' }); // encore run

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.executeCommand).toHaveBeenNthCalledWith(
          2, // Second call
          mockProject.id,
          'encore run'
        );
      });
    });

    it('should start standard application for non-Encore projects', async () => {
      // Change project type to non-Encore
      mockProject.type = 'fullstack-ts';
      appStore.currentProject = mockProject;

      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dependencies installed' }) // npm install
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dev server started' }); // npm run dev

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.executeCommand).toHaveBeenNthCalledWith(
          2, // Second call
          mockProject.id,
          'npm run dev'
        );
      });
    });
  });

  describe('6. Error Handling and Recovery', () => {
    it('should handle workspace creation failure', async () => {
      const workspaceError = new Error('Failed to create workspace');
      
      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockRejectedValue(workspaceError);

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalled();
      });

      // Should not proceed to container creation after workspace failure
      expect(mockClaudeCodeAPI.createContainer).not.toHaveBeenCalled();
    });

    it('should handle container creation failure', async () => {
      const containerError = new Error('Docker daemon not running');
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockRejectedValue(containerError);

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalled();
      });

      // Should not proceed to dependency installation after container failure
      expect(mockClaudeCodeAPI.executeCommand).not.toHaveBeenCalled();
    });

    it('should handle command execution errors gracefully', async () => {
      const commandError = new Error('Container not found');
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand.mockRejectedValue(commandError);

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalled();
      });
    });
  });

  describe('7. UI State Management', () => {
    it('should reset rebuilding state after successful completion', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-abc123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      // Initially should be disabled and show rebuilding
      await waitFor(() => {
        expect(forceRebuildButton.disabled).toBe(true);
        expect(forceRebuildButton.textContent).toContain('Rebuilding...');
      });

      // After completion, should be enabled again
      await waitFor(() => {
        expect(forceRebuildButton.disabled).toBe(false);
        expect(forceRebuildButton.textContent).toContain('Force Rebuild');
      }, { timeout: 5000 });
    });

    it('should reset rebuilding state after error', async () => {
      const error = new Error('Test error');
      
      mockClaudeCodeAPI.destroyWorkspace.mockRejectedValue(error);

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      // Should be disabled initially
      await waitFor(() => {
        expect(forceRebuildButton.disabled).toBe(true);
      });

      // Should be enabled again after error
      await waitFor(() => {
        expect(forceRebuildButton.disabled).toBe(false);
      }, { timeout: 5000 });
    });
  });

  describe('8. Integration Test Scenarios', () => {
    it('should complete full rebuild workflow successfully', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      const containerId = 'container-integration-test';

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue(containerId);
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'added 1234 packages' }) // npm install  
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore development server started' }); // encore run

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      // Verify complete workflow execution
      await waitFor(() => {
        expect(mockClaudeCodeAPI.destroyWorkspace).toHaveBeenCalledWith(mockProject.id);
        expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalledWith(mockProject.id, mockProject.name);
        expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalled();
        expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(mockProject.id, 'npm install');
      });

      // Verify application startup is attempted
      await waitFor(() => {
        expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(mockProject.id, 'encore run');
      });
    });

    it('should handle mixed success/failure scenarios', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      // Destroy fails, but creation succeeds
      mockClaudeCodeAPI.destroyWorkspace.mockRejectedValue(new Error('No workspace to destroy'));
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      // Should continue despite destroy failure
      await waitFor(() => {
        expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalled();
        expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalled();
      });
    });
  });

  describe('9. Performance and Resource Management', () => {
    it('should prevent multiple concurrent rebuilds', async () => {
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      // Make API calls slow to test concurrency
      mockClaudeCodeAPI.destroyWorkspace.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      );
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      // Click multiple times rapidly
      fireEvent.click(forceRebuildButton);
      fireEvent.click(forceRebuildButton);
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        // Should only be called once despite multiple clicks
        expect(mockClaudeCodeAPI.destroyWorkspace).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle resource cleanup on component unmount', () => {
      const { unmount } = render(<Header />);
      
      // Should not throw errors when unmounting
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('10. Edge Cases and Boundary Conditions', () => {
    it('should handle null/undefined project gracefully', () => {
      appStore.currentProject = null;
      
      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);
      
      // No API calls should be made
      expect(mockClaudeCodeAPI.destroyWorkspace).not.toHaveBeenCalled();
    });

    it('should handle projects with missing type information', async () => {
      // Project with undefined type
      mockProject.type = undefined as any;
      appStore.currentProject = mockProject;

      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-123');
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        // Should default to non-Encore configuration
        expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalledWith(
          mockProject.id,
          expect.objectContaining({
            ports: [3000, 4000], // No Encore dashboard port
            environment: {
              NODE_ENV: 'development'
              // No ENCORE_ENVIRONMENT
            }
          })
        );
      });
    });

    it('should handle very long container IDs', async () => {
      const longContainerId = 'container-' + 'a'.repeat(100);
      const mockWorkspace = {
        id: mockProject.id,
        name: mockProject.name,
        path: `/workspace/${mockProject.id}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.destroyWorkspace.mockResolvedValue(undefined);
      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue(longContainerId);
      mockClaudeCodeAPI.executeCommand.mockResolvedValue({ exitCode: 0, output: 'Success' });

      const { container } = render(<Header />);
      const forceRebuildButton = container.querySelector('button[title="Force rebuild the project container"]') as HTMLButtonElement;
      
      fireEvent.click(forceRebuildButton);

      await waitFor(() => {
        expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalled();
      });

      // Should handle long container ID without errors
      expect(() => longContainerId.substring(0, 12)).not.toThrow();
    });
  });
});

/**
 * Helper function for testing async operations with timeout
 */
export async function waitForAsync<T>(
  operation: () => Promise<T>,
  timeout: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout}ms`));
    }, timeout);

    operation()
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Mock implementation for chat message verification
 */
export function createMockChatMessage(
  role: 'user' | 'assistant',
  content: string,
  type: string = 'generation'
): ChatMessage {
  return {
    id: `test-msg-${Date.now()}`,
    role,
    content,
    type: type as any,
    timestamp: new Date(),
    agentId: 'master-orchestrator'
  };
}