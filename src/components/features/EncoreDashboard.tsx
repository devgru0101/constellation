import React, { useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { appStore, useAppStore } from '@/stores/app-store'
import { 
  Activity, 
  Globe, 
  Database, 
  Zap, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  Play,
  RefreshCw,
  BarChart3,
  Network,
  Code,
  BookOpen
} from 'lucide-react'

interface Service {
  name: string
  status: 'running' | 'stopped' | 'error'
  endpoint: string
  methods: string[]
  uptime: string
  requests: number
  avgLatency: number
}

interface Trace {
  id: string
  service: string
  operation: string
  duration: number
  status: 'success' | 'error'
  timestamp: Date
}

export const EncoreDashboard: React.FC = () => {
  const state = useSnapshot(appStore)
  const { addChatMessage } = useAppStore()
  const [activeTab, setActiveTab] = useState<'services' | 'traces' | 'explorer' | 'flow'>('services')
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // Check for running Encore applications
  useEffect(() => {
    const checkEncoreStatus = async () => {
      if (!state.currentProject) return;
      
      const isEncoreProject = state.currentProject.type?.includes('encore') || 
                             state.currentProject.type === 'microservices';
      
      if (!isEncoreProject) return;

      setIsCheckingStatus(true);
      try {
        // Check if Encore dev dashboard is accessible
        const response = await fetch('http://localhost:9091', { 
          method: 'HEAD',
          mode: 'no-cors'
        });
        
        // If we can reach the dashboard, set the URL
        setDashboardUrl('http://localhost:9091');
      } catch (error) {
        // Dashboard not available yet
        setDashboardUrl(null);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkEncoreStatus();
    
    // Check periodically for dashboard availability
    const interval = setInterval(checkEncoreStatus, 5000);
    return () => clearInterval(interval);
  }, [state.currentProject]);

  // Mock Encore services data
  const [services] = useState<Service[]>([
    {
      name: 'gateway',
      status: 'running',
      endpoint: '/api/gateway',
      methods: ['GET', 'POST'],
      uptime: '2h 34m',
      requests: 1247,
      avgLatency: 45
    },
    {
      name: 'auth',
      status: 'running', 
      endpoint: '/api/auth',
      methods: ['POST', 'GET', 'DELETE'],
      uptime: '2h 34m',
      requests: 892,
      avgLatency: 23
    },
    {
      name: 'survey',
      status: 'running',
      endpoint: '/api/survey',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      uptime: '2h 33m',
      requests: 2156,
      avgLatency: 67
    },
    {
      name: 'storage',
      status: 'running',
      endpoint: '/api/storage',
      methods: ['POST', 'GET', 'DELETE'],
      uptime: '2h 34m',
      requests: 445,
      avgLatency: 156
    }
  ])

  // Mock traces data
  const [traces] = useState<Trace[]>([
    {
      id: 'trace-1',
      service: 'survey',
      operation: 'CreateSurvey',
      duration: 234,
      status: 'success',
      timestamp: new Date(Date.now() - 60000)
    },
    {
      id: 'trace-2', 
      service: 'auth',
      operation: 'ValidateToken',
      duration: 12,
      status: 'success',
      timestamp: new Date(Date.now() - 120000)
    },
    {
      id: 'trace-3',
      service: 'storage',
      operation: 'UploadFile',
      duration: 1205,
      status: 'success',
      timestamp: new Date(Date.now() - 180000)
    },
    {
      id: 'trace-4',
      service: 'survey',
      operation: 'GetSurveys',
      duration: 89,
      status: 'error',
      timestamp: new Date(Date.now() - 240000)
    }
  ])

  const startEncoreApp = async () => {
    if (!state.currentProject) return;
    
    setIsLoading(true)
    
    addChatMessage({
      role: 'assistant',
      content: `🚀 **Encore Dashboard**: Starting your Encore.ts application...\n\n⚡ Running \`npx encore run\` command...\n📦 Provisioning local infrastructure...\n🌐 Starting development dashboard...`,
      type: 'generation',
      agentId: 'master-orchestrator'
    })

    try {
      // Import the enhanced chat service to trigger the real application start
      const { enhancedChatService } = await import('@/services/enhanced-chat-service');
      
      // Execute the start command in the project container
      const result = await enhancedChatService.executeTerminalCommand('npx encore run');
      
      if (result.exitCode === 0) {
        // Give the dashboard time to start up
        setTimeout(() => {
          setDashboardUrl('http://localhost:9091');
        }, 3000);
        
        addChatMessage({
          role: 'assistant',
          content: `✅ **Encore Dashboard**: Application started successfully!\n\n🌐 **Dashboard URL**: http://localhost:9091\n📊 **Backend API**: http://localhost:4000\n🎨 **Frontend**: http://localhost:3000\n⚡ **Status**: All systems operational\n\nYou can now explore your API documentation, test endpoints, and view distributed traces.`,
          type: 'generation',
          agentId: 'master-orchestrator'
        });
      } else {
        addChatMessage({
          role: 'assistant',
          content: `❌ **Encore Dashboard**: Failed to start application.\n\n**Error Output:**\n\`\`\`\n${result.output}\n\`\`\`\n\nPlease check that your Encore.ts application is properly configured.`,
          type: 'generation',
          agentId: 'master-orchestrator'
        });
      }
    } catch (error) {
      addChatMessage({
        role: 'assistant',
        content: `❌ **Encore Dashboard**: Failed to start application. Please check that Encore CLI is installed and your project configuration is correct.\n\n**Error**: ${(error as Error).message}`,
        type: 'generation',
        agentId: 'master-orchestrator'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: Service['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle size={16} className="text-constellation-success" />
      case 'stopped':
        return <Clock size={16} className="text-constellation-text-tertiary" />
      case 'error':
        return <AlertTriangle size={16} className="text-constellation-error" />
    }
  }

  const getStatusColor = (status: Service['status']) => {
    switch (status) {
      case 'running':
        return 'text-constellation-success'
      case 'stopped':
        return 'text-constellation-text-tertiary'
      case 'error':
        return 'text-constellation-error'
    }
  }

  return (
    <div className="encore-dashboard flex flex-col h-full bg-constellation-bg-primary">
      {/* Dashboard Header */}
      <div className="dashboard-header p-6 border-b border-constellation-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-constellation-text-primary mb-2">
              Encore Development Dashboard
            </h1>
            <p className="text-constellation-text-secondary">
              Real-time insights for your Encore.ts microservices application
            </p>
          </div>
          
          <div className="flex gap-3">
            {isCheckingStatus && (
              <div className="flex items-center gap-2 px-4 py-2 bg-constellation-bg-secondary border border-constellation-border rounded-md">
                <RefreshCw size={16} className="animate-spin text-constellation-accent-blue" />
                <span className="text-sm text-constellation-text-secondary">Checking dashboard...</span>
              </div>
            )}
            
            {!dashboardUrl && !isCheckingStatus ? (
              <div className="flex gap-2">
                <button
                  onClick={startEncoreApp}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  {isLoading ? 'Starting...' : 'Start Encore App'}
                </button>
                <div className="flex items-center px-3 py-2 bg-constellation-bg-secondary border border-constellation-border rounded-md">
                  <span className="text-xs text-constellation-text-tertiary">
                    Dashboard: Not Running
                  </span>
                </div>
              </div>
            ) : dashboardUrl ? (
              <div className="flex gap-2">
                <a
                  href={dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-constellation-accent-green text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={16} />
                  Open Live Dashboard
                </a>
                <div className="flex items-center px-3 py-2 bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-md">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-xs text-green-400 font-medium">
                    Dashboard: Live
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {dashboardUrl && (
          <div className="dashboard-url p-3 bg-constellation-bg-secondary border border-constellation-border rounded-md">
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-constellation-accent-blue" />
              <code className="flex-1 text-constellation-text-primary font-mono text-sm">
                {dashboardUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(dashboardUrl)}
                className="text-constellation-text-secondary hover:text-constellation-text-primary text-xs"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard Tabs */}
      <div className="flex border-b border-constellation-border">
        {[
          { id: 'services' as const, label: 'Service Catalog', icon: Database },
          { id: 'traces' as const, label: 'Distributed Tracing', icon: Activity },
          { id: 'explorer' as const, label: 'API Explorer', icon: Code },
          { id: 'flow' as const, label: 'Encore Flow', icon: Network },
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
        {activeTab === 'services' && (
          <div className="services-tab p-6 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="service-card p-6 bg-constellation-bg-secondary border border-constellation-border rounded-lg"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-constellation-text-primary">
                          {service.name}
                        </h3>
                        {getStatusIcon(service.status)}
                      </div>
                      <code className="text-xs text-constellation-text-secondary bg-constellation-bg-tertiary px-2 py-1 rounded">
                        {service.endpoint}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-constellation-text-secondary">Status:</span>
                      <span className={`font-medium ${getStatusColor(service.status)}`}>
                        {service.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-constellation-text-secondary">Uptime:</span>
                      <span className="text-constellation-text-primary">{service.uptime}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-constellation-text-secondary">Requests:</span>
                      <span className="text-constellation-text-primary">{service.requests.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-constellation-text-secondary">Avg Latency:</span>
                      <span className="text-constellation-text-primary">{service.avgLatency}ms</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-constellation-border">
                    <div className="text-xs text-constellation-text-secondary mb-2">Methods:</div>
                    <div className="flex flex-wrap gap-1">
                      {service.methods.map((method) => (
                        <span
                          key={method}
                          className="px-2 py-1 bg-constellation-accent-blue bg-opacity-20 text-constellation-accent-blue text-xs rounded"
                        >
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'traces' && (
          <div className="traces-tab p-6 overflow-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-constellation-text-primary">
                  Recent Traces
                </h2>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-constellation-bg-tertiary text-constellation-text-secondary rounded text-sm hover:text-constellation-text-primary transition-colors">
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>

              <div className="traces-list space-y-3">
                {traces.map((trace) => (
                  <div
                    key={trace.id}
                    className="trace-item p-4 bg-constellation-bg-secondary border border-constellation-border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          trace.status === 'success' ? 'bg-constellation-success' : 'bg-constellation-error'
                        }`} />
                        <span className="font-medium text-constellation-text-primary">
                          {trace.service}.{trace.operation}
                        </span>
                      </div>
                      <span className="text-xs text-constellation-text-tertiary">
                        {trace.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-constellation-text-secondary">
                        Duration: <span className="text-constellation-text-primary">{trace.duration}ms</span>
                      </span>
                      <span className={`font-medium ${
                        trace.status === 'success' ? 'text-constellation-success' : 'text-constellation-error'
                      }`}>
                        {trace.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'explorer' && (
          <div className="explorer-tab p-6 overflow-auto">
            <div className="text-center py-12">
              <Code size={48} className="mx-auto mb-4 text-constellation-text-tertiary" />
              <h2 className="text-xl font-semibold text-constellation-text-primary mb-2">
                API Explorer
              </h2>
              <p className="text-constellation-text-secondary mb-6 max-w-md mx-auto">
                Interactive API documentation and testing interface. Start your Encore app to explore and test your endpoints.
              </p>
              {dashboardUrl && (
                <a
                  href={dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={16} />
                  Open API Explorer
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === 'flow' && (
          <div className="flow-tab p-6 overflow-auto">
            <div className="text-center py-12">
              <Network size={48} className="mx-auto mb-4 text-constellation-text-tertiary" />
              <h2 className="text-xl font-semibold text-constellation-text-primary mb-2">
                Encore Flow
              </h2>
              <p className="text-constellation-text-secondary mb-6 max-w-md mx-auto">
                Visual representation of your microservices architecture and data flow. See how your services communicate in real-time.
              </p>
              {dashboardUrl && (
                <a
                  href={dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-constellation-accent-blue text-constellation-bg-primary rounded-md hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={16} />
                  View Architecture Flow
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}