import React from 'react';
import type { FileProps } from './types';
import { getFileName } from './utils';
import { EntryIcon } from './components/EntryIcon';

export const SandpackFile: React.FC<FileProps> = ({
  path,
  selectFile,
  active,
  depth,
}) => {
  const fileName = getFileName(path);

  return (
    <button
      className={`
        sp-file w-full text-left border-0 rounded-none p-0 mb-1 bg-transparent
        ${active 
          ? 'text-[#90e86f] bg-[#2F2F2F]' 
          : 'text-[#999999] hover:text-[#C5C5C5] hover:bg-[#252525]'
        }
      `}
      style={{ paddingLeft: `${18 * depth}px` }}
      onClick={() => selectFile(path)}
      title={fileName}
      type="button"
      data-active={active}
    >
      <div className="flex items-center">
        <div className="mr-1">
          <EntryIcon filename={fileName} />
        </div>
        <span className="truncate whitespace-nowrap overflow-hidden">
          {fileName}
        </span>
      </div>
    </button>
  );
};