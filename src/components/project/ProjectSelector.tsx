import React, { useState, useRef, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { appStore } from '@/stores/app-store'
import { projectWorkspaceManager } from '@/services/project-workspace'
import { ChevronDown, Plus, FolderOpen, Settings, Trash2, Loader2 } from 'lucide-react'
import { ProjectTemplateSelector } from './ProjectTemplateSelector'
import { loggers } from '@/services/logging-system'

interface ProjectSelectorProps {
  onProjectSelect?: (projectId: string) => void;
  onProjectCreate?: () => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onProjectSelect,
  onProjectCreate
}) => {
  const state = useSnapshot(appStore)
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true) // Start with loading=true
  const [projects, setProjects] = useState<any[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load projects when component mounts and when dropdown opens
  useEffect(() => {
    // First check if app store already has projects
    if (state.projects && state.projects.length > 0) {
      console.log(`📂 ProjectSelector: Using ${state.projects.length} projects from app store`);
      setProjects(state.projects.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })));
      setLoading(false); // Stop loading when we have data from app store
    } else if (projects.length === 0 && !loading) {
      // Load projects if we don't have any and not already loading
      console.log('📂 ProjectSelector: Loading projects on mount...');
      loadProjects();
    }
  }, [state.projects]);

  // Initial load on component mount
  useEffect(() => {
    // Only load if we don't have projects in app store
    if (!state.projects || state.projects.length === 0) {
      console.log('📂 ProjectSelector: Component mounted, loading projects...');
      loadProjects();
    } else {
      // We already have projects from app store, stop loading
      setLoading(false);
    }
  }, []); // Run only once on mount

  // Also load projects when dropdown opens if we still don't have any
  useEffect(() => {
    if (isOpen && projects.length === 0) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      console.log('📂 ProjectSelector: Loading projects...');
      const allProjects = await projectWorkspaceManager.getAllProjects();
      console.log(`📂 ProjectSelector: Retrieved ${allProjects.length} projects from workspace manager`);
      
      if (allProjects.length === 0) {
        console.warn('📂 ProjectSelector: No projects returned from workspace manager');
      }
      
      const formattedProjects = allProjects.map(project => ({
        id: project.id,
        name: project.name,
        type: project.type,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }));
      setProjects(formattedProjects);
      
      // Update app store
      appStore.projects = formattedProjects;
      console.log(`📂 ProjectSelector: Updated app store with ${formattedProjects.length} projects`);
      
      // Check if we need to set a current project
      if (!state.currentProject && formattedProjects.length > 0) {
        console.log('📂 ProjectSelector: No current project set, checking workspace manager...');
        const currentProject = projectWorkspaceManager.getCurrentProject();
        if (currentProject) {
          console.log(`📂 ProjectSelector: Found current project in workspace manager: ${currentProject.name}`);
        } else {
          console.log('📂 ProjectSelector: No current project in workspace manager either');
        }
      }
      
      // Trigger file tree refresh to reflect current project state
      const refreshEvent = new CustomEvent('refresh-file-tree', {
        detail: { 
          action: 'project-list-reload',
          projectCount: formattedProjects.length,
          currentProject: state.currentProject?.id
        }
      });
      window.dispatchEvent(refreshEvent);
      
      console.log(`✅ ProjectSelector: Successfully loaded ${formattedProjects.length} projects`);
    } catch (error) {
      console.error('❌ ProjectSelector: Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleDropdown = () => {
    loggers.ui('project_selector_toggled', {
      isOpen: !isOpen,
      currentProject: state.currentProject?.id
    }, state.currentProject?.id)
    
    setIsOpen(!isOpen)
  }

  const handleCreateProject = () => {
    loggers.ui('project_creation_initiated', {
      trigger: 'project_selector'
    })
    
    setIsOpen(false)
    setShowCreateModal(true)
    onProjectCreate?.()
  }

  const handleProjectSelect = async (projectId: string) => {
    loggers.ui('project_selected', {
      projectId,
      previousProject: state.currentProject?.id
    }, projectId)
    
    setIsOpen(false)
    
    try {
      await projectWorkspaceManager.switchToProject(projectId);
      
      // Auto-start container if project is stopped or ready
      const project = projectWorkspaceManager.getProject(projectId);
      if (project && (project.status === 'stopped' || project.status === 'ready')) {
        loggers.project('auto_starting_container', {
          projectId,
          previousStatus: project.status
        }, projectId);
        
        try {
          await projectWorkspaceManager.startProject(projectId);
          loggers.project('auto_start_success', { projectId }, projectId);
        } catch (startError) {
          loggers.error('auto_start_failed', startError as Error, { projectId }, projectId);
          console.warn('Failed to auto-start project container:', startError);
          // Don't block project selection if auto-start fails
        }
      }
      
      onProjectSelect?.(projectId);
    } catch (error) {
      console.error('Failed to switch project:', error);
    }
  }

  const handleProjectSettings = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    loggers.ui('project_settings_clicked', { projectId }, projectId)
    // TODO: Open project settings modal
    alert(`Project settings for ${projectId} - Coming soon!`);
  }

  const handleDeleteProject = async (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    loggers.ui('project_delete_clicked', { projectId }, projectId)
    
    const project = projects.find(p => p.id === projectId);
    if (confirm(`Are you sure you want to delete project "${project?.name}"? This action cannot be undone.`)) {
      try {
        await projectWorkspaceManager.deleteProject(projectId);
        // Reload projects list
        await loadProjects();
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert('Failed to delete project');
      }
    }
  }

  // Debug current state
  console.log('🔍 ProjectSelector render:', {
    currentProject: state.currentProject?.name,
    hasStateProjects: state.projects?.length || 0,
    hasLocalProjects: projects.length,
    loading
  });

  const currentProjectName = state.currentProject?.name || (loading ? 'Loading...' : hasProjects ? 'Select Project' : 'Offline')
  const hasProjects = projects.length > 0

  return (
    <div className="project-selector relative" ref={dropdownRef}>
      {/* Project Selector Button */}
      <button
        className={`project-selector-btn flex items-center gap-2 px-3 py-1.5 bg-constellation-bg-tertiary rounded-md cursor-pointer hover:bg-opacity-80 transition-colors ${
          isOpen ? 'bg-opacity-60' : ''
        }`}
        onClick={handleToggleDropdown}
      >
        <span className="text-sm text-constellation-text-primary">
          {currentProjectName}
        </span>
        <ChevronDown 
          size={14} 
          className={`text-constellation-text-tertiary transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="project-dropdown absolute top-full left-0 mt-1 w-80 bg-constellation-bg-primary border border-constellation-border rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="dropdown-header p-3 border-b border-constellation-border">
            <h3 className="text-sm font-medium text-constellation-text-primary">
              Select Project
            </h3>
            <p className="text-xs text-constellation-text-secondary mt-1">
              Choose an existing project or create a new one
            </p>
          </div>

          {/* Project List */}
          <div className="project-list max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-constellation-accent-blue" />
                <span className="ml-2 text-sm text-constellation-text-secondary">Loading projects...</span>
              </div>
            ) : hasProjects ? (
              projects.map((project: any) => (
                <div
                  key={project.id}
                  className="project-item flex items-center justify-between p-3 hover:bg-constellation-bg-secondary cursor-pointer group"
                  onClick={() => handleProjectSelect(project.id)}
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen size={16} className="text-constellation-accent-blue" />
                    <div>
                      <div className="text-sm text-constellation-text-primary">
                        {project.name}
                      </div>
                      <div className="text-xs text-constellation-text-secondary">
                        {project.type} • {project.status}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 hover:bg-constellation-bg-tertiary rounded text-constellation-text-secondary hover:text-constellation-text-primary"
                      onClick={(e) => handleProjectSettings(project.id, e)}
                      title="Project Settings"
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      className="p-1 hover:bg-constellation-bg-tertiary rounded text-constellation-text-secondary hover:text-red-400"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      title="Delete Project"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state p-6 text-center">
                <FolderOpen size={32} className="text-constellation-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-constellation-text-secondary mb-2">
                  No projects found
                </p>
                <p className="text-xs text-constellation-text-tertiary">
                  Create your first project to get started
                </p>
              </div>
            )}
          </div>

          {/* Create Project Button */}
          <div className="dropdown-footer p-3 border-t border-constellation-border">
            <button
              className="create-project-btn w-full flex items-center justify-center gap-2 px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity text-sm font-medium"
              onClick={handleCreateProject}
            >
              <Plus size={16} />
              Create New Project
            </button>
          </div>
        </div>
      )}

      {/* Project Template Selector Modal */}
      {showCreateModal && (
        <ProjectTemplateSelector
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={(project) => {
            setShowCreateModal(false)
            setIsOpen(false) // Also close the project selector dropdown
            
            loggers.ui('project_created_with_agent', {
              projectId: project.id,
              projectName: project.name,
              projectType: project.type
            }, project.id)
            
            // Reload projects list to include the new project
            loadProjects()
            
            // Notify parent component
            if (onProjectCreate) {
              onProjectCreate()
            }
          }}
        />
      )}
    </div>
  )
}