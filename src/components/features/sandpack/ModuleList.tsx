import React from 'react';
import type { ModuleList } from './types';
import { getDirectChildren, isDirectory, createDirectoryTree } from './utils';
import { SandpackFile } from './File';
import { SandpackDirectory } from './Directory';

interface ModuleListProps {
  files: ModuleList;
  selectFile: (path: string) => void;
  activeFile?: string;
  openDirectories: Set<string>;
  toggleDirectory: (path: string) => void;
}

export const SandpackModuleList: React.FC<ModuleListProps> = ({
  files,
  selectFile,
  activeFile,
  openDirectories,
  toggleDirectory,
}) => {
  // Get root level items
  const rootChildren = getDirectChildren('', files);
  
  return (
    <div className="sp-module-list">
      {rootChildren.map((path) => {
        const isDir = isDirectory(path, files);
        
        if (isDir) {
          return (
            <SandpackDirectory
              key={path}
              path={path}
              selectFile={selectFile}
              files={files}
              prefixedPath={activeFile || ''}
              depth={0}
              isDirOpen={openDirectories.has(path)}
              toggleDirectory={toggleDirectory}
              openDirectories={openDirectories}
            />
          );
        } else {
          return (
            <SandpackFile
              key={path}
              path={path}
              selectFile={selectFile}
              active={path === activeFile}
              depth={0}
            />
          );
        }
      })}
    </div>
  );
};