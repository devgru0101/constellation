import React, { useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { claudeCodeAPI } from '@/services/claude-code-api'
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileText, 
  Settings, 
  Code, 
  Database,
  Image,
  FileArchive,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  Loader2
} from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  isExpanded?: boolean
  size?: number
  lastModified?: Date
}

export const FileExplorer: React.FC = () => {
  const state = useSnapshot(appStore)
  const { addTab } = useAppStore()
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Load file tree when current project changes
  useEffect(() => {
    if (state.currentProject?.id) {
      loadFileTree()
    } else {
      setFileTree([])
    }
  }, [state.currentProject?.id])

  // Listen for file tree refresh events
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      console.log('📁 FileExplorer: Received refresh event:', event.detail)
      loadFileTree()
    }

    window.addEventListener('refresh-file-tree', handleRefresh as EventListener)
    return () => {
      window.removeEventListener('refresh-file-tree', handleRefresh as EventListener)
    }
  }, [])

  const loadFileTree = async () => {
    if (!state.currentProject?.id) return

    setLoading(true)
    try {
      console.log('📁 FileExplorer: Loading file tree for project:', state.currentProject.id)
      
      // Get files from workspace API
      const files = await claudeCodeAPI.syncFiles(state.currentProject.id)
      console.log('📁 FileExplorer: Retrieved files:', files)
      
      // Build file tree structure
      const tree = buildFileTree(files)
      setFileTree(tree)
      
      console.log('📁 FileExplorer: File tree updated:', tree)
    } catch (error) {
      console.error('📁 FileExplorer: Failed to load file tree:', error)
    } finally {
      setLoading(false)
    }
  }

  const buildFileTree = (files: { [path: string]: string }): FileNode[] => {
    const root: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

    // Sort paths to ensure directories come before files
    const sortedPaths = Object.keys(files).sort()

    for (const filePath of sortedPaths) {
      const parts = filePath.split('/').filter(part => part.length > 0)
      let currentPath = ''
      let currentLevel = root

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const isLastPart = i === parts.length - 1
        const isDirectory = !isLastPart

        let existingNode = pathMap.get(currentPath)
        
        if (!existingNode) {
          const node: FileNode = {
            name: part,
            path: currentPath,
            type: isDirectory ? 'directory' : 'file',
            children: isDirectory ? [] : undefined,
            isExpanded: expandedFolders.has(currentPath)
          }

          pathMap.set(currentPath, node)
          currentLevel.push(node)
          
          if (isDirectory) {
            currentLevel = node.children!
          }
        } else if (isDirectory) {
          currentLevel = existingNode.children!
        }
      }
    }

    return root.sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath)
    } else {
      newExpanded.add(folderPath)
    }
    setExpandedFolders(newExpanded)
  }

  const handleFileClick = async (file: FileNode) => {
    if (file.type === 'directory') {
      toggleFolder(file.path)
    } else {
      // Open file in editor
      try {
        console.log('📁 FileExplorer: Opening file:', file.path)
        
        // Get file content from workspace
        const files = await claudeCodeAPI.syncFiles(state.currentProject!.id)
        const content = files[file.path] || ''
        
        // Add tab to editor
        addTab({
          id: `file-${file.path}`,
          file: file.path,
          content,
          language: getLanguageFromPath(file.path),
          isActive: true,
          isDirty: false
        })
        
        console.log('📁 FileExplorer: File opened in editor:', file.path)
      } catch (error) {
        console.error('📁 FileExplorer: Failed to open file:', error)
      }
    }
  }

  const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'ts': return 'typescript'
      case 'tsx': return 'typescript'
      case 'js': return 'javascript'
      case 'jsx': return 'javascript'
      case 'json': return 'json'
      case 'md': return 'markdown'
      case 'html': return 'html'
      case 'css': return 'css'
      case 'scss': return 'scss'
      case 'sql': return 'sql'
      case 'yaml': case 'yml': return 'yaml'
      case 'xml': return 'xml'
      case 'py': return 'python'
      case 'go': return 'go'
      case 'rs': return 'rust'
      case 'java': return 'java'
      case 'cpp': case 'cc': case 'cxx': return 'cpp'
      case 'c': return 'c'
      case 'h': return 'c'
      case 'php': return 'php'
      case 'rb': return 'ruby'
      case 'sh': return 'shell'
      case 'dockerfile': return 'dockerfile'
      default: return 'plaintext'
    }
  }

  const getFileIcon = (file: FileNode) => {
    if (file.type === 'directory') {
      return expandedFolders.has(file.path) ? FolderOpen : Folder
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'ts': case 'tsx': case 'js': case 'jsx': return Code
      case 'json': case 'yaml': case 'yml': return Settings
      case 'sql': return Database
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return Image
      case 'zip': case 'tar': case 'gz': return FileArchive
      case 'md': case 'txt': return FileText
      default: return File
    }
  }

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const Icon = getFileIcon(node)
    const isExpanded = expandedFolders.has(node.path)
    
    return (
      <div key={node.path}>
        <div
          className="file-node flex items-center gap-2 py-1 px-2 hover:bg-constellation-bg-tertiary cursor-pointer rounded text-sm"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => handleFileClick(node)}
        >
          {node.type === 'directory' && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={12} className="text-constellation-text-tertiary" />
              ) : (
                <ChevronRight size={12} className="text-constellation-text-tertiary" />
              )}
            </div>
          )}
          
          <Icon 
            size={14} 
            className={`flex-shrink-0 ${
              node.type === 'directory' 
                ? 'text-constellation-accent-blue' 
                : 'text-constellation-text-secondary'
            }`} 
          />
          
          <span className="text-constellation-text-primary truncate">
            {node.name}
          </span>
        </div>
        
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!state.currentProject) {
    return (
      <div className="file-explorer w-64 flex-shrink-0 bg-constellation-bg-secondary border-r border-constellation-border">
        <div className="p-4 text-center">
          <Folder size={32} className="text-constellation-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-constellation-text-secondary">
            No project selected
          </p>
          <p className="text-xs text-constellation-text-tertiary mt-1">
            Create or select a project to view files
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="file-explorer w-64 flex-shrink-0 bg-constellation-bg-secondary border-r border-constellation-border flex flex-col">
      {/* Header */}
      <div className="file-explorer-header p-3 border-b border-constellation-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-constellation-text-primary">
            File Explorer
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={loadFileTree}
              disabled={loading}
              className="p-1 text-constellation-text-tertiary hover:text-constellation-text-primary transition-colors disabled:opacity-50"
              title="Refresh files"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
            </button>
            <button
              className="p-1 text-constellation-text-tertiary hover:text-constellation-text-primary transition-colors"
              title="New file"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <p className="text-xs text-constellation-text-secondary mt-1">
          {state.currentProject.name}
        </p>
      </div>

      {/* File Tree */}
      <div className="file-tree flex-1 overflow-y-auto p-2">
        {loading && fileTree.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin text-constellation-accent-blue mr-2" />
            <span className="text-sm text-constellation-text-secondary">Loading files...</span>
          </div>
        ) : fileTree.length > 0 ? (
          <div className="space-y-1">
            {fileTree.map(node => renderFileNode(node))}
          </div>
        ) : (
          <div className="text-center p-8">
            <File size={32} className="text-constellation-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-constellation-text-secondary">
              No files found
            </p>
            <p className="text-xs text-constellation-text-tertiary mt-1">
              Files will appear here when Claude Code generates them
            </p>
          </div>
        )}
      </div>
    </div>
  )
}