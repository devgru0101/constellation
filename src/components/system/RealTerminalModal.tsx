import React, { useEffect, useRef, useState } from 'react'
import { X, Terminal, Copy, Download, Settings, AlertCircle, Maximize2, Minimize2, Shield } from 'lucide-react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { loggers } from '@/services/logging-system'
import { terminalPersistence } from '@/services/terminal-persistence'
import { API_CONFIG } from '@/config/api'

interface RealTerminalModalProps {
  isOpen: boolean
  onClose: () => void
}

export const RealTerminalModal: React.FC<RealTerminalModalProps> = ({ isOpen, onClose }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPersistenceActive, setIsPersistenceActive] = useState(false)
  const [errorRecoveryCount, setErrorRecoveryCount] = useState(0)

  useEffect(() => {
    if (isOpen && terminalRef.current && !xtermRef.current) {
      initializeTerminal()
    }

    return () => {
      cleanup()
    }
  }, [isOpen])

  // Initialize persistence service on component mount
  useEffect(() => {
    const initPersistence = async () => {
      try {
        await terminalPersistence.initialize()
        setIsPersistenceActive(true)
        
        // Setup error recovery
        terminalPersistence.onAppCrash(() => {
          console.log('[Terminal] App crash detected, terminal state preserved')
          setErrorRecoveryCount(prev => prev + 1)
        })
        
        console.log('[Terminal] Persistence initialized')
      } catch (error) {
        console.error('[Terminal] Failed to initialize persistence:', error)
      }
    }
    
    initPersistence()
  }, [])

  useEffect(() => {
    // Handle viewport fitting when fullscreen changes
    if (fitAddonRef.current && xtermRef.current) {
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit()
        if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows
          }))
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isFullscreen])

  const initializeTerminal = () => {
    if (!terminalRef.current) return

    // Log terminal access
    loggers.ui('real_terminal_opened', {
      timestamp: new Date(),
      sessionId: Date.now().toString()
    })

    // Create xterm instance
    const xterm = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#93C0FF',
        selection: 'rgba(147, 192, 255, 0.3)',
        black: '#000000',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#FFE87A',
        blue: '#93C0FF',
        magenta: '#C084FC',
        cyan: '#06B6D4',
        white: '#ffffff',
        brightBlack: '#71717A',
        brightRed: '#F87171',
        brightGreen: '#34D399',
        brightYellow: '#FBBF24',
        brightBlue: '#60A5FA',
        brightMagenta: '#A78BFA',
        brightCyan: '#22D3EE',
        brightWhite: '#F8FAFC'
      },
      fontFamily: '"JetBrains Mono", "SF Mono", "Monaco", "Inconsolata", "Fira Code", "Fira Mono", "Roboto Mono", "Lucida Console", Monaco, monospace',
      fontSize: 14,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      bellStyle: 'none',
      scrollback: 1000,
      tabStopWidth: 4,
      allowTransparency: false
    })

    // Create addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    // Load addons
    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)

    // Open terminal
    xterm.open(terminalRef.current)
    
    // Fit terminal to container with improved sizing
    setTimeout(() => {
      fitAddon.fit()
      // Ensure proper sizing by triggering another fit after DOM updates
      setTimeout(() => fitAddon.fit(), 100)
    }, 50)

    // Store references
    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Show connection message
    xterm.writeln('🚀 \x1b[1;36mConstellation IDE - Real Terminal\x1b[0m')
    xterm.writeln('📍 Connecting to host system...')
    xterm.writeln('')

    // Connect WebSocket
    connectWebSocket(xterm, fitAddon)

    // Handle window resize with debouncing
    let resizeTimer: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (fitAddon && xterm) {
          fitAddon.fit()
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'resize',
              cols: xterm.cols,
              rows: xterm.rows
            }))
          }
        }
      }, 200)
    }

    // Handle modal resize specifically
    const observer = new ResizeObserver(() => {
      handleResize()
    })
    
    if (terminalRef.current) {
      observer.observe(terminalRef.current)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(resizeTimer)
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }

  const connectWebSocket = (xterm: XTerm, fitAddon: FitAddon) => {
    setConnectionStatus('connecting')
    
    const wsUrl = API_CONFIG.wsUrl.replace('/ws', '/terminal')
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      xterm.writeln('✅ \x1b[1;32mConnected to host terminal\x1b[0m')
      xterm.writeln('💡 You now have full access to the host system')
      if (isPersistenceActive) {
        xterm.writeln('🛡️ Terminal state protected by service worker')
      }
      xterm.writeln('')
      
      loggers.ui('real_terminal_connected', {
        timestamp: new Date(),
        websocketUrl: wsUrl,
        persistenceActive: isPersistenceActive
      })
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'connected':
            setTerminalId(data.terminalId)
            // Start persistence tracking
            if (isPersistenceActive) {
              terminalPersistence.startSession(data.terminalId)
              terminalPersistence.updateSession({
                connectionStatus: 'connected',
                isFullscreen
              })
            }
            break
            
          case 'data':
            xterm.write(data.data)
            // Add to persistence history
            if (isPersistenceActive) {
              terminalPersistence.addToHistory(data.data)
            }
            break
            
          case 'exit':
            xterm.writeln(`\r\n\x1b[1;31mTerminal session ended (exit code: ${data.exitCode})\x1b[0m`)
            xterm.writeln('\x1b[1;33mReconnecting...\x1b[0m')
            setTimeout(() => connectWebSocket(xterm, fitAddon), 1000)
            break
            
          default:
            console.warn('Unknown WebSocket message type:', data.type)
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error)
      }
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
      xterm.writeln('\r\n\x1b[1;31m❌ Connection lost\x1b[0m')
      xterm.writeln('\x1b[1;33mTrying to reconnect in 3 seconds...\x1b[0m')
      setTimeout(() => {
        if (xtermRef.current) {
          connectWebSocket(xterm, fitAddon)
        }
      }, 3000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      xterm.writeln('\r\n\x1b[1;31m❌ Connection error\x1b[0m')
    }

    // Handle terminal input
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          data: data
        }))
      }
    })

    // Handle terminal resize
    xterm.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols,
          rows
        }))
      }
    })
  }

  const cleanup = () => {
    // End persistence session
    if (isPersistenceActive) {
      terminalPersistence.endSession()
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
    }
    
    fitAddonRef.current = null
    setConnectionStatus('disconnected')
    setTerminalId(null)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }, 100)
  }

  const reconnect = () => {
    cleanup()
    if (terminalRef.current) {
      initializeTerminal()
    }
  }

  if (!isOpen) return null

  const modalClasses = isFullscreen 
    ? "fixed inset-0 bg-constellation-bg-primary z-50"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"

  const contentClasses = isFullscreen
    ? "w-full h-full flex flex-col"
    : "bg-constellation-bg-secondary border border-constellation-border rounded-lg w-[95vw] h-[85vh] flex flex-col shadow-2xl"

  return (
    <div className={modalClasses}>
      <div className={contentClasses}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-constellation-border bg-constellation-bg-secondary">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-constellation-accent-blue" />
            <div>
              <h2 className="text-lg font-semibold text-constellation-text-primary">Real Terminal</h2>
              <p className="text-sm text-constellation-text-secondary">Interactive host system access</p>
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
            {terminalId && (
              <div className="text-xs text-constellation-text-tertiary font-mono">
                ID: {terminalId.substring(0, 8)}
              </div>
            )}
            {isPersistenceActive && (
              <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-constellation-accent-green bg-opacity-20 text-constellation-accent-green">
                <Shield size={12} />
                Protected
              </div>
            )}
            {errorRecoveryCount > 0 && (
              <div className="text-xs text-constellation-accent-yellow">
                Recovered: {errorRecoveryCount}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={reconnect}
              className="p-2 text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded transition-colors"
              title="Reconnect terminal"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {!isFullscreen && (
              <button
                onClick={onClose}
                className="p-2 text-constellation-text-secondary hover:text-constellation-text-primary hover:bg-constellation-bg-tertiary rounded transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 bg-black p-2 overflow-hidden">
          <div 
            ref={terminalRef} 
            className="w-full h-full"
            style={{ 
              fontFamily: '"JetBrains Mono", "SF Mono", "Monaco", "Inconsolata", "Fira Code", "Fira Mono", "Roboto Mono", monospace'
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-constellation-border bg-constellation-bg-secondary">
          <div className="flex items-center justify-between text-xs text-constellation-text-tertiary">
            <div className="flex items-center gap-4">
              <span>💡 Interactive terminal with full system access</span>
              <span>🔧 Supports vim, nano, mc, and all CLI tools</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle size={12} />
              <span>⚠️ Full host system access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}