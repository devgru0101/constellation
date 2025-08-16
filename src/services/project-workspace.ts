/**
 * Project Workspace Management System
 * 
 * Manages isolated project workspaces with complete separation between projects.
 * Each project gets its own container, file system, and runtime environment.
 */

import { claudeCodeAPI, type ProjectWorkspace } from './claude-code-api';
import { appStore } from '@/stores/app-store';
import { loggers } from './logging-system';
import { concurrentOperationsService } from './concurrent-operations-service';
import { API_CONFIG } from '@/config/api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'encore-solidjs' | 'encore-react' | 'fullstack-ts' | 'microservices';
  status: 'creating' | 'ready' | 'building' | 'running' | 'error' | 'stopped';
  createdAt: Date;
  updatedAt: Date;
  workspace?: ProjectWorkspace;
  knowledgeBase?: {
    requirements: string[];
    businessRules: string[];
    techStack: string[];
    apis: any[];
  };
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: Project['type'];
  files: { [path: string]: string };
  containerConfig: {
    image: string;
    ports: number[];
    environment: { [key: string]: string };
    startCommand: string;
  };
}

class ProjectWorkspaceManager {
  private projects: Map<string, Project> = new Map();
  private activeProjectId: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize and recover existing projects from MongoDB API
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 Initializing project workspace manager...');
      
      // Get all projects from the new MongoDB API
      console.log(`📡 Making API call to ${API_CONFIG.apiUrl}/projects`);
      const response = await fetch(`${API_CONFIG.apiUrl}/projects`);
      console.log(`📡 API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`📡 API response data:`, data);
      
      if (data.success && data.projects && data.projects.length > 0) {
        console.log(`📂 Found ${data.projects.length} existing projects`);
        
        for (const projectData of data.projects) {
          try {
            const project: Project = {
              id: projectData.id,
              name: projectData.name,
              type: projectData.type,
              status: projectData.status,
              createdAt: new Date(projectData.createdAt),
              updatedAt: new Date(projectData.updatedAt),
              description: projectData.description,
              workspace: {
                id: projectData.id,
                path: projectData.workspacePath,
                files: projectData.metadata?.originalFiles || []
              },
              knowledgeBase: projectData.knowledgeBase || {
                requirements: [],
                businessRules: [],
                techStack: this.getTechStackForType(projectData.type),
                apis: []
              }
            };
            
            this.projects.set(projectData.id, project);
            console.log(`✅ Loaded project: ${project.name} (${project.id})`);
            
          } catch (error) {
            console.warn(`⚠️ Failed to load project ${projectData.id}:`, error);
          }
        }
        
        // Set the most recently updated project as active
        const sortedProjects = Array.from(this.projects.values())
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        
        if (sortedProjects.length > 0) {
          const mostRecent = sortedProjects[0];
          await this.switchToProject(mostRecent.id);
          console.log(`🎯 Set active project: ${mostRecent.name} (${mostRecent.id})`);
        }
      } else if (data.success && data.total === 0) {
        console.log('📂 No existing projects found');
      } else {
        console.warn('⚠️ Failed to load projects from API:', data);
      }
      
      this.isInitialized = true;
      console.log(`✅ Project workspace manager initialized with ${this.projects.size} projects`);
      
    } catch (error) {
      console.error('❌ Failed to initialize project workspace manager:', error);
      console.log('🔄 Falling back to filesystem approach...');
      
      // Fallback to the old debug API if the new one fails
      try {
        await this.initializeFromFilesystem();
      } catch (fallbackError) {
        console.error('❌ Fallback initialization also failed:', fallbackError);
      }
      
      this.isInitialized = true; // Still mark as initialized to prevent infinite loops
    }
  }

  /**
   * Fallback initialization using the old filesystem approach
   */
  async initializeFromFilesystem(): Promise<void> {
    const response = await fetch(`${API_CONFIG.apiUrl}/debug/projects`);
    const data = await response.json();
    
    if (data.projects && data.projects.length > 0) {
      console.log(`📂 Found ${data.projects.length} filesystem workspaces`);
      
      for (const workspace of data.projects) {
        try {
          // Parse project info from workspace readme
          const projectName = workspace.readme?.match(/# (.+) Workspace/)?.[1] || 
                            workspace.id.replace('project-', '').split('-').slice(0, -1).join('-') || 
                            'Recovered Project';
          
          // Determine project type from files (basic heuristic)
          let projectType: Project['type'] = 'encore-solidjs';
          if (workspace.files?.some((f: string) => f.includes('encore.app'))) {
            projectType = 'encore-solidjs';
          } else if (workspace.files?.some((f: string) => f.includes('package.json'))) {
            projectType = 'fullstack-ts';
          }
          
          const project: Project = {
            id: workspace.id,
            name: projectName,
            type: projectType,
            status: 'ready',
            createdAt: new Date(workspace.created),
            updatedAt: new Date(),
            knowledgeBase: {
              requirements: [],
              businessRules: [],
              techStack: this.getTechStackForType(projectType),
              apis: []
            }
          };
          
          this.projects.set(workspace.id, project);
          console.log(`✅ Recovered project: ${projectName} (${workspace.id})`);
          
        } catch (error) {
          console.warn(`⚠️ Failed to recover project ${workspace.id}:`, error);
        }
      }
    }
  }

  /**
   * Create a new project with isolated workspace
   */
  async createProject(
    name: string,
    type: Project['type'],
    template?: ProjectTemplate,
    requirements?: string[]
  ): Promise<Project> {
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Log project creation start
    loggers.project('project_creation_started', {
      projectId,
      name,
      type,
      hasTemplate: !!template,
      requirementsCount: requirements?.length || 0
    }, projectId);
    
    const project: Project = {
      id: projectId,
      name,
      type,
      status: 'creating',
      createdAt: new Date(),
      updatedAt: new Date(),
      knowledgeBase: {
        requirements: requirements || [],
        businessRules: [],
        techStack: this.getTechStackForType(type),
        apis: []
      }
    };

    this.projects.set(projectId, project);

    try {
      // Create isolated workspace through Claude Code
      const workspace = await claudeCodeAPI.createProjectWorkspace(projectId, name);
      project.workspace = workspace;

      // Initialize project with template if provided
      if (template) {
        await this.initializeProjectFromTemplate(project, template);
      }

      // Create and configure container
      loggers.container('container_creation_started', {
        projectId,
        image: template?.containerConfig.image || 'node:18-alpine',
        ports: template?.containerConfig.ports || [3000, 4000]
      }, projectId);

      // Sanitize project name for Docker environment variables
      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

      const containerId = await claudeCodeAPI.createContainer(projectId, {
        image: template?.containerConfig.image || 'node:18-alpine',
        ports: template?.containerConfig.ports || [3000, 4000],
        environment: {
          PROJECT_NAME: sanitizedName,
          PROJECT_DISPLAY_NAME: name, // Keep original name for display
          PROJECT_TYPE: type,
          NODE_ENV: 'development',
          ...(template?.containerConfig.environment || {})
        },
        preInstallEncore: true // Enable Encore.ts pre-installation for all projects
      });

      loggers.container('container_created_successfully', {
        projectId,
        containerId,
        status: 'ready'
      }, projectId);

      project.status = 'ready';
      project.updatedAt = new Date();

      // Save project to API
      try {
        const apiResponse = await fetch(`${API_CONFIG.apiUrl}/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: project.id,
            name: project.name,
            description: project.description,
            type: project.type,
            status: project.status,
            workspacePath: workspace?.path,
            knowledgeBase: project.knowledgeBase,
            containerConfig: {
              image: template?.containerConfig.image || 'node:18-alpine',
              ports: template?.containerConfig.ports || [3000, 4000],
              environment: {
                PROJECT_NAME: sanitizedName,
                PROJECT_DISPLAY_NAME: name,
                PROJECT_TYPE: type,
                NODE_ENV: 'development',
                ...(template?.containerConfig.environment || {})
              }
            }
          })
        });

        if (!apiResponse.ok) {
          console.warn(`⚠️ Failed to save project to API: ${apiResponse.status}`);
        } else {
          console.log('✅ Project saved to API successfully');
        }
      } catch (apiError) {
        console.warn('⚠️ API save failed, continuing with local state:', apiError);
      }

      loggers.project('project_creation_completed', {
        projectId,
        status: 'ready',
        workspaceCreated: !!workspace,
        containerCreated: !!containerId
      }, projectId);

      // Update app store with current project
      const appStoreProject = {
        id: project.id,
        name: project.name,
        type: project.type as any,
        description: project.description || '',
        status: 'active' as const,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        knowledgeBase: {
          id: `kb-${project.id}`,
          projectId: project.id,
          auth: { type: 'jwt', roles: ['admin', 'user'] },
          database: { type: 'postgresql', features: [] },
          integrations: [],
          services: [],
          requirements: project.knowledgeBase?.requirements || [],
          businessRules: project.knowledgeBase?.businessRules || []
        }
      };
      
      appStore.currentProject = appStoreProject;
      
      // Add to projects list if not already there
      if (!appStore.projects.find(p => p.id === project.id)) {
        appStore.projects.push(appStoreProject);
      }

      return project;
    } catch (error) {
      project.status = 'error';
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Initialize project from template
   */
  private async initializeProjectFromTemplate(
    project: Project,
    template: ProjectTemplate
  ): Promise<void> {
    try {
      // Send template files to Claude Code for initialization
      const response = await claudeCodeAPI.sendMessage({
        message: `Initialize project "${project.name}" with template "${template.name}"`,
        projectId: project.id,
        action: 'generate',
        context: {
          currentFiles: template.files,
          requirements: project.knowledgeBase?.requirements || [],
          knowledgeBase: project.knowledgeBase
        }
      });

      if (response && response.files) {
        // Files will be automatically synced through Claude Code
        console.log(`Initialized project with ${Object.keys(response.files).length} files`);
        
        // Automatically build project after template initialization
        await this.buildProjectAfterInitialization(project.id);
      } else {
        // Handle case where no files are generated - create minimal structure
        console.log('No files generated from template, creating minimal project structure');
        await this.createMinimalProjectStructure(project.id, template);
      }
    } catch (error) {
      console.error('Failed to initialize project from template:', error);
      throw error;
    }
  }

  /**
   * Build project automatically after initialization using concurrent operations for faster execution
   */
  private async buildProjectAfterInitialization(projectId: string): Promise<void> {
    try {
      loggers.project('concurrent_auto_build_after_init_started', { projectId }, projectId);

      // Use concurrent operations service for optimized build pipeline
      const pipelineResult = await concurrentOperationsService.executeProjectBuildPipeline(projectId, {
        skipDependencyInstall: false, // Still install even with pre-installation for safety
        skipContainerStart: false,
        skipUrlGeneration: false
      });

      if (pipelineResult.success) {
        loggers.project('concurrent_auto_build_success', {
          projectId,
          timesSaved: pipelineResult.timesSaved,
          totalDuration: pipelineResult.totalDuration,
          operationsCount: pipelineResult.results.size
        }, projectId);

        // Update project status based on pipeline results
        const project = this.projects.get(projectId);
        if (project) {
          project.status = 'running';
          project.updatedAt = new Date();
        }
      } else {
        // Handle partial success
        const failedOps = Array.from(pipelineResult.results.values()).filter(r => !r.success);
        loggers.error('concurrent_auto_build_partial_failure', new Error('Some operations failed'), {
          projectId,
          failedOperations: failedOps.map(op => op.id),
          successfulOperations: Array.from(pipelineResult.results.values()).filter(r => r.success).length
        }, projectId);

        const project = this.projects.get(projectId);
        if (project) {
          // Set status based on critical failures
          const hasCriticalFailure = failedOps.some(op => 
            op.id === 'ensure-container-running' || op.id === 'install-dependencies'
          );
          project.status = hasCriticalFailure ? 'error' : 'running';
          project.updatedAt = new Date();
        }
      }
    } catch (error) {
      loggers.error('concurrent_auto_build_error', error as Error, { projectId }, projectId);
      
      // Fallback to basic status update
      const project = this.projects.get(projectId);
      if (project) {
        project.status = 'error';
        project.updatedAt = new Date();
      }
    }
  }

  /**
   * Create minimal project structure if template doesn't provide files
   */
  private async createMinimalProjectStructure(projectId: string, template: ProjectTemplate): Promise<void> {
    const minimalFiles = {
      'package.json': JSON.stringify({
        name: projectId.toLowerCase(),
        version: '1.0.0',
        dependencies: {
          'encore.dev': '^1.25.0'
        }
      }, null, 2),
      'encore.app': 'global_cors:\n  allow_origins_without_credentials:\n    - "http://localhost:3000"',
      'README.md': `# ${template.name} Project\n\nGenerated with Constellation IDE.`
    };

    try {
      // Create files directly through Claude Code API
      for (const [path, content] of Object.entries(minimalFiles)) {
        await claudeCodeAPI.executeCommand(projectId, `echo '${content.replace(/'/g, "'\"'\"'")}' > ${path}`);
      }
      
      console.log('Created minimal project structure');
      await this.buildProjectAfterInitialization(projectId);
    } catch (error) {
      console.error('Failed to create minimal project structure:', error);
    }
  }

  /**
   * Notify components that preview URLs are ready
   */
  private notifyPreviewUrlsReady(projectId: string, projectType: Project['type']): void {
    const urls = {
      frontend: 'http://localhost:3000',
      backend: 'http://localhost:4000',
      dashboard: (projectType.includes('encore') || projectType === 'microservices') ? 'http://localhost:9091' : null
    };

    // Update app store with preview URLs
    const { appStore } = require('@/stores/app-store');
    appStore.previewUrls = urls;

    // Dispatch event for components
    const event = new CustomEvent('preview-urls-ready', {
      detail: { projectId, urls, projectType }
    });
    window.dispatchEvent(event);

    loggers.project('preview_urls_ready', {
      projectId,
      urls
    }, projectId);
  }

  /**
   * Switch to a different project (maintains isolation)
   */
  async switchToProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Clear current project state
    appStore.tabs = [];
    appStore.activeTab = '';
    
    // Load chat history for the new project
    const { useAppStore } = await import('@/stores/app-store');
    const { loadProjectChatHistory } = useAppStore();
    loadProjectChatHistory(projectId);

    // Switch to new project
    this.activeProjectId = projectId;
    appStore.currentProject = {
      id: project.id,
      name: project.name,
      type: project.type as any,
      description: project.description || '',
      status: 'active',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      knowledgeBase: {
        id: `kb-${project.id}`,
        projectId: project.id,
        auth: { type: 'jwt', roles: ['admin', 'user'] },
        database: { type: 'postgresql', features: [] },
        integrations: [],
        services: [],
        requirements: project.knowledgeBase?.requirements || [],
        businessRules: project.knowledgeBase?.businessRules || []
      }
    };

    // Sync files from workspace
    await this.syncProjectFiles(projectId);
    
    // Force file tree refresh after project switch
    const refreshEvent = new CustomEvent('refresh-file-tree', {
      detail: { 
        projectId, 
        action: 'switch',
        projectName: project.name,
        projectType: project.type
      }
    });
    window.dispatchEvent(refreshEvent);
  }

  /**
   * Sync files from project workspace to file tree
   */
  async syncProjectFiles(projectId: string): Promise<void> {
    try {
      loggers.project('project_file_sync_started', { projectId }, projectId);
      
      const files = await claudeCodeAPI.syncFiles(projectId);
      
      // Update app store with the files
      const { appStore } = await import('@/stores/app-store');
      appStore.projectFiles = files;
      
      // Dispatch multiple events for comprehensive UI updates
      const fileExplorerUpdate = new CustomEvent('project-files-updated', {
        detail: { projectId, files, fileCount: Object.keys(files).length }
      });
      window.dispatchEvent(fileExplorerUpdate);
      
      // Also trigger file tree refresh to ensure UI updates
      const refreshEvent = new CustomEvent('refresh-file-tree', {
        detail: { 
          projectId, 
          action: 'sync',
          fileCount: Object.keys(files).length
        }
      });
      window.dispatchEvent(refreshEvent);
      
      loggers.project('project_file_sync_completed', {
        projectId,
        fileCount: Object.keys(files).length
      }, projectId);
      
      console.log(`✅ Synced ${Object.keys(files).length} files for project ${projectId}`);
      
    } catch (error) {
      loggers.error('project_file_sync_failed', error as Error, { projectId }, projectId);
      console.error('Failed to sync project files:', error);
    }
  }

  /**
   * Start project container and development server
   */
  async startProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    try {
      project.status = 'building';
      
      // Install dependencies
      await claudeCodeAPI.executeCommand(projectId, 'npm install');
      
      // Start development server based on project type
      const startCommand = this.getStartCommandForType(project.type);
      await claudeCodeAPI.executeCommand(projectId, startCommand);
      
      project.status = 'running';
      project.updatedAt = new Date();
      
    } catch (error) {
      project.status = 'error';
      console.error('Failed to start project:', error);
      throw error;
    }
  }

  /**
   * Stop project container
   */
  async stopProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    try {
      // Stop development server
      await claudeCodeAPI.executeCommand(projectId, 'pkill -f "npm\\|encore\\|node"');
      
      project.status = 'stopped';
      project.updatedAt = new Date();
      
    } catch (error) {
      console.error('Failed to stop project:', error);
      throw error;
    }
  }

  /**
   * Delete project and clean up workspace
   */
  async deleteProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;

    try {
      loggers.project('project_deletion_started', {
        projectId,
        projectName: project.name,
        status: project.status
      }, projectId);

      // Stop project if running
      if (project.status === 'running') {
        await this.stopProject(projectId);
      }

      // Delete from API first
      try {
        const response = await fetch(`${API_CONFIG.apiUrl}/projects/${projectId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          console.warn(`⚠️ Failed to delete project from API: ${response.status}`);
        }
      } catch (apiError) {
        console.warn('⚠️ API deletion failed, continuing with local cleanup:', apiError);
      }

      // Destroy workspace and container
      await claudeCodeAPI.destroyWorkspace(projectId);
      
      // Remove from local state
      this.projects.delete(projectId);
      
      // Remove from app store projects list
      const projectIndex = appStore.projects.findIndex(p => p.id === projectId);
      if (projectIndex !== -1) {
        appStore.projects.splice(projectIndex, 1);
      }
      
      // If this was the active project, clear app state and switch to another project if available
      if (this.activeProjectId === projectId) {
        this.activeProjectId = null;
        appStore.currentProject = null;
        appStore.tabs = [];
        appStore.activeTab = '';
        appStore.chatMessages = [];
        appStore.projectFiles = {}; // Clear project files
        
        // Try to switch to the most recent remaining project
        const remainingProjects = Array.from(this.projects.values())
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        
        if (remainingProjects.length > 0) {
          await this.switchToProject(remainingProjects[0].id);
          loggers.project('switched_to_next_project', {
            newActiveProjectId: remainingProjects[0].id,
            newActiveProjectName: remainingProjects[0].name
          });
        }
      }
      
      // Force file tree refresh - dispatch event to update UI immediately
      const refreshEvent = new CustomEvent('refresh-file-tree', {
        detail: { 
          projectId, 
          action: 'delete',
          remainingProjects: Array.from(this.projects.values()).map(p => ({
            id: p.id,
            name: p.name,
            type: p.type
          }))
        }
      });
      window.dispatchEvent(refreshEvent);
      
      // Also dispatch project list update event
      const projectListUpdateEvent = new CustomEvent('project-list-updated', {
        detail: { 
          action: 'delete',
          projectId,
          remainingProjects: Array.from(this.projects.values())
        }
      });
      window.dispatchEvent(projectListUpdateEvent);

      loggers.project('project_deletion_completed', {
        projectId,
        remainingProjectsCount: this.projects.size,
        newActiveProject: this.activeProjectId
      });
      
    } catch (error) {
      loggers.error('project_deletion_failed', error as Error, {
        projectId,
        projectName: project.name
      }, projectId);
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  /**
   * Get tech stack for project type
   */
  private getTechStackForType(type: Project['type']): string[] {
    switch (type) {
      case 'encore-solidjs':
        return ['Encore.ts', 'SolidJS', 'TypeScript', 'PostgreSQL'];
      case 'encore-react':
        return ['Encore.ts', 'React', 'TypeScript', 'PostgreSQL'];
      case 'fullstack-ts':
        return ['Node.js', 'TypeScript', 'Express', 'PostgreSQL'];
      case 'microservices':
        return ['Encore.ts', 'TypeScript', 'PostgreSQL', 'Redis'];
      default:
        return ['TypeScript', 'Node.js'];
    }
  }

  /**
   * Get start command for project type
   */
  private getStartCommandForType(type: Project['type']): string {
    switch (type) {
      case 'encore-solidjs':
      case 'encore-react':
      case 'microservices':
        return 'npx encore run';
      case 'fullstack-ts':
        return 'npm run dev';
      default:
        return 'npm start';
    }
  }

  /**
   * Get current active project
   */
  getCurrentProject(): Project | null {
    return this.activeProjectId ? this.projects.get(this.activeProjectId) || null : null;
  }

  /**
   * Restore active project state from most recent workspace
   */
  async restoreActiveProject(): Promise<Project | null> {
    try {
      // Get debug info to find most recent project
      const response = await fetch(`${API_CONFIG.apiUrl}/debug/projects`);
      const data = await response.json();
      
      if (data.projects && data.projects.length > 0) {
        const mostRecent = data.projects[0];
        
        // Reconstruct project from workspace data
        const project: Project = {
          id: mostRecent.id,
          name: mostRecent.readme?.match(/# (.+) Workspace/)?.[1] || 'Recovered Project',
          type: 'encore-solidjs', // Default type, could be enhanced
          status: 'ready',
          createdAt: new Date(mostRecent.created),
          updatedAt: new Date(),
          knowledgeBase: {
            requirements: [],
            businessRules: [],
            techStack: [],
            apis: []
          }
        };
        
        // Add to projects map
        this.projects.set(project.id, project);
        
        // Set as active project
        this.activeProjectId = project.id;
        appStore.currentProject = {
          id: project.id,
          name: project.name,
          type: project.type as any,
          description: '',
          status: 'active',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          knowledgeBase: {
            id: `kb-${project.id}`,
            projectId: project.id,
            auth: { type: 'jwt', roles: ['admin', 'user'] },
            database: { type: 'postgresql', features: [] },
            integrations: [],
            services: [],
            requirements: [],
            businessRules: []
          }
        };
        
        console.log(`Restored active project: ${project.name} (${project.id})`);
        return project;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to restore active project:', error);
      return null;
    }
  }

  /**
   * Get all projects (with auto-initialization)
   */
  async getAllProjects(): Promise<Project[]> {
    await this.initialize();
    return Array.from(this.projects.values());
  }

  /**
   * Get project by ID
   */
  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }
}

// Singleton instance
export const projectWorkspaceManager = new ProjectWorkspaceManager();

// Enhanced Project templates with shadcn/ui integration
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'encore-solidjs-starter',
    name: 'Encore.ts + SolidJS',
    description: 'Full-stack application with Encore.ts backend and SolidJS frontend',
    type: 'encore-solidjs',
    files: {
      'package.json': JSON.stringify({
        name: 'encore-solidjs-app',
        version: '1.0.0',
        dependencies: {
          'encore.dev': '^1.25.0',
          'solid-js': '^1.8.0'
        }
      }, null, 2),
      'encore.app': 'global_cors:\n  allow_origins_without_credentials:\n    - "http://localhost:3000"'
    },
    containerConfig: {
      image: 'node:18-alpine',
      ports: [4000, 3000],
      environment: {
        NODE_ENV: 'development',
        ENCORE_ENV: 'local'
      },
      startCommand: 'encore run'
    }
  },
  {
    id: 'encore-solidjs-shadcn',
    name: 'Encore.ts + SolidJS + shadcn/ui',
    description: 'Full-stack application with beautiful UI components and Tailwind CSS',
    type: 'encore-solidjs',
    files: {
      'package.json': JSON.stringify({
        name: 'encore-solidjs-shadcn-app',
        version: '1.0.0',
        dependencies: {
          'encore.dev': '^1.25.0',
          'solid-js': '^1.8.0',
          '@kobalte/core': '^0.12.0',
          'tailwindcss': '^3.3.0',
          'class-variance-authority': '^0.7.0',
          'clsx': '^2.0.0',
          'tailwind-merge': '^1.14.0'
        },
        devDependencies: {
          '@tailwindcss/typography': '^0.5.0',
          'autoprefixer': '^10.4.0',
          'postcss': '^8.4.0'
        }
      }, null, 2),
      'encore.app': 'global_cors:\n  allow_origins_without_credentials:\n    - "http://localhost:3000"',
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
      },
    },
  },
  plugins: [],
}`,
      'postcss.config.js': `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    },
    containerConfig: {
      image: 'node:18-alpine',
      ports: [4000, 3000],
      environment: {
        NODE_ENV: 'development',
        ENCORE_ENV: 'local'
      },
      startCommand: 'encore run'
    }
  },
  {
    id: 'encore-react-starter', 
    name: 'Encore.ts + React',
    description: 'Full-stack application with Encore.ts backend and React frontend',
    type: 'encore-react',
    files: {
      'package.json': JSON.stringify({
        name: 'encore-react-app',
        version: '1.0.0',
        dependencies: {
          'encore.dev': '^1.25.0',
          'react': '^18.0.0',
          'react-dom': '^18.0.0'
        }
      }, null, 2),
      'encore.app': 'global_cors:\n  allow_origins_without_credentials:\n    - "http://localhost:3000"'
    },
    containerConfig: {
      image: 'node:18-alpine',
      ports: [4000, 3000],
      environment: {
        NODE_ENV: 'development',
        ENCORE_ENV: 'local'
      },
      startCommand: 'encore run'
    }
  },
  {
    id: 'encore-react-shadcn',
    name: 'Encore.ts + React + shadcn/ui',
    description: 'Full-stack React application with shadcn/ui components and Tailwind CSS',
    type: 'encore-react',
    files: {
      'package.json': JSON.stringify({
        name: 'encore-react-shadcn-app',
        version: '1.0.0',
        dependencies: {
          'encore.dev': '^1.25.0',
          'react': '^18.0.0',
          'react-dom': '^18.0.0',
          '@radix-ui/react-avatar': '^1.0.0',
          '@radix-ui/react-button': '^1.0.0',
          '@radix-ui/react-dialog': '^1.0.0',
          '@radix-ui/react-dropdown-menu': '^2.0.0',
          'tailwindcss': '^3.3.0',
          'class-variance-authority': '^0.7.0',
          'clsx': '^2.0.0',
          'tailwind-merge': '^1.14.0',
          'lucide-react': '^0.263.0'
        },
        devDependencies: {
          '@tailwindcss/typography': '^0.5.0',
          'autoprefixer': '^10.4.0',
          'postcss': '^8.4.0'
        }
      }, null, 2),
      'encore.app': 'global_cors:\n  allow_origins_without_credentials:\n    - "http://localhost:3000"',
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
      },
    },
  },
  plugins: [],
}`,
      'postcss.config.js': `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    },
    containerConfig: {
      image: 'node:18-alpine',
      ports: [4000, 3000],
      environment: {
        NODE_ENV: 'development',
        ENCORE_ENV: 'local'
      },
      startCommand: 'encore run'
    }
  },
  {
    id: 'fullstack-ts-starter',
    name: 'Full-Stack TypeScript',
    description: 'Node.js backend with Express and modern frontend',
    type: 'fullstack-ts',
    files: {
      'package.json': JSON.stringify({
        name: 'fullstack-ts-app',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
          'typescript': '^5.0.0',
          '@types/express': '^4.17.0',
          '@types/node': '^20.0.0'
        },
        scripts: {
          'dev': 'tsx watch src/index.ts',
          'build': 'tsc',
          'start': 'node dist/index.js'
        }
      }, null, 2),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      }, null, 2)
    },
    containerConfig: {
      image: 'node:18-alpine',
      ports: [3000, 5000],
      environment: {
        NODE_ENV: 'development'
      },
      startCommand: 'npm run dev'
    }
  }
];