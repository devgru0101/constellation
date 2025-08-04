import React from 'react'
import { useSnapshot } from 'valtio'
import { appStore } from '@/stores/app-store'
import { Copy, MoreHorizontal, ThumbsUp, ThumbsDown, GitCommit, RotateCcw, Eye } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const state = useSnapshot(appStore)
  
  const agent = message.agentId 
    ? state.agents.find(a => a.id === message.agentId)
    : null

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // In a real app, show a toast notification
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCommitAction = async (action: 'view' | 'restore', commitId: string) => {
    if (!state.currentProject) return;
    
    try {
      const { gitService } = await import('@/services/git-service');
      
      if (action === 'view') {
        // Open Git panel and highlight this commit
        const gitPanelEvent = new CustomEvent('open-git-panel', {
          detail: { highlightCommit: commitId }
        });
        window.dispatchEvent(gitPanelEvent);
      } else if (action === 'restore') {
        // Restore to this commit
        const files = await gitService.rollbackToCommit(state.currentProject.id, commitId);
        
        // Refresh file tree
        const { appStore } = await import('@/stores/app-store');
        appStore.projectFiles = files;
        
        const refreshEvent = new CustomEvent('refresh-file-tree', {
          detail: { projectId: state.currentProject.id }
        });
        window.dispatchEvent(refreshEvent);
        
        // Show success message (in a real app, show toast)
        console.log(`Restored to commit ${commitId.substring(0, 8)}`);
      }
    } catch (error) {
      console.error('Failed to handle commit action:', error);
    }
  }

  const formatContent = (content: string) => {
    // Check if this message contains commit markers
    const hasCommitMarker = content.includes('📝 **Commit ID**');
    
    if (hasCommitMarker) {
      // Extract commit ID from content
      const commitMatch = content.match(/📝 \*\*Commit ID\*\*: `([^`]+)`/);
      const commitId = commitMatch?.[1];
      
      if (commitId) {
        // Return JSX for commit markers instead of HTML string
        const parts = content.split('📝 **Commit ID**');
        return (
          <div>
            <div dangerouslySetInnerHTML={{
              __html: parts[0]
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 bg-constellation-bg-tertiary rounded text-xs">$1</code>')
                .replace(/\n/g, '<br>')
            }} />
            
            {/* Commit Action Buttons */}
            <div className="flex items-center gap-2 mt-3 p-3 bg-constellation-bg-secondary border border-constellation-border rounded-lg">
              <GitCommit className="w-4 h-4 text-constellation-accent-green" />
              <span className="text-sm font-medium text-constellation-text-primary">
                Commit ID: <code className="px-1 py-0.5 bg-constellation-bg-tertiary rounded text-xs">{commitId}</code>
              </span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => handleCommitAction('view', commitId)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-constellation-bg-tertiary border border-constellation-border rounded hover:bg-constellation-bg-primary transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View Changes
                </button>
                <button
                  onClick={() => handleCommitAction('restore', commitId)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-constellation-accent-blue bg-opacity-10 border border-constellation-accent-blue border-opacity-30 text-constellation-accent-blue rounded hover:bg-opacity-20 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore
                </button>
              </div>
            </div>
          </div>
        );
      }
    }
    
    // Basic markdown-like formatting for regular messages
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 bg-constellation-bg-tertiary rounded text-xs">$1</code>')
      .replace(/•(.*?)(?=\n|$)/g, '<li class="ml-4">$1</li>')
      .replace(/\n/g, '<br>')
  }

  return (
    <div className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`avatar w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
          message.role === 'user' 
            ? 'bg-constellation-accent-blue text-constellation-bg-primary' 
            : 'bg-constellation-bg-tertiary text-constellation-text-primary border border-constellation-border'
        }`}>
          {message.role === 'user' ? 'U' : (agent?.name.charAt(0) || 'A')}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-constellation-text-primary text-sm">
              {message.role === 'user' ? 'You' : (agent?.name || 'Constellation')}
            </span>
            
            {/* Message Type Badge */}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-constellation-border text-constellation-text-secondary">
              {message.type}
            </span>
            
            {/* Timestamp */}
            <span className="text-xs text-constellation-text-tertiary">
              {formatTime(message.timestamp)}
            </span>
          </div>

          {/* Agent Role (for assistant messages) */}
          {message.role === 'assistant' && agent && (
            <div className="text-xs text-constellation-text-secondary mb-2">
              {agent.role}
            </div>
          )}

          {/* Message Content */}
          <div className={`content text-sm leading-relaxed ${
            message.role === 'user' 
              ? 'text-constellation-text-primary' 
              : 'text-constellation-text-primary'
          }`}>
            {message.role === 'assistant' ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: formatContent(message.content)
                }}
              />
            ) : (
              message.content
            )}
          </div>

          {/* Context Info */}
          {message.context && (
            <div className="mt-2 p-2 bg-constellation-bg-tertiary rounded text-xs text-constellation-text-secondary border border-constellation-border">
              <div className="flex items-center gap-1">
                <span>📁 {message.context.file}</span>
                {message.context.service && (
                  <span>• Service: {message.context.service}</span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {message.role === 'assistant' && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => copyToClipboard(message.content)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                title="Copy to clipboard"
              >
                <Copy size={12} />
                Copy
              </button>
              
              <button
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                title="Helpful"
              >
                <ThumbsUp size={12} />
              </button>
              
              <button
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                title="Not helpful"
              >
                <ThumbsDown size={12} />
              </button>
              
              <button
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                title="More actions"
              >
                <MoreHorizontal size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}