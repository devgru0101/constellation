import React from 'react';
import { X, Plus, Minus, FileText } from 'lucide-react';

interface FileDiff {
  path: string;
  oldContent?: string;
  newContent?: string;
  type: 'added' | 'modified' | 'deleted';
}

interface CommitDiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  commitId: string;
  commitMessage: string;
  diffs: FileDiff[];
}

export const CommitDiffViewer: React.FC<CommitDiffViewerProps> = ({
  isOpen,
  onClose,
  commitId,
  commitMessage,
  diffs
}) => {
  if (!isOpen) return null;

  const renderLineDiff = (oldContent: string = '', newContent: string = '') => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    const diffLines = [];
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (oldLine === newLine) {
        // Unchanged line
        diffLines.push({
          type: 'unchanged',
          oldLineNum: i + 1,
          newLineNum: i + 1,
          content: oldLine
        });
      } else {
        // Changed lines
        if (oldLine) {
          diffLines.push({
            type: 'removed',
            oldLineNum: i + 1,
            newLineNum: null,
            content: oldLine
          });
        }
        if (newLine) {
          diffLines.push({
            type: 'added',
            oldLineNum: null,
            newLineNum: i + 1,
            content: newLine
          });
        }
      }
    }
    
    return diffLines;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-constellation-bg-primary border border-constellation-border rounded-lg w-[90%] h-[90%] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-constellation-border">
          <div>
            <h2 className="text-lg font-semibold text-constellation-text-primary">
              Commit Diff
            </h2>
            <div className="text-sm text-constellation-text-secondary">
              <span className="font-mono">{commitId.substring(0, 8)}</span> • {commitMessage}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-constellation-bg-secondary rounded"
          >
            <X className="w-5 h-5 text-constellation-text-secondary" />
          </button>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/4 border-r border-constellation-border p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-constellation-text-primary mb-3">
              Changed Files ({diffs.length})
            </h3>
            <div className="space-y-1">
              {diffs.map((diff, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded hover:bg-constellation-bg-secondary cursor-pointer"
                >
                  {diff.type === 'added' && (
                    <Plus className="w-4 h-4 text-green-400" />
                  )}
                  {diff.type === 'modified' && (
                    <FileText className="w-4 h-4 text-yellow-400" />
                  )}
                  {diff.type === 'deleted' && (
                    <Minus className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-sm text-constellation-text-primary truncate">
                    {diff.path}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Diff Content */}
          <div className="flex-1 overflow-y-auto">
            {diffs.map((diff, index) => (
              <div key={index} className="border-b border-constellation-border">
                {/* File Header */}
                <div className="bg-constellation-bg-secondary p-3 border-b border-constellation-border">
                  <div className="flex items-center gap-2">
                    {diff.type === 'added' && (
                      <>
                        <Plus className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm font-medium">Added</span>
                      </>
                    )}
                    {diff.type === 'modified' && (
                      <>
                        <FileText className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 text-sm font-medium">Modified</span>
                      </>
                    )}
                    {diff.type === 'deleted' && (
                      <>
                        <Minus className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-sm font-medium">Deleted</span>
                      </>
                    )}
                    <span className="text-constellation-text-primary font-mono">
                      {diff.path}
                    </span>
                  </div>
                </div>

                {/* File Content */}
                <div className="font-mono text-sm">
                  {diff.type === 'added' && (
                    <div className="bg-green-500 bg-opacity-10 p-4">
                      <pre className="text-green-400 whitespace-pre-wrap">
                        {diff.newContent || ''}
                      </pre>
                    </div>
                  )}
                  
                  {diff.type === 'deleted' && (
                    <div className="bg-red-500 bg-opacity-10 p-4">
                      <pre className="text-red-400 whitespace-pre-wrap">
                        {diff.oldContent || ''}
                      </pre>
                    </div>
                  )}
                  
                  {diff.type === 'modified' && (
                    <div>
                      {renderLineDiff(diff.oldContent, diff.newContent).map((line, lineIndex) => (
                        <div
                          key={lineIndex}
                          className={`flex ${
                            line.type === 'added' ? 'bg-green-500 bg-opacity-10' :
                            line.type === 'removed' ? 'bg-red-500 bg-opacity-10' :
                            'bg-constellation-bg-primary'
                          }`}
                        >
                          {/* Line Numbers */}
                          <div className="flex">
                            <div className="w-12 text-right pr-2 py-1 text-constellation-text-tertiary border-r border-constellation-border">
                              {line.oldLineNum || ''}
                            </div>
                            <div className="w-12 text-right pr-2 py-1 text-constellation-text-tertiary border-r border-constellation-border">
                              {line.newLineNum || ''}
                            </div>
                          </div>
                          
                          {/* Change Indicator */}
                          <div className="w-6 flex items-center justify-center py-1">
                            {line.type === 'added' && (
                              <Plus className="w-3 h-3 text-green-400" />
                            )}
                            {line.type === 'removed' && (
                              <Minus className="w-3 h-3 text-red-400" />
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className={`flex-1 py-1 pr-4 ${
                            line.type === 'added' ? 'text-green-400' :
                            line.type === 'removed' ? 'text-red-400' :
                            'text-constellation-text-primary'
                          }`}>
                            <pre className="whitespace-pre-wrap">{line.content}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {diffs.length === 0 && (
              <div className="flex items-center justify-center h-full text-constellation-text-tertiary">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No changes in this commit</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};