import React, { useState, useRef, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { ChatMessage } from './ChatMessage'
import { AgentStatus } from './AgentStatus'
import { Send, Settings, Pause, Play } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/types'
import { enhancedChatService } from '@/services/enhanced-chat-service'
import { loggers } from '@/services/logging-system'

export const ChatPanel: React.FC = () => {
  const state = useSnapshot(appStore)
  const { addChatMessage, toggleKnowledgeBase } = useAppStore()
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const modes: Array<{ id: typeof state.chatMode; label: string; active?: boolean }> = [
    { id: 'generate', label: 'Generate', active: state.chatMode === 'generate' },
    { id: 'explain', label: 'Explain', active: state.chatMode === 'explain' },
    { id: 'ask', label: 'Ask', active: state.chatMode === 'ask' },
  ]

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chatMessages])

  const sendMessage = async () => {
    if (!input.trim() || isGenerating) return

    const messageContent = input.trim()
    const action = state.chatMode === 'generate' ? 'generate' : 
                  state.chatMode === 'explain' ? 'explain' : 'generate'

    // Log user interaction
    loggers.ui('chat_message_input', {
      messageLength: messageContent.length,
      mode: state.chatMode,
      hasSelection: !!state.currentSelection,
      projectId: state.currentProject?.id
    }, state.currentProject?.id)

    setInput('')
    setIsGenerating(true)

    try {
      // Use enhanced chat service with Claude Code integration
      await enhancedChatService.sendMessage(messageContent, action, false)
      
      loggers.ui('chat_message_sent_success', {
        action,
        messageLength: messageContent.length
      }, state.currentProject?.id)
    } catch (error) {
      loggers.error('chat_message_send_failed', error as Error, {
        messageContent: messageContent.substring(0, 100),
        action
      }, state.currentProject?.id)

      // Add error message to chat
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Error:** ${(error as Error).message}`,
        type: 'generation',
        timestamp: new Date(),
        agentId: 'system'
      }
      addChatMessage(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        sendMessage()
      } else if (!e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    }
  }

  const getPlaceholder = () => {
    switch (state.chatMode) {
      case 'generate':
        return 'Describe what you want to build...'
      case 'explain':
        return 'Ask about the code or architecture...'
      case 'ask':
        return 'Ask Constellation agents...'
      default:
        return 'Ask Constellation agents...'
    }
  }

  return (
    <div className="chat-panel w-[450px] bg-constellation-bg-secondary border-r border-constellation-border flex flex-col">
      {/* Chat Header */}
      <div className="chat-header p-4 border-b border-constellation-border">
        <div className="mb-1">
          <h3 className="text-base font-medium text-constellation-text-primary">Constellation AI</h3>
          <p className="text-xs text-constellation-text-secondary">Multi-Agent System</p>
        </div>
        
        {/* Mode Controls */}
        <div className="chat-controls flex gap-2 mt-3">
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`chat-control px-3 py-1 text-xs rounded border transition-colors flex items-center gap-1.5 ${
                mode.active
                  ? 'border-constellation-accent-green text-constellation-accent-green bg-constellation-accent-green bg-opacity-10'
                  : 'border-constellation-border text-constellation-text-secondary hover:text-constellation-text-primary hover:border-constellation-text-tertiary'
              }`}
              onClick={() => {
                loggers.ui('chat_mode_changed', { from: state.chatMode, to: mode.id }, state.currentProject?.id)
                appStore.chatMode = mode.id
              }}
            >
              {mode.active && (
                <div className="w-3 h-3 bg-constellation-accent-green rounded-sm" />
              )}
              {mode.label}
            </button>
          ))}
          
          {/* Autonomous Mode Toggle */}
          {enhancedChatService.isAutonomousModeEnabled() ? (
            <button
              className="px-3 py-1 text-xs rounded border border-constellation-accent-yellow text-constellation-accent-yellow bg-constellation-accent-yellow bg-opacity-10 flex items-center gap-1.5"
              onClick={() => {
                loggers.ui('autonomous_mode_paused', {}, state.currentProject?.id)
                enhancedChatService.pauseAutonomousMode()
              }}
            >
              <Pause size={12} />
              Autonomous
            </button>
          ) : (
            <button
              className="px-3 py-1 text-xs rounded border border-constellation-border text-constellation-text-secondary hover:text-constellation-text-primary hover:border-constellation-text-tertiary flex items-center gap-1.5"
              onClick={() => {
                loggers.ui('autonomous_mode_enabled', {}, state.currentProject?.id)
                enhancedChatService.resumeAutonomousMode()
              }}
            >
              <Play size={12} />
              Auto
            </button>
          )}
        </div>
      </div>

      {/* Agent Status */}
      <AgentStatus />

      {/* Messages */}
      <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-4">
        {state.chatMessages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isGenerating && (
          <div className="flex items-center gap-2 text-constellation-text-secondary text-sm">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-constellation-accent-blue rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-constellation-accent-green rounded-full animate-pulse delay-100" />
              <div className="w-2 h-2 bg-constellation-accent-yellow rounded-full animate-pulse delay-200" />
            </div>
            Agents are working...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-container p-4 border-t border-constellation-border">
        {/* Knowledge Base Indicator */}
        <div className="kb-indicator flex items-center gap-2 px-3 py-2 bg-constellation-bg-tertiary rounded-md mb-3 text-xs">
          <div className="kb-status w-2 h-2 bg-constellation-success rounded-full" />
          <span className="text-constellation-text-secondary">Knowledge Base: Active</span>
          <button 
            className="ml-auto text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
            onClick={toggleKnowledgeBase}
          >
            <Settings size={12} />
          </button>
        </div>

        {/* Context Indicator */}
        {state.currentSelection && (
          <div className="mb-3">
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-constellation-bg-tertiary rounded text-xs text-constellation-text-secondary">
              <span>Context: {state.currentSelection.file}</span>
              <span className="text-constellation-text-tertiary">
                (lines {state.currentSelection.lines.start}-{state.currentSelection.lines.end})
              </span>
            </div>
          </div>
        )}

        {/* Input Field */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className="chat-input w-full min-h-[60px] max-h-32 p-3 bg-constellation-bg-tertiary border border-constellation-border rounded-lg text-constellation-text-primary text-sm resize-none focus:outline-none focus:border-constellation-accent-blue placeholder-constellation-text-tertiary"
            disabled={isGenerating}
          />
          
          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isGenerating}
            className="absolute bottom-2 right-2 p-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-md hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Send size={14} />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <div className="flex gap-2">
            {state.chatMode === 'explain' && (
              <>
                <button
                  className="text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                  onClick={() => setInput('How does the authentication flow work?')}
                >
                  Auth Flow
                </button>
                <button
                  className="text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                  onClick={() => setInput('Explain the service architecture')}
                >
                  Architecture
                </button>
              </>
            )}
            
            {state.chatMode === 'ask' && (
              <>
                <button
                  className="text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                  onClick={() => setInput('What APIs does this service expose?')}
                >
                  API List
                </button>
                <button
                  className="text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
                  onClick={() => setInput('How do I test this feature?')}
                >
                  Testing
                </button>
              </>
            )}
          </div>
          
          <span className="text-constellation-text-tertiary">
            {input.trim() ? 'Enter to send • Shift+Enter for new line' : 'Ctrl+Enter to send'}
          </span>
        </div>
      </div>
    </div>
  )
}