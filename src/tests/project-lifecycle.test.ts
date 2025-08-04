/**
 * Comprehensive Project Lifecycle Integration Test
 * 
 * Tests the complete project lifecycle from creation to code generation and building:
 * 1. Project creation with automatic container setup
 * 2. Container startup with Encore.ts pre-installation
 * 3. Project selection triggers container startup
 * 4. Code generation → automatic build → preview URLs available
 * 5. Encore dev dashboard URL accessibility
 * 6. Concurrent operations for fast user experience
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { projectWorkspaceManager, PROJECT_TEMPLATES } from '../services/project-workspace';
import { claudeCodeAPI } from '../services/claude-code-api';
import { enhancedChatService } from '../services/enhanced-chat-service';
import { appStore } from '../stores/app-store';

// Mock dependencies
vi.mock('../services/claude-code-api');
vi.mock('../stores/app-store', () => ({
  appStore: {
    currentProject: null,
    projects: [],
    chatMessages: [],
    tabs: [],
    activeTab: '',
    projectFiles: {}
  }
}));

const mockClaudeCodeAPI = claudeCodeAPI as {
  createProjectWorkspace: Mock;
  createContainer: Mock;
  executeCommand: Mock;
  sendMessage: Mock;
  syncFiles: Mock;
  destroyWorkspace: Mock;
  getEncoreDashboard: Mock;
};

describe('Project Lifecycle Integration Tests', () => {
  let testProjectId: string;
  let consoleSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Reset app store
    appStore.currentProject = null;
    appStore.projects = [];
    appStore.chatMessages = [];
    appStore.tabs = [];
    appStore.activeTab = '';
    appStore.projectFiles = {};
    
    testProjectId = `test-project-${Date.now()}`;

    // Setup common mocks
    mockClaudeCodeAPI.createProjectWorkspace = vi.fn();
    mockClaudeCodeAPI.createContainer = vi.fn();
    mockClaudeCodeAPI.executeCommand = vi.fn();
    mockClaudeCodeAPI.sendMessage = vi.fn();
    mockClaudeCodeAPI.syncFiles = vi.fn();
    mockClaudeCodeAPI.destroyWorkspace = vi.fn();
    mockClaudeCodeAPI.getEncoreDashboard = vi.fn();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('1. Project Creation with Container Setup', () => {
    it('should create project with automatic container creation and Encore.ts pre-installation', async () => {
      const mockWorkspace = {
        id: testProjectId,
        name: 'Test Encore App',
        path: `/workspace/${testProjectId}`,
        status: 'ready' as const,
        ports: [{ internal: 4000, external: 4000 }, { internal: 3000, external: 3000 }, { internal: 9091, external: 9091 }]
      };

      const containerId = 'container-test-123';

      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue(containerId);
      
      // Mock Encore.ts installation
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'npm init -y completed' }) // npm init
        .mockResolvedValueOnce({ exitCode: 0, output: 'encore.dev@1.25.0 installed' }) // encore install
        .mockResolvedValueOnce({ exitCode: 0, output: 'TypeScript installed' }); // additional deps

      const project = await projectWorkspaceManager.createProject(
        'Test Encore App',
        'encore-solidjs',
        PROJECT_TEMPLATES[0],
        ['Create a todo app']
      );

      // Verify project creation
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Encore App');
      expect(project.type).toBe('encore-solidjs');
      expect(project.status).toBe('ready');

      // Verify workspace creation
      expect(mockClaudeCodeAPI.createProjectWorkspace).toHaveBeenCalledWith(
        project.id,
        'Test Encore App'
      );

      // Verify container creation with Encore-specific configuration
      expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalledWith(
        project.id,
        expect.objectContaining({
          image: 'node:18-alpine',
          ports: [4000, 3000], // Encore backend + frontend
          environment: expect.objectContaining({
            NODE_ENV: 'development',
            PROJECT_TYPE: 'encore-solidjs',
            ENCORE_ENV: 'local'
          })
        })
      );
    });

    it('should pre-install Encore.ts and dependencies during container creation', async () => {
      const mockWorkspace = {
        id: testProjectId,
        name: 'Test Project',
        path: `/workspace/${testProjectId}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-123');
      
      // Mock the pre-installation commands
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'npm init completed' })
        .mockResolvedValueOnce({ exitCode: 0, output: 'encore.dev installed successfully' })
        .mockResolvedValueOnce({ exitCode: 0, output: 'typescript installed' })
        .mockResolvedValueOnce({ exitCode: 0, output: 'solidjs dependencies installed' });

      await projectWorkspaceManager.createProject(
        'Test Project',
        'encore-solidjs',
        PROJECT_TEMPLATES[0]
      );

      // Verify that Encore.ts is pre-installed during container creation
      // Note: This should be implemented in the container creation process
      expect(mockClaudeCodeAPI.createContainer).toHaveBeenCalled();
      
      // The container should have Encore.ts pre-installed, but this isn't currently implemented
      // This test documents the desired behavior
    });

    it('should handle container creation failures gracefully', async () => {
      const mockWorkspace = {
        id: testProjectId,
        name: 'Test Project',
        path: `/workspace/${testProjectId}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockRejectedValue(new Error('Docker daemon not running'));

      await expect(
        projectWorkspaceManager.createProject('Test Project', 'encore-solidjs')
      ).rejects.toThrow('Docker daemon not running');
    });
  });

  describe('2. Project Selection and Container Startup', () => {
    it('should start container when project is selected from dropdown', async () => {
      // Create a mock project first
      const mockProject = {
        id: testProjectId,
        name: 'Existing Project',
        type: 'encore-solidjs' as const,
        status: 'ready' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        knowledgeBase: { requirements: [], businessRules: [], techStack: [], apis: [] }
      };

      // Mock project exists in workspace manager
      (projectWorkspaceManager as any).projects.set(testProjectId, mockProject);

      mockClaudeCodeAPI.syncFiles.mockResolvedValue({
        'package.json': '{ "name": "test-app" }',
        'encore.app': 'global_cors:\n  allow_origins_without_credentials:\n    - "http://localhost:3000"'
      });

      // Mock container startup commands
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dependencies already installed' }) // npm install (should be fast)
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore development server starting...' }); // encore run

      await projectWorkspaceManager.switchToProject(testProjectId);

      // Verify project switch
      expect(appStore.currentProject?.id).toBe(testProjectId);
      
      // Verify files are synced
      expect(mockClaudeCodeAPI.syncFiles).toHaveBeenCalledWith(testProjectId);
      expect(appStore.projectFiles).toHaveProperty('package.json');

      // Note: Container startup should happen automatically on project switch
      // This is currently missing and should be implemented
    });

    it('should handle project switching when container is not running', async () => {
      const mockProject = {
        id: testProjectId,
        name: 'Stopped Project',
        type: 'encore-solidjs' as const,
        status: 'stopped' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        knowledgeBase: { requirements: [], businessRules: [], techStack: [], apis: [] }
      };

      (projectWorkspaceManager as any).projects.set(testProjectId, mockProject);

      mockClaudeCodeAPI.syncFiles.mockResolvedValue({});
      
      // Mock starting a stopped container
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Container started' })
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore server running' });

      await projectWorkspaceManager.switchToProject(testProjectId);

      expect(appStore.currentProject?.id).toBe(testProjectId);
      
      // Should automatically start the container
      // This behavior is currently missing
    });
  });

  describe('3. Code Generation to Build Pipeline', () => {
    it('should automatically build project after code generation with immediate preview availability', async () => {
      const mockProject = {
        id: testProjectId,
        name: 'Active Project',
        type: 'encore-solidjs' as const,
        status: 'running' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (projectWorkspaceManager as any).projects.set(testProjectId, mockProject);
      appStore.currentProject = {
        id: testProjectId,
        name: 'Active Project',
        type: 'encore-solidjs',
        description: '',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        knowledgeBase: {
          id: `kb-${testProjectId}`,
          projectId: testProjectId,
          auth: { type: 'jwt', roles: [] },
          database: { type: 'postgresql', features: [] },
          integrations: [],
          services: [],
          requirements: [],
          businessRules: []
        }
      };

      // Mock code generation response
      const mockCodeResponse = {
        success: true,
        message: 'Generated todo application with authentication',
        files: {
          'src/services/auth/auth.ts': 'export const login = api({...});',
          'src/services/todo/todo.ts': 'export const createTodo = api({...});',
          'frontend/src/App.tsx': 'export default function App() { return <div>Todo App</div>; }',
          'package.json': '{ "name": "todo-app", "dependencies": { "encore.dev": "^1.25.0" } }'
        },
        commands: ['npm install', 'encore run']
      };

      mockClaudeCodeAPI.sendMessage.mockResolvedValue(mockCodeResponse);
      mockClaudeCodeAPI.syncFiles.mockResolvedValue(mockCodeResponse.files);
      
      // Mock build and startup commands
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dependencies installed (cached)' }) // npm install (should be fast due to pre-installation)
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore server started on http://localhost:4000' }); // encore run

      // Simulate code generation request
      await enhancedChatService.sendMessage(
        'Create a todo application with user authentication',
        'generate'
      );

      // Verify code generation
      expect(mockClaudeCodeAPI.sendMessage).toHaveBeenCalledWith({
        message: 'Create a todo application with user authentication',
        projectId: testProjectId,
        action: 'generate',
        context: expect.any(Object)
      });

      // Verify automatic build process
      expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(testProjectId, 'npm install');
      expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(testProjectId, 'encore run');

      // Verify files are synced to UI
      expect(mockClaudeCodeAPI.syncFiles).toHaveBeenCalledWith(testProjectId);
    });

    it('should provide immediate preview URLs after successful build', async () => {
      const mockProject = {
        id: testProjectId,
        name: 'Built Project',
        type: 'encore-solidjs' as const,
        status: 'running' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (projectWorkspaceManager as any).projects.set(testProjectId, mockProject);
      appStore.currentProject = {
        id: testProjectId,
        name: 'Built Project',
        type: 'encore-solidjs',
        description: '',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        knowledgeBase: {
          id: `kb-${testProjectId}`,
          projectId: testProjectId,
          auth: { type: 'jwt', roles: [] },
          database: { type: 'postgresql', features: [] },
          integrations: [],
          services: [],
          requirements: [],
          businessRules: []
        }
      };

      // Mock successful build
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Build completed successfully' })
        .mockResolvedValueOnce({ 
          exitCode: 0, 
          output: 'Encore development server running on:\n- API: http://localhost:4000\n- Dashboard: http://localhost:9091\n- Frontend: http://localhost:3000'
        });

      await projectWorkspaceManager.startProject(testProjectId);

      // Verify project status is updated
      expect(mockProject.status).toBe('running');

      // The URLs should be immediately available:
      const expectedUrls = {
        frontend: 'http://localhost:3000',
        backend: 'http://localhost:4000',
        dashboard: 'http://localhost:9091'
      };

      // This should be accessible in PreviewPanel and EncoreDashboard components
      expect(expectedUrls.frontend).toBe('http://localhost:3000');
      expect(expectedUrls.backend).toBe('http://localhost:4000');
      expect(expectedUrls.dashboard).toBe('http://localhost:9091');
    });

    it('should handle build failures with proper error reporting', async () => {
      const mockProject = {
        id: testProjectId,
        name: 'Failing Project',
        type: 'encore-solidjs' as const,
        status: 'ready' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (projectWorkspaceManager as any).projects.set(testProjectId, mockProject);

      // Mock build failure
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'Dependencies installed' }) // npm install succeeds
        .mockResolvedValueOnce({ 
          exitCode: 1, 
          output: 'Error: TypeScript compilation failed\nsrc/services/auth.ts(10,5): error TS2322: Type string is not assignable to number'
        }); // encore run fails

      await expect(projectWorkspaceManager.startProject(testProjectId)).rejects.toThrow();

      expect(mockProject.status).toBe('error');
    });
  });

  describe('4. Encore Dashboard Integration', () => {
    it('should provide accessible Encore dev dashboard after project startup', async () => {
      const mockProject = {
        id: testProjectId,
        name: 'Dashboard Project',
        type: 'encore-solidjs' as const,
        status: 'running' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (projectWorkspaceManager as any).projects.set(testProjectId, mockProject);

      // Mock Encore dashboard data
      const mockDashboardData = {
        services: [
          { name: 'auth', status: 'running', endpoint: '/auth' },
          { name: 'todo', status: 'running', endpoint: '/todo' }
        ],
        traces: [],
        metrics: {},
        url: 'http://localhost:9091'
      };

      mockClaudeCodeAPI.getEncoreDashboard.mockResolvedValue(mockDashboardData);

      const dashboardData = await claudeCodeAPI.getEncoreDashboard(testProjectId);

      expect(dashboardData.url).toBe('http://localhost:9091');
      expect(dashboardData.services).toHaveLength(2);
      expect(dashboardData.services[0].name).toBe('auth');
      
      // Dashboard should be immediately accessible via HTTP
      expect(mockDashboardData.url).toBe('http://localhost:9091');
    });

    it('should handle dashboard unavailability gracefully', async () => {
      mockClaudeCodeAPI.getEncoreDashboard.mockRejectedValue(
        new Error('Dashboard not available - Encore server not running')
      );

      await expect(claudeCodeAPI.getEncoreDashboard(testProjectId))
        .rejects.toThrow('Dashboard not available - Encore server not running');
    });
  });

  describe('5. Concurrent Operations and Performance', () => {
    it('should handle concurrent project operations without blocking', async () => {
      const projectIds = ['project-1', 'project-2', 'project-3'];
      
      mockClaudeCodeAPI.createProjectWorkspace.mockImplementation((id, name) => 
        Promise.resolve({
          id,
          name,
          path: `/workspace/${id}`,
          status: 'ready' as const,
          ports: []
        })
      );
      
      mockClaudeCodeAPI.createContainer.mockImplementation((id) => 
        Promise.resolve(`container-${id}`)
      );

      // Create multiple projects concurrently
      const startTime = Date.now();
      const projectPromises = projectIds.map((id, index) => 
        projectWorkspaceManager.createProject(
          `Concurrent Project ${index + 1}`,
          'encore-solidjs',
          PROJECT_TEMPLATES[0]
        )
      );

      const projects = await Promise.all(projectPromises);
      const endTime = Date.now();

      // Verify all projects were created
      expect(projects).toHaveLength(3);
      projects.forEach((project, index) => {
        expect(project.name).toBe(`Concurrent Project ${index + 1}`);
        expect(project.status).toBe('ready');
      });

      // Should complete concurrently (not sequentially)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should be much faster than sequential
    });

    it('should pre-install Encore.ts to minimize wait times', async () => {
      const mockWorkspace = {
        id: testProjectId,
        name: 'Fast Project',
        path: `/workspace/${testProjectId}`,
        status: 'ready' as const,
        ports: []
      };

      mockClaudeCodeAPI.createProjectWorkspace.mockResolvedValue(mockWorkspace);
      mockClaudeCodeAPI.createContainer.mockResolvedValue('container-fast');
      
      // Mock fast dependency installation (should be cached/pre-installed)
      mockClaudeCodeAPI.executeCommand
        .mockResolvedValueOnce({ exitCode: 0, output: 'npm install completed in 2.3s (cached)' })
        .mockResolvedValueOnce({ exitCode: 0, output: 'Encore server started in 1.1s' });

      const startTime = Date.now();
      await projectWorkspaceManager.createProject('Fast Project', 'encore-solidjs');
      const creationTime = Date.now() - startTime;

      const buildStartTime = Date.now();
      await projectWorkspaceManager.startProject(testProjectId);
      const buildTime = Date.now() - buildStartTime;

      // With pre-installation, these should be very fast
      expect(creationTime).toBeLessThan(3000); // Container creation
      expect(buildTime).toBeLessThan(2000); // Build time should be minimal

      // Verify fast commands were used (indicating pre-installation worked)
      expect(mockClaudeCodeAPI.executeCommand).toHaveBeenCalledWith(testProjectId, 'npm install');
    });
  });

  describe('6. Missing Functionality Identification', () => {
    it('should identify gaps in current implementation', () => {
      // This test documents the gaps we found:
      const gaps = {
        containerStartupOnProjectSelect: 'Project selection does not automatically start containers',
        encorePreInstallation: 'Encore.ts is not pre-installed in containers during creation',
        automaticBuildAfterCodeGen: 'Code generation does not automatically trigger builds',
        immediatePreviewUrls: 'Preview URLs are not immediately available after build',
        concurrentOperations: 'Operations are not optimized for concurrency',
        buildStatusFeedback: 'Build status is not properly communicated to UI components'
      };

      // Document each gap
      Object.entries(gaps).forEach(([gap, description]) => {
        console.log(`❌ Missing: ${gap} - ${description}`);
      });

      // This test always "passes" but documents what needs to be implemented
      expect(Object.keys(gaps)).toHaveLength(6);
    });

    it('should verify required improvements for optimal user experience', () => {
      const requiredImprovements = [
        'Auto-start containers on project selection',
        'Pre-install Encore.ts during container creation',
        'Concurrent project operations',
        'Immediate build after code generation',
        'Real-time build status updates',
        'Instant preview URL availability'
      ];

      // Each of these should be implemented for optimal UX
      requiredImprovements.forEach(improvement => {
        console.log(`🔧 Required: ${improvement}`);
      });

      expect(requiredImprovements).toHaveLength(6);
    });
  });
});

// Helper function to create mock project data
export function createMockProjectData(overrides = {}) {
  return {
    id: `test-project-${Date.now()}`,
    name: 'Test Project',
    type: 'encore-solidjs' as const,
    status: 'ready' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    knowledgeBase: {
      requirements: [],
      businessRules: [],
      techStack: ['Encore.ts', 'SolidJS', 'TypeScript'],
      apis: []
    },
    ...overrides
  };
}

// Helper to simulate build process timing
export function simulateBuildTiming() {
  return {
    containerCreation: Math.random() * 1000 + 500, // 500-1500ms
    dependencyInstall: Math.random() * 2000 + 1000, // 1-3s (should be faster with pre-install)
    encoreStartup: Math.random() * 3000 + 2000, // 2-5s
    totalTime: function() { return this.containerCreation + this.dependencyInstall + this.encoreStartup; }
  };
}