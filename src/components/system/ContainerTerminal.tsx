import React, { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { appStore } from '@/stores/app-store'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { claudeCodeAPI } from '@/services/claude-code-api'
import { loggers } from '@/services/logging-system'
import { API_CONFIG } from '@/config/api'
import { Terminal, Loader2, Play } from 'lucide-react'

export const ContainerTerminal: React.FC = () => {
  const state = useSnapshot(appStore)
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [isClaudeCodeActive, setIsClaudeCodeActive] = useState(false)
  const [claudeCodeSession, setClaudeCodeSession] = useState<string | null>(null)

  useEffect(() => {
    if (state.currentProject?.id) {
      initializeTerminal()
    } else {
      cleanup()
    }

    return cleanup
  }, [state.currentProject?.id])

  const initializeTerminal = () => {
    if (!terminalRef.current) return

    // Create terminal instance
    const xterm = new XTerm({
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5'
      },
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      lineHeight: 1.2,
      rows: 30,
      cols: 120,
      cursorBlink: true,
      scrollback: 1000,
      bellStyle: 'none'
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)

    xterm.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Connect to container terminal
    connectToContainer()

    // Handle terminal input
    xterm.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data
        }))
      }
    })

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    // Show welcome message
    xterm.writeln('\x1b[1;36m🚀 Constellation Container Terminal\x1b[0m')
    xterm.writeln('\x1b[36mConnecting to project container...\x1b[0m')
    xterm.writeln('')

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }

  const connectToContainer = async () => {
    if (!state.currentProject?.id) return

    setConnectionStatus('connecting')

    try {
      loggers.container('terminal_connection_started', {
        projectId: state.currentProject.id
      }, state.currentProject.id)

      // Check if container exists and is running
      const workspace = claudeCodeAPI.getWorkspace(state.currentProject.id)
      
      if (!workspace?.containerId) {
        xtermRef.current?.writeln('\x1b[1;33m⚠️  No container found. Creating container...\x1b[0m')
        
        // Create container for the project
        const containerId = await claudeCodeAPI.createContainer(state.currentProject.id, {
          image: 'node:18-alpine',
          ports: [3000, 4000],
          environment: {
            PROJECT_ID: state.currentProject.id,
            PROJECT_NAME: state.currentProject.name,
            CLAUDE_CODE_CLI_INSTALLED: 'true'
          }
        })

        xtermRef.current?.writeln(`\x1b[1;32m✅ Container created: ${containerId}\x1b[0m`)
      }

      // Connect WebSocket to container terminal
      const wsUrl = API_CONFIG.wsUrl.replace('/ws', '/container-terminal')
      const ws = new WebSocket(`${wsUrl}?projectId=${state.currentProject.id}`)
      
      ws.onopen = () => {
        setConnectionStatus('connected')
        xtermRef.current?.writeln('\x1b[1;32m✅ Connected to container terminal\x1b[0m')
        
        // Initialize Claude Code CLI session
        initializeClaudeCodeSession()
        
        loggers.container('terminal_connected', {
          projectId: state.currentProject!.id,
          containerId: workspace?.containerId
        }, state.currentProject!.id)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          switch (message.type) {
            case 'output':
              xtermRef.current?.write(message.data)
              break
            case 'claude-code-output':
              // Special handling for Claude Code CLI output
              xtermRef.current?.write(`\x1b[1;36m[Claude Code]\x1b[0m ${message.data}`)
              setIsClaudeCodeActive(true)
              if (message.sessionId) {
                setClaudeCodeSession(message.sessionId)
              }
              break
            case 'error':
              xtermRef.current?.writeln(`\x1b[1;31m❌ Error: ${message.error}\x1b[0m`)
              break
          }
        } catch (error) {
          console.error('Failed to parse terminal message:', error)
        }
      }

      ws.onclose = () => {
        setConnectionStatus('disconnected')
        setIsClaudeCodeActive(false)
        xtermRef.current?.writeln('\x1b[1;31m❌ Connection lost. Attempting to reconnect...\x1b[0m')
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (state.currentProject?.id) {
            connectToContainer()
          }
        }, 3000)
      }

      ws.onerror = (error) => {
        setConnectionStatus('error')
        xtermRef.current?.writeln('\x1b[1;31m❌ Connection error\x1b[0m')
        console.error('Terminal WebSocket error:', error)
      }

      wsRef.current = ws

    } catch (error) {
      setConnectionStatus('error')
      xtermRef.current?.writeln(`\x1b[1;31m❌ Failed to connect: ${(error as Error).message}\x1b[0m`)
      console.error('Failed to connect to container:', error)
    }
  }

  const initializeClaudeCodeSession = async () => {
    if (!state.currentProject?.id || !wsRef.current) return

    try {
      xtermRef.current?.writeln('\x1b[1;36m🤖 Initializing Claude Code CLI session...\x1b[0m')
      
      // Send command to start Claude Code CLI
      wsRef.current.send(JSON.stringify({
        type: 'command',
        command: 'claude-code --interactive --project-context'
      }))

      // Set up automatic Claude Code session with project context
      if (state.currentProject.knowledgeBase) {
        const contextMessage = `Project: ${state.currentProject.name}
Type: ${state.currentProject.type}
Requirements: ${state.currentProject.knowledgeBase.requirements?.join(', ') || 'None'}
Tech Stack: ${state.currentProject.knowledgeBase.techStack?.join(', ') || 'None'}`

        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({
            type: 'claude-input',
            message: `I'm working on a project called "${state.currentProject!.name}". Here's the context:\n\n${contextMessage}\n\nI'm ready to start building. What should we work on first?`
          }))
        }, 2000)
      }

      loggers.claude('claude_session_initialized', {
        projectId: state.currentProject.id,
        hasKnowledgeBase: !!state.currentProject.knowledgeBase
      }, state.currentProject.id)

    } catch (error) {
      console.error('Failed to initialize Claude Code session:', error)
      xtermRef.current?.writeln('\x1b[1;33m⚠️  Failed to initialize Claude Code CLI\x1b[0m')
    }
  }

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
    }
    
    setConnectionStatus('disconnected')
    setIsClaudeCodeActive(false)
    setClaudeCodeSession(null)
  }

  const handleRestartContainer = async () => {
    if (!state.currentProject?.id) return

    try {
      xtermRef.current?.writeln('\x1b[1;33m🔄 Restarting container...\x1b[0m')
      
      // Restart container through API
      const result = await claudeCodeAPI.executeCommand(
        state.currentProject.id,
        'echo "Container restarted" && claude-code --version',
        false
      )

      if (result.exitCode === 0) {
        xtermRef.current?.writeln('\x1b[1;32m✅ Container restarted successfully\x1b[0m')
        initializeClaudeCodeSession()
      } else {
        xtermRef.current?.writeln('\x1b[1;31m❌ Failed to restart container\x1b[0m')
      }
    } catch (error) {
      xtermRef.current?.writeln('\x1b[1;31m❌ Restart failed\x1b[0m')
      console.error('Failed to restart container:', error)
    }
  }

  if (!state.currentProject) {
    return (
      <div className="container-terminal flex items-center justify-center h-full p-8 text-center">
        <div>
          <Terminal size={48} className="text-constellation-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-constellation-text-primary mb-2">
            No Project Selected
          </h3>
          <p className="text-sm text-constellation-text-secondary">
            Select or create a project to access its container terminal
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container-terminal flex flex-col h-full">
      {/* Status Bar */}
      <div className="terminal-status flex items-center justify-between p-2 bg-constellation-bg-tertiary border-b border-constellation-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-constellation-success' :
              connectionStatus === 'connecting' ? 'bg-constellation-accent-yellow' :
              connectionStatus === 'error' ? 'bg-constellation-error' :
              'bg-constellation-text-tertiary'
            }`} />
            <span className="text-xs text-constellation-text-secondary">
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting' :
               connectionStatus === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
          
          {isClaudeCodeActive && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-constellation-accent-blue" />
              <span className="text-xs text-constellation-text-secondary">
                Claude Code Active
              </span>
              {claudeCodeSession && (
                <span className="text-xs text-constellation-text-tertiary">
                  Session: {claudeCodeSession.substring(0, 8)}...
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handleRestartContainer}
            disabled={connectionStatus !== 'connected'}
            className="p-1 text-constellation-text-tertiary hover:text-constellation-text-primary disabled:opacity-50 transition-colors"
            title="Restart Container"
          >
            {connectionStatus === 'connecting' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className="terminal-container flex-1">
        <div ref={terminalRef} className="h-full" />
      </div>
    </div>
  )
}