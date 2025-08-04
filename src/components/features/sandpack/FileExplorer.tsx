import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { appStore, useAppStore } from '@/stores/app-store';
import type { SandpackFiles } from './types';
import { fromPropsToModules } from './utils';
import { SandpackModuleList } from './ModuleList';
import { loggers } from '@/services/logging-system';

interface SandpackFileExplorerProps {
  files?: SandpackFiles;
  autoHiddenFiles?: boolean;
  visibleFiles?: string[];
}

export const SandpackFileExplorer: React.FC<SandpackFileExplorerProps> = ({
  files: propFiles,
  autoHiddenFiles = true,
  visibleFiles,
}) => {
  const state = useSnapshot(appStore);
  const { openTab } = useAppStore();
  const [openDirectories, setOpenDirectories] = useState(new Set(['/src', '/services']));
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen for file tree refresh events
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      const { action, projectId, fileCount, projectName } = event.detail || {};
      
      console.log(`File tree refresh triggered: ${action}`, {
        projectId,
        fileCount,
        projectName,
        currentProject: state.currentProject?.id
      });
      
      // Log the refresh action for debugging
      loggers.ui('file_tree_refresh_triggered', {
        action,
        projectId,
        fileCount,
        currentProjectId: state.currentProject?.id,
        refreshTrigger: refreshTrigger + 1
      }, state.currentProject?.id);
      
      setRefreshTrigger(prev => prev + 1);
    };

    const handleProjectFilesUpdate = (event: CustomEvent) => {
      const { projectId, files, fileCount } = event.detail || {};
      
      console.log(`Project files updated: ${fileCount} files for project ${projectId}`);
      
      // Only refresh if this update is for the current project
      if (projectId === state.currentProject?.id) {
        loggers.ui('project_files_updated_for_current', {
          projectId,
          fileCount,
          refreshTrigger: refreshTrigger + 1
        }, projectId);
        
        setRefreshTrigger(prev => prev + 1);
      }
    };

    const handleProjectListUpdate = (event: CustomEvent) => {
      const { action, projectId, remainingProjects } = event.detail || {};
      
      console.log(`Project list updated: ${action}`, {
        affectedProjectId: projectId,
        remainingProjectsCount: remainingProjects?.length || 0
      });
      
      // Always refresh on project list changes (add/delete)
      loggers.ui('project_list_updated', {
        action,
        affectedProjectId: projectId,
        remainingProjectsCount: remainingProjects?.length || 0,
        refreshTrigger: refreshTrigger + 1
      });
      
      setRefreshTrigger(prev => prev + 1);
    };

    // Register all event listeners
    window.addEventListener('refresh-file-tree', handleRefresh as EventListener);
    window.addEventListener('project-files-updated', handleProjectFilesUpdate as EventListener);
    window.addEventListener('project-list-updated', handleProjectListUpdate as EventListener);
    
    return () => {
      window.removeEventListener('refresh-file-tree', handleRefresh as EventListener);
      window.removeEventListener('project-files-updated', handleProjectFilesUpdate as EventListener);
      window.removeEventListener('project-list-updated', handleProjectListUpdate as EventListener);
    };
  }, [state.currentProject?.id, refreshTrigger]);

  // Use files from app store (project files) or prop files, with empty default
  const defaultFiles: SandpackFiles = {};
  const files = propFiles || (state.projectFiles as SandpackFiles) || defaultFiles;
  const modules = fromPropsToModules(files);
  
  // Log file count for debugging
  console.log(`FileExplorer render: ${Object.keys(files).length} files, refreshTrigger: ${refreshTrigger}`);
  
  const activeFile = state.tabs.find(tab => tab.isActive)?.file;

  const selectFile = (path: string) => {
    const fileData = modules[path];
    if (fileData) {
      const language = getLanguageFromPath(path);
      
      // Log file open interaction
      loggers.ui('file_opened', {
        filePath: path,
        language,
        fileSize: fileData.code.length,
        projectId: state.currentProject?.id
      }, state.currentProject?.id);
      
      openTab(path, fileData.code, language);
    }
  };

  const toggleDirectory = (path: string) => {
    const isOpening = !openDirectories.has(path);
    
    // Log directory interaction
    loggers.ui('directory_toggled', {
      directoryPath: path,
      action: isOpening ? 'expand' : 'collapse',
      projectId: state.currentProject?.id
    }, state.currentProject?.id);
    
    setOpenDirectories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'json':
        return 'json';
      case 'css':
        return 'css';
      case 'md':
        return 'markdown';
      case 'html':
        return 'html';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="sp-file-explorer h-full bg-[#151515] text-[#999999] overflow-auto">
      {/* Header */}
      <div className="sp-file-explorer-header flex items-center justify-between px-3 py-2 border-b border-[#2F2F2F] text-xs font-medium text-[#808080] uppercase tracking-wide">
        <span>Files</span>
        <button className="hover:text-[#C5C5C5]" title="More options">
          ⋯
        </button>
      </div>
      
      {/* Module List */}
      <div className="sp-file-explorer-content py-2 px-2">
        <SandpackModuleList
          files={modules}
          selectFile={selectFile}
          activeFile={activeFile}
          openDirectories={openDirectories}
          toggleDirectory={toggleDirectory}
        />
      </div>
    </div>
  );
};