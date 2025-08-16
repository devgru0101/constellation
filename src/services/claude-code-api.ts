/**
 * Claude Code CLI Integration Service
 * 
 * This service integrates with Claude Code CLI running on the host system.
 * It manages project workspaces, file generation, and container orchestration through direct CLI calls.
 */

import { loggers } from './logging-system';
import { API_CONFIG } from '@/config/api';

interface ProjectWorkspace {
  id: string;
  name: string;
  path: string;
  containerId?: string;
  status: 'initializing' | 'ready' | 'running' | 'error';
  ports: { internal: number; external: number }[];
}

interface ClaudeCodeRequest {
  message: string;
  projectId: string;
  context?: {
    currentFiles?: { [path: string]: string };
    selectedCode?: string;
    requirements?: string[];
    knowledgeBase?: any;
  };
  action: 'generate' | 'explain' | 'fix' | 'deploy';
}

interface ClaudeCodeResponse {
  success: boolean;
  message?: string;
  files?: { [path: string]: string };
  commands?: string[];
  error?: string;
  needsUserInput?: {
    question: string;
    options?: string[];
  };
}

class ClaudeCodeAPI {
  private workspaces: Map<string, ProjectWorkspace> = new Map();
  private baseWorkspacePath = '/home/ssitzer/constellation-projects';
  private config = {
    apiEndpoint: API_CONFIG.apiUrl,
    apiKey: null as string | null
  };

  constructor() {
    // Ensure base workspace directory exists
    this.initializeWorkspaceDirectory();
  }

  /**
   * Initialize base workspace directory
   */
  private async initializeWorkspaceDirectory(): Promise<void> {
    try {
      // Create base workspace directory if it doesn't exist
      // This is handled by the backend API
    } catch (error) {
      console.error('Failed to initialize workspace directory:', error);
    }
  }

  /**
   * Call backend API
   */
  private async callBackendAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    try {
      const response = await fetch(`${API_CONFIG.apiUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        ...(body && { body: JSON.stringify(body) })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Backend API call failed [${method} ${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * Create a new isolated project workspace
   */
  async createProjectWorkspace(projectId: string, projectName: string): Promise<ProjectWorkspace> {
    try {
      loggers.project('workspace_creation_started', {
        projectId,
        projectName
      }, projectId);

      const workspace = await this.callBackendAPI('/workspace/create', 'POST', {
        projectId,
        projectName
      });

      this.workspaces.set(projectId, workspace);
      
      loggers.project('workspace_created_successfully', {
        projectId,
        workspacePath: workspace.path,
        status: workspace.status
      }, projectId);

      return workspace;
    } catch (error) {
      loggers.error('workspace_creation_failed', error as Error, {
        projectId,
        projectName
      }, projectId);
      throw error;
    }
  }

  /**
   * Send a message to Claude Code with full project context
   */
  async sendMessage(request: ClaudeCodeRequest): Promise<ClaudeCodeResponse> {
    // Get workspace from cache or create default workspace info
    let workspace = this.workspaces.get(request.projectId);
    if (!workspace) {
      // Create a default workspace info for existing projects
      workspace = {
        id: request.projectId,
        name: `Project ${request.projectId}`,
        path: `${this.baseWorkspacePath}/${request.projectId}`,
        status: 'ready',
        ports: []
      };
      this.workspaces.set(request.projectId, workspace);
    }

    const startTime = performance.now();
    
    try {
      loggers.claude('claude_request_sent', {
        projectId: request.projectId,
        action: request.action,
        messageLength: request.message.length,
        hasContext: !!request.context
      }, request.projectId);

      const response = await fetch(`${this.config.apiEndpoint}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          ...request,
          workspacePath: workspace.path,
          containerId: workspace.containerId
        })
      });

      if (!response.ok) {
        throw new Error(`Claude Code API error: ${response.statusText}`);
      }

      const result = await response.json() as ClaudeCodeResponse;
      const responseTime = performance.now() - startTime;

      loggers.claude('claude_response_received', {
        projectId: request.projectId,
        success: result.success,
        responseTime,
        hasFiles: !!result.files,
        filesCount: result.files ? Object.keys(result.files).length : 0,
        commandsCount: result.commands?.length || 0
      }, request.projectId);

      return result;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      loggers.error('claude_request_failed', error as Error, {
        projectId: request.projectId,
        action: request.action,
        responseTime
      }, request.projectId);
      throw error;
    }
  }

  /**
   * Start streaming responses from Claude Code for real-time updates
   */
  async startStreamingResponse(
    request: ClaudeCodeRequest,
    onMessage: (response: Partial<ClaudeCodeResponse>) => void,
    onComplete: (response: ClaudeCodeResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    // Get workspace from cache or create default workspace info
    let workspace = this.workspaces.get(request.projectId);
    if (!workspace) {
      // Create a default workspace info for existing projects
      workspace = {
        id: request.projectId,
        name: `Project ${request.projectId}`,
        path: `${this.baseWorkspacePath}/${request.projectId}`,
        status: 'ready',
        ports: []
      };
      this.workspaces.set(request.projectId, workspace);
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          ...request,
          workspacePath: workspace.path,
          containerId: workspace.containerId
        })
      });

      if (!response.ok) {
        throw new Error(`Claude Code streaming error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.complete) {
                onComplete(data);
              } else {
                onMessage(data);
              }
            } catch (e) {
              console.warn('Failed to parse streaming data:', line);
            }
          }
        }
      }
    } catch (error) {
      onError(error as Error);
    }
  }

  /**
   * Create and start a Docker container for the project with Encore.ts pre-installation
   */
  async createContainer(
    projectId: string, 
    containerConfig: {
      image?: string;
      ports?: number[];
      environment?: { [key: string]: string };
      volumes?: string[];
      preInstallEncore?: boolean;
    } = {}
  ): Promise<string> {
    const workspace = this.workspaces.get(projectId);
    if (!workspace) {
      throw new Error(`No workspace found for project ${projectId}`);
    }

    try {
      loggers.container('container_creation_with_preinstall', {
        projectId,
        preInstallEncore: containerConfig.preInstallEncore !== false,
        image: containerConfig.image || 'node:18-alpine'
      }, projectId);

      const response = await fetch(`${this.config.apiEndpoint}/container/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          projectId,
          workspacePath: workspace.path,
          config: {
            image: containerConfig.image || 'node:18-alpine',
            ports: containerConfig.ports || [3000, 4000], // Default for Encore + Frontend
            environment: {
              NODE_ENV: 'development',
              // Share host authentication with container
              ANTHROPIC_API_KEY: containerConfig.environment?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
              CLAUDE_CODE_CLI_INSTALLED: 'true',
              CLAUDE_CODE_SESSION_ACTIVE: 'true',
              // Pass project context to container
              PROJECT_ID: projectId,
              PROJECT_PATH: workspace.path,
              ...containerConfig.environment
            },
            volumes: [
              `${workspace.path}:/app`,
              ...(containerConfig.volumes || [])
            ],
            workingDir: '/app',
            isolation: true // Critical for project isolation
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create container: ${response.statusText}`);
      }

      const { containerId, ports } = await response.json();
      
      // Update workspace with container info
      workspace.containerId = containerId;
      workspace.ports = ports;
      workspace.status = 'ready';

      // Pre-install Encore.ts and common dependencies (unless explicitly disabled)
      if (containerConfig.preInstallEncore !== false) {
        await this.preInstallDependencies(projectId);
      }
      
      return containerId;
    } catch (error) {
      console.error('Failed to create container:', error);
      workspace.status = 'error';
      throw error;
    }
  }

  /**
   * Pre-install Encore.ts, Claude Code CLI, and common dependencies in container
   */
  private async preInstallDependencies(projectId: string): Promise<void> {
    try {
      loggers.container('pre_install_dependencies_started', { projectId }, projectId);

      // Install Claude Code CLI first (global installation)
      loggers.container('installing_claude_code_cli', { projectId }, projectId);
      const claudeInstallResult = await this.executeCommand(
        projectId, 
        'npm install -g @anthropic-ai/claude-code',
        false
      );

      if (claudeInstallResult.exitCode === 0) {
        loggers.container('claude_cli_installed', { projectId }, projectId);
        
        // Initialize Claude Code session with project context
        await this.executeCommand(
          projectId,
          'claude-code --auth-check',
          false
        );
      } else {
        loggers.error('claude_cli_install_failed', new Error('Claude Code CLI installation failed'), {
          projectId,
          output: claudeInstallResult.output
        }, projectId);
      }

      // Initialize package.json
      await this.executeCommand(projectId, 'npm init -y', false);
      
      // Install Encore.ts and essential dependencies
      const dependencies = [
        'encore.dev@latest',
        'typescript@latest',
        '@types/node@latest'
      ];

      loggers.container('installing_core_dependencies', {
        projectId,
        dependencies
      }, projectId);

      const installResult = await this.executeCommand(
        projectId, 
        `npm install ${dependencies.join(' ')}`,
        false
      );

      if (installResult.exitCode === 0) {
        loggers.container('pre_install_success', {
          projectId,
          output: installResult.output.substring(0, 200)
        }, projectId);
      } else {
        loggers.error('pre_install_failed', new Error('Dependency pre-installation failed'), {
          projectId,
          exitCode: installResult.exitCode,
          output: installResult.output
        }, projectId);
        
        // Don't throw error - pre-installation is optimization, not requirement
        console.warn('Pre-installation failed, but container is still usable:', installResult.output);
      }

    } catch (error) {
      loggers.error('pre_install_error', error as Error, { projectId }, projectId);
      console.warn('Pre-installation encountered error, but container is still usable:', error);
      // Don't throw - pre-installation failure shouldn't break container creation
    }
  }

  /**
   * Execute terminal commands in the project container
   */
  async executeCommand(
    projectId: string, 
    command: string,
    interactive: boolean = false
  ): Promise<{ output: string; exitCode: number }> {
    const workspace = this.workspaces.get(projectId);
    if (!workspace?.containerId) {
      throw new Error(`No container found for project ${projectId}`);
    }

    const startTime = performance.now();
    
    try {
      loggers.container('command_execution_started', {
        projectId,
        containerId: workspace.containerId,
        command: command.length > 100 ? command.substring(0, 100) + '...' : command,
        interactive
      }, projectId);

      const response = await fetch(`${this.config.apiEndpoint}/container/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          containerId: workspace.containerId,
          command,
          interactive,
          workDir: '/app'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to execute command: ${response.statusText}`);
      }

      const result = await response.json();
      const executionTime = performance.now() - startTime;

      loggers.container('command_execution_completed', {
        projectId,
        containerId: workspace.containerId,
        command: command.length > 100 ? command.substring(0, 100) + '...' : command,
        exitCode: result.exitCode,
        executionTime,
        outputLength: result.output?.length || 0
      }, projectId);

      // Log Encore CLI operations specifically
      if (command.includes('encore')) {
        loggers.encore('encore_command_executed', {
          command,
          exitCode: result.exitCode,
          output: result.output?.substring(0, 500),
          executionTime
        }, projectId);
      }

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      loggers.error('command_execution_failed', error as Error, {
        projectId,
        containerId: workspace.containerId,
        command: command.length > 100 ? command.substring(0, 100) + '...' : command,
        executionTime
      }, projectId);
      throw error;
    }
  }

  /**
   * Get Encore development dashboard data
   */
  async getEncoreDashboard(projectId: string): Promise<any> {
    const workspace = this.workspaces.get(projectId);
    if (!workspace?.containerId) {
      throw new Error(`No container found for project ${projectId}`);
    }

    try {
      // First ensure Encore is running
      await this.executeCommand(projectId, 'npx encore run &');
      
      // Wait for Encore to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(`${this.config.apiEndpoint}/encore/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          containerId: workspace.containerId,
          projectId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get Encore dashboard: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get Encore dashboard:', error);
      throw error;
    }
  }

  /**
   * Sync generated files from Claude Code to the file tree
   */
  async syncFiles(projectId: string): Promise<{ [path: string]: string }> {
    // Get workspace from cache or create default workspace info
    let workspace = this.workspaces.get(projectId);
    if (!workspace) {
      // Create a default workspace info for existing projects
      workspace = {
        id: projectId,
        name: `Project ${projectId}`,
        path: `${this.baseWorkspacePath}/${projectId}`,
        status: 'ready',
        ports: []
      };
      this.workspaces.set(projectId, workspace);
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/files/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          projectId,
          workspacePath: workspace.path
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to sync files: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to sync files:', error);
      throw error;
    }
  }

  /**
   * Get project workspace info
   */
  getWorkspace(projectId: string): ProjectWorkspace | undefined {
    return this.workspaces.get(projectId);
  }

  /**
   * Clean up project workspace and container
   */
  async destroyWorkspace(projectId: string): Promise<void> {
    const workspace = this.workspaces.get(projectId);
    if (!workspace) return;

    try {
      await fetch(`${this.config.apiEndpoint}/workspace/destroy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          projectId,
          containerId: workspace.containerId,
          workspacePath: workspace.path
        })
      });

      this.workspaces.delete(projectId);
    } catch (error) {
      console.error('Failed to destroy workspace:', error);
      throw error;
    }
  }
}

// Singleton instance
export const claudeCodeAPI = new ClaudeCodeAPI();
export type { ClaudeCodeRequest, ClaudeCodeResponse, ProjectWorkspace };