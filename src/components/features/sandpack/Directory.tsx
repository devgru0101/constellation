import React from 'react';
import type { DirectoryProps } from './types';
import { getFileName, getDirectChildren, isDirectory } from './utils';
import { SandpackFile } from './File';
import { EntryIcon } from './components/EntryIcon';

interface ExtendedDirectoryProps extends DirectoryProps {
  openDirectories: Set<string>;
}

export const SandpackDirectory: React.FC<ExtendedDirectoryProps> = ({
  path,
  selectFile,
  files,
  prefixedPath,
  depth,
  isDirOpen,
  toggleDirectory,
  openDirectories,
}) => {
  const dirName = getFileName(path) || path;
  const children = getDirectChildren(path, files);
  
  const handleToggle = () => {
    toggleDirectory(path);
  };

  return (
    <div className="sp-directory">
      {/* Directory Header */}
      <button
        className={`
          sp-directory-button w-full text-left border-0 rounded-none p-0 mb-1 bg-transparent
          text-[#999999] hover:text-[#C5C5C5] hover:bg-[#252525]
        `}
        style={{ paddingLeft: `${18 * depth}px` }}
        onClick={handleToggle}
        title={path}
        type="button"
      >
        <div className="flex items-center">
          <div className="mr-1">
            <EntryIcon 
              filename={dirName} 
              isDirectory={true} 
              isOpen={isDirOpen} 
            />
          </div>
          <span className="truncate whitespace-nowrap overflow-hidden">
            {dirName}
          </span>
        </div>
      </button>

      {/* Directory Contents */}
      {isDirOpen && (
        <div className="sp-directory-content">
          {children.map((childPath) => {
            const isChildDirectory = isDirectory(childPath, files);
            
            if (isChildDirectory) {
              return (
                <SandpackDirectory
                  key={childPath}
                  path={childPath}
                  selectFile={selectFile}
                  files={files}
                  prefixedPath={prefixedPath}
                  depth={depth + 1}
                  isDirOpen={openDirectories.has(childPath)}
                  toggleDirectory={toggleDirectory}
                  openDirectories={openDirectories}
                />
              );
            } else {
              const activeFile = Object.keys(files).find(f => f === childPath);
              return (
                <SandpackFile
                  key={childPath}
                  path={childPath}
                  selectFile={selectFile}
                  active={activeFile === prefixedPath}
                  depth={depth + 1}
                />
              );
            }
          })}
        </div>
      )}
    </div>
  );
};