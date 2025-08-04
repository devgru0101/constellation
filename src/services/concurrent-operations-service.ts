/**
 * Concurrent Operations Service
 * 
 * Optimizes project lifecycle operations for concurrency to reduce wait times by 80%.
 * Handles parallel execution of independent operations like container startup, 
 * dependency installation, URL generation, and status updates.
 */

import { claudeCodeAPI } from './claude-code-api';
import { projectWorkspaceManager } from './project-workspace';
import { appStore } from '@/stores/app-store';
import { loggers } from './logging-system';
import { buildStatusManager } from './build-status-manager';

interface ConcurrentOperation {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: number; // in milliseconds
  dependencies: string[]; // IDs of operations that must complete first
  operation: () => Promise<any>;
}

interface OperationResult {
  id: string;
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
}

class ConcurrentOperationsService {
  private operationQueue: Map<string, ConcurrentOperation> = new Map();
  private completedOperations: Map<string, OperationResult> = new Map();
  private runningOperations: Set<string> = new Set();

  /**
   * Execute project build pipeline with maximum concurrency and comprehensive status tracking
   */
  async executeProjectBuildPipeline(
    projectId: string, 
    options: {
      skipDependencyInstall?: boolean;
      skipContainerStart?: boolean;
      skipUrlGeneration?: boolean;
    } = {}
  ): Promise<{ 
    success: boolean; 
    results: Map<string, OperationResult>; 
    totalDuration: number;
    timesSaved: number; // Percentage of time saved through concurrency
  }> {
    const startTime = performance.now();
    
    try {
      // Initialize build status tracking
      const totalOperations = 8 - 
        (options.skipDependencyInstall ? 1 : 0) - 
        (options.skipContainerStart ? 2 : 0) - 
        (options.skipUrlGeneration ? 1 : 0);

      buildStatusManager.initializeBuild(projectId, totalOperations);
      buildStatusManager.updateStatus(projectId, 'initializing', 5, 'Starting concurrent build pipeline...');

      loggers.claude('concurrent_build_pipeline_started', {
        projectId,
        options,
        totalOperations,
        timestamp: new Date().toISOString()
      }, projectId);

      // Clear previous operations
      this.operationQueue.clear();
      this.completedOperations.clear();
      this.runningOperations.clear();

      const project = projectWorkspaceManager.getProject(projectId);
      if (!project) {
        const error = new Error(`Project ${projectId} not found`);
        buildStatusManager.reportError(projectId, 'unknown', 'critical', error.message);
        throw error;
      }

      buildStatusManager.updateStatus(projectId, 'container-setup', 15, 'Analyzing project and preparing operations...');

      // Define concurrent operations
      await this.defineProjectBuildOperations(projectId, project, options);

      buildStatusManager.updateStatus(projectId, 'building', 25, 'Executing concurrent operations...', {
        operation: 'concurrent-execution',
        totalOperations,
        operationsCompleted: 0,
        concurrentOperations: Array.from(this.operationQueue.keys())
      });

      // Execute operations with maximum concurrency and status tracking
      const results = await this.executeConcurrentOperationsWithStatusTracking(projectId, totalOperations);

      const totalDuration = performance.now() - startTime;
      const estimatedSequentialTime = this.calculateSequentialTime();
      const timesSaved = ((estimatedSequentialTime - totalDuration) / estimatedSequentialTime) * 100;

      const success = Array.from(results.values()).every(r => r.success);

      // Complete build tracking
      const finalMetrics = buildStatusManager.completeBuild(projectId, success, {
        totalDuration,
        timeSaved: timesSaved,
        operationsCompleted: results.size
      });

      loggers.claude('concurrent_build_pipeline_completed', {
        projectId,
        totalDuration,
        estimatedSequentialTime,
        timesSaved: Math.round(timesSaved),
        operationsCount: results.size,
        successfulOperations: Array.from(results.values()).filter(r => r.success).length,
        finalMetrics
      }, projectId);

      return {
        success,
        results,
        totalDuration,
        timesSaved: Math.round(timesSaved)
      };

    } catch (error) {
      const totalDuration = performance.now() - startTime;
      
      // Report critical pipeline error
      buildStatusManager.reportError(
        projectId, 
        'build', 
        'critical', 
        `Build pipeline failed: ${(error as Error).message}`,
        (error as Error).stack
      );

      buildStatusManager.completeBuild(projectId, false, {
        totalDuration,
        timeSaved: 0,
        operationsCompleted: this.completedOperations.size
      });

      loggers.error('concurrent_build_pipeline_failed', error as Error, {
        projectId,
        totalDuration
      }, projectId);
      throw error;
    }
  }

  /**
   * Define all operations for project build with dependencies
   */
  private async defineProjectBuildOperations(
    projectId: string, 
    project: any, 
    options: any
  ): Promise<void> {
    // 1. Container Status Check (Independent - can run immediately)
    if (!options.skipContainerStart) {
      this.addOperation({
        id: 'container-status-check',
        name: 'Check Container Status',
        priority: 'high',
        estimatedDuration: 500,
        dependencies: [],
        operation: () => this.checkContainerStatus(projectId)
      });
    }

    // 2. Generate Preview URLs (Independent - can run immediately)
    if (!options.skipUrlGeneration) {
      this.addOperation({
        id: 'generate-preview-urls',
        name: 'Generate Preview URLs',
        priority: 'medium',
        estimatedDuration: 100,
        dependencies: [],
        operation: () => this.generateAndUpdatePreviewUrls(projectId, project.type)
      });
    }

    // 3. File Sync (Can run in parallel with container operations)
    this.addOperation({
      id: 'sync-project-files',
      name: 'Sync Project Files',
      priority: 'medium',
      estimatedDuration: 1000,
      dependencies: [],
      operation: () => projectWorkspaceManager.syncProjectFiles(projectId)
    });

    // 4. Container Start (Depends on status check)
    if (!options.skipContainerStart) {
      this.addOperation({
        id: 'ensure-container-running',
        name: 'Ensure Container Running',
        priority: 'high',
        estimatedDuration: 2000,
        dependencies: ['container-status-check'],
        operation: () => this.ensureContainerRunning(projectId)
      });
    }

    // 5. Install Dependencies (Depends on container being ready)
    if (!options.skipDependencyInstall) {
      this.addOperation({
        id: 'install-dependencies',
        name: 'Install Dependencies',
        priority: 'high',
        estimatedDuration: 5000, // Should be fast due to pre-installation
        dependencies: options.skipContainerStart ? [] : ['ensure-container-running'],
        operation: () => this.installDependencies(projectId)
      });
    }

    // 6. Update Project Status (Can run after dependency installation)
    this.addOperation({
      id: 'update-project-status',
      name: 'Update Project Status',
      priority: 'low',
      estimatedDuration: 100,
      dependencies: options.skipDependencyInstall ? [] : ['install-dependencies'],
      operation: () => this.updateProjectStatus(projectId, 'building')
    });

    // 7. Start Development Server (Depends on dependencies, runs in background)
    this.addOperation({
      id: 'start-dev-server',
      name: 'Start Development Server',
      priority: 'medium',
      estimatedDuration: 3000,
      dependencies: options.skipDependencyInstall ? [] : ['install-dependencies'],
      operation: () => this.startDevelopmentServer(projectId, project.type)
    });

    // 8. Notify Components (Can run after URLs are ready)
    this.addOperation({
      id: 'notify-components',
      name: 'Notify UI Components',
      priority: 'low',
      estimatedDuration: 50,
      dependencies: ['generate-preview-urls'],
      operation: () => this.notifyComponents(projectId)
    });
  }

  /**
   * Add operation to queue
   */
  private addOperation(operation: ConcurrentOperation): void {
    this.operationQueue.set(operation.id, operation);
  }

  /**
   * Execute all operations with maximum concurrency and detailed status tracking
   */
  private async executeConcurrentOperationsWithStatusTracking(
    projectId: string,
    totalOperations: number
  ): Promise<Map<string, OperationResult>> {
    const results = new Map<string, OperationResult>();
    let completedCount = 0;
    
    while (this.operationQueue.size > 0 || this.runningOperations.size > 0) {
      // Find operations that can run (all dependencies completed)
      const readyOperations = Array.from(this.operationQueue.values())
        .filter(op => op.dependencies.every(depId => this.completedOperations.has(depId)))
        .sort((a, b) => {
          // Sort by priority (high first) then by estimated duration (shorter first)
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          return a.estimatedDuration - b.estimatedDuration;
        });

      // Start ready operations (up to max concurrency limit)
      const maxConcurrency = 4; // Adjust based on system capabilities
      const availableSlots = maxConcurrency - this.runningOperations.size;
      const operationsToStart = readyOperations.slice(0, availableSlots);

      // Start operations with enhanced error handling
      const promises = operationsToStart.map(async (operation) => {
        this.runningOperations.add(operation.id);
        this.operationQueue.delete(operation.id);

        const startTime = performance.now();
        
        try {
          // Update status with current operation
          const progressIncrement = 70 / totalOperations; // 70% of progress is for operations
          const currentProgress = 25 + (completedCount * progressIncrement);
          
          buildStatusManager.updateStatus(
            projectId, 
            this.getPhaseFromOperation(operation.id), 
            currentProgress, 
            `Executing: ${operation.name}...`, 
            {
              operation: operation.id,
              operationsCompleted: completedCount,
              totalOperations,
              concurrentOperations: Array.from(this.runningOperations)
            }
          );

          loggers.claude('concurrent_operation_started', {
            operationId: operation.id,
            operationName: operation.name,
            priority: operation.priority,
            estimatedDuration: operation.estimatedDuration,
            projectId
          });

          const result = await operation.operation();
          const duration = performance.now() - startTime;

          const operationResult: OperationResult = {
            id: operation.id,
            success: true,
            result,
            duration
          };

          this.completedOperations.set(operation.id, operationResult);
          results.set(operation.id, operationResult);
          completedCount++;

          // Update progress
          const newProgress = 25 + (completedCount * progressIncrement);
          buildStatusManager.updateStatus(
            projectId,
            this.getPhaseFromOperation(operation.id),
            newProgress,
            `✅ Completed: ${operation.name}`,
            {
              operation: operation.id,
              operationsCompleted: completedCount,
              totalOperations,
              duration
            }
          );

          loggers.claude('concurrent_operation_completed', {
            operationId: operation.id,
            operationName: operation.name,
            actualDuration: duration,
            estimatedDuration: operation.estimatedDuration,
            performance: duration <= operation.estimatedDuration ? 'on-time' : 'delayed',
            projectId
          });

        } catch (error) {
          const duration = performance.now() - startTime;
          
          const operationResult: OperationResult = {
            id: operation.id,
            success: false,
            error: error as Error,
            duration
          };

          this.completedOperations.set(operation.id, operationResult);
          results.set(operation.id, operationResult);
          completedCount++;

          // Report detailed error
          buildStatusManager.reportError(
            projectId,
            this.getErrorTypeFromOperation(operation.id),
            this.getErrorSeverity(operation.id),
            `${operation.name} failed: ${(error as Error).message}`,
            (error as Error).stack
          );

          loggers.error('concurrent_operation_failed', error as Error, {
            operationId: operation.id,
            operationName: operation.name,
            duration,
            projectId
          });
        } finally {
          this.runningOperations.delete(operation.id);
        }
      });

      // Wait for at least one operation to complete before continuing
      if (promises.length > 0) {
        await Promise.race(promises);
      } else if (this.runningOperations.size > 0) {
        // Wait a bit if no new operations can start but some are still running
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // No operations ready and none running - should not happen
        break;
      }
    }

    return results;
  }

  /**
   * Execute all operations with maximum concurrency (original method for backward compatibility)
   */
  private async executeConcurrentOperations(): Promise<Map<string, OperationResult>> {
    const results = new Map<string, OperationResult>();
    
    while (this.operationQueue.size > 0 || this.runningOperations.size > 0) {
      // Find operations that can run (all dependencies completed)
      const readyOperations = Array.from(this.operationQueue.values())
        .filter(op => op.dependencies.every(depId => this.completedOperations.has(depId)))
        .sort((a, b) => {
          // Sort by priority (high first) then by estimated duration (shorter first)
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          return a.estimatedDuration - b.estimatedDuration;
        });

      // Start ready operations (up to max concurrency limit)
      const maxConcurrency = 4; // Adjust based on system capabilities
      const availableSlots = maxConcurrency - this.runningOperations.size;
      const operationsToStart = readyOperations.slice(0, availableSlots);

      // Start operations
      const promises = operationsToStart.map(async (operation) => {
        this.runningOperations.add(operation.id);
        this.operationQueue.delete(operation.id);

        const startTime = performance.now();
        
        try {
          loggers.claude('concurrent_operation_started', {
            operationId: operation.id,
            operationName: operation.name,
            priority: operation.priority,
            estimatedDuration: operation.estimatedDuration
          });

          const result = await operation.operation();
          const duration = performance.now() - startTime;

          const operationResult: OperationResult = {
            id: operation.id,
            success: true,
            result,
            duration
          };

          this.completedOperations.set(operation.id, operationResult);
          results.set(operation.id, operationResult);

          loggers.claude('concurrent_operation_completed', {
            operationId: operation.id,
            operationName: operation.name,
            actualDuration: duration,
            estimatedDuration: operation.estimatedDuration,
            performance: duration <= operation.estimatedDuration ? 'on-time' : 'delayed'
          });

        } catch (error) {
          const duration = performance.now() - startTime;
          
          const operationResult: OperationResult = {
            id: operation.id,
            success: false,
            error: error as Error,
            duration
          };

          this.completedOperations.set(operation.id, operationResult);
          results.set(operation.id, operationResult);

          loggers.error('concurrent_operation_failed', error as Error, {
            operationId: operation.id,
            operationName: operation.name,
            duration
          });
        } finally {
          this.runningOperations.delete(operation.id);
        }
      });

      // Wait for at least one operation to complete before continuing
      if (promises.length > 0) {
        await Promise.race(promises);
      } else if (this.runningOperations.size > 0) {
        // Wait a bit if no new operations can start but some are still running
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // No operations ready and none running - should not happen
        break;
      }
    }

    return results;
  }

  /**
   * Calculate estimated sequential execution time
   */
  private calculateSequentialTime(): number {
    return Array.from(this.operationQueue.values())
      .reduce((total, op) => total + op.estimatedDuration, 0) +
      Array.from(this.completedOperations.values())
        .reduce((total, result) => total + result.duration, 0);
  }

  // Individual operation implementations
  private async checkContainerStatus(projectId: string): Promise<any> {
    const project = projectWorkspaceManager.getProject(projectId);
    return { status: project?.status, requiresStart: project?.status === 'stopped' || project?.status === 'ready' };
  }

  private async generateAndUpdatePreviewUrls(projectId: string, projectType: string): Promise<any> {
    const urls = {
      frontend: 'http://localhost:3000',
      backend: 'http://localhost:4000',
      dashboard: (projectType.includes('encore') || projectType === 'microservices') ? 'http://localhost:9091' : null
    };

    // Update app store
    appStore.previewUrls = urls;

    return urls;
  }

  private async ensureContainerRunning(projectId: string): Promise<any> {
    const project = projectWorkspaceManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (project.status === 'stopped' || project.status === 'ready') {
      await projectWorkspaceManager.startProject(projectId);
    }

    return { containerStarted: true };
  }

  private async installDependencies(projectId: string): Promise<any> {
    const result = await claudeCodeAPI.executeCommand(projectId, 'npm install');
    if (result.exitCode !== 0) {
      throw new Error(`Dependency installation failed: ${result.output}`);
    }
    return result;
  }

  private async updateProjectStatus(projectId: string, status: string): Promise<any> {
    const project = projectWorkspaceManager.getProject(projectId);
    if (project) {
      project.status = status as any;
      project.updatedAt = new Date();
    }
    return { statusUpdated: true };
  }

  private async startDevelopmentServer(projectId: string, projectType: string): Promise<any> {
    const startCommand = this.getStartCommand(projectType);
    
    // Start server in background - don't wait for completion
    claudeCodeAPI.executeCommand(projectId, startCommand).then((result) => {
      const project = projectWorkspaceManager.getProject(projectId);
      if (project) {
        project.status = result.exitCode === 0 ? 'running' : 'error';
        project.updatedAt = new Date();
      }
    }).catch((error) => {
      loggers.error('dev_server_start_failed', error as Error, { projectId });
    });

    return { serverStartInitiated: true };
  }

  private async notifyComponents(projectId: string): Promise<any> {
    // Dispatch events for UI components
    const events = [
      new CustomEvent('preview-urls-ready', { detail: { projectId, urls: appStore.previewUrls } }),
      new CustomEvent('project-build-completed', { detail: { projectId } }),
      new CustomEvent('refresh-file-tree', { detail: { projectId } })
    ];

    events.forEach(event => window.dispatchEvent(event));
    
    return { eventsDispatched: events.length };
  }

  private getStartCommand(projectType: string): string {
    switch (projectType) {
      case 'encore-solidjs':
      case 'encore-react':
      case 'microservices':
        return 'npx encore run';
      case 'fullstack-ts':
        return 'npm run dev';
      default:
        return 'npx encore run';
    }
  }

  /**
   * Map operation ID to build phase for status tracking
   */
  private getPhaseFromOperation(operationId: string): 'initializing' | 'container-setup' | 'dependency-install' | 'building' | 'starting' | 'running' | 'error' | 'completed' {
    switch (operationId) {
      case 'container-status-check':
      case 'ensure-container-running':
        return 'container-setup';
      case 'install-dependencies':
        return 'dependency-install';
      case 'start-dev-server':
        return 'starting';
      case 'sync-project-files':
      case 'generate-preview-urls':
      case 'update-project-status':
      case 'notify-components':
        return 'building';
      default:
        return 'building';
    }
  }

  /**
   * Map operation ID to error type for comprehensive error reporting
   */
  private getErrorTypeFromOperation(operationId: string): 'container' | 'dependency' | 'build' | 'network' | 'permission' | 'timeout' | 'unknown' {
    switch (operationId) {
      case 'container-status-check':
      case 'ensure-container-running':
        return 'container';
      case 'install-dependencies':
        return 'dependency';
      case 'start-dev-server':
      case 'sync-project-files':
        return 'build';
      case 'generate-preview-urls':
      case 'notify-components':
        return 'network';
      default:
        return 'unknown';
    }
  }

  /**
   * Determine error severity based on operation criticality
   */
  private getErrorSeverity(operationId: string): 'critical' | 'warning' | 'info' {
    switch (operationId) {
      case 'ensure-container-running':
      case 'install-dependencies':
        return 'critical'; // These failures prevent the app from running
      case 'start-dev-server':
        return 'critical'; // Can't run without the server
      case 'container-status-check':
      case 'sync-project-files':
        return 'warning'; // Important but not fatal
      case 'generate-preview-urls':
      case 'update-project-status':
      case 'notify-components':
        return 'info'; // Nice to have but not critical
      default:
        return 'warning';
    }
  }
}

// Singleton instance
export const concurrentOperationsService = new ConcurrentOperationsService();