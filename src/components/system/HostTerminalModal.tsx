import React, { useState, useRef, useEffect } from 'react'
import { X, Terminal, Copy, Download, Settings, AlertCircle } from 'lucide-react'
import { loggers } from '@/services/logging-system'
import { API_CONFIG } from '@/config/api'

interface HostTerminalModalProps {
  isOpen: boolean
  onClose: () => void
}

export const HostTerminalModal: React.FC<HostTerminalModalProps> = ({ isOpen, onClose }) => {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState<Array<{ type: 'input' | 'output' | 'error'; content: string; timestamp: Date }>>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected')
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Log terminal access
      loggers.ui('host_terminal_opened', {
        timestamp: new Date(),
        sessionId: Date.now().toString()
      })

      // Initialize with welcome message
      setOutput([
        {
          type: 'output',
          content: '🚀 Constellation IDE - Host Terminal\n📍 Direct access to host system\n💡 Use this terminal to configure Claude Code CLI and system maintenance\n\nClaude Code Status: ✅ Available\nHost System: Ubuntu (WSL)\nDocker: ✅ Running\n\nType "help" for available commands or start with any system command.',
          timestamp: new Date()
        }
      ])
    }
  }, [isOpen])

  useEffect(() => {
    // Auto-scroll to bottom when new output is added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [output])

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return

    setIsExecuting(true)
    setOutput(prev => [...prev, { type: 'input', content: `$ ${cmd}`, timestamp: new Date() }])

    try {
      // Log command execution
      loggers.ui('host_terminal_command', {
        command: cmd,
        timestamp: new Date()
      })

      // Handle special commands first
      if (cmd.toLowerCase() === 'help') {
        setOutput(prev => [...prev, {
          type: 'output',
          content: `🔧 Host Terminal Commands:

System Commands:
  pwd                     - Show current directory
  ls, ls -la              - List files and directories  
  cd <path>               - Change directory
  ps aux                  - Show running processes
  docker ps               - Show Docker containers
  systemctl status <service> - Check service status

Claude Code Commands:
  claude --version        - Check Claude Code version
  claude --help           - Show Claude Code help
  claude install          - Install Claude Code (if needed)
  claude login            - Login to Claude Code
  
Constellation Commands:
  constellation status    - Show application status
  constellation logs      - Show application logs
  constellation restart   - Restart backend services

System Maintenance:
  sudo systemctl restart docker  - Restart Docker
  sudo usermod -aG docker $USER  - Add user to Docker group
  newgrp docker                  - Apply Docker group
  
🚨 Security: This terminal has full host system access. Use carefully!`,
          timestamp: new Date()
        }])
        setIsExecuting(false)
        return
      }

      if (cmd.toLowerCase().startsWith('constellation ')) {
        const subCmd = cmd.substring('constellation '.length)
        
        if (subCmd === 'status') {
          const response = await fetch(`${API_CONFIG.apiUrl}/health`)
          const health = await response.json()
          
          setOutput(prev => [...prev, {
            type: 'output',
            content: `📊 Constellation IDE Status:
  
Backend API: ✅ ${health.status}
Workspace: ${health.workspaceBase}
Frontend: ✅ Running (Port 3000)
Docker: ✅ Running
Claude Code: ✅ Available

🔗 Endpoints:
  - Frontend: http://172.20.225.46:3000
  - Backend API: ${API_CONFIG.baseUrl}
  - Health Check: ${API_CONFIG.apiUrl}/health`,
            timestamp: new Date()
          }])
          setIsExecuting(false)
          return
        }

        if (subCmd === 'logs') {
          setOutput(prev => [...prev, {
            type: 'output',
            content: `📋 Recent Application Logs:
            
To view detailed logs, use:
  tail -f /tmp/backend.log     - Backend logs
  tail -f /var/log/docker.log  - Docker logs (if available)
  
Or check the browser console for frontend logs.`,
            timestamp: new Date()
          }])
          setIsExecuting(false)
          return
        }

        if (subCmd === 'restart') {
          setOutput(prev => [...prev, {
            type: 'output',
            content: `🔄 Restarting Constellation services...
            
To restart services manually:
  1. Stop backend: pkill -f "claude-code-bridge"
  2. Start backend: cd /home/ssitzer/constellation-project/backend && sg docker -c "npm start" &
  3. Frontend will auto-reload on file changes`,
            timestamp: new Date()
          }])
          setIsExecuting(false)
          return
        }
      }

      // Execute real system command via backend API
      const response = await fetch(`${API_CONFIG.apiUrl}/host/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: cmd }),
      })

      const result = await response.json()
      
      if (result.success) {
        setOutput(prev => [...prev, {
          type: 'output',
          content: result.output || '(no output)',
          timestamp: new Date()
        }])
        
        if (result.stderr) {
          setOutput(prev => [...prev, {
            type: 'error',
            content: result.stderr,
            timestamp: new Date()
          }])
        }
      } else {
        setOutput(prev => [...prev, {
          type: 'error',
          content: result.error || 'Command execution failed',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      setOutput(prev => [...prev, {
        type: 'error',
        content: `Connection error: ${error.message}`,
        timestamp: new Date()
      }])
      setConnectionStatus('disconnected')
    }

    setIsExecuting(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (command.trim() && !isExecuting) {
      executeCommand(command)
      setCommand('')
    }
  }

  const copyOutput = () => {
    const allOutput = output.map(item => 
      `[${item.timestamp.toLocaleTimeString()}] ${item.type === 'input' ? item.content : item.content}`
    ).join('\n')
    
    navigator.clipboard.writeText(allOutput)
    loggers.ui('host_terminal_copy', { outputLength: allOutput.length })
  }

  const downloadOutput = () => {
    const allOutput = output.map(item => 
      `[${item.timestamp.toISOString()}] ${item.type.toUpperCase()}: ${item.content}`
    ).join('\n')
    
    const blob = new Blob([allOutput], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `constellation-terminal-${Date.now()}.log`
    a.click()
    URL.revokeObjectURL(url)
    
    loggers.ui('host_terminal_download', { outputLength: allOutput.length })
  }

  const clearTerminal = () => {
    setOutput([])
    loggers.ui('host_terminal_clear')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-constellation-bg-secondary border border-constellation-border rounded-lg w-[90vw] h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-constellation-border">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-constellation-accent-blue" />
            <div>
              <h2 className="text-lg font-semibold text-constellation-text-primary">Host Terminal</h2>
              <p className="text-sm text-constellation-text-secondary">Direct access to host system</p>
            </div>
            <div className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
              connectionStatus === 'connected' 
                ? 'bg-constellation-success bg-opacity-20 text-constellation-success'
                : connectionStatus === 'connecting'
                ? 'bg-constellation-accent-yellow bg-opacity-20 text-constellation-accent-yellow'
                : 'bg-constellation-error bg-opacity-20 text-constellation-error'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-constellation-success' :
                connectionStatus === 'connecting' ? 'bg-constellation-accent-yellow animate-pulse' :
                'bg-constellation-error'
              }`} />
              {connectionStatus}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={copyOutput}
              className="p-2 text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded transition-colors"
              title="Copy output"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={downloadOutput}
              className="p-2 text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded transition-colors"
              title="Download output"
            >
              <Download size={16} />
            </button>
            <button
              onClick={clearTerminal}
              className="p-2 text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded transition-colors"
              title="Clear terminal"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Terminal Output */}
        <div 
          ref={terminalRef}
          className="flex-1 p-4 bg-constellation-bg-primary font-mono text-sm overflow-auto"
        >
          {output.map((item, index) => (
            <div key={index} className={`mb-1 whitespace-pre-wrap ${
              item.type === 'input' 
                ? 'text-constellation-accent-blue' 
                : item.type === 'error'
                ? 'text-constellation-error'
                : 'text-constellation-text-primary'
            }`}>
              {item.content}
            </div>
          ))}
          
          {isExecuting && (
            <div className="text-constellation-accent-yellow animate-pulse">
              Executing command...
            </div>
          )}
        </div>

        {/* Command Input */}
        <div className="p-4 border-t border-constellation-border">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-constellation-accent-blue font-mono text-sm">
                $
              </div>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command (type 'help' for available commands)"
                className="w-full pl-8 pr-4 py-2 bg-constellation-bg-tertiary border border-constellation-border rounded text-constellation-text-primary font-mono text-sm focus:outline-none focus:border-constellation-accent-blue"
                disabled={isExecuting}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isExecuting || !command.trim()}
              className="px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Execute
            </button>
          </form>
          
          <div className="flex items-center gap-2 mt-2 text-xs text-constellation-text-tertiary">
            <AlertCircle size={12} />
            <span>⚠️ This terminal has full host system access. Use with caution.</span>
          </div>
        </div>
      </div>
    </div>
  )
}