import React from 'react'
import { useSnapshot } from 'valtio'
import { appStore } from '@/stores/app-store'
import { Bot, Zap, Clock, CheckCircle } from 'lucide-react'

export const AgentStatus: React.FC = () => {
  const state = useSnapshot(appStore)
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Zap size={12} className="text-constellation-accent-green" />
      case 'busy':
        return <Clock size={12} className="text-constellation-accent-yellow animate-pulse" />
      case 'idle':
        return <CheckCircle size={12} className="text-constellation-text-tertiary" />
      default:
        return <Bot size={12} className="text-constellation-text-tertiary" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-constellation-accent-green'
      case 'busy':
        return 'text-constellation-accent-yellow'
      case 'idle':
        return 'text-constellation-text-tertiary'
      default:
        return 'text-constellation-text-tertiary'
    }
  }

  return (
    <div className="agent-status border-b border-constellation-border p-3">
      <div className="text-xs font-medium text-constellation-text-secondary mb-2">
        Active Agents ({state.activeAgents.length})
      </div>
      
      <div className="space-y-2">
        {state.agents
          .filter(agent => state.activeAgents.includes(agent.id))
          .map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-2 text-xs"
            >
              {getStatusIcon(agent.status)}
              <span className={`font-medium ${getStatusColor(agent.status)}`}>
                {agent.name}
              </span>
              <span className="text-constellation-text-tertiary text-xs">
                • {agent.status}
              </span>
            </div>
          ))}
      </div>

      {state.agents.some(agent => agent.status === 'busy') && (
        <div className="mt-3 p-2 bg-constellation-bg-tertiary rounded border border-constellation-border">
          <div className="flex items-center gap-2 text-xs text-constellation-text-secondary">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-constellation-accent-blue rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-constellation-accent-green rounded-full animate-pulse delay-100" />
              <div className="w-1.5 h-1.5 bg-constellation-accent-yellow rounded-full animate-pulse delay-200" />
            </div>
            <span>Coordinating agents...</span>
          </div>
        </div>
      )}
    </div>
  )
}