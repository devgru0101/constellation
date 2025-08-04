import React, { useState } from 'react'
import { useSnapshot } from 'valtio'
import { appStore } from '@/stores/app-store'
import { Terminal, Bug, FileText, Activity, X } from 'lucide-react'

type BottomTab = 'terminal' | 'problems' | 'output' | 'debug'

export const BottomPanel: React.FC = () => {
  const state = useSnapshot(appStore)
  const [activeTab, setActiveTab] = useState<BottomTab>('terminal')

  const tabs: { id: BottomTab; label: string; icon: React.ComponentType<any>; count?: number }[] = [
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'problems', label: 'Problems', icon: Bug, count: 3 },
    { id: 'output', label: 'Output', icon: FileText },
    { id: 'debug', label: 'Debug Console', icon: Activity },
  ]

  const closePanel = () => {
    appStore.bottomPanelOpen = false
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'terminal':
        return <TerminalContent />
      case 'problems':
        return <ProblemsContent />
      case 'output':
        return <OutputContent />
      case 'debug':
        return <DebugContent />
      default:
        return <TerminalContent />
    }
  }

  return (
    <div 
      className="bottom-panel bg-constellation-bg-secondary border-t border-constellation-border flex flex-col"
      style={{ height: `${state.bottomPanelHeight}px` }}
    >
      {/* Tab Bar */}
      <div className="bottom-tabs flex items-center justify-between border-b border-constellation-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-tab flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-constellation-text-primary border-constellation-accent-blue'
                  : 'text-constellation-text-secondary border-transparent hover:text-constellation-text-primary'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count && (
                <span className="bg-constellation-accent-blue text-constellation-bg-primary text-xs px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <button
          onClick={closePanel}
          className="p-2 text-constellation-text-tertiary hover:text-constellation-text-primary transition-colors"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tab Content */}
      <div className="bottom-content flex-1 overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  )
}

const TerminalContent: React.FC = () => {
  return (
    <div className="terminal-content p-4 font-mono text-sm bg-constellation-bg-primary">
      <div className="terminal-line flex gap-2 mb-1">
        <span className="text-constellation-accent-green">$</span>
        <span className="text-constellation-text-primary">npm run dev</span>
      </div>
      <div className="text-constellation-text-secondary mb-2">
        {`> constellation-ide@0.1.0 dev`}<br/>
        {`> vite`}
      </div>
      <div className="text-constellation-text-secondary mb-2">
        <span className="text-constellation-accent-blue">VITE v5.0.8</span> ready in 543 ms
      </div>
      <div className="text-constellation-text-secondary mb-2">
        ➜  <span className="text-constellation-accent-green">Local:</span>   http://localhost:3000/<br/>
        ➜  <span className="text-constellation-accent-blue">Network:</span> use --host to expose
      </div>
      <div className="terminal-line flex gap-2">
        <span className="text-constellation-accent-green">$</span>
        <input 
          type="text"
          className="terminal-input flex-1 bg-transparent border-none outline-none text-constellation-text-primary"
          placeholder="Type a command..."
        />
      </div>
    </div>
  )
}

const ProblemsContent: React.FC = () => {
  const problems = [
    {
      severity: 'error',
      message: "Property 'user' does not exist on type 'AuthContext'",
      file: 'src/components/Header.tsx',
      line: 42,
      column: 15,
    },
    {
      severity: 'warning',
      message: "Unused variable 'handleClick'",
      file: 'src/components/Button.tsx',
      line: 18,
      column: 9,
    },
    {
      severity: 'info',
      message: 'This function can be simplified',
      file: 'src/utils/helpers.ts',
      line: 25,
      column: 1,
    },
  ]

  return (
    <div className="problems-content p-4">
      <div className="space-y-2">
        {problems.map((problem, index) => (
          <div
            key={index}
            className="problem-item flex items-start gap-3 p-2 hover:bg-constellation-bg-tertiary rounded cursor-pointer"
          >
            <div className={`problem-icon w-4 h-4 rounded-full flex-shrink-0 mt-0.5 ${
              problem.severity === 'error' ? 'bg-constellation-error' :
              problem.severity === 'warning' ? 'bg-constellation-accent-yellow' :
              'bg-constellation-accent-blue'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-constellation-text-primary">
                {problem.message}
              </div>
              <div className="text-xs text-constellation-text-secondary mt-1">
                {problem.file}:{problem.line}:{problem.column}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const OutputContent: React.FC = () => {
  return (
    <div className="output-content p-4 font-mono text-sm">
      <div className="space-y-1 text-constellation-text-secondary">
        <div>[10:30:45] Starting compilation...</div>
        <div>[10:30:46] <span className="text-constellation-success">✓</span> Compiled successfully</div>
        <div>[10:30:47] Watching for file changes...</div>
        <div>[10:31:02] File change detected: src/App.tsx</div>
        <div>[10:31:03] <span className="text-constellation-success">✓</span> Recompiled successfully</div>
      </div>
    </div>
  )
}

const DebugContent: React.FC = () => {
  return (
    <div className="debug-content p-4 font-mono text-sm">
      <div className="space-y-1">
        <div className="text-constellation-text-secondary">
          [Debug] Application started
        </div>
        <div className="text-constellation-accent-blue">
          [Info] User authenticated: user@example.com
        </div>
        <div className="text-constellation-accent-yellow">
          [Warning] API rate limit approaching
        </div>
        <div className="text-constellation-success">
          [Success] Database connection established
        </div>
      </div>
    </div>
  )
}