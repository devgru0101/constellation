/**
 * Project Status Monitor - Real-time project creation and status monitoring
 * 
 * Provides users with visibility into active project creation processes,
 * container status, and build progress.
 */

import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/app-store';
import { API_CONFIG } from '@/config/api';
import { projectWorkspaceManager } from '@/services/project-workspace';
import { claudeCodeAPI } from '@/services/claude-code-api';
import { loggers } from '@/services/logging-system';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Container, 
  Database,
  Server,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

interface ProjectStatus {
  id: string;
  name: string;
  status: 'creating' | 'ready' | 'building' | 'running' | 'error' | 'stopped';
  lastUpdated: Date;
  workspace?: {
    path: string;
    created: string;
    files: string[];
  };
  container?: {
    id: string;
    status: string;
    ports: number[];
  };
  buildInfo?: {
    stage: string;
    progress: number;
    logs: string[];
  };
}

export const ProjectStatusMonitor: React.FC = () => {
  const state = useSnapshot(appStore);
  const [projects, setProjects] = useState<ProjectStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshProjectStatus();
    }, 5000);

    // Initial load
    refreshProjectStatus();

    return () => clearInterval(interval);
  }, []);

  const refreshProjectStatus = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Get workspace projects
      const response = await fetch(`${API_CONFIG.apiUrl}/debug/projects`);
      const data = await response.json();
      
      const projectStatuses: ProjectStatus[] = [];
      
      if (data.projects) {
        for (const workspace of data.projects.slice(0, 10)) { // Show last 10 projects
          try {
            // Extract project name from readme
            const projectName = workspace.readme?.match(/# (.+) Workspace/)?.[1] || 
                              workspace.id.replace('project-', '').split('-').slice(0, -1).join('-') || 
                              'Unknown Project';
            
            // Determine status based on workspace age and files
            const createdTime = new Date(workspace.created);
            const ageMinutes = (Date.now() - createdTime.getTime()) / (1000 * 60);
            
            let status: ProjectStatus['status'] = 'ready';
            if (ageMinutes < 2) {
              status = 'creating'; // Recently created, likely still setting up
            } else if (workspace.files && workspace.files.length > 10) {
              status = 'ready'; // Has substantial files, likely completed
            }
            
            // Check if it's the current project
            if (state.currentProject?.id === workspace.id) {
              status = 'running';
            }
            
            projectStatuses.push({
              id: workspace.id,
              name: projectName,
              status,
              lastUpdated: createdTime,
              workspace: {
                path: workspace.path,
                created: workspace.created,
                files: workspace.files || []
              }
            });
          } catch (error) {
            console.warn(`Failed to process project ${workspace.id}:`, error);
          }
        }
      }
      
      setProjects(projectStatuses);
      setLastRefresh(new Date());
      
    } catch (error) {
      console.error('Failed to refresh project status:', error);
      loggers.error('project_status_refresh_failed', error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: ProjectStatus['status']) => {
    switch (status) {
      case 'creating':
        return <Clock className="text-yellow-500 animate-pulse" size={16} />;
      case 'building':
        return <RefreshCw className="text-blue-500 animate-spin" size={16} />;
      case 'running':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'ready':
        return <CheckCircle className="text-blue-500" size={16} />;
      case 'error':
        return <XCircle className="text-red-500" size={16} />;
      case 'stopped':
        return <AlertTriangle className="text-gray-500" size={16} />;
      default:
        return <Activity className="text-gray-400" size={16} />;
    }
  };

  const getStatusColor = (status: ProjectStatus['status']) => {
    switch (status) {
      case 'creating':
        return 'text-yellow-500 bg-yellow-500 bg-opacity-10 border-yellow-500 border-opacity-30';
      case 'building':
        return 'text-blue-500 bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30';
      case 'running':
        return 'text-green-500 bg-green-500 bg-opacity-10 border-green-500 border-opacity-30';
      case 'ready':
        return 'text-blue-500 bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30';
      case 'error':
        return 'text-red-500 bg-red-500 bg-opacity-10 border-red-500 border-opacity-30';
      case 'stopped':
        return 'text-gray-500 bg-gray-500 bg-opacity-10 border-gray-500 border-opacity-30';
      default:
        return 'text-gray-400 bg-gray-400 bg-opacity-10 border-gray-400 border-opacity-30';
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleProjectSelect = async (projectId: string) => {
    try {
      await projectWorkspaceManager.switchToProject(projectId);
      loggers.ui('project_selected_from_monitor', { projectId });
    } catch (error) {
      console.error('Failed to switch to project:', error);
    }
  };

  return (
    <div className="bg-constellation-bg-primary border border-constellation-border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-constellation-border">
        <div className="flex items-center gap-3">
          <Activity className="text-constellation-accent-primary" size={20} />
          <div>
            <h3 className="font-semibold text-constellation-text-primary">
              Project Status Monitor
            </h3>
            <p className="text-xs text-constellation-text-secondary">
              Real-time project creation and build status
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-constellation-text-tertiary">
            Updated {formatRelativeTime(lastRefresh)}
          </span>
          <button
            onClick={refreshProjectStatus}
            disabled={isLoading}
            className="p-1 text-constellation-text-tertiary hover:text-constellation-text-primary transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Project List */}
      <div className="max-h-64 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-6 text-center text-constellation-text-secondary">
            <Database size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No projects found</p>
          </div>
        ) : (
          <div className="divide-y divide-constellation-border">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-4 hover:bg-constellation-bg-secondary transition-colors cursor-pointer"
                onClick={() => handleProjectSelect(project.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(project.status)}
                    <div>
                      <h4 className="font-medium text-constellation-text-primary text-sm">
                        {project.name}
                      </h4>
                      <p className="text-xs text-constellation-text-tertiary">
                        {project.id.substring(0, 20)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                    <span className="text-xs text-constellation-text-tertiary">
                      {formatRelativeTime(project.lastUpdated)}
                    </span>
                  </div>
                </div>

                {/* Project Details */}
                <div className="flex items-center gap-4 text-xs text-constellation-text-secondary">
                  {project.workspace && (
                    <>
                      <div className="flex items-center gap-1">
                        <Container size={12} />
                        <span>{project.workspace.files.length} files</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Server size={12} />
                        <span>Workspace ready</span>
                      </div>
                    </>
                  )}
                  {project.container && (
                    <div className="flex items-center gap-1">
                      <Activity size={12} />
                      <span>Container: {project.container.status}</span>
                    </div>
                  )}
                </div>

                {/* Active project indicator */}
                {state.currentProject?.id === project.id && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-constellation-accent-primary">
                    <div className="w-2 h-2 bg-constellation-accent-primary rounded-full animate-pulse" />
                    <span>Active Project</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};