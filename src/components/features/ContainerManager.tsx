import React, { useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  Plus, 
  Terminal,
  Eye,
  Download,
  Upload,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

interface Container {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'building' | 'error' | 'starting' | 'stopping'
  ports: Array<{ internal: number; external: number; protocol: string }>
  created: Date
  updated: Date
  logs: Array<{ timestamp: Date; level: 'info' | 'warn' | 'error' | 'debug'; message: string }>
  stats: {
    cpu: number
    memory: number
    network: { rx: number; tx: number }
  }
}

export const ContainerManager: React.FC = () => {
  const state = useSnapshot(appStore)
  const { addChatMessage } = useAppStore()
  const [containers, setContainers] = useState<Container[]>([])
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'stats' | 'settings'>('overview')
  const [isCreating, setIsCreating] = useState(false)

  // Initialize with demo containers
  useEffect(() => {
    const demoContainers: Container[] = [
      {
        id: 'container-1',
        name: 'survey-backend',
        image: 'encore:latest',
        status: 'running',
        ports: [{ internal: 4000, external: 4000, protocol: 'http' }],
        created: new Date(Date.now() - 86400000), // 1 day ago
        updated: new Date(Date.now() - 3600000), // 1 hour ago
        logs: [
          { timestamp: new Date(Date.now() - 60000), level: 'info', message: 'Server started on port 4000' },
          { timestamp: new Date(Date.now() - 30000), level: 'info', message: 'Connected to PostgreSQL database' },
          { timestamp: new Date(Date.now() - 15000), level: 'info', message: 'Health check passed' },
        ],
        stats: { cpu: 15.2, memory: 234.5, network: { rx: 1024, tx: 2048 } }
      },
      {
        id: 'container-2',
        name: 'survey-frontend',
        image: 'solidjs:dev',
        status: 'running',
        ports: [{ internal: 3000, external: 3000, protocol: 'http' }],
        created: new Date(Date.now() - 86400000),
        updated: new Date(Date.now() - 1800000), // 30 min ago
        logs: [
          { timestamp: new Date(Date.now() - 120000), level: 'info', message: 'Vite dev server started' },
          { timestamp: new Date(Date.now() - 90000), level: 'info', message: 'Hot module replacement enabled' },
          { timestamp: new Date(Date.now() - 60000), level: 'info', message: 'Ready on http://localhost:3000' },
        ],
        stats: { cpu: 8.7, memory: 156.3, network: { rx: 512, tx: 1024 } }
      },
      {
        id: 'container-3',
        name: 'postgres-db',
        image: 'postgres:15',
        status: 'running',
        ports: [{ internal: 5432, external: 5432, protocol: 'tcp' }],
        created: new Date(Date.now() - 172800000), // 2 days ago
        updated: new Date(Date.now() - 7200000), // 2 hours ago
        logs: [
          { timestamp: new Date(Date.now() - 180000), level: 'info', message: 'Database system is ready to accept connections' },
          { timestamp: new Date(Date.now() - 120000), level: 'info', message: 'Checkpoint completed' },
          { timestamp: new Date(Date.now() - 60000), level: 'info', message: 'Autovacuum started' },
        ],
        stats: { cpu: 3.1, memory: 87.9, network: { rx: 256, tx: 512 } }
      },
      {
        id: 'container-4',
        name: 'redis-cache',
        image: 'redis:7-alpine',
        status: 'stopped',
        ports: [{ internal: 6379, external: 6379, protocol: 'tcp' }],
        created: new Date(Date.now() - 172800000),
        updated: new Date(Date.now() - 14400000), // 4 hours ago
        logs: [
          { timestamp: new Date(Date.now() - 240000), level: 'info', message: 'Redis server started' },
          { timestamp: new Date(Date.now() - 180000), level: 'info', message: 'Ready to accept connections' },
          { timestamp: new Date(Date.now() - 14400000), level: 'info', message: 'Server shutdown by user' },
        ],
        stats: { cpu: 0, memory: 0, network: { rx: 0, tx: 0 } }
      }
    ]
    setContainers(demoContainers)
  }, [])

  const getStatusIcon = (status: Container['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle size={16} className="text-constellation-success" />
      case 'stopped':
        return <Square size={16} className="text-constellation-text-tertiary" />
      case 'building':
      case 'starting':
      case 'stopping':
        return <Clock size={16} className="text-constellation-accent-yellow animate-pulse" />
      case 'error':
        return <XCircle size={16} className="text-constellation-error" />
      default:
        return <AlertCircle size={16} className="text-constellation-text-tertiary" />
    }
  }

  const getStatusColor = (status: Container['status']) => {
    switch (status) {
      case 'running':
        return 'text-constellation-success'
      case 'stopped':
        return 'text-constellation-text-tertiary'
      case 'building':
      case 'starting':
      case 'stopping':
        return 'text-constellation-accent-yellow'
      case 'error':
        return 'text-constellation-error'
      default:
        return 'text-constellation-text-tertiary'
    }
  }

  const handleContainerAction = async (containerId: string, action: 'start' | 'stop' | 'restart' | 'delete') => {
    const container = containers.find(c => c.id === containerId)
    if (!container) return

    // Update container status optimistically
    setContainers(prev => prev.map(c => 
      c.id === containerId 
        ? { 
            ...c, 
            status: action === 'start' ? 'starting' : 
                   action === 'stop' ? 'stopping' : 
                   action === 'restart' ? 'starting' : c.status,
            updated: new Date()
          }
        : c
    ))

    // Add chat message about the action
    addChatMessage({
      role: 'assistant',
      content: `🐳 **Container Manager**: ${action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : action === 'restart' ? 'Restarting' : 'Deleting'} container "${container.name}"...

${action === 'delete' ? '⚠️ This action cannot be undone.' : 'Please wait while the operation completes.'}`,
      type: 'generation',
      agentId: 'master-orchestrator'
    })

    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000))

      if (action === 'delete') {
        setContainers(prev => prev.filter(c => c.id !== containerId))
        if (selectedContainer === containerId) {
          setSelectedContainer(null)
        }
      } else {
        const newStatus = action === 'start' || action === 'restart' ? 'running' : 'stopped'
        setContainers(prev => prev.map(c => 
          c.id === containerId 
            ? { 
                ...c, 
                status: newStatus,
                updated: new Date(),
                logs: [
                  ...c.logs,
                  { 
                    timestamp: new Date(), 
                    level: 'info', 
                    message: `Container ${action}ed successfully` 
                  }
                ]
              }
            : c
        ))
      }

      addChatMessage({
        role: 'assistant',
        content: `✅ **Container Manager**: Container "${container.name}" ${action}ed successfully!`,
        type: 'generation',
        agentId: 'master-orchestrator'
      })

    } catch (error) {
      // Revert status on error
      setContainers(prev => prev.map(c => 
        c.id === containerId 
          ? { ...c, status: 'error', updated: new Date() }
          : c
      ))

      addChatMessage({
        role: 'assistant',
        content: `❌ **Container Manager**: Failed to ${action} container "${container.name}". Please check the logs for details.`,
        type: 'generation',
        agentId: 'master-orchestrator'
      })
    }
  }

  const selectedContainerData = containers.find(c => c.id === selectedContainer)

  return (
    <div className="container-manager flex h-full bg-constellation-bg-primary">
      {/* Container List */}
      <div className="container-list w-80 border-r border-constellation-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-constellation-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-constellation-text-primary">
              Containers
            </h2>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded text-sm hover:opacity-80 transition-opacity"
            >
              <Plus size={14} />
              New
            </button>
          </div>
          <p className="text-sm text-constellation-text-secondary">
            Manage your Docker containers
          </p>
        </div>

        {/* Container Cards */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {containers.map((container) => (
            <div
              key={container.id}
              className={`container-card p-4 bg-constellation-bg-secondary border rounded-lg cursor-pointer transition-all ${
                selectedContainer === container.id
                  ? 'border-constellation-accent-blue'
                  : 'border-constellation-border hover:border-constellation-text-tertiary'
              }`}
              onClick={() => setSelectedContainer(container.id)}
            >
              <div className="flex items-start gap-3 mb-3">
                {getStatusIcon(container.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-constellation-text-primary text-sm truncate">
                      {container.name}
                    </h3>
                  </div>
                  <div className="text-xs text-constellation-text-secondary mb-2">
                    {container.image}
                  </div>
                  <div className={`text-xs font-medium ${getStatusColor(container.status)}`}>
                    {container.status.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1">
                {container.status === 'stopped' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleContainerAction(container.id, 'start')
                    }}
                    className="p-1.5 text-constellation-success hover:bg-constellation-success hover:bg-opacity-20 rounded transition-colors"
                    title="Start container"
                  >
                    <Play size={12} />
                  </button>
                ) : container.status === 'running' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleContainerAction(container.id, 'stop')
                    }}
                    className="p-1.5 text-constellation-text-secondary hover:bg-constellation-text-secondary hover:bg-opacity-20 rounded transition-colors"
                    title="Stop container"
                  >
                    <Square size={12} />
                  </button>
                ) : null}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleContainerAction(container.id, 'restart')
                  }}
                  className="p-1.5 text-constellation-accent-blue hover:bg-constellation-accent-blue hover:bg-opacity-20 rounded transition-colors"
                  title="Restart container"
                >
                  <RotateCcw size={12} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete container "${container.name}"? This cannot be undone.`)) {
                      handleContainerAction(container.id, 'delete')
                    }
                  }}
                  className="p-1.5 text-constellation-error hover:bg-constellation-error hover:bg-opacity-20 rounded transition-colors"
                  title="Delete container"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Ports */}
              {container.ports.length > 0 && (
                <div className="mt-3 pt-3 border-t border-constellation-border">
                  <div className="text-xs text-constellation-text-tertiary">
                    Ports: {container.ports.map(p => `${p.external}:${p.internal}`).join(', ')}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Container Details */}
      <div className="container-details flex-1 flex flex-col">
        {selectedContainerData ? (
          <ContainerDetails
            container={selectedContainerData}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAction={handleContainerAction}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-constellation-text-secondary">
            <div className="text-center">
              <Activity size={48} className="mx-auto mb-4 text-constellation-text-tertiary" />
              <div className="text-lg font-medium mb-2">Select a Container</div>
              <div className="text-sm">Choose a container to view its details and manage it</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const ContainerDetails: React.FC<{
  container: Container
  activeTab: 'overview' | 'logs' | 'stats' | 'settings'
  onTabChange: (tab: 'overview' | 'logs' | 'stats' | 'settings') => void
  onAction: (id: string, action: 'start' | 'stop' | 'restart' | 'delete') => void
}> = ({ container, activeTab, onTabChange, onAction }) => {
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Eye },
    { id: 'logs' as const, label: 'Logs', icon: Terminal },
    { id: 'stats' as const, label: 'Stats', icon: Activity },
    { id: 'settings' as const, label: 'Settings', icon: AlertCircle },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-constellation-border">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-constellation-bg-tertiary rounded-lg flex items-center justify-center">
            <Activity size={24} className="text-constellation-accent-blue" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-semibold text-constellation-text-primary">
                {container.name}
              </h1>
              <div className={`flex items-center gap-1 text-sm ${getStatusColor(container.status)}`}>
                {getStatusIcon(container.status)}
                {container.status.toUpperCase()}
              </div>
            </div>
            <div className="text-constellation-text-secondary">
              {container.image} • Created {container.created.toLocaleDateString()}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {container.status === 'stopped' && (
              <button
                onClick={() => onAction(container.id, 'start')}
                className="flex items-center gap-2 px-3 py-1.5 bg-constellation-success text-white rounded hover:opacity-80 transition-opacity"
              >
                <Play size={14} />
                Start
              </button>
            )}
            {container.status === 'running' && (
              <button
                onClick={() => onAction(container.id, 'stop')}
                className="flex items-center gap-2 px-3 py-1.5 bg-constellation-text-secondary text-white rounded hover:opacity-80 transition-opacity"
              >
                <Square size={14} />
                Stop
              </button>
            )}
            <button
              onClick={() => onAction(container.id, 'restart')}
              className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded hover:opacity-80 transition-opacity"
            >
              <RotateCcw size={14} />
              Restart
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-constellation-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-constellation-text-primary border-constellation-accent-blue'
                : 'text-constellation-text-secondary border-transparent hover:text-constellation-text-primary'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <OverviewTab container={container} />}
        {activeTab === 'logs' && <LogsTab container={container} />}
        {activeTab === 'stats' && <StatsTab container={container} />}
        {activeTab === 'settings' && <SettingsTab container={container} />}
      </div>
    </div>
  )
}

const OverviewTab: React.FC<{ container: Container }> = ({ container }) => (
  <div className="p-6 overflow-auto">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-constellation-text-primary">Container Info</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-constellation-text-secondary">Image:</span>
            <span className="text-constellation-text-primary font-mono text-sm">{container.image}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-constellation-text-secondary">Status:</span>
            <span className={`font-medium ${getStatusColor(container.status)}`}>
              {container.status.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-constellation-text-secondary">Created:</span>
            <span className="text-constellation-text-primary">{container.created.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-constellation-text-secondary">Updated:</span>
            <span className="text-constellation-text-primary">{container.updated.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Ports */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-constellation-text-primary">Port Mappings</h3>
        <div className="space-y-2">
          {container.ports.map((port, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-constellation-bg-secondary rounded border border-constellation-border">
              <div>
                <div className="font-mono text-sm text-constellation-text-primary">
                  {port.external}:{port.internal}
                </div>
                <div className="text-xs text-constellation-text-secondary">
                  {port.protocol.toUpperCase()}
                </div>
              </div>
              {container.status === 'running' && (
                <a
                  href={`http://localhost:${port.external}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-constellation-accent-blue hover:text-constellation-accent-blue opacity-80 transition-opacity"
                >
                  <Eye size={16} />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const LogsTab: React.FC<{ container: Container }> = ({ container }) => (
  <div className="flex flex-col h-full">
    <div className="p-4 border-b border-constellation-border flex items-center justify-between">
      <h3 className="font-medium text-constellation-text-primary">Container Logs</h3>
      <div className="flex gap-2">
        <button className="flex items-center gap-2 px-3 py-1.5 bg-constellation-bg-tertiary text-constellation-text-secondary rounded text-sm hover:text-constellation-text-primary transition-colors">
          <Download size={14} />
          Export
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-constellation-bg-tertiary text-constellation-text-secondary rounded text-sm hover:text-constellation-text-primary transition-colors">
          <RotateCcw size={14} />
          Refresh
        </button>
      </div>
    </div>
    <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-constellation-bg-primary">
      <div className="space-y-1">
        {container.logs.map((log, index) => (
          <div key={index} className="flex gap-4">
            <span className="text-constellation-text-tertiary min-w-0 flex-shrink-0">
              {log.timestamp.toLocaleTimeString()}
            </span>
            <span className={`min-w-0 flex-shrink-0 uppercase font-medium text-xs px-2 py-0.5 rounded ${
              log.level === 'info' ? 'bg-constellation-success bg-opacity-20 text-constellation-success' :
              log.level === 'warn' ? 'bg-constellation-accent-yellow bg-opacity-20 text-constellation-accent-yellow' :
              log.level === 'error' ? 'bg-constellation-error bg-opacity-20 text-constellation-error' :
              'bg-constellation-text-tertiary bg-opacity-20 text-constellation-text-tertiary'
            }`}>
              {log.level}
            </span>
            <span className="text-constellation-text-primary flex-1">
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const StatsTab: React.FC<{ container: Container }> = ({ container }) => (
  <div className="p-6 overflow-auto">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="stats-card p-4 bg-constellation-bg-secondary rounded border border-constellation-border">
        <div className="text-2xl font-bold text-constellation-accent-blue mb-1">
          {container.stats.cpu.toFixed(1)}%
        </div>
        <div className="text-sm text-constellation-text-secondary">CPU Usage</div>
      </div>
      <div className="stats-card p-4 bg-constellation-bg-secondary rounded border border-constellation-border">
        <div className="text-2xl font-bold text-constellation-accent-green mb-1">
          {container.stats.memory.toFixed(1)} MB
        </div>
        <div className="text-sm text-constellation-text-secondary">Memory Usage</div>
      </div>
      <div className="stats-card p-4 bg-constellation-bg-secondary rounded border border-constellation-border">
        <div className="text-2xl font-bold text-constellation-accent-yellow mb-1">
          {((container.stats.network.rx + container.stats.network.tx) / 1024).toFixed(1)} KB
        </div>
        <div className="text-sm text-constellation-text-secondary">Network I/O</div>
      </div>
    </div>

    <div className="stats-chart h-64 bg-constellation-bg-secondary rounded border border-constellation-border flex items-center justify-center">
      <div className="text-center text-constellation-text-secondary">
        <Activity size={32} className="mx-auto mb-2" />
        <div>Real-time metrics chart would appear here</div>
        <div className="text-xs mt-1">Connected to Docker stats API</div>
      </div>
    </div>
  </div>
)

const SettingsTab: React.FC<{ container: Container }> = ({ container }) => (
  <div className="p-6 overflow-auto">
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-lg font-medium text-constellation-text-primary mb-4">Container Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
              Container Name
            </label>
            <input
              type="text"
              value={container.name}
              className="w-full px-3 py-2 bg-constellation-bg-secondary border border-constellation-border rounded text-constellation-text-primary focus:outline-none focus:border-constellation-accent-blue"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-constellation-text-secondary mb-2">
              Image
            </label>
            <input
              type="text"
              value={container.image}
              className="w-full px-3 py-2 bg-constellation-bg-secondary border border-constellation-border rounded text-constellation-text-primary focus:outline-none focus:border-constellation-accent-blue"
              readOnly
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-constellation-text-primary mb-4">Danger Zone</h3>
        <div className="p-4 bg-constellation-error bg-opacity-10 border border-constellation-error border-opacity-30 rounded">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle size={20} className="text-constellation-error" />
            <div>
              <div className="font-medium text-constellation-error">Delete Container</div>
              <div className="text-sm text-constellation-text-secondary">
                This action cannot be undone. All data will be lost.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`Delete container "${container.name}"? This cannot be undone.`)) {
                // onAction(container.id, 'delete')
              }
            }}
            className="px-4 py-2 bg-constellation-error text-white rounded hover:opacity-80 transition-opacity"
          >
            Delete Container
          </button>
        </div>
      </div>
    </div>
  </div>
)

const getStatusIcon = (status: Container['status']) => {
  switch (status) {
    case 'running':
      return <CheckCircle size={16} className="text-constellation-success" />
    case 'stopped':
      return <Square size={16} className="text-constellation-text-tertiary" />
    case 'building':
    case 'starting':
    case 'stopping':
      return <Clock size={16} className="text-constellation-accent-yellow animate-pulse" />
    case 'error':
      return <XCircle size={16} className="text-constellation-error" />
    default:
      return <AlertCircle size={16} className="text-constellation-text-tertiary" />
  }
}

const getStatusColor = (status: Container['status']) => {
  switch (status) {
    case 'running':
      return 'text-constellation-success'
    case 'stopped':
      return 'text-constellation-text-tertiary'
    case 'building':
    case 'starting':
    case 'stopping':
      return 'text-constellation-accent-yellow'
    case 'error':
      return 'text-constellation-error'
    default:
      return 'text-constellation-text-tertiary'
  }
}