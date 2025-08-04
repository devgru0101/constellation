/**
 * Build Status Manager
 * 
 * Comprehensive build status management and error reporting system.
 * Provides real-time status updates, detailed error tracking, and recovery mechanisms.
 */

import { appStore } from '@/stores/app-store';
import { loggers } from './logging-system';

export interface BuildStatus {
  projectId: string;
  phase: 'initializing' | 'container-setup' | 'dependency-install' | 'building' | 'starting' | 'running' | 'error' | 'completed';
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  details?: {
    operation?: string;
    duration?: number;
    operationsCompleted?: number;
    totalOperations?: number;
    concurrentOperations?: string[];
  };
}

export interface BuildError {
  id: string;
  projectId: string;
  phase: BuildStatus['phase'];
  type: 'container' | 'dependency' | 'build' | 'network' | 'permission' | 'timeout' | 'unknown';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
  stackTrace?: string;
  timestamp: Date;
  resolution?: {
    suggestion: string;
    automated: boolean;
    action?: () => Promise<void>;
  };
}

export interface BuildMetrics {
  projectId: string;
  totalDuration: number;
  phaseDurations: { [phase: string]: number };
  operationMetrics: {
    sequential: number;
    concurrent: number;
    timeSaved: number;
    efficiency: number;
  };
  errorCount: number;
  warningCount: number;
  recoveryAttempts: number;
  successRate: number;
}

class BuildStatusManager {
  private projectStatuses: Map<string, BuildStatus> = new Map();
  private projectErrors: Map<string, BuildError[]> = new Map();
  private projectMetrics: Map<string, BuildMetrics> = new Map();
  private statusUpdateCallbacks: Map<string, ((status: BuildStatus) => void)[]> = new Map();

  /**
   * Initialize build tracking for a project
   */
  initializeBuild(projectId: string, totalOperations: number = 8): BuildStatus {
    const initialStatus: BuildStatus = {
      projectId,
      phase: 'initializing',
      progress: 0,
      message: 'Initializing build pipeline...',
      timestamp: new Date(),
      details: {
        operationsCompleted: 0,
        totalOperations,
        concurrentOperations: []
      }
    };

    this.projectStatuses.set(projectId, initialStatus);
    this.projectErrors.set(projectId, []);
    
    // Initialize metrics
    this.projectMetrics.set(projectId, {
      projectId,
      totalDuration: 0,
      phaseDurations: {},
      operationMetrics: {
        sequential: 0,
        concurrent: 0,
        timeSaved: 0,
        efficiency: 0
      },
      errorCount: 0,
      warningCount: 0,
      recoveryAttempts: 0,
      successRate: 0
    });

    loggers.project('build_status_initialized', {
      projectId,
      totalOperations,
      phase: initialStatus.phase
    }, projectId);

    this.notifyStatusUpdate(projectId, initialStatus);
    return initialStatus;
  }

  /**
   * Update build status
   */
  updateStatus(
    projectId: string, 
    phase: BuildStatus['phase'], 
    progress: number, 
    message: string,
    details?: BuildStatus['details']
  ): BuildStatus {
    const currentStatus = this.projectStatuses.get(projectId);
    if (!currentStatus) {
      return this.initializeBuild(projectId);
    }

    const updatedStatus: BuildStatus = {
      ...currentStatus,
      phase,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      timestamp: new Date(),
      details: { ...currentStatus.details, ...details }
    };

    this.projectStatuses.set(projectId, updatedStatus);

    // Update metrics
    const metrics = this.projectMetrics.get(projectId);
    if (metrics) {
      const phaseDuration = Date.now() - currentStatus.timestamp.getTime();
      metrics.phaseDurations[currentStatus.phase] = (metrics.phaseDurations[currentStatus.phase] || 0) + phaseDuration;
    }

    loggers.project('build_status_updated', {
      projectId,
      phase,
      progress,
      message: message.substring(0, 100),
      details
    }, projectId);

    this.notifyStatusUpdate(projectId, updatedStatus);
    return updatedStatus;
  }

  /**
   * Report build error with automatic resolution suggestions
   */
  reportError(
    projectId: string,
    type: BuildError['type'],
    severity: BuildError['severity'],
    message: string,
    details?: string,
    stackTrace?: string
  ): BuildError {
    const currentStatus = this.projectStatuses.get(projectId);
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const buildError: BuildError = {
      id: errorId,
      projectId,
      phase: currentStatus?.phase || 'unknown',
      type,
      severity,
      message,
      details,
      stackTrace,
      timestamp: new Date(),
      resolution: this.generateResolution(type, message, severity)
    };

    // Add to project errors
    const projectErrors = this.projectErrors.get(projectId) || [];
    projectErrors.push(buildError);
    this.projectErrors.set(projectId, projectErrors);

    // Update metrics
    const metrics = this.projectMetrics.get(projectId);
    if (metrics) {
      if (severity === 'critical') metrics.errorCount++;
      if (severity === 'warning') metrics.warningCount++;
    }

    // Update status if this is a critical error
    if (severity === 'critical') {
      this.updateStatus(projectId, 'error', currentStatus?.progress || 0, `❌ ${message}`);
    }

    loggers.error('build_error_reported', new Error(message), {
      errorId,
      projectId,
      type,
      severity,
      phase: currentStatus?.phase,
      details
    }, projectId);

    // Attempt automatic resolution if available
    if (buildError.resolution?.automated && buildError.resolution.action) {
      this.attemptAutomaticRecovery(projectId, buildError);
    }

    return buildError;
  }

  /**
   * Complete build tracking with final metrics
   */
  completeBuild(
    projectId: string, 
    success: boolean, 
    operationMetrics?: {
      totalDuration: number;
      timeSaved: number;
      operationsCompleted: number;
    }
  ): BuildMetrics {
    const currentStatus = this.projectStatuses.get(projectId);
    const errors = this.projectErrors.get(projectId) || [];
    const metrics = this.projectMetrics.get(projectId);

    if (!metrics) {
      throw new Error(`No metrics found for project ${projectId}`);
    }

    // Update final metrics
    if (operationMetrics) {
      metrics.totalDuration = operationMetrics.totalDuration;
      metrics.operationMetrics.timeSaved = operationMetrics.timeSaved;
      metrics.operationMetrics.efficiency = (operationMetrics.timeSaved / operationMetrics.totalDuration) * 100;
    }

    metrics.successRate = success ? 100 : Math.max(0, 100 - (errors.filter(e => e.severity === 'critical').length * 25));

    // Update final status
    const finalPhase: BuildStatus['phase'] = success ? 'completed' : 'error';
    const finalMessage = success 
      ? `✅ Build completed successfully! (${Math.round(metrics.operationMetrics.efficiency)}% efficiency gain)`
      : `❌ Build failed with ${errors.filter(e => e.severity === 'critical').length} critical errors`;

    this.updateStatus(projectId, finalPhase, 100, finalMessage);

    loggers.project('build_completed', {
      projectId,
      success,
      metrics,
      errorCount: errors.length,
      criticalErrors: errors.filter(e => e.severity === 'critical').length
    }, projectId);

    return metrics;
  }

  /**
   * Generate automatic resolution suggestions for common errors
   */
  private generateResolution(type: BuildError['type'], message: string, severity: BuildError['severity']): BuildError['resolution'] {
    const messageLower = message.toLowerCase();

    switch (type) {
      case 'container':
        if (messageLower.includes('not found') || messageLower.includes('no such container')) {
          return {
            suggestion: 'Container not found. Attempting to recreate container...',
            automated: true,
            action: async () => {
              // Auto-recovery logic would go here
              loggers.project('auto_recovery_container_recreate', {});
            }
          };
        }
        if (messageLower.includes('permission denied')) {
          return {
            suggestion: 'Permission denied. Check Docker permissions and user groups.',
            automated: false
          };
        }
        break;

      case 'dependency':
        if (messageLower.includes('npm install failed') || messageLower.includes('package not found')) {
          return {
            suggestion: 'Dependency installation failed. Attempting to clear cache and retry...',
            automated: true,
            action: async () => {
              loggers.project('auto_recovery_dependency_retry', {});
            }
          };
        }
        if (messageLower.includes('network') || messageLower.includes('timeout')) {
          return {
            suggestion: 'Network timeout. Retrying with different registry...',
            automated: true
          };
        }
        break;

      case 'build':
        if (messageLower.includes('typescript') || messageLower.includes('ts error')) {
          return {
            suggestion: 'TypeScript compilation error. Check type definitions and syntax.',
            automated: false
          };
        }
        if (messageLower.includes('syntax error')) {
          return {
            suggestion: 'Syntax error detected. Review generated code for issues.',
            automated: false
          };
        }
        break;

      case 'network':
        return {
          suggestion: 'Network connectivity issue. Check internet connection and firewall settings.',
          automated: false
        };

      case 'timeout':
        return {
          suggestion: 'Operation timed out. Retrying with extended timeout...',
          automated: true,
          action: async () => {
            loggers.project('auto_recovery_timeout_retry', {});
          }
        };
    }

    return {
      suggestion: 'Unknown error. Check logs for more details.',
      automated: false
    };
  }

  /**
   * Attempt automatic recovery for errors
   */
  private async attemptAutomaticRecovery(projectId: string, error: BuildError): Promise<void> {
    if (!error.resolution?.action) return;

    const metrics = this.projectMetrics.get(projectId);
    if (metrics) {
      metrics.recoveryAttempts++;
    }

    try {
      loggers.project('auto_recovery_attempt', {
        projectId,
        errorId: error.id,
        errorType: error.type,
        suggestion: error.resolution.suggestion
      }, projectId);

      await error.resolution.action();

      loggers.project('auto_recovery_success', {
        projectId,
        errorId: error.id
      }, projectId);

    } catch (recoveryError) {
      loggers.error('auto_recovery_failed', recoveryError as Error, {
        projectId,
        originalErrorId: error.id,
        errorType: error.type
      }, projectId);
    }
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(projectId: string, callback: (status: BuildStatus) => void): () => void {
    const callbacks = this.statusUpdateCallbacks.get(projectId) || [];
    callbacks.push(callback);
    this.statusUpdateCallbacks.set(projectId, callbacks);

    // Return unsubscribe function
    return () => {
      const updatedCallbacks = this.statusUpdateCallbacks.get(projectId) || [];
      const index = updatedCallbacks.indexOf(callback);
      if (index > -1) {
        updatedCallbacks.splice(index, 1);
        this.statusUpdateCallbacks.set(projectId, updatedCallbacks);
      }
    };
  }

  /**
   * Notify all subscribers of status update
   */
  private notifyStatusUpdate(projectId: string, status: BuildStatus): void {
    const callbacks = this.statusUpdateCallbacks.get(projectId) || [];
    callbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status update callback:', error);
      }
    });

    // Also update app store for global status
    if (appStore.currentProject?.id === projectId) {
      // Could add buildStatus to app store interface if needed
      window.dispatchEvent(new CustomEvent('build-status-updated', {
        detail: { projectId, status }
      }));
    }
  }

  /**
   * Get current status for a project
   */
  getStatus(projectId: string): BuildStatus | null {
    return this.projectStatuses.get(projectId) || null;
  }

  /**
   * Get all errors for a project
   */
  getErrors(projectId: string): BuildError[] {
    return this.projectErrors.get(projectId) || [];
  }

  /**
   * Get metrics for a project
   */
  getMetrics(projectId: string): BuildMetrics | null {
    return this.projectMetrics.get(projectId) || null;
  }

  /**
   * Clear tracking data for a project
   */
  clearProject(projectId: string): void {
    this.projectStatuses.delete(projectId);
    this.projectErrors.delete(projectId);
    this.projectMetrics.delete(projectId);
    this.statusUpdateCallbacks.delete(projectId);

    loggers.project('build_status_cleared', { projectId }, projectId);
  }

  /**
   * Get comprehensive report for a project
   */
  generateReport(projectId: string): {
    status: BuildStatus | null;
    errors: BuildError[];
    metrics: BuildMetrics | null;
    summary: string;
  } {
    const status = this.getStatus(projectId);
    const errors = this.getErrors(projectId);
    const metrics = this.getMetrics(projectId);

    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const warnings = errors.filter(e => e.severity === 'warning').length;

    let summary = '';
    if (status?.phase === 'completed') {
      summary = `Build completed successfully. ${metrics?.operationMetrics.efficiency.toFixed(1)}% efficiency gain from concurrent operations.`;
    } else if (status?.phase === 'error') {
      summary = `Build failed with ${criticalErrors} critical errors and ${warnings} warnings.`;
    } else {
      summary = `Build in progress: ${status?.phase} (${status?.progress}%)`;
    }

    if (metrics?.recoveryAttempts && metrics.recoveryAttempts > 0) {
      summary += ` ${metrics.recoveryAttempts} automatic recovery attempts made.`;
    }

    return { status, errors, metrics, summary };
  }
}

// Singleton instance
export const buildStatusManager = new BuildStatusManager();