import React, { useRef } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { Editor } from '@monaco-editor/react'
import { X, Plus } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { FileExplorer } from './FileExplorer'

export const CodeEditor: React.FC = () => {
  const state = useSnapshot(appStore)
  const { closeTab, updateTabContent, setCurrentSelection } = useAppStore()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  // No demo files - clean start

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    
    // Configure editor theme
    editor.updateOptions({
      theme: 'vs-dark',
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      lineHeight: 1.5,
      minimap: { enabled: true, side: 'right' },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
    })

    // Listen for selection changes
    editor.onDidChangeCursorSelection(() => {
      const model = editor.getModel()
      if (!model) return

      const selection = editor.getSelection()
      if (!selection || selection.isEmpty()) {
        setCurrentSelection(null)
        return
      }

      const selectedText = model.getValueInRange(selection)
      const activeTab = state.tabs.find(tab => tab.isActive)
      
      if (activeTab && selectedText.trim()) {
        setCurrentSelection({
          file: activeTab.file,
          service: extractServiceName(activeTab.file),
          code: selectedText,
          lines: {
            start: selection.startLineNumber,
            end: selection.endLineNumber
          }
        })
      }
    })
  }

  const extractServiceName = (filePath: string): string => {
    const match = filePath.match(/services\/([^\/]+)\//)
    return match ? match[1] : 'unknown'
  }

  const activeTab = state.tabs.find(tab => tab.isActive)

  return (
    <div className="code-editor flex h-full">
      {/* File Explorer */}
      <FileExplorer />

      {/* Editor Area */}
      <div className="editor-area flex flex-col flex-1">
        {/* Editor Tabs */}
        <div className="editor-tabs flex bg-constellation-bg-secondary border-b border-constellation-border px-2 overflow-x-auto">
          {state.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`editor-tab flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-r border-constellation-border last:border-r-0 whitespace-nowrap ${
              tab.isActive
                ? 'bg-constellation-bg-primary text-constellation-text-primary'
                : 'bg-constellation-bg-tertiary text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-primary'
            }`}
            onClick={() => {
              // Deactivate all tabs
              appStore.tabs.forEach(t => { t.isActive = false })
              // Activate clicked tab
              const tabToActivate = appStore.tabs.find(t => t.id === tab.id)
              if (tabToActivate) {
                tabToActivate.isActive = true
                appStore.activeTab = tab.id
              }
            }}
          >
            {/* File Icon */}
            <div className={`w-2 h-2 rounded-full ${getFileTypeColor(tab.language)}`} />
            
            {/* File Name */}
            <span className="flex-1">{tab.file.split('/').pop()}</span>
            
            {/* Dirty Indicator */}
            {tab.isDirty && (
              <div className="w-1.5 h-1.5 rounded-full bg-constellation-accent-yellow" />
            )}
            
            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              className="text-constellation-text-tertiary hover:text-constellation-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        
        {/* New Tab Button */}
        <button
          className="new-tab-btn flex items-center justify-center w-8 h-8 text-constellation-text-tertiary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary transition-colors"
          title="New file"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Editor Content */}
      <div className="editor-content flex-1 relative">
        {activeTab ? (
          <Editor
            language={activeTab.language}
            value={activeTab.content}
            onChange={(value) => {
              if (value !== undefined) {
                updateTabContent(activeTab.id, value)
              }
            }}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              lineHeight: 1.5,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-constellation-text-secondary">
            <div className="text-center">
              <div className="mb-4 text-4xl">📝</div>
              <div className="text-lg font-medium mb-2">No files open</div>
              <div className="text-sm">Select a file from the explorer or create a new one</div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {activeTab && (
        <div className="status-bar flex items-center justify-between px-4 py-1 bg-constellation-bg-secondary border-t border-constellation-border text-xs text-constellation-text-secondary">
          <div className="flex items-center gap-4">
            <span>{activeTab.file}</span>
            <span>{activeTab.language}</span>
            {state.currentSelection && (
              <span>
                Line {state.currentSelection.lines.start}-{state.currentSelection.lines.end}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>Spaces: 2</span>
            <span>UTF-8</span>
            <span>LF</span>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

const getFileTypeColor = (language: string): string => {
  switch (language) {
    case 'typescript':
      return 'bg-blue-500'
    case 'javascript':
      return 'bg-yellow-500'
    case 'json':
      return 'bg-green-500'
    case 'sql':
      return 'bg-orange-500'
    case 'yaml':
      return 'bg-purple-500'
    default:
      return 'bg-gray-500'
  }
}

