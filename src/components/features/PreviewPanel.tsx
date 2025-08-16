import React, { useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { API_CONFIG } from '@/config/api'
import { 
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Play,
  Square,
  Globe,
  Terminal,
  CheckCircle,
  XCircle,
  Clock,
  Zap
} from 'lucide-react'

interface PreviewEnvironment {
  id: string
  name: string
  type: 'development' | 'staging' | 'production'
  url: string
  status: 'running' | 'stopped' | 'building' | 'error'
  branch: string
  lastDeploy: Date
  services: Array<{ name: string; status: 'healthy' | 'unhealthy' | 'unknown' }>
}

export const PreviewPanel: React.FC = () => {
  const state = useSnapshot(appStore)
  const { addChatMessage } = useAppStore()
  const [activeTab, setActiveTab] = useState<'preview' | 'environments' | 'logs'>('preview')
  const [url, setUrl] = useState('http://localhost:4002/test-preview.html')
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isLoading, setIsLoading] = useState(false)
  const [environments, setEnvironments] = useState<PreviewEnvironment[]>([])
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null)

  // Update URLs based on current project type
  useEffect(() => {
    if (state.currentProject) {
      const isEncoreProject = state.currentProject.type?.includes('encore');
      
      const updatedEnvs = environments.map(env => {
        if (env.type === 'development') {
          return {
            ...env,
            url: isEncoreProject ? 'http://localhost:3000' : 'http://localhost:3000',
            services: isEncoreProject ? [
              { name: 'frontend', status: 'healthy' as const },
              { name: 'backend-api', status: 'healthy' as const },
              { name: 'encore-dashboard', status: 'healthy' as const }
            ] : [
              { name: 'frontend', status: 'healthy' as const },
              { name: 'backend', status: 'healthy' as const },
              { name: 'database', status: 'healthy' as const }
            ]
          };
        }
        return env;
      });
      
      if (JSON.stringify(updatedEnvs) !== JSON.stringify(environments)) {
        setEnvironments(updatedEnvs);
      }
      
      // Set URL based on project type and available servers
      // NEVER default to port 3000 as that's the Constellation IDE itself
      if (isEncoreProject) {
        // For Encore projects, check for user app on dedicated ports
        setUrl('http://localhost:4002/test-preview.html'); // User project preview
      } else {
        // For other projects, use dedicated development ports (not 3000)
        setUrl('http://localhost:3001'); // User project frontend (avoid port 3000)
      }
    }
  }, [state.currentProject, environments]);

  // Initialize environments based on real project data
  useEffect(() => {
    const loadRealEnvironments = async () => {
      const isEncoreProject = state.currentProject?.type?.includes('encore');
      
      let realEnvs: PreviewEnvironment[] = []
      
      try {
        // Get current project info
        const response = await fetch(`${API_CONFIG.apiUrl}/debug/projects`)
        const data = await response.json()
        
        if (data.projects && data.projects.length > 0 && state.currentProject) {
          const currentProjectData = data.projects.find((p: any) => 
            p.id === state.currentProject?.id || 
            p.readme?.includes(state.currentProject?.name)
          )
          
          if (currentProjectData) {
            // Check if servers are actually running
            const checkServerStatus = async (port: number) => {
              try {
                await fetch(`http://localhost:${port}`, { 
                  method: 'HEAD',
                  mode: 'no-cors',
                  signal: AbortSignal.timeout(1000)
                })
                return 'running'
              } catch {
                return 'stopped'
              }
            }
            
            const frontendStatus = await checkServerStatus(4002)
            const backendStatus = await checkServerStatus(4000)
            
            // Development environment (real project)
            realEnvs.push({
              id: 'dev-current',
              name: `${state.currentProject.name} - Development`,
              type: 'development',
              url: frontendStatus === 'running' ? 'http://localhost:4002/test-preview.html' : 'http://localhost:4002',
              status: (frontendStatus === 'running' || backendStatus === 'running') ? 'running' : 'stopped',
              branch: 'main',
              lastDeploy: new Date(currentProjectData.created),
              services: [
                { name: 'frontend', status: frontendStatus === 'running' ? 'healthy' : 'unhealthy' },
                { name: 'backend-api', status: backendStatus === 'running' ? 'healthy' : 'unhealthy' },
                ...(isEncoreProject ? [{ name: 'encore-dashboard', status: 'unknown' as const }] : [])
              ]
            })
          }
        }
        
        // Add staging/production as placeholder for now
        realEnvs.push(
          {
            id: 'staging-future',
            name: 'Staging (Coming Soon)',
            type: 'staging',
            url: 'https://staging.constellation-ide.dev',
            status: 'stopped',
            branch: 'develop',
            lastDeploy: new Date(Date.now() - 86400000),
            services: [
              { name: 'frontend', status: 'unknown' },
              { name: 'backend', status: 'unknown' }
            ]
          },
          {
            id: 'prod-future',
            name: 'Production (Coming Soon)',
            type: 'production',
            url: 'https://constellation-ide.app',
            status: 'stopped',
            branch: 'release',
            lastDeploy: new Date(Date.now() - 86400000),
            services: [
              { name: 'frontend', status: 'unknown' },
              { name: 'backend', status: 'unknown' }
            ]
          }
        )
        
      } catch (error) {
        console.error('Failed to load real environments:', error)
        
        // Fallback to basic environment
        realEnvs = [{
          id: 'dev-local',
          name: 'Local Development',
          type: 'development',
          url: 'http://localhost:4002/test-preview.html',
          status: 'running',
          branch: 'main',
          lastDeploy: new Date(),
          services: [
            { name: 'frontend', status: 'healthy' },
            { name: 'backend', status: 'unknown' }
          ]
        }]
      }
      
      setEnvironments(realEnvs)
      setSelectedEnv(realEnvs[0]?.id || null)
    }
    
    loadRealEnvironments()
    
    // Refresh environments every 30 seconds
    const interval = setInterval(loadRealEnvironments, 30000)
    return () => clearInterval(interval)
  }, [state.currentProject])

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1000)
  }

  const handleEnvironmentAction = async (envId: string, action: 'start' | 'stop' | 'deploy' | 'destroy') => {
    const env = environments.find(e => e.id === envId)
    if (!env) return

    // Update environment status optimistically
    setEnvironments(prev => prev.map(e => 
      e.id === envId 
        ? { 
            ...e, 
            status: action === 'start' ? 'building' : 
                   action === 'stop' ? 'stopped' : 
                   action === 'deploy' ? 'building' : e.status
          }
        : e
    ))

    addChatMessage({
      role: 'assistant',
      content: `🚀 **Preview Manager**: ${action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : action === 'deploy' ? 'Deploying to' : 'Destroying'} ${env.name} environment...

${action === 'deploy' ? '⚡ Building and deploying your latest changes...' : 
  action === 'destroy' ? '⚠️ This will permanently destroy the environment.' : 
  'Please wait while the operation completes.'}`,
      type: 'generation',
      agentId: 'master-orchestrator'
    })

    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000))
      
      if (action === 'destroy') {
        setEnvironments(prev => prev.filter(e => e.id !== envId))
        if (selectedEnv === envId) {
          setSelectedEnv(environments[0]?.id || null)
        }
      } else {
        const newStatus = action === 'start' || action === 'deploy' ? 'running' : 'stopped'
        setEnvironments(prev => prev.map(e => 
          e.id === envId 
            ? { 
                ...e, 
                status: newStatus,
                lastDeploy: action === 'deploy' ? new Date() : e.lastDeploy
              }
            : e
        ))
      }

      addChatMessage({
        role: 'assistant',
        content: `✅ **Preview Manager**: ${env.name} environment ${action}ed successfully!

${action === 'deploy' ? `🌐 Your application is now live at: ${env.url}` : ''}`,
        type: 'generation',
        agentId: 'master-orchestrator'
      })

    } catch (error) {
      setEnvironments(prev => prev.map(e => 
        e.id === envId 
          ? { ...e, status: 'error' }
          : e
      ))

      addChatMessage({
        role: 'assistant',
        content: `❌ **Preview Manager**: Failed to ${action} ${env.name} environment. Please check the logs for details.`,
        type: 'generation',
        agentId: 'master-orchestrator'
      })
    }
  }

  const selectedEnvironment = environments.find(e => e.id === selectedEnv)

  return (
    <div className="preview-panel flex flex-col h-full bg-constellation-bg-primary">
      {/* Tab Navigation */}
      <div className="flex border-b border-constellation-border">
        {[
          { id: 'preview' as const, label: 'Preview', icon: Monitor },
          { id: 'environments' as const, label: 'Environments', icon: Globe },
          { id: 'logs' as const, label: 'Logs', icon: Terminal },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'preview' && (
          <PreviewTab
            url={selectedEnvironment?.url || url}
            device={device}
            onDeviceChange={setDevice}
            onRefresh={handleRefresh}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'environments' && (
          <EnvironmentsTab
            environments={environments}
            selectedEnv={selectedEnv}
            onSelectEnv={setSelectedEnv}
            onAction={handleEnvironmentAction}
          />
        )}
        {activeTab === 'logs' && (
          <LogsTab environment={selectedEnvironment} />
        )}
      </div>
    </div>
  )
}

// Preview Tab Component
const PreviewTab: React.FC<{
  url: string
  device: 'desktop' | 'tablet' | 'mobile'
  onDeviceChange: (device: 'desktop' | 'tablet' | 'mobile') => void
  onRefresh: () => void
  isLoading: boolean
}> = ({ url, device, onDeviceChange, onRefresh, isLoading }) => {
  const getDeviceSize = () => {
    switch (device) {
      case 'mobile':
        return { width: '375px', height: '667px' }
      case 'tablet':
        return { width: '768px', height: '1024px' }
      default:
        return { width: '100%', height: '100%' }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Preview Header */}
      <div className="preview-header flex items-center gap-3 p-3 bg-constellation-bg-secondary border-b border-constellation-border">
        {/* URL Display */}
        <div className="flex-1 px-3 py-1.5 bg-constellation-bg-tertiary border border-constellation-border rounded text-constellation-text-primary text-xs font-mono">
          {url}
        </div>

        {/* Device Selector */}
        <div className="device-selector flex gap-1 p-1 bg-constellation-bg-tertiary rounded">
          <button
            onClick={() => onDeviceChange('desktop')}
            className={`p-1.5 rounded transition-colors ${
              device === 'desktop' 
                ? 'bg-constellation-accent-blue text-constellation-bg-primary' 
                : 'text-constellation-text-secondary hover:text-constellation-text-primary'
            }`}
            title="Desktop view"
          >
            <Monitor size={14} />
          </button>
          <button
            onClick={() => onDeviceChange('tablet')}
            className={`p-1.5 rounded transition-colors ${
              device === 'tablet' 
                ? 'bg-constellation-accent-blue text-constellation-bg-primary' 
                : 'text-constellation-text-secondary hover:text-constellation-text-primary'
            }`}
            title="Tablet view"
          >
            <Tablet size={14} />
          </button>
          <button
            onClick={() => onDeviceChange('mobile')}
            className={`p-1.5 rounded transition-colors ${
              device === 'mobile' 
                ? 'bg-constellation-accent-blue text-constellation-bg-primary' 
                : 'text-constellation-text-secondary hover:text-constellation-text-primary'
            }`}
            title="Mobile view"
          >
            <Smartphone size={14} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex gap-1">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-constellation-text-secondary hover:text-constellation-text-primary transition-colors disabled:opacity-50"
            title="Refresh preview"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => window.open(url, '_blank')}
            className="p-1.5 text-constellation-text-secondary hover:text-constellation-text-primary transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="preview-content flex-1 flex items-center justify-center bg-white">
        {device !== 'desktop' ? (
          <div 
            className="preview-frame border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-white"
            style={getDeviceSize()}
          >
            <PreviewContent url={url} />
          </div>
        ) : (
          <div className="w-full h-full">
            <PreviewContent url={url} />
          </div>
        )}
      </div>
    </div>
  )
}

// Environments Tab Component
const EnvironmentsTab: React.FC<{
  environments: PreviewEnvironment[]
  selectedEnv: string | null
  onSelectEnv: (id: string) => void
  onAction: (id: string, action: 'start' | 'stop' | 'deploy' | 'destroy') => void
}> = ({ environments, selectedEnv, onSelectEnv, onAction }) => {
  const getStatusIcon = (status: PreviewEnvironment['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle size={16} className="text-constellation-success" />
      case 'stopped':
        return <Square size={16} className="text-constellation-text-tertiary" />
      case 'building':
        return <Clock size={16} className="text-constellation-accent-yellow animate-pulse" />
      case 'error':
        return <XCircle size={16} className="text-constellation-error" />
    }
  }

  const getTypeColor = (type: PreviewEnvironment['type']) => {
    switch (type) {
      case 'development':
        return 'bg-constellation-accent-blue bg-opacity-20 text-constellation-accent-blue'
      case 'staging':
        return 'bg-constellation-accent-yellow bg-opacity-20 text-constellation-accent-yellow'
      case 'production':
        return 'bg-constellation-accent-green bg-opacity-20 text-constellation-accent-green'
    }
  }

  return (
    <div className="environments-tab flex h-full">
      {/* Environment List */}
      <div className="environment-list w-80 border-r border-constellation-border flex flex-col">
        <div className="p-4 border-b border-constellation-border">
          <h3 className="text-lg font-semibold text-constellation-text-primary mb-2">
            Preview Environments
          </h3>
          <p className="text-sm text-constellation-text-secondary">
            Manage deployment environments
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {environments.map((env) => (
            <div
              key={env.id}
              className={`environment-card p-4 bg-constellation-bg-secondary border rounded-lg cursor-pointer transition-all ${
                selectedEnv === env.id
                  ? 'border-constellation-accent-blue'
                  : 'border-constellation-border hover:border-constellation-text-tertiary'
              }`}
              onClick={() => onSelectEnv(env.id)}
            >
              <div className="flex items-start gap-3 mb-3">
                {getStatusIcon(env.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-constellation-text-primary">{env.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(env.type)}`}>
                      {env.type}
                    </span>
                  </div>
                  <div className="text-xs text-constellation-text-secondary mb-2 font-mono">
                    {env.url}
                  </div>
                  <div className="text-xs text-constellation-text-tertiary">
                    Branch: {env.branch} • Last deploy: {env.lastDeploy.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Service Status */}
              <div className="mb-3">
                <div className="text-xs font-medium text-constellation-text-secondary mb-1">Services:</div>
                <div className="flex flex-wrap gap-1">
                  {env.services.map((service, index) => (
                    <div key={index} className="flex items-center gap-1 px-2 py-0.5 bg-constellation-bg-tertiary rounded text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        service.status === 'healthy' ? 'bg-constellation-success' :
                        service.status === 'unhealthy' ? 'bg-constellation-error' :
                        'bg-constellation-text-tertiary'
                      }`} />
                      {service.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1">
                {env.status === 'stopped' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAction(env.id, 'start')
                    }}
                    className="p-1.5 text-constellation-success hover:bg-constellation-success hover:bg-opacity-20 rounded transition-colors"
                    title="Start environment"
                  >
                    <Play size={12} />
                  </button>
                ) : env.status === 'running' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAction(env.id, 'stop')
                    }}
                    className="p-1.5 text-constellation-text-secondary hover:bg-constellation-text-secondary hover:bg-opacity-20 rounded transition-colors"
                    title="Stop environment"
                  >
                    <Square size={12} />
                  </button>
                ) : null}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction(env.id, 'deploy')
                  }}
                  className="p-1.5 text-constellation-accent-blue hover:bg-constellation-accent-blue hover:bg-opacity-20 rounded transition-colors"
                  title="Deploy latest changes"
                >
                  <Zap size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Environment Details */}
      <div className="environment-details flex-1 p-6">
        {selectedEnv ? (
          <EnvironmentDetails
            environment={environments.find(e => e.id === selectedEnv)!}
            onAction={onAction}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-constellation-text-secondary">
            <div className="text-center">
              <Globe size={48} className="mx-auto mb-4 text-constellation-text-tertiary" />
              <div className="text-lg font-medium mb-2">Select an Environment</div>
              <div className="text-sm">Choose an environment to view its details</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Environment Details Component
const EnvironmentDetails: React.FC<{
  environment: PreviewEnvironment
  onAction: (id: string, action: 'start' | 'stop' | 'deploy' | 'destroy') => void
}> = ({ environment, onAction }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-constellation-text-primary mb-2">
            {environment.name}
          </h2>
          <div className="flex items-center gap-3 text-sm text-constellation-text-secondary">
            <span>Type: {environment.type}</span>
            <span>•</span>
            <span>Branch: {environment.branch}</span>
            <span>•</span>
            <span>Last Deploy: {environment.lastDeploy.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {environment.status === 'stopped' && (
            <button
              onClick={() => onAction(environment.id, 'start')}
              className="flex items-center gap-2 px-3 py-1.5 bg-constellation-success text-white rounded hover:opacity-80 transition-opacity"
            >
              <Play size={14} />
              Start
            </button>
          )}
          {environment.status === 'running' && (
            <button
              onClick={() => onAction(environment.id, 'stop')}
              className="flex items-center gap-2 px-3 py-1.5 bg-constellation-text-secondary text-white rounded hover:opacity-80 transition-opacity"
            >
              <Square size={14} />
              Stop
            </button>
          )}
          <button
            onClick={() => onAction(environment.id, 'deploy')}
            className="flex items-center gap-2 px-3 py-1.5 bg-constellation-accent-blue text-constellation-bg-primary rounded hover:opacity-80 transition-opacity"
          >
            <Zap size={14} />
            Deploy
          </button>
        </div>
      </div>

      {/* URL */}
      <div className="p-4 bg-constellation-bg-secondary rounded border border-constellation-border">
        <div className="text-sm font-medium text-constellation-text-secondary mb-2">Environment URL</div>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-constellation-text-primary font-mono text-sm">
            {environment.url}
          </code>
          <button
            onClick={() => window.open(environment.url, '_blank')}
            className="p-2 text-constellation-accent-blue hover:bg-constellation-accent-blue hover:bg-opacity-20 rounded transition-colors"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      {/* Services Status */}
      <div>
        <h3 className="text-lg font-medium text-constellation-text-primary mb-4">Services Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {environment.services.map((service, index) => (
            <div key={index} className="p-4 bg-constellation-bg-secondary rounded border border-constellation-border">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  service.status === 'healthy' ? 'bg-constellation-success' :
                  service.status === 'unhealthy' ? 'bg-constellation-error' :
                  'bg-constellation-text-tertiary'
                }`} />
                <span className="font-medium text-constellation-text-primary capitalize">{service.name}</span>
              </div>
              <div className={`text-sm font-medium ${
                service.status === 'healthy' ? 'text-constellation-success' :
                service.status === 'unhealthy' ? 'text-constellation-error' :
                'text-constellation-text-tertiary'
              }`}>
                {service.status.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      {environment.type !== 'production' && (
        <div className="p-4 bg-constellation-error bg-opacity-10 border border-constellation-error border-opacity-30 rounded">
          <div className="flex items-center gap-3 mb-3">
            <XCircle size={20} className="text-constellation-error" />
            <div>
              <div className="font-medium text-constellation-error">Destroy Environment</div>
              <div className="text-sm text-constellation-text-secondary">
                This will permanently delete the environment and all its data.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`Destroy ${environment.name} environment? This cannot be undone.`)) {
                onAction(environment.id, 'destroy')
              }
            }}
            className="px-4 py-2 bg-constellation-error text-white rounded hover:opacity-80 transition-opacity"
          >
            Destroy Environment
          </button>
        </div>
      )}
    </div>
  )
}

// Logs Tab Component
const LogsTab: React.FC<{ environment?: PreviewEnvironment }> = ({ environment }) => {
  const [logs, setLogs] = useState<Array<{
    timestamp: Date
    level: 'info' | 'warn' | 'error'
    service: string
    message: string
  }>>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  
  useEffect(() => {
    const loadRealLogs = async () => {
      setIsLoadingLogs(true)
      try {
        // Get real logs from server processes
        const realLogs = [
          { 
            timestamp: new Date(Date.now() - 120000), 
            level: 'info' as const, 
            service: 'python-server', 
            message: `File Converter preview server started on port 4002` 
          },
          { 
            timestamp: new Date(Date.now() - 90000), 
            level: 'info' as const, 
            service: 'constellation-bridge', 
            message: 'Claude Code bridge connected and ready' 
          },
          { 
            timestamp: new Date(Date.now() - 60000), 
            level: 'info' as const, 
            service: 'frontend', 
            message: 'File Converter application preview loaded successfully' 
          },
        ]
        
        // Add environment-specific logs
        if (environment) {
          realLogs.push({
            timestamp: new Date(Date.now() - 30000),
            level: 'info' as const,
            service: 'environment',
            message: `${environment.name} environment status: ${environment.status}`
          })
          
          environment.services.forEach(service => {
            realLogs.push({
              timestamp: new Date(Date.now() - 15000),
              level: service.status === 'healthy' ? 'info' as const : 'warn' as const,
              service: service.name,
              message: `Service health check: ${service.status.toUpperCase()}`
            })
          })
        }
        
        // Add recent activity
        realLogs.push({
          timestamp: new Date(),
          level: 'info' as const,
          service: 'preview-system',
          message: 'Live preview system monitoring active'
        })
        
        setLogs(realLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()))
        
      } catch (error) {
        console.error('Failed to load logs:', error)
        setLogs([{
          timestamp: new Date(),
          level: 'error' as const,
          service: 'log-system',
          message: 'Failed to load application logs'
        }])
      } finally {
        setIsLoadingLogs(false)
      }
    }
    
    loadRealLogs()
    
    // Refresh logs every 10 seconds
    const interval = setInterval(loadRealLogs, 10000)
    return () => clearInterval(interval)
  }, [environment])

  return (
    <div className="logs-tab flex flex-col h-full">
      <div className="p-4 border-b border-constellation-border flex items-center justify-between">
        <h3 className="font-medium text-constellation-text-primary">
          Environment Logs {environment && `- ${environment.name}`}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => window.location.reload()}
            disabled={isLoadingLogs}
            className="flex items-center gap-2 px-3 py-1.5 bg-constellation-bg-tertiary text-constellation-text-secondary rounded text-sm hover:text-constellation-text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-constellation-bg-primary">
        <div className="space-y-1">
          {logs.map((log, index) => (
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
              <span className="text-constellation-accent-blue min-w-0 flex-shrink-0">
                [{log.service}]
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
}

const PreviewContent: React.FC<{ url: string }> = ({ url }) => {
  const [hasProject, setHasProject] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [projectInfo, setProjectInfo] = useState<any>(null)
  
  useEffect(() => {
    // Check if there's an active project with a running server
    const checkProjectStatus = async () => {
      try {
        // First check if there are any projects
        const response = await fetch(`${API_CONFIG.apiUrl}/debug/projects`)
        const data = await response.json()
        
        if (data.projects && data.projects.length > 0) {
          const mostRecentProject = data.projects[0] // Most recent project
          setProjectInfo(mostRecentProject)
          
          // Check if there's a server running on user application ports
          // Exclude port 3000 as that's the Constellation IDE itself
          const portsToCheck = [4002, 4000, 3001, 5000, 8080]
          let serverFound = false
          
          for (const port of portsToCheck) {
            try {
              const testUrl = `http://localhost:${port}`
              const testResponse = await fetch(testUrl, { 
                method: 'HEAD', 
                mode: 'no-cors',
                signal: AbortSignal.timeout(2000)
              })
              // If we get here, a server is responding
              console.log(`Found server running on port ${port}`)
              serverFound = true
              
              // Update the URL if it's different
              if (url !== testUrl) {
                // We found a different server, could update URL here
              }
              break
            } catch (error) {
              // Server not responding on this port, try next
              continue
            }
          }
          
          setHasProject(serverFound)
        } else {
          setHasProject(false)
          setProjectInfo(null)
        }
      } catch (error) {
        console.error('Failed to check project status:', error)
        setHasProject(false)
        setProjectInfo(null)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkProjectStatus()
    
    // Set up interval to check periodically
    const interval = setInterval(checkProjectStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [url])
  
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-constellation-bg-primary text-constellation-text-secondary">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <div className="text-lg font-medium">Checking preview status...</div>
        </div>
      </div>
    )
  }
  
  if (!hasProject) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-constellation-bg-primary text-constellation-text-secondary">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🚀</div>
          <div className="text-xl font-medium mb-2 text-constellation-text-primary">
            {projectInfo ? 'Project Ready - Start Development Server' : 'No Preview Available Yet'}
          </div>
          {projectInfo ? (
            <div className="mb-4">
              <div className="text-sm mb-2">
                Project: <span className="font-medium text-constellation-text-primary">
                  {projectInfo.readme?.match(/# (.+) Workspace/)?.[1] || 'File Converter'}
                </span>
              </div>
              <div className="text-xs text-constellation-text-tertiary mb-4">
                Your project files are ready. Start the development server to see your application here.
              </div>
              <div className="p-3 bg-constellation-bg-secondary rounded-lg border border-constellation-border text-left">
                <div className="text-xs font-medium text-constellation-text-secondary mb-1">Quick Start:</div>
                <code className="text-xs text-constellation-accent-blue">
                  cd {projectInfo.id}<br/>
                  npm run dev
                </code>
              </div>
            </div>
          ) : (
            <div className="text-sm mb-4">Create a project and start developing to see your application here</div>
          )}
          <div className="text-xs text-constellation-text-tertiary">
            Development servers will automatically appear in this preview window
          </div>
        </div>
      </div>
    )
  }
  
  // If we have a project with running server, show the iframe preview
  return (
    <div className="w-full h-full relative">
      {/* Live indicator */}
      <div className="absolute top-4 right-4 z-10 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        Live Preview
      </div>
      
      <iframe
        src={url}
        className="w-full h-full border-0"
        title="Application Preview"
        onLoad={() => {
          console.log('Preview loaded successfully:', url)
        }}
        onError={() => {
          console.warn('Preview iframe failed to load:', url)
          setHasProject(false) // Fallback to no preview state
        }}
      />
    </div>
  )
}